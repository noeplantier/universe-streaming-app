#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_distributed.sh — Lance le test de charge 10k depuis plusieurs agents k6
#
# Usage :
#   ./scripts/k6/run_distributed.sh smoke          # test rapide local
#   ./scripts/k6/run_distributed.sh rampup [N]     # N agents (défaut: 5)
#   ./scripts/k6/run_distributed.sh stress  [N]    # jusqu'au breaking point
#
# Prérequis :
#   - k6 installé sur tous les agents (brew install k6 / apt install k6)
#   - Variables d'env : SUPABASE_ANON
#   - Agents listés dans AGENT_HOSTS (SSH access requis)
#   - InfluxDB accessible sur INFLUX_URL pour agréger les résultats
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCENARIO="${1:-smoke}"
N_AGENTS="${2:-5}"

SUPABASE_URL="https://knrzbdqfflobfjdmqyte.supabase.co"
INFLUX_URL="${INFLUX_URL:-http://localhost:8086/k6}"
SCRIPT="scripts/k6/universe_load_test.js"

# Agents EC2 — remplace par tes IPs après terraform apply
AGENT_HOSTS=(
  "${AGENT_0:-localhost}"  # local en fallback
  "${AGENT_1:-}"
  "${AGENT_2:-}"
  "${AGENT_3:-}"
  "${AGENT_4:-}"
)

# ── Vérifications ─────────────────────────────────────────────────────────────
if [[ -z "${SUPABASE_ANON:-}" ]]; then
  echo "❌ Variable SUPABASE_ANON manquante. Export avant de lancer."
  exit 1
fi

if ! command -v k6 &>/dev/null; then
  echo "❌ k6 non trouvé. Installation: https://k6.io/docs/get-started/installation/"
  exit 1
fi

# ── Run local (smoke ou si 1 agent) ──────────────────────────────────────────
if [[ "$SCENARIO" == "smoke" ]] || [[ "$N_AGENTS" -le 1 ]]; then
  echo "▶ Lancement local (scenario=$SCENARIO)..."
  k6 run \
    --env SUPABASE_URL="$SUPABASE_URL" \
    --env SUPABASE_ANON="$SUPABASE_ANON" \
    --env K6_SCENARIO="$SCENARIO" \
    --out "influxdb=$INFLUX_URL" \
    --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
    "$SCRIPT"
  exit 0
fi

# ── Run distribué (N agents via SSH) ─────────────────────────────────────────
echo "▶ Lancement distribué sur $N_AGENTS agents (scenario=$SCENARIO)..."

PIDS=()
for i in $(seq 0 $((N_AGENTS - 1))); do
  HOST="${AGENT_HOSTS[$i]:-}"
  if [[ -z "$HOST" ]]; then
    echo "⚠️  Agent $i : AGENT_${i} non défini, ignoré."
    continue
  fi

  # Chaque agent couvre 1/N de la charge totale
  SEG_FROM=$(echo "scale=4; $i / $N_AGENTS"       | bc)
  SEG_TO=$(  echo "scale=4; ($i + 1) / $N_AGENTS" | bc)

  echo "  Agent $i ($HOST) : segment $SEG_FROM:$SEG_TO"

  ssh -o StrictHostKeyChecking=no "ec2-user@$HOST" \
    "k6 run \
      --execution-segment='${SEG_FROM}:${SEG_TO}' \
      --execution-segment-sequence='$(seq -s, 0 $N_AGENTS | sed 's/,$//'|tr ',' '\n' | awk -v n=$N_AGENTS '{printf "%.4f%s", $1/n, (NR<n+1?",":"")}'  )' \
      --env SUPABASE_URL='$SUPABASE_URL' \
      --env SUPABASE_ANON='$SUPABASE_ANON' \
      --env K6_SCENARIO='$SCENARIO' \
      --out 'influxdb=$INFLUX_URL' \
      /tmp/universe_load_test.js" &
  PIDS+=($!)
done

# Attend tous les agents
echo "▶ Attente de la fin des ${#PIDS[@]} agents..."
for pid in "${PIDS[@]}"; do
  wait "$pid" || echo "⚠️  Agent PID $pid s'est terminé avec une erreur."
done

echo "✅ Test distribué terminé. Résultats dans InfluxDB : $INFLUX_URL"
echo "   Ouvre Grafana et charge le dashboard scripts/grafana/universe_dashboard.json"
