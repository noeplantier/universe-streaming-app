from fastapi import APIRouter, HTTPException
from database import get_supabase
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{user_id}")
async def get_user(user_id: str):
    """Récupère un utilisateur"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase non disponible")
    
    try:
        response = supabase.table("users").select("*").eq("id", user_id).single().execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur get_user: {e}")
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

@router.put("/{user_id}")
async def update_user(user_id: str, data: dict):
    """Met à jour un utilisateur"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase non disponible")
    
    try:
        response = supabase.table("users").update(data).eq("id", user_id).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur update_user: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la mise à jour")