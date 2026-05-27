from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging

logger = logging.getLogger(__name__)

# Configuration de la limite (ex: 100 requêtes maximum par minute et par IP)
RATE_LIMIT_MAX_REQUESTS = 100
RATE_LIMIT_WINDOW_SECONDS = 60

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Ne pas limiter les routes internes comme les métriques ou la doc si nécessaire
        if request.url.path in ["/docs", "/openapi.json"]:
            return await call_next(request)

        # Récupération de l'IP du client (gère les proxys/load balancers)
        client_ip = request.headers.get("X-Forwarded-For", request.client.host)
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        # Clé Redis unique par IP
        redis_key = f"rate_limit:{client_ip}"
        redis = request.app.state.redis

        try:
            # Récupère le nombre de requêtes
            requests = await redis.get(redis_key)

            if requests and int(requests) >= RATE_LIMIT_MAX_REQUESTS:
                logger.warning(f"🚨 BLOCAGE DDoS/Spam : IP {client_ip} a dépassé la limite.")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Trop de requêtes. Veuillez patienter avant de réessayer."}
                )

            # Incrémente le compteur avec une expiration automatique
            pipe = redis.pipeline()
            pipe.incr(redis_key)
            if not requests:
                pipe.expire(redis_key, RATE_LIMIT_WINDOW_SECONDS)
            await pipe.execute()

        except Exception as e:
            # En cas de panne Redis, on laisse passer pour ne pas bloquer l'application
            logger.error(f"Erreur Rate Limiter Redis: {e}")

        # Les en-têtes de sécurité stricts (Anti-XSS, Anti-Clickjacking)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response