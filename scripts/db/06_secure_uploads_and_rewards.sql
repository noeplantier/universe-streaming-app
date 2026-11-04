-- P0/P6 security hardening for the existing PIN-auth application.
-- Access is deliberately fail-closed until the app supplies a real Supabase Auth JWT
-- carrying a trusted app_metadata.role. Do not use device_id as an authorization identity.

-- Add a real owner key for future work uploads; legacy rows remain unassigned.
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS works_owner_user_id_idx
  ON public.works(owner_user_id);
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

-- Replace the verified PUBLIC=true write policies with trusted role + owner checks.
DROP POLICY IF EXISTS up_works_insert ON public.works;
DROP POLICY IF EXISTS up_works_update ON public.works;
DROP POLICY IF EXISTS works_insert_admin_producer_owner ON public.works;
DROP POLICY IF EXISTS works_update_admin_or_producer_owner ON public.works;

CREATE POLICY works_insert_admin_producer_owner
  ON public.works
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND public.current_role() IN ('admin', 'realisateur_producteur')
  );

CREATE POLICY works_update_admin_or_producer_owner
  ON public.works
  FOR UPDATE TO authenticated
  USING (
    public.current_role() = 'admin'
    OR (
      public.current_role() = 'realisateur_producteur'
      AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_role() = 'admin'
    OR (
      public.current_role() = 'realisateur_producteur'
      AND owner_user_id = auth.uid()
    )
  );

-- Keep community images publicly readable, but require an authenticated, trusted
-- role and a UID-owned path for writes. The existing PIN/device_id upload flow
-- will fail closed until it is migrated to a Supabase Auth session and UID path.
DROP POLICY IF EXISTS "Public Insert Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Images" ON storage.objects;
DROP POLICY IF EXISTS community_images_open ON storage.objects;
DROP POLICY IF EXISTS storage_upload ON storage.objects;
DROP POLICY IF EXISTS community_images_insert_role_owner ON storage.objects;
DROP POLICY IF EXISTS community_images_update_role_owner ON storage.objects;

CREATE POLICY community_images_insert_role_owner
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-images'
    AND public.current_role() IN ('admin', 'realisateur_producteur')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY community_images_update_role_owner
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'community-images'
    AND (
      public.current_role() = 'admin'
      OR (
        public.current_role() = 'realisateur_producteur'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'community-images'
    AND (
      public.current_role() = 'admin'
      OR (
        public.current_role() = 'realisateur_producteur'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

-- Stop client-controlled quest progress/XP writes. Keep authenticated owner reads;
-- a future server-verified claim flow must be added before rewards are re-enabled.
DROP POLICY IF EXISTS quest_progress_insert ON public.quest_progress;
DROP POLICY IF EXISTS quest_progress_update ON public.quest_progress;
DROP POLICY IF EXISTS quest_progress_select ON public.quest_progress;
CREATE POLICY quest_progress_select_own
  ON public.quest_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- These SECURITY DEFINER RPCs have no role or completion checks in their bodies.
-- Retain server-side access only; never expose them to anon/authenticated clients.
REVOKE EXECUTE ON FUNCTION public.add_xp(uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_xp(uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, text, text)
  TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, text)
  TO service_role, postgres;
