"""
Video storage service using Supabase Storage as origin + CDN.
Handles:
  - Multipart/chunked upload registration
  - Signed URL generation per quality level
  - Presigned upload URLs for direct client → storage upload
  - Metadata persistence in Supabase DB (videos table)
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from database import get_supabase

logger = logging.getLogger(__name__)

SUPABASE_URL       = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY       = os.getenv("SUPABASE_KEY", "")
STORAGE_BUCKET     = os.getenv("VIDEO_BUCKET", "universe-videos")
CDN_BASE_URL       = os.getenv("CDN_BASE_URL", "")  # e.g. https://cdn.universe.film
SIGNED_URL_TTL_SEC = 4 * 3600  # match DRM token TTL

# Quality profiles sent to FFmpeg transcoding worker
QUALITY_PROFILES = [
    {"label": "360p",  "resolution": "640x360",  "video_bitrate": "800k",  "audio_bitrate": "96k",  "bandwidth": 800_000},
    {"label": "720p",  "resolution": "1280x720", "video_bitrate": "2500k", "audio_bitrate": "128k", "bandwidth": 2_500_000},
    {"label": "1080p", "resolution": "1920x1080","video_bitrate": "5000k", "audio_bitrate": "192k", "bandwidth": 5_000_000},
    {"label": "4K",    "resolution": "3840x2160","video_bitrate": "15000k","audio_bitrate": "320k", "bandwidth": 15_000_000},
]


def _sb():
    """
    Client Supabase partagé (singleton paresseux de database.py) au lieu d'en
    recréer un (et son pool de connexions httpx sous-jacent) à chaque appel.
    """
    sb = get_supabase()
    if not sb:
        raise RuntimeError("Client Supabase non initialisé")
    return sb


def create_video_record(
    title: str,
    description: str,
    director_id: str,
    genre: str,
    duration_seconds: int,
) -> dict:
    """Insert a pending video row and return its ID + upload metadata."""
    video_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    sb = _sb()
    sb.table("videos").insert({
        "id":               video_id,
        "title":            title,
        "description":      description,
        "director_id":      director_id,
        "genre":            genre,
        "duration_seconds": duration_seconds,
        "status":           "pending_upload",
        "created_at":       now,
        "updated_at":       now,
    }).execute()

    return {"video_id": video_id, "upload_path": f"originals/{video_id}"}


def get_presigned_upload_url(video_id: str, filename: str) -> str:
    """
    Return a Supabase presigned URL for direct upload from client.
    The client PUTs the file directly to storage — backend never touches the bytes.
    """
    sb = _sb()
    path = f"originals/{video_id}/{filename}"
    response = sb.storage.from_(STORAGE_BUCKET).create_signed_upload_url(path)
    return response.get("signedURL", "")


def get_signed_stream_urls(video_id: str) -> list[dict]:
    """
    Return signed streaming URLs for all available quality levels.
    Raises if video not yet transcoded.
    """
    sb = _sb()
    result = sb.table("videos").select("status, qualities").eq("id", video_id).single().execute()
    video = result.data

    if not video or video.get("status") != "ready":
        raise ValueError(f"Video {video_id} not ready (status={video.get('status')})")

    qualities_meta = video.get("qualities") or []
    signed_qualities = []

    for q in qualities_meta:
        path = q.get("playlist_path", "")
        if not path:
            continue

        signed = sb.storage.from_(STORAGE_BUCKET).create_signed_url(
            path, SIGNED_URL_TTL_SEC
        )
        url = signed.get("signedURL", "")
        if url:
            signed_qualities.append({
                "label":       q["label"],
                "bandwidth":   q["bandwidth"],
                "resolution":  q["resolution"],
                "playlistUrl": url,
            })

    return signed_qualities


def mark_video_ready(video_id: str, qualities_written: list[dict]):
    """Called by transcoding worker when all quality levels are encoded."""
    sb = _sb()
    sb.table("videos").update({
        "status":             "ready",
        "qualities":          qualities_written,
        "transcode_progress": 100,
        "updated_at":         datetime.now(timezone.utc).isoformat(),
    }).eq("id", video_id).execute()
    logger.info(f"Video {video_id} marked ready with {len(qualities_written)} quality levels")


def mark_video_failed(video_id: str, reason: str):
    sb = _sb()
    sb.table("videos").update({
        "status":           "failed",
        "transcode_error":  reason[:500],
        "updated_at":       datetime.now(timezone.utc).isoformat(),
    }).eq("id", video_id).execute()


def update_transcode_progress(video_id: str, pct: int):
    """Jalon grossier de progression (0-100), affiché par le polling /upload/{id}/status."""
    sb = _sb()
    sb.table("videos").update({
        "transcode_progress": max(0, min(100, pct)),
        "updated_at":          datetime.now(timezone.utc).isoformat(),
    }).eq("id", video_id).execute()


def get_video_status(video_id: str) -> dict:
    sb = _sb()
    r = sb.table("videos").select("id, status, transcode_progress, qualities").eq("id", video_id).single().execute()
    return r.data or {}
