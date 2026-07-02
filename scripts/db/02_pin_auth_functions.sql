-- ─────────────────────────────────────────────────────────────────────────────
-- 02_pin_auth_functions.sql — RPC SECURITY DEFINER pour l'auth PIN
-- Toutes les fonctions s'exécutent avec les droits du propriétaire de la DB
-- (pas de l'appelant anon). Aucune donnée sensible ne transite via les
-- policies RLS — seul ce fichier accède aux tables team_members/pin_sessions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- get_member_salt(display_name) → { salt, found }
-- Renvoie le sel du membre pour que le client puisse calculer le hash du PIN.
-- Le sel n'est pas secret (par convention cryptographique). Si le membre
-- n'existe pas, renvoie un faux sel aléatoire (temps constant, anti-enum).
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
    -- Temps de réponse constant pour empêcher l'énumération de membres
    PERFORM pg_sleep(0.05);
    RETURN json_build_object(
      'salt',  encode(gen_random_bytes(16), 'hex'),
      'found', false
    );
  END IF;

  RETURN json_build_object('salt', v_salt, 'found', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_salt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_salt(text) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- authenticate_pin(display_name, pin_hash) → AuthResult
-- Vérifie le hash côté serveur, gère le rate-limiting, émet un session token.
-- Le token brut ne touche jamais la DB — seul son SHA-256 y est stocké.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.authenticate_pin(
  p_display_name  text,
  p_pin_hash      text    -- SHA-256(pin:salt) calculé côté client
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
  -- Verrou de ligne pour éviter les race conditions sur failed_attempts
  SELECT * INTO v_member
  FROM public.team_members
  WHERE lower(trim(display_name)) = lower(trim(p_display_name))
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Temps constant pour ne pas révéler l'existence du membre
    PERFORM pg_sleep(0.1);
    RETURN json_build_object('success', false, 'error', 'invalid_credentials');
  END IF;

  -- Vérification du blocage temporaire
  IF v_member.lock_until IS NOT NULL AND v_member.lock_until > now() THEN
    RETURN json_build_object(
      'success',   false,
      'error',     'account_locked',
      'lockUntil', extract(epoch from v_member.lock_until)::bigint
    );
  END IF;

  -- Vérification du hash PIN
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

  -- Succès : réinitialise le compteur d'échecs
  UPDATE public.team_members SET
    failed_attempts = 0,
    lock_until      = NULL
  WHERE id = v_member.id;

  -- Génère un session token 256 bits aléatoire
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash    := encode(digest(v_session_token, 'sha256'), 'hex');
  v_expires_at    := now() + interval '7 days';

  INSERT INTO public.pin_sessions (member_id, session_token_hash, expires_at)
  VALUES (v_member.id, v_token_hash, v_expires_at);

  RETURN json_build_object(
    'success',      true,
    'sessionToken', v_session_token,   -- envoyé au client, stocké en SecureStore
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
-- verify_session(session_token) → { valid, memberId, displayName, expiresAt }
-- Vérifie qu'un token de session est toujours valide. Appelé au démarrage
-- de l'app pour restaurer la session sans nouvel écran de login.
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
  v_token_hash := encode(digest(trim(p_session_token), 'sha256'), 'hex');

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
-- logout_session(session_token) — Invalide une session côté serveur
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
  v_token_hash := encode(digest(trim(p_session_token), 'sha256'), 'hex');

  DELETE FROM public.pin_sessions
  WHERE session_token_hash = v_token_hash;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.logout_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.logout_session(text) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- reset_member_pin(display_name, new_pin_hash, new_salt) — Admin only
-- À appeler depuis le tableau de bord Supabase (SQL editor), jamais depuis l'app.
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

  -- Invalide toutes les sessions existantes du membre
  DELETE FROM public.pin_sessions
  WHERE member_id = (
    SELECT id FROM public.team_members
    WHERE lower(trim(display_name)) = lower(trim(p_display_name))
  );

  RETURN json_build_object('success', true);
END;
$$;

-- reset_member_pin n'est pas exposé à anon — uniquement via SQL Editor admin
REVOKE ALL ON FUNCTION public.reset_member_pin(text, text, text) FROM PUBLIC;
