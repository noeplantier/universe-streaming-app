from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from dotenv import load_dotenv
from pathlib import Path
import os, uuid, jwt, bcrypt, logging
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = "universe_secret_2024_xk9_independent_cinema_platform_key"
JWT_ALGO = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Models ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    avatar_url: str
    bio: str
    role: str
    followers_count: int
    following_count: int
    films_seen_count: int
    reviews_count: int
    is_following: bool = False

class ReviewCreate(BaseModel):
    film_id: str
    content: str
    rating: float

class PostCreate(BaseModel):
    content: str
    film_id: Optional[str] = None

class FilmSeenCreate(BaseModel):
    film_id: str

# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    except Exception:
        return None

# ─── Auth Routes ──────────────────────────────────────────────────────────────

@api_router.post("/auth/register")
async def register(data: UserCreate):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email déjà utilisé")
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(400, "Nom d'utilisateur déjà pris")
    user = {
        "id": str(uuid.uuid4()),
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "avatar_url": f"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
        "bio": "Passionné de cinéma indépendant 🎬",
        "role": "viewer",
        "followers_count": 0,
        "following_count": 0,
        "films_seen_count": 0,
        "reviews_count": 0,
        "top10": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    user_safe = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    return {"token": token, "user": user_safe}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    token = create_token(user["id"])
    user_safe = {k: v for k, v in user.items() if k != "password_hash"}
    return {"token": token, "user": user_safe}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}

# ─── Films Routes ─────────────────────────────────────────────────────────────

def film_duration_type(mins: int) -> str:
    if mins < 10: return "short"
    if mins <= 40: return "medium"
    return "long"

@api_router.get("/films")
async def get_films(genre: Optional[str] = None, duration_type: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if genre and genre != "Tous":
        query["genre"] = genre
    if duration_type and duration_type != "all":
        query["duration_type"] = duration_type
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"director": {"$regex": q, "$options": "i"}},
            {"genre": {"$regex": q, "$options": "i"}}
        ]
    films = await db.films.find(query, {"_id": 0}).to_list(100)
    return films

@api_router.get("/films/{film_id}")
async def get_film(film_id: str):
    film = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not film:
        raise HTTPException(404, "Film introuvable")
    return film

@api_router.get("/feed")
async def get_feed():
    films = await db.films.find({}, {"_id": 0}).to_list(20)
    return films

# ─── Reviews Routes ───────────────────────────────────────────────────────────

@api_router.get("/reviews")
async def get_reviews(film_id: Optional[str] = None, user_id: Optional[str] = None):
    query = {}
    if film_id:
        query["film_id"] = film_id
    if user_id:
        query["user_id"] = user_id
    reviews = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    for r in reviews:
        user = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "password_hash": 0})
        r["user"] = user
        film = await db.films.find_one({"id": r["film_id"]}, {"_id": 0})
        r["film"] = film
    return reviews

@api_router.post("/reviews")
async def create_review(data: ReviewCreate, current_user: dict = Depends(get_current_user)):
    review = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "film_id": data.film_id,
        "content": data.content,
        "rating": data.rating,
        "likes_count": 0,
        "liked_by": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reviews.insert_one(review)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"reviews_count": 1}})
    return {k: v for k, v in review.items() if k != "_id"}

@api_router.post("/reviews/{review_id}/like")
async def like_review(review_id: str, current_user: dict = Depends(get_current_user)):
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(404, "Critique introuvable")
    uid = current_user["id"]
    if uid in review.get("liked_by", []):
        await db.reviews.update_one({"id": review_id}, {"$pull": {"liked_by": uid}, "$inc": {"likes_count": -1}})
        return {"liked": False}
    await db.reviews.update_one({"id": review_id}, {"$addToSet": {"liked_by": uid}, "$inc": {"likes_count": 1}})
    return {"liked": True}

# ─── Social Posts Routes ──────────────────────────────────────────────────────

@api_router.get("/posts")
async def get_posts():
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for p in posts:
        user = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "password_hash": 0})
        p["user"] = user
        if p.get("film_id"):
            film = await db.films.find_one({"id": p["film_id"]}, {"_id": 0})
            p["film"] = film
    return posts

@api_router.post("/posts")
async def create_post(data: PostCreate, current_user: dict = Depends(get_current_user)):
    post = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "content": data.content,
        "film_id": data.film_id,
        "likes_count": 0,
        "liked_by": [],
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.posts.insert_one(post)
    return {k: v for k, v in post.items() if k != "_id"}

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "Post introuvable")
    uid = current_user["id"]
    if uid in post.get("liked_by", []):
        await db.posts.update_one({"id": post_id}, {"$pull": {"liked_by": uid}, "$inc": {"likes_count": -1}})
        return {"liked": False}
    await db.posts.update_one({"id": post_id}, {"$addToSet": {"liked_by": uid}, "$inc": {"likes_count": 1}})
    return {"liked": True}

# ─── Users Routes ─────────────────────────────────────────────────────────────

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_optional_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if current_user:
        is_following = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user_id})
        user["is_following"] = bool(is_following)
    return user

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(400, "Vous ne pouvez pas vous suivre vous-même")
    existing = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user_id})
    if existing:
        await db.follows.delete_one({"follower_id": current_user["id"], "following_id": user_id})
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    follow = {"id": str(uuid.uuid4()), "follower_id": current_user["id"], "following_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.follows.insert_one(follow)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
    return {"following": True}

@api_router.post("/films-seen")
async def mark_film_seen(data: FilmSeenCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.films_seen.find_one({"user_id": current_user["id"], "film_id": data.film_id})
    if existing:
        return {"seen": True, "message": "Déjà marqué comme vu"}
    await db.films_seen.insert_one({"id": str(uuid.uuid4()), "user_id": current_user["id"], "film_id": data.film_id, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"films_seen_count": 1}})
    return {"seen": True}

@api_router.get("/films-seen")
async def get_films_seen(user_id: str):
    seen = await db.films_seen.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    result = []
    for s in seen:
        film = await db.films.find_one({"id": s["film_id"]}, {"_id": 0})
        if film:
            result.append(film)
    return result

# ─── Seed Data ────────────────────────────────────────────────────────────────

MOCK_FILMS = [
    {"id": "film1", "title": "L'Ombre de Minuit", "director": "Sofia Castellano", "duration_minutes": 87, "duration_type": "long", "genre": "Thriller", "synopsis": "Dans une ville nocturne sans loi, une détective aux méthodes radicales traque un fantôme qui efface les souvenirs. Un voyage hallucinant entre réel et illusion.", "poster_url": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&q=80", "year": 2024, "language": "fr", "episodes_count": 0, "content_type": "film", "tags": ["sombre", "psychologique", "urbain"], "rating": 4.2, "views_count": 12450},
    {"id": "film2", "title": "Fragments d'Été", "director": "Luca Moretti", "duration_minutes": 24, "duration_type": "medium", "genre": "Drame", "synopsis": "Un été. Trois familles. Des secrets qui se tissent silencieusement dans la chaleur d'une ville italienne endormie.", "poster_url": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&q=80", "year": 2024, "language": "it", "episodes_count": 0, "content_type": "film", "tags": ["famille", "été", "nostalgie"], "rating": 4.5, "views_count": 8920},
    {"id": "film3", "title": "Nuit Blanche", "director": "Emma Lefebvre", "duration_minutes": 6, "duration_type": "short", "genre": "Romance", "synopsis": "Une nuit d'insomnie transformée en rencontre inattendue. Un court métrage sur la solitude et la connexion humaine.", "poster_url": "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=500&q=80", "year": 2024, "language": "fr", "episodes_count": 0, "content_type": "short", "tags": ["nuit", "amour", "urban"], "rating": 4.7, "views_count": 22100},
    {"id": "film4", "title": "La Dernière Bobine", "director": "Marcus Chen", "duration_minutes": 95, "duration_type": "long", "genre": "Documentaire", "synopsis": "Un documentaire intime sur les derniers projectionnistes de film analogique. Un hommage au cinéma d'avant.", "poster_url": "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&q=80", "year": 2023, "language": "en", "episodes_count": 0, "content_type": "film", "tags": ["cinéma", "analogique", "patrimoine"], "rating": 4.8, "views_count": 5640},
    {"id": "film5", "title": "Entre Chien et Loup", "director": "Ayasha Wolf", "duration_minutes": 32, "duration_type": "medium", "genre": "Fantasy", "synopsis": "Au crépuscule, l'heure où les mondes se superposent, une chamane moderne tente de sauver l'âme d'une ville.", "poster_url": "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=500&q=80", "year": 2024, "language": "fr", "episodes_count": 0, "content_type": "film", "tags": ["mystique", "nature", "magie"], "rating": 4.3, "views_count": 15780},
    {"id": "film6", "title": "Au-delà du Cadre", "director": "Ryo Nakamura", "duration_minutes": 4, "duration_type": "short", "genre": "Thriller", "synopsis": "Quatre minutes. Une caméra. Un appartement vide. Ce qui se passe hors-champ est plus terrifiant que tout.", "poster_url": "https://images.unsplash.com/photo-1568111561564-08726a1563e1?w=500&q=80", "year": 2024, "language": "ja", "episodes_count": 0, "content_type": "short", "tags": ["tension", "minimaliste", "huis-clos"], "rating": 4.6, "views_count": 18900},
    {"id": "film7", "title": "Le Voyageur du Chaos", "director": "Ibrahim Osei", "duration_minutes": 112, "duration_type": "long", "genre": "Science-Fiction", "synopsis": "Un physicien découvre que chaque décision crée un univers parallèle. Il décide de tous les traverser pour retrouver celle qu'il aime.", "poster_url": "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=500&q=80", "year": 2024, "language": "en", "episodes_count": 0, "content_type": "film", "tags": ["multivers", "amour", "physique"], "rating": 4.4, "views_count": 9870},
    {"id": "film8", "title": "Pluie de Septembre", "director": "Céline Dubois", "duration_minutes": 18, "duration_type": "medium", "genre": "Romance", "synopsis": "Une photographe et un musicien de rue se retrouvent chaque septembre sous la même pluie. Hasard ou destin ?", "poster_url": "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&q=80", "year": 2023, "language": "fr", "episodes_count": 0, "content_type": "film", "tags": ["poétique", "pluie", "rencontre"], "rating": 4.1, "views_count": 11230},
    {"id": "film9", "title": "Silence d'Or", "director": "Ana Reyes", "duration_minutes": 8, "duration_type": "short", "genre": "Drame", "synopsis": "La dernière répétition d'un orchestre qui se dissout. En huit minutes, toute une vie musicale prend fin.", "poster_url": "https://images.unsplash.com/photo-1518929458119-e5bf444c30f4?w=500&q=80", "year": 2024, "language": "es", "episodes_count": 0, "content_type": "short", "tags": ["musique", "fin", "émotion"], "rating": 4.9, "views_count": 7650},
    {"id": "film10", "title": "L'Instant Présent", "director": "Jules Beaumont", "duration_minutes": 45, "duration_type": "long", "genre": "Drame", "synopsis": "Un médecin urgentiste passe une nuit à traiter des patients dont les histoires s'entrelacent mystérieusement.", "poster_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&q=80", "year": 2024, "language": "fr", "episodes_count": 0, "content_type": "film", "tags": ["humain", "nuit", "destin"], "rating": 4.3, "views_count": 14320},
]

MOCK_USERS = [
    {"id": "user1", "username": "CineManiac", "email": "demo@universe.com", "password_hash": hash_password("demo123"), "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80", "bio": "Directrice artistique | Amateure de cinéma indé 🎬", "role": "creator", "followers_count": 1240, "following_count": 89, "films_seen_count": 87, "reviews_count": 24, "top10": ["film1","film3","film4","film6","film7","film9","film2","film5","film8","film10"], "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "user2", "username": "IndieWatcher", "email": "indie@universe.com", "password_hash": hash_password("demo123"), "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80", "bio": "Réalisateur | Court-métrages & documentaires", "role": "director", "followers_count": 580, "following_count": 42, "films_seen_count": 134, "reviews_count": 67, "top10": ["film4","film7","film1","film9","film6","film3","film5","film2","film10","film8"], "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "user3", "username": "NoirCinema", "email": "noir@universe.com", "password_hash": hash_password("demo123"), "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80", "bio": "Critique de cinéma | Passionnée de film noir", "role": "critic", "followers_count": 2100, "following_count": 156, "films_seen_count": 210, "reviews_count": 98, "top10": ["film1","film6","film9","film4","film7","film2","film3","film5","film8","film10"], "created_at": datetime.now(timezone.utc).isoformat()},
]

MOCK_REVIEWS = [
    {"id": "rev1", "user_id": "user2", "film_id": "film1", "content": "Un thriller haletant qui joue brillamment avec la perception. La photographie est exceptionnelle, chaque plan est une œuvre d'art. Sofia Castellano confirme son talent immense.", "rating": 4.5, "likes_count": 34, "liked_by": [], "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "rev2", "user_id": "user3", "film_id": "film3", "content": "Court mais tellement dense. En 6 minutes, Emma Lefebvre dit plus sur la solitude urbaine que bien des longs métrages. Un chef-d'œuvre miniature.", "rating": 5.0, "likes_count": 89, "liked_by": [], "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "rev3", "user_id": "user1", "film_id": "film4", "content": "Bouleversant. On pleure à la fin non pas par tristesse mais par gratitude envers ces hommes qui ont consacré leur vie à l'art du projecteur.", "rating": 5.0, "likes_count": 56, "liked_by": [], "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "rev4", "user_id": "user2", "film_id": "film7", "content": "Ambitieux et poétique. Ibrahim Osei réussit quelque chose de rare: rendre la physique quantique romantique. Le multivers n'a jamais semblé aussi humain.", "rating": 4.5, "likes_count": 42, "liked_by": [], "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "rev5", "user_id": "user3", "film_id": "film6", "content": "TERRIFIANT. Ryo Nakamura prouve que la terreur absolue n'a pas besoin de monstre. Juste un cadre vide et notre imagination. Génie pur.", "rating": 5.0, "likes_count": 71, "liked_by": [], "created_at": datetime.now(timezone.utc).isoformat()},
]

MOCK_POSTS = [
    {"id": "post1", "user_id": "user3", "content": "Viens de terminer 'L'Ombre de Minuit' pour la 3ème fois. Chaque visionnage révèle quelque chose de nouveau. C'est ça la vraie grandeur du cinéma indépendant 🎬✨", "film_id": "film1", "likes_count": 47, "liked_by": [], "comments_count": 12, "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "post2", "user_id": "user1", "content": "Si vous n'avez pas encore vu 'Silence d'Or', arrêtez tout et regardez-le MAINTENANT. 8 minutes qui valent mieux que beaucoup de films de 2h. Ana Reyes est une génie absolue 🎻", "film_id": "film9", "likes_count": 93, "liked_by": [], "comments_count": 28, "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "post3", "user_id": "user2", "content": "Thread sur pourquoi le court métrage est la forme la plus noble du cinéma: En 4 minutes, 'Au-delà du Cadre' crée plus d'angoisse que n'importe quel blockbuster. La contrainte libère la créativité 🧵", "film_id": "film6", "likes_count": 126, "liked_by": [], "comments_count": 45, "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "post4", "user_id": "user3", "content": "Ma sélection du mois: 5 courts métrages qui m'ont complètement retournée. Le cinéma indépendant se porte très bien, et UNIVERSE est la meilleure plateforme pour le découvrir 💜", "film_id": None, "likes_count": 84, "liked_by": [], "comments_count": 19, "created_at": datetime.now(timezone.utc).isoformat()},
    {"id": "post5", "user_id": "user1", "content": "En cours de visionnage de 'Fragments d'Été'... Luca Moretti a cette capacité rare à capturer des silences qui parlent plus fort que tous les dialogues. Chef d'œuvre en attente 🌅", "film_id": "film2", "likes_count": 38, "liked_by": [], "comments_count": 7, "created_at": datetime.now(timezone.utc).isoformat()},
]

@api_router.post("/seed")
async def seed_data():
    users_count = await db.users.count_documents({})
    if users_count > 0:
        return {"message": "Data already seeded", "seeded": False}
    for f in MOCK_FILMS:
        await db.films.insert_one(dict(f))
    for u in MOCK_USERS:
        await db.users.insert_one(dict(u))
    for r in MOCK_REVIEWS:
        await db.reviews.insert_one(dict(r))
    for p in MOCK_POSTS:
        await db.posts.insert_one(dict(p))
    # Mark films seen for users
    for fid in ["film1", "film3", "film4", "film6"]:
        await db.films_seen.insert_one({"id": str(uuid.uuid4()), "user_id": "user1", "film_id": fid, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Data seeded successfully", "seeded": True}

@api_router.get("/")
async def root():
    return {"message": "UNIVERSE API v1.0", "status": "ok"}

# ─── App ──────────────────────────────────────────────────────────────────────
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await seed_data()
    logger.info("UNIVERSE API started ✅")

@app.on_event("shutdown")
async def shutdown():
    client.close()
