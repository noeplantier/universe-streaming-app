import jwt
import logging
import json
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config.settings import JWT_SECRET, JWT_ALGO, JWT_EXPIRATION_HOURS

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

def create_jwt_token(user_id: str, email: str) -> str:
    """Crée un JWT token statique"""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def verify_jwt_token(token: str) -> dict:
    """Vérifie mathématiquement la signature et l'expiration du JWT (Ultra rapide)"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Le token a expiré.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide.")

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dépendance FastAPI pour protéger une route.
    Utilise Redis pour valider les droits de l'utilisateur en temps réel sans toucher à Supabase.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentification requise")
        
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user_id = payload.get("sub")
    
    redis = request.app.state.redis
    
    # 1. (Optionnel) Vérifier si le token a été révoqué (logout manuel)
    is_blacklisted = await redis.get(f"blacklist_token:{token}")
    if is_blacklisted:
        raise HTTPException(status_code=401, detail="Ce token a été révoqué.")

    # 2. Récupérer le profil validé depuis le cache (Évite un appel Supabase par requête)
    cache_key = f"auth_user:{user_id}"
    cached_user = await redis.get(cache_key)
    
    if cached_user:
        return json.loads(cached_user)

    # 3. Cache Miss : On interroge Supabase une seule fois et on stocke
    supabase = request.app.state.supabase
    try:
        response = supabase.table("users").select("id, email, role, status").eq("id", user_id).single().execute()
        user_data = response.data
        
        # Si le compte est bloqué dans la DB
        if user_data.get("status") == "banned":
            raise HTTPException(status_code=403, detail="Ce compte a été banni.")
            
        # Mise en mémoire pour 15 minutes. Toutes les requêtes de ce spectateur 
        # pendant les 15 prochaines min ne toucheront plus Supabase !
        await redis.setex(cache_key, 900, json.dumps(user_data))
        return user_data
        
    except Exception as e:
        logger.error(f"Erreur Auth DB ({user_id}): {e}")
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")