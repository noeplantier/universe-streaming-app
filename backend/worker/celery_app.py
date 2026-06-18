"""
Celery application — async transcoding queue.
Tasks are dispatched by the /api/upload/{id}/start route
and processed by transcoder containers.
"""
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "universe_transcoder",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={"worker.tasks.*": {"queue": "transcode"}},
    worker_prefetch_multiplier=1,   # one task at a time per worker process
    task_acks_late=True,            # ack only after task completes (no loss on crash)
    task_reject_on_worker_lost=True,
)
