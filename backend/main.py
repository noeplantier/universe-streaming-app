from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uvicorn
import os
import redis.asyncio as redis

from config.settings import APP_TITLE, APP_VERSION, CORS_ORIGINS
from routes import auth, users, data
from routes import streaming, upload
from middleware.security_middleware import RateLimitMiddleware

# Configuration du logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application (Démarrage et Arrêt)"""
    logger.info(f"🚀 Démarrage de {APP_TITLE} v{APP_VERSION}")
    
    # 1. Initialisation de Supabase (Base de données principale)
    from supabase_client import init_supabase
    app.state.supabase = init_supabase()
    
    # 2. Initialisation du Connection Pool Redis (Cache & Rate Limiting)
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    app.state.redis = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    
    try:
        await app.state.redis.ping()
        logger.info("✅ Connexion au serveur Redis établie avec succès")
    except Exception as e:
        logger.error(f"❌ Échec de la connexion Redis : {e}")

    yield  # L'application tourne activement à partir d'ici

    # 3. Arrêt propre des pools de connexion à la fermeture
    logger.info("🛑 Arrêt de l'application, fermeture de Redis...")
    await app.state.redis.close()

# Création de l'instance FastAPI
app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)

# --- MIDDLEWARES DE SÉCURITÉ ---

# 1. Bouclier anti-DDoS, anti-Spam et sécurisation des en-têtes HTTP
app.add_middleware(RateLimitMiddleware)

# 2. Restriction absolue des CORS (Partage des ressources entre origines multiples)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# --- INCLUSION DES ROUTES ---
app.include_router(auth.router,      prefix="/api/auth",    tags=["Auth"])
app.include_router(users.router,     prefix="/api/users",   tags=["Users"])
app.include_router(data.router,      prefix="/api/data",    tags=["Data"])
app.include_router(streaming.router, prefix="/api/stream",  tags=["Streaming"])
app.include_router(upload.router,    prefix="/api/upload",  tags=["Upload"])

# --- GESTION GLOBALE DES ERREURS ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Intercepte toute erreur non gérée pour éviter d'exposer la stack trace au client"""
    logger.error(f"Erreur serveur critique non gérée: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne du serveur est survenue. L'équipe technique a été notifiée."}
    )

if __name__ == "__main__":
    # Point d'entrée pour le développement local
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)