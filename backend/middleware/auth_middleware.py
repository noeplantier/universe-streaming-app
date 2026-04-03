import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.config.settings import JWT_SECRET, JWT_ALGO, JWT_EXPIRATION_HOURS
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

def create_jwt_token(user_id: str, email: str) -> str:
    """Crée un JWT token"""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def verify_jwt_token(token: str) -> dict:
    """Vérifie et décode un JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Récupère l'utilisateur actuel depuis le JWT"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Non autorisé")
    
    token = credentials.credentials
    payload = verify_jwt_token(token)
    return payload