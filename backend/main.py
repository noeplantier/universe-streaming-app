from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uvicorn
from config.settings import APP_TITLE, APP_VERSION, CORS_ORIGINS
from routes import auth, users, data

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application"""
    logger.info(f"🚀 Démarrage de {APP_TITLE} v{APP_VERSION}")
    
    # Initialisation paresseuse de la base de données au démarrage
    # Import local pour ne pas bloquer le chargement du fichier
    from supabase_client import init_supabase 
    
    app.state.supabase = init_supabase()
    
    if app.state.supabase:
        logger.info("✅ Supabase connecté")
    else:
        logger.warning("⚠️ Supabase non configuré")
        
    yield
    
    logger.info("🛑 Arrêt du serveur")

app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="API Streaming Universe",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(data.router, prefix="/api/data", tags=["data"])

@app.get("/api/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "supabase": "connected" if hasattr(app.state, "supabase") and app.state.supabase else "disconnected"
    }

@app.get("/", tags=["root"])
async def root():
    return {"message": f"Bienvenue sur {APP_TITLE} v{APP_VERSION}"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )