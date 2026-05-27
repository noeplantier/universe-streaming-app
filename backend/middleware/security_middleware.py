from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

# Configuration des limites dynamiques
RATE_LIMIT_MAX_REQUESTS = 100
RATE_LIMIT_WINDOW_SECONDS = 60

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware ultra optimisé pour bloquer les attaques DDoS (Rate Limiting via Redis)
    et imposer des en-têtes HTTP de sécurité très stricts.
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Ignorer les routes qui ne nécessitent pas de Rate Limiting
        if request.url.path in ["/docs", "/openapi.json", "/health"]:
            return await call_next(request)

        # 2. Identifier l'IP réelle du client (derrière proxy/load balancer)
        client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        # 3. Rate Limiting via Redis (si Redis est activé et disponible)
        if hasattr(request.app.state, 'redis') and getattr(request.app.state, 'redis') is not None:
            redis = request.app.state.redis
            redis_key = f"rate_limit:{client_ip}"
            
            try:
                # Récupérer le nombre actuel de requêtes
                requests = await redis.get(redis_key)

                # Si l'IP dépasse la limite, bloquer instantanément (O(1) en Redis)
                if requests and int(requests) >= RATE_LIMIT_MAX_REQUESTS:
                    logger.warning(f"🚨 BLOCAGE Sécurité : IP {client_ip} a dépassé la limite de requêtes.")
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Trop de requêtes. Votre IP a été temporairement bloquée."}
                    )

                # Pipeline Redis : exécute INCR et EXPIRE de façon atomique et asynchrone
                pipe = redis.pipeline()
                pipe.incr(redis_key)
                if not requests:
                    pipe.expire(redis_key, RATE_LIMIT_WINDOW_SECONDS)
                await pipe.execute()

            except Exception as e:
                # Ne pas faire crasher l'app si Redis a un pic de latence
                logger.error(f"Erreur temporelle Rate Limiter Redis: {e}")

        # 4. Continuer le traitement de la requête
        response = await call_next(request)

        # 5. Injection systématique des en-têtes de haute sécurité
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response