"""
Identité utilisateur partagée par les routes streaming/upload.

L'app ne fait aucun appel à Supabase Auth (cf. frontend/services/api.ts) :
chaque device génère un UUID v4 persisté en SecureStore et l'envoie tel quel.
Les routes data/auth existantes ne demandent déjà aucun JWT (RLS ouverte) —
ce helper aligne streaming/upload sur ce même modèle au lieu d'exiger un JWT
que le client ne produira jamais.
"""
from fastapi import Header, HTTPException

MAX_DEVICE_ID_LEN = 100


def get_device_id(x_device_id: str = Header(..., alias="X-Device-Id")) -> str:
    """Identité du device appelant. 401 si absente ou invalide."""
    if not x_device_id or not x_device_id.strip():
        raise HTTPException(401, "Device ID manquant")
    if len(x_device_id) > MAX_DEVICE_ID_LEN:
        raise HTTPException(401, "Device ID invalide")
    return x_device_id.strip()
