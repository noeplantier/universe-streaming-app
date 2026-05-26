from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class AuthPayload(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(request: Request, payload: AuthPayload):
    """Route de connexion"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
    
    try:
        response = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password
        })
        return {"status": "ok", "user": response.user}
    except Exception as e:
        logger.error(f"Erreur login : {e}")
        raise HTTPException(status_code=401, detail="Identifiants invalides")

@router.post("/signup")
async def signup(request: Request, payload: AuthPayload):
    """Route d'inscription"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
    
    try:
        response = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password
        })
        return {"status": "ok", "user": response.user}
    except Exception as e:
        logger.error(f"Erreur signup : {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de l'inscription")