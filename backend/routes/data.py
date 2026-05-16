from fastapi import APIRouter, HTTPException, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_data(request: Request):
    """Récupère les données"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
    
    try:
        response = supabase.table("data").select("*").execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur get_data: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la récupération des données")

@router.post("/")
async def create_data(request: Request, data: dict):
    """Crée une nouvelle donnée"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
        
    try:
        response = supabase.table("data").insert(data).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur create_data: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la création de la donnée")