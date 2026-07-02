-- ─────────────────────────────────────────────────────────────────────────────
-- 04_fix_no_pgcrypto.sql
--
-- PROBLÈME : gen_random_bytes() et digest() viennent de l'extension pgcrypto,
-- installée sur Supabase dans le schéma "extensions". Les fonctions SECURITY
-- DEFINER avaient SET search_path = public uniquement → les fonctions pgcrypto
-- étaient invisibles au moment de l'exécution (pas de la création).
--
-- SOLUTION : Remplacement par des équivalents built-in PostgreSQL 13+ :
--   • gen_random_bytes(32) → two gen_random_uuid() concatenated
--   • digest(text,'sha256') → sha256(text::bytea)  [PG 11+, built-in, no ext]
--
-- sha256(x::bytea) et digest(x,'sha256') produisent le MÊME résultat pour la
-- même entrée UTF-8 → les tokens déjà créés restent valides.
--
-- À EXÉCUTER dans SQL Editor > Run (copier-coller tout ce fichier).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- Helper interne : hex(sha256) d'une chaîne — remplace encode(digest(x,'sha256'),'hex')
-- Pas besoin d'en faire une fonction séparée, juste une expression inline.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- get_member_salt — inchangé sauf gen_random_bytes → UUID
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_member_salt(p_display_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salt text;
BEGIN
  SELECT pin_salt INTO v_salt
  FROM public.team_members
  WHERE lower(trim(display_name)) = lower(trim(p_display_name));

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.05);
    -- Faux sel aléatoire 32 hex chars (deux UUID sans tirets, ~122 bits d'entropie chacun)
    RETURN json_build_object(
      'salt',  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'found', false
    );
  END IF;

  RETURN json_build_object('salt', v_salt, 'found', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_salt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_salt(text) TO anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- authenticate_pin — remplace gen_random_bytes + digest par built-ins
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.authenticate_pin(
  p_display_name  text,
  p_pin_hash      text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member        public.team_members;
  v_new_fails     int;
  v_lock          timestamptz;
  v_session_token text;
  v_token_hash    text;
  v_expires_at    timestamptz;
BEGIN
  SELECT * INTO v_member
  FROM public.team_members
  WHERE lower(trim(display_name)) = lower(trim(p_display_name))
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.1);
    RETURN json_build_object('success', false, 'error', 'invalid_credentials');
  END IF;

  IF v_member.lock_until IS NOT NULL AND v_member.lock_until > now() THEN
    RETURN json_build_object(
      'success',   false,
      'error',     'account_locked',
      'lockUntil', extract(epoch from v_member.lock_until)::bigint
    );
  END IF;

  IF v_member.pin_hash != lower(trim(p_pin_hash)) THEN
    v_new_fails := v_member.failed_attempts + 1;
    v_lock      := CASE WHEN v_new_fails >= 5 THEN now() + interval '15 minutes' ELSE NULL END;

    UPDATE public.team_members SET
      failed_attempts = v_new_fails,
      lock_until      = v_lock
    WHERE id = v_member.id;

    RETURN json_build_object(
      'success',      false,
      'error',        'invalid_credentials',
      'attemptsLeft', GREATEST(0, 5 - v_new_fails)
    );
  END IF;

  UPDATE public.team_members SET
    failed_attempts = 0,
    lock_until      = NULL
  WHERE id = v_member.id;

  -- Token 64 hex chars depuis deux UUID (128 bits × 2 = entropie suffisante pour un token de session)
  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Hash du token stocké en DB : sha256() built-in PG 13+ (identique à digest(x,'sha256'))
  v_token_hash := encode(sha256(v_session_token::bytea), 'hex');
  v_expires_at := now() + interval '7 days';

  INSERT INTO public.pin_sessions (member_id, session_token_hash, expires_at)
  VALUES (v_member.id, v_token_hash, v_expires_at);

  RETURN json_build_object(
    'success',      true,
    'sessionToken', v_session_token,
    'expiresAt',    extract(epoch from v_expires_at)::bigint,
    'member', json_build_object(
      'id',          v_member.id::text,
      'displayName', v_member.display_name
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.authenticate_pin(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_pin(text, text) TO anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- verify_session — remplace digest par sha256 built-in
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_session(p_session_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash  text;
  v_member_id   uuid;
  v_display     text;
  v_expires     timestamptz;
BEGIN
  -- sha256() built-in PG 11+, même résultat que digest(x,'sha256')
  v_token_hash := encode(sha256(trim(p_session_token)::bytea), 'hex');

  SELECT s.member_id, m.display_name, s.expires_at
  INTO   v_member_id, v_display, v_expires
  FROM   public.pin_sessions s
  JOIN   public.team_members m ON m.id = s.member_id
  WHERE  s.session_token_hash = v_token_hash
    AND  s.expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;

  RETURN json_build_object(
    'valid',       true,
    'memberId',    v_member_id::text,
    'displayName', v_display,
    'expiresAt',   extract(epoch from v_expires)::bigint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_session(text) TO anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- logout_session — remplace digest par sha256 built-in
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.logout_session(p_session_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
BEGIN
  v_token_hash := encode(sha256(trim(p_session_token)::bytea), 'hex');

  DELETE FROM public.pin_sessions
  WHERE session_token_hash = v_token_hash;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.logout_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.logout_session(text) TO anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- reset_member_pin — inchangé (pas de pgcrypto)
-- Réécrit pour cohérence avec les autres fonctions de ce fichier.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_member_pin(
  p_display_name  text,
  p_new_pin_hash  text,
  p_new_salt      text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_members SET
    pin_hash        = lower(trim(p_new_pin_hash)),
    pin_salt        = trim(p_new_salt),
    failed_attempts = 0,
    lock_until      = NULL
  WHERE lower(trim(display_name)) = lower(trim(p_display_name));

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'member_not_found');
  END IF;

  DELETE FROM public.pin_sessions
  WHERE member_id = (
    SELECT id FROM public.team_members
    WHERE lower(trim(display_name)) = lower(trim(p_display_name))
  );

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_member_pin(text, text, text) FROM PUBLIC;


-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification rapide post-déploiement :
-- Copier-coller cette ligne séparément pour tester (renvoie { salt: "...", found: false })
--
--   SELECT public.get_member_salt('TestInconnu');
--
-- ─────────────────────────────────────────────────────────────────────────────
