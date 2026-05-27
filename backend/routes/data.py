from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()

class SeenFilmPayload(BaseModel):
    user_id: str
    work_id: int

@router.get("/catalog")
async def get_catalog(request: Request):
    """Récupère le catalogue global (Cache ultra-rapide)"""
    redis = request.app.state.redis
    supabase = request.app.state.supabase
    cache_key = "catalog_global"
    
    try:
        # 1. Requête ultra rapide depuis la RAM (Redis)
        cached_catalog = await redis.get(cache_key)
        if cached_catalog:
            return json.loads(cached_catalog)
            
        # 2. Si pas en cache, on attaque la DB
        response = supabase.table("works").select("*").execute()
        
        # 3. Sauvegarde en cache (300 secondes = 5 minutes)
        await redis.setex(cache_key, 300, json.dumps(response.data))
        return response.data
        
    except Exception as e:
        logger.error(f"Erreur récupération catalogue: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération du catalogue")

@router.delete("/seen")
async def remove_seen(request: Request, payload: SeenFilmPayload):
    """Supprime un film vu"""
    supabase = request.app.state.supabase
    try:
        response = supabase.table("seen_films").delete().match({
            "user_id": payload.user_id,
            "work_id": payload.work_id
        }).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Erreur remove_seen: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la suppression")

@router.get("/notifications")
async def get_notifications(request: Request, user_id: str):
    """Récupère les notifications temporelles (Pas de cache, besoin de temps réel)"""
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
        raise HTTPException(status_code=400, detail="Erreur lors de la récupération")