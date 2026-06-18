"""
Streaming routes:
  POST /api/stream/{film_id}/token  — issue DRM stream token (auth required)
  GET  /api/stream/{film_id}/status — check video processing status
  GET  /api/stream/validate         — edge token validation (CDN calls this)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from services.drm_service   import create_stream_token, verify_stream_token
from services.video_storage import get_signed_stream_urls, get_video_status

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


# ── Auth helper (re-uses main JWT logic) ────────────────────────
def _get_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    import jwt, os
    secret = os.getenv("JWT_SECRET", "universe_secret_key_change_me")
    try:
        return jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")


class StreamTokenResponse(BaseModel):
    token:      str
    signed_url: str
    expires_at: int        # epoch ms
    qualities:  list[dict]


# ── Issue stream token ───────────────────────────────────────────
@router.post("/{film_id}/token", response_model=StreamTokenResponse)
async def issue_stream_token(
    film_id: str,
    request: Request,
    user: dict = Depends(_get_user),
):
    user_id = user.get("sub", "")
    ip_hint = request.client.host if request.client else ""

    # Fetch signed stream URLs for all quality levels
    try:
        qualities = get_signed_stream_urls(film_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"get_signed_stream_urls failed: {e}")
        raise HTTPException(500, "Erreur interne du service de streaming")

    token_data = create_stream_token(
        user_id=user_id,
        film_id=film_id,
        ip_hint=ip_hint,
        qualities=qualities,
    )

    # Pick the highest quality signed URL as the primary URL
    primary_url = qualities[-1]["playlistUrl"] if qualities else ""

    return StreamTokenResponse(
        token=token_data["token"],
        signed_url=primary_url,
        expires_at=token_data["expires_at"],
        qualities=qualities,
    )


# ── Video processing status ─────────────────────────────────────
@router.get("/{film_id}/status")
async def film_status(film_id: str, user: dict = Depends(_get_user)):
    status = get_video_status(film_id)
    if not status:
        raise HTTPException(404, "Film introuvable")
    return status


# ── Edge validation (called by Nginx / CDN) ─────────────────────
@router.get("/validate")
async def validate_edge_token(drm: str):
    """
    Lightweight endpoint for Nginx auth_request validation.
    Returns 200 if token valid, 401 if not.
    """
    try:
        verify_stream_token(drm)
        return {"valid": True}
    except ValueError as e:
        raise HTTPException(401, str(e))
