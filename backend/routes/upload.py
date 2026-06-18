"""
Video upload routes:
  POST /api/upload/init             — create video record + presigned upload URL
  POST /api/upload/{video_id}/start — trigger transcoding after upload
  GET  /api/upload/{video_id}/status — polling endpoint for transcoding progress
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional

from services.video_storage     import create_video_record, get_presigned_upload_url, get_video_status
from services.transcoding_service import transcode_video

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

MAX_UPLOAD_SIZE_GB = 10  # guard at API level


def _get_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    import jwt, os
    secret = os.getenv("JWT_SECRET", "universe_secret_key_change_me")
    try:
        return jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")


# ── Schemas ──────────────────────────────────────────────────────

class InitUploadRequest(BaseModel):
    title:            str = Field(..., min_length=2, max_length=200)
    description:      Optional[str] = None
    genre:            str
    duration_seconds: int = Field(..., gt=0, le=14400)  # max 4h
    filename:         str = Field(..., min_length=3)


class InitUploadResponse(BaseModel):
    video_id:    str
    upload_url:  str
    upload_path: str


class StartTranscodeRequest(BaseModel):
    source_storage_path: str   # path in Supabase Storage after client upload


# ── Routes ──────────────────────────────────────────────────────

@router.post("/init", response_model=InitUploadResponse)
async def init_upload(body: InitUploadRequest, user: dict = Depends(_get_user)):
    """
    Step 1: Register video in DB and get a presigned upload URL.
    The client PUT the file directly to Supabase Storage.
    """
    try:
        record = create_video_record(
            title=body.title,
            description=body.description or "",
            director_id=user["sub"],
            genre=body.genre,
            duration_seconds=body.duration_seconds,
        )
        presigned = get_presigned_upload_url(record["video_id"], body.filename)
        return InitUploadResponse(
            video_id=record["video_id"],
            upload_url=presigned,
            upload_path=record["upload_path"],
        )
    except Exception as e:
        logger.error(f"init_upload error: {e}")
        raise HTTPException(500, "Erreur initialisation upload")


@router.post("/{video_id}/start")
async def start_transcode(
    video_id: str,
    body: StartTranscodeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(_get_user),
):
    """
    Step 2: Client tells us upload is done → enqueue transcoding.
    Transcoding runs in background; client polls /status.
    """
    status = get_video_status(video_id)
    if not status:
        raise HTTPException(404, "Vidéo introuvable")
    if status.get("status") not in ("pending_upload", "failed"):
        raise HTTPException(409, f"État invalide pour transcodage: {status.get('status')}")

    background_tasks.add_task(
        transcode_video,
        video_id=video_id,
        source_path=body.source_storage_path,
    )
    return {"message": "Transcodage lancé", "video_id": video_id}


@router.get("/{video_id}/status")
async def upload_status(video_id: str, user: dict = Depends(_get_user)):
    """Step 3: Poll transcoding progress."""
    status = get_video_status(video_id)
    if not status:
        raise HTTPException(404, "Vidéo introuvable")
    return status
