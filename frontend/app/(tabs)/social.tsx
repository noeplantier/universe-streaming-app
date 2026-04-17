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
import * as FileSystem    from 'expo-file-system';
import { decode }         from 'base64-arraybuffer';

import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: W } = Dimensions.get('window');
const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — NAVY + WHITE, zéro violet
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // Fonds
  bg0:        '#020810',            // noir naval absolu
  bg1:        '#060F1E',            // navy ultra-profond
  bg2:        '#0A1830',            // navy sombre

  // Surfaces
  surf:       'rgba(13,34,64,0.55)',  // navyMid translucide
  surfHi:     'rgba(13,34,64,0.80)',  // navyMid plus dense
  surfWhite:  'rgba(255,255,255,0.05)',

  // Bordures
  border:     'rgba(255,255,255,0.07)',
  borderHi:   'rgba(255,255,255,0.15)',
  borderBlue: 'rgba(90,150,230,0.22)',

  // Texte
  text:       '#EEF4FF',            // blanc bleuté — texte principal
  textSec:    '#7A99BE',            // bleu-gris moyen
  textTert:   '#2E4A68',            // navy sombre — placeholders

  // Accent bleu clair (ex-teal, remplacé par bleu pur)
  blue:       '#5A96E6',
  blueDim:    'rgba(90,150,230,0.13)',
  blueSoft:   'rgba(90,150,230,0.07)',
  blueMid:    'rgba(90,150,230,0.22)',

  // Navy mid — couleur principale de surface et d'accent
  navy:       '#0A1628',
  navyMid:    '#0D2240',
  navyLight:  '#163356',
  navyBright: '#1E4A7A',            // navy interactif

  // Fonctionnel
  gold:       '#F5C842',            // étoiles uniquement
  goldDim:    'rgba(245,200,66,0.12)',
  green:      '#2ECC8A',
  greenDim:   'rgba(46,204,138,0.14)',
  red:        '#FF3B5C',

  // Blanc pur
  white:      '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const TONE_KEYS = ['analyse', 'coup de coeur', 'deception', 'reflexion'] as const;
type Tone = typeof TONE_KEYS[number];

const TONES: { key: Tone; label: string; icon: string; color: string }[] = [
  { key: 'analyse',       label: 'Analyse',      icon: 'flask-outline',        color: C.blue     },
  { key: 'coup de coeur', label: 'Coup de cœur', icon: 'heart-outline',        color: C.red      },
  { key: 'deception',     label: 'Déception',    icon: 'thunderstorm-outline', color: C.gold     },
  { key: 'reflexion',     label: 'Réflexion',    icon: 'bulb-outline',         color: '#A8C8F0'  },
];

const GENRES_LIST = [
  'Drame', 'Thriller', 'Sci-Fi', 'Documentaire',
  'Animation', 'Court métrage', 'Expérimental', 'Biopic',
] as const;

const ASPECTS = [
  'Photographie', 'Musique', 'Scénario', 'Montage',
  'Interprétation', 'Rythme', 'Atmosphère', 'Décors',
];

const FEED_TABS = ['Pour vous', 'Tendances', 'Abonnements'] as const;
type FeedTab = typeof FEED_TABS[number];

const MIN_BODY    = 80;
const POSTS_LIMIT = 40;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SupabasePost {
  id:            string;
  user_id:       string;
  work_title:    string;
  work_year:     string;
  work_director: string;
  work_genre:    string;
  rating:        number;
  body:          string;
  image_url:     string;
  image_valid:   boolean;
  tags:          string[];
  tone:          string;
  likes_count:   number;
  shares_count:  number;
  created_at:    string;
  profiles?: { display_name: string; avatar_url: string } | null;
}

interface Post {
  id:            string;
  userId:        string;
  userName:      string;
  avatar:        string;
  timeAgo:       string;
  content:       string;
  likes:         number;
  shares:        number;
  work_title:    string;
  work_year:     string;
  work_director: string;
  work_genre:    string;
  rating:        number;
  image_url:     string;
  tags:          string[];
  tone:          Tone;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

function mapPost(r: SupabasePost): Post {
  const tone: Tone = (TONE_KEYS as readonly string[]).includes(r.tone)
    ? (r.tone as Tone) : 'analyse';
  return {
    id:            r.id,
    userId:        r.user_id,
    userName:      r.profiles?.display_name ?? 'Cinéphile',
    avatar:        r.profiles?.avatar_url   ?? `https://i.pravatar.cc/100?u=${r.user_id}`,
    timeAgo:       timeAgo(r.created_at),
    content:       r.body           ?? '',
    likes:         r.likes_count    ?? 0,
    shares:        r.shares_count   ?? 0,
    work_title:    r.work_title     ?? '',
    work_year:     r.work_year      ?? '',
    work_director: r.work_director  ?? '',
    work_genre:    r.work_genre     ?? '',
    rating:        r.rating         ?? 0,
    image_url:     r.image_url      ?? '',
    tags:          Array.isArray(r.tags) ? r.tags : [],
    tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadImageToSupabase(localUri: string): Promise<string | null> {
  try {
    const isBlob  = localUri.startsWith('blob:');
    const rawExt  = isBlob ? 'jpg' : (localUri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext     = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime    = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const filename = `post_${Date.now()}.${ext}`;

    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      const res = await fetch(localUri);
      payload   = await res.arrayBuffer();
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      payload = decode(base64);
    }

    const { data, error } = await supabase.storage
      .from('community-images')
      .upload(`posts/${filename}`, payload, { contentType: mime, upsert: false });

    if (error) throw error;
    return supabase.storage
      .from('community-images')
      .getPublicUrl(data.path).data.publicUrl;
  } catch (e) {
    console.error('[uploadImage]', e);
    return null;
  }
}

async function dbToggleLike(postId: string, userId: string, wasLiked: boolean) {
  if (wasLiked) {
    await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
    await supabase.rpc('decrement_likes', { pid: postId });
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    await supabase.rpc('increment_likes', { pid: postId });
  }
}

async function dbRecordShare(postId: string, userId: string, platform: string) {
  await supabase.from('post_shares').insert({ post_id: postId, user_id: userId, platform });
}

async function dbPublishPost(payload: Omit<{
  user_id: string; work_title: string; work_year: string;
  work_director: string; work_genre: string; rating: number;
  body: string; image_url: string; image_valid: boolean;
  tags: string[]; tone: Tone;
}, 'user_id'>): Promise<string | null> {
  const getOrCreateSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn('[publish] getSession error', error);
    if (data.session?.user?.id) return data.session;
    const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
    if (anonErr) throw anonErr;
    return anon.session;
  };

  let session: any;
  try { session = await getOrCreateSession(); }
  catch (e) { console.error('[publish] auth failed', e); return null; }

  const userId = session?.user?.id;
  if (!userId) { console.error('[publish] no session'); return null; }

  const { data, error } = await supabase
    .from('community_posts')
    .insert({ ...payload, user_id: userId })
    .select('id')
    .single();

  if (error) { console.error('[publish] insert error', error); return null; }
  return (data as { id: string }).id;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — Feed Supabase + temps réel
// ─────────────────────────────────────────────────────────────────────────────
function usePostsFeed(tab: FeedTab) {
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);

    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('community_posts_enriched')
          .select(
            'id, user_id, work_title, work_year, work_director, ' +
            'work_genre, rating, body, image_url, image_valid, ' +
            'tags, tone, likes_count, shares_count, created_at',
          )
          .order('created_at', { ascending: false })
          .limit(POSTS_LIMIT);

        if (cancelled) return;
        if (err) throw err;
        setPosts((Array.isArray(data) ? data : []).map(mapPost));
      } catch (e: any) {
        if (!cancelled) {
          console.warn('[PostsFeed]', e?.message ?? e);
          setError('Impossible de charger le feed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tab, refreshKey]);

  // Subscription INSERT temps réel
  useEffect(() => {
    const channel = supabase
      .channel('community_posts:inserts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        async (payload) => {
          const { data } = await supabase
            .from('community_posts')
            .select(
              'id, user_id, work_title, work_year, work_director, ' +
              'work_genre, rating, body, image_url, image_valid, ' +
              'tags, tone, likes_count, shares_count, created_at',
            )
            .eq('id', payload.new.id)
            .single();
          if (!data) return;
          const newPost = mapPost(data as SupabasePost);
          setPosts(prev => prev.some(p => p.id === newPost.id) ? prev : [newPost, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Like optimiste
  const toggleLike = useCallback(async (postId: string, userId: string, wasLiked: boolean) => {
    setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? -1 : 1) }));
    try {
      await dbToggleLike(postId, userId, wasLiked);
    } catch {
      setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? 1 : -1) }));
    }
  }, []);

  return { posts, loading, error, refresh, toggleLike };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface ICtx {
  liked:      Record<string, boolean>;
  toggleLike: (postId: string, userId: string) => void;
  sharePost:  (postId: string, title: string, userId: string) => Promise<void>;
}
const InteractionCtx = createContext<ICtx>({ liked: {}, toggleLike: () => {}, sharePost: async () => {} });

function InteractionProvider({
  children, onToggleLike,
}: { children: React.ReactNode; onToggleLike: (id: string, uid: string, was: boolean) => void }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const toggleLike = useCallback((postId: string, userId: string) => {
    const was = !!liked[postId];
    setLiked(p => ({ ...p, [postId]: !was }));
    onToggleLike(postId, userId, was);
  }, [liked, onToggleLike]);

  const sharePost = useCallback(async (postId: string, title: string, userId: string) => {
    try {
      const result = await Share.share({
        message: `Découvrez cette critique de "${title}" sur Universe App !`,
      });
      if (result.action === Share.sharedAction)
        await dbRecordShare(postId, userId, result.activityType ?? 'unknown');
    } catch (e) { console.error('[share]', e); }
  }, []);

  return (
    <InteractionCtx.Provider value={{ liked, toggleLike, sharePost }}>
      {children}
    </InteractionCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────
const StarRating = memo(function StarRating({
  value, onChange, size = 24,
}: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange} hitSlop={6}>
          <Ionicons
            name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={value >= s || value >= s - 0.5 ? C.gold : C.text}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL — 4 étapes
// ─────────────────────────────────────────────────────────────────────────────
interface ComposeState {
  workTitle: string; workYear: string; workDirector: string; workGenre: string;
  rating: number; tone: Tone | null; body: string; tags: string[];
  imageUri: string; imageUrl: string; imageValid: boolean;
}
const INIT: ComposeState = {
  workTitle: '', workYear: '', workDirector: '', workGenre: '',
  rating: 0, tone: null, body: '', tags: [],
  imageUri: '', imageUrl: '', imageValid: false,
};
type CStep = 'film' | 'critique' | 'media' | 'preview';
const CSTEPS: CStep[]              = ['film', 'critique', 'media', 'preview'];
const STEP_LBL: Record<CStep, string> = {
  film: "L'Œuvre", critique: 'Votre Critique', media: 'Illustration', preview: 'Aperçu final',
};
const STEP_ICON: Record<CStep, string> = {
  film: 'film-outline', critique: 'create-outline', media: 'image-outline', preview: 'eye-outline',
};

function ComposeModal({ visible, onClose, onPublished, userId }: {
  visible: boolean; onClose: () => void; onPublished?: () => void; userId: string;
}) {
  const [step,       setStep]      = useState<CStep>('film');
  const [form,       setForm]      = useState<ComposeState>(INIT);
  const [publishing, setPublishing]= useState(false);
  const [imgLoading, setImgLoad]   = useState(false);
  const [errors,     setErrors]    = useState<Partial<Record<CStep, string>>>({});
  const slideAnim = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    if (visible) {
      setStep('film'); setForm(INIT); setErrors({});
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 700, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const patch  = useCallback(<K extends keyof ComposeState>(k: K, v: ComposeState[K]) => setForm(f => ({ ...f, [k]: v })), []);
  const setErr = (s: CStep, msg: string) => setErrors(e => ({ ...e, [s]: msg }));
  const clrErr = (s: CStep)              => setErrors(e => ({ ...e, [s]: '' }));

  const validate = useCallback((s: CStep): string | null => {
    if (s === 'film') {
      if (!form.workTitle.trim()) return "Le titre de l'œuvre est obligatoire.";
      if (!form.workGenre)        return 'Sélectionnez un genre.';
      if (form.rating === 0)      return 'Attribuez au moins une étoile.';
    }
    if (s === 'critique') {
      if (!form.tone)                         return 'Choisissez un ton.';
      if (form.body.trim().length < MIN_BODY) return `Minimum ${MIN_BODY} caractères (actuel : ${form.body.trim().length}).`;
    }
    return null;
  }, [form]);

  const goNext = useCallback(() => {
    const err = validate(step);
    if (err) { setErr(step, err); return; }
    clrErr(step);
    const i = CSTEPS.indexOf(step);
    if (i < CSTEPS.length - 1) setStep(CSTEPS[i + 1]);
  }, [step, validate]);

  const goBack = useCallback(() => {
    const i = CSTEPS.indexOf(step);
    if (i > 0) setStep(CSTEPS[i - 1]);
  }, [step]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorisez l'accès à votre galerie dans les réglages.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, allowsEditing: true, aspect: [16, 9],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    patch('imageUri', uri); patch('imageValid', false); patch('imageUrl', '');
    setImgLoad(true); clrErr('media');
    const url = await uploadImageToSupabase(uri);
    setImgLoad(false);
    if (!url) { setErr('media', "L'upload a échoué. Vérifiez votre connexion."); return; }
    patch('imageUrl', url);
    patch('imageValid', true);
  }, [patch]);

  const publish = useCallback(async () => {
    if (!form.imageValid) { Alert.alert('Image manquante', 'Une image valide est obligatoire.'); return; }
    if (!form.tone)       { Alert.alert('Ton manquant', 'Choisissez un ton de critique.'); return; }
    setPublishing(true);
    const id = await dbPublishPost({
      work_title: form.workTitle.trim(), work_year: form.workYear.trim(),
      work_director: form.workDirector.trim(), work_genre: form.workGenre,
      rating: form.rating, body: form.body.trim(), image_url: form.imageUrl,
      image_valid: true, tags: form.tags, tone: form.tone,
    });
    setPublishing(false);
    if (id) { onPublished?.(); onClose(); }
    else Alert.alert('Erreur', 'Publication échouée. Réessayez.');
  }, [form, onPublished, onClose]);

  const stepIdx  = CSTEPS.indexOf(step);
  const bodyLen  = form.body.trim().length;
  const bodyPct  = Math.min(100, (bodyLen / MIN_BODY) * 100);
  const toneInfo = TONES.find(t => t.key === form.tone);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={cm.kav}
        >
          <Animated.View style={[cm.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            {/* Overlay navy pour uniformiser le fond */}
            <View style={cm.sheetTint} pointerEvents="none" />
            <View style={cm.inner}>

              {/* Handle */}
              <View style={cm.handle} />

              {/* Header */}
              <View style={cm.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cm.modalTitle}>Nouvelle Critique</Text>
                  <Text style={cm.modalSub}>Cinéma indépendant · Critique argumentée</Text>
                </View>
                <TouchableOpacity style={cm.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={16} color={C.textSec} />
                </TouchableOpacity>
              </View>

              {/* Stepper visuel */}
              <View style={cm.stepperRow}>
                {CSTEPS.map((s, i) => {
                  const done = i < stepIdx;
                  const curr = i === stepIdx;
                  return (
                    <View key={s} style={cm.stepperItem}>
                      <View style={[
                        cm.stepCircle,
                        done && cm.stepDone,
                        curr && cm.stepCurr,
                      ]}>
                        {done
                          ? <Ionicons name="checkmark" size={12} color={C.white} />
                          : <Ionicons name={STEP_ICON[s] as any} size={12} color={curr ? C.white : C.text} />
                        }
                      </View>
                      <Text style={[cm.stepLbl, curr && { color: C.text }, done && { color: C.textSec }]}>
                        {STEP_LBL[s]}
                      </Text>
                      {i < CSTEPS.length - 1 && (
                        <View style={[cm.stepLine, done && { backgroundColor: C.navyBright }]} />
                      )}
                    </View>
                  );
                })}
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={cm.scroll}
              >

                {/* ── FILM ─────────────────────────────────────────────── */}
                {step === 'film' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Identifiez l'œuvre</Text>
                    <Text style={cm.hint}>Seules les œuvres de cinéma indépendant sont acceptées.</Text>

                    <View style={cm.field}>
                      <Text style={cm.label}>TITRE *</Text>
                      <TextInput
                        style={cm.input}
                        placeholderTextColor={C.textTert}
                        placeholder="Ex : Portrait de la jeune fille en feu"
                        value={form.workTitle}
                        onChangeText={v => { patch('workTitle', v); clrErr('film'); }}
                      />
                    </View>

                    <View style={cm.row2}>
                      <View style={[cm.field, { flex: 1 }]}>
                        <Text style={cm.label}>RÉALISATEUR</Text>
                        <TextInput
                          style={cm.input} placeholder="Nom"
                          placeholderTextColor={C.textTert}
                          value={form.workDirector}
                          onChangeText={v => patch('workDirector', v)}
                        />
                      </View>
                      <View style={[cm.field, { width: 86 }]}>
                        <Text style={cm.label}>ANNÉE</Text>
                        <TextInput
                          style={cm.input} placeholder="2024"
                          placeholderTextColor={C.textTert}
                          value={form.workYear}
                          onChangeText={v => patch('workYear', v)}
                          keyboardType="numeric" maxLength={4}
                        />
                      </View>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>GENRE *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cm.chipRow}>
                        {GENRES_LIST.map(g => {
                          const on = form.workGenre === g;
                          return (
                            <TouchableOpacity
                              key={g}
                              style={[cm.chip, on && cm.chipOn]}
                              onPress={() => { patch('workGenre', g); clrErr('film'); }}
                            >
                              <Text style={[cm.chipTxt, on && { color: C.white }]}>{g}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>NOTE *</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <StarRating value={form.rating} onChange={v => { patch('rating', v); clrErr('film'); }} />
                        <View style={cm.ratingBadge}>
                          <Text style={cm.ratingTxt}>{form.rating > 0 ? `${form.rating}/5` : '--'}</Text>
                        </View>
                      </View>
                    </View>

                    {errors.film ? <Text style={cm.errTxt}>{errors.film}</Text> : null}
                  </View>
                )}

                {/* ── CRITIQUE ──────────────────────────────────────────── */}
                {step === 'critique' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Rédigez votre critique</Text>
                    <Text style={cm.hint}>Minimum {MIN_BODY} caractères. Argumentez et nuancez.</Text>

                    <View style={cm.field}>
                      <Text style={cm.label}>TON DE LA CRITIQUE *</Text>
                      <View style={cm.toneGrid}>
                        {TONES.map(t => {
                          const on = form.tone === t.key;
                          return (
                            <TouchableOpacity
                              key={t.key}
                              style={[cm.toneCard, on && { borderColor: t.color, backgroundColor: `${t.color}14` }]}
                              onPress={() => { patch('tone', t.key); clrErr('critique'); }}
                            >
                              <View style={[cm.toneIconWrap, on && { backgroundColor: `${t.color}20` }]}>
                                <Ionicons name={t.icon as any} size={20} color={on ? t.color : C.text} />
                              </View>
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
                        placeholder="Analysez la mise en scène, le jeu des acteurs, la narration…"
                        placeholderTextColor={C.text}
                        value={form.body}
                        onChangeText={v => { patch('body', v); clrErr('critique'); }}
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <View style={cm.charBg}>
                          <View style={[cm.charFill, {
                            width: `${bodyPct}%` as any,
                            backgroundColor: bodyLen >= MIN_BODY ? C.green : C.blue,
                          }]} />
                        </View>
                        <Text style={[cm.charCount, bodyLen >= MIN_BODY && { color: C.green }]}>
                          {bodyLen}/{MIN_BODY}
                        </Text>
                      </View>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>ASPECTS ABORDÉS (optionnel)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cm.chipRow}>
                        {ASPECTS.map(tag => {
                          const on = form.tags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              style={[cm.chip, on && { borderColor: C.gold, backgroundColor: C.goldDim }]}
                              onPress={() =>
                                patch('tags', on ? form.tags.filter(t => t !== tag) : [...form.tags, tag])
                              }
                            >
                              <Text style={[cm.chipTxt, on && { color: C.gold }]}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {errors.critique ? <Text style={cm.errTxt}>{errors.critique}</Text> : null}
                  </View>
                )}

                {/* ── MEDIA ─────────────────────────────────────────────── */}
                {step === 'media' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Illustration obligatoire</Text>
                    <Text style={cm.hint}>Une image de l'œuvre est requise avant publication.</Text>

                    {form.imageUri ? (
                      <View style={cm.imgWrap}>
                        <Image source={{ uri: form.imageUri }} style={cm.imgPreview} resizeMode="cover" />
                        <LinearGradient
                          colors={['transparent', 'rgba(2,8,16,0.80)']}
                          style={StyleSheet.absoluteFillObject}
                        />
                        {form.imageValid && !imgLoading && (
                          <View style={cm.validBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={C.green} />
                            <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>Image prête</Text>
                          </View>
                        )}
                        {imgLoading && (
                          <View style={cm.imgLoader}>
                            <ActivityIndicator color={C.blue} />
                            <Text style={{ color: C.textSec, fontSize: 13, marginTop: 6 }}>Upload…</Text>
                          </View>
                        )}
                        {!imgLoading && (
                          <TouchableOpacity style={cm.changeImgBtn} onPress={pickImage}>
                            <Ionicons name="refresh-outline" size={13} color={C.textSec} />
                            <Text style={{ color: C.textSec, fontSize: 12 }}>Changer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity style={cm.pickBtn} onPress={pickImage} disabled={imgLoading}>
                        <View style={cm.pickIconWrap}>
                          <Ionicons name="image-outline" size={36} color={C.blue} />
                        </View>
                        <Text style={cm.pickTitle}>Sélectionner depuis la galerie</Text>
                        <Text style={cm.pickSub}>JPEG · PNG · Format 16:9 recommandé</Text>
                      </TouchableOpacity>
                    )}

                    {errors.media ? <Text style={cm.errTxt}>{errors.media}</Text> : null}
                  </View>
                )}

                {/* ── PREVIEW ───────────────────────────────────────────── */}
                {step === 'preview' && (
                  <View style={cm.stepWrap}>
                    <Text style={cm.sectionHead}>Aperçu avant publication</Text>

                    <View style={cm.previewCard}>
                      {form.imageUrl
                        ? <Image source={{ uri: form.imageUrl }} style={cm.previewImg} resizeMode="cover" />
                        : <View style={[cm.previewImg, { backgroundColor: C.navyMid }]} />
                      }
                      <LinearGradient
                        colors={['transparent', 'rgba(2,8,16,0.94)']}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={cm.previewOverlay}>
                        {toneInfo && (
                          <View style={[cm.tonePill, { backgroundColor: `${toneInfo.color}20`, borderWidth: 1, borderColor: `${toneInfo.color}40` }]}>
                            <Ionicons name={toneInfo.icon as any} size={9} color={toneInfo.color} />
                            <Text style={[cm.tonePillTxt, { color: toneInfo.color }]}>
                              {toneInfo.label.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={cm.previewTitle} numberOfLines={2}>{form.workTitle}</Text>
                        <Text style={cm.previewMeta}>
                          {[form.workDirector, form.workYear, form.workGenre].filter(Boolean).join(' · ')}
                        </Text>
                        <StarRating value={form.rating} size={13} />
                      </View>
                    </View>

                    <View style={cm.previewBody}>
                      <Text style={{ color: C.textSec, fontSize: 14, lineHeight: 22 }} numberOfLines={5}>
                        {form.body}
                      </Text>
                    </View>

                    {form.tags.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
                        {form.tags.map(tag => (
                          <Text key={tag} style={{ color: C.gold, fontSize: 11, fontWeight: '600' }}>#{tag}</Text>
                        ))}
                      </View>
                    )}

                    {/* Checklist finale */}
                    <View style={cm.checklist}>
                      {[
                        { ok: form.workTitle.trim().length > 0, txt: 'Œuvre identifiée' },
                        { ok: form.rating > 0,                   txt: 'Note attribuée' },
                        { ok: form.tone !== null,                 txt: 'Ton défini' },
                        { ok: bodyLen >= MIN_BODY,                txt: `Critique ≥ ${MIN_BODY} caractères` },
                        { ok: form.imageValid,                    txt: 'Image uploadée et validée' },
                      ].map(item => (
                        <View key={item.txt} style={cm.checkRow}>
                          <Ionicons
                            name={item.ok ? 'checkmark-circle' : 'ellipse-outline'}
                            size={15}
                            color={item.ok ? C.green : C.text}
                          />
                          <Text style={{ color: item.ok ? C.textSec : C.text, fontSize: 13 }}>
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
                    <Ionicons name="chevron-back" size={16} color={C.textSec} />
                    <Text style={{ color: C.textSec, fontSize: 14, fontWeight: '600' }}>Retour</Text>
                  </TouchableOpacity>
                )}

                {step !== 'preview' ? (
                  <TouchableOpacity
                    style={[cm.nextBtn, stepIdx === 0 && { marginLeft: 'auto' as any }]}
                    onPress={goNext}
                  >
                    <LinearGradient
                      colors={[C.navyBright, C.navyLight]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={cm.btnGrad}
                    >
                      <Text style={cm.btnTxt}>Continuer</Text>
                      <Ionicons name="chevron-forward" size={15} color={C.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[cm.nextBtn, publishing && { opacity: 0.55 }]}
                    onPress={publish}
                    disabled={publishing}
                  >
                    <LinearGradient
                      colors={[C.blue, C.navyMid]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={cm.btnGrad}
                    >
                      {publishing
                        ? <ActivityIndicator color={C.white} size="small" />
                        : (
                          <>
                            <Ionicons name="send" size={15} color={C.white} />
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
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,8,16,0.80)' },
  kav:          { flex: 1, justifyContent: 'flex-end' },
  sheet:        { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  sheetTint:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,15,30,0.60)' },
  inner:        { flex: 1 },
  handle:       { width: 38, height: 4, borderRadius: 2, backgroundColor: C.navyLight, alignSelf: 'center', marginTop: 12 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  modalTitle:   { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  modalSub:     { color: C.textTert, fontSize: 11, marginTop: 3 },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },

  // Stepper
  stepperRow:   { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, alignItems: 'flex-start' },
  stepperItem:  { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle:   { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepDone:     { backgroundColor: C.navyBright, borderColor: C.navyBright },
  stepCurr:     { backgroundColor: C.navyLight, borderColor: C.borderHi },
  stepLbl:      { color: C.text, fontSize: 9, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  stepLine:     { position: 'absolute', top: 14, left: '50%', right: '-50%', height: 1, backgroundColor: C.border },

  progressRow:  { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 6 },
  progressBar:  { flex: 1, height: 2, borderRadius: 1, backgroundColor: C.surf },
  scroll:       { flex: 1 },
  stepWrap:     { paddingHorizontal: 20 },
  sectionHead:  { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 5, letterSpacing: -0.3 },
  hint:         { color: C.textTert, fontSize: 12, lineHeight: 17, marginBottom: 20 },
  field:        { marginBottom: 20 },
  label:        { color: C.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input:        { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15 },
  textarea:     { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 14, minHeight: 140, lineHeight: 22 },
  row2:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chipRow:      { gap: 8, paddingVertical: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:       { borderColor: C.borderHi, backgroundColor: C.navyLight },
  chipTxt:      { color: C.textSec, fontSize: 13, fontWeight: '600' },
  ratingBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.goldDim, borderWidth: 1, borderColor: 'rgba(245,200,66,0.2)' },
  ratingTxt:    { color: C.gold, fontSize: 14, fontWeight: '800' },
  toneGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toneCard:     { width: (W - 40 - 10) / 2, paddingVertical: 16, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 8 },
  toneIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.navyMid, justifyContent: 'center', alignItems: 'center' },
  toneLbl:      { color: C.textSec, fontSize: 13, fontWeight: '700' },
  charBg:       { flex: 1, height: 2, borderRadius: 1, backgroundColor: C.surf, overflow: 'hidden' },
  charFill:     { height: '100%', borderRadius: 1 },
  charCount:    { color: C.text, fontSize: 11, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  pickBtn:      { height: 180, borderRadius: 16, borderWidth: 1, borderColor: C.borderBlue, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  pickIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.blueDim, justifyContent: 'center', alignItems: 'center' },
  pickTitle:    { color: C.text, fontSize: 14, fontWeight: '700' },
  pickSub:      { color: C.text, fontSize: 11 },
  imgWrap:      { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  imgPreview:   { width: '100%', height: '100%' },
  validBadge:   { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(2,8,16,0.80)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  imgLoader:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,8,16,0.65)', alignItems: 'center', justifyContent: 'center' },
  changeImgBtn: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,8,16,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  errTxt:       { color: C.red, fontSize: 12, marginBottom: 12, fontWeight: '600' },
  previewCard:  { height: 200, borderRadius: 18, overflow: 'hidden', marginBottom: 16, backgroundColor: C.navyMid },
  previewImg:   { width: '100%', height: '100%' },
  previewOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  previewTitle: { color: C.white, fontSize: 19, fontWeight: '800', marginBottom: 2, letterSpacing: -0.3 },
  previewMeta:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 7 },
  tonePill:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 7 },
  tonePillTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  previewBody:  { backgroundColor: C.surf, borderRadius: 14, padding: 14, marginBottom: 14 },
  checklist:    { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 11, marginBottom: 16 },
  checkRow:     { flexDirection: 'row', alignItems: 'center', gap: 9 },
  footer:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 12 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
  nextBtn:      { flex: 1, borderRadius: 22, overflow: 'hidden' },
  btnGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnTxt:       { color: C.white, fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE BAR
// ─────────────────────────────────────────────────────────────────────────────
const ComposeBar = memo(function ComposeBar({ onPress, userId }: { onPress: () => void; userId: string }) {
  return (
    <TouchableOpacity style={cbar.wrap} onPress={onPress} activeOpacity={0.85}>
      <View style={cbar.leftAccent} />
      <Image source={{ uri: `https://i.pravatar.cc/100?u=${userId}` }} style={cbar.avi} />
      <View style={cbar.body}>
        <Text style={cbar.title}>Partagez votre critique</Text>
        <Text style={cbar.sub}>Analyse · Coup de cœur · Réflexion · Déception</Text>
        <View style={cbar.pills}>
          {([
            { icon: 'film-outline',  label: 'Œuvre'  },
            { icon: 'star-outline',  label: 'Note'   },
            { icon: 'image-outline', label: 'Visuel' },
          ] as const).map(p => (
            <View key={p.label} style={cbar.pill}>
              <Ionicons name={p.icon} size={10} color={C.textSec} />
              <Text style={cbar.pillTxt}>{p.label}</Text>
            </View>
          ))}
        </View>
      </View>
      
    </TouchableOpacity>
  );
});

const cbar = StyleSheet.create({
  wrap:     { marginHorizontal: EDGE, marginBottom: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: C.surf, overflow: 'hidden' },
  avi:      { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: C.borderHi },
  body:     { flex: 1, gap: 2 },
  title:    { color: C.text, fontSize: 13, fontWeight: '700' },
  sub:      { color: C.text, fontSize: 10 },
  pills:    { flexDirection: 'row', gap: 6, marginTop: 5 },
  pill:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: C.navyMid, borderWidth: 1, borderColor: C.border },
  pillTxt:  { fontSize: 10, fontWeight: '600', color: C.textSec },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.navyBright, justifyContent: 'center', alignItems: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = memo(function PostCard({ post, userId }: { post: Post; userId: string }) {
  const router = useRouter();
  const { liked, toggleLike, sharePost } = useContext(InteractionCtx);

  const isLiked   = !!liked[post.id];
  const likeScale = useRef(new Animated.Value(1)).current;

  const onLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(likeScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    toggleLike(post.id, userId);
  }, [post.id, userId, toggleLike, likeScale]);

  const toneInfo  = useMemo(() => TONES.find(t => t.key === post.tone) ?? TONES[0], [post.tone]);
  const imgSource = useMemo(() =>
    post.image_url
      ? { uri: post.image_url }
      : { uri: `https://picsum.photos/seed/${post.id}/800/450` },
    [post.image_url, post.id],
  );
  const metaStr = [post.work_director, post.work_year].filter(Boolean).join(' · ');

  return (
    <View style={pcs.card}>

      {/* Image + overlay */}
      <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/film/${post.id}`)}>
        <Image source={imgSource} style={pcs.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.92)']}
          style={pcs.imgGrad}
        />
        {/* Badge ton */}
        <View style={[pcs.toneBadge, { borderColor: `${toneInfo.color}30` }]}>
          <Ionicons name={toneInfo.icon as any} size={10} color={toneInfo.color} />
          <Text style={[pcs.toneBadgeTxt, { color: toneInfo.color }]}>{toneInfo.label}</Text>
        </View>
        {/* Infos film */}
        <View style={pcs.filmOverlay}>
          <Text style={pcs.filmTitle} numberOfLines={1}>{post.work_title || 'Œuvre inconnue'}</Text>
          {metaStr.length > 0 && <Text style={pcs.filmMeta}>{metaStr}</Text>}
          <StarRating value={post.rating} size={11} />
        </View>
      </TouchableOpacity>

      {/* Corps */}
      <View style={pcs.body}>

        {/* Auteur + genre */}
        <View style={pcs.authorRow}>
          <Image source={{ uri: post.avatar }} style={pcs.avi} />
          <View style={{ flex: 1 }}>
            <Text style={pcs.authorName}>{post.userName}</Text>
            <Text style={pcs.authorTime}>{post.timeAgo}</Text>
          </View>
          {post.work_genre.length > 0 && (
            <View style={pcs.genrePill}>
              <Text style={pcs.genrePillTxt}>{post.work_genre}</Text>
            </View>
          )}
        </View>

        {/* Texte */}
        <Text style={pcs.content} numberOfLines={4}>{post.content}</Text>

        {/* Tags */}
        {post.tags.length > 0 && (
          <View style={pcs.tagRow}>
            {post.tags.slice(0, 3).map(tag => (
              <Text key={tag} style={pcs.tag}>#{tag}</Text>
            ))}
          </View>
        )}

        {/* Séparateur */}
        <View style={pcs.divider} />

        {/* Actions */}
        <View style={pcs.actions}>
          <TouchableOpacity style={pcs.action} onPress={onLike} activeOpacity={0.75}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={isLiked ? C.red : C.textSec}
              />
            </Animated.View>
            <Text style={[pcs.actionTxt, isLiked && { color: C.red }]}>
              {post.likes + (isLiked ? 1 : 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={pcs.action}
            onPress={() => router.push(`/film/${post.id}`)}
            activeOpacity={0.75}
          >
            <Ionicons name="chatbubble-outline" size={17} color={C.textSec} />
          </TouchableOpacity>

          <TouchableOpacity
            style={pcs.action}
            onPress={() => sharePost(post.id, post.work_title, userId)}
            activeOpacity={0.75}
          >
            <Ionicons name="share-outline" size={18} color={C.textSec} />
            <Text style={pcs.actionTxt}>{post.shares}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={pcs.infoBtn}
            onPress={() => router.push(`/film/${post.id}`)}
          >
            <Ionicons name="arrow-forward" size={15} color={C.textSec} />
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
});

const pcs = StyleSheet.create({
  card:         { marginHorizontal: EDGE, marginBottom: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.textTert },
  img:          { width: '100%', height: 205 },
  imgGrad:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  toneBadge:    { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(2,8,16,0.70)', borderWidth: 1 },
  toneBadgeTxt: { fontSize: 10, fontWeight: '700' },
  filmOverlay:  { position: 'absolute', bottom: 12, left: 14, right: 14 },
  filmTitle:    { color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  filmMeta:     { color: 'rgba(255,255,255,0.42)', fontSize: 11, marginBottom: 6 },
  body:         { padding: 14 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avi:          { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border },
  authorName:   { color: C.text, fontSize: 13, fontWeight: '700' },
  authorTime:   { color: C.text, fontSize: 10, marginTop: 1 },
  genrePill:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderBlue },
  genrePillTxt: { color: C.textSec, fontSize: 10, fontWeight: '700' },
  content:      { color: C.textSec, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tagRow:       { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tag:          { color: C.gold, fontSize: 11, fontWeight: '600' },
  divider:      { height: 1, backgroundColor: C.border, marginBottom: 12 },
  actions:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  actionTxt:    { color: C.textSec, fontSize: 12, fontWeight: '600' },
  infoBtn:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navyLight },
});

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SocialHeader = memo(function SocialHeader({ onCompose }: { onCompose: () => void }) {
  const router = useRouter();
  return (
    <View style={hdr.row}>
      <View>
        <Text style={hdr.eyebrow}>UNIVERSE · CINÉMA</Text>
        <Text style={hdr.title}>Communauté</Text>
      </View>
      <View style={hdr.actions}>
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={19} color={C.textSec} />
          <View style={hdr.dot} />
        </TouchableOpacity>
        <TouchableOpacity style={[hdr.btn, hdr.composeBtn]} onPress={onCompose}>
          <Ionicons name="add" size={20} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const hdr = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 10, paddingBottom: 14 },
  eyebrow:    { fontSize: 9, fontWeight: '700', color: C.text, letterSpacing: 1.5, marginBottom: 2 },
  title:      { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  actions:    { flexDirection: 'row', gap: 8 },
  btn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surf, borderWidth: 1, borderColor: C.navyBright, alignItems: 'center', justifyContent: 'center' },
  composeBtn: { backgroundColor: C.surf, borderColor: C.navyBright },
  dot:        { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────
const FilterTabs = memo(function FilterTabs({
  active, set,
}: { active: FeedTab; set: (t: FeedTab) => void }) {
  return (
    <View style={ft.row}>
      {FEED_TABS.map(t => {
        const on = active === t;
        return (
          <TouchableOpacity key={t} onPress={() => set(t)} style={ft.pill} activeOpacity={0.8}>
            <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
            {on && <View style={ft.line} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const ft = StyleSheet.create({
  row:  { flexDirection: 'row', paddingHorizontal: EDGE, gap: 22, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  pill: { paddingBottom: 13, alignItems: 'center', position: 'relative' },
  txt:  { color: C.text, fontSize: 14, fontWeight: '600' },
  txtOn:{ color: C.text, fontWeight: '800' },
  line: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: C.blue },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyFeed = memo(function EmptyFeed({ onCompose }: { onCompose: () => void }) {
  return (
    <View style={emp.wrap}>
      <View style={emp.iconWrap}>
        <Ionicons name="film-outline" size={36} color={C.text} />
      </View>
      <Text style={emp.title}>Aucune critique ici</Text>
      <Text style={emp.sub}>Soyez le premier à partager votre avis sur un film indépendant.</Text>
      <TouchableOpacity style={emp.cta} onPress={onCompose}>
        <LinearGradient
          colors={[C.navyBright, C.navyLight]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={emp.ctaGrad}
        >
          <Ionicons name="create-outline" size={16} color={C.white} />
          <Text style={emp.ctaTxt}>Écrire une critique</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

const emp = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 12 },
  iconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  title:   { color: C.textSec, fontSize: 17, fontWeight: '700' },
  sub:     { color: C.text, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  cta:     { borderRadius: 22, overflow: 'hidden', marginTop: 8 },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
  ctaTxt:  { color: C.white, fontSize: 14, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const [tab,         setTab]         = useState<FeedTab>('Pour vous');
  const [composeOpen, setComposeOpen] = useState(false);
  const [userId,      setUserId]      = useState('anonymous');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  const { posts, loading, error, refresh, toggleLike } = usePostsFeed(tab);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const renderItem     = useCallback(({ item }: { item: Post }) => (
    <PostCard post={item} userId={userId} />
  ), [userId]);
  const keyExtractor   = useCallback((item: Post) => item.id, []);

  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)} />
      <View style={{ height: 10 }} />
      <ComposeBar onPress={() => setComposeOpen(true)} userId={userId} />
      <View style={{ height: 6 }} />
      <FilterTabs active={tab} set={setTab} />
    </>
  ), [tab, userId]);

  const ListEmpty = useMemo(() => {
    if (loading) return (
      <View style={{ alignItems: 'center', paddingVertical: 60, gap: 14 }}>
        <ActivityIndicator color={C.blue} size="large" />
        <Text style={{ color: C.text, fontSize: 13 }}>Chargement des critiques…</Text>
      </View>
    );
    if (error) return (
      <View style={{ alignItems: 'center', paddingVertical: 60, gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cloud-offline-outline" size={28} color={C.text} />
        </View>
        <Text style={{ color: C.red, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>{error}</Text>
        <TouchableOpacity
          onPress={refresh}
          style={{ paddingHorizontal: 22, paddingVertical: 10, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi }}
        >
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
    return <EmptyFeed onCompose={() => setComposeOpen(true)} />;
  }, [loading, error, refresh]);

  return (
    <InteractionProvider onToggleLike={toggleLike}>
      <View style={s.root}>
        <StatusBar style="light" />
        <GalaxyBackground />

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ComposeModal
            visible={composeOpen}
            onClose={() => setComposeOpen(false)}
            onPublished={refresh}
            userId={userId}
          />

          <FlatList
            data={posts}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.blue}
                colors={[C.blue]}
              />
            }
            removeClippedSubviews
            windowSize={6}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={60}
            initialNumToRender={5}
          />
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1},
});