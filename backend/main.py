from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
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

# ─────────────────────────────────────────────────────────────────────────────
# ★ SÉCURITÉ : GESTION GLOBALE DES ERREURS (INCASSABLE)
# ─────────────────────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Capture toutes les exceptions fatales. Évite d'exposer la trace d'erreur 
    (Stack Trace) aux attaquants et renvoie toujours un format JSON propre.
    """
    logger.error(f"Erreur critique inattendue : {request.method} {request.url} - {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne sécurisée est survenue. Nos équipes ont été notifiées."}
    )

# ─────────────────────────────────────────────────────────────────────────────
# ★ SÉCURITÉ : MIDDLEWARE DE HEADERS HTTP STRICTS
# ─────────────────────────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Ajoute des en-têtes HTTP contre les attaques XSS, le Clickjacking, 
    l'usurpation de type MIME, et force le transport sécurisé (HSTS).
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ─────────────────────────────────────────────────────────────────────────────
# ★ MIDDLEWARES CORS 
# ─────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    # Limiter aux méthodes standards utilisées prévient des requêtes inattendues
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# ★ ROUTERS
# ─────────────────────────────────────────────────────────────────────────────
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