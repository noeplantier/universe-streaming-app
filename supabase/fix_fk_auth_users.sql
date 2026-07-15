-- =============================================================================
-- FIX FK : user_liked_reels + user_saved_reels → profiles.id (device UUID)
-- =============================================================================
-- CAUSE RACINE : les FK actuelles pointent vers auth.users(id).
-- L'app Universe N'UTILISE PAS supabase.auth — les user_id insérés sont des
-- device UUIDs présents dans public.profiles.id, JAMAIS dans auth.users.
-- → Insert/upsert échoue avec code 23503 (foreign key violation).
--
-- Ce script :
--   1. Supprime les FK vers auth.users sur les deux tables
--   2. Recrée les FK vers public.profiles(id)
--   3. Ajoute les contraintes UNIQUE(user_id, reel_id) pour que
--      l'upsert onConflict fonctionne sans 409
--   4. S'assure que RLS est désactivé et les grants accordés
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- ── 1. Supprimer les FK auth.users (peut avoir différents noms) ───────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid IN (
      'public.user_liked_reels'::regclass,
      'public.user_saved_reels'::regclass
    )
    AND contype = 'f'
    AND confrelid = (SELECT oid FROM pg_class WHERE relname = 'users'
                     AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth'))
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      (SELECT relname FROM pg_class WHERE oid = (
        SELECT conrelid FROM pg_constraint WHERE conname = r.conname
        AND conrelid IN ('public.user_liked_reels'::regclass,'public.user_saved_reels'::regclass)
        LIMIT 1
      )),
      r.conname);
  END LOOP;
END $$;

-- ── 2. Dédupliquer (prérequis pour UNIQUE) ────────────────────────────────────
DELETE FROM public.user_liked_reels a
USING public.user_liked_reels b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.reel_id = b.reel_id;

DELETE FROM public.user_saved_reels a
USING public.user_saved_reels b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.reel_id = b.reel_id;

-- ── 3. Ajouter contraintes UNIQUE (onConflict) ───────────────────────────────
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

-- ── 4. Re-créer les FK vers public.profiles(id) ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_liked_reels_user_id_profiles_fkey'
      AND conrelid = 'public.user_liked_reels'::regclass
  ) THEN
    ALTER TABLE public.user_liked_reels
      ADD CONSTRAINT user_liked_reels_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_saved_reels_user_id_profiles_fkey'
      AND conrelid = 'public.user_saved_reels'::regclass
  ) THEN
    ALTER TABLE public.user_saved_reels
      ADD CONSTRAINT user_saved_reels_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 5. RLS désactivé + grants complets ───────────────────────────────────────
ALTER TABLE public.user_liked_reels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_reels DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_liked_reels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_reels TO anon, authenticated;

-- ── Vérification ──────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_schema,
  ccu.table_name   AS foreign_table,
  ccu.column_name  AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage   AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('user_liked_reels','user_saved_reels');
