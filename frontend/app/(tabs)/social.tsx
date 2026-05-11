import React, {
  useState, useCallback, useRef, useMemo, useEffect,
  useContext, createContext, memo,
} from 'react';
import {
  View, Text, StyleSheet, Animated, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Image, Platform, Modal,
  Pressable, KeyboardAvoidingView, ScrollView, TextInput,
  Alert, Share, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system';
import * as Haptics       from 'expo-haptics';
import { decode }         from 'base64-arraybuffer';
import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS — inlinés, zéro import externe
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const EDGE = 18;

const C = {
  bg0:        '#020810',
  bg1:        '#060F1E',
  surf:       'rgba(13,34,64,0.55)',
  surfHi:     'rgba(13,34,64,0.82)',
  border:     'rgba(255,255,255,0.07)',
  borderHi:   'rgba(255,255,255,0.16)',
  borderBlue: 'rgba(90,150,230,0.24)',
  text:       '#EEF4FF',
  textSec:    '#7A99BE',
  textTert:   '#2E4A68',
  blue:       '#5A96E6',
  blueDim:    'rgba(90,150,230,0.13)',
  blueMid:    'rgba(90,150,230,0.22)',
  navyMid:    '#0D2240',
  navyLight:  '#163356',
  navyBright: '#1E4A7A',
  gold:       '#F5C842',
  goldDim:    'rgba(245,200,66,0.12)',
  goldEdge:   'rgba(245,200,66,0.28)',
  green:      '#2ECC8A',
  greenDim:   'rgba(46,204,138,0.12)',
  greenEdge:  'rgba(46,204,138,0.28)',
  red:        '#FF3B5C',
  white:      '#FFFFFF',
} as const;

const TONE_KEYS = [
  'analyse','coup de coeur','deception','reflexion',
  'détente','neutre','mitigé','enthousiaste',
] as const;
type Tone = typeof TONE_KEYS[number];

const TONES: { key: Tone; label: string; icon: string; color: string }[] = [
  { key:'analyse',       label:'Analyse',      icon:'flask-outline',        color:C.blue    },
  { key:'coup de coeur', label:'Coup de cœur', icon:'heart-outline',        color:C.red     },
  { key:'deception',     label:'Déception',    icon:'thunderstorm-outline', color:C.gold    },
  { key:'reflexion',     label:'Réflexion',    icon:'bulb-outline',         color:'#A8C8F0' },
  { key:'détente',       label:'Détente',      icon:'cafe-outline',         color:'#86EEFF' },
  { key:'neutre',        label:'Neutre',       icon:'ellipse-outline',      color:C.textSec },
  { key:'mitigé',        label:'Mitigé',       icon:'remove-outline',       color:C.textSec },
  { key:'enthousiaste',  label:'Enthousiaste', icon:'star-outline',         color:C.gold    },
];

const GENRES_LIST = [
  'Drame','Thriller','Sci-Fi','Documentaire',
  'Animation','Court métrage','Expérimental','Biopic',
] as const;

const ASPECTS = [
  'Photographie','Musique','Scénario','Montage',
  'Interprétation','Rythme','Atmosphère','Décors',
];

const FEED_TABS = ['Pour vous','Tendances','Pros'] as const;
type FeedTab = typeof FEED_TABS[number];

const MIN_BODY    = 80;
const POSTS_LIMIT = 40;

const PRO_ROLES = [
  'Tous','Réalisateur·ice','Producteur·ice','Acteur·ice',
  'Scénariste','Directeur·ice photo','Compositeur·ice',
  'Monteur·euse','Distributeur·ice',
] as const;

const CONTACT_SUBJECTS = [
  'Collaboration projet','Casting','Co-production',
  'Mentorat','Projection / Festival','Autre',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SupabasePost {
  id: string;
  user_id: string;
  work_id: number | null; // ✅ nullable
  work_title: string;
  work_year: string;
  work_director: string;
  work_genre: string;
  rating: number;
  body: string;
  image_url: string | null;
  image_valid: boolean | null;
  tags: string[] | null;
  tone: string | null;
  likes_count: number | null;
  shares_count: number | null;
  created_at: string;

  profiles?: { display_name: string; avatar_url: string } | null;
}

interface Post {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  timeAgo: string;
  content: string;
  likes: number;
  shares: number;
  workId: number; 
  work_title: string;
  work_year: string;
  work_director: string;
  work_genre: string;
  rating: number;
  image_url: string;
  tags: string[];
  tone: Tone;
}

interface Pro {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  bio: string | null;
  films: string[];
  location: string | null;
  contact_email: string | null;
  website: string | null;
  verified: boolean;
  open_to: string[];
  created_at: string;
}



// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtTimeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return "à l'instant";
  if (s < 3600)  return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

function mapPost(r: SupabasePost): Post {
  const tone: Tone = (r.tone && (TONE_KEYS as readonly string[]).includes(r.tone))
    ? (r.tone as Tone)
    : 'analyse';

  return {
    id:            r.id,
    userId:        r.user_id,
    userName:      r.profiles?.display_name ?? 'Cinéphile',
    avatar:        r.profiles?.avatar_url   ?? `https://i.pravatar.cc/80?u=${r.user_id}`,
    timeAgo:       fmtTimeAgo(r.created_at),
    content:       r.body           ?? '',
    likes:         r.likes_count    ?? 0,
    shares:        r.shares_count   ?? 0,

    // ✅ work_id nullable
    workId:        r.work_id ?? 0,

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

// Champs sélectionnés — correspond aux colonnes de community_posts_enriched
const FEED_FIELDS =
  'id,user_id,work_id,work_title,work_year,work_director,' +
  'work_genre,rating,body,image_url,image_valid,' +
  'tags,tone,likes_count,shares_count,created_at';

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE DB HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function dbToggleLike(postId: string, userId: string, wasLiked: boolean) {
  try {
    if (wasLiked) {
      await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
      await supabase.rpc('decrement_likes', { pid: postId });
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
      await supabase.rpc('increment_likes', { pid: postId });
    }
  } catch (e) { console.error('[dbToggleLike]', e); }
}

async function dbRecordShare(postId: string, userId: string, platform: string) {
  try {
    await supabase.from('post_shares').insert({ post_id: postId, user_id: userId, platform });
  } catch {}
}

async function dbPublishPost(payload: {
  work_title: string; work_year: string; work_director: string;
  work_genre: string; rating: number; body: string;
  image_url: string; image_valid: boolean; tags: string[]; tone: string;
}): Promise<string | null> {
  try {
    // getSession lit localStorage immédiatement (sync sur web/Netlify)
    const { data: { session } } = await supabase.auth.getSession();
    let uid = session?.user?.id;
    if (!uid) {
      const { data: anon, error: ae } = await supabase.auth.signInAnonymously();
      if (ae) throw ae;
      uid = anon.session?.user?.id;
    }
    if (!uid) return null;
    const { data, error } = await supabase
      .from('community_posts')
      .insert({ ...payload, user_id: uid })
      .select('id')
      .single();
    if (error) throw error;
    return (data as any)?.id ?? null;
  } catch (e) { console.error('[dbPublishPost]', e); return null; }
}

async function dbContactPro(
  proId: string, subject: string, message: string, senderEmail: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pro_contact_requests')
      .insert({ pro_id: proId, subject, message, sender_email: senderEmail });
    return !error;
  } catch { return false; }
}

async function uploadImageToStorage(localUri: string): Promise<string | null> {
  try {
    const isBlob = localUri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (localUri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg','jpeg','png','webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const path   = `posts/post_${Date.now()}.${ext}`;
    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await (await fetch(localUri)).arrayBuffer();
    } else {
      payload = decode(
        await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' }),
      );
    }
    const { data, error } = await supabase.storage
      .from('community-images')
      .upload(path, payload, { contentType: mime, upsert: false });
    if (error) throw error;
    return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;
  } catch (e) { console.error('[uploadImage]', e); return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function usePostsFeed(tab: FeedTab) {
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (tab === 'Pros') { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('community_posts_enriched')
          .select(FEED_FIELDS)
          .order('created_at', { ascending: false })
          .limit(POSTS_LIMIT);
        if (cancelled) return;
        if (err) throw err;
        setPosts((data ?? []).filter((r): r is SupabasePost => r && typeof r === 'object' && 'id' in r).map(r => mapPost(r)));
      } catch {
        if (!cancelled) setError('Impossible de charger le feed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, refreshKey]);

  // Realtime INSERT — nouveau post en tête de liste
  useEffect(() => {
    if (tab === 'Pros') return;
    const ch = supabase
      .channel('social:realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        async (payload) => {
          const { data } = await supabase
            .from('community_posts')
            .select(FEED_FIELDS)
            .eq('id', payload.new.id)
            .single();
          if (!data) return;
          const p = mapPost(data as unknown as SupabasePost);
          setPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab]);

  // Like optimiste — update local puis DB
  const toggleLike = useCallback(async (
    postId: string, userId: string, wasLiked: boolean,
  ) => {
    setPosts(prev => prev.map(p =>
      p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? -1 : 1) },
    ));
    try {
      await dbToggleLike(postId, userId, wasLiked);
    } catch {
      // Rollback si erreur
      setPosts(prev => prev.map(p =>
        p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? 1 : -1) },
      ));
    }
  }, []);

  return { posts, loading, error, refresh, toggleLike };
}

function useProDirectory(search: string, role: string) {
  const [pros,    setPros]    = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let q = supabase
        .from('professionals')
        .select(
          'id,name,role,avatar,bio,films,location,' +
          'contact_email,website,verified,open_to,created_at',
        )
        .order('verified', { ascending: false })
        .order('name',     { ascending: true })
        .limit(80);
      if (role && role !== 'Tous') q = q.eq('role', role);
      if (search.trim())           q = q.ilike('name', `%${search.trim()}%`);
      const { data, error: err } = await q;
      if (err) throw err;
      setPros((data ?? []) as Pro[]);
    } catch {
      setError('Impossible de charger le répertoire.');
    } finally {
      setLoading(false);
    }
  }, [search, role]);

  useEffect(() => { load(); }, [load]);
  return { pros, loading, error, refresh: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT — optimistic like / save / share
// ─────────────────────────────────────────────────────────────────────────────
interface ICtx {
  liked:      Record<string, boolean>;
  saved:      Record<string, boolean>;
  toggleLike: (postId: string, userId: string) => void;
  toggleSave: (postId: string) => void;
  sharePost:  (postId: string, title: string, userId: string) => Promise<void>;
}

const InteractionCtx = createContext<ICtx>({
  liked: {}, saved: {},
  toggleLike: () => {}, toggleSave: () => {}, sharePost: async () => {},
});

function InteractionProvider({
  children, onToggleLike,
}: {
  children: React.ReactNode;
  onToggleLike: (id: string, uid: string, was: boolean) => void;
}) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const toggleLike = useCallback((postId: string, userId: string) => {
    const was = !!liked[postId];
    setLiked(p => ({ ...p, [postId]: !was }));
    onToggleLike(postId, userId, was);
  }, [liked, onToggleLike]);

  const toggleSave = useCallback((id: string) => {
    setSaved(p => ({ ...p, [id]: !p[id] }));
  }, []);

  const sharePost = useCallback(async (postId: string, title: string, userId: string) => {
    try {
      const r = await Share.share({
        message: `Découvrez cette critique de "${title}" sur Universe App !`,
      });
      if (r.action === Share.sharedAction)
        await dbRecordShare(postId, userId, r.activityType ?? 'unknown');
    } catch {}
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
  value, size = 24, onChange,
}: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1,2,3,4,5].map(s => (
        <TouchableOpacity
          key={s}
          onPress={() => onChange?.(s)}
          disabled={!onChange}
          hitSlop={6 as any}
        >
          <Ionicons
            name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={value >= s || value >= s - 0.5 ? C.gold : C.textSec}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = memo(function PostCard({ post, userId }: { post: Post; userId: string }) {
  const router = useRouter();
  const { liked, saved, toggleLike, toggleSave, sharePost } = useContext(InteractionCtx);
  const isLiked = !!liked[post.id];
  const isSaved = !!saved[post.id];
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  const bounce = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.42, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(anim, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, []);

  const onLike = useCallback(() => {
    bounce(likeScale);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike(post.id, userId);
  }, [post.id, userId, toggleLike, likeScale, bounce]);

  const onSave = useCallback(() => {
    bounce(saveScale);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSave(post.id);
  }, [post.id, toggleSave, saveScale, bounce]);

  const toneInfo = useMemo(() => TONES.find(t => t.key === post.tone) ?? TONES[0], [post.tone]);

  const imgSrc = useMemo(() =>
    post.image_url
      ? { uri: post.image_url }
      : { uri: `https://picsum.photos/seed/${post.id}/800/450` },
  [post.image_url, post.id]);

  const metaStr = [post.work_director, post.work_year].filter(Boolean).join(' · ');

  return (
    <View style={pcs.card}>
      {/* ── Hero image ── */}
      <TouchableOpacity 
        activeOpacity={0.92} 
        onPress={() => {
          if (post.workId) router.push(`/film/${post.workId}` as any);
        }}
      >
        <Image source={imgSrc} style={pcs.img} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(2,8,16,0.94)']} style={pcs.imgGrad} />

        {/* Tone badge */}
        <View style={[pcs.toneBadge, { borderColor: `${toneInfo.color}30` }]}>
          <Ionicons name={toneInfo.icon as any} size={10} color={toneInfo.color} />
          <Text style={[pcs.toneTxt, { color: toneInfo.color }]}>{toneInfo.label}</Text>
        </View>

        {/* Film info */}
        <View style={pcs.filmOverlay}>
          <Text style={pcs.filmTitle} numberOfLines={1}>
            {post.work_title || 'Œuvre inconnue'}
          </Text>
          {metaStr.length > 0 && <Text style={pcs.filmMeta}>{metaStr}</Text>}
          <StarRating value={post.rating} size={11} />
        </View>
      </TouchableOpacity>

      {/* ── Body ── */}
      <View style={pcs.body}>
        {/* Author */}
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

        {/* Content */}
        <Text style={pcs.content} numberOfLines={4}>{post.content}</Text>

        {/* Tags */}
        {post.tags.length > 0 && (
          <View style={pcs.tagRow}>
            {post.tags.slice(0, 3).map(tag => (
              <Text key={tag} style={pcs.tag}>#{tag}</Text>
            ))}
          </View>
        )}

        <View style={pcs.divider} />

        {/* Actions */}
        <View style={pcs.actions}>
          <TouchableOpacity style={pcs.action} onPress={onLike} activeOpacity={0.78}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'} size={18}
                color={isLiked ? C.red : C.textSec}
              />
            </Animated.View>
            <Text style={[pcs.actionTxt, isLiked && { color: C.red }]}>
              {post.likes + (isLiked ? 1 : 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={pcs.action}
            onPress={() => router.push(`/film/${post.id}` as any)}
            activeOpacity={0.78}
          >
            <Ionicons name="chatbubble-outline" size={17} color={C.textSec} />
          </TouchableOpacity>

          <TouchableOpacity
            style={pcs.action}
            onPress={() => sharePost(post.id, post.work_title, userId)}
            activeOpacity={0.78}
          >
            <Ionicons name="share-outline" size={18} color={C.textSec} />
            <Text style={pcs.actionTxt}>{post.shares}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={pcs.action} onPress={onSave} activeOpacity={0.78}>
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18}
                color={isSaved ? C.gold : C.textSec}
              />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={pcs.arrowBtn}
            onPress={() => router.push(`/film/${post.id}` as any)}
          >
            <Ionicons name="arrow-forward" size={14} color={C.textSec} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const pcs = StyleSheet.create({
  card:        { marginHorizontal: EDGE, marginBottom: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.surf },
  img:         { width: '100%', height: 205 },
  imgGrad:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%' },
  toneBadge:   { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(2,8,16,0.72)', borderWidth: 1 },
  toneTxt:     { fontSize: 10, fontWeight: '700' },
  filmOverlay: { position: 'absolute', bottom: 12, left: 14, right: 14 },
  filmTitle:   { color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  filmMeta:    { color: 'rgba(255,255,255,0.42)', fontSize: 11, marginBottom: 6 },
  body:        { padding: 14 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avi:         { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border },
  authorName:  { color: C.text, fontSize: 13, fontWeight: '700' },
  authorTime:  { color: C.textSec, fontSize: 10, marginTop: 1 },
  genrePill:   { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderBlue },
  genrePillTxt:{ color: C.textSec, fontSize: 10, fontWeight: '700' },
  content:     { color: C.textSec, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tagRow:      { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tag:         { color: C.gold, fontSize: 11, fontWeight: '600' },
  divider:     { height: 1, backgroundColor: C.border, marginBottom: 12 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  action:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 14 },
  actionTxt:   { color: C.textSec, fontSize: 12, fontWeight: '600' },
  arrowBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navyLight },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL — wizard 4 étapes
// ─────────────────────────────────────────────────────────────────────────────
const COMPOSE_STEPS = ['film', 'critique', 'media', 'preview'] as const;
type CStep = typeof COMPOSE_STEPS[number];

const STEP_LBL:  Record<CStep, string> = { film: "L'Œuvre", critique: 'Critique', media: 'Image', preview: 'Aperçu' };
const STEP_ICON: Record<CStep, string> = { film: 'film-outline', critique: 'create-outline', media: 'image-outline', preview: 'eye-outline' };

interface ComposeState {
  workTitle: string; workYear: string; workDirector: string; workGenre: string;
  rating: number; tone: Tone | null; body: string; tags: string[];
  imageUri: string; imageUrl: string; imageValid: boolean;
}

const INIT_FORM: ComposeState = {
  workTitle: '', workYear: '', workDirector: '', workGenre: '',
  rating: 0, tone: null, body: '', tags: [], imageUri: '', imageUrl: '', imageValid: false,
};

function ComposeModal({
  visible, onClose, onPublished, userId,
}: {
  visible: boolean; onClose: () => void; onPublished?: () => void; userId: string;
}) {
  const [step,       setStep]       = useState<CStep>('film');
  const [form,       setForm]       = useState<ComposeState>(INIT_FORM);
  const [publishing, setPublishing] = useState(false);
  const [imgLoading, setImgLoad]    = useState(false);
  const [errors,     setErrors]     = useState<Partial<Record<CStep, string>>>({});
  const slideAnim = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (visible) {
      setStep('film'); setForm(INIT_FORM); setErrors({});
      Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 800, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const patch  = useCallback(<K extends keyof ComposeState>(k: K, v: ComposeState[K]) =>
    setForm(f => ({ ...f, [k]: v })), []);
  const setErr = (s: CStep, m: string) => setErrors(e => ({ ...e, [s]: m }));
  const clrErr = (s: CStep) => setErrors(e => ({ ...e, [s]: '' }));

  const validate = useCallback((s: CStep): string | null => {
    if (s === 'film') {
      if (!form.workTitle.trim()) return 'Titre obligatoire.';
      if (!form.workGenre)        return 'Sélectionnez un genre.';
      if (form.rating === 0)      return 'Attribuez au moins une étoile.';
    }
    if (s === 'critique') {
      if (!form.tone)                         return 'Choisissez un ton.';
      if (form.body.trim().length < MIN_BODY) return `Min ${MIN_BODY} car. (actuel: ${form.body.trim().length}).`;
    }
    return null;
  }, [form]);

  const goNext = useCallback(() => {
    const err = validate(step);
    if (err) { setErr(step, err); return; }
    clrErr(step);
    const i = COMPOSE_STEPS.indexOf(step);
    if (i < COMPOSE_STEPS.length - 1) setStep(COMPOSE_STEPS[i + 1]);
  }, [step, validate]);

  const goBack = useCallback(() => {
    const i = COMPOSE_STEPS.indexOf(step);
    if (i > 0) setStep(COMPOSE_STEPS[i - 1]);
  }, [step]);

  const pickImage = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission requise', "Autorisez la galerie."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85,
      allowsEditing: true, aspect: [16, 9],
    });
    if (res.canceled || !res.assets?.[0]) return;
    patch('imageUri', res.assets[0].uri);
    patch('imageValid', false); patch('imageUrl', '');
    setImgLoad(true); clrErr('media');
    const url = await uploadImageToStorage(res.assets[0].uri);
    setImgLoad(false);
    if (!url) { setErr('media', 'Upload échoué. Réessayez.'); return; }
    patch('imageUrl', url); patch('imageValid', true);
  }, [patch]);

  const publish = useCallback(async () => {
    if (!form.imageValid) { Alert.alert('Image manquante'); return; }
    if (!form.tone)       { Alert.alert('Ton manquant'); return; }
    setPublishing(true);
    const id = await dbPublishPost({
      work_title: form.workTitle.trim(), work_year: form.workYear.trim(),
      work_director: form.workDirector.trim(), work_genre: form.workGenre,
      rating: form.rating, body: form.body.trim(),
      image_url: form.imageUrl, image_valid: true,
      tags: form.tags, tone: form.tone,
    });
    setPublishing(false);
    if (id) { onPublished?.(); onClose(); }
    else Alert.alert('Erreur', 'Publication échouée. Réessayez.');
  }, [form, onPublished, onClose]);

  const stepIdx  = COMPOSE_STEPS.indexOf(step);
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
            <View style={cm.tint} pointerEvents="none" />
            <View style={cm.inner}>
              <View style={cm.handle} />

              {/* Header */}
              <View style={cm.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cm.title}>Nouvelle Critique</Text>
                  <Text style={cm.sub}>Cinéma indépendant · Critique argumentée</Text>
                </View>
                <TouchableOpacity style={cm.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={15} color={C.textSec} />
                </TouchableOpacity>
              </View>

              {/* Stepper */}
              <View style={cm.stepRow}>
                {COMPOSE_STEPS.map((st, i) => {
                  const done = i < stepIdx, curr = i === stepIdx;
                  return (
                    <View key={st} style={cm.stepItem}>
                      <View style={[cm.stepCircle, done && cm.stepDone, curr && cm.stepCurr]}>
                        {done
                          ? <Ionicons name="checkmark" size={11} color={C.white} />
                          : <Ionicons name={STEP_ICON[st] as any} size={11} color={curr ? C.white : C.textSec} />
                        }
                      </View>
                      <Text style={[cm.stepLbl, curr && { color: C.text }, done && { color: C.textSec }]}>
                        {STEP_LBL[st]}
                      </Text>
                      {i < COMPOSE_STEPS.length - 1 && (
                        <View style={[cm.stepLine, done && { backgroundColor: C.navyBright }]} />
                      )}
                    </View>
                  );
                })}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={cm.stepWrap}>

                  {/* ── FILM ── */}
                  {step === 'film' && (
                    <>
                      <Text style={cm.sectionHead}>Identifiez l'œuvre</Text>
                      <Text style={cm.hint}>Seules les œuvres de cinéma indépendant sont acceptées.</Text>
                      <Text style={cm.label}>TITRE *</Text>
                      <TextInput
                        style={cm.input} placeholderTextColor={C.textTert}
                        placeholder="Ex : Portrait de la jeune fille en feu"
                        value={form.workTitle}
                        onChangeText={v => { patch('workTitle', v); clrErr('film'); }}
                      />
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={cm.label}>RÉALISATEUR</Text>
                          <TextInput style={cm.input} placeholder="Nom" placeholderTextColor={C.textTert}
                            value={form.workDirector} onChangeText={v => patch('workDirector', v)} />
                        </View>
                        <View style={{ width: 86 }}>
                          <Text style={cm.label}>ANNÉE</Text>
                          <TextInput style={cm.input} placeholder="2025" placeholderTextColor={C.textTert}
                            value={form.workYear} onChangeText={v => patch('workYear', v)}
                            keyboardType="numeric" maxLength={4} />
                        </View>
                      </View>
                      <Text style={cm.label}>GENRE *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 20 }}>
                        {GENRES_LIST.map(g => {
                          const on = form.workGenre === g;
                          return (
                            <TouchableOpacity key={g}
                              style={[cm.chip, on && cm.chipOn]}
                              onPress={() => { patch('workGenre', g); clrErr('film'); }}>
                              <Text style={[cm.chipTxt, on && { color: C.white }]}>{g}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <Text style={cm.label}>NOTE *</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                        <StarRating value={form.rating} onChange={v => { patch('rating', v); clrErr('film'); }} />
                        <View style={cm.ratingBadge}>
                          <Text style={cm.ratingTxt}>{form.rating > 0 ? `${form.rating}/5` : '--'}</Text>
                        </View>
                      </View>
                      {errors.film && <Text style={cm.err}>{errors.film}</Text>}
                    </>
                  )}

                  {/* ── CRITIQUE ── */}
                  {step === 'critique' && (
                    <>
                      <Text style={cm.sectionHead}>Votre critique</Text>
                      <Text style={cm.hint}>Minimum {MIN_BODY} caractères. Argumentez et nuancez.</Text>
                      <Text style={cm.label}>TON *</Text>
                      {[TONES.slice(0, 4), TONES.slice(4)].map((row, ri) => (
                        <View key={ri} style={[cm.toneGrid, { marginBottom: 10 }]}>
                          {row.map(t => {
                            const on = form.tone === t.key;
                            return (
                              <TouchableOpacity key={t.key}
                                style={[cm.toneCard, on && { borderColor: t.color, backgroundColor: `${t.color}16` }]}
                                onPress={() => { patch('tone', t.key); clrErr('critique'); }}>
                                <View style={[cm.toneIcon, on && { backgroundColor: `${t.color}22` }]}>
                                  <Ionicons name={t.icon as any} size={20} color={on ? t.color : C.textSec} />
                                </View>
                                <Text style={[cm.toneLbl, on && { color: t.color }]}>{t.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                      <Text style={cm.label}>CRITIQUE *</Text>
                      <TextInput style={cm.textarea} multiline textAlignVertical="top"
                        placeholder="Analysez la mise en scène, le jeu des acteurs, la narration…"
                        placeholderTextColor={C.textTert}
                        value={form.body} onChangeText={v => { patch('body', v); clrErr('critique'); }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 20 }}>
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
                      <Text style={cm.label}>ASPECTS (optionnel)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 16 }}>
                        {ASPECTS.map(tag => {
                          const on = form.tags.includes(tag);
                          return (
                            <TouchableOpacity key={tag}
                              style={[cm.chip, on && { borderColor: C.gold, backgroundColor: C.goldDim }]}
                              onPress={() =>
                                patch('tags', on ? form.tags.filter(t => t !== tag) : [...form.tags, tag])
                              }>
                              <Text style={[cm.chipTxt, on && { color: C.gold }]}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      {errors.critique && <Text style={cm.err}>{errors.critique}</Text>}
                    </>
                  )}

                  {/* ── MEDIA ── */}
                  {step === 'media' && (
                    <>
                      <Text style={cm.sectionHead}>Illustration</Text>
                      <Text style={cm.hint}>Une image de l'œuvre est requise avant publication.</Text>
                      {form.imageUri ? (
                        <View style={cm.imgWrap}>
                          <Image source={{ uri: form.imageUri }} style={cm.imgPreview} resizeMode="cover" />
                          <LinearGradient colors={['transparent', 'rgba(2,8,16,0.80)']} style={StyleSheet.absoluteFillObject} />
                          {form.imageValid && !imgLoading && (
                            <View style={cm.validBadge}>
                              <Ionicons name="checkmark-circle" size={13} color={C.green} />
                              <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>Image prête</Text>
                            </View>
                          )}
                          {imgLoading && (
                            <View style={cm.imgLoader}>
                              <ActivityIndicator color={C.blue} />
                            </View>
                          )}
                          {!imgLoading && (
                            <TouchableOpacity style={cm.changeBtn} onPress={pickImage}>
                              <Ionicons name="refresh-outline" size={12} color={C.textSec} />
                              <Text style={{ color: C.textSec, fontSize: 11 }}>Changer</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <TouchableOpacity style={cm.pickBtn} onPress={pickImage} disabled={imgLoading}>
                          <View style={cm.pickIcon}>
                            <Ionicons name="image-outline" size={36} color={C.blue} />
                          </View>
                          <Text style={cm.pickTitle}>Sélectionner depuis la galerie</Text>
                          <Text style={cm.pickSub}>JPEG · PNG · Format 16:9 recommandé</Text>
                        </TouchableOpacity>
                      )}
                      {errors.media && <Text style={cm.err}>{errors.media}</Text>}
                    </>
                  )}

                  {/* ── PREVIEW ── */}
                  {step === 'preview' && (
                    <>
                      <Text style={cm.sectionHead}>Aperçu final</Text>
                      <View style={cm.previewCard}>
                        {form.imageUrl
                          ? <Image source={{ uri: form.imageUrl }} style={cm.previewImg} resizeMode="cover" />
                          : <View style={[cm.previewImg, { backgroundColor: C.navyMid }]} />
                        }
                        <LinearGradient colors={['transparent', 'rgba(2,8,16,0.94)']} style={StyleSheet.absoluteFillObject} />
                        <View style={cm.previewOverlay}>
                          {toneInfo && (
                            <View style={[cm.tonePill, {
                              backgroundColor: `${toneInfo.color}20`,
                              borderColor: `${toneInfo.color}40`,
                            }]}>
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
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                          {form.tags.map(tag => (
                            <Text key={tag} style={{ color: C.gold, fontSize: 11, fontWeight: '600' }}>#{tag}</Text>
                          ))}
                        </View>
                      )}
                      <View style={cm.checklist}>
                        {[
                          { ok: form.workTitle.trim().length > 0, txt: 'Œuvre identifiée' },
                          { ok: form.rating > 0,                  txt: 'Note attribuée' },
                          { ok: form.tone !== null,               txt: 'Ton défini' },
                          { ok: bodyLen >= MIN_BODY,              txt: `Critique ≥ ${MIN_BODY} car.` },
                          { ok: form.imageValid,                  txt: 'Image uploadée' },
                        ].map(item => (
                          <View key={item.txt} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                            <Ionicons
                              name={item.ok ? 'checkmark-circle' : 'ellipse-outline'}
                              size={15}
                              color={item.ok ? C.green : C.textTert}
                            />
                            <Text style={{ color: item.ok ? C.textSec : C.textTert, fontSize: 13 }}>
                              {item.txt}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                </View>
                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Footer */}
              <View style={cm.footer}>
                {stepIdx > 0 && (
                  <TouchableOpacity style={cm.backBtn} onPress={goBack}>
                    <Ionicons name="chevron-back" size={15} color={C.textSec} />
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
                      <Ionicons name="chevron-forward" size={14} color={C.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[cm.nextBtn, publishing && { opacity: 0.55 }]}
                    onPress={publish} disabled={publishing}
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
                            <Ionicons name="send" size={14} color={C.white} />
                            <Text style={cm.btnTxt}>Publier</Text>
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
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,8,16,0.82)' },
  kav:          { flex: 1, justifyContent: 'flex-end' },
  sheet:        { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  tint:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,15,30,0.62)' },
  inner:        { flex: 1 },
  handle:       { width: 38, height: 4, borderRadius: 2, backgroundColor: C.navyLight, alignSelf: 'center', marginTop: 12 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title:        { color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  sub:          { color: C.textTert, fontSize: 11, marginTop: 3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  stepRow:      { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, alignItems: 'flex-start' },
  stepItem:     { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle:   { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepDone:     { backgroundColor: C.navyBright, borderColor: C.navyBright },
  stepCurr:     { backgroundColor: C.navyLight, borderColor: C.borderHi },
  stepLbl:      { color: C.textTert, fontSize: 9, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  stepLine:     { position: 'absolute', top: 14, left: '50%', right: '-50%', height: 1, backgroundColor: C.border },
  stepWrap:     { paddingHorizontal: 20 },
  sectionHead:  { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  hint:         { color: C.textTert, fontSize: 12, lineHeight: 17, marginBottom: 20 },
  label:        { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  input:        { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15, marginBottom: 20 },
  textarea:     { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 14, minHeight: 140, lineHeight: 22 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:       { borderColor: C.borderHi, backgroundColor: C.navyLight },
  chipTxt:      { color: C.textSec, fontSize: 13, fontWeight: '600' },
  ratingBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.goldDim, borderWidth: 1, borderColor: C.goldEdge },
  ratingTxt:    { color: C.gold, fontSize: 14, fontWeight: '800' },
  toneGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  toneCard:     { width: '48%', paddingVertical: 16, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 8 },
  toneIcon:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.navyMid, justifyContent: 'center', alignItems: 'center' },
  toneLbl:      { color: C.textSec, fontSize: 13, fontWeight: '700' },
  charBg:       { flex: 1, height: 2, borderRadius: 1, backgroundColor: C.surf, overflow: 'hidden' },
  charFill:     { height: '100%', borderRadius: 1 },
  charCount:    { color: C.textSec, fontSize: 11, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  imgWrap:      { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  imgPreview:   { width: '100%', height: '100%' },
  validBadge:   { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(2,8,16,0.80)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  imgLoader:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,8,16,0.65)', alignItems: 'center', justifyContent: 'center' },
  changeBtn:    { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,8,16,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  pickBtn:      { height: 180, borderRadius: 16, borderWidth: 1, borderColor: C.borderBlue, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  pickIcon:     { width: 64, height: 64, borderRadius: 32, backgroundColor: C.blueDim, justifyContent: 'center', alignItems: 'center' },
  pickTitle:    { color: C.text, fontSize: 14, fontWeight: '700' },
  pickSub:      { color: C.textSec, fontSize: 11 },
  err:          { color: C.red, fontSize: 12, marginBottom: 12, fontWeight: '600' },
  previewCard:  { height: 200, borderRadius: 18, overflow: 'hidden', marginBottom: 16, backgroundColor: C.navyMid },
  previewImg:   { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  previewTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  previewMeta:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 7 },
  tonePill:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginBottom: 7 },
  tonePillTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  previewBody:  { backgroundColor: C.surf, borderRadius: 14, padding: 14, marginBottom: 14 },
  checklist:    { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 11, marginBottom: 16 },
  footer:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 12 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
  nextBtn:      { flex: 1, borderRadius: 22, overflow: 'hidden' },
  btnGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnTxt:       { color: C.white, fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT PRO MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ContactProModal({ pro, onClose }: { pro: Pro | null; onClose: () => void }) {
  const [subject,     setSubject]     = useState('');
  const [message,     setMessage]     = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const slideAnim    = useRef(new Animated.Value(900)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pro) {
      setSubject(''); setMessage(''); setSenderEmail(''); setSent(false);
      Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 900, duration: 220, useNativeDriver: true }).start();
    }
  }, [pro]);

  const handleSend = useCallback(async () => {
    if (!pro) return;
    if (!subject)                   { Alert.alert('Sujet requis'); return; }
    if (message.trim().length < 30) { Alert.alert('Message trop court', 'Minimum 30 caractères.'); return; }
    if (!senderEmail.includes('@')) { Alert.alert('Email invalide'); return; }
    setSending(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await dbContactPro(pro.id, subject, message.trim(), senderEmail.trim());
    setSending(false);
    if (ok) {
      setSent(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(successScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
      setTimeout(() => { setSent(false); onClose(); }, 2400);
    } else {
      Alert.alert('Erreur', 'Envoi impossible. Vérifiez votre connexion.');
    }
  }, [pro, subject, message, senderEmail, onClose]);

  if (!pro) return null;
  const canSend = !!subject && message.trim().length >= 30 && senderEmail.includes('@');

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={cpm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={cpm.kav}>
          <Animated.View style={[cpm.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={cpm.tint} pointerEvents="none" />

            {sent ? (
              <View style={cpm.successWrap}>
                <Animated.View style={{ transform: [{ scale: successScale }] }}>
                  <Ionicons name="checkmark-circle" size={56} color={C.green} />
                </Animated.View>
                <Text style={cpm.successTitle}>Message envoyé !</Text>
                <Text style={cpm.successSub}>{pro.name} vous répondra par email.</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={cpm.handle} />
                <View style={cpm.topRow}>
                  <Image
                    source={{ uri: pro.avatar ?? `https://i.pravatar.cc/80?u=${pro.id}` }}
                    style={cpm.proAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={cpm.proName} numberOfLines={1}>{pro.name}</Text>
                    <Text style={cpm.proRole}>{pro.role}</Text>
                  </View>
                  {pro.verified && (
                    <Ionicons name="checkmark-circle" size={18} color={C.blue} />
                  )}
                  <TouchableOpacity style={cpm.closeBtn} onPress={onClose} hitSlop={8 as any}>
                    <Ionicons name="close" size={14} color={C.textSec} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={cpm.scroll}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={cpm.label}>SUJET *</Text>
                  <View style={cpm.subjectGrid}>
                    {CONTACT_SUBJECTS.map(sub => {
                      const on = subject === sub;
                      return (
                        <TouchableOpacity key={sub}
                          style={[cpm.subjectChip, on && cpm.subjectChipOn]}
                          onPress={() => setSubject(on ? '' : sub)}>
                          <Text style={[cpm.subjectTxt, on && cpm.subjectTxtOn]}>{sub}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[cpm.label, { marginTop: 18 }]}>
                    MESSAGE * <Text style={cpm.minTxt}>(min 30 car.)</Text>
                  </Text>
                  <View style={cpm.textareaWrap}>
                    <TextInput
                      style={cpm.textarea} multiline textAlignVertical="top"
                      placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous contacte au sujet de…`}
                      placeholderTextColor={C.textTert}
                      value={message} onChangeText={setMessage} maxLength={800}
                    />
                    <Text style={[cpm.charCount, message.trim().length >= 30 && { color: C.green }]}>
                      {message.trim().length}/800
                    </Text>
                  </View>

                  <Text style={[cpm.label, { marginTop: 18 }]}>VOTRE EMAIL *</Text>
                  <View style={cpm.inputWrap}>
                    <Ionicons name="mail-outline" size={15} color={C.textTert} />
                    <TextInput
                      style={cpm.input} placeholder="votre@email.com"
                      placeholderTextColor={C.textTert}
                      value={senderEmail} onChangeText={setSenderEmail}
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    />
                  </View>

                  <View style={cpm.privacyNote}>
                    <Ionicons name="shield-checkmark-outline" size={12} color={C.textTert} />
                    <Text style={cpm.privacyTxt}>
                      Votre email n'est transmis qu'au professionnel contacté.
                    </Text>
                  </View>
                  <View style={{ height: 20 }} />
                </ScrollView>

                <View style={cpm.footer}>
                  <TouchableOpacity style={cpm.cancelBtn} onPress={onClose}>
                    <Text style={cpm.cancelTxt}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[cpm.sendBtn, !canSend && { opacity: 0.38 }]}
                    onPress={handleSend} disabled={!canSend || sending}
                  >
                    {sending
                      ? <ActivityIndicator color={C.white} size="small" />
                      : (
                        <>
                          <Ionicons name="send" size={14} color={C.white} />
                          <Text style={cpm.sendTxt}>Envoyer</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const cpm = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,8,16,0.84)' },
  kav:          { flex: 1, justifyContent: 'flex-end' },
  sheet:        { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  tint:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,15,30,0.65)' },
  handle:       { width: 38, height: 4, borderRadius: 2, backgroundColor: C.navyLight, alignSelf: 'center', marginTop: 12 },
  topRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 12 },
  proAvatar:    { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  proName:      { color: C.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  proRole:      { color: C.blue, fontSize: 11, fontWeight: '700', marginTop: 2 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  scroll:       { paddingHorizontal: 20, paddingTop: 14 },
  label:        { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  minTxt:       { color: C.textTert, fontWeight: '400', fontSize: 9 },
  subjectGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  subjectChip:  { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  subjectChipOn:{ backgroundColor: C.navyLight, borderColor: C.borderBlue },
  subjectTxt:   { color: C.textSec, fontSize: 12, fontWeight: '600' },
  subjectTxtOn: { color: C.blue, fontWeight: '700' },
  textareaWrap: { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  textarea:     { paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 14, minHeight: 130, lineHeight: 22 },
  charCount:    { color: C.textTert, fontSize: 10, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 8 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13 },
  input:        { flex: 1, color: C.text, fontSize: 14 },
  privacyNote:  { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: C.surf },
  privacyTxt:   { flex: 1, color: C.textTert, fontSize: 11, lineHeight: 16 },
  footer:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 18, borderTopWidth: 0.5, borderTopColor: C.border },
  cancelBtn:    { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 18, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  cancelTxt:    { color: C.textSec, fontSize: 14, fontWeight: '600' },
  sendBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 18, backgroundColor: C.navyBright, borderWidth: 1, borderColor: C.borderBlue },
  sendTxt:      { color: C.white, fontSize: 15, fontWeight: '700' },
  successWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  successTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  successSub:   { color: C.textSec, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRO CARD
// ─────────────────────────────────────────────────────────────────────────────
const ProCard = memo(function ProCard({ pro, onContact }: { pro: Pro; onContact: (p: Pro) => void }) {
  return (
    <View style={procard.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={procard.inner}>
        {/* Header */}
        <View style={procard.header}>
          <Image
            source={{ uri: pro.avatar ?? `https://i.pravatar.cc/120?u=${pro.id}` }}
            style={procard.avatar}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={procard.nameRow}>
              <Text style={procard.name} numberOfLines={1}>{pro.name}</Text>
              {pro.verified && (
                <View style={procard.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={11} color={C.blue} />
                  <Text style={procard.verifiedTxt}>Vérifié</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="briefcase-outline" size={11} color={C.blue} />
              <Text style={procard.role}>{pro.role}</Text>
            </View>
            {pro.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={11} color={C.textTert} />
                <Text style={procard.loc}>{pro.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bio */}
        {pro.bio && <Text style={procard.bio} numberOfLines={3}>{pro.bio}</Text>}

        {/* Films */}
        {pro.films.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            {pro.films.slice(0, 4).map(film => (
              <View key={film} style={procard.filmChip}>
                <Ionicons name="film-outline" size={10} color={C.textSec} />
                <Text style={procard.filmTxt} numberOfLines={1}>{film}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Open to */}
        {pro.open_to.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {pro.open_to.slice(0, 3).map(o => (
              <View key={o} style={procard.openChip}>
                <Text style={procard.openTxt}>{o}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={procard.actions}>
          <TouchableOpacity
            style={procard.contactBtn}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onContact(pro);
            }}
            activeOpacity={0.85}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 16 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={procard.contactInner}>
              <Ionicons name="mail-outline" size={14} color={C.white} />
              <Text style={procard.contactTxt}>Contacter</Text>
            </View>
          </TouchableOpacity>

          {pro.website && (
            <TouchableOpacity
              style={procard.webBtn}
              onPress={() => Linking.openURL(pro.website!).catch(() => {})}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={16} color={C.blue} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const procard = StyleSheet.create({
  wrap:         { marginHorizontal: EDGE, marginBottom: 14, borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(13,34,64,0.48)' },
  inner:        { padding: 16, gap: 12 },
  header:       { flexDirection: 'row', gap: 12 },
  avatar:       { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:         { color: C.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: C.blueDim, borderWidth: 0.5, borderColor: C.borderBlue },
  verifiedTxt:  { color: C.blue, fontSize: 9, fontWeight: '800' },
  role:         { color: C.blue, fontSize: 11, fontWeight: '700' },
  loc:          { color: C.textTert, fontSize: 10 },
  bio:          { color: C.textSec, fontSize: 13, lineHeight: 19 },
  filmChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.surf, borderWidth: 0.5, borderColor: C.border, maxWidth: 140 },
  filmTxt:      { color: C.textSec, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  openChip:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: C.greenDim, borderWidth: 0.5, borderColor: C.greenEdge },
  openTxt:      { color: C.green, fontSize: 10, fontWeight: '600' },
  actions:      { flexDirection: 'row', gap: 10 },
  contactBtn:   { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderBlue },
  contactInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11 },
  contactTxt:   { color: C.white, fontSize: 13, fontWeight: '700' },
  webBtn:       { width: 42, height: 42, borderRadius: 14, backgroundColor: C.surf, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRO DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────
function ProDirectory() {
  const [search,     setSearch]     = useState('');
  const [activeRole, setActiveRole] = useState('Tous');
  const [contactPro, setContactPro] = useState<Pro | null>(null);
  const { pros, loading, error, refresh } = useProDirectory(search, activeRole);

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={pdir.searchWrap}>
        <BlurView intensity={Platform.OS === 'ios' ? 16 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={pdir.searchRow}>
          <Ionicons name="search" size={15} color={C.textTert} />
          <TextInput
            style={pdir.searchInput}
            placeholder="Rechercher un professionnel…"
            placeholderTextColor={C.textTert}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8 as any}>
              <Ionicons name="close-circle" size={15} color={C.textTert} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Role filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: EDGE, gap: 8, paddingVertical: 4 }}
        style={{ maxHeight: 50, marginBottom: 14 }}
      >
        {PRO_ROLES.map(r => {
          const on = activeRole === r;
          return (
            <TouchableOpacity key={r}
              style={[pdir.roleChip, on && pdir.roleChipOn]}
              onPress={() => setActiveRole(r)} activeOpacity={0.8}>
              <Text style={[pdir.roleTxt, on && pdir.roleTxtOn]}>{r}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={pdir.center}>
          <ActivityIndicator color={C.blue} size="large" />
          <Text style={pdir.loadTxt}>Chargement du répertoire…</Text>
        </View>
      ) : error ? (
        <View style={pdir.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={C.textTert} />
          <Text style={{ color: C.red, fontSize: 13, marginTop: 10, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity style={pdir.retryBtn} onPress={refresh}>
            <Text style={{ color: C.white, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : pros.length === 0 ? (
        <View style={pdir.center}>
          <Ionicons name="people-outline" size={36} color={C.textTert} />
          <Text style={{ color: C.textSec, fontSize: 15, fontWeight: '700', marginTop: 12 }}>
            Aucun professionnel trouvé
          </Text>
          <Text style={{ color: C.textTert, fontSize: 13, marginTop: 6 }}>
            Modifiez votre recherche ou votre filtre
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <Text style={pdir.count}>{pros.length} professionnel{pros.length > 1 ? 's' : ''}</Text>
          {pros.map(pro => (
            <ProCard key={pro.id} pro={pro} onContact={setContactPro} />
          ))}
        </ScrollView>
      )}

      <ContactProModal pro={contactPro} onClose={() => setContactPro(null)} />
    </View>
  );
}

const pdir = StyleSheet.create({
  searchWrap: { marginHorizontal: EDGE, marginBottom: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput:{ flex: 1, color: C.text, fontSize: 14 },
  roleChip:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  roleChipOn: { backgroundColor: C.navyLight, borderColor: C.borderBlue },
  roleTxt:    { color: C.textSec, fontSize: 12, fontWeight: '600' },
  roleTxtOn:  { color: C.blue, fontWeight: '800' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt:    { color: C.textSec, fontSize: 13 },
  retryBtn:   { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi },
  count:      { color: C.textTert, fontSize: 12, paddingHorizontal: EDGE, marginBottom: 12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN COMPONENTS
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
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/notifications' as any)} activeOpacity={0.8}>
          <Ionicons name="notifications-outline" size={19} color={C.textSec} />
          <View style={hdr.dot} />
        </TouchableOpacity>
        <TouchableOpacity style={[hdr.btn, hdr.composeBtn]} onPress={onCompose} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
});
const hdr = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 10, paddingBottom: 14 },
  eyebrow:   { fontSize: 9, fontWeight: '700', color: C.textTert, letterSpacing: 1.5, marginBottom: 2 },
  title:     { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  actions:   { flexDirection: 'row', gap: 8 },
  btn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  composeBtn:{ borderColor: C.navyBright },
  dot:       { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg0 },
});



const FilterTabs = memo(function FilterTabs({ active, set }: { active: FeedTab; set: (t: FeedTab) => void }) {
  return (
    <View style={ft.row}>
      {FEED_TABS.map(t => {
        const on = t === active;
        const isPro = t === 'Pros';
        return (
          <TouchableOpacity key={t} onPress={() => set(t)} style={ft.pill} activeOpacity={0.8}>
            <View style={ft.labelWrap}>
              {isPro && (
                <View style={ft.proBadge}>
                  <Ionicons name="briefcase-outline" size={9} color={C.gold} />
                </View>
              )}
              <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
            </View>
            {on && <View style={[ft.line, isPro && { backgroundColor: C.gold }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const ft = StyleSheet.create({
  row:      { flexDirection: 'row', paddingHorizontal: EDGE, gap: 22, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  pill:     { paddingBottom: 13, alignItems: 'center', position: 'relative' },
  labelWrap:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  proBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.goldDim, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.goldEdge },
  txt:      { color: C.textSec, fontSize: 14, fontWeight: '600' },
  txtOn:    { color: C.text, fontWeight: '800' },
  line:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: C.blue },
});

const TrendingBanner = memo(function TrendingBanner({ posts }: { posts: Post[] }) {
  const router = useRouter();
  if (!posts.length) return null;
  const top = posts[0];
  return (
    <TouchableOpacity
      style={tb.wrap}
      onPress={() => {
        if (top.workId) router.push(`/film/${top.workId}` as any);
      }}
      activeOpacity={0.88}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 14 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={tb.inner}>
        <View style={tb.badge}>
          <Ionicons name="flame" size={10} color={C.gold} />
          <Text style={tb.badgeTxt}>TENDANCE #1</Text>
        </View>
        <Text style={tb.title} numberOfLines={1}>{top.work_title || 'Œuvre inconnue'}</Text>
        <Text style={tb.meta} numberOfLines={1}>
          {[top.work_director, top.work_year].filter(Boolean).join(' · ')}
        </Text>
        <View style={tb.stats}>
          <Ionicons name="heart" size={12} color={C.red} />
          <Text style={tb.statTxt}>{top.likes.toLocaleString('fr-FR')}</Text>
          <Text style={tb.dot}>·</Text>
          <Ionicons name="share-outline" size={12} color={C.textTert} />
          <Text style={tb.statTxt}>{top.shares}</Text>
        </View>
      </View>
      <Ionicons name="arrow-forward-circle" size={26} color={C.blue} style={{ opacity: 0.7 }} />
    </TouchableOpacity>
  );
});
const tb = StyleSheet.create({
  wrap:    { marginHorizontal: EDGE, marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.borderBlue, backgroundColor: C.surf, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  inner:   { flex: 1, gap: 4 },
  badge:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: C.goldDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5, borderColor: C.goldEdge, marginBottom: 2 },
  badgeTxt:{ color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  title:   { color: C.text, fontSize: 15, fontWeight: '800' },
  meta:    { color: C.textTert, fontSize: 11 },
  stats:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statTxt: { color: C.textSec, fontSize: 11, fontWeight: '600' },
  dot:     { color: C.textTert, fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const [activeTab,   setActiveTab]   = useState<FeedTab>('Pour vous');
  const [composeOpen, setComposeOpen] = useState(false);
  const [userId,      setUserId]      = useState('anonymous');
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Auth — getSession en premier (sync localStorage sur web/Netlify) ────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
      else supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) setUserId(user.id);
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.id) setUserId(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { posts, loading, error, refresh, toggleLike } = usePostsFeed(activeTab);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  // Posts triés pour Tendances
  const trendingPosts = useMemo(() => {
    if (activeTab !== 'Tendances') return posts;
    return [...posts].sort((a, b) => (b.likes + b.shares * 2) - (a.likes + a.shares * 2));
  }, [posts, activeTab]);

  const listData     = activeTab === 'Tendances' ? trendingPosts : posts;
  const renderItem   = useCallback(({ item }: { item: Post }) =>
    <PostCard post={item} userId={userId} />, [userId]);
  const keyExtractor = useCallback((item: Post) => item.id, []);

  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)} />
      <FilterTabs active={activeTab} set={setActiveTab} />
      {activeTab !== 'Pros' && (
        <>
          {activeTab === 'Tendances' && trendingPosts.length > 0 && (
            <TrendingBanner posts={trendingPosts} />
          )}
        </>
      )}
    </>
  ), [activeTab, trendingPosts]);

  const ListEmpty = useMemo(() => {
    if (activeTab === 'Pros') return null;
    if (loading) return (
      <View style={{ alignItems: 'center', paddingVertical: 60, gap: 14 }}>
        <ActivityIndicator color={C.blue} size="large" />
        <Text style={{ color: C.textSec, fontSize: 13 }}>Chargement des critiques…</Text>
      </View>
    );
    if (error) return (
      <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cloud-offline-outline" size={28} color={C.textTert} />
        </View>
        <Text style={{ color: C.red, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={{ paddingHorizontal: 22, paddingVertical: 10, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi }}>
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
    return (
      <View style={{ alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 12 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons name="film-outline" size={36} color={C.textTert} />
        </View>
        <Text style={{ color: C.textSec, fontSize: 17, fontWeight: '700' }}>Aucune critique ici</Text>
        <Text style={{ color: C.textTert, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
          Soyez le premier à partager votre avis sur un film indépendant.
        </Text>
        <TouchableOpacity style={{ borderRadius: 22, overflow: 'hidden', marginTop: 8 }} onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
          <LinearGradient colors={[C.navyBright, C.navyLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
            <Ionicons name="create-outline" size={16} color={C.white} />
            <Text style={{ color: C.white, fontSize: 14, fontWeight: '700' }}>Écrire une critique</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [activeTab, loading, error, refresh]);

  return (
    <InteractionProvider onToggleLike={toggleLike}>
      <View style={s.root}>
        <StatusBar style="light" />
        <GalaxyBackground />

        <SafeAreaView style={s.safe} edges={['top']}>
          <ComposeModal
            visible={composeOpen}
            onClose={() => setComposeOpen(false)}
            onPublished={refresh}
            userId={userId}
          />

          {activeTab === 'Pros' ? (
            <View style={{ flex: 1 }}>
              <SocialHeader onCompose={() => setComposeOpen(true)} />
              <FilterTabs active={activeTab} set={setActiveTab} />
              <ProDirectory />
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={s.listContent}
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
              windowSize={7}
              maxToRenderPerBatch={4}
              updateCellsBatchingPeriod={50}
              initialNumToRender={5}
            />
          )}
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  safe:        { flex: 1 },
  listContent: { paddingBottom: 120 },
});