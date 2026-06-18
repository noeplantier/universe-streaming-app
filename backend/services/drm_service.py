"""
DRM-lite service: HMAC-SHA256 signed stream tokens with embedded claims.
Tokens are short-lived (4h), user-bound, and carry film/quality metadata.
They travel as Authorization: Bearer headers on every HLS segment request.
"""
import hmac
import hashlib
import base64
import json
import time
import os
import uuid
from typing import Any

_SECRET = os.getenv("DRM_SECRET", "universe-drm-secret-change-in-production")
_TTL_SECONDS = 4 * 3600  # 4 hours


def _sign(payload_b64: str) -> str:
    sig = hmac.new(_SECRET.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).rstrip(b"=").decode()


def create_stream_token(
    user_id: str,
    film_id: str,
    ip_hint: str = "",
    qualities: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Returns a signed token dict:
      { token, expires_at, qualities }
    The token is a compact signed JWT-like structure (no library dependency).
    """
    now = int(time.time())
    expires_at = now + _TTL_SECONDS

    claims = {
        "jti": str(uuid.uuid4()),
        "sub": user_id,
        "fid": film_id,
        "iat": now,
        "exp": expires_at,
        "ip":  ip_hint[:45],          # truncate IPv6
    }

    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(claims).encode()
    ).rstrip(b"=").decode()

    sig = _sign(payload_b64)
    token = f"{payload_b64}.{sig}"

    return {
        "token":      token,
        "expires_at": expires_at * 1000,   # ms for JS Date
        "qualities":  qualities or [],
    }


def verify_stream_token(token: str) -> dict[str, Any]:
    """
    Verifies signature + expiry. Returns claims dict or raises ValueError.
    """
    try:
        payload_b64, sig = token.rsplit(".", 1)
    except ValueError:
        raise ValueError("Malformed token")

    expected_sig = _sign(payload_b64)
    if not hmac.compare_digest(expected_sig, sig):
        raise ValueError("Invalid signature")

    # Decode claims
    padding = "=" * (-len(payload_b64) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))

    if int(time.time()) > claims["exp"]:
        raise ValueError("Token expired")

    return claims


def build_signed_segment_url(base_url: str, film_id: str, segment: str, token: str) -> str:
    """
    Build a CDN signed URL for a single HLS segment.
    The token is appended as a query param for CDN edge validation.
    """
    return f"{base_url}/cdn/{film_id}/segments/{segment}?drm={token}"
