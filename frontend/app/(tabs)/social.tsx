// ─────────────────────────────────────────────────────────────────────────────
// app/social.tsx  —  Écran Communauté  (v3 — typage strict, zéro object-child)
//
// SCHÉMA SUPABASE  (SQL à coller dans Dashboard → SQL Editor)
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useCallback, useRef, useMemo,
  useEffect, useContext, createContext, memo,
} from 'react';
import {
  View, Text, StyleSheet, Animated, RefreshControl,
  TouchableOpacity, Image, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Pressable, Alert,
  ActivityIndicator, Share, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import * as ImagePicker   from 'expo-image-picker';

import { supabase }                  from '@/lib/supabase';
import { SocialProvider, useSocial } from '@/components/social/SocialContext';
import GalaxyBackground              from '@/components/social/GalaxyBackground';
import StoryRail                     from '@/components/social/StoryRail';
import { G, FEED_TABS, TAB_FILTER }  from '@/components/social/types';
import type { FeedTab, PostData }    from '@/components/social/types';

const { width: W } = Dimensions.get('window');
const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg0:        '#07000F',
  surf:       'rgba(255,255,255,0.055)',
  border:     'rgba(255,255,255,0.08)',
  borderHi:   'rgba(192,96,255,0.4)',
  text:       '#F3EDFF',
  textSec:    '#9B94AA',
  textTert:   '#584F66',
  gold:       '#F5C842',
  violet:     '#C060FF',
  violetDim:  'rgba(192,96,255,0.18)',
  violetSoft: 'rgba(192,96,255,0.08)',
  red:        '#FF3B5C',
  green:      '#30D158',
  teal:       '#5AC8FA',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TONES
// ─────────────────────────────────────────────────────────────────────────────
const TONE_KEYS = ['analyse', 'coup de coeur', 'deception', 'reflexion'] as const;
type Tone = typeof TONE_KEYS[number];

const TONES: { key: Tone; label: string; icon: string; color: string }[] = [
  { key: 'analyse',      label: 'Analyse',      icon: 'flask-outline',       color: C.teal },
  { key: 'coup de coeur',label: 'Coup de coeur',icon: 'heart-outline',       color: C.red  },
  { key: 'deception',    label: 'Deception',    icon: 'thunderstorm-outline',color: C.gold },
  { key: 'reflexion',    label: 'Reflexion',    icon: 'bulb-outline',        color: '#A78BFA' },
];

const GENRES_LIST = [
  'Drame', 'Thriller', 'Sci-Fi', 'Documentaire',
  'Animation', 'Court metrage', 'Experimental', 'Biopic',
] as const;

const MIN_BODY = 80;
const MOCK_UID = '00000000-0000-0000-0000-000000000000'; 

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZED POST  — structure interne sans objet brut potentiel
// ─────────────────────────────────────────────────────────────────────────────
interface NormalizedPost {
  id:           string;
  userId:       string;
  userName:     string;
  avatar:       string;
  timeAgo:      string;
  content:      string;
  likes:        number;
  comments:     number;
  work_title:   string;
  work_year:    string;
  work_director:string;
  work_genre:   string;
  rating:       number;
  image_url:    string;
  tags:         string[];
  tone:         Tone;
  shares_count: number;
}

/**
 * Convertit n'importe quel PostData (SocialContext) en NormalizedPost.
 * Gere le cas ou post.film est un objet {title, poster, year, filmId, rating}.
 * Apres normalisation, AUCUNE valeur n'est un objet — tout est primitif.
 */
function normalizePost(raw: PostData): NormalizedPost {
  const r = raw as unknown as Record<string, unknown>;

  // film peut etre objet ou string
  const filmObj =
    r['film'] && typeof r['film'] === 'object' && !Array.isArray(r['film'])
      ? (r['film'] as Record<string, unknown>)
      : null;

  const safeStr  = (v: unknown): string => (v != null && typeof v !== 'object' ? String(v) : '');
  const safeNum  = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
  const safeArr  = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(x => safeStr(x)).filter(Boolean) : [];

  const work_title    = safeStr(r['work_title'])    || safeStr(filmObj?.['title'])    || safeStr(r['film']) || '';
  const work_year     = safeStr(r['work_year'])     || safeStr(filmObj?.['year'])     || '';
  const work_director = safeStr(r['work_director']) || '';
  const work_genre    = safeStr(r['work_genre'])    || '';
  const rating        = safeNum(r['rating'])        || safeNum(filmObj?.['rating'])   || 0;
  const image_url     = safeStr(r['image_url'])     || safeStr(filmObj?.['poster'])   || '';
  const tags          = safeArr(r['tags']);
  const rawTone       = safeStr(r['tone']);
  const tone: Tone    = (TONE_KEYS as readonly string[]).includes(rawTone)
    ? (rawTone as Tone) : 'analyse';

  return {
    id:           safeStr(r['id']),
    userId:       safeStr(r['userId']   ?? r['user_id']),
    userName:     safeStr(r['userName'] ?? r['author_name']) || 'Anonyme',
    avatar:       safeStr(r['avatar']   ?? r['author_avatar']) || `https://i.pravatar.cc/100?u=${safeStr(r['id'])}`,
    timeAgo:      safeStr(r['timeAgo']),
    content:      safeStr(r['content']  ?? r['body']),
    likes:        safeNum(r['likes_count'] ?? r['likes']),
    comments:     safeNum(r['comments']),
    work_title, work_year, work_director, work_genre,
    rating, image_url, tags, tone,
    shares_count: safeNum(r['shares_count']),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const ct  = res.headers.get('content-type') ?? '';
    return res.ok && ct.startsWith('image/');
  } catch { return false; }
}

async function uploadImageToSupabase(localUri: string): Promise<string | null> {
  try {
    // 1. Correction de l'extension pour les URIs "blob:"
    const isBlob = localUri.startsWith('blob:');
    const ext = isBlob ? 'jpg' : (localUri.split('.').pop() ?? 'jpg');
    const filename = `post_${Date.now()}.${ext}`;
    
    // 2. Utilisation d'ArrayBuffer
    const response = await fetch(localUri);
    const arrayBuffer = await response.arrayBuffer();
    
    const { data, error } = await supabase.storage
      .from('community-images')
      .upload(`posts/${filename}`, arrayBuffer, { contentType: `image/${ext}`, upsert: false });
      
    if (error) throw error;
    return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;
  } catch (e) { 
    console.error('[upload]', e); 
    return null; 
  }
}

async function dbToggleLike(postId: string, userId: string, wasLiked: boolean) {
  if (wasLiked) {
    await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  }
}

async function dbRecordShare(postId: string, userId: string, platform: string) {
  await supabase.from('post_shares').insert({ post_id: postId, user_id: userId, platform });
}

async function dbToggleSave(postId: string, userId: string, wasSaved: boolean) {
  if (wasSaved) {
    await supabase.from('post_saves').delete().match({ post_id: postId, user_id: userId });
  } else {
    await supabase.from('post_saves').insert({ post_id: postId, user_id: userId });
  }
}

async function dbPublishPost(payload: {
  user_id: string; work_title: string; work_year: string;
  work_director: string; work_genre: string; rating: number;
  body: string; image_url: string; image_valid: boolean;
  tags: string[]; tone: Tone;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('community_posts').insert(payload).select('id').single();
  if (error) { console.error('[publish]', error); return null; }
  return (data as { id: string }).id;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface InteractionCtxType {
  liked:      Record<string, boolean>;
  saved:      Record<string, boolean>;
  toggleLike: (postId: string) => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  sharePost:  (postId: string, title: string) => Promise<void>;
}
const InteractionCtx = createContext<InteractionCtxType>({
  liked: {}, saved: {},
  toggleLike: async () => {},
  toggleSave: async () => {},
  sharePost:  async () => {},
});

function InteractionProvider({ children }: { children: React.ReactNode }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const toggleLike = useCallback(async (postId: string) => {
    const was = !!liked[postId];
    setLiked(p => ({ ...p, [postId]: !was }));
    try { await dbToggleLike(postId, MOCK_UID, was); }
    catch { setLiked(p => ({ ...p, [postId]: was })); }
  }, [liked]);

  const toggleSave = useCallback(async (postId: string) => {
    const was = !!saved[postId];
    setSaved(p => ({ ...p, [postId]: !was }));
    try { await dbToggleSave(postId, MOCK_UID, was); }
    catch { setSaved(p => ({ ...p, [postId]: was })); }
  }, [saved]);

  const sharePost = useCallback(async (postId: string, title: string) => {
    try {
      const result = await Share.share({ message: `Decouvrez cette critique de "${title}" sur l'app !` });
      if (result.action === Share.sharedAction) {
        await dbRecordShare(postId, MOCK_UID, result.activityType ?? 'unknown');
      }
    } catch (e) { console.error('[share]', e); }
  }, []);

  return (
    <InteractionCtx.Provider value={{ liked, saved, toggleLike, toggleSave, sharePost }}>
      {children}
    </InteractionCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────
const StarRating = memo(function StarRating({
  value, onChange, size = 28,
}: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => {
        const filled = value >= s;
        const half   = !filled && value >= s - 0.5;
        return (
          <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange} hitSlop={6}>
            <Ionicons
              name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
              size={size}
              color={filled || half ? C.gold : C.textTert}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL  —  4 etapes, validation stricte, image obligatoire
// ─────────────────────────────────────────────────────────────────────────────
interface ComposeState {
  workTitle: string; workYear: string; workDirector: string; workGenre: string;
  rating: number; tone: Tone | null; body: string; tags: string[];
  imageUri: string; imageUrl: string; imageValid: boolean;
}
const INIT_COMPOSE: ComposeState = {
  workTitle: '', workYear: '', workDirector: '', workGenre: '',
  rating: 0, tone: null, body: '', tags: [],
  imageUri: '', imageUrl: '', imageValid: false,
};
type ComposeStep = 'film' | 'critique' | 'media' | 'preview';
const STEPS: ComposeStep[] = ['film', 'critique', 'media', 'preview'];
const STEP_LABELS: Record<ComposeStep, string> = {
  film: "L'Oeuvre", critique: 'Votre Critique', media: 'Illustration', preview: 'Apercu final',
};

function ComposeModal({ visible, onClose, onPublished }: {
  visible: boolean; onClose: () => void; onPublished?: () => void;
}) {
  const [step,       setStep]      = useState<ComposeStep>('film');
  const [form,       setForm]      = useState<ComposeState>(INIT_COMPOSE);
  const [publishing, setPublishing]= useState(false);
  const [imgLoading, setImgLoad]   = useState(false);
  const [manualUrl,  setManualUrl] = useState('');
  const [errors,     setErrors]    = useState<Partial<Record<ComposeStep, string>>>({});

  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setStep('film'); setForm(INIT_COMPOSE); setErrors({});
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const patch = useCallback(<K extends keyof ComposeState>(key: K, val: ComposeState[K]) => {
    setForm(f => ({ ...f, [key]: val }));
  }, []);

  const setErr = useCallback((s: ComposeStep, msg: string) =>
    setErrors(e => ({ ...e, [s]: msg })), []);
  const clrErr = useCallback((s: ComposeStep) =>
    setErrors(e => ({ ...e, [s]: '' })), []);

  // Validation par etape
  const validate = useCallback((s: ComposeStep): string | null => {
    if (s === 'film') {
      if (!form.workTitle.trim()) return "Le titre de l'oeuvre est obligatoire.";
      if (!form.workGenre)        return 'Selectionnez un genre.';
      if (form.rating === 0)      return 'Attribuez au moins une etoile.';
    }
    if (s === 'critique') {
      if (!form.tone)                         return 'Choisissez un ton.';
      if (form.body.trim().length < MIN_BODY) return `Minimum ${MIN_BODY} caracteres (actuel : ${form.body.trim().length}).`;
    }
  
    return null;
  }, [form]);

  const goNext = useCallback(() => {
    const err = validate(step);
    if (err) { setErr(step, err); return; }
    clrErr(step);
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step, validate, setErr, clrErr]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  // Image depuis galerie
  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorisez l'acces a votre galerie dans les reglages.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85,
      allowsEditing: true, aspect: [16, 9],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    patch('imageUri', uri); patch('imageValid', false);
    setImgLoad(true); clrErr('media');
    const publicUrl = await uploadImageToSupabase(uri);
    if (!publicUrl) { setErr('media', "L'upload a echoue."); setImgLoad(false); return; }
    const valid = await validateImageUrl(publicUrl);
    if (!valid)    { setErr('media', 'Image inaccessible apres upload.'); setImgLoad(false); return; }
    patch('imageUrl', publicUrl); patch('imageValid', true);
    setImgLoad(false);
  }, [patch, clrErr, setErr]);

  
  // Publication
  const publish = useCallback(async () => {
    if (!form.imageValid) { Alert.alert('Image manquante', 'Une image valide est obligatoire.'); return; }
    if (!form.tone)       { Alert.alert('Ton manquant',   'Choisissez un ton de critique.'); return; }
    setPublishing(true);
    const id = await dbPublishPost({
      user_id: MOCK_UID, work_title: form.workTitle.trim(), work_year: form.workYear.trim(),
      work_director: form.workDirector.trim(), work_genre: form.workGenre, rating: form.rating,
      body: form.body.trim(), image_url: form.imageUrl, image_valid: true, tags: form.tags, tone: form.tone,
    });
    setPublishing(false);
    if (id) { onPublished?.(); onClose(); }
    else Alert.alert('Erreur', 'Publication echouee. Reessayez.');
  }, [form, onClose, onPublished]);

  const stepIdx    = STEPS.indexOf(step);
  const toneInfo   = TONES.find(t => t.key === form.tone);
  const bodyLen    = form.body.trim().length;
  const bodyPct    = Math.min(100, (bodyLen / MIN_BODY) * 100);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={cm.kav}>
          <Animated.View style={[cm.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={cm.inner}>

              {/* Handle */}
              <View style={cm.handle} />

              {/* Header */}
              <View style={cm.topRow}>
                <View>
                  <Text style={cm.modalTitle}>Nouvelle Critique</Text>
                  <Text style={cm.modalSub}>Cinema independant · Critique constructive</Text>
                </View>
                <TouchableOpacity style={cm.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>

              {/* Progress */}
              <View style={cm.progressRow}>
                {STEPS.map((s, i) => (
                  <View key={s} style={[cm.progressBar, i <= stepIdx && { backgroundColor: C.violet }]} />
                ))}
              </View>
              <Text style={cm.stepHint}>
                {`Etape ${stepIdx + 1}/${STEPS.length} — ${STEP_LABELS[step]}`}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={cm.scroll}>

                {/* ══ FILM ══════════════════════════════════════════════════ */}
                {step === 'film' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Identifiez l'oeuvre</Text>
                    <Text style={cm.hint}>Seules les oeuvres de cinema independant sont acceptees.</Text>

                    <View style={cm.field}>
                      <Text style={cm.label}>TITRE *</Text>
                      <TextInput
                        style={cm.input} placeholderTextColor={C.textTert}
                        placeholder="Ex : Portrait de la jeune fille en feu"
                        value={form.workTitle}
                        onChangeText={v => { patch('workTitle', v); clrErr('film'); }}
                      />
                    </View>

                    <View style={cm.row2}>
                      <View style={[cm.field, { flex: 1 }]}>
                        <Text style={cm.label}>REALISATEUR</Text>
                        <TextInput style={cm.input} placeholder="Nom" placeholderTextColor={C.textTert} value={form.workDirector} onChangeText={v => patch('workDirector', v)} />
                      </View>
                      <View style={[cm.field, { width: 82 }]}>
                        <Text style={cm.label}>ANNEE</Text>
                        <TextInput style={cm.input} placeholder="2024" placeholderTextColor={C.textTert} value={form.workYear} onChangeText={v => patch('workYear', v)} keyboardType="numeric" maxLength={4} />
                      </View>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>GENRE *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cm.chipRow}>
                        {GENRES_LIST.map(g => {
                          const on = form.workGenre === g;
                          return (
                            <TouchableOpacity key={g} style={[cm.chip, on && cm.chipOn]}
                              onPress={() => { patch('workGenre', g); clrErr('film'); }}>
                              <Text style={[cm.chipTxt, on && { color: C.violet }]}>{g}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>NOTE *</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <StarRating value={form.rating} onChange={v => { patch('rating', v); clrErr('film'); }} />
                        <Text style={{ color: C.gold, fontSize: 15, fontWeight: '700' }}>
                          {form.rating > 0 ? `${form.rating}/5` : '--'}
                        </Text>
                      </View>
                    </View>

                    {errors.film ? <Text style={cm.errTxt}>{errors.film}</Text> : null}
                  </View>
                )}

                {/* ══ CRITIQUE ══════════════════════════════════════════════ */}
                {step === 'critique' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Redigez votre critique</Text>
                    <Text style={cm.hint}>Minimum {MIN_BODY} caracteres. Argumentez et nuancez votre point de vue.</Text>

                    <View style={cm.field}>
                      <Text style={cm.label}>TON DE LA CRITIQUE *</Text>
                      <View style={cm.toneGrid}>
                        {TONES.map(t => {
                          const on = form.tone === t.key;
                          return (
                            <TouchableOpacity key={t.key}
                              style={[cm.toneCard, on && { borderColor: t.color, backgroundColor: `${t.color}18` }]}
                              onPress={() => { patch('tone', t.key); clrErr('critique'); }}>
                              <Ionicons name={t.icon as any} size={22} color={on ? t.color : C.textTert} />
                              <Text style={[cm.toneLbl, on && { color: t.color }]}>{t.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>CRITIQUE *</Text>
                      <TextInput
                        style={cm.textarea} multiline textAlignVertical="top"
                        placeholder="Analysez la mise en scene, le jeu des acteurs, la narration..."
                        placeholderTextColor={C.textTert}
                        value={form.body}
                        onChangeText={v => { patch('body', v); clrErr('critique'); }}
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <View style={cm.charBg}>
                          <View style={[cm.charFill, {
                            width: `${bodyPct}%` as any,
                            backgroundColor: bodyLen >= MIN_BODY ? C.green : C.violet,
                          }]} />
                        </View>
                        <Text style={[cm.charCount, bodyLen >= MIN_BODY && { color: C.green }]}>
                          {bodyLen}/{MIN_BODY}
                        </Text>
                      </View>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>ASPECTS ABORDES (optionnel)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cm.chipRow}>
                        {['Photographie', 'Musique', 'Scenario', 'Montage', 'Interpretation', 'Rythme', 'Atmosphere', 'Decors'].map(tag => {
                          const on = form.tags.includes(tag);
                          return (
                            <TouchableOpacity key={tag}
                              style={[cm.chip, on && { borderColor: C.teal, backgroundColor: 'rgba(90,200,250,0.12)' }]}
                              onPress={() => patch('tags', on ? form.tags.filter(t => t !== tag) : [...form.tags, tag])}>
                              <Text style={[cm.chipTxt, on && { color: C.teal }]}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {errors.critique ? <Text style={cm.errTxt}>{errors.critique}</Text> : null}
                  </View>
                )}

                {/* ══ MEDIA ═════════════════════════════════════════════════ */}
                {step === 'media' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Illustration obligatoire</Text>
                    <Text style={cm.hint}>Chaque critique necessite une image de l'oeuvre, verifiee avant publication.</Text>

                    {form.imageUri ? (
                      <View style={cm.imgWrap}>
                        <Image source={{ uri: form.imageUri }} style={cm.imgPreview} resizeMode="cover" />
                        {form.imageValid && (
                          <View style={cm.validBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={C.green} />
                            <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>Image validee</Text>
                          </View>
                        )}
                        {imgLoading && (
                          <View style={cm.imgLoader}>
                            <ActivityIndicator color={C.violet} />
                            <Text style={{ color: 'white', fontSize: 13, marginTop: 6 }}>Validation...</Text>
                          </View>
                        )}
                
                      </View>
                    ) : (
                      <TouchableOpacity style={cm.pickBtn} onPress={pickImage} disabled={imgLoading}>
                        <LinearGradient colors={[C.violetDim, 'transparent']} style={StyleSheet.absoluteFill} />
                        <Ionicons name="image-outline" size={42} color={C.violet} />
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>Selectionner depuis la galerie</Text>
                        <Text style={{ color: C.textTert, fontSize: 12 }}>JPEG / PNG  16:9 recommande</Text>
                      </TouchableOpacity>
                    )}

                    

                    {errors.media ? <Text style={cm.errTxt}>{errors.media}</Text> : null}
                  </View>
                )}

                {/* ══ PREVIEW ═══════════════════════════════════════════════ */}
                {step === 'preview' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Apercu avant publication</Text>

                    <View style={cm.previewCard}>
                      {form.imageUrl ? (
                        <Image source={{ uri: form.imageUrl }} style={cm.previewImg} resizeMode="cover" />
                      ) : null}
                      <LinearGradient colors={['transparent', 'rgba(7,0,15,0.9)']} style={StyleSheet.absoluteFillObject} />
                      <View style={cm.previewOverlay}>
                        {toneInfo ? (
                          <View style={[cm.tonePill, { backgroundColor: `${toneInfo.color}28` }]}>
                            <Text style={[cm.tonePillTxt, { color: toneInfo.color }]}>
                              {toneInfo.label.toUpperCase()}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={cm.previewTitle}>{form.workTitle}</Text>
                        <Text style={cm.previewMeta}>
                          {[form.workDirector, form.workYear, form.workGenre].filter(Boolean).join(' · ')}
                        </Text>
                        <StarRating value={form.rating} size={14} />
                      </View>
                    </View>

                    <View style={{ backgroundColor: C.surf, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                      <Text style={{ color: C.textSec, fontSize: 14, lineHeight: 21 }} numberOfLines={5}>
                        {form.body}
                      </Text>
                    </View>

                    {form.tags.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {form.tags.map(tag => (
                          <Text key={tag} style={{ color: C.teal, fontSize: 11, fontWeight: '600' }}>
                            {'#'}{tag}
                          </Text>
                        ))}
                      </View>
                    )}

                    <View style={{ gap: 8 }}>
                      {([
                        { ok: form.workTitle.trim().length > 0,   txt: 'Oeuvre identifiee' },
                        { ok: form.rating > 0,                     txt: 'Note attribuee' },
                        { ok: form.tone !== null,                  txt: 'Ton defini' },
                        { ok: bodyLen >= MIN_BODY,                 txt: `Critique >= ${MIN_BODY} caracteres` },
                        { ok: form.imageValid,                     txt: 'Image validee' },
                      ]).map(item => (
                        <View key={item.txt} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons
                            name={item.ok ? 'checkmark-circle' : 'close-circle'}
                            size={16} color={item.ok ? C.green : C.red}
                          />
                          <Text style={{ color: item.ok ? C.textSec : C.red, fontSize: 13 }}>
                            {item.txt}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Footer */}
              <View style={cm.footer}>
                {stepIdx > 0 && (
                  <TouchableOpacity style={cm.backBtn} onPress={goBack}>
                    <Ionicons name="chevron-back" size={18} color={C.textSec} />
                    <Text style={{ color: C.textSec, fontSize: 14, fontWeight: '600' }}>Retour</Text>
                  </TouchableOpacity>
                )}
                {step !== 'preview' ? (
                  <TouchableOpacity
                    style={[cm.nextBtn, stepIdx === 0 && { marginLeft: 'auto' as any }]}
                    onPress={goNext}>
                    <LinearGradient colors={[C.violet, '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cm.btnGrad}>
                      <Text style={cm.btnTxt}>Continuer</Text>
                      <Ionicons name="chevron-forward" size={16} color="white" />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[cm.nextBtn, publishing && { opacity: 0.6 }]} onPress={publish} disabled={publishing}>
                    <LinearGradient colors={['#C060FF', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cm.btnGrad}>
                      {publishing
                        ? <ActivityIndicator color="white" size="small" />
                        : (
                          <>
                            <Ionicons name="send" size={16} color="white" />
                            <Text style={cm.btnTxt}>Publier la critique</Text>
                          </>
                        )
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  kav:        { flex: 1, justifyContent: 'flex-end' },
  sheet:      { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  inner:      { flex: 1 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.textTert, alignSelf: 'center', marginTop: 12 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  modalSub:   { color: C.textTert, fontSize: 12, marginTop: 2 },
  closeBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  progressRow:{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 6 },
  progressBar:{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.surf },
  stepHint:   { color: C.textTert, fontSize: 11, fontWeight: '600', paddingHorizontal: 20, marginBottom: 16 },
  scroll:     { flex: 1 },
  stepWrap:   { paddingHorizontal: 20 },
  sectionHead:{ color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  hint:       { color: C.textTert, fontSize: 12, lineHeight: 17, marginBottom: 20, fontStyle: 'italic' },
  field:      { marginBottom: 20 },
  label:      { color: C.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  input:      { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  textarea:   { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 14, minHeight: 140, lineHeight: 22 },
  row2:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chipRow:    { gap: 8, paddingVertical: 4 },
  chip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:     { borderColor: C.violet, backgroundColor: C.violetDim },
  chipTxt:    { color: C.textSec, fontSize: 13, fontWeight: '600' },
  toneGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toneCard:   { width: (W - 40 - 10) / 2, paddingVertical: 14, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 6 },
  toneLbl:    { color: C.textSec, fontSize: 13, fontWeight: '600' },
  charBg:     { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.surf, overflow: 'hidden' },
  charFill:   { height: '100%', borderRadius: 2 },
  charCount:  { color: C.textTert, fontSize: 11, fontWeight: '600', minWidth: 50, textAlign: 'right' },
  pickBtn:    { height: 180, borderRadius: 16, borderWidth: 1.5, borderColor: C.borderHi, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', marginBottom: 20 },
  imgWrap:    { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  imgPreview: { width: '100%', height: '100%' },
  validBadge: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  imgLoader:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  removeImg:  { position: 'absolute', top: 8, right: 8 },
  urlBtn:     { paddingHorizontal: 16, borderRadius: 10, backgroundColor: C.violet, justifyContent: 'center' },
  errTxt:     { color: C.red, fontSize: 12, marginBottom: 12 },
  previewCard:{ height: 200, borderRadius: 18, overflow: 'hidden', marginBottom: 16, backgroundColor: C.surf },
  previewImg: { width: '100%', height: '100%' },
  previewOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  previewTitle:  { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  previewMeta:   { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 },
  tonePill:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  tonePillTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  footer:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 12 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 12 },
  nextBtn:    { flex: 1, borderRadius: 22, overflow: 'hidden' },
  btnGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnTxt:     { color: 'white', fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE BAR  (sophistiquee)
// ─────────────────────────────────────────────────────────────────────────────
const ComposeBar = memo(function ComposeBar({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={cbar.wrap} onPress={onPress} activeOpacity={0.88}>

      <View style={cbar.topBorder} />
      <Image source={{ uri: 'https://i.pravatar.cc/100?u=me' }} style={cbar.avi} />
      <View style={cbar.body}>
        <Text style={cbar.title}>Partagez votre critique</Text>
        <Text style={cbar.sub}>Analyse · Coup de coeur · Reflexion · Deception</Text>
        <View style={cbar.pills}>
          <View style={[cbar.pill, { backgroundColor: `${C.violet}18`, borderColor: `${C.violet}30` }]}>
            <Ionicons name="film-outline"  size={11} color={C.violet} />
            <Text style={[cbar.pillTxt, { color: C.violet }]}>Oeuvre</Text>
          </View>
          <View style={[cbar.pill, { backgroundColor: `${C.gold}18`, borderColor: `${C.gold}30` }]}>
            <Ionicons name="star-outline"  size={11} color={C.gold} />
            <Text style={[cbar.pillTxt, { color: C.gold }]}>Note</Text>
          </View>
          <View style={[cbar.pill, { backgroundColor: `${C.teal}18`, borderColor: `${C.teal}30` }]}>
            <Ionicons name="image-outline" size={11} color={C.teal} />
            <Text style={[cbar.pillTxt, { color: C.teal }]}>Visuel</Text>
          </View>
          <View style={cbar.pill}>
            <Text style={cbar.pillTxt}>obligatoires</Text>
          </View>
        </View>
      </View>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
          <Ionicons name="create" size={25} color="white" />
      </View>
    </TouchableOpacity>
  );
});

const cbar = StyleSheet.create({
  wrap:      { marginHorizontal: EDGE, marginBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: C.borderHi, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, overflow: 'hidden' },
  topBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0, 0, 0, 0)' },
  avi:       { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.borderHi },
  body:      { flex: 1, gap: 3 },
  title:     { color: C.text, fontSize: 14, fontWeight: '700' },
  sub:       { color: C.textTert, fontSize: 11, fontStyle: 'italic' },
  pills:     { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  pillTxt:   { color: C.textTert, fontSize: 10, fontWeight: '600' },
  cta:       { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD  (consomme NormalizedPost — zero objet brut rendu)
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = memo(function PostCard({ raw }: { raw: PostData }) {
  const router = useRouter();
  const { liked, saved, toggleLike, toggleSave, sharePost } = useContext(InteractionCtx);

  // Normalisation : garantit que AUCUNE valeur n'est un objet
  const post: NormalizedPost = useMemo(() => normalizePost(raw), [raw]);

  const isLiked = !!liked[post.id];
  const isSaved = !!saved[post.id];

  const likeScale = useRef(new Animated.Value(1)).current;
  const onLike = useCallback(async () => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(likeScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    await toggleLike(post.id);
  }, [post.id, toggleLike]);

  const toneInfo = TONES.find(t => t.key === post.tone) ?? TONES[0];

  // Primitives garanties — aucun objet ne peut etre rendu directement
  const titleStr    = post.work_title    || 'Oeuvre inconnue';
  const dirStr      = post.work_director;
  const yearStr     = post.work_year;
  const genreStr    = post.work_genre;
  const contentStr  = post.content       || '';
  const userNameStr = post.userName      || 'Anonyme';
  const timeAgoStr  = post.timeAgo       || '';
  const likesStr    = String(post.likes + (isLiked ? 1 : 0));
  const commentsStr = String(post.comments);
  const sharesStr   = String(post.shares_count);
  const metaStr     = [dirStr, yearStr].filter(Boolean).join(' · ');
  const imgSrc      = post.image_url
    ? { uri: post.image_url }
    : { uri: `https://picsum.photos/seed/${post.id}/800/450` };
  const aviSrc      = { uri: post.avatar };
  const filmHref    = `/film/${post.id}` as const;

  return (
    <View style={pcs.card}>

      {/* Image */}
      <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(filmHref)}>
        <Image source={imgSrc} style={pcs.img} />
        <LinearGradient colors={['transparent', 'rgba(7,0,15,0.88)']} style={pcs.imgGrad} />
        <View style={[pcs.toneBadge, { backgroundColor: `${toneInfo.color}28`, borderColor: `${toneInfo.color}50` }]}>
          <Ionicons name={toneInfo.icon as any} size={11} color={toneInfo.color} />
          <Text style={[pcs.toneBadgeTxt, { color: toneInfo.color }]}>{toneInfo.label}</Text>
        </View>
        <View style={pcs.filmOverlay}>
          <Text style={pcs.filmTitle} numberOfLines={1}>{titleStr}</Text>
          {metaStr.length > 0 && (
            <Text style={pcs.filmMeta}>{metaStr}</Text>
          )}
          <StarRating value={post.rating} size={12} />
        </View>
      </TouchableOpacity>

      {/* Body */}
      <View style={pcs.body}>

        <View style={pcs.authorRow}>
          <Image source={aviSrc} style={pcs.avi} />
          <View style={{ flex: 1 }}>
            <Text style={pcs.authorName}>{userNameStr}</Text>
            <Text style={pcs.authorTime}>{timeAgoStr}</Text>
          </View>
          {genreStr.length > 0 && (
            <View style={pcs.genrePill}>
              <Text style={pcs.genrePillTxt}>{genreStr}</Text>
            </View>
          )}
        </View>

        <Text style={pcs.body2} numberOfLines={4}>{contentStr}</Text>

        {post.tags.length > 0 && (
          <View style={pcs.tagRow}>
            {post.tags.slice(0, 3).map(tag => (
              <Text key={tag} style={pcs.tag}>{'#'}{tag}</Text>
            ))}
          </View>
        )}

        <View style={pcs.actions}>
          <TouchableOpacity style={pcs.action} onPress={onLike} activeOpacity={0.75}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? C.red : C.textSec} />
            </Animated.View>
            <Text style={[pcs.actionTxt, isLiked && { color: C.red }]}>{likesStr}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={pcs.action} onPress={() => router.push(filmHref)} activeOpacity={0.75}>
            <Ionicons name="chatbubble-outline" size={18} color={C.textSec} />
            <Text style={pcs.actionTxt}>{commentsStr}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={pcs.action} onPress={() => sharePost(post.id, titleStr)} activeOpacity={0.75}>
            <Ionicons name="share-outline" size={20} color={C.textSec} />
            <Text style={pcs.actionTxt}>{sharesStr}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={pcs.iconBtn} onPress={() => router.push(filmHref)}>
            <Ionicons name="information-circle-outline" size={22} color={C.textSec} />
          </TouchableOpacity>

          <TouchableOpacity style={pcs.iconBtn} onPress={() => toggleSave(post.id)}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? C.violet : C.textSec} />
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
});

const pcs = StyleSheet.create({
  card:        { marginHorizontal: EDGE, marginBottom: 22, borderRadius: 20, overflow: 'hidden', backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  img:         { width: '100%', height: 210 },
  imgGrad:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  toneBadge:   { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  toneBadgeTxt:{ fontSize: 10, fontWeight: '700' },
  filmOverlay: { position: 'absolute', bottom: 12, left: 14, right: 14 },
  filmTitle:   { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  filmMeta:    { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 },
  body:        { padding: 14 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avi:         { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  authorName:  { color: C.text, fontSize: 14, fontWeight: '700' },
  authorTime:  { color: C.textTert, fontSize: 11, marginTop: 1 },
  genrePill:   { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: C.violetSoft, borderWidth: 1, borderColor: C.borderHi },
  genrePillTxt:{ color: C.violet, fontSize: 10, fontWeight: '700' },
  body2:       { color: C.textSec, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tagRow:      { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  tag:         { color: C.teal, fontSize: 11, fontWeight: '600' },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  action:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf },
  actionTxt:   { color: C.textSec, fontSize: 12, fontWeight: '600' },
  iconBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surf },
});

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SocialHeader = memo(function SocialHeader({ onCompose }: { onCompose: () => void }) {
  const router = useRouter();
  return (
    <View style={hdr.row}>
      <View>
        <Text style={hdr.title}>Communauté</Text>
        <Text style={hdr.sub}>Le QG du cinema independant</Text>
      </View>
      <View style={hdr.actions}>
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={20} color="white" />
          <View style={hdr.dot} />
        </TouchableOpacity>
    
      </View>
    </View>
  );
});
const hdr = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 10, paddingBottom: 16 },
  title:     { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  sub:       { fontSize: 12, color: C.textTert, marginTop: 2 },
  actions:   { flexDirection: 'row', gap: 10 },
  btn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  composeBtn:{ backgroundColor: C.violetDim, borderColor: C.borderHi },
  dot:       { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────
const FilterTabs = memo(function FilterTabs({ active, set }: { active: FeedTab; set: (t: FeedTab) => void }) {
  return (
    <View style={ft.row}>
      {FEED_TABS.map(t => {
        const on = active === t;
        return (
          <TouchableOpacity key={t} onPress={() => set(t)} style={ft.pill} activeOpacity={0.8}>
            <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
            {on && (
              <LinearGradient colors={[C.violet, C.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ft.line} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const ft = StyleSheet.create({
  row:  { flexDirection: 'row', paddingHorizontal: EDGE, gap: 24, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  pill: { paddingBottom: 14, alignItems: 'center', position: 'relative' },
  txt:  { color: C.textTert, fontSize: 15, fontWeight: '600' },
  txtOn:{ color: C.text,     fontWeight: '800' },
  line: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEED BODY
// ─────────────────────────────────────────────────────────────────────────────
function FeedBody() {
  const { posts } = useSocial();
  const [tab,         setTab]         = useState<FeedTab>('Pour vous');
  const [refreshing,  setRefreshing]  = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const filtered = useMemo(
    () => posts.filter(TAB_FILTER[tab] ?? (() => true)),
    [posts, tab],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)} />
      <View style={{ height: 14 }} />
      <ComposeBar onPress={() => setComposeOpen(true)} />
      <View style={{ height: 6 }} />
      <FilterTabs active={tab} set={setTab} />
    </>
  ), [tab]);

  const renderItem = useCallback(({ item }: { item: PostData }) => (
    <PostCard key={item.id} raw={item} />
  ), []);

  const keyExtractor = useCallback((item: PostData) => String(item.id), []);

  return (
    <>
      <ComposeModal
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPublished={onRefresh}
      />
      <Animated.FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          refreshing ? null : (
            <View style={{ alignItems: 'center', paddingVertical: 70, gap: 14 }}>
              <Ionicons name="film-outline" size={52} color={C.textTert} />
              <Text style={{ color: C.textTert, fontSize: 15 }}>Aucune critique dans cet onglet</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.violet} colors={[C.violet]} />
        }
        removeClippedSubviews
        windowSize={6}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={60}
        initialNumToRender={5}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ECRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  return (
    <SocialProvider>
      <InteractionProvider>
        <View style={{ flex: 1, backgroundColor: C.bg0 }}>
          <StatusBar style="light" />
          <GalaxyBackground />
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <FeedBody />
          </SafeAreaView>
        </View>
      </InteractionProvider>
    </SocialProvider>
  );
}