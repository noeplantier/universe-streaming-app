-- Universe Streaming — Supabase schema migration
-- Run in Supabase SQL Editor

-- ── Videos table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.videos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    description         TEXT,
    director_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    genre               TEXT,
    duration_seconds    INT,
    status              TEXT NOT NULL DEFAULT 'pending_upload'
                            CHECK (status IN ('pending_upload','transcoding','ready','failed')),
    transcode_progress  INT DEFAULT 0 CHECK (transcode_progress BETWEEN 0 AND 100),
    transcode_error     TEXT,
    -- JSONB array of {label, bandwidth, resolution, playlist_path}
    qualities           JSONB DEFAULT '[]'::jsonb,
    thumbnail_url       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: directors see their own videos, users see ready ones
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "directors_manage_own" ON public.videos
    FOR ALL USING (auth.uid() = director_id);

CREATE POLICY "public_read_ready" ON public.videos
    FOR SELECT USING (status = 'ready');

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_videos_status      ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_director_id ON public.videos(director_id);
CREATE INDEX IF NOT EXISTS idx_videos_genre       ON public.videos(genre);
CREATE INDEX IF NOT EXISTS idx_videos_created_at  ON public.videos(created_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER videos_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Supabase Storage bucket (run once) ───────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('universe-videos', 'universe-videos', false)
-- ON CONFLICT DO NOTHING;
