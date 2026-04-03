import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

# 1. Configuration initiale
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Variables d'environnement
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
JWT_SECRET = os.environ.get('JWT_SECRET', "universe_secret_key_change_me")
JWT_ALGO = "HS256"
JWT_EXPIRATION_HOURS = 24

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL et SUPABASE_KEY sont requis dans .env")

# Connexion Supabase
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialisation App
app = FastAPI(title="Universe API", version="1.0.0")
security = HTTPBearer(auto_error=False)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== SCHEMAS ====================

class UserSignUp(BaseModel):
    email: EmailStr
    password: str
    username: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class DataCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: str
    category: Optional[str] = None

class DataResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str]
    content: str
    category: Optional[str]
    created_at: str
    updated_at: str

# ==================== HELPERS ====================

def hash_password(password: str) -> str:
    """Hash un mot de passe avec bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Vérifie un mot de passe"""
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_jwt_token(user_id: str, email: str) -> str:
    """Crée un JWT token"""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def verify_jwt_token(token: str) -> dict:
    """Vérifie et décode un JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Récupère l'utilisateur actuel depuis le JWT"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Non autorisé")
    
    token = credentials.credentials
    payload = verify_jwt_token(token)
    return payload

# ==================== ROUTES AUTH ====================

@app.post("/api/auth/signup", response_model=TokenResponse)
async def signup(user_data: UserSignUp):
    """Inscription d'un nouvel utilisateur"""
    try:
        # Vérifier si l'email existe déjà
        existing = supabase_client.table("users").select("id").eq("email", user_data.email).execute()
        
        if existing.data:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        
        # Créer l'utilisateur
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(user_data.password)
        
        response = supabase_client.table("users").insert({
            "id": user_id,
            "email": user_data.email,
            "username": user_data.username,
            "password_hash": hashed_password,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la création")
        
        user = response.data[0]
        token = create_jwt_token(user["id"], user["email"])
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(**{
                "id": user["id"],
                "email": user["email"],
                "username": user["username"],
                "created_at": user["created_at"]
            })
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur signup: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Connexion utilisateur"""
    try:
        # Récupérer l'utilisateur
        response = supabase_client.table("users").select("*").eq("email", credentials.email).execute()
        
        if not response.data:
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        
        user = response.data[0]
        
        # Vérifier le mot de passe
        if not verify_password(credentials.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        
        token = create_jwt_token(user["id"], user["email"])
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(**{
                "id": user["id"],
                "email": user["email"],
                "username": user["username"],
                "created_at": user["created_at"]
            })
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur login: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

# ==================== ROUTES DATA ====================

@app.get("/api/data", response_model=List[DataResponse])
async def get_all_data(current_user: dict = Depends(get_current_user)):
    """Récupère toutes les données de l'utilisateur"""
    try:
        response = supabase_client.table("data").select("*").eq("user_id", current_user["sub"]).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erreur get_all_data: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@app.get("/api/data/{data_id}", response_model=DataResponse)
async def get_data(data_id: str, current_user: dict = Depends(get_current_user)):
    """Récupère une donnée spécifique"""
    try:
        response = supabase_client.table("data").select("*").eq("id", data_id).eq("user_id", current_user["sub"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Donnée non trouvée")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur get_data: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@app.post("/api/data", response_model=DataResponse)
async def create_data(data: DataCreate, current_user: dict = Depends(get_current_user)):
    """Crée une nouvelle donnée"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        data_id = str(uuid.uuid4())
        
        response = supabase_client.table("data").insert({
            "id": data_id,
            "user_id": current_user["sub"],
            "title": data.title,
            "description": data.description,
            "content": data.content,
            "category": data.category,
            "created_at": now,
            "updated_at": now
        }).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la création")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur create_data: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@app.put("/api/data/{data_id}", response_model=DataResponse)
async def update_data(data_id: str, data: DataCreate, current_user: dict = Depends(get_current_user)):
    """Met à jour une donnée"""
    try:
        # Vérifier que la donnée appartient à l'utilisateur
        existing = supabase_client.table("data").select("id").eq("id", data_id).eq("user_id", current_user["sub"]).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Donnée non trouvée")
        
        response = supabase_client.table("data").update({
            "title": data.title,
            "description": data.description,
            "content": data.content,
            "category": data.category,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", data_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur update_data: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@app.delete("/api/data/{data_id}")
async def delete_data(data_id: str, current_user: dict = Depends(get_current_user)):
    """Supprime une donnée"""
    try:
        # Vérifier que la donnée appartient à l'utilisateur
        existing = supabase_client.table("data").select("id").eq("id", data_id).eq("user_id", current_user["sub"]).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Donnée non trouvée")
        
        supabase_client.table("data").delete().eq("id", data_id).execute()
        
        return {"message": "Donnée supprimée avec succès"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur delete_data: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Vérifi l'état du serveur"""
    return {"status": "ok", "version": "1.0.0"}

# ==================== MAIN ====================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)