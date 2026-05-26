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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application (Démarrage et Arrêt)"""
    logger.info(f"🚀 Démarrage de {APP_TITLE} v{APP_VERSION}")
    
    # Initialisation de Supabase
    from supabase_client import init_supabase
    app.state.supabase = init_supabase()
    
    # ★ Initialisation du Connection Pool Redis (Thread-safe & Async)
    # Remplacer par l'URL de production si déployé (ex: REDIS_URL)
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    app.state.redis = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    
    try:
        await app.state.redis.ping()
        logger.info("✅ Connexion au serveur Redis établie avec succès")
    except Exception as e:
        logger.error(f"❌ Échec de la connexion Redis : {e}")

    yield  # L'application tourne ici

    # Arrêt propre des pools de connexion
    logger.info("🛑 Arrêt de l'application, fermeture de Redis...")
    await app.state.redis.close()

app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)

# --- MIDDLEWARES ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTES ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(data.router, prefix="/api/data", tags=["Data"])

# --- GESTION GLOBALE DES ERREURS ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erreur non gérée: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne du serveur est survenue."}
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)