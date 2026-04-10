// ─────────────────────────────────────────────────────────────────────────────
// app/social.tsx  —  Communauté Universe App
// Fix critique :
//   • Posts chargés depuis community_posts (Supabase) + realtime INSERT
//   • Upload image via FileSystem.readAsStringAsync + decode() (fix 400 mobile)
//   • Palette galactique (teal #00C9FF + gold #F5C842, zero violet)
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
import * as FileSystem    from 'expo-file-system';
import { decode }         from 'base64-arraybuffer';

import { supabase }         from '@/lib/supabase';
import GalaxyBackground     from '@/components/social/GalaxyBackground';

const { width: W } = Dimensions.get('window');
const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — GALACTIC (zéro violet)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg0:       '#03000A',
  bg1:       '#07001A',
  surf:      'rgba(255,255,255,0.05)',
  surfHi:    'rgba(255,255,255,0.09)',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(0,201,255,0.28)',
  borderAcc: 'rgba(245,200,66,0.25)',
  text:      '#EDF6FF',
  textSec:   '#8BA4BE',
  textTert:  '#3D5470',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.12)',
  goldSoft:  'rgba(245,200,66,0.07)',
  teal:      '#00C9FF',
  tealDim:   'rgba(0,201,255,0.12)',
  tealSoft:  'rgba(0,201,255,0.06)',
  tealMid:   'rgba(0,201,255,0.20)',
  navy:      '#0A1628',
  navyMid:   '#0D2240',
  green:     '#2ECC8A',
  greenDim:  'rgba(46,204,138,0.14)',
  red:       '#FF3B5C',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const TONE_KEYS = ['analyse', 'coup de coeur', 'deception', 'reflexion'] as const;
type Tone = typeof TONE_KEYS[number];

const TONES: { key: Tone; label: string; icon: string; color: string }[] = [
  { key: 'analyse',       label: 'Analyse',       icon: 'flask-outline',        color: C.teal },
  { key: 'coup de coeur', label: 'Coup de cœur',  icon: 'heart-outline',        color: C.red  },
  { key: 'deception',     label: 'Déception',     icon: 'thunderstorm-outline', color: C.gold },
  { key: 'reflexion',     label: 'Réflexion',     icon: 'bulb-outline',         color: '#7DD3FC' },
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

const MIN_BODY   = 80;
const POSTS_LIMIT = 40;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Ligne brute telle que retournée par Supabase */
interface SupabasePost {
  id:           string;
  user_id:      string;
  work_title:   string;
  work_year:    string;
  work_director:string;
  work_genre:   string;
  rating:       number;
  body:         string;
  image_url:    string;
  image_valid:  boolean;
  tags:         string[];
  tone:         string;
  likes_count:  number;
  shares_count: number;
  created_at:   string;
  // jointure optionnelle si on ajoute un select profiles
  profiles?: { display_name: string; avatar_url: string } | null;
}

/** Post normalisé — toutes les valeurs sont des primitifs */
interface Post {
  id:           string;
  userId:       string;
  userName:     string;
  avatar:       string;
  timeAgo:      string;
  content:      string;
  likes:        number;
  shares:       number;
  work_title:   string;
  work_year:    string;
  work_director:string;
  work_genre:   string;
  rating:       number;
  image_url:    string;
  tags:         string[];
  tone:         Tone;
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
    id:           r.id,
    userId:       r.user_id,
    userName:     r.profiles?.display_name ?? 'Cinéphile',
    avatar:       r.profiles?.avatar_url   ?? `https://i.pravatar.cc/100?u=${r.user_id}`,
    timeAgo:      timeAgo(r.created_at),
    content:      r.body ?? '',
    likes:        r.likes_count   ?? 0,
    shares:       r.shares_count  ?? 0,
    work_title:   r.work_title    ?? '',
    work_year:    r.work_year     ?? '',
    work_director:r.work_director ?? '',
    work_genre:   r.work_genre    ?? '',
    rating:       r.rating        ?? 0,
    image_url:    r.image_url     ?? '',
    tags:         Array.isArray(r.tags) ? r.tags : [],
    tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload image vers Supabase Storage.
 * FIX : utilise FileSystem.readAsStringAsync (base64) + decode() sur mobile,
 * car fetch().arrayBuffer() envoie un body vide dans le bridge React Native
 * → provoque le 400 Bad Request.
 */
async function uploadImageToSupabase(localUri: string): Promise<string | null> {
  try {
    const isBlob = localUri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (localUri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const filename = `post_${Date.now()}.${ext}`;

    let payload: ArrayBuffer;

    if (Platform.OS === 'web' || isBlob) {
      // Web : fetch standard fonctionne correctement
      const res = await fetch(localUri);
      payload   = await res.arrayBuffer();
    } else {
      // iOS / Android : lecture base64 via FileSystem puis décodage
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

async function dbPublishPost(
  payload: Omit<{
    user_id: string;
    work_title: string;
    work_year: string;
    work_director: string;
    work_genre: string;
    rating: number;
    body: string;
    image_url: string;
    image_valid: boolean;
    tags: string[];
    tone: Tone;
  }, 'user_id'>
): Promise<string | null> {
  // Récupère la session si possible, sinon crée une session anonyme
  const getOrCreateSession = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('[publish] getSession error', sessionError);
    }

    let userId = sessionData.session?.user?.id;
    if (userId) return sessionData.session;

    // Si pas de session: créer une session anonyme
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;

    return data.session;
  };

  let session: any;
  try {
    session = await getOrCreateSession();
  } catch (e) {
    console.error('[publish] auth failed', e);
    return null;
  }

  const userId = session?.user?.id;
  if (!userId) {
    console.error('[publish] No session / not authenticated');
    return null;
  }

  // 2) Insertion Postgres
  const { data, error } = await supabase
    .from('community_posts')
    .insert({ ...payload, user_id: userId })
    .select('id')
    .single();

  if (error) {
    console.error('[publish] insert error', error);
    return null;
  }

  return (data as { id: string }).id;
}
// ─────────────────────────────────────────────────────────────────────────────
// HOOK — Feed Supabase + temps réel
// ─────────────────────────────────────────────────────────────────────────────
function usePostsFeed(tab: FeedTab) {
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [refreshKey,setRefreshKey]= useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // ── Chargement initial ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Jointure optionnelle avec profiles si la table existe
        // Sélection sans jointure profiles (pas de FK déclarée → évite le 400)
        const { data, error: err } = await supabase
        .from('community_posts_enriched')
        .select(
          'id, user_id, work_title, work_year, work_director, ' +
          'work_genre, rating, body, image_url, image_valid, ' +
          'tags, tone, likes_count, shares_count, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(POSTS_LIMIT);

        if (cancelled) return;
        if (err) throw err;

        const mapped = (Array.isArray(data) ? data : []).map(mapPost);
        setPosts(mapped);
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

  // ── Subscription INSERT temps réel ──────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('community_posts:inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        async (payload) => {
          // Récupérer le post complet avec son profil
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
          setPosts(prev => {
            if (prev.some(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Like optimiste ──────────────────────────────────────────────────────
  const toggleLike = useCallback(async (postId: string, userId: string, wasLiked: boolean) => {
    setPosts(prev =>
      prev.map(p => p.id !== postId ? p : {
        ...p,
        likes: p.likes + (wasLiked ? -1 : 1),
      }),
    );
    try {
      await dbToggleLike(postId, userId, wasLiked);
    } catch {
      // rollback
      setPosts(prev =>
        prev.map(p => p.id !== postId ? p : {
          ...p,
          likes: p.likes + (wasLiked ? 1 : -1),
        }),
      );
    }
  }, []);

  return { posts, loading, error, refresh, toggleLike };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface ICtx {
  liked:     Record<string, boolean>;
  toggleLike:(postId: string, userId: string) => void;
  sharePost: (postId: string, title: string, userId: string) => Promise<void>;
}
const InteractionCtx = createContext<ICtx>({
  liked: {}, toggleLike: () => {}, sharePost: async () => {},
});

function InteractionProvider({
  children, onToggleLike,
}: {
  children: React.ReactNode;
  onToggleLike: (postId: string, userId: string, wasLiked: boolean) => void;
}) {
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
      if (result.action === Share.sharedAction) {
        await dbRecordShare(postId, userId, result.activityType ?? 'unknown');
      }
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
  value, onChange, size = 26,
}: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange} hitSlop={6}>
          <Ionicons
            name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={value >= s || value >= s - 0.5 ? C.gold : C.textTert}
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
const CSTEPS: CStep[] = ['film', 'critique', 'media', 'preview'];
const STEP_LBL: Record<CStep, string> = {
  film: "L'Œuvre", critique: 'Votre Critique', media: 'Illustration', preview: 'Aperçu final',
};

function ComposeModal({ visible, onClose, onPublished, userId }: {
  visible: boolean; onClose: () => void;
  onPublished?: () => void; userId: string;
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
      Animated.spring(slideAnim, {
        toValue: 0, tension: 55, friction: 11, useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 700, duration: 200, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const patch = useCallback(<K extends keyof ComposeState>(k: K, v: ComposeState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  const setErr = (s: CStep, msg: string) => setErrors(e => ({ ...e, [s]: msg }));
  const clrErr = (s: CStep)              => setErrors(e => ({ ...e, [s]: '' }));

  const validate = useCallback((s: CStep): string | null => {
    if (s === 'film') {
      if (!form.workTitle.trim()) return "Le titre de l'œuvre est obligatoire.";
      if (!form.workGenre)        return 'Sélectionnez un genre.';
      if (form.rating === 0)      return 'Attribuez au moins une étoile.';
    }
    if (s === 'critique') {
      if (!form.tone)                           return 'Choisissez un ton.';
      if (form.body.trim().length < MIN_BODY)   return `Minimum ${MIN_BODY} caractères (actuel : ${form.body.trim().length}).`;
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
      work_title: form.workTitle.trim(),
      work_year: form.workYear.trim(), work_director: form.workDirector.trim(),
      work_genre: form.workGenre, rating: form.rating,
      body: form.body.trim(), image_url: form.imageUrl,
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
            <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={cm.inner}>

              {/* Handle */}
              <View style={cm.handle} />

              {/* Header */}
              <View style={cm.topRow}>
                <View>
                  <Text style={cm.modalTitle}>Nouvelle Critique</Text>
                  <Text style={cm.modalSub}>Cinéma indépendant · Critique constructive</Text>
                </View>
                <TouchableOpacity style={cm.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>

              {/* Progression */}
              <View style={cm.progressRow}>
                {CSTEPS.map((s, i) => (
                  <View
                    key={s}
                    style={[cm.progressBar, i <= stepIdx && { backgroundColor: C.teal }]}
                  />
                ))}
              </View>
              <Text style={cm.stepHint}>
                {`Étape ${stepIdx + 1}/${CSTEPS.length} — ${STEP_LBL[step]}`}
              </Text>

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
                      <View style={[cm.field, { width: 82 }]}>
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
                      <ScrollView
                        horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={cm.chipRow}
                      >
                        {GENRES_LIST.map(g => {
                          const on = form.workGenre === g;
                          return (
                            <TouchableOpacity
                              key={g}
                              style={[cm.chip, on && cm.chipOn]}
                              onPress={() => { patch('workGenre', g); clrErr('film'); }}
                            >
                              <Text style={[cm.chipTxt, on && { color: C.teal }]}>{g}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>NOTE *</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <StarRating
                          value={form.rating}
                          onChange={v => { patch('rating', v); clrErr('film'); }}
                        />
                        <Text style={{ color: C.gold, fontSize: 15, fontWeight: '700' }}>
                          {form.rating > 0 ? `${form.rating}/5` : '--'}
                        </Text>
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
                              style={[cm.toneCard, on && { borderColor: t.color, backgroundColor: `${t.color}18` }]}
                              onPress={() => { patch('tone', t.key); clrErr('critique'); }}
                            >
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
                        placeholder="Analysez la mise en scène, le jeu des acteurs, la narration..."
                        placeholderTextColor={C.textTert}
                        value={form.body}
                        onChangeText={v => { patch('body', v); clrErr('critique'); }}
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <View style={cm.charBg}>
                          <View style={[cm.charFill, {
                            width: `${bodyPct}%` as any,
                            backgroundColor: bodyLen >= MIN_BODY ? C.green : C.teal,
                          }]} />
                        </View>
                        <Text style={[cm.charCount, bodyLen >= MIN_BODY && { color: C.green }]}>
                          {bodyLen}/{MIN_BODY}
                        </Text>
                      </View>
                    </View>

                    <View style={cm.field}>
                      <Text style={cm.label}>ASPECTS ABORDÉS (optionnel)</Text>
                      <ScrollView
                        horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={cm.chipRow}
                      >
                        {ASPECTS.map(tag => {
                          const on = form.tags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              style={[cm.chip, on && { borderColor: C.gold, backgroundColor: C.goldDim }]}
                              onPress={() =>
                                patch('tags', on
                                  ? form.tags.filter(t => t !== tag)
                                  : [...form.tags, tag],
                                )
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
                        {form.imageValid && !imgLoading && (
                          <View style={cm.validBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={C.green} />
                            <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>Image uploadée</Text>
                          </View>
                        )}
                        {imgLoading && (
                          <View style={cm.imgLoader}>
                            <ActivityIndicator color={C.teal} />
                            <Text style={{ color: 'white', fontSize: 13, marginTop: 6 }}>Upload en cours…</Text>
                          </View>
                        )}
                        {!imgLoading && (
                          <TouchableOpacity
                            style={cm.changeImgBtn}
                            onPress={pickImage}
                          >
                            <Ionicons name="refresh-outline" size={14} color={C.textSec} />
                            <Text style={{ color: C.textSec, fontSize: 12 }}>Changer l'image</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity style={cm.pickBtn} onPress={pickImage} disabled={imgLoading}>
                        <LinearGradient
                          colors={[C.tealSoft, 'transparent']}
                          style={StyleSheet.absoluteFill}
                        />
                        <Ionicons name="image-outline" size={42} color={C.teal} />
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>
                          Sélectionner depuis la galerie
                        </Text>
                        <Text style={{ color: C.textTert, fontSize: 12 }}>JPEG · PNG · 16:9 recommandé</Text>
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
                      {form.imageUrl ? (
                        <Image source={{ uri: form.imageUrl }} style={cm.previewImg} resizeMode="cover" />
                      ) : (
                        <View style={[cm.previewImg, { backgroundColor: C.navy }]} />
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(3,0,10,0.92)']}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={cm.previewOverlay}>
                        {toneInfo && (
                          <View style={[cm.tonePill, { backgroundColor: `${toneInfo.color}22` }]}>
                            <Text style={[cm.tonePillTxt, { color: toneInfo.color }]}>
                              {toneInfo.label.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={cm.previewTitle}>{form.workTitle}</Text>
                        <Text style={cm.previewMeta}>
                          {[form.workDirector, form.workYear, form.workGenre].filter(Boolean).join(' · ')}
                        </Text>
                        <StarRating value={form.rating} size={14} />
                      </View>
                    </View>

                    <View style={cm.previewBody}>
                      <Text style={{ color: C.textSec, fontSize: 14, lineHeight: 22 }} numberOfLines={5}>
                        {form.body}
                      </Text>
                    </View>

                    {form.tags.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                        {form.tags.map(tag => (
                          <Text key={tag} style={{ color: C.gold, fontSize: 11, fontWeight: '600' }}>
                            #{tag}
                          </Text>
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
                            name={item.ok ? 'checkmark-circle' : 'close-circle'}
                            size={16}
                            color={item.ok ? C.green : C.red}
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
                    onPress={goNext}
                  >
                    <LinearGradient
                      colors={[C.teal, C.navyMid]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={cm.btnGrad}
                    >
                      <Text style={cm.btnTxt}>Continuer</Text>
                      <Ionicons name="chevron-forward" size={16} color="white" />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[cm.nextBtn, publishing && { opacity: 0.6 }]}
                    onPress={publish}
                    disabled={publishing}
                  >
                    <LinearGradient
                      colors={[C.teal, C.navy]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={cm.btnGrad}
                    >
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
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  kav:          { flex: 1, justifyContent: 'flex-end' },
  sheet:        { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  inner:        { flex: 1 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.textTert, alignSelf: 'center', marginTop: 12 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  modalTitle:   { color: C.text, fontSize: 20, fontWeight: '800' },
  modalSub:     { color: C.textTert, fontSize: 12, marginTop: 2 },
  closeBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  progressRow:  { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 6 },
  progressBar:  { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.surf },
  stepHint:     { color: C.textTert, fontSize: 11, fontWeight: '600', paddingHorizontal: 20, marginBottom: 16 },
  scroll:       { flex: 1 },
  stepWrap:     { paddingHorizontal: 20 },
  sectionHead:  { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  hint:         { color: C.textTert, fontSize: 12, lineHeight: 17, marginBottom: 20, fontStyle: 'italic' },
  field:        { marginBottom: 20 },
  label:        { color: C.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  input:        { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  textarea:     { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 14, minHeight: 140, lineHeight: 22 },
  row2:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chipRow:      { gap: 8, paddingVertical: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:       { borderColor: C.teal, backgroundColor: C.tealDim },
  chipTxt:      { color: C.textSec, fontSize: 13, fontWeight: '600' },
  toneGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toneCard:     { width: (W - 40 - 10) / 2, paddingVertical: 14, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 6 },
  toneLbl:      { color: C.textSec, fontSize: 13, fontWeight: '600' },
  charBg:       { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.surf, overflow: 'hidden' },
  charFill:     { height: '100%', borderRadius: 2 },
  charCount:    { color: C.textTert, fontSize: 11, fontWeight: '600', minWidth: 50, textAlign: 'right' },
  pickBtn:      { height: 180, borderRadius: 16, borderWidth: 1.5, borderColor: C.borderHi, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', marginBottom: 20 },
  imgWrap:      { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  imgPreview:   { width: '100%', height: '100%' },
  validBadge:   { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  imgLoader:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  changeImgBtn: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  errTxt:       { color: C.red, fontSize: 12, marginBottom: 12 },
  previewCard:  { height: 200, borderRadius: 18, overflow: 'hidden', marginBottom: 16, backgroundColor: C.navy },
  previewImg:   { width: '100%', height: '100%' },
  previewOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  previewTitle: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  previewMeta:  { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 },
  tonePill:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  tonePillTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  previewBody:  { backgroundColor: C.surf, borderRadius: 14, padding: 14, marginBottom: 14 },
  checklist:    { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10, marginBottom: 16 },
  checkRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 12 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 12 },
  nextBtn:      { flex: 1, borderRadius: 22, overflow: 'hidden' },
  btnGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnTxt:       { color: 'white', fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE BAR
// ─────────────────────────────────────────────────────────────────────────────
const ComposeBar = memo(function ComposeBar({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={cbar.wrap} onPress={onPress} activeOpacity={0.88}>
      <LinearGradient
        colors={[C.tealSoft, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Image source={{ uri: 'https://i.pravatar.cc/100?u=me' }} style={cbar.avi} />
      <View style={cbar.body}>
        <Text style={cbar.title}>Partagez votre critique</Text>
        <Text style={cbar.sub}>Analyse · Coup de cœur · Réflexion · Déception</Text>
        <View style={cbar.pills}>
          {([
            { icon: 'film-outline',  label: 'Œuvre',  color: C.teal },
            { icon: 'star-outline',  label: 'Note',   color: C.gold },
            { icon: 'image-outline', label: 'Visuel', color: '#7DD3FC' },
          ] as const).map(p => (
            <View key={p.label} style={[cbar.pill, { backgroundColor: `${p.color}12`, borderColor: `${p.color}28` }]}>
              <Ionicons name={p.icon} size={11} color={p.color} />
              <Text style={[cbar.pillTxt, { color: p.color }]}>{p.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="create-outline" size={24} color={C.teal} />
    </TouchableOpacity>
  );
});

const cbar = StyleSheet.create({
  wrap:    { marginHorizontal: EDGE, marginBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: C.borderHi, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, overflow: 'hidden' },
  avi:     { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.borderHi },
  body:    { flex: 1, gap: 3 },
  title:   { color: C.text, fontSize: 14, fontWeight: '700' },
  sub:     { color: C.textTert, fontSize: 11, fontStyle: 'italic' },
  pills:   { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  pillTxt: { fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = memo(function PostCard({
  post, userId,
}: { post: Post; userId: string }) {
  const router = useRouter();
  const { liked, toggleLike, sharePost } = useContext(InteractionCtx);

  const isLiked  = !!liked[post.id];
  const likeScale = useRef(new Animated.Value(1)).current;

  const onLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.45, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(likeScale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
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
  const metaStr   = [post.work_director, post.work_year].filter(Boolean).join(' · ');

  return (
    <View style={pcs.card}>

      {/* Image + overlay titre */}
      <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/film/${post.id}`)}>
        <Image source={imgSource} style={pcs.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(3,0,10,0.90)']}
          style={pcs.imgGrad}
        />
        {/* Badge ton */}
        <View style={[pcs.toneBadge, { backgroundColor: `${toneInfo.color}22`, borderColor: `${toneInfo.color}45` }]}>
          <Ionicons name={toneInfo.icon as any} size={11} color={toneInfo.color} />
          <Text style={[pcs.toneBadgeTxt, { color: toneInfo.color }]}>{toneInfo.label}</Text>
        </View>
        {/* Film overlay */}
        <View style={pcs.filmOverlay}>
          <Text style={pcs.filmTitle} numberOfLines={1}>{post.work_title || 'Œuvre inconnue'}</Text>
          {metaStr.length > 0 && <Text style={pcs.filmMeta}>{metaStr}</Text>}
          <StarRating value={post.rating} size={12} />
        </View>
      </TouchableOpacity>

      {/* Corps */}
      <View style={pcs.body}>

        {/* Auteur */}
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

        {/* Texte critique */}
        <Text style={pcs.content} numberOfLines={4}>{post.content}</Text>

        {/* Tags */}
        {post.tags.length > 0 && (
          <View style={pcs.tagRow}>
            {post.tags.slice(0, 3).map(tag => (
              <Text key={tag} style={pcs.tag}>#{tag}</Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={pcs.actions}>
          <TouchableOpacity style={pcs.action} onPress={onLike} activeOpacity={0.75}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
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
            <Ionicons name="chatbubble-outline" size={18} color={C.textSec} />
          </TouchableOpacity>

          <TouchableOpacity
            style={pcs.action}
            onPress={() => sharePost(post.id, post.work_title, userId)}
            activeOpacity={0.75}
          >
            <Ionicons name="share-outline" size={20} color={C.textSec} />
            <Text style={pcs.actionTxt}>{post.shares}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={pcs.iconBtn} onPress={() => router.push(`/film/${post.id}`)}>
            <Ionicons name="information-circle-outline" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
});

const pcs = StyleSheet.create({
  card:         { marginHorizontal: EDGE, marginBottom: 22, borderRadius: 20, overflow: 'hidden', backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  img:          { width: '100%', height: 210 },
  imgGrad:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' },
  toneBadge:    { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  toneBadgeTxt: { fontSize: 10, fontWeight: '700' },
  filmOverlay:  { position: 'absolute', bottom: 12, left: 14, right: 14 },
  filmTitle:    { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  filmMeta:     { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 },
  body:         { padding: 14 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avi:          { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  authorName:   { color: C.text, fontSize: 14, fontWeight: '700' },
  authorTime:   { color: C.textTert, fontSize: 11, marginTop: 1 },
  genrePill:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: C.tealSoft, borderWidth: 1, borderColor: C.borderHi },
  genrePillTxt: { color: C.teal, fontSize: 10, fontWeight: '700' },
  content:      { color: C.textSec, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tagRow:       { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  tag:          { color: C.gold, fontSize: 11, fontWeight: '600' },
  actions:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  action:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf },
  actionTxt:    { color: C.textSec, fontSize: 12, fontWeight: '600' },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surf },
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
        <Text style={hdr.sub}>Le QG du cinéma indépendant</Text>
      </View>
      <View style={hdr.actions}>
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={20} color="white" />
          <View style={hdr.dot} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[hdr.btn, hdr.composeBtn]}
          onPress={onCompose}
        >
          <Ionicons name="create-outline" size={20} color={C.teal} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const hdr = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 10, paddingBottom: 16 },
  title:      { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  sub:        { fontSize: 12, color: C.textTert, marginTop: 2 },
  actions:    { flexDirection: 'row', gap: 10 },
  btn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  composeBtn: { backgroundColor: C.tealSoft, borderColor: C.borderHi },
  dot:        { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg0 },
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
            {on && (
              <LinearGradient
                colors={[C.teal, C.gold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={ft.line}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const ft = StyleSheet.create({
  row:  { flexDirection: 'row', paddingHorizontal: EDGE, gap: 24, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  pill: { paddingBottom: 14, alignItems: 'center', position: 'relative' },
  txt:  { color: C.textTert, fontSize: 15, fontWeight: '600' },
  txtOn:{ color: C.text,     fontWeight: '800' },
  line: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyFeed = memo(function EmptyFeed({ onCompose }: { onCompose: () => void }) {
  return (
    <View style={emp.wrap}>
      <Ionicons name="film-outline" size={56} color={C.textTert} />
      <Text style={emp.title}>Aucune critique ici</Text>
      <Text style={emp.sub}>Soyez le premier à partager votre avis sur un film indépendant.</Text>
      <TouchableOpacity style={emp.cta} onPress={onCompose}>
        <LinearGradient colors={[C.teal, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={emp.ctaGrad}>
          <Ionicons name="create-outline" size={18} color="white" />
          <Text style={emp.ctaTxt}>Écrire une critique</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

const emp = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 14 },
  title:  { color: C.textSec, fontSize: 18, fontWeight: '700' },
  sub:    { color: C.textTert, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  cta:    { borderRadius: 22, overflow: 'hidden', marginTop: 6 },
  ctaGrad:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
  ctaTxt: { color: 'white', fontSize: 14, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const [tab,         setTab]         = useState<FeedTab>('Pour vous');
  const [composeOpen, setComposeOpen] = useState(false);
  const [userId,      setUserId]      = useState('anonymous');

  // Récupérer l'ID de l'utilisateur connecté
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
    // Laisse le hook charger, puis retire le spinner
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  // ── renderItem ─────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <PostCard post={item} userId={userId} />
  ), [userId]);

  const keyExtractor = useCallback((item: Post) => item.id, []);

  // ── Header de liste ────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)} />
      <View style={{ height: 14 }} />
      <ComposeBar onPress={() => setComposeOpen(true)} />
      <View style={{ height: 6 }} />
      <FilterTabs active={tab} set={setTab} />
    </>
  ), [tab]);

  // ── Skeleton loading ───────────────────────────────────────────────────
  const ListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <ActivityIndicator color={C.teal} size="large" />
          <Text style={{ color: C.textTert, fontSize: 14, marginTop: 14 }}>
            Chargement des critiques…
          </Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.textTert} />
          <Text style={{ color: C.red, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>
            {error}
          </Text>
          <TouchableOpacity onPress={refresh} style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.teal, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
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
                tintColor={C.teal}
                colors={[C.teal]}
              />
            }
            // Perf
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
  root: { flex: 1, backgroundColor: C.bg0 },
});