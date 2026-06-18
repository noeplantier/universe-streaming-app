"""
Transcoding pipeline — FFmpeg ABR (Adaptive Bitrate) multi-quality HLS.
Runs in a background thread via FastAPI BackgroundTasks.

For production: replace subprocess with a managed job queue
(Celery + Redis, or AWS Elemental MediaConvert).

HLS output structure per video:
  /tmp/{video_id}/
    master.m3u8          <- master playlist (all qualities)
    360p/
      playlist.m3u8
      seg000.ts, seg001.ts, ...
    720p/
      playlist.m3u8
      ...
    1080p/
      playlist.m3u8
      ...
    4K/
      playlist.m3u8
      ...
"""
import os
import subprocess
import logging
import tempfile
import shutil
from pathlib import Path
from typing import Callable

from services.video_storage import (
    QUALITY_PROFILES,
    STORAGE_BUCKET,
    mark_video_ready,
    mark_video_failed,
)

logger = logging.getLogger(__name__)

FFMPEG_PATH   = os.getenv("FFMPEG_PATH", "ffmpeg")
SEGMENT_SECS  = 6   # HLS segment duration
HLS_LIST_SIZE = 0   # 0 = keep all segments in playlist


def _build_ffmpeg_cmd(input_path: str, output_dir: str) -> list[str]:
    """
    Build a single FFmpeg command that produces all quality variants + master playlist.
    Uses H.264 video + AAC audio for maximum device compatibility.
    """
    cmd = [FFMPEG_PATH, "-y", "-i", input_path]
    variant_streams = []

    for idx, q in enumerate(QUALITY_PROFILES):
        w, h = q["resolution"].split("x")
        vb   = q["video_bitrate"]
        ab   = q["audio_bitrate"]
        label = q["label"]

        # Map + encode each quality
        cmd += [
            "-map", "0:v:0", "-map", "0:a:0",
            f"-c:v:{idx}", "libx264", f"-b:v:{idx}", vb,
            f"-vf:v:{idx}", f"scale={w}:{h}",
            f"-c:a:{idx}", "aac", f"-b:a:{idx}", ab,
            f"-hls_time", str(SEGMENT_SECS),
            f"-hls_list_size", str(HLS_LIST_SIZE),
            f"-hls_segment_filename", f"{output_dir}/{label}/seg%03d.ts",
            f"-hls_flags", "independent_segments",
            f"{output_dir}/{label}/playlist.m3u8",
        ]

        # For master playlist stream info
        bandwidth = q["bandwidth"]
        variant_streams.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={q['resolution']}\n"
            f"{label}/playlist.m3u8"
        )

    return cmd, variant_streams


def _write_master_playlist(output_dir: str, variant_streams: list[str]):
    master_path = Path(output_dir) / "master.m3u8"
    content = "#EXTM3U\n#EXT-X-VERSION:3\n\n"
    content += "\n".join(variant_streams)
    master_path.write_text(content)
    return str(master_path)


def _upload_hls_to_storage(video_id: str, output_dir: str) -> list[dict]:
    """Upload all generated HLS files to Supabase Storage and return quality metadata."""
    from supabase import create_client
    sb = create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_KEY", ""),
    )

    qualities_written = []

    for q in QUALITY_PROFILES:
        label = q["label"]
        quality_dir = Path(output_dir) / label

        if not quality_dir.exists():
            logger.warning(f"Quality dir missing: {quality_dir}")
            continue

        # Upload playlist + all segments
        playlist_path = quality_dir / "playlist.m3u8"
        storage_playlist = f"hls/{video_id}/{label}/playlist.m3u8"

        with open(playlist_path, "rb") as f:
            sb.storage.from_(STORAGE_BUCKET).upload(
                storage_playlist, f.read(),
                {"content-type": "application/vnd.apple.mpegurl", "upsert": "true"}
            )

        for seg in sorted(quality_dir.glob("*.ts")):
            storage_seg = f"hls/{video_id}/{label}/{seg.name}"
            with open(seg, "rb") as f:
                sb.storage.from_(STORAGE_BUCKET).upload(
                    storage_seg, f.read(),
                    {"content-type": "video/mp2t", "upsert": "true"}
                )

        qualities_written.append({
            "label":         label,
            "bandwidth":     q["bandwidth"],
            "resolution":    q["resolution"],
            "playlist_path": storage_playlist,
        })

    # Upload master playlist
    master_path = Path(output_dir) / "master.m3u8"
    if master_path.exists():
        storage_master = f"hls/{video_id}/master.m3u8"
        with open(master_path, "rb") as f:
            sb.storage.from_(STORAGE_BUCKET).upload(
                storage_master, f.read(),
                {"content-type": "application/vnd.apple.mpegurl", "upsert": "true"}
            )

    return qualities_written


def transcode_video(
    video_id: str,
    source_path: str,
    on_progress: Callable[[int], None] | None = None,
):
    """
    Full transcoding pipeline. Called as a background task.
    1. Run FFmpeg → HLS multi-quality output
    2. Upload segments to Supabase Storage
    3. Mark video as ready in DB
    """
    output_dir = f"/tmp/transcode_{video_id}"
    os.makedirs(output_dir, exist_ok=True)
    for q in QUALITY_PROFILES:
        os.makedirs(f"{output_dir}/{q['label']}", exist_ok=True)

    try:
        logger.info(f"Starting transcode: video_id={video_id}")
        cmd, variant_streams = _build_ffmpeg_cmd(source_path, output_dir)

        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        _, stderr = proc.communicate()

        if proc.returncode != 0:
            error = stderr.decode("utf-8", errors="replace")[-2000:]
            logger.error(f"FFmpeg failed for {video_id}: {error}")
            mark_video_failed(video_id, f"FFmpeg error: {error}")
            return

        _write_master_playlist(output_dir, variant_streams)
        logger.info(f"FFmpeg done for {video_id}, uploading segments…")

        qualities_written = _upload_hls_to_storage(video_id, output_dir)
        mark_video_ready(video_id, qualities_written)
        logger.info(f"Transcode complete for {video_id}: {len(qualities_written)} qualities")

    except Exception as e:
        logger.exception(f"Transcode pipeline error for {video_id}")
        mark_video_failed(video_id, str(e))
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)
