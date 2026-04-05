import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
# Charge les variables du fichier .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL et SUPABASE_KEY sont requis dans .env")

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', "universe_secret_key_change_me")
JWT_ALGO = "HS256"
JWT_EXPIRATION_HOURS = 24

# CORS
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# App
APP_TITLE = "Universe API"
APP_VERSION = "1.0.0"