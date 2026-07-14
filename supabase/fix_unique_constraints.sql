-- =============================================================================
-- FIX 409 Conflict : contraintes UNIQUE sur user_liked_reels / user_saved_reels
-- =============================================================================
-- PostgREST renvoie 409 quand onConflict spécifie (user_id, reel_id) sans index
-- UNIQUE correspondant en base. Ce script déduplique puis crée les contraintes.
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- ── 1. Dédupliquer user_liked_reels (garder la ligne la plus récente) ────────
DELETE FROM public.user_liked_reels a
USING public.user_liked_reels b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.reel_id = b.reel_id;

-- ── 2. Dédupliquer user_saved_reels ──────────────────────────────────────────
DELETE FROM public.user_saved_reels a
USING public.user_saved_reels b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.reel_id = b.reel_id;

-- ── 3. Ajouter les contraintes UNIQUE (idempotent via IF NOT EXISTS) ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_liked_reels_user_id_reel_id_key'
      AND conrelid = 'public.user_liked_reels'::regclass
  ) THEN
    ALTER TABLE public.user_liked_reels
      ADD CONSTRAINT user_liked_reels_user_id_reel_id_key UNIQUE (user_id, reel_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_saved_reels_user_id_reel_id_key'
      AND conrelid = 'public.user_saved_reels'::regclass
  ) THEN
    ALTER TABLE public.user_saved_reels
      ADD CONSTRAINT user_saved_reels_user_id_reel_id_key UNIQUE (user_id, reel_id);
  END IF;
END $$;

-- ── 4. S'assurer que RLS est désactivé et les grants accordés ────────────────
ALTER TABLE public.user_liked_reels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_reels DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_liked_reels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_reels TO anon, authenticated;

-- Vérification
-- SELECT conname, contype FROM pg_constraint WHERE conrelid IN (
--   'public.user_liked_reels'::regclass, 'public.user_saved_reels'::regclass
-- );
