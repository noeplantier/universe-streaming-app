from fastapi import APIRouter, HTTPException
from database import get_supabase
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_data():
    """Récupère les données"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase non disponible")
    
    try:
        response = supabase.table("data").select("*").execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur get_data: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la récupération des données")

@router.post("/")
async def create_data(data: dict):
    """Crée une nouvelle donnée"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase non disponible")
    
    try:
        response = supabase.table("data").insert(data).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur create_data: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la création")