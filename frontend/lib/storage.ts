import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export function getWorkImageUrl(imagePath?: string | null) {
  if (!imagePath) return null;

  const { data } = supabase.storage
    .from('community-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
}