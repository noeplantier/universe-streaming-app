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

@router.get("/seen")
async def get_seen_films(request: Request, user_id: str):
    """Récupère les films vus par un utilisateur"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
    
    try:
        response = supabase.table("seen_films").select("*").eq("user_id", user_id).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur get_seen: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la récupération de l'historique")

@router.post("/seen")
async def add_seen_film(request: Request, data: dict):
    """Ajoute un film vu"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
        
    try:
        response = supabase.table("seen_films").insert(data).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur add_seen: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de l'ajout")

@router.delete("/seen")
async def remove_seen_film(request: Request, data: dict):
    """Retire un film vu"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
        
    try:
        response = supabase.table("seen_films").delete().match({
            "user_id": data.get("user_id"),
            "work_id": data.get("work_id")
        }).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Erreur remove_seen: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la suppression")

@router.get("/notifications")
async def get_notifications(request: Request, user_id: str):
    """Récupère les notifications de l'utilisateur"""
    supabase = request.app.state.supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de données non disponible")
    
    try:
        response = supabase.table("notifications") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur get_notifications: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la récupération des notifications")