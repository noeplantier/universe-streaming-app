/**
 * app/(tabs)/social.tsx — UNIVERSE · PROFESSIONAL EDITION
 *
 * Palette   : blanc (opacités variables) + C.navyMid uniquement
 * Icônes    : Ionicons partout, zéro emoji
 * Données   : 100 % Supabase — aucune valeur simulée
 *
 * Vivant grâce aux données réelles :
 *  ─ Realtime INSERT community_posts → banner "N nouvelles critiques"
 *  ─ Realtime UPDATE likes_count / shares_count → compteurs live animés
 *  ─ Badge RÉCENT sur posts < 30 min (via created_at réel)
 *  ─ Score algorithme calculé depuis likes + comments + created_at (DB)
 *  ─ Creator spotlight agrégeant les vrais likes des auteurs du feed
 *  ─ Genre radar depuis les vrais genres des posts chargés
 *  ─ Connexions pro : realtime postgres_changes sur pro_connections
 */

import React, {
  useState, useCallback, useRef, useMemo,
  useEffect, useContext, createContext, memo,
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
import NotifService       from '@/services/notifService';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — blanc + navyMid uniquement
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const EDGE    = 18;
const COL_GAP = 10;
const GRID_W  = (W - EDGE * 2 - COL_GAP) / 2;

const C = {
  bg:       '#070C17',
  navyMid:  '#0D2040',
  navyLow:  '#0A1830',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.36)',
  subtle:   'rgba(255,255,255,0.15)',
  faint:    'rgba(255,255,255,0.07)',
  border:   'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.22)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TONE_KEYS = [
  'analyse','coup de coeur','deception','reflexion',
  'détente','neutre','mitigé','enthousiaste',
] as const;
type Tone = typeof TONE_KEYS[number];

interface ToneDef { key:Tone; label:string; icon:keyof typeof Ionicons.glyphMap }
const TONES: ToneDef[] = [
  { key:'analyse',       label:'Analyse',      icon:'flask-outline'        },
  { key:'coup de coeur', label:'Coup de cœur', icon:'heart-outline'        },
  { key:'deception',     label:'Déception',    icon:'cloud-offline-outline' },
  { key:'reflexion',     label:'Réflexion',    icon:'bulb-outline'         },
  { key:'détente',       label:'Détente',      icon:'cafe-outline'         },
  { key:'neutre',        label:'Neutre',       icon:'remove-outline'       },
  { key:'mitigé',        label:'Mitigé',       icon:'git-branch-outline'   },
  { key:'enthousiaste',  label:'Enthousiaste', icon:'star-outline'         },
];

const GENRES_LIST = [
  'Drame','Thriller','Sci-Fi','Documentaire',
  'Animation','Court métrage','Expérimental','Biopic',
] as const;

const ASPECTS = [
  'Photographie','Musique','Scénario','Montage',
  'Interprétation','Rythme','Atmosphère','Décors',
];

const FEED_TABS   = ['Pour vous','Tendances','Pros'] as const;
type FeedTab = typeof FEED_TABS[number];

const PRO_ROLES = [
  'Tous','Réalisateur·ice','Producteur·ice','Acteur·ice',
  'Scénariste','Dir. photo','Compositeur·ice','Monteur·euse','Distributeur·ice',
] as const;

const MIN_BODY    = 80;
const POSTS_LIMIT = 40;
const WORKS_LIMIT = 50;
const RECENT_MINS = 30; // minutes — seuil badge RÉCENT

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type ConnStatus = 'none'|'pending'|'accepted'|'rejected';

interface SupabasePost {
  id:string; user_id:string; work_id:number|null;
  work_title:string; work_year:string; work_director:string; work_genre:string;
  rating:number; body:string; image_url:string|null; image_valid:boolean|null;
  tags:string[]|null; tone:string|null;
  likes_count:number|null; shares_count:number|null; created_at:string;
  profiles?:{ display_name:string; avatar_url:string }|null;
}

interface Post {
  id:string; userId:string; userName:string; avatar:string; timeAgo:string;
  content:string; likes:number; shares:number; workId:number;
  work_title:string; work_year:string; work_director:string; work_genre:string;
  rating:number; image_url:string; tags:string[]; tone:Tone;
  created_at:string; isRecent:boolean;
}

interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null;
  director:string|null; created_at:string; score?:number;
}

interface Pro {
  id:string; name:string; role:string; avatar:string|null; bio:string|null;
  films:string[]; location:string|null; contact_email:string|null;
  website:string|null; verified:boolean; open_to:string[]; created_at:string;
}

interface ProConnection {
  id:string; pro_id:string; status:ConnStatus;
  message:string|null; created_at:string;
}

interface CForm {
  workTitle:string; workYear:string; workDirector:string; workGenre:string;
  rating:number; tone:Tone|null; body:string; tags:string[];
  imageUri:string; imageUrl:string; imageValid:boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtAgo(iso:string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return "à l'instant";
  if (s < 3600)  return `${Math.floor(s/60)} min`;
  if (s < 86400) return `${Math.floor(s/3600)} h`;
  return `${Math.floor(s/86400)} j`;
}

function fmtK(n:number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return `${n}`;
}

function isRecent(iso:string): boolean {
  return (Date.now() - new Date(iso).getTime()) < RECENT_MINS * 60 * 1000;
}

function resolveWorkImage(id:number, image:string|null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/800/500`;
  if (image.startsWith('http')) return image;
  try {
    return supabase.storage.from('community-images').getPublicUrl(image).data.publicUrl;
  } catch { return `https://picsum.photos/seed/work_${id}/800/500`; }
}

/** Score temps-réel : likes + comments + fraîcheur + bonus original */
function computeWorkScore(w:Work): number {
  const ageDays = (Date.now() - new Date(w.created_at).getTime()) / 86_400_000;
  return Math.round(
    w.likes * 1.5 +
    (w.comments ?? 0) * 1.2 +
    Math.max(0, 60 - ageDays) * 2 +
    (w.is_original ? 40 : 0) +
    (w.duration != null && w.duration < 30 ? 20 : 0),
  );
}

function mapPost(r:SupabasePost): Post {
  const tone: Tone = (r.tone && (TONE_KEYS as readonly string[]).includes(r.tone))
    ? (r.tone as Tone) : 'analyse';
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.profiles?.display_name ?? 'Cinéphile',
    avatar: r.profiles?.avatar_url ?? `https://i.pravatar.cc/80?u=${r.user_id}`,
    timeAgo: fmtAgo(r.created_at),
    content: r.body ?? '',
    likes: r.likes_count ?? 0,
    shares: r.shares_count ?? 0,
    workId: r.work_id ?? 0,
    work_title: r.work_title ?? '',
    work_year: r.work_year ?? '',
    work_director: r.work_director ?? '',
    work_genre: r.work_genre ?? '',
    rating: r.rating ?? 0,
    image_url: r.image_url ?? '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    tone,
    created_at: r.created_at,
    isRecent: isRecent(r.created_at),
  };
}

const FEED_FIELDS =
  'id,user_id,work_id,work_title,work_year,work_director,work_genre,' +
  'rating,body,image_url,tags,tone,likes_count,shares_count,created_at';

// ─────────────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────────────
async function dbToggleLike(postId:string, userId:string, was:boolean) {
  if (was) {
    await supabase.from('post_likes').delete().match({ post_id:postId, user_id:userId });
    await supabase.rpc('decrement_likes', { pid:postId });
  } else {
    await supabase.from('post_likes').insert({ post_id:postId, user_id:userId });
    await supabase.rpc('increment_likes', { pid:postId });
  }
}

async function dbRecordShare(postId:string, userId:string, platform:string) {
  await supabase.from('post_shares').insert({ post_id:postId, user_id:userId, platform });
}

async function dbPublishPost(payload:Record<string,unknown>): Promise<string|null> {
  try {
    let uid = (await supabase.auth.getSession()).data.session?.user?.id;
    if (!uid) uid = (await supabase.auth.signInAnonymously()).data.session?.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from('community_posts')
      .insert({ ...payload, user_id:uid })
      .select('id').single();
    if (error) throw error;
    return (data as any)?.id ?? null;
  } catch { return null; }
}

async function uploadImage(localUri:string): Promise<string|null> {
  try {
    const isBlob = localUri.startsWith('blob:');
    const ext = ['jpg','jpeg','png','webp'].includes(localUri.split('.').pop()?.toLowerCase() ?? '')
      ? localUri.split('.').pop()!.toLowerCase() : 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const path = `posts/post_${Date.now()}.${ext}`;
    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await (await fetch(localUri)).arrayBuffer();
    } else {
      payload = decode(await FileSystem.readAsStringAsync(localUri, { encoding:'base64' }));
    }
    const { data, error } = await supabase.storage
      .from('community-images').upload(path, payload, { contentType:mime, upsert:false });
    if (error) throw error;
    return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;
  } catch { return null; }
}

async function dbSendConnection(proId: string, message: string) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { ok: false, error: "Not authenticated" };

  const requesterId = user.id;

  // 1. Vérifier si une requête existe déjà
  const { data: existing } = await supabase
    .from('pro_connections')
    .select('id')
    .eq('requester_id', requesterId)
    .eq('pro_id', proId)
    .single();

  if (existing) {
    // 2. Mettre à jour l'existante
    const { error } = await supabase
      .from('pro_connections')
      .update({
        status: 'pending',
        message: message.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } else {
    // 3. Créer une nouvelle
    const { error } = await supabase
      .from('pro_connections')
      .insert({
        requester_id: requesterId,
        pro_id: proId,
        status: 'pending',
        message: message.trim(),
      });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
}


async function dbFetchConnections(userId:string): Promise<ProConnection[]> {
  const { data } = await supabase
    .from('pro_connections')
    .select('id,pro_id,status,message,created_at')
    .eq('requester_id', userId);
  return (data ?? []) as ProConnection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function usePostsFeed(tab:FeedTab) {
  const [posts,   setPosts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);
  const [newCount, setNewCount] = useState(0);
  const [rk, setRk] = useState(0);
  const refresh = useCallback(() => { setNewCount(0); setRk(k=>k+1); }, []);

  useEffect(() => {
    if (tab === 'Pros') { setLoading(false); return; }
    let dead = false;
    setLoading(true); setError(null);
    supabase
      .from('community_posts_enriched')
      .select(FEED_FIELDS)
      .order('created_at', { ascending:false })
      .limit(POSTS_LIMIT)
      .then(({ data, error:err }) => {
        if (dead) return;
        if (err) { setError('Impossible de charger le feed.'); setLoading(false); return; }
        setPosts((data ?? []).filter(r => r && 'id' in r).map(r => mapPost(r as unknown as SupabasePost)));
        setLoading(false);
      });
    return () => { dead = true; };
  }, [tab, rk]);

  // ── Realtime : INSERT (nouveau post) + UPDATE (likes/shares) ───────────────
  useEffect(() => {
    if (tab === 'Pros') return;
    const ts = Date.now();
    const ch = supabase.channel(`social_rt_${ts}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'community_posts' },
        async payload => {
          const { data } = await supabase
            .from('community_posts')
            .select(FEED_FIELDS)
            .eq('id', payload.new.id)
            .single();
          if (!data) return;
          const p = mapPost(data as unknown as SupabasePost);
          setPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
          // Incrémente le compteur "nouvelles critiques" visible
          setNewCount(n => n + 1);
        })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'community_posts' },
        ({ new:row }) => {
          setPosts(prev => prev.map(p =>
            p.id === row.id
              ? { ...p, likes:row.likes_count ?? p.likes, shares:row.shares_count ?? p.shares }
              : p,
          ));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab]);

  const toggleLike = useCallback(async (postId:string, userId:string, was:boolean) => {
    setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes:p.likes + (was?-1:1) }));
    try {
      await dbToggleLike(postId, userId, was);
    } catch {
      setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes:p.likes + (was?1:-1) }));
    }
  }, []);

  return { posts, loading, error, refresh, toggleLike, newCount };
}

function useWorksAlgorithm() {
  const [works,   setWorks]   = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let dead = false;
    supabase.from('works')
      .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at')
      .order('likes', { ascending:false })
      .limit(WORKS_LIMIT)
      .then(({ data }) => {
        if (dead) return;
        setWorks(
          ((data ?? []) as Work[])
            .map(w => ({ ...w, score:computeWorkScore(w) }))
            .sort((a,b) => (b.score ?? 0) - (a.score ?? 0)),
        );
        setLoading(false);
      });
    return () => { dead = true; };
  }, []);
  return { works, loading };
}

function useProDirectory(search:string, role:string) {
  const [pros,    setPros]    = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let q = supabase.from('professionals')
        .select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to,created_at')
        .order('verified', { ascending:false })
        .order('name', { ascending:true })
        .limit(80);
      if (role && role !== 'Tous') q = q.eq('role', role);
      if (search.trim())           q = q.ilike('name', `%${search.trim()}%`);
      const { data, error:err } = await q;
      if (err) throw err;
      setPros((data ?? []) as Pro[]);
    } catch { setError('Impossible de charger le répertoire.'); }
    finally { setLoading(false); }
  }, [search, role]);

  useEffect(() => { load(); }, [load]);
  return { pros, loading, error, refresh:load };
}

function useConnections(userId:string) {
  const [connections, setConnections] = useState<Record<string,ConnStatus>>({});
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!userId || userId === 'anonymous') { setLoading(false); return; }
    dbFetchConnections(userId).then(rows => {
      const map: Record<string,ConnStatus> = {};
      rows.forEach(r => { map[r.pro_id] = r.status; });
      setConnections(map); setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    const ch = supabase.channel(`pro_conn_${userId}_${Date.now()}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'pro_connections' },
        ({ new:row }) => {
          const r = row as ProConnection;
          if (r?.pro_id) setConnections(prev => ({ ...prev, [r.pro_id]:r.status }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const setStatus = useCallback((proId:string, status:ConnStatus) =>
    setConnections(prev => ({ ...prev, [proId]:status })), []);

  return { connections, loading, setStatus };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface ICtx {
  liked: Record<string,boolean>;
  saved: Record<string,boolean>;
  toggleLike: (id:string, uid:string) => void;
  toggleSave: (id:string) => void;
  sharePost: (id:string, title:string, uid:string) => Promise<void>;
}
const ICtx = createContext<ICtx>({
  liked:{}, saved:{}, toggleLike:()=>{}, toggleSave:()=>{}, sharePost:async()=>{},
});

function InteractionProvider({
  children, onToggleLike,
}: { children:React.ReactNode; onToggleLike:(id:string,uid:string,was:boolean)=>void }) {
  const [liked, setLiked] = useState<Record<string,boolean>>({});
  const [saved, setSaved] = useState<Record<string,boolean>>({});

  const toggleLike = useCallback((id:string, uid:string) => {
    const was = !!liked[id];
    setLiked(p => ({ ...p, [id]:!was }));
    onToggleLike(id, uid, was);
  }, [liked, onToggleLike]);

  const toggleSave = useCallback((id:string) =>
    setSaved(p => ({ ...p, [id]:!p[id] })), []);

  const sharePost = useCallback(async (id:string, title:string, uid:string) => {
    try {
      const r = await Share.share({ message:`Découvrez cette critique de "${title}" sur Universe !` });
      if (r.action === Share.sharedAction) await dbRecordShare(id, uid, r.activityType ?? 'unknown');
    } catch {}
  }, []);

  return (
    <ICtx.Provider value={{ liked, saved, toggleLike, toggleSave, sharePost }}>
      {children}
    </ICtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAR ROW — monochrome
// ─────────────────────────────────────────────────────────────────────────────
const StarRow = memo(function StarRow({ value, size=11 }:{ value:number; size?:number }) {
  return (
    <View style={{ flexDirection:'row', gap:1 }}>
      {[1,2,3,4,5].map(s => (
        <Ionicons
          key={s}
          name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={value >= s || value >= s - 0.5 ? C.offWhite : C.subtle}
        />
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ NEW POSTS BANNER — données realtime réelles
// ─────────────────────────────────────────────────────────────────────────────
const NewPostsBanner = memo(function NewPostsBanner({
  count, onPress,
}: { count:number; onPress:()=>void }) {
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.spring(translateY, { toValue:0, tension:60, friction:10, useNativeDriver:true }).start();
    } else {
      Animated.timing(translateY, { toValue:-60, duration:220, useNativeDriver:true }).start();
    }
  }, [count, translateY]);

  if (count === 0) return null;

  return (
    <Animated.View style={[npb.wrap, { transform:[{ translateY }] }]}>
      <TouchableOpacity style={npb.inner} onPress={onPress} activeOpacity={0.88}>
        <BlurView intensity={Platform.OS==='ios'?40:28} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={npb.dot}/>
        <Text style={npb.txt}>
          {count} nouvelle{count > 1 ? 's' : ''} critique{count > 1 ? 's' : ''} publiée{count > 1 ? 's' : ''}
        </Text>
        <Ionicons name="arrow-up-outline" size={13} color={C.offWhite}/>
      </TouchableOpacity>
    </Animated.View>
  );
});

const npb = StyleSheet.create({
  wrap:  { position:'absolute', top:0, left:EDGE, right:EDGE, zIndex:100 },
  inner: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16,
           paddingVertical:11, borderRadius:18, overflow:'hidden',
           borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi },
  dot:   { width:6, height:6, borderRadius:3, backgroundColor:C.white },
  txt:   { flex:1, color:C.offWhite, fontSize:12, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ COMPACT POST CARD — liste "Pour vous"
// ─────────────────────────────────────────────────────────────────────────────
const THUMB_W = 92;
const THUMB_H = 122;

const CompactPostCard = memo(function CompactPostCard({
  post, userId,
}: { post:Post; userId:string }) {
  const router = useRouter();
  const { liked, saved, toggleLike, toggleSave, sharePost } = useContext(ICtx);
  const isLiked = !!liked[post.id];
  const isSaved = !!saved[post.id];
  const likeAnim = useRef(new Animated.Value(1)).current;

  const toneInfo = useMemo(() =>
    TONES.find(t => t.key === post.tone) ?? TONES[0], [post.tone]);

  const imgSrc = useMemo(() =>
    post.image_url
      ? { uri:post.image_url }
      : { uri:`https://picsum.photos/seed/${post.id}/400/600` },
    [post.image_url, post.id]);

  const goFilm = useCallback(() => {
    if (post.workId) router.push(`/film/${post.workId}` as any);
  }, [post.workId, router]);

  const goPost = useCallback(() =>
    router.push(`/review/${post.id}` as any), [post.id, router]);

  const onLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(likeAnim, { toValue:1.45, tension:300, friction:7, useNativeDriver:true }),
      Animated.spring(likeAnim, { toValue:1,    tension:200, friction:8, useNativeDriver:true }),
    ]).start();
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    toggleLike(post.id, userId);
  }, [post.id, userId, toggleLike, likeAnim]);

  return (
    <View style={cpc.wrap}>
      {/* Thumbnail → film */}
      <TouchableOpacity onPress={goFilm} activeOpacity={0.90} style={cpc.thumbWrap}>
        <Image source={imgSrc} style={cpc.thumb} resizeMode="cover"/>
        <LinearGradient
          colors={['rgba(7,12,23,0.06)','rgba(7,12,23,0.78)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Badge RÉCENT (données réelles : created_at) */}
        {post.isRecent && (
          <View style={cpc.recentBadge}>
            <Text style={cpc.recentTxt}>RÉCENT</Text>
          </View>
        )}

        {/* Ton */}
        <View style={cpc.toneBadge}>
          <Ionicons name={toneInfo.icon} size={9} color={C.muted}/>
        </View>

        {/* Note */}
        <View style={cpc.ratingBadge}>
          <Ionicons name="star" size={8} color={C.offWhite}/>
          <Text style={cpc.ratingTxt}>{post.rating.toFixed(1)}</Text>
        </View>
      </TouchableOpacity>

      {/* Contenu */}
      <TouchableOpacity style={cpc.content} onPress={goPost} activeOpacity={0.88}>
        <View style={cpc.workRow}>
          <Text style={cpc.workTitle} numberOfLines={1}>
            {post.work_title || 'Œuvre inconnue'}
          </Text>
          {!!post.work_year && (
            <Text style={cpc.workYear}>{post.work_year}</Text>
          )}
        </View>

        {!!post.work_genre && (
          <Text style={cpc.genre}>{post.work_genre}</Text>
        )}

        <StarRow value={post.rating} size={10}/>

        <Text style={cpc.excerpt} numberOfLines={3}>{post.content}</Text>

        {/* Tags */}
        {post.tags.length > 0 && (
          <View style={cpc.tagsRow}>
            {post.tags.slice(0,2).map(tag => (
              <View key={tag} style={cpc.tag}>
                <Text style={cpc.tagTxt}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={cpc.authorRow}>
          <Image source={{ uri:post.avatar }} style={cpc.avi}/>
          <Text style={cpc.authorName} numberOfLines={1}>{post.userName}</Text>
          <Text style={cpc.timeAgo}>{post.timeAgo}</Text>
        </View>
      </TouchableOpacity>

      {/* Actions verticales */}
      <View style={cpc.actions}>
        <TouchableOpacity style={cpc.actionBtn} onPress={onLike} activeOpacity={0.78}>
          <Animated.View style={{ transform:[{ scale:likeAnim }] }}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={17}
              color={isLiked ? C.white : C.muted}
            />
          </Animated.View>
          {/* Compteur live (mis à jour via realtime) */}
          <Text style={[cpc.actionCount, isLiked && { color:C.offWhite }]}>
            {fmtK(post.likes + (isLiked ? 1 : 0))}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={cpc.actionBtn}
          onPress={() => sharePost(post.id, post.work_title, userId)}
          activeOpacity={0.78}
        >
          <Ionicons name="share-outline" size={16} color={C.muted}/>
          {post.shares > 0 && (
            <Text style={cpc.actionCount}>{fmtK(post.shares)}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={cpc.actionBtn} onPress={() => toggleSave(post.id)} activeOpacity={0.78}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isSaved ? C.white : C.muted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const cpc = StyleSheet.create({
  wrap:        { flexDirection:'row', marginHorizontal:EDGE, marginBottom:10,
                 borderRadius:16, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth,
                 borderColor:C.border, backgroundColor:C.navyLow },
  thumbWrap:   { width:THUMB_W, height:THUMB_H, position:'relative' },
  thumb:       { width:'100%', height:'100%' },
  recentBadge: { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5,
                 borderRadius:5, backgroundColor:'rgba(7,12,23,0.80)' },
  recentTxt:   { color:C.white, fontSize:6.5, fontWeight:'900', letterSpacing:0.8 },
  toneBadge:   { position:'absolute', top:7, right:7, width:20, height:20, borderRadius:10,
                 alignItems:'center', justifyContent:'center',
                 backgroundColor:'rgba(7,12,23,0.72)', borderWidth:StyleSheet.hairlineWidth,
                 borderColor:C.border },
  ratingBadge: { position:'absolute', bottom:7, left:6, flexDirection:'row', alignItems:'center',
                 gap:3, paddingHorizontal:5, paddingVertical:2.5, borderRadius:7,
                 backgroundColor:'rgba(7,12,23,0.80)' },
  ratingTxt:   { color:C.offWhite, fontSize:8, fontWeight:'800' },
  content:     { flex:1, padding:11, gap:4, justifyContent:'space-between' },
  workRow:     { flexDirection:'row', alignItems:'center', gap:6 },
  workTitle:   { color:C.white, fontSize:12, fontWeight:'800', flex:1, letterSpacing:-0.2 },
  workYear:    { color:C.muted, fontSize:10, fontWeight:'600' },
  genre:       { color:C.mid, fontSize:9, fontWeight:'700', letterSpacing:0.3 },
  excerpt:     { color:C.muted, fontSize:11, lineHeight:16, fontStyle:'italic', flex:1 },
  tagsRow:     { flexDirection:'row', gap:5 },
  tag:         { paddingHorizontal:7, paddingVertical:2, borderRadius:8,
                 backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:C.border },
  tagTxt:      { color:C.muted, fontSize:8, fontWeight:'600' },
  authorRow:   { flexDirection:'row', alignItems:'center', gap:5 },
  avi:         { width:16, height:16, borderRadius:8,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  authorName:  { color:C.muted, fontSize:9, fontWeight:'600', flex:1 },
  timeAgo:     { color:C.muted, fontSize:9, opacity:0.7 },
  actions:     { width:36, alignItems:'center', justifyContent:'space-evenly',
                 paddingVertical:8, borderLeftWidth:StyleSheet.hairlineWidth,
                 borderLeftColor:C.border },
  actionBtn:   { alignItems:'center', gap:2, paddingVertical:5 },
  actionCount: { color:C.muted, fontSize:8, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ GRID POST CARD — 2 colonnes "Tendances"
// ─────────────────────────────────────────────────────────────────────────────
const GRID_H = 235;

const GridPostCard = memo(function GridPostCard({
  post, userId,
}: { post:Post; userId:string }) {
  const router   = useRouter();
  const { liked, toggleLike } = useContext(ICtx);
  const isLiked  = !!liked[post.id];
  const likeAnim = useRef(new Animated.Value(1)).current;

  const toneInfo = useMemo(() =>
    TONES.find(t => t.key === post.tone) ?? TONES[0], [post.tone]);

  const imgSrc = useMemo(() =>
    post.image_url
      ? { uri:post.image_url }
      : { uri:`https://picsum.photos/seed/${post.id}/400/600` },
    [post.image_url, post.id]);

  const onLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(likeAnim, { toValue:1.5, tension:300, friction:7, useNativeDriver:true }),
      Animated.spring(likeAnim, { toValue:1,   tension:200, friction:8, useNativeDriver:true }),
    ]).start();
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleLike(post.id, userId);
  }, [post.id, userId, toggleLike, likeAnim]);

  return (
    <TouchableOpacity
      style={gpc.wrap}
      onPress={() => post.workId && router.push(`/film/${post.workId}` as any)}
      onLongPress={() => router.push(`/review/${post.id}` as any)}
      activeOpacity={0.88}
    >
      <Image source={imgSrc} style={gpc.img} resizeMode="cover"/>
      <LinearGradient
        colors={['rgba(7,12,23,0.08)','rgba(7,12,23,0.97)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x:0,y:0.2 }} end={{ x:0,y:1 }}
      />

      {/* Badge RÉCENT */}
      {post.isRecent && (
        <View style={gpc.recentBadge}>
          <View style={gpc.recentDot}/>
          <Text style={gpc.recentTxt}>RÉCENT</Text>
        </View>
      )}

      {/* Ton badge haut */}
      <View style={gpc.toneBadge}>
        <Ionicons name={toneInfo.icon} size={9} color={C.muted}/>
        <Text style={gpc.toneTxt}>{toneInfo.label}</Text>
      </View>

      {/* Meta bas */}
      <View style={gpc.meta}>
        {!!post.work_genre && (
          <Text style={gpc.genre}>{post.work_genre.toUpperCase()}</Text>
        )}
        <Text style={gpc.title} numberOfLines={2}>{post.work_title || 'Œuvre'}</Text>

        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <StarRow value={post.rating} size={9}/>
          <Text style={gpc.ratingTxt}>{post.rating.toFixed(1)}</Text>
        </View>

        <View style={gpc.footer}>
          <Image source={{ uri:post.avatar }} style={gpc.avi}/>
          <Text style={gpc.author} numberOfLines={1}>{post.userName}</Text>

          {/* Like live */}
          <TouchableOpacity
            onPress={onLike}
            activeOpacity={0.78}
            style={{ flexDirection:'row', alignItems:'center', gap:4 }}
          >
            <Animated.View style={{ transform:[{ scale:likeAnim }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={12}
                color={isLiked ? C.white : C.muted}
              />
            </Animated.View>
            <Text style={[gpc.likes, isLiked && { color:C.white }]}>
              {fmtK(post.likes + (isLiked ? 1 : 0))}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const gpc = StyleSheet.create({
  wrap:       { width:GRID_W, height:GRID_H, borderRadius:14, overflow:'hidden',
                backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth,
                borderColor:C.border },
  img:        { position:'absolute', top:0, left:0, right:0, bottom:0 },
  recentBadge:{ position:'absolute', top:9, left:9, flexDirection:'row', alignItems:'center',
                gap:5, paddingHorizontal:7, paddingVertical:3.5, borderRadius:9,
                backgroundColor:'rgba(7,12,23,0.82)', borderWidth:StyleSheet.hairlineWidth,
                borderColor:C.border },
  recentDot:  { width:5, height:5, borderRadius:2.5, backgroundColor:C.white },
  recentTxt:  { color:C.offWhite, fontSize:7.5, fontWeight:'900', letterSpacing:0.8 },
  toneBadge:  { position:'absolute', top:post => post.isRecent ? 36 : 9, right:9,
                flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7,
                paddingVertical:3, borderRadius:9, backgroundColor:'rgba(7,12,23,0.72)',
                borderWidth:StyleSheet.hairlineWidth, borderColor:C.border } as any,
  toneTxt:    { color:C.muted, fontSize:8, fontWeight:'700' },
  meta:       { position:'absolute', bottom:0, left:0, right:0, padding:11, gap:4 },
  genre:      { color:C.muted, fontSize:8, fontWeight:'700', letterSpacing:0.8 },
  title:      { color:C.white, fontSize:12, fontWeight:'800', lineHeight:16, letterSpacing:-0.2 },
  ratingTxt:  { color:C.muted, fontSize:9, fontWeight:'700' },
  footer:     { flexDirection:'row', alignItems:'center', gap:5, marginTop:2 },
  avi:        { width:15, height:15, borderRadius:8, borderWidth:StyleSheet.hairlineWidth,
                borderColor:C.border },
  author:     { color:C.muted, fontSize:9, flex:1 },
  likes:      { color:C.muted, fontSize:9, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// WORK MINI CARD — Tendances header
// ─────────────────────────────────────────────────────────────────────────────
const WK_W = 138, WK_H = 192;

const WorkMiniCard = memo(function WorkMiniCard({
  work, rank,
}: { work:Work; rank?:number }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveWorkImage(work.id, work.image), [work.id, work.image]);

  return (
    <TouchableOpacity
      style={{ marginRight:10 }}
      onPress={() => router.push(`/film/${work.id}` as any)}
      activeOpacity={0.88}
    >
      <View style={{ width:WK_W, height:WK_H, borderRadius:13, overflow:'hidden',
                     backgroundColor:C.navyMid }}>
        <Image source={{ uri }} style={{ width:'100%', height:'100%' }} resizeMode="cover"/>
        <LinearGradient
          colors={['transparent','rgba(7,12,23,0.94)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x:0,y:0.35 }} end={{ x:0,y:1 }}
        />

        {/* Catégorie */}
        <View style={wmc.badge}>
          <Text style={wmc.badgeTxt}>
            {work.is_original ? 'ORIG' : (work.category ?? '').slice(0,4).toUpperCase()}
          </Text>
        </View>

        {/* Score algorithme (données réelles) */}
        {work.score != null && (
          <View style={wmc.score}>
            <Ionicons name="trending-up-outline" size={7} color={C.mid}/>
            <Text style={wmc.scoreTxt}>{work.score}</Text>
          </View>
        )}

        {/* Numéro de rang */}
        {rank != null && (
          <Text style={wmc.rankNum}>{rank}</Text>
        )}

        <View style={wmc.meta}>
          <Text style={wmc.title} numberOfLines={2}>{work.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={8} color={C.mid}/>
            <Text style={wmc.stat}>{fmtK(work.likes ?? 0)}</Text>
            {work.duration && (
              <>
                <View style={wmc.dot}/>
                <Text style={wmc.stat}>{work.duration}min</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const wmc = StyleSheet.create({
  badge:   { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5,
             borderRadius:5, backgroundColor:'rgba(7,12,23,0.72)' },
  badgeTxt:{ color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  score:   { position:'absolute', top:7, right:7, flexDirection:'row', alignItems:'center',
             gap:3, backgroundColor:'rgba(7,12,23,0.72)', paddingHorizontal:5,
             paddingVertical:2.5, borderRadius:5 },
  scoreTxt:{ color:C.mid, fontSize:7, fontWeight:'800' },
  rankNum: { position:'absolute', bottom:30, right:5, fontSize:44, fontWeight:'900',
             lineHeight:44, letterSpacing:-4, color:'rgba(255,255,255,0.10)' },
  meta:    { position:'absolute', bottom:7, left:8, right:8, gap:2 },
  title:   { color:C.white, fontSize:10, fontWeight:'800', lineHeight:13 },
  stat:    { color:C.muted, fontSize:9, fontWeight:'600' },
  dot:     { width:2, height:2, borderRadius:1, backgroundColor:C.subtle },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ ALGORITHM BANNER — N°1 score réel
// ─────────────────────────────────────────────────────────────────────────────
const AlgorithmBanner = memo(function AlgorithmBanner({ works }:{ works:Work[] }) {
  const router = useRouter();
  const top    = works[0];
  if (!top) return null;

  return (
    <TouchableOpacity
      style={ab.wrap}
      onPress={() => router.push(`/film/${top.id}` as any)}
      activeOpacity={0.90}
    >
      <Image
        source={{ uri:resolveWorkImage(top.id, top.image) }}
        style={StyleSheet.absoluteFillObject as any}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(7,12,23,0.22)','rgba(7,12,23,0.96)']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={ab.content}>
        {/* Badge N°1 */}
        <View style={ab.badge}>
          <Ionicons name="trending-up-outline" size={10} color={C.offWhite}/>
          <Text style={ab.badgeTxt}>N°1 · SCORE UNIVERSE</Text>
        </View>

        <Text style={ab.title} numberOfLines={2}>{top.title}</Text>

        <Text style={ab.meta}>
          {[top.director, String(top.year), top.genre].filter(Boolean).join(' · ')}
        </Text>

        <View style={{ flexDirection:'row', gap:14, alignItems:'center' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
            <Ionicons name="heart" size={11} color={C.mid}/>
            <Text style={ab.stat}>{fmtK(top.likes ?? 0)}</Text>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
            <Ionicons name="bar-chart-outline" size={11} color={C.mid}/>
            <Text style={ab.stat}>Score {top.score}</Text>
          </View>
          {top.is_original && (
            <View style={ab.origBadge}>
              <Text style={ab.origTxt}>ORIGINAL</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const ab = StyleSheet.create({
  wrap:     { marginHorizontal:EDGE, marginBottom:16, height:166,
              borderRadius:18, overflow:'hidden' },
  content:  { position:'absolute', bottom:0, left:0, right:0, padding:16, gap:6 },
  badge:    { flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start',
              paddingHorizontal:9, paddingVertical:4, borderRadius:10,
              borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
              backgroundColor:'rgba(7,12,23,0.70)', marginBottom:2 },
  badgeTxt: { color:C.mid, fontSize:8, fontWeight:'800', letterSpacing:0.8 },
  title:    { color:C.white, fontSize:19, fontWeight:'900', letterSpacing:-0.4, lineHeight:24 },
  meta:     { color:C.muted, fontSize:11 },
  stat:     { color:C.mid, fontSize:11, fontWeight:'600' },
  origBadge:{ paddingHorizontal:8, paddingVertical:2, borderRadius:7,
              borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
              backgroundColor:C.navyMid },
  origTxt:  { color:C.mid, fontSize:8, fontWeight:'800', letterSpacing:0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING ROW
// ─────────────────────────────────────────────────────────────────────────────
const TrendingRow = memo(function TrendingRow({
  works, loading,
}: { works:Work[]; loading:boolean }) {
  const router = useRouter();
  return (
    <View style={{ marginBottom:16 }}>
      <View style={tr.head}>
        <Ionicons name="bar-chart-outline" size={13} color={C.mid}/>
        <Text style={tr.title}>En vogue</Text>
        <TouchableOpacity onPress={() => router.push('/search' as any)} hitSlop={8}
          style={{ marginLeft:'auto' as any }}>
          <Text style={tr.seeAll}>Tout voir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:EDGE, gap:10 }}>
          {[0,1,2,3].map(i => (
            <View key={i} style={{ width:WK_W, height:WK_H, borderRadius:13,
                                   backgroundColor:C.navyMid }}/>
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:EDGE }}>
          {works.slice(0,10).map((w,i) => (
            <WorkMiniCard key={w.id} work={w} rank={i+1}/>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

const tr = StyleSheet.create({
  head:   { flexDirection:'row', alignItems:'center', gap:7,
            paddingHorizontal:EDGE, marginBottom:12 },
  title:  { color:C.offWhite, fontSize:14, fontWeight:'800' },
  seeAll: { color:C.muted, fontSize:11, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ CREATOR SPOTLIGHT — agrégats réels des posts chargés
// ─────────────────────────────────────────────────────────────────────────────
const CreatorSpotlight = memo(function CreatorSpotlight({ posts }:{ posts:Post[] }) {
  const router = useRouter();

  const top = useMemo(() => {
    const m: Record<string,{ name:string; avatar:string; likes:number; count:number }> = {};
    posts.forEach(p => {
      if (!m[p.userId]) m[p.userId] = { name:p.userName, avatar:p.avatar, likes:0, count:0 };
      m[p.userId].likes  += p.likes;
      m[p.userId].count  += 1;
    });
    return Object.entries(m)
      .sort((a,b) => b[1].likes - a[1].likes)
      .slice(0, 6);
  }, [posts]);

  if (!top.length) return null;

  return (
    <View style={{ marginBottom:16 }}>
      <View style={cs.head}>
        <Ionicons name="people-outline" size={13} color={C.mid}/>
        <Text style={cs.title}>Top critiques</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal:EDGE, gap:8 }}>
        {top.map(([uid, info]) => (
          <TouchableOpacity
            key={uid}
            style={cs.card}
            onPress={() => router.push(`/user/${uid}` as any)}
            activeOpacity={0.80}
          >
            <BlurView intensity={Platform.OS==='ios'?10:7} tint="dark"
              style={StyleSheet.absoluteFillObject}/>
            <Image source={{ uri:info.avatar }} style={cs.avi}/>
            <View>
              <Text style={cs.name} numberOfLines={1}>{info.name}</Text>
              <View style={cs.statsRow}>
                <Ionicons name="heart" size={9} color={C.muted}/>
                <Text style={cs.stat}>{fmtK(info.likes)}</Text>
                <View style={cs.dot}/>
                <Text style={cs.stat}>{info.count} crit.</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

const cs = StyleSheet.create({
  head:     { flexDirection:'row', alignItems:'center', gap:7,
              paddingHorizontal:EDGE, marginBottom:10 },
  title:    { color:C.offWhite, fontSize:13, fontWeight:'800' },
  card:     { flexDirection:'row', alignItems:'center', gap:9, overflow:'hidden',
              paddingVertical:9, paddingHorizontal:12, borderRadius:13,
              borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  avi:      { width:30, height:30, borderRadius:15, borderWidth:1, borderColor:C.border },
  name:     { color:C.offWhite, fontSize:11, fontWeight:'700', maxWidth:90 },
  statsRow: { flexDirection:'row', alignItems:'center', gap:4, marginTop:2 },
  stat:     { color:C.muted, fontSize:9 },
  dot:      { width:2, height:2, borderRadius:1, backgroundColor:C.subtle },
});

// ─────────────────────────────────────────────────────────────────────────────
// GENRE RADAR — données réelles des posts
// ─────────────────────────────────────────────────────────────────────────────
const GenreRadar = memo(function GenreRadar({ posts }:{ posts:Post[] }) {
  const counts = useMemo(() => {
    const m: Record<string,number> = {};
    posts.forEach(p => { if (p.work_genre) m[p.work_genre] = (m[p.work_genre] ?? 0) + 1; });
    return Object.entries(m).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [posts]);

  if (!counts.length) return null;
  const max = counts[0]?.[1] ?? 1;

  return (
    <View style={gr.wrap}>
      <BlurView intensity={Platform.OS==='ios'?10:7} tint="dark"
        style={StyleSheet.absoluteFillObject}/>
      <View style={gr.inner}>
        <View style={gr.head}>
          <Ionicons name="pie-chart-outline" size={12} color={C.mid}/>
          <Text style={gr.title}>Genres du moment</Text>
        </View>
        {counts.map(([genre, count]) => (
          <View key={genre} style={gr.row}>
            <Text style={gr.genre} numberOfLines={1}>{genre}</Text>
            <View style={gr.barTrack}>
              <View style={[gr.barFill, { width:`${(count/max)*100}%` as any }]}/>
            </View>
            <Text style={gr.count}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const gr = StyleSheet.create({
  wrap:    { marginHorizontal:EDGE, marginBottom:16, borderRadius:14, overflow:'hidden',
             borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  inner:   { padding:14 },
  head:    { flexDirection:'row', alignItems:'center', gap:6, marginBottom:12 },
  title:   { color:C.offWhite, fontSize:12, fontWeight:'800' },
  row:     { flexDirection:'row', alignItems:'center', gap:9, marginBottom:8 },
  genre:   { color:C.mid, fontSize:11, fontWeight:'600', width:90 },
  barTrack:{ flex:1, height:4, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
  barFill: { height:'100%', borderRadius:2, backgroundColor:C.subtle },
  count:   { color:C.muted, fontSize:9, fontWeight:'700', width:18, textAlign:'right' },
});

// ═════════════════════════════════════════════════════════════════════════════
// PROS — connexion professionnelle, glass monochrome
// ═════════════════════════════════════════════════════════════════════════════

const ProStatusBadge = memo(function ProStatusBadge({ status }:{ status:ConnStatus }) {
  if (status === 'none') return null;
  const cfg = {
    pending:  { icon:'time-outline'          as const, label:'En attente' },
    accepted: { icon:'checkmark-circle'      as const, label:'Connecté'   },
    rejected: { icon:'close-circle-outline'  as const, label:'Refusé'     },
  }[status];
  return (
    <View style={psb.wrap}>
      <Ionicons name={cfg.icon} size={9} color={C.muted}/>
      <Text style={psb.txt}>{cfg.label}</Text>
    </View>
  );
});

const psb = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3,
          borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
          backgroundColor:C.faint },
  txt:  { color:C.muted, fontSize:9, fontWeight:'700' },
});

// ── Pro Card — glass monochrome ───────────────────────────────────────────────
const ProCard = memo(function ProCard({
  pro, status, onConnect,
}: { pro:Pro; status:ConnStatus; onConnect:(p:Pro)=>void }) {
  const connected = status === 'accepted';
  const pending   = status === 'pending';

  return (
    <View style={proc.wrap}>
      <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark"
        style={StyleSheet.absoluteFillObject}/>

      <View style={proc.inner}>
        {/* Header */}
        <View style={proc.head}>
          <View style={proc.avatarWrap}>
            <Image
              source={{ uri:pro.avatar ?? `https://i.pravatar.cc/120?u=${pro.id}` }}
              style={proc.avatar}
              resizeMode="cover"
            />
            {pro.verified && (
              <View style={proc.verifiedDot}>
                <Ionicons name="checkmark" size={8} color={C.white}/>
              </View>
            )}
          </View>

          <View style={{ flex:1, gap:3 }}>
            <Text style={proc.name} numberOfLines={1}>{pro.name}</Text>
            <Text style={proc.role} numberOfLines={1}>{pro.role}</Text>
            {pro.location && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                <Ionicons name="location-outline" size={9} color={C.muted}/>
                <Text style={proc.loc}>{pro.location}</Text>
              </View>
            )}
          </View>

          <ProStatusBadge status={status}/>
        </View>

        {!!pro.bio && (
          <Text style={proc.bio} numberOfLines={2}>{pro.bio}</Text>
        )}

        {pro.films.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap:6 }}>
            {pro.films.slice(0,5).map(f => (
              <View key={f} style={proc.filmChip}>
                <Ionicons name="film-outline" size={8} color={C.muted}/>
                <Text style={proc.filmTxt} numberOfLines={1}>{f}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {pro.open_to.length > 0 && (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:5 }}>
            {pro.open_to.slice(0,4).map(o => (
              <View key={o} style={proc.openChip}>
                <Text style={proc.openTxt}>{o}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={proc.sep}/>

        {/* Actions */}
        <View style={proc.actions}>
          <TouchableOpacity
            style={[proc.connBtn, connected && proc.connBtnActive]}
            onPress={() => {
              if (Platform.OS !== 'web')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onConnect(pro);
            }}
            activeOpacity={0.82}
          >
            <Ionicons
              name={connected ? 'people' : pending ? 'time-outline' : 'person-add-outline'}
              size={13}
              color={connected ? C.white : C.muted}
            />
            <Text style={[proc.connTxt, connected && { color:C.white }]}>
              {connected ? 'Connecté' : pending ? 'En attente' : 'Se connecter'}
            </Text>
          </TouchableOpacity>

          {pro.website && (
            <TouchableOpacity
              style={proc.webBtn}
              onPress={() => Linking.openURL(pro.website!).catch(() => {})}
              activeOpacity={0.80}
            >
              <Ionicons name="globe-outline" size={14} color={C.muted}/>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const proc = StyleSheet.create({
  wrap:         { marginHorizontal:EDGE, marginBottom:10, borderRadius:18, overflow:'hidden',
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  inner:        { padding:16, gap:12 },
  head:         { flexDirection:'row', alignItems:'flex-start', gap:12 },
  avatarWrap:   { position:'relative' },
  avatar:       { width:48, height:48, borderRadius:24, borderWidth:1, borderColor:C.border },
  verifiedDot:  { position:'absolute', bottom:-1, right:-1, width:16, height:16, borderRadius:8,
                  backgroundColor:C.navyMid, borderWidth:1, borderColor:C.borderHi,
                  alignItems:'center', justifyContent:'center' },
  name:         { color:C.white, fontSize:14, fontWeight:'800', letterSpacing:-0.2 },
  role:         { color:C.muted, fontSize:11 },
  loc:          { color:C.muted, fontSize:10 },
  bio:          { color:C.mid, fontSize:12, lineHeight:17 },
  filmChip:     { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:9,
                  paddingVertical:4, borderRadius:10, borderWidth:StyleSheet.hairlineWidth,
                  borderColor:C.border, backgroundColor:C.faint, maxWidth:120 },
  filmTxt:      { color:C.muted, fontSize:9, fontWeight:'600', flexShrink:1 },
  openChip:     { paddingHorizontal:9, paddingVertical:3, borderRadius:10,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  openTxt:      { color:C.muted, fontSize:9, fontWeight:'600' },
  sep:          { height:StyleSheet.hairlineWidth, backgroundColor:C.border },
  actions:      { flexDirection:'row', gap:9 },
  connBtn:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                  gap:7, paddingVertical:10, borderRadius:13,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  connBtnActive:{ borderColor:C.borderHi, backgroundColor:C.subtle },
  connTxt:      { color:C.muted, fontSize:12, fontWeight:'700' },
  webBtn:       { width:40, height:40, borderRadius:13, borderWidth:StyleSheet.hairlineWidth,
                  borderColor:C.border, backgroundColor:C.faint,
                  alignItems:'center', justifyContent:'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION REQUEST MODAL — glass monochrome
// ─────────────────────────────────────────────────────────────────────────────
const ConnectionRequestModal = memo(function ConnectionRequestModal({
  pro, status, userId, onClose, onSent,
}: {
  pro:Pro|null; status:ConnStatus; userId:string;
  onClose:()=>void; onSent:(id:string)=>void;
}) {
  const [note,    setNote]    = useState('');
  const [sending, setSending] = useState(false);
  const [phase,   setPhase]   = useState<'form'|'success'|'already'>('form');
  const slide     = useRef(new Animated.Value(900)).current;
  const succSc    = useRef(new Animated.Value(0)).current;
  const checkFade = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pro) {
      setNote(''); setSending(false);
      setPhase(status === 'accepted' ? 'already' : 'form');
      Animated.spring(slide, { toValue:0, tension:60, friction:12, useNativeDriver:true }).start();
    } else {
      Animated.timing(slide, { toValue:900, duration:240, useNativeDriver:true }).start();
    }
  }, [pro, status]);

  const handleSend = useCallback(async () => {
    if (!pro || note.trim().length < 20) return;
    setSending(true);
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const { ok, error:err } = await dbSendConnection(pro.id, userId);
    setSending(false);
    if (ok) {
      setPhase('success');
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.spring(succSc,    { toValue:1, tension:80, friction:8, useNativeDriver:true }),
        Animated.timing(checkFade, { toValue:1, duration:400, useNativeDriver:true }),
      ]).start();
      onSent(pro.id);
      setTimeout(onClose, 2800);
    } else {
      Alert.alert('Erreur', err ?? 'Impossible d\'envoyer la demande.');
    }
  }, [pro, userId, note, onSent, onClose]);

  if (!pro) return null;

  const charOk  = note.trim().length >= 20;
  const charPct = Math.min(100, (note.trim().length / 300) * 100);
  const lineColor = focusAnim.interpolate({
    inputRange:[0,1], outputRange:[C.border, C.borderHi],
  });

  return (
    <Modal visible animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground/>
      <View style={crm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView
          behavior={Platform.OS==='ios' ? 'padding' : undefined}
          style={crm.kav}
        >
          <Animated.View style={[crm.sheet, { transform:[{ translateY:slide }] }]}>
            <BlurView intensity={Platform.OS==='ios'?90:70} tint="dark"
              style={StyleSheet.absoluteFillObject}/>

            <View style={{ flex:1 }}>
              <View style={crm.handle}/>

              {/* SUCCESS */}
              {phase === 'success' && (
                <View style={crm.centered}>
                  <Animated.View style={[crm.successRing, { transform:[{ scale:succSc }] }]}>
                    <Animated.View style={{ opacity:checkFade }}>
                      <Ionicons name="checkmark" size={34} color={C.white}/>
                    </Animated.View>
                  </Animated.View>
                  <Text style={crm.phaseTitle}>Demande envoyée</Text>
                  <Text style={crm.phaseSub}>
                    {pro.name} recevra votre invitation.{'\n'}
                    Vous serez notifié dès qu'il/elle accepte.
                  </Text>
                  <View style={crm.infoRow}>
                    <Ionicons name="time-outline" size={12} color={C.muted}/>
                    <Text style={crm.infoTxt}>Réponse habituelle sous 48h</Text>
                  </View>
                </View>
              )}

              {/* ALREADY CONNECTED */}
              {phase === 'already' && (
                <View style={crm.centered}>
                  <View style={crm.connectedRing}>
                    <Ionicons name="people" size={28} color={C.white}/>
                  </View>
                  <Text style={crm.phaseTitle}>Vous êtes connectés</Text>
                  <Text style={crm.phaseSub}>{pro.name} a accepté votre invitation.</Text>
                  <View style={{ width:'100%', gap:9 }}>
                    {pro.contact_email && (
                      <TouchableOpacity style={crm.actionBtn}
                        onPress={() => Linking.openURL(`mailto:${pro.contact_email}`).catch(()=>{})}
                        activeOpacity={0.85}>
                        <Ionicons name="mail-outline" size={14} color={C.white}/>
                        <Text style={crm.actionTxt}>Envoyer un email</Text>
                      </TouchableOpacity>
                    )}
                    {pro.website && (
                      <TouchableOpacity style={crm.actionBtn}
                        onPress={() => Linking.openURL(pro.website!).catch(()=>{})}
                        activeOpacity={0.85}>
                        <Ionicons name="globe-outline" size={14} color={C.white}/>
                        <Text style={crm.actionTxt}>Voir le portfolio</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={{ alignSelf:'center', paddingVertical:10 }}>
                      <Text style={{ color:C.muted, fontSize:13 }}>Fermer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* FORM */}
              <GalaxyBackground/>
              {phase === 'form' && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Pro header */}
                  <View style={crm.proHead}>
                    <Image
                      source={{ uri:pro.avatar ?? `https://i.pravatar.cc/100?u=${pro.id}` }}
                      style={crm.proAvatar} resizeMode="cover"
                    />
                    <View style={{ flex:1, gap:3 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
                        <Text style={crm.proName}>{pro.name}</Text>
                        {status === 'pending' && <ProStatusBadge status="pending"/>}
                      </View>
                      <Text style={crm.proRole}>{pro.role}</Text>
                      {pro.location && <Text style={crm.proLoc}>{pro.location}</Text>}
                    </View>
                    <TouchableOpacity style={crm.closeBtn} onPress={onClose} hitSlop={10}>
                      <Ionicons name="close" size={14} color={C.muted}/>
                    </TouchableOpacity>
                  </View>

                  {pro.films.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap:7, paddingHorizontal:20, paddingBottom:16 }}>
                      {pro.films.slice(0,5).map(f => (
                        <View key={f} style={crm.filmChip}>
                          <Ionicons name="film-outline" size={9} color={C.muted}/>
                          <Text style={crm.filmTxt} numberOfLines={1}>{f}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {status === 'pending' ? (
                    <View style={crm.pendingBox}>
                      <Ionicons name="time-outline" size={18} color={C.muted}/>
                      <View style={{ flex:1 }}>
                        <Text style={crm.pendingTitle}>Invitation envoyée</Text>
                        <Text style={crm.pendingBody}>
                          {pro.name} n'a pas encore répondu.{'\n'}
                          Vous serez notifié dès qu'il/elle accepte.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ paddingHorizontal:20 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                        <Text style={crm.noteLabel}>Note personnalisée</Text>
                        <Text style={crm.noteReq}>obligatoire</Text>
                      </View>
                      <Text style={crm.noteHint}>
                        Expliquez à {pro.name.split(' ')[0]} pourquoi vous souhaitez vous connecter.
                      </Text>

                      <TextInput
                        style={crm.noteInput}
                        value={note}
                        onChangeText={setNote}
                        multiline maxLength={300}
                        textAlignVertical="top"
                        placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous ai découvert sur Universe…`}
                        placeholderTextColor="rgba(255,255,255,0.16)"
                        selectionColor={C.white}
                        onFocus={() =>
                          Animated.timing(focusAnim,{toValue:1,duration:180,useNativeDriver:false}).start()}
                        onBlur={() =>
                          Animated.timing(focusAnim,{toValue:0,duration:180,useNativeDriver:false}).start()}
                      />
                      <Animated.View style={{ height:StyleSheet.hairlineWidth,
                        backgroundColor:lineColor, marginBottom:10 }}/>

                      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:6 }}>
                        <View style={crm.charBarBg}>
                          <View style={[crm.charBarFill, {
                            width:`${charPct}%` as any,
                            backgroundColor: charOk ? C.white : C.subtle,
                          }]}/>
                        </View>
                        <Text style={[crm.charCount, charOk && { color:C.white }]}>
                          {note.trim().length}/300
                        </Text>
                      </View>
                      {!charOk && note.length > 0 && (
                        <Text style={crm.charHint}>
                          Encore {20 - note.trim().length} caractères minimum
                        </Text>
                      )}

                      {pro.open_to.length > 0 && (
                        <View style={crm.openToBox}>
                          <Text style={crm.openToLabel}>Ouvert à</Text>
                          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:8 }}>
                            {pro.open_to.map(o => (
                              <View key={o} style={crm.openToChip}>
                                <Text style={crm.openToTxt}>{o}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={{ height:160 }}/>
                </ScrollView>
              )}
            </View>

            {/* Footer */}
            {phase === 'form' && (
              <View style={crm.footer}>
                <TouchableOpacity style={crm.cancelBtn} onPress={onClose} activeOpacity={0.80}>
                  <Text style={crm.cancelTxt}>Annuler</Text>
                </TouchableOpacity>

                {status === 'pending' ? (
                  <TouchableOpacity style={[crm.sendBtn, crm.sendBtnActive]}
                    onPress={onClose} activeOpacity={0.85}>
                    <Text style={crm.sendTxt}>Fermer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[crm.sendBtn, charOk && crm.sendBtnActive,
                            (sending || !charOk) && { opacity:0.40 }]}
                    onPress={handleSend}
                    disabled={!charOk || sending}
                    activeOpacity={0.88}
                  >
                    {sending
                      ? <ActivityIndicator color={C.white} size="small"/>
                      : <>
                          <Ionicons name="person-add-outline" size={14} color={C.white}/>
                          <Text style={crm.sendTxt}>Se connecter</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const crm = StyleSheet.create({
  overlay:      { flex:1, justifyContent:'flex-end' },
  kav:          { flex:1, justifyContent:'flex-end' },
  sheet:        { maxHeight:'92%', borderTopLeftRadius:26, borderTopRightRadius:26,
                  overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  handle:       { width:38, height:4, borderRadius:2, backgroundColor:C.border,
                  alignSelf:'center', marginTop:12, marginBottom:4 },
  centered:     { alignItems:'center', padding:36, paddingVertical:48, gap:14 },
  successRing:  { width:78, height:78, borderRadius:39, borderWidth:1, borderColor:C.border,
                  backgroundColor:C.subtle, alignItems:'center', justifyContent:'center' },
  connectedRing:{ width:70, height:70, borderRadius:35, borderWidth:1, borderColor:C.border,
                  backgroundColor:C.subtle, alignItems:'center', justifyContent:'center' },
  phaseTitle:   { color:C.white, fontSize:20, fontWeight:'900', textAlign:'center' },
  phaseSub:     { color:C.muted, fontSize:13, textAlign:'center', lineHeight:20 },
  infoRow:      { flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:16,
                  paddingVertical:10, borderRadius:13, borderWidth:StyleSheet.hairlineWidth,
                  borderColor:C.border, backgroundColor:C.faint },
  infoTxt:      { color:C.muted, fontSize:11, flex:1 },
  actionBtn:    { flexDirection:'row', alignItems:'center', gap:9, paddingHorizontal:22,
                  paddingVertical:12, borderRadius:15, borderWidth:StyleSheet.hairlineWidth,
                  borderColor:C.border, backgroundColor:C.faint, justifyContent:'center' },
  actionTxt:    { color:C.white, fontSize:14, fontWeight:'700' },
  proHead:      { flexDirection:'row', alignItems:'flex-start', gap:14,
                  paddingHorizontal:20, paddingTop:16, paddingBottom:16 },
  proAvatar:    { width:52, height:52, borderRadius:26, borderWidth:1, borderColor:C.border },
  proName:      { color:C.white, fontSize:15, fontWeight:'900', flexShrink:1 },
  proRole:      { color:C.muted, fontSize:11 },
  proLoc:       { color:C.muted, fontSize:10 },
  closeBtn:     { width:30, height:30, borderRadius:15, borderWidth:StyleSheet.hairlineWidth,
                  borderColor:C.border, backgroundColor:C.faint,
                  alignItems:'center', justifyContent:'center' },
  filmChip:     { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:9,
                  paddingVertical:4, borderRadius:9, borderWidth:StyleSheet.hairlineWidth,
                  borderColor:C.border, backgroundColor:C.faint, maxWidth:130 },
  filmTxt:      { color:C.muted, fontSize:10, fontWeight:'600', flexShrink:1 },
  noteLabel:    { color:C.white, fontSize:13, fontWeight:'700', flex:1 },
  noteReq:      { color:C.muted, fontSize:10, fontWeight:'600' },
  noteHint:     { color:C.muted, fontSize:11, lineHeight:17, marginBottom:14 },
  noteInput:    { color:C.white, fontSize:14, minHeight:130, lineHeight:22, paddingVertical:4 },
  charBarBg:    { flex:1, height:2, borderRadius:1, backgroundColor:C.faint, overflow:'hidden' },
  charBarFill:  { height:'100%', borderRadius:1 },
  charCount:    { color:C.muted, fontSize:10, fontWeight:'700', minWidth:40, textAlign:'right' },
  charHint:     { color:C.muted, fontSize:10, marginBottom:10 },
  openToBox:    { marginTop:14, padding:14, borderRadius:13,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  openToLabel:  { color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:0.8,
                  textTransform:'uppercase' },
  openToChip:   { paddingHorizontal:10, paddingVertical:4, borderRadius:10,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  openToTxt:    { color:C.muted, fontSize:10, fontWeight:'600' },
  pendingBox:   { flexDirection:'row', alignItems:'flex-start', gap:12,
                  marginHorizontal:20, marginBottom:20, padding:16, borderRadius:15,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  pendingTitle: { color:C.offWhite, fontSize:13, fontWeight:'700', marginBottom:5 },
  pendingBody:  { color:C.muted, fontSize:12, lineHeight:18 },
  footer:       { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:20,
                  paddingTop:14, paddingBottom:Platform.OS==='ios'?36:20,
                  borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  cancelBtn:    { paddingHorizontal:18, paddingVertical:13, borderRadius:15,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  cancelTxt:    { color:C.muted, fontSize:14, fontWeight:'600' },
  sendBtn:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                  gap:8, paddingVertical:13, borderRadius:15,
                  borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                  backgroundColor:C.faint },
  sendBtnActive:{ backgroundColor:C.subtle, borderColor:C.borderHi },
  sendTxt:      { color:C.white, fontSize:14, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRO DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────
const ProSectionHeader = memo(function ProSectionHeader({
  title, count,
}: { title:string; count:number }) {
  return (
    <View style={pd.secHead}>
      <View style={pd.secLine}/>
      <Text style={pd.secTitle}>{title}</Text>
      <View style={pd.secCount}>
        <Text style={pd.secCountTxt}>{count}</Text>
      </View>
      <View style={pd.secLine}/>
    </View>
  );
});

function ProDirectory({ userId }:{ userId:string }) {
  const [search,     setSearch]     = useState('');
  const [activeRole, setActiveRole] = useState('Tous');
  const [connectPro, setConnectPro] = useState<Pro|null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('none');
  const searchRef   = useRef<TextInput>(null);
  const searchFocus = useRef(new Animated.Value(0)).current;

  const { pros, loading, error, refresh } = useProDirectory(search, activeRole);
  const { connections, setStatus }        = useConnections(userId);

  const connectedCount = useMemo(() =>
    Object.values(connections).filter(s => s === 'accepted').length, [connections]);
  const pendingCount = useMemo(() =>
    Object.values(connections).filter(s => s === 'pending').length, [connections]);

  const grouped = useMemo(() => {
    if (!pros.length) return [];
    if (activeRole !== 'Tous') return [{ title:activeRole, data:pros }];
    const map: Record<string,Pro[]> = {};
    pros.forEach(p => {
      const cat = p.role?.trim() || 'Autre';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return Object.entries(map)
      .sort(([a],[b]) => a.localeCompare(b,'fr'))
      .map(([title, data]) => ({ title, data }));
  }, [pros, activeRole]);

  const handleOpen = useCallback((pro:Pro) => {
    setConnStatus(connections[pro.id] ?? 'none');
    setConnectPro(pro);
  }, [connections]);

  const searchLineColor = searchFocus.interpolate({
    inputRange:[0,1], outputRange:[C.border, C.borderHi],
  });

  return (
    <View style={{ flex:1 }}>
      {/* Header fixe */}
      <View style={pd.fixedHeader}>
        {(connectedCount > 0 || pendingCount > 0) && (
          <View style={pd.statsBar}>
            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={pd.statsRow}>
              {connectedCount > 0 && (
                <View style={pd.statItem}>
                  <Ionicons name="people" size={11} color={C.muted}/>
                  <Text style={pd.statTxt}>
                    {connectedCount} connecté{connectedCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {pendingCount > 0 && (
                <View style={pd.statItem}>
                  <Ionicons name="time-outline" size={11} color={C.muted}/>
                  <Text style={pd.statTxt}>{pendingCount} en attente</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Barre de recherche */}
        <View style={pd.searchRow}>
          <Ionicons name="search-outline" size={14} color={C.muted} style={{ marginTop:2 }}/>
          <View style={{ flex:1 }}>
            <TextInput
              ref={searchRef}
              style={pd.searchInput}
              placeholder="Rechercher un professionnel…"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
              selectionColor={C.white}
              onFocus={() =>
                Animated.timing(searchFocus,{toValue:1,duration:180,useNativeDriver:false}).start()}
              onBlur={() =>
                Animated.timing(searchFocus,{toValue:0,duration:180,useNativeDriver:false}).start()}
            />
            <Animated.View style={{ height:StyleSheet.hairlineWidth, backgroundColor:searchLineColor }}/>
          </View>
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); searchRef.current?.focus(); }}
              hitSlop={8 as any}>
              <Ionicons name="close-circle" size={14} color={C.muted}/>
            </TouchableOpacity>
          )}
        </View>

        {/* Filtres rôles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:EDGE, gap:7 }}
          style={{ marginTop:12 }}>
          {PRO_ROLES.map(r => {
            const on = activeRole === r;
            return (
              <TouchableOpacity key={r} style={[pd.roleChip, on && pd.roleChipOn]}
                onPress={() => setActiveRole(r)} activeOpacity={0.80}>
                <Text style={[pd.roleTxt, on && pd.roleTxtOn]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={pd.headerSep}/>
      </View>

      {loading ? (
        <View style={pd.center}>
          <ActivityIndicator color={C.muted} size="large"/>
          <Text style={pd.emptyTxt}>Chargement du répertoire…</Text>
        </View>
      ) : error ? (
        <View style={pd.center}>
          <Ionicons name="cloud-offline-outline" size={28} color={C.muted}/>
          <Text style={pd.emptyTxt}>{error}</Text>
          <TouchableOpacity style={pd.retryBtn} onPress={refresh}>
            <Text style={pd.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : grouped.length === 0 ? (
        <View style={pd.center}>
          <Ionicons name="people-outline" size={40} color={C.muted}/>
          <Text style={pd.emptyTxt}>Aucun professionnel trouvé</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom:120 }}
          keyboardShouldPersistTaps="handled">
          {grouped.map(section => (
            <View key={section.title}>
              <ProSectionHeader title={section.title} count={section.data.length}/>
              {section.data.map(pro => (
                <ProCard key={pro.id} pro={pro}
                  status={connections[pro.id] ?? 'none'}
                  onConnect={handleOpen}/>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <ConnectionRequestModal
        pro={connectPro}
        status={connStatus}
        userId={userId}
        onClose={() => setConnectPro(null)}
        onSent={id => setStatus(id, 'pending')}
      />
    </View>
  );
}

const pd = StyleSheet.create({
  fixedHeader: { paddingTop:8, paddingBottom:0 },
  headerSep:   { height:StyleSheet.hairlineWidth, backgroundColor:C.border, marginTop:14 },
  statsBar:    { marginHorizontal:EDGE, marginBottom:12, borderRadius:11, overflow:'hidden',
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  statsRow:    { flexDirection:'row', gap:16, paddingHorizontal:14, paddingVertical:9 },
  statItem:    { flexDirection:'row', alignItems:'center', gap:6 },
  statTxt:     { color:C.muted, fontSize:11 },
  searchRow:   { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:EDGE },
  searchInput: { color:C.white, fontSize:14, paddingVertical:10, flex:1 },
  roleChip:    { paddingHorizontal:13, paddingVertical:7, borderRadius:18,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                 backgroundColor:C.faint },
  roleChipOn:  { backgroundColor:C.subtle, borderColor:C.borderHi },
  roleTxt:     { color:C.muted, fontSize:11, fontWeight:'600' },
  roleTxtOn:   { color:C.white, fontWeight:'700' },
  secHead:     { flexDirection:'row', alignItems:'center', gap:12,
                 paddingHorizontal:EDGE, paddingTop:22, paddingBottom:12 },
  secLine:     { flex:1, height:StyleSheet.hairlineWidth, backgroundColor:C.border },
  secTitle:    { color:C.offWhite, fontSize:10, fontWeight:'700', letterSpacing:1.2,
                 textTransform:'uppercase' },
  secCount:    { paddingHorizontal:8, paddingVertical:2, borderRadius:10,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                 backgroundColor:C.faint },
  secCountTxt: { color:C.muted, fontSize:10, fontWeight:'700' },
  center:      { flex:1, alignItems:'center', justifyContent:'center',
                 gap:12, paddingVertical:60 },
  emptyTxt:    { color:C.muted, fontSize:13, fontWeight:'600',
                 textAlign:'center', paddingHorizontal:40 },
  retryBtn:    { paddingHorizontal:20, paddingVertical:9, borderRadius:13,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                 backgroundColor:C.faint },
  retryTxt:    { color:C.white, fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL — monochrome
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ['film','critique','media','preview'] as const;
type CStep = typeof STEPS[number];
const STEP_LBL:  Record<CStep,string> = { film:"L'Œuvre", critique:'Critique', media:'Image', preview:'Aperçu' };
const STEP_ICON: Record<CStep,keyof typeof Ionicons.glyphMap> = {
  film:'film-outline', critique:'create-outline', media:'image-outline', preview:'eye-outline',
};
const INIT_FORM: CForm = {
  workTitle:'', workYear:'', workDirector:'', workGenre:'',
  rating:0, tone:null, body:'', tags:[], imageUri:'', imageUrl:'', imageValid:false,
};

function ComposeModal({
  visible, onClose, onPublished, userId,
}: { visible:boolean; onClose:()=>void; onPublished?:()=>void; userId:string }) {
  const [step,      setStep]  = useState<CStep>('film');
  const [form,      setForm]  = useState<CForm>(INIT_FORM);
  const [publishing,setPub]   = useState(false);
  const [imgLoading,setImgL]  = useState(false);
  const [errors,    setErrors]= useState<Partial<Record<CStep,string>>>({});
  const slide = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (visible) {
      setStep('film'); setForm(INIT_FORM); setErrors({});
      Animated.spring(slide, { toValue:0, tension:58, friction:12, useNativeDriver:true }).start();
    } else {
      Animated.timing(slide, { toValue:800, duration:220, useNativeDriver:true }).start();
    }
  }, [visible]);

  const patch  = useCallback(<K extends keyof CForm>(k:K, v:CForm[K]) =>
    setForm(f => ({ ...f, [k]:v })), []);
  const setErr  = (s:CStep, m:string) => setErrors(e => ({ ...e, [s]:m }));
  const clrErr  = (s:CStep) => setErrors(e => ({ ...e, [s]:'' }));

  const validate = useCallback((s:CStep): string|null => {
    if (s === 'film') {
      if (!form.workTitle.trim()) return 'Titre obligatoire.';
      if (!form.workGenre)        return 'Genre requis.';
      if (form.rating === 0)      return 'Note requise.';
    }
    if (s === 'critique') {
      if (!form.tone)                            return 'Ton requis.';
      if (form.body.trim().length < MIN_BODY)   return `Min ${MIN_BODY} car.`;
    }
    return null;
  }, [form]);

  const goNext = useCallback(() => {
    const err = validate(step);
    if (err) { setErr(step, err); return; }
    clrErr(step);
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i+1]);
  }, [step, validate]);

  const goBack = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i-1]);
  }, [step]);

  const pickImage = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission requise'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, allowsEditing:true, aspect:[16,9],
    });
    if (res.canceled || !res.assets?.[0]) return;
    patch('imageUri', res.assets[0].uri);
    patch('imageValid', false); patch('imageUrl', '');
    setImgL(true); clrErr('media');
    const url = await uploadImage(res.assets[0].uri);
    setImgL(false);
    if (!url) { setErr('media', 'Upload échoué.'); return; }
    patch('imageUrl', url); patch('imageValid', true);
  }, [patch]);

  const publish = useCallback(async () => {
    if (!form.imageValid || !form.tone) return;
    setPub(true);
    const id = await dbPublishPost({
      work_title:    form.workTitle.trim(),
      work_year:     form.workYear.trim(),
      work_director: form.workDirector.trim(),
      work_genre:    form.workGenre,
      rating:        form.rating,
      body:          form.body.trim(),
      image_url:     form.imageUrl,
      image_valid:   true,
      tags:          form.tags,
      tone:          form.tone,
    });
    setPub(false);
    if (id) {
      NotifService.resolveMentions(form.body).then(mentionedIds => {
        mentionedIds.forEach(uid => {
          if (uid !== userId) {
            NotifService.mention({
              mentionedUserId: uid, actorId:userId, postId:id,
              filmTitle:       form.workTitle.trim(),
              bodyExcerpt:     form.body.slice(0,80),
            }).catch(() => {});
          }
        });
      });
      onPublished?.(); onClose();
    } else {
      Alert.alert('Erreur', 'Publication échouée.');
    }
  }, [form, onPublished, onClose, userId]);

  const stepIdx    = STEPS.indexOf(step);
  const bodyLen    = form.body.trim().length;
  const toneInfo   = TONES.find(t => t.key === form.tone);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(7,12,23,0.85)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView
          behavior={Platform.OS==='ios' ? 'padding' : undefined}
          style={{ flex:1, justifyContent:'flex-end' }}
        >
          <Animated.View style={{
            maxHeight:'94%', borderTopLeftRadius:26, borderTopRightRadius:26,
            overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
            transform:[{ translateY:slide }],
          }}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}/>

            <View style={{ flex:1 }}>
              {/* Handle */}
              <View style={cm.handle}/>

              {/* En-tête */}
              <View style={cm.header}>
                <View style={{ flex:1 }}>
                  <Text style={cm.title}>Nouvelle Critique</Text>
                  <Text style={cm.subtitle}>Cinéma indépendant</Text>
                </View>
                <TouchableOpacity style={cm.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={14} color={C.muted}/>
                </TouchableOpacity>
              </View>

              {/* Step indicator */}
              <View style={cm.steps}>
                {STEPS.map((st,i) => {
                  const done = i < stepIdx, curr = i === stepIdx;
                  return (
                    <View key={st} style={{ flex:1, alignItems:'center', position:'relative' }}>
                      <View style={[cm.stepDot, done && cm.stepDone, curr && cm.stepCurr]}>
                        <Ionicons
                          name={done ? 'checkmark' : STEP_ICON[st]}
                          size={11}
                          color={done || curr ? C.white : C.muted}
                        />
                      </View>
                      <Text style={[cm.stepLabel, curr && cm.stepLabelOn]}>
                        {STEP_LBL[st]}
                      </Text>
                      {i < STEPS.length - 1 && (
                        <View style={[cm.stepLine, done && cm.stepLineDone]}/>
                      )}
                    </View>
                  );
                })}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ paddingHorizontal:20 }}>

                  {/* STEP 0 — Œuvre */}
                  {step === 'film' && (<>
                    <Text style={cm.fieldLabel}>TITRE *</Text>
                    <TextInput style={cm.input}
                      placeholderTextColor={C.muted}
                      placeholder="Ex : Portrait de la jeune fille en feu"
                      value={form.workTitle}
                      onChangeText={v => { patch('workTitle',v); clrErr('film'); }}
                    />

                    <View style={{ flexDirection:'row', gap:10, marginBottom:20 }}>
                      <View style={{ flex:1 }}>
                        <Text style={cm.fieldLabel}>RÉALISATEUR</Text>
                        <TextInput style={cm.input} placeholder="Nom"
                          placeholderTextColor={C.muted}
                          value={form.workDirector}
                          onChangeText={v => patch('workDirector',v)}/>
                      </View>
                      <View style={{ width:84 }}>
                        <Text style={cm.fieldLabel}>ANNÉE</Text>
                        <TextInput style={cm.input} placeholder="2025"
                          placeholderTextColor={C.muted}
                          value={form.workYear}
                          onChangeText={v => patch('workYear',v)}
                          keyboardType="numeric" maxLength={4}/>
                      </View>
                    </View>

                    <Text style={cm.fieldLabel}>GENRE *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap:8, paddingVertical:4, marginBottom:20 }}>
                      {GENRES_LIST.map(g => {
                        const on = form.workGenre === g;
                        return (
                          <TouchableOpacity key={g}
                            style={[cm.chip, on && cm.chipOn]}
                            onPress={() => { patch('workGenre',g); clrErr('film'); }}>
                            <Text style={[cm.chipTxt, on && cm.chipTxtOn]}>{g}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <Text style={cm.fieldLabel}>NOTE *</Text>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:14, marginBottom:20 }}>
                      <View style={{ flexDirection:'row', gap:4 }}>
                        {[1,2,3,4,5].map(s => (
                          <TouchableOpacity key={s}
                            onPress={() => { patch('rating',s); clrErr('film'); }}
                            hitSlop={6 as any}>
                            <Ionicons
                              name={form.rating >= s ? 'star' : 'star-outline'}
                              size={28}
                              color={form.rating >= s ? C.offWhite : C.subtle}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={cm.ratingLabel}>
                        {form.rating > 0 ? `${form.rating}/5` : '—'}
                      </Text>
                    </View>

                    {!!errors.film && <Text style={cm.errorTxt}>{errors.film}</Text>}
                  </>)}

                  {/* STEP 1 — Critique */}
                  {step === 'critique' && (<>
                    <Text style={cm.fieldLabel}>TON *</Text>
                    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:9, marginBottom:20 }}>
                      {TONES.map(t => {
                        const on = form.tone === t.key;
                        return (
                          <TouchableOpacity key={t.key}
                            style={[cm.toneTile, on && cm.toneTileOn]}
                            onPress={() => { patch('tone',t.key); clrErr('critique'); }}>
                            <Ionicons name={t.icon} size={18} color={on ? C.white : C.muted}/>
                            <Text style={[cm.toneTileLabel, on && { color:C.white }]}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={cm.fieldLabel}>CRITIQUE *</Text>
                    <TextInput style={[cm.input, { minHeight:140, textAlignVertical:'top' }]}
                      multiline
                      placeholder="Analysez la mise en scène, l'atmosphère, les partis pris…"
                      placeholderTextColor={C.muted}
                      value={form.body}
                      onChangeText={v => { patch('body',v); clrErr('critique'); }}
                    />
                    <View style={cm.bodyProgress}>
                      <View style={cm.bodyBarTrack}>
                        <View style={[cm.bodyBarFill, {
                          width:`${Math.min(100,(bodyLen/MIN_BODY)*100)}%` as any,
                          backgroundColor: bodyLen >= MIN_BODY ? C.white : C.subtle,
                        }]}/>
                      </View>
                      <Text style={[cm.bodyCount, bodyLen >= MIN_BODY && { color:C.white }]}>
                        {bodyLen}/{MIN_BODY}
                      </Text>
                    </View>

                    <Text style={[cm.fieldLabel, { marginTop:12 }]}>ASPECTS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap:8, paddingVertical:4, marginBottom:16 }}>
                      {ASPECTS.map(tag => {
                        const on = form.tags.includes(tag);
                        return (
                          <TouchableOpacity key={tag}
                            style={[cm.chip, on && cm.chipOn]}
                            onPress={() => patch('tags', on
                              ? form.tags.filter(t => t !== tag)
                              : [...form.tags, tag])}>
                            <Text style={[cm.chipTxt, on && cm.chipTxtOn]}>{tag}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {!!errors.critique && <Text style={cm.errorTxt}>{errors.critique}</Text>}
                  </>)}

                  {/* STEP 2 — Image */}
                  {step === 'media' && (<>
                    {form.imageUri ? (
                      <View style={{ height:200, borderRadius:14, overflow:'hidden', marginBottom:16 }}>
                        <Image source={{ uri:form.imageUri }} style={{ width:'100%', height:'100%' }}
                          resizeMode="cover"/>
                        <LinearGradient
                          colors={['transparent','rgba(7,12,23,0.82)']}
                          style={StyleSheet.absoluteFillObject}
                        />
                        {form.imageValid && !imgLoading && (
                          <View style={cm.imgReadyBadge}>
                            <Ionicons name="checkmark-circle-outline" size={12} color={C.white}/>
                            <Text style={cm.imgReadyTxt}>Image prête</Text>
                          </View>
                        )}
                        {imgLoading && (
                          <View style={{ ...StyleSheet.absoluteFillObject,
                            backgroundColor:'rgba(7,12,23,0.65)',
                            alignItems:'center', justifyContent:'center' }}>
                            <ActivityIndicator color={C.white}/>
                          </View>
                        )}
                        {!imgLoading && (
                          <TouchableOpacity style={cm.imgChangBtn} onPress={pickImage}>
                            <Ionicons name="refresh-outline" size={11} color={C.muted}/>
                            <Text style={cm.imgChangTxt}>Changer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity style={cm.imgPicker} onPress={pickImage} disabled={imgLoading}>
                        <View style={cm.imgPickerIcon}>
                          <Ionicons name="image-outline" size={34} color={C.muted}/>
                        </View>
                        <Text style={cm.imgPickerTitle}>Sélectionner depuis la galerie</Text>
                        <Text style={cm.imgPickerSub}>JPEG · PNG · 16:9 recommandé</Text>
                      </TouchableOpacity>
                    )}
                    {!!errors.media && <Text style={cm.errorTxt}>{errors.media}</Text>}
                  </>)}

                  {/* STEP 3 — Aperçu */}
                  {step === 'preview' && (<>
                    <View style={cm.previewCard}>
                      {form.imageUrl && (
                        <Image source={{ uri:form.imageUrl }}
                          style={{ width:'100%', height:'100%' }} resizeMode="cover"/>
                      )}
                      <LinearGradient
                        colors={['transparent','rgba(7,12,23,0.96)']}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={cm.previewMeta}>
                        {toneInfo && (
                          <View style={cm.previewToneBadge}>
                            <Ionicons name={toneInfo.icon} size={9} color={C.mid}/>
                            <Text style={cm.previewToneTxt}>{toneInfo.label.toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={cm.previewTitle} numberOfLines={2}>
                          {form.workTitle}
                        </Text>
                        <Text style={cm.previewMeta2}>
                          {[form.workDirector, form.workYear, form.workGenre].filter(Boolean).join(' · ')}
                        </Text>
                        <StarRow value={form.rating} size={13}/>
                      </View>
                    </View>

                    {/* Checklist */}
                    <View style={cm.checklist}>
                      {[
                        { ok:form.workTitle.trim().length > 0,  txt:'Œuvre identifiée'          },
                        { ok:form.rating > 0,                   txt:'Note attribuée'             },
                        { ok:form.tone !== null,                txt:'Ton défini'                 },
                        { ok:bodyLen >= MIN_BODY,               txt:`Critique ≥ ${MIN_BODY} car.`},
                        { ok:form.imageValid,                   txt:'Image uploadée'             },
                      ].map(item => (
                        <View key={item.txt} style={{ flexDirection:'row', alignItems:'center', gap:9 }}>
                          <Ionicons
                            name={item.ok ? 'checkmark-circle-outline' : 'ellipse-outline'}
                            size={14}
                            color={item.ok ? C.white : C.subtle}
                          />
                          <Text style={[cm.checkTxt, item.ok && { color:C.offWhite }]}>
                            {item.txt}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>)}
                </View>
                <View style={{ height:40 }}/>
              </ScrollView>

              {/* Footer navigation */}
              <View style={cm.footer}>
                {stepIdx > 0 && (
                  <TouchableOpacity style={cm.backBtn} onPress={goBack}>
                    <Ionicons name="chevron-back" size={14} color={C.muted}/>
                    <Text style={cm.backTxt}>Retour</Text>
                  </TouchableOpacity>
                )}

                {step !== 'preview' ? (
                  <TouchableOpacity
                    style={[cm.nextBtn, stepIdx === 0 && { marginLeft:'auto' as any }]}
                    onPress={goNext}
                  >
                    <Text style={cm.nextTxt}>Continuer</Text>
                    <Ionicons name="chevron-forward" size={13} color={C.white}/>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[cm.nextBtn, { opacity:publishing ? 0.50 : 1 }]}
                    onPress={publish}
                    disabled={publishing}
                  >
                    {publishing
                      ? <ActivityIndicator color={C.white} size="small"/>
                      : <>
                          <Ionicons name="send-outline" size={13} color={C.white}/>
                          <Text style={cm.nextTxt}>Publier</Text>
                        </>
                    }
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
  handle:          { width:36, height:4, borderRadius:2, backgroundColor:C.border,
                     alignSelf:'center', marginTop:12 },
  header:          { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start',
                     paddingHorizontal:20, paddingTop:14, paddingBottom:10 },
  title:           { color:C.white, fontSize:18, fontWeight:'800', letterSpacing:-0.3 },
  subtitle:        { color:C.muted, fontSize:11, marginTop:3 },
  closeBtn:        { width:30, height:30, borderRadius:15, backgroundColor:C.faint,
                     borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                     justifyContent:'center', alignItems:'center' },
  steps:           { flexDirection:'row', paddingHorizontal:20, marginBottom:16,
                     alignItems:'flex-start' },
  stepDot:         { width:28, height:28, borderRadius:14, backgroundColor:C.faint,
                     borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                     justifyContent:'center', alignItems:'center', marginBottom:4 },
  stepDone:        { backgroundColor:C.navyMid, borderColor:C.borderHi },
  stepCurr:        { backgroundColor:C.subtle, borderColor:C.borderHi },
  stepLabel:       { color:C.muted, fontSize:9, fontWeight:'700', letterSpacing:0.2,
                     textAlign:'center' },
  stepLabelOn:     { color:C.offWhite },
  stepLine:        { position:'absolute', top:14, left:'50%', right:'-50%',
                     height:StyleSheet.hairlineWidth, backgroundColor:C.border },
  stepLineDone:    { backgroundColor:C.subtle },
  fieldLabel:      { color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:0.8,
                     marginBottom:8, textTransform:'uppercase' },
  input:           { backgroundColor:C.navyLow, borderRadius:11, borderWidth:StyleSheet.hairlineWidth,
                     borderColor:C.border, paddingHorizontal:14, paddingVertical:13,
                     color:C.white, fontSize:14, marginBottom:20 },
  chip:            { paddingHorizontal:14, paddingVertical:8, borderRadius:20,
                     backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth,
                     borderColor:C.border },
  chipOn:          { backgroundColor:C.subtle, borderColor:C.borderHi },
  chipTxt:         { color:C.muted, fontSize:12, fontWeight:'600' },
  chipTxtOn:       { color:C.white },
  ratingLabel:     { color:C.mid, fontSize:15, fontWeight:'700' },
  toneTile:        { width:'48%', paddingVertical:16, borderRadius:13,
                     backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth,
                     borderColor:C.border, alignItems:'center', gap:7 },
  toneTileOn:      { backgroundColor:C.subtle, borderColor:C.borderHi },
  toneTileLabel:   { color:C.muted, fontSize:12, fontWeight:'700' },
  bodyProgress:    { flexDirection:'row', alignItems:'center', gap:10, marginTop:8, marginBottom:8 },
  bodyBarTrack:    { flex:1, height:2, borderRadius:1, backgroundColor:C.faint, overflow:'hidden' },
  bodyBarFill:     { height:'100%', borderRadius:1 },
  bodyCount:       { color:C.muted, fontSize:11, fontWeight:'700' },
  errorTxt:        { color:C.offWhite, fontSize:12, marginBottom:12, fontWeight:'600' },
  imgPicker:       { height:180, borderRadius:14, borderWidth:StyleSheet.hairlineWidth,
                     borderColor:C.border, borderStyle:'dashed', alignItems:'center',
                     justifyContent:'center', gap:10, marginBottom:20 },
  imgPickerIcon:   { width:60, height:60, borderRadius:30, backgroundColor:C.faint,
                     justifyContent:'center', alignItems:'center' },
  imgPickerTitle:  { color:C.offWhite, fontSize:13, fontWeight:'700' },
  imgPickerSub:    { color:C.muted, fontSize:11 },
  imgReadyBadge:   { position:'absolute', bottom:10, left:10, flexDirection:'row',
                     alignItems:'center', gap:5, backgroundColor:'rgba(7,12,23,0.80)',
                     paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  imgReadyTxt:     { color:C.white, fontSize:11, fontWeight:'700' },
  imgChangBtn:     { position:'absolute', top:8, right:8, flexDirection:'row', alignItems:'center',
                     gap:4, backgroundColor:'rgba(7,12,23,0.75)',
                     paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  imgChangTxt:     { color:C.muted, fontSize:11 },
  previewCard:     { height:210, borderRadius:16, overflow:'hidden',
                     backgroundColor:C.navyMid, marginBottom:16 },
  previewMeta:     { position:'absolute', bottom:0, left:0, right:0, padding:14, gap:5 },
  previewToneBadge:{ flexDirection:'row', alignItems:'center', gap:5, alignSelf:'flex-start',
                     paddingHorizontal:8, paddingVertical:3, borderRadius:7,
                     borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                     backgroundColor:'rgba(7,12,23,0.72)', marginBottom:4 },
  previewToneTxt:  { color:C.muted, fontSize:8, fontWeight:'800', letterSpacing:0.5 },
  previewTitle:    { color:C.white, fontSize:17, fontWeight:'800' },
  previewMeta2:    { color:C.muted, fontSize:11 },
  checklist:       { backgroundColor:C.navyLow, borderRadius:13,
                     borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
                     padding:14, gap:11, marginBottom:16 },
  checkTxt:        { color:C.muted, fontSize:12 },
  footer:          { flexDirection:'row', alignItems:'center', paddingHorizontal:20,
                     paddingBottom:Platform.OS==='ios'?34:18, paddingTop:14,
                     borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border, gap:12 },
  backBtn:         { flexDirection:'row', alignItems:'center', gap:4,
                     paddingHorizontal:12, paddingVertical:12 },
  backTxt:         { color:C.muted, fontSize:13, fontWeight:'600' },
  nextBtn:         { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                     gap:8, paddingVertical:14, borderRadius:22,
                     borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi,
                     backgroundColor:C.subtle },
  nextTxt:         { color:C.white, fontSize:14, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ SCREEN ★★★
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const [activeTab,   setActiveTab]  = useState<FeedTab>('Pour vous');
  const [composeOpen, setCompose]    = useState(false);
  const [userId,      setUserId]     = useState('anonymous');
  const [refreshing,  setRefreshing] = useState(false);
  const listRef = useRef<FlatList<Post>>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
      else supabase.auth.getUser().then(({ data:{ user } }) => {
        if (user?.id) setUserId(user.id);
      });
    });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => {
      if (s?.user?.id) setUserId(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { posts, loading, error, refresh, toggleLike, newCount } = usePostsFeed(activeTab);
  const { works, loading:wLoading } = useWorksAlgorithm();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const handleNewPostsBanner = useCallback(() => {
    refresh();
    listRef.current?.scrollToOffset({ offset:0, animated:true });
  }, [refresh]);

  // Tri tendances (réel : likes + shares×2)
  const trendData = useMemo(() => {
    if (activeTab !== 'Tendances') return posts;
    return [...posts].sort((a,b) => (b.likes + b.shares*2) - (a.likes + a.shares*2));
  }, [posts, activeTab]);

  const router = useRouter();

  // ── Header ─────────────────────────────────────────────────────────────────
  const SocialHeader = (
    <View style={sc.header}>
      <View>
        <Text style={sc.eyebrow}>UNIVERSE · CINÉMA</Text>
        <Text style={sc.title}>Communauté</Text>
      </View>
      <View style={{ flexDirection:'row', gap:8 }}>
        <TouchableOpacity style={sc.iconBtn}
          onPress={() => router.push('/notifications' as any)} activeOpacity={0.80}>
          <Ionicons name="notifications-outline" size={17} color={C.mid}/>
          <View style={sc.notifDot}/>
        </TouchableOpacity>
       
      </View>
    </View>
  );

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const TabBar = (
    <View style={sc.tabs}>
      {FEED_TABS.map(t => {
        const on = t === activeTab;
        return (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)}
            style={sc.tab} activeOpacity={0.80}>
            <Text style={[sc.tabTxt, on && sc.tabTxtOn]}>{t}</Text>
            {on && <View style={sc.tabLine}/>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Liste vide / erreur ────────────────────────────────────────────────────
  const ListEmpty = useMemo(() => {
    if (loading) return (
      <View style={{ alignItems:'center', paddingVertical:60, gap:14 }}>
        <ActivityIndicator color={C.mid} size="large"/>
        <Text style={{ color:C.muted, fontSize:13 }}>Chargement…</Text>
      </View>
    );
    if (error) return (
      <View style={{ alignItems:'center', paddingVertical:60, gap:12 }}>
        <Ionicons name="cloud-offline-outline" size={28} color={C.muted}/>
        <Text style={{ color:C.mid, fontSize:13, textAlign:'center',
                       paddingHorizontal:40 }}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={sc.retryBtn}>
          <Text style={sc.retryTxt}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
    return (
      <View style={{ alignItems:'center', paddingVertical:80, paddingHorizontal:40, gap:14 }}>
        <View style={sc.emptyIcon}>
          <Ionicons name="film-outline" size={34} color={C.muted}/>
        </View>
        <Text style={{ color:C.mid, fontSize:16, fontWeight:'700' }}>Aucune critique</Text>
        <TouchableOpacity style={sc.ctaBtn} onPress={() => setCompose(true)} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={14} color={C.white}/>
          <Text style={sc.ctaTxt}>Écrire une critique</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, error, refresh]);

  return (
    <InteractionProvider onToggleLike={toggleLike}>
      <View style={sc.root}>
        <StatusBar style="light"/>
        <GalaxyBackground/>

        <SafeAreaView style={sc.safe} edges={['top']}>
          <ComposeModal
            visible={composeOpen}
            onClose={() => setCompose(false)}
            onPublished={refresh}
            userId={userId}
          />

          {/* ── PROS ── */}
          {activeTab === 'Pros' ? (
            <View style={{ flex:1 }}>
              {SocialHeader}
              {TabBar}
              <ProDirectory userId={userId}/>
            </View>

          /* ── TENDANCES — grille 2 col ── */
          ) : activeTab === 'Tendances' ? (
            <View style={{ flex:1 }}>
              {/* Banner nouvelles critiques (realtime réel) */}
              <NewPostsBanner count={newCount} onPress={handleNewPostsBanner}/>

              <FlatList
                key="grid-2col"
                ref={listRef as any}
                data={trendData}
                numColumns={2}
                columnWrapperStyle={{
                  gap:COL_GAP, paddingHorizontal:EDGE, marginBottom:COL_GAP,
                }}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <GridPostCard post={item} userId={userId}/>}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom:120 }}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                    tintColor={C.mid}/>
                }
                ListHeaderComponent={
                  <View>
                    {SocialHeader}
                    {TabBar}
                    <AlgorithmBanner works={works}/>
                    <TrendingRow works={works} loading={wLoading}/>
                  </View>
                }
                ListEmptyComponent={ListEmpty}
                removeClippedSubviews windowSize={5}
                maxToRenderPerBatch={6} initialNumToRender={6}
              />
            </View>

          /* ── POUR VOUS — liste compacte ── */
          ) : (
            <View style={{ flex:1 }}>
              {/* Banner nouvelles critiques (realtime réel) */}
              <NewPostsBanner count={newCount} onPress={handleNewPostsBanner}/>

              <FlatList
                key="list-1col"
                ref={listRef}
                data={posts}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <CompactPostCard post={item} userId={userId}/>}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom:120 }}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                    tintColor={C.mid}/>
                }
                ListHeaderComponent={
                  <View>
                    {SocialHeader}
                    {TabBar}
                    <TrendingRow works={works} loading={wLoading}/>
                    <CreatorSpotlight posts={posts}/>
                    {posts.length > 4 && <GenreRadar posts={posts}/>}
                  </View>
                }
                ListEmptyComponent={ListEmpty}
                removeClippedSubviews windowSize={7}
                maxToRenderPerBatch={5} initialNumToRender={5}
                updateCellsBatchingPeriod={50}
              />
            </View>
          )}
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}

const sc = StyleSheet.create({
  root:      { flex:1, backgroundColor:C.bg },
  safe:      { flex:1 },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
               paddingHorizontal:EDGE, paddingTop:10, paddingBottom:14 },
  eyebrow:   { fontSize:8.5, fontWeight:'700', color:C.muted, letterSpacing:1.8, marginBottom:2 },
  title:     { fontSize:24, fontWeight:'800', color:C.white, letterSpacing:-0.5 },
  iconBtn:   { width:38, height:38, borderRadius:19, backgroundColor:C.faint,
               borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
               alignItems:'center', justifyContent:'center', position:'relative' },
  composeBtn:{ borderColor:C.borderHi, backgroundColor:C.subtle },
  notifDot:  { position:'absolute', top:8, right:8, width:6, height:6, borderRadius:3,
               backgroundColor:C.white, borderWidth:1, borderColor:C.bg },
  tabs:      { flexDirection:'row', paddingHorizontal:EDGE, gap:20, marginBottom:12,
               borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  tab:       { paddingBottom:12, alignItems:'center', position:'relative' },
  tabTxt:    { color:C.muted, fontSize:13, fontWeight:'600' },
  tabTxtOn:  { color:C.white, fontWeight:'800' },
  tabLine:   { position:'absolute', bottom:0, left:0, right:0, height:2,
               borderRadius:1, backgroundColor:C.white },
  retryBtn:  { paddingHorizontal:20, paddingVertical:9, borderRadius:13,
               borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
               backgroundColor:C.faint },
  retryTxt:  { color:C.white, fontSize:13, fontWeight:'700' },
  emptyIcon: { width:70, height:70, borderRadius:35, backgroundColor:C.faint,
               borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
               justifyContent:'center', alignItems:'center' },
  ctaBtn:    { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24,
               paddingVertical:13, borderRadius:22,
               borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi,
               backgroundColor:C.subtle },
  ctaTxt:    { color:C.white, fontSize:14, fontWeight:'700' },
});