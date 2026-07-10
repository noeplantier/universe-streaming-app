#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# api_audit.sh — Audit de sécurité automatisé de l'API Supabase d'Universe App
#
# Ce script vérifie les vulnérabilités OWASP API Top 10 spécifiques à
# l'architecture Universe App (Supabase REST + anon key, device-ID auth).
#
# Usage :
#   export SUPABASE_ANON="<clé anon publique>"
#   bash scripts/security/api_audit.sh
#
# Prérequis : curl, jq
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="https://knrzbdqfflobfjdmqyte.supabase.co"
REST="${BASE_URL}/rest/v1"
ANON="${SUPABASE_ANON:-}"

if [[ -z "$ANON" ]]; then
  echo "❌ SUPABASE_ANON non défini."
  exit 1
fi

PASS=0
FAIL=0
WARN=0

# Couleurs
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} : $1"; ((PASS++)); }
fail() { echo -e "${RED}❌ FAIL${NC} : $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC} : $1"; ((WARN++)); }

header() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# Helper : requête REST
api() { curl -sf -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Accept: application/json" "$@"; }

echo "═══════════════════════════════════════════════════════════════"
echo "  Universe App — API Security Audit"
echo "  Target : $BASE_URL"
echo "  Date   : $(date)"
echo "═══════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# A1 — Broken Object Level Authorization (BOLA / IDOR)
# ─────────────────────────────────────────────────────────────────────────────
header "A1 — BOLA / IDOR"

# Peut-on lire TOUS les reels sans filtrage (pas de RLS user-specific) ?
REELS=$(api "${REST}/reels?limit=5&select=id,user_id,status" 2>/dev/null || echo "[]")
COUNT=$(echo "$REELS" | jq 'length' 2>/dev/null || echo 0)
if [[ "$COUNT" -gt 0 ]]; then
  warn "Tous les reels sont lisibles en anon (attendu si feed public). Vérifie RLS sur champs sensibles."
else
  pass "Lecture reels : vide ou erreur — RLS peut être actif."
fi

# Peut-on lire les profils d'autres users ?
PROFILES=$(api "${REST}/profiles?limit=5&select=user_id,xp,level" 2>/dev/null || echo "[]")
PCOUNT=$(echo "$PROFILES" | jq 'length' 2>/dev/null || echo 0)
if [[ "$PCOUNT" -gt 0 ]]; then
  warn "Profils XP/niveau lisibles publiquement ($PCOUNT). Acceptable si intentionnel, sinon restreindre via RLS."
else
  pass "Profils XP non exposés publiquement."
fi

# Peut-on lire les préférences d'autres users ?
PREFS=$(api "${REST}/user_preferences?limit=5" 2>/dev/null || echo "[]")
PREFS_COUNT=$(echo "$PREFS" | jq 'length' 2>/dev/null || echo 0)
if [[ "$PREFS_COUNT" -gt 0 ]]; then
  fail "CRITIQUE : user_preferences lisible sans auth ($PREFS_COUNT rows) — fuite de PII potentielle !"
else
  pass "user_preferences protégé (0 rows ou erreur)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# A2 — Broken Authentication
# ─────────────────────────────────────────────────────────────────────────────
header "A2 — Broken Authentication"

# Peut-on modifier n'importe quel reel avec la clé anon ?
FAKE_ID="00000000-0000-0000-0000-000000000001"
PATCH_RES=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X PATCH \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"title":"HACKED"}' \
  "${REST}/reels?id=eq.${FAKE_ID}" || echo "000")

if [[ "$PATCH_RES" == "200" ]] || [[ "$PATCH_RES" == "204" ]]; then
  fail "CRITIQUE : PATCH reels réussi sans auth propriétaire ! RLS UPDATE manquant."
elif [[ "$PATCH_RES" == "404" ]] || [[ "$PATCH_RES" == "406" ]]; then
  pass "PATCH reel inconnu → $PATCH_RES (RLS ou row not found)."
else
  warn "PATCH reel → HTTP $PATCH_RES (à vérifier manuellement)."
fi

# Peut-on INSERT dans reels sans être authentifié ?
INSERT_RES=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"user_id":"test","video_url":"http://evil.com/hack.mp4","status":"approved"}' \
  "${REST}/reels" || echo "000")

if [[ "$INSERT_RES" == "201" ]]; then
  fail "CRITIQUE : INSERT reels avec status=approved réussi en anon ! RLS INSERT manquant ou trop permissif."
elif [[ "$INSERT_RES" == "409" ]] || [[ "$INSERT_RES" == "400" ]] || [[ "$INSERT_RES" == "403" ]]; then
  pass "INSERT reel → HTTP $INSERT_RES (refusé ou contrainte)."
else
  warn "INSERT reel → HTTP $INSERT_RES."
fi

# ─────────────────────────────────────────────────────────────────────────────
# A3 — Excessive Data Exposure
# ─────────────────────────────────────────────────────────────────────────────
header "A3 — Excessive Data Exposure"

# Les reels exposent-ils des données internes (moderated_by, rejection_reason) ?
REEL_FIELDS=$(api "${REST}/reels?limit=1&select=*" 2>/dev/null | jq -r 'if type=="array" then .[0] | keys[] else empty end' 2>/dev/null | sort)
SENSITIVE_FIELDS=("moderated_by" "rejection_reason" "rejection_category")
for f in "${SENSITIVE_FIELDS[@]}"; do
  if echo "$REEL_FIELDS" | grep -q "^${f}$"; then
    warn "Champ sensible '$f' exposé dans les reels publics. Envisage une vue SQL sans ce champ."
  else
    pass "Champ '$f' non exposé via select=*."
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# A4 — Rate Limiting
# ─────────────────────────────────────────────────────────────────────────────
header "A4 — Rate Limiting"

echo "  Test de 50 requêtes rapides..."
RATE_FAIL=0
for i in $(seq 1 50); do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    "${REST}/reels?limit=1" || echo "000")
  if [[ "$STATUS" == "429" ]]; then
    pass "Rate limiting déclenché après $i requêtes (429 Too Many Requests)."
    RATE_FAIL=1
    break
  fi
done
if [[ "$RATE_FAIL" -eq 0 ]]; then
  fail "Aucun rate limiting détecté après 50 requêtes rapides. Risque de DoS et scraping."
fi

# ─────────────────────────────────────────────────────────────────────────────
# A5 — Injection (PostgREST est résistant mais testons)
# ─────────────────────────────────────────────────────────────────────────────
header "A5 — Injection SQL"

INJECT_RES=$(api "${REST}/reels?title=eq.'; DROP TABLE reels; --&limit=1" 2>/dev/null || echo "[]")
if echo "$INJECT_RES" | grep -qi "error\|syntax\|exception"; then
  fail "Réponse d'erreur SQL détectée — risque d'injection."
else
  pass "PostgREST neutralise l'injection SQL (expected)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# A6 — CORS Headers
# ─────────────────────────────────────────────────────────────────────────────
header "A6 — CORS"

CORS_HEADER=$(curl -sf -o /dev/null -D - \
  -H "Origin: https://evil-site.com" \
  -H "apikey: $ANON" \
  "${REST}/reels?limit=1" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")

if echo "$CORS_HEADER" | grep -q "\*"; then
  warn "CORS wildcard (*) détecté. Acceptable pour API publique, mais vérifie que les endpoints sensibles sont protégés."
elif [[ -z "$CORS_HEADER" ]]; then
  warn "Aucun header CORS dans la réponse. Peut bloquer les clients web légitimes."
else
  pass "CORS header présent et non-wildcard : $CORS_HEADER"
fi

# ─────────────────────────────────────────────────────────────────────────────
# A7 — TLS / HSTS
# ─────────────────────────────────────────────────────────────────────────────
header "A7 — TLS & HSTS"

HSTS=$(curl -sf -o /dev/null -D - "https://knrzbdqfflobfjdmqyte.supabase.co/rest/v1/reels?limit=1" \
  -H "apikey: $ANON" 2>/dev/null | grep -i "strict-transport-security" || echo "")

if [[ -n "$HSTS" ]]; then
  pass "HSTS présent : $HSTS"
else
  warn "HSTS absent. Supabase gère normalement HSTS — vérifie les headers en production."
fi

TLS_VERSION=$(curl -sv --tlsv1.2 "${BASE_URL}/rest/v1/reels?limit=1" -H "apikey: $ANON" 2>&1 | grep "SSL connection" || echo "inconnu")
echo "  TLS : $TLS_VERSION"

# ─────────────────────────────────────────────────────────────────────────────
# A8 — XP Gamification : abus possibles ?
# ─────────────────────────────────────────────────────────────────────────────
header "A8 — Abus gamification (add_xp RPC)"

XP_RES=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d "{\"p_user_id\":\"fake-device-id\",\"p_amount\":999999,\"p_reason\":\"hack\"}" \
  "${BASE_URL}/rest/v1/rpc/add_xp" || echo "000")

if [[ "$XP_RES" == "200" ]] || [[ "$XP_RES" == "204" ]]; then
  fail "CRITIQUE : add_xp RPC sans authentification propriétaire ! N'importe qui peut modifier l'XP de n'importe quel user."
elif [[ "$XP_RES" == "400" ]] || [[ "$XP_RES" == "403" ]]; then
  pass "add_xp → $XP_RES (paramètres rejetés ou RLS actif)."
else
  warn "add_xp → $XP_RES (à vérifier)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# A9 — Secrets dans les headers de réponse
# ─────────────────────────────────────────────────────────────────────────────
header "A9 — Secrets dans les réponses"

SERVER_HEADER=$(curl -sf -o /dev/null -D - "${REST}/reels?limit=1" -H "apikey: $ANON" 2>/dev/null | grep -i "server:" || echo "")
if echo "$SERVER_HEADER" | grep -qi "version\|apache\|nginx\|postgrest\|[0-9]\.[0-9]"; then
  warn "Header Server expose des informations de version : $SERVER_HEADER"
else
  pass "Header Server ne révèle pas la version : $SERVER_HEADER"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Résumé
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  RÉSUMÉ"
echo "  ✅ PASS : $PASS"
echo "  ⚠️  WARN : $WARN"
echo "  ❌ FAIL : $FAIL"
echo "═══════════════════════════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "\n${RED}Au moins $FAIL vulnérabilité(s) critique(s) détectée(s). Corriger avant mise en production.${NC}"
  exit 1
fi
echo -e "\n${GREEN}Audit passé (avec $WARN avertissement(s) à examiner).${NC}"
