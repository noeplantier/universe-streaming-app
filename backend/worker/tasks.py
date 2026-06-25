"""
Celery tasks — called by the API, processed by transcoder workers.
"""
import logging
from worker.celery_app import celery_app
from services.transcoding_service import transcode_video
from services.video_storage import update_transcode_progress

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="worker.tasks.transcode",
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=3600,   # 1h soft limit
    time_limit=4000,        # 66m hard kill
)
def transcode_task(self, video_id: str, source_path: str):
    """
    Async transcoding task. Retried twice on failure.
    Progress updates are written directly to Supabase (polled by client).
    """
    logger.info(f"[Celery] Starting transcode task: {video_id}")
    try:
        transcode_video(
            video_id=video_id,
            source_path=source_path,
            on_progress=lambda pct: update_transcode_progress(video_id, pct),
        )
    except Exception as exc:
        logger.error(f"[Celery] transcode failed for {video_id}: {exc}")
        raise self.retry(exc=exc)
