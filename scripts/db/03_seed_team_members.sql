-- ─────────────────────────────────────────────────────────────────────────────
-- 03_seed_team_members.sql — Membres de l'équipe Universe + PINs initiaux
--
-- ⚠️ SÉCURITÉ : Remplacez les PINs ci-dessous par des valeurs personnalisées
-- AVANT d'exécuter ce script. Ne commitez JAMAIS ce fichier avec de vrais PINs.
-- Ajoutez-le à .gitignore après personnalisation.
--
-- Format du hash : SHA-256(pin || ':' || salt) en hexadécimal
-- Le sel est généré aléatoirement par PostgreSQL (gen_random_bytes).
-- Ce script utilise le même algorithme que le client React Native.
--
-- PINs initiaux (À CHANGER IMMÉDIATEMENT après le premier setup) :
--   Aresse   : 741852
--   Chassaing: 963258
--   BSE      : 178526
--   Sharl    : 905347
--   Clem     : 263890
--   Enzo     : 741963
--   NOX      : 358124
--   Maxime   : 527046
-- ─────────────────────────────────────────────────────────────────────────────

-- Suppression des données existantes pour idempotence
DELETE FROM public.pin_sessions;
DELETE FROM public.team_members;

-- Insertion avec hash calculé côté SQL (pgcrypto)
-- Formula : encode(digest(pin || ':' || salt, 'sha256'), 'hex')
DO $$
DECLARE
  members text[][] := ARRAY[
    ARRAY['Aresse',    '741852'],
    ARRAY['Chassaing', '963258'],
    ARRAY['BSE',       '178526'],
    ARRAY['Sharl',     '905347'],
    ARRAY['Clem',      '263890'],
    ARRAY['Enzo',      '741963'],
    ARRAY['NOX',       '358124'],
    ARRAY['Maxime',    '527046']
  ];
  m    text[];
  salt text;
  hash text;
BEGIN
  FOREACH m SLICE 1 IN ARRAY members LOOP
    salt := encode(gen_random_bytes(16), 'hex');
    hash := encode(digest(m[2] || ':' || salt, 'sha256'), 'hex');

    INSERT INTO public.team_members (display_name, pin_hash, pin_salt)
    VALUES (m[1], hash, salt);

    RAISE NOTICE 'Membre créé : % (PIN initial : %)', m[1], m[2];
  END LOOP;

  RAISE NOTICE '---';
  RAISE NOTICE '✅ 8 membres créés. Communiquez les PINs de façon sécurisée';
  RAISE NOTICE '   et demandez à chaque membre de le changer dès la première connexion.';
  RAISE NOTICE '---';
END $$;

-- Vérification : afficher les membres créés (sans les hashes ni sels)
SELECT id, display_name, failed_attempts, lock_until, created_at
FROM public.team_members
ORDER BY display_name;
