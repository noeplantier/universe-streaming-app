import { Platform }    from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode }      from 'base64-arraybuffer';
import { supabase }    from '@/lib/supabase';
import { MAX_DURATION } from '@/components/create/tokens';
import type { ReelMeta } from '@/components/create/types';

export async function uploadReelToSupabase(
  localUri:   string,
  meta:       ReelMeta,
  userId:     string,
  onProgress: (pct: number, msg: string) => void,
): Promise<{ id: string; video_url: string } | null> {
  try {
    onProgress(10, 'Préparation du fichier…');

    const isBlob   = localUri.startsWith('blob:');
    const rawExt   = isBlob ? 'mp4' : (localUri.split('.').pop()?.toLowerCase() ?? 'mp4');
    const ext      = rawExt === 'mov' ? 'mp4' : rawExt;
    const mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : `video/${ext}`;
    const filename = `reel_${userId}_${Date.now()}.${ext}`;

    let uploadPayload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      const res = await fetch(localUri);
      uploadPayload = await res.arrayBuffer();
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      uploadPayload = decode(base64);
    }

    onProgress(30, 'Upload en cours…');

    const { data: storageData, error: storageError } = await supabase.storage
      .from('social')
      .upload(`videos/${filename}`, uploadPayload, { contentType: mimeType, upsert: false });

    if (storageError) throw storageError;

    onProgress(70, 'Enregistrement des métadonnées…');

    const videoUrl = supabase.storage
      .from('social')
      .getPublicUrl(storageData.path).data.publicUrl;

    const { data, error } = await supabase
      .from('reels')
      .insert({
        user_id:     userId,
        video_url:   videoUrl,
        title:       meta.title.trim(),
        genre:       meta.genre,
        director:    meta.director.trim(),
        year:        meta.year.trim(),
        synopsis:    meta.synopsis.trim(),
        duration:    MAX_DURATION,
        likes_count: 0,
        views_count: 0,
        created_at:  new Date().toISOString(),
      })
      .select('id, video_url')
      .single();

    if (error) throw error;

    onProgress(100, 'Publié !');
    return data as { id: string; video_url: string };
  } catch (e) {
    console.error('[uploadReel]', e);
    return null;
  }
}