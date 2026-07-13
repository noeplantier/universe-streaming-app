-- =============================================================================
-- FIX 401 UNAUTHORIZED on user_liked_reels / user_saved_reels
-- =============================================================================
-- Cause : ces tables n'ont pas de GRANT SELECT accordé au rôle `anon`.
-- L'app Universe utilise PIN auth (ZERO supabase.auth.*) — auth.uid() est
-- toujours null, donc les politiques RLS basées sur auth.uid() bloquent les
-- lectures. Les écritures (INSERT/UPSERT/DELETE) peuvent fonctionner si leurs
-- politiques sont définies différemment.
--
-- SOLUTION : accorder SELECT au rôle anon + ajouter une politique permissive.
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- 1. Accorder SELECT au rôle anon (et authenticated par cohérence)
GRANT SELECT ON public.user_liked_reels TO anon, authenticated;
GRANT SELECT ON public.user_saved_reels TO anon, authenticated;

-- 2. Politiques RLS permissives pour SELECT (l'app n'a pas de session auth réelle)
--    Si RLS est déjà désactivé sur ces tables : ignorer les CREATE POLICY.
DO $$
BEGIN
  -- user_liked_reels
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_liked_reels'
      AND policyname = 'universe_anon_select_liked_reels'
  ) THEN
    EXECUTE 'CREATE POLICY universe_anon_select_liked_reels
      ON public.user_liked_reels FOR SELECT TO anon, authenticated USING (true)';
  END IF;

  -- user_saved_reels
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_saved_reels'
      AND policyname = 'universe_anon_select_saved_reels'
  ) THEN
    EXECUTE 'CREATE POLICY universe_anon_select_saved_reels
      ON public.user_saved_reels FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END $$;

-- 3. Vérification : les deux tables doivent retourner des lignes sans erreur
-- SELECT count(*) FROM public.user_liked_reels;
-- SELECT count(*) FROM public.user_saved_reels;
