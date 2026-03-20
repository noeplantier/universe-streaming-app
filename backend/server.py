import os
import logging
import uuid
import bcrypt
import jwt
import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta

# 1. Configuration initiale
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration par défaut si .env manquant (pour éviter le crash immédiat)
MONGO_URL = os.environ.get('MONGO_URL', "mongodb://localhost:27017")
DB_NAME = os.environ.get('DB_NAME', "universe_db")
JWT_SECRET = os.environ.get('JWT_SECRET', "universe_secret_key_change_me")
JWT_ALGO = "HS256"

# Connexion Base de données
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Initialisation App
app = FastAPI(title="Universe API")
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

api_router = APIRouter(prefix="/api")

# ─── Models ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str

class ReviewCreate(BaseModel):
    film_id: str
    rating: int = Field(..., ge=0, le=5)
    comment: Optional[str] = None

class PostCreate(BaseModel):
    content: str
    film_id: Optional[str] = None

class FilmSeenCreate(BaseModel):
    film_id: str
    liked: bool = False

# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── Routes ───────────────────────────────────────────────────────────────────

@api_router.get("/health")
async def health_check():
    return {"status": "ok", "db": DB_NAME}

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    hashed = hash_password(user_data.password)
    
    new_user = {
        "_id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(new_user)
    token = create_token(user_id)
    return {"access_token": token, "token_type": "bearer", "user_id": user_id}

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    token = create_token(user["_id"])
    return {"access_token": token, "token_type": "bearer", "user": {"username": user["username"], "email": user["email"]}}

@api_router.get("/auth/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return {"username": current_user["username"], "email": current_user["email"], "id": current_user["_id"]}

# Ajout du routeur à l'application principale
app.include_router(api_router)

# ─── Démarrage du serveur ─────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting Server on port {port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)