import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import { supabase }           from '@/lib/supabase';
import { C, MAX_DURATION }    from './tokens';
import type { ReelMeta }      from './types';



// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  uploading: boolean;
  uploadProgress: number;
  uploadMsg: string;

  onUpload: () => Promise<void>;
  meta:             ReelMeta;
  videoUri:         string;       // URI local (expo-media-library / file-system)
  trimStart:        number;
  trimEnd:          number;
  onUploadSuccess?: (newReelId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (s: number) => `${Math.floor(s)}s`;

async function uploadVideoToStorage(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const ext = uri.split('.').pop()?.split('?')[0] ?? 'mp4';
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
  .from('videos')
  .upload(path, blob, { contentType: 'video/mp4', upsert: false });
  
  console.log('[uploadVideoToStorage] path=', path, 'error=', error);

  if (error) throw error;

  const { data } = supabase.storage.from('videos').getPublicUrl(path);
  return data.publicUrl;
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const StepPublish = memo(function StepPublish({
  meta,
  videoUri,
  trimStart,
  trimEnd,
  onUploadSuccess,
}: Props) {
  const router   = useRouter();
  const trimDur  = trimEnd - trimStart;

  // ── Upload state (internalisé) ────────────────────────────────────────────
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploadMsg,       setUploadMsg]       = useState('');
  const [uploadError,     setUploadError]     = useState<string | null>(null);

  // ── Checklist ─────────────────────────────────────────────────────────────
  const checks = useMemo(() => [
    { ok: meta.title.trim().length > 0,           txt: 'Titre renseigné'               },
    { ok: meta.genre.length > 0,                  txt: 'Genre sélectionné'             },
    { ok: trimDur > 0 && trimDur <= MAX_DURATION, txt: `Durée ≤ ${MAX_DURATION}s`      },
    { ok: true,                             txt: 'Vidéo sélectionnée'            },
    { ok: true,                                   txt: 'Tag #CinémaIndépendant'        },
  ], [meta.title, meta.genre, trimDur]);




  const allOk = checks.every(c => c.ok);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!allOk || uploading) return;

    setUploading(true);
    setUploadError(null);

    try {
      // 1 — Récupération utilisateur
      setUploadMsg('Vérification du compte…');
      setUploadProgress(5);

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('Utilisateur non connecté.');

      // 2 — Upload vidéo dans le storage
      setUploadMsg('Envoi de la vidéo…');
      setUploadProgress(15);

// juste avant: const videoUrl = await uploadVideoToStorage(videoUri);

const { data: sess, error: sessErr } = await supabase.auth.getSession();
console.log('[StepPublish] session ok?', !!sess?.access_token, sessErr);
const { data: user2, error: userErr2 } = await supabase.auth.getUser();
console.log('[StepPublish] user?', user2?.id, userErr2);

      // 3 — Insertion dans la table reels
      setUploadMsg('Publication en cours…');
      const { data: inserted, error: insertErr } = await supabase
        .from('reels')
        .insert({
          user_id:     user.id,
          video_url:   videoUrl,
          title:       meta.title.trim(),
          genre:       meta.genre,
          director:    meta.director?.trim() ?? '',
          year:        meta.year             ?? String(new Date().getFullYear()),
          synopsis:    meta.synopsis         ?? '',
          duration:    Math.round(trimDur),
          likes_count: 0,
          views_count: 0,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      setUploadProgress(100);
      setUploadMsg('Publié avec succès !');

      // 4 — Navigation vers le feed avec scroll automatique
      const newId = inserted.id as string;
      onUploadSuccess?.(newId);

      // Légère pause pour laisser voir le 100 %
      await new Promise(r => setTimeout(r, 600));
      router.replace({ pathname: '/(tabs)', params: { newReelId: newId } });

    } catch (err: any) {
      console.error('[StepPublish] upload error:', err);
      setUploadError(err?.message ?? 'Une erreur est survenue.');
    } finally {
      setUploading(false);
    }
  }, [allOk, uploading, videoUri, meta, trimDur, onUploadSuccess, router]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View>
      <Text style={s.sectionTitle}>Aperçu et publication</Text>
      <Text style={s.hint}>Vérifiez les informations avant de publier votre Réel.</Text>

      {/* ── Reel preview card ────────────────────────────────────────────── */}
      <View style={s.reelPreview}>
        <LinearGradient
          colors={[C.navyMid, C.navy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Miniature vidéo */}
        <View style={s.reelFrame}>
          <LinearGradient
            colors={[C.navyMid, C.navy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.reelFrameBg}
          >
            <View style={s.reelPlay}>
              <Ionicons name="play" size={22} color="white" />
            </View>
            <View style={s.reelDurBadge}>
              <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.8)" />
              <Text style={s.reelDurTxt}>{fmt(trimDur)}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Infos textuelles */}
        <View style={s.reelInfo}>
          <View style={s.genreTag}>
            <Text style={s.genreTagTxt}>{meta.genre || 'Cinéma'}</Text>
          </View>
          <Text style={s.reelTitle}>{meta.title || 'Sans titre'}</Text>
          {meta.director ? (
            <Text style={s.reelDir}>
              par {meta.director}{meta.year ? ` · ${meta.year}` : ''}
            </Text>
          ) : null}
          {meta.synopsis?.length > 0 && (
            <Text style={s.reelSynopsis} numberOfLines={2}>{meta.synopsis}</Text>
          )}
        </View>
      </View>

      {/* ── Checklist ────────────────────────────────────────────────────── */}
      <View style={s.checkList}>
        {checks.map(item => (
          <View key={item.txt} style={s.checkRow}>
            <Ionicons
              name={item.ok ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={item.ok ? C.green : C.red}
            />
            <Text style={[s.checkTxt, !item.ok && { color: C.red }]}>{item.txt}</Text>
          </View>
        ))}
      </View>

      {/* ── Erreur upload ────────────────────────────────────────────────── */}
      {uploadError && (
        <View style={s.errorWrap}>
          <Ionicons name="alert-circle-outline" size={14} color={C.red} />
          <Text style={s.errorTxt}>{uploadError}</Text>
        </View>
      )}

      {/* ── Barre de progression ─────────────────────────────────────────── */}
      {uploading && (
        <View style={s.progressWrap}>
          <View style={s.progressHeader}>
            <ActivityIndicator size="small" color={C.navyMid} />
            <Text style={s.progressMsg}>{uploadMsg}</Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${uploadProgress}%` as any }]} />
          </View>
          <Text style={s.progressPct}>{uploadProgress}%</Text>
        </View>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      {!uploading && (
        <TouchableOpacity
          style={[s.cta, !allOk && { opacity: 0.38 }]}
          onPress={handleUpload}
          activeOpacity={0.85}
          disabled={!allOk}
        >
          <LinearGradient
            colors={[C.navyMid, C.navy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGrad}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="white" />
            <Text style={s.ctaTxt}>Publier dans mes Réels</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Text style={s.legal}>
        En publiant, vous certifiez être l'auteur ou ayant-droits de cette œuvre
        et acceptez les conditions d'utilisation de la plateforme.
      </Text>
    </View>
  );
});

export default StepPublish;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  sectionTitle:   { color: C.text,    fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:           { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },

  // Preview card
  reelPreview:    { borderRadius: 20, borderWidth: 1, borderColor: C.borderAcc, overflow: 'hidden', marginBottom: 20, padding: 16, gap: 14, flexDirection: 'row', alignItems: 'center' },
  reelFrame:      { width: 80, height: 120, borderRadius: 14, overflow: 'hidden' },
  reelFrameBg:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reelPlay:       { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  reelDurBadge:   { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  reelDurTxt:     { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700' },
  reelInfo:       { flex: 1, gap: 5 },
  genreTag:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.navyMid, borderWidth: 1, borderColor: C.borderAcc },
  genreTagTxt:    { color: C.teal, fontSize: 10, fontWeight: '700' },
  reelTitle:      { color: C.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  reelDir:        { color: C.textSec, fontSize: 12 },
  reelSynopsis:   { color: C.textTert, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },

  // Checklist
  checkList:      { gap: 10, marginBottom: 20, backgroundColor: C.navyMid, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  checkRow:       { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkTxt:       { color: C.textSec, fontSize: 13 },

  // Erreur
  errorWrap:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, backgroundColor: 'rgba(255,59,92,0.10)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,59,92,0.28)', padding: 12 },
  errorTxt:       { color: C.red, fontSize: 12, flex: 1 },

  // Progress
  progressWrap:   { marginBottom: 20, gap: 8 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressMsg:    { color: C.textSec, fontSize: 13 },
  progressBg:     { height: 4, borderRadius: 2, backgroundColor: C.navyMid, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 2, backgroundColor: C.teal },
  progressPct:    { color: C.teal, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  // CTA
  cta:            { borderRadius: 22, overflow: 'hidden', marginBottom: 14 },
  ctaGrad:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  ctaTxt:         { color: 'white', fontSize: 16, fontWeight: '800' },

  // Legal
  legal:          { color: C.textTert, fontSize: 10, textAlign: 'center', lineHeight: 15, fontStyle: 'italic' },
});