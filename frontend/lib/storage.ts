import { supabase } from './supabase';

export function getWorkImageUrl(imagePath?: string | null) {
  if (!imagePath) return null;

  const { data } = supabase.storage
    .from('community-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
}