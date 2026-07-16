-- =============================================================================
-- ADD video_url TO public.works + CREATE public.quests
-- =============================================================================
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- 1. Colonne video_url sur works (NULL = fallback côté app)
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS video_url text;

-- 2. Associer des vidéos du domaine public (~25 min) à chaque œuvre
--    Remplacer par vos propres URLs si vous avez des fichiers privés.
--    Fallback côté app : WORKS_VIDEO_FALLBACKS[(work.id-1) % 14]
UPDATE public.works SET video_url = CASE id
  WHEN 1  THEN 'https://archive.org/download/TheAdventurer/TheAdventurer_512kb.mp4'
  WHEN 2  THEN 'https://archive.org/download/TheRink_201602/TheRink_512kb.mp4'
  WHEN 3  THEN 'https://archive.org/download/EasyStreet1917/EasyStreet_512kb.mp4'
  WHEN 4  THEN 'https://archive.org/download/CharlieChaplainsThePawnshop/ThePawnshop_512kb.mp4'
  WHEN 5  THEN 'https://archive.org/download/charlieChaplinsTheImmigrant/TheImmigrant_512kb.mp4'
  WHEN 6  THEN 'https://archive.org/download/OneWeek/OneWeek_512kb.mp4'
  WHEN 7  THEN 'https://archive.org/download/convict13/convict13_512kb.mp4'
  WHEN 8  THEN 'https://archive.org/download/NeighborsBusterKeaton/NeighborsBusterKeaton_512kb.mp4'
  WHEN 9  THEN 'https://archive.org/download/TheBoatKeaton/TheBoatKeaton_512kb.mp4'
  WHEN 10 THEN 'https://archive.org/download/CopsKeaton1922/CopsKeaton1922_512kb.mp4'
  WHEN 11 THEN 'https://archive.org/download/ThePalefaceBusterKeaton/ThePaleface_512kb.mp4'
  WHEN 12 THEN 'https://archive.org/download/ATrip_to_the_Moon_1902/Trip_to_the_Moon_512kb.mp4'
  WHEN 13 THEN 'https://archive.org/download/TheNavigatorKeaton/TheNavigatorKeaton_512kb.mp4'
  WHEN 14 THEN 'https://archive.org/download/ShoulderArms1918/ShoulderArms_512kb.mp4'
  ELSE NULL
END
WHERE id BETWEEN 1 AND 14;

-- 3. Table public.quests (gestion des quêtes gamification)
CREATE TABLE IF NOT EXISTS public.quests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  type        text NOT NULL,          -- 'watch', 'review', 'like', 'share', 'streak', etc.
  target      integer NOT NULL DEFAULT 1,
  xp_reward   integer NOT NULL DEFAULT 50,
  badge_id    uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  is_daily    boolean NOT NULL DEFAULT false,
  is_seasonal boolean NOT NULL DEFAULT false,
  reset_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index pour les quêtes actives
CREATE INDEX IF NOT EXISTS idx_quests_type ON public.quests(type);
CREATE INDEX IF NOT EXISTS idx_quests_is_daily ON public.quests(is_daily) WHERE is_daily = true;

-- Désactiver RLS (lecture publique — cohérent avec le reste de l'app)
ALTER TABLE public.quests DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.quests TO anon, authenticated;

-- 4. Quêtes de démarrage
INSERT INTO public.quests (title, description, type, target, xp_reward, is_daily, is_seasonal)
VALUES
  ('Premier visionnage',    'Regarde ton premier film via Universe',            'watch',   1,  100, false, false),
  ('Critique du cinéphile', 'Rédige ta première critique',                      'review',  1,  150, false, false),
  ('Explorateur de genres', 'Visionne des films de 5 genres différents',        'watch',  5,   200, false, false),
  ('Fan inconditionnel',    'Like 10 films différents',                         'like',   10,  120, false, false),
  ('Série noire',           'Maintiens un streak de 7 jours consécutifs',       'streak',  7,  300, false, false),
  ('Réalisateur universel', 'Upload ta première création vidéo',                'upload',  1,  250, false, false),
  ('Ambassadeur',           'Partage 3 films avec ton réseau',                  'share',   3,   80, false, false),
  ('Quête du jour — Watch', 'Visionne 1 film aujourd\'hui',                     'watch',   1,   30, true,  false),
  ('Quête du jour — Avis',  'Laisse un avis sur un film aujourd\'hui',          'review',  1,   40, true,  false),
  ('Quête du jour — Like',  'Like 3 films aujourd\'hui',                        'like',    3,   25, true,  false)
ON CONFLICT DO NOTHING;

-- Vérification
SELECT id, title, type, target, xp_reward, is_daily FROM public.quests ORDER BY created_at;
