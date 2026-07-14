-- =============================================================================
-- FIX add_xp RPC : remplace la référence à cinephile_profiles (table supprimée)
-- par public.profiles
-- =============================================================================
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_xp(
  p_user_id uuid,
  p_xp      integer,
  p_reason  text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Met à jour xp ET contribution_score pour cohérence
  -- (l'app lit contribution_score comme proxy XP)
  UPDATE public.profiles
  SET
    xp                 = COALESCE(xp, 0)                 + p_xp,
    contribution_score = COALESCE(contribution_score, 0) + p_xp
  WHERE id = p_user_id;
END;
$$;

-- Autoriser les rôles anon/authenticated à appeler cette fonction
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, text) TO anon, authenticated;

-- Vérification (optionnel)
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'add_xp';
