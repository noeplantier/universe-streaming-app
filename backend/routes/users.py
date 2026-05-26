from fastapi import APIRouter, HTTPException, Request
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{user_id}")
async def get_user(request: Request, user_id: str):
    """Récupère un utilisateur (Cache Redis 1 Heure)"""
    redis = request.app.state.redis
    supabase = request.app.state.supabase
    
    cache_key = f"user_profile:{user_id}"
    
    try:
        # 1. Vérification dans le cache Redis
        cached_user = await redis.get(cache_key)
        if cached_user:
            return json.loads(cached_user)
            
        # 2. Cache MISS : Requête Supabase
        response = supabase.table("users").select("*").eq("id", user_id).single().execute()
        
        # 3. Mise en cache de la réponse (3600 secondes = 1H)
        await redis.setex(cache_key, 3600, json.dumps(response.data))
        return response.data
        
    except Exception as e:
        logger.error(f"Erreur get_user ({user_id}): {e}")
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

@router.put("/{user_id}")
async def update_user(request: Request, user_id: str, data: dict):
    """Met à jour un utilisateur et invalide son cache"""
    redis = request.app.state.redis
    supabase = request.app.state.supabase
    
    try:
        # 1. Mise à jour dans Supabase
        response = supabase.table("users").update(data).eq("id", user_id).execute()
        
        # 2. Invalidation du cache : forcer le rechargement lors du prochain appel à get_user
        await redis.delete(f"user_profile:{user_id}")
        
        return response.data
    except Exception as e:
        logger.error(f"Erreur update_user ({user_id}): {e}")
        raise HTTPException(status_code=400, detail="Erreur lors de la mise à jour")