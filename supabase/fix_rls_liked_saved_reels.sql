-- =============================================================================
-- FIX 401 UNAUTHORIZED on user_liked_reels / user_saved_reels
-- =============================================================================
-- Cause : RLS activé sans politique SELECT pour le rôle `anon`.
-- L'app Universe utilise PIN auth (ZERO supabase.auth.*) — auth.uid() est
-- toujours null, donc les politiques basées sur auth.uid() bloquent tout.
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- OPTION 1 (recommandée) : Désactiver RLS entièrement sur ces tables
-- Ces données sont de toute façon lisibles publiquement (compteurs de likes).
ALTER TABLE public.user_liked_reels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_reels DISABLE ROW LEVEL SECURITY;

-- Accorder toutes les opérations nécessaires (INSERT/UPDATE/DELETE pour like/save)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_liked_reels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_reels TO anon, authenticated;

-- =============================================================================
-- OPTION 2 (si vous préférez garder RLS activé) :
-- Créer des politiques permissives SELECT + re-activer RLS
-- =============================================================================
-- ALTER TABLE public.user_liked_reels ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_saved_reels ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS universe_anon_select_liked_reels ON public.user_liked_reels;
-- CREATE POLICY universe_anon_select_liked_reels
--   ON public.user_liked_reels FOR SELECT TO anon, authenticated USING (true);
--
-- DROP POLICY IF EXISTS universe_anon_select_saved_reels ON public.user_saved_reels;
-- CREATE POLICY universe_anon_select_saved_reels
--   ON public.user_saved_reels FOR SELECT TO anon, authenticated USING (true);

-- Vérification : doit retourner des lignes sans erreur
-- SELECT count(*) FROM public.user_liked_reels;
-- SELECT count(*) FROM public.user_saved_reels;
