-- =============================================================================
-- ADD WORK_ID TO REELS — Universe app
-- =============================================================================
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- Cette migration ajoute une colonne work_id pour lier chaque reel à une œuvre
-- =============================================================================

-- 1. Ajouter la colonne work_id
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS work_id INTEGER REFERENCES public.works(id) ON DELETE CASCADE;

-- 2. Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_reels_work_id ON public.reels(work_id);

-- 3. Créer un index composite pour les requêtes par work_id + status
CREATE INDEX IF NOT EXISTS idx_reels_work_id_status ON public.reels(work_id, status) WHERE status = 'approved';

-- Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'reels' 
  AND column_name = 'work_id';