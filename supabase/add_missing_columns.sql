-- =============================================================================
-- ADD MISSING COLUMNS — Universe app
-- =============================================================================
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- Ces colonnes sont absentes de la DB mais référencées dans le code.
-- Une fois exécuté, les toggles et XP seront pleinement fonctionnels.
-- =============================================================================

-- 1. Colonne XP sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;

-- 2. Colonne show_level_on_profile sur user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS show_level_on_profile boolean DEFAULT true;

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   IN ('profiles', 'user_preferences')
  AND column_name  IN ('xp', 'show_level_on_profile');
