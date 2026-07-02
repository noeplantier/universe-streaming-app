-- ─────────────────────────────────────────────────────────────────────────────
-- 01_pin_auth_schema.sql — Universe App · Authentification PIN équipe
--
-- Coller dans l'éditeur SQL Supabase et exécuter dans cet ordre :
--   1. Ce fichier   (tables + RLS)
--   2. 02_pin_auth_functions.sql
--   3. 03_seed_team_members.sql  (PINs à personnaliser AVANT d'exécuter)
-- ─────────────────────────────────────────────────────────────────────────────

-- Extension pgcrypto (disponible par défaut sur Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table : team_members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name     text        NOT NULL UNIQUE,
  pin_hash         text        NOT NULL,             -- SHA-256(pin:salt) en hex
  pin_salt         text        NOT NULL,             -- sel 16 bytes en hex
  failed_attempts  integer     NOT NULL DEFAULT 0,
  lock_until       timestamptz,                      -- NULL = pas bloqué
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table : pin_sessions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pin_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           uuid        NOT NULL
                        REFERENCES public.team_members(id) ON DELETE CASCADE,
  session_token_hash  text        NOT NULL UNIQUE,  -- SHA-256(token) — jamais le token brut
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index pour les lookups fréquents
CREATE INDEX IF NOT EXISTS idx_pin_sessions_token_hash
  ON public.pin_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_pin_sessions_member_id
  ON public.pin_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_pin_sessions_expires
  ON public.pin_sessions(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — aucun accès direct via REST API (uniquement via fonctions SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_sessions  ENABLE ROW LEVEL SECURITY;

-- Tout accès direct (select/insert/update/delete) via la clé anon est refusé.
-- Les données ne transitent que par les RPC fonctions ci-dessous.
CREATE POLICY "deny_all_team_members" ON public.team_members
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_pin_sessions" ON public.pin_sessions
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger : updated_at automatique
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_team_members_updated ON public.team_members;
CREATE TRIGGER trg_team_members_updated
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Job de nettoyage des sessions expirées (pg_cron si disponible)
-- ─────────────────────────────────────────────────────────────────────────────
-- Si pg_cron est activé dans votre projet Supabase (Extensions → pg_cron) :
-- SELECT cron.schedule(
--   'purge-expired-pin-sessions',
--   '0 * * * *',  -- toutes les heures
--   $$DELETE FROM public.pin_sessions WHERE expires_at < now();$$
-- );
