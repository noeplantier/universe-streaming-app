-- ─────────────────────────────────────────────────────────────────────────────
-- seed_250_reels.sql
-- Insère 250 reels fictifs (status='approved') pour tester le feed à grande échelle.
-- Colle ce script dans l'éditeur SQL de ton tableau de bord Supabase et exécute-le.
-- Pour supprimer ces données de test : DELETE FROM reels WHERE user_id = 'mock-seed-user';
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  genres      text[]  := ARRAY['Drame','Thriller','Comédie','Horreur','Science-Fiction','Action','Romance','Documentaire','Animation','Western'];
  directors   text[]  := ARRAY['Alice Moreau','Baptiste Klein','Célia Fontaine','David Lam','Emma Nguyen','François Petit','Gina Rossi','Hadrien Blot','Iris Vidal','Jonas Muller'];
  titles      text[]  := ARRAY[
    'Le Dernier Signal','Nuit Éternelle','Au-delà du Voile','Fragments','Lumière Morte',
    'Echo','L''Horizon Perdu','Profondeur','Vertiges','La Fracture',
    'Ondes','Territoire Interdit','Crépuscule','Résonance','Abîme',
    'Ligne de Fuite','Le Miroir Brisé','Silence Radio','Ombre Portée','L''Éveil',
    'Désordre','Carrefour','Seuil','Tempête Calme','Dérive'
  ];
  -- Vidéos publiques courtes (Creative Commons) pour simulation — remplace par tes vraies URLs en prod
  video_urls  text[]  := ARRAY[
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4'
  ];
  i           int;
  mock_uid    text    := 'mock-seed-user';
  base_ts     timestamptz := now() - interval '250 days';
BEGIN
  FOR i IN 1..250 LOOP
    INSERT INTO reels (
      user_id,
      video_url,
      title,
      genre,
      director,
      year,
      synopsis,
      duration,
      likes_count,
      views_count,
      status,
      created_at,
      moderated_at,
      moderated_by,
      rejection_category,
      rejection_reason
    ) VALUES (
      mock_uid,
      video_urls[1 + (i % array_length(video_urls, 1))],
      titles[1 + (i % array_length(titles, 1))] || ' #' || i,
      genres[1 + (i % array_length(genres, 1))],
      directors[1 + (i % array_length(directors, 1))],
      (2018 + (i % 7))::text,
      'Synopsis du film #' || i || '. Une œuvre indépendante explorant des thématiques contemporaines avec une mise en scène audacieuse.',
      -- durée entre 5 et 30 min (en minutes) pour simuler des courts-métrages
      5 + (i % 26),
      (i * 7) % 500,
      (i * 13) % 2000,
      'approved',
      base_ts + (i || ' hours')::interval,
      base_ts + (i || ' hours')::interval + interval '2 hours',
      null,
      null,
      null
    );
  END LOOP;

  RAISE NOTICE '250 reels mock insérés avec succès (user_id = %)', mock_uid;
END $$;
