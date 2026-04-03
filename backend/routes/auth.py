from fastapi import APIRouter, HTTPException
from database import get_supabase
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/login")
async def login(email: str, password: str):
    """Route de connexion"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase non disponible")
    
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return {"status": "ok", "user": response.user}
    except Exception as e:
        logger.error(f"Erreur login: {e}")
        raise HTTPException(status_code=401, detail="Identifiants invalides")

@router.post("/signup")
async def signup(email: str, password: str):
    """Route d'inscription"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase non disponible")
    
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        return {"status": "ok", "user": response.user}
    except Exception as e:
        logger.error(f"Erreur signup: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de l'inscription")