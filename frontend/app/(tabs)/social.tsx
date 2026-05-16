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

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const EDGE = 18;
const IMG_H = 210;

const C = {
  bg0:       '#020810',
  bg1:       '#060F1E',
  surf:      'rgba(13,34,64,0.55)',
  surfHi:    'rgba(13,34,64,0.82)',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.16)',
  borderBlue:'rgba(90,150,230,0.24)',
  text:      '#EEF4FF',
  textSec:   '#7A99BE',
  textTert:  '#2E4A68',
  blue:      '#5A96E6',
  blueDim:   'rgba(90,150,230,0.13)',
  blueMid:   'rgba(90,150,230,0.22)',
  navyMid:   '#0D2240',
  navyLight: '#163356',
  navyBright:'#1E4A7A',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.12)',
  goldEdge:  'rgba(245,200,66,0.28)',
  green:     '#2ECC8A',
  greenDim:  'rgba(46,204,138,0.12)',
  greenEdge: 'rgba(46,204,138,0.28)',
  red:       '#FF3B5C',
  violet:    '#7C5EFC',
  violetDim: 'rgba(124,94,252,0.14)',
  white:     '#FFFFFF',
} as const;

const TONE_KEYS = [
  'analyse','coup de coeur','deception','reflexion',
  'détente','neutre','mitigé','enthousiaste',
] as const;
type Tone = typeof TONE_KEYS[number];

const TONES: { key:Tone; label:string; icon:string; color:string }[] = [
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

const FEED_TABS  = ['Pour vous','Tendances','Pros'] as const;
type FeedTab = typeof FEED_TABS[number];

const MIN_BODY    = 80;
const POSTS_LIMIT = 40;
const WORKS_LIMIT = 50;

const PRO_ROLES = [
  'Tous','Réalisateur·ice','Producteur·ice','Acteur·ice',
  'Scénariste','Directeur·ice photo','Compositeur·ice',
  'Monteur·euse','Distributeur·ice',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type ConnStatus = 'none' | 'pending' | 'accepted' | 'rejected';

interface SupabasePost {
  id:string; user_id:string; work_id:number|null; work_title:string;
  work_year:string; work_director:string; work_genre:string; rating:number;
  body:string; image_url:string|null; image_valid:boolean|null; tags:string[]|null;
  tone:string|null; likes_count:number|null; shares_count:number|null; created_at:string;
  profiles?:{ display_name:string; avatar_url:string }|null;
}

interface Post {
  id:string; userId:string; userName:string; avatar:string; timeAgo:string; readTime:number;
  content:string; likes:number; shares:number; workId:number; work_title:string;
  work_year:string; work_director:string; work_genre:string; rating:number;
  image_url:string; tags:string[]; tone:Tone;
}

interface Work {
  id:number; title:string; category:string; genre:string; year:number; likes:number;
  comments:number|null; image:string|null; is_original:boolean; adjective:string|null;
  duration:number|null; description:string|null; director:string|null;
  created_at:string; score?:number;
}

interface Pro {
  id:string; name:string; role:string; avatar:string|null; bio:string|null;
  films:string[]; location:string|null; contact_email:string|null; website:string|null;
  verified:boolean; open_to:string[]; created_at:string;
}

interface ProConnection {
  id:string; pro_id:string; status:ConnStatus; message:string|null; created_at:string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function computeWorkScore(w: Work): number {
  const days = (Date.now() - new Date(w.created_at).getTime()) / 86_400_000;
  return Math.round(
    w.likes * 1.5 + (w.comments ?? 0) * 1.2 +
    Math.max(0, 60 - days) * 2 + (w.is_original ? 40 : 0) +
    (w.duration != null && w.duration < 30 ? 20 : 0)
  );
}

function resolveWorkImage(id: number, image: string | null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/800/500`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/800/500`;
  } catch { return `https://picsum.photos/seed/work_${id}/800/500`; }
}

function fmtAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return "à l'instant";
  if (s < 3600)  return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

function mapPost(r: SupabasePost): Post {
  const tone: Tone = (r.tone && (TONE_KEYS as readonly string[]).includes(r.tone))
    ? (r.tone as Tone) : 'analyse';
  return {
    id: r.id, userId: r.user_id,
    userName:  r.profiles?.display_name ?? 'Cinéphile',
    avatar:    r.profiles?.avatar_url   ?? `https://i.pravatar.cc/80?u=${r.user_id}`,
    timeAgo:   fmtAgo(r.created_at),
    readTime:  Math.max(1, Math.ceil((r.body ?? '').split(/\s+/).length / 200)),
    content:   r.body          ?? '',
    likes:     r.likes_count   ?? 0,
    shares:    r.shares_count  ?? 0,
    workId:    r.work_id       ?? 0,
    work_title:    r.work_title    ?? '',
    work_year:     r.work_year     ?? '',
    work_director: r.work_director ?? '',
    work_genre:    r.work_genre    ?? '',
    rating:    r.rating        ?? 0,
    image_url: r.image_url     ?? '',
    tags:      Array.isArray(r.tags) ? r.tags : [],
    tone,
  };
}

const FEED_FIELDS =
  'id,user_id,work_id,work_title,work_year,work_director,work_genre,' +
  'rating,body,image_url,image_valid,tags,tone,likes_count,shares_count,created_at';

// ─────────────────────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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

async function dbPublishPost(payload: any): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    let uid = session?.user?.id;
    if (!uid) {
      const { data: anon } = await supabase.auth.signInAnonymously();
      uid = anon.session?.user?.id;
    }
    if (!uid) return null;
    const { data, error } = await supabase
      .from('community_posts').insert({ ...payload, user_id: uid }).select('id').single();
    if (error) throw error;
    return (data as any)?.id ?? null;
  } catch { return null; }
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
      payload = decode(await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' }));
    }
    const { data, error } = await supabase.storage
      .from('community-images').upload(path, payload, { contentType: mime, upsert: false });
    if (error) throw error;
    return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB — PRO CONNECTIONS
// ─────────────────────────────────────────────────────────────────────────────
async function dbSendConnectionRequest(
  proId: string, userId: string, message: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('pro_connections').upsert({
      requester_id: userId,
      pro_id:       proId,
      status:       'pending',
      message:      message.trim(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'requester_id,pro_id' });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erreur inconnue' };
  }
}

async function dbFetchConnections(userId: string): Promise<ProConnection[]> {
  const { data } = await supabase
    .from('pro_connections')
    .select('id,pro_id,status,message,created_at')
    .eq('requester_id', userId);
  return (data ?? []) as ProConnection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function usePostsFeed(tab: FeedTab) {
  const [posts,   setPosts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [rk,      setRk]      = useState(0);
  const refresh = useCallback(() => setRk(k => k + 1), []);

  useEffect(() => {
    if (tab === 'Pros' || tab === 'Découvrir') { setLoading(false); return; }
    let dead = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('community_posts_enriched').select(FEED_FIELDS)
          .order('created_at', { ascending: false }).limit(POSTS_LIMIT);
        if (dead) return;
        if (err) throw err;
        setPosts((data ?? []).filter(r => r && 'id' in r).map(r => mapPost(r as SupabasePost)));
      } catch {
        if (!dead) setError('Impossible de charger le feed.');
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [tab, rk]);

  useEffect(() => {
    if (tab === 'Pros' || tab === 'Découvrir') return;
    const ch = supabase.channel(`social_rt_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' },
        async payload => {
          const { data } = await supabase.from('community_posts')
            .select(FEED_FIELDS).eq('id', payload.new.id).single();
          if (!data) return;
          const p = mapPost(data as unknown as SupabasePost);
          setPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab]);

  const toggleLike = useCallback(async (postId: string, userId: string, wasLiked: boolean) => {
    setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? -1 : 1) }));
    try { await dbToggleLike(postId, userId, wasLiked); }
    catch { setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? 1 : -1) })); }
  }, []);

  return { posts, loading, error, refresh, toggleLike };
}

function useWorksAlgorithm() {
  const [works,   setWorks]   = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let dead = false;
    supabase.from('works')
      .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at')
      .order('likes', { ascending: false }).limit(WORKS_LIMIT)
      .then(({ data }) => {
        if (dead) return;
        const scored = ((data ?? []) as Work[])
          .map(w => ({ ...w, score: computeWorkScore(w) }))
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        setWorks(scored); setLoading(false);
      });
    return () => { dead = true; };
  }, []);
  return { works, loading };
}

function useProDirectory(search: string, role: string) {
  const [pros,    setPros]    = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let q = supabase.from('professionals')
        .select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to,created_at')
        .order('verified', { ascending: false }).order('name', { ascending: true }).limit(80);
      if (role && role !== 'Tous') q = q.eq('role', role);
      if (search.trim())           q = q.ilike('name', `%${search.trim()}%`);
      const { data, error: err } = await q;
      if (err) throw err;
      setPros((data ?? []) as Pro[]);
    } catch { setError('Impossible de charger le répertoire.'); }
    finally  { setLoading(false); }
  }, [search, role]);
  useEffect(() => { load(); }, [load]);
  return { pros, loading, error, refresh: load };
}

// ── useConnections — statuts realtime ───────────────────────────────────────
function useConnections(userId: string) {
  const [connections, setConnections] = useState<Record<string, ConnStatus>>({});
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!userId || userId === 'anonymous') { setLoading(false); return; }
    dbFetchConnections(userId).then(rows => {
      const map: Record<string, ConnStatus> = {};
      rows.forEach(r => { map[r.pro_id] = r.status; });
      setConnections(map);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    const ch = supabase.channel(`pro_conn_${userId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pro_connections' },
        ({ new: row }) => {
          const r = row as ProConnection;
          if (r?.pro_id) setConnections(prev => ({ ...prev, [r.pro_id]: r.status }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const setStatus = useCallback((proId: string, status: ConnStatus) => {
    setConnections(prev => ({ ...prev, [proId]: status }));
  }, []);

  return { connections, loading, setStatus };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface ICtx {
  liked: Record<string,boolean>; saved: Record<string,boolean>;
  toggleLike: (id:string, uid:string) => void;
  toggleSave: (id:string) => void;
  sharePost:  (id:string, title:string, uid:string) => Promise<void>;
}
const InteractionCtx = createContext<ICtx>({
  liked:{}, saved:{}, toggleLike:()=>{}, toggleSave:()=>{}, sharePost:async()=>{},
});

function InteractionProvider({ children, onToggleLike }: {
  children: React.ReactNode;
  onToggleLike: (id:string, uid:string, was:boolean) => void;
}) {
  const [liked, setLiked] = useState<Record<string,boolean>>({});
  const [saved, setSaved] = useState<Record<string,boolean>>({});
  const toggleLike = useCallback((id: string, uid: string) => {
    const was = !!liked[id];
    setLiked(p => ({ ...p, [id]: !was }));
    onToggleLike(id, uid, was);
  }, [liked, onToggleLike]);
  const toggleSave  = useCallback((id: string) => setSaved(p => ({ ...p, [id]: !p[id] })), []);
  const sharePost   = useCallback(async (id: string, title: string, uid: string) => {
    try {
      const r = await Share.share({ message:`Découvrez cette critique de "${title}" sur Universe App !` });
      if (r.action === Share.sharedAction) await dbRecordShare(id, uid, r.activityType ?? 'unknown');
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
const StarRating = memo(function StarRating({ value, size=24, onChange }: {
  value: number; size?: number; onChange?: (v:number)=>void;
}) {
  return (
    <View style={{ flexDirection:'row', gap:3 }}>
      {[1,2,3,4,5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange} hitSlop={6 as any}>
          <Ionicons
            name={value >= s ? 'star' : value >= s-0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={value >= s || value >= s-0.5 ? C.gold : C.textSec}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// WORK MINI CARD → /film/:id
// ─────────────────────────────────────────────────────────────────────────────
const WORK_W = 148, WORK_H = 208;

const WorkMiniCard = memo(function WorkMiniCard({ work, rank }: { work:Work; rank?:number }) {
  const router = useRouter();
  const uri = useMemo(() => resolveWorkImage(work.id, work.image), [work.id, work.image]);
  const rankColor = rank===1?C.gold:rank===2?'#C0C0C0':rank===3?'#CD7F32':'rgba(255,255,255,0.38)';
  return (
    <TouchableOpacity style={{ marginRight:12 }} onPress={() => router.push(`/film/${work.id}` as any)} activeOpacity={0.88}>
      <View style={wmc.card}>
        <Image source={{ uri }} style={wmc.img} resizeMode="cover" />
        <LinearGradient colors={['transparent','rgba(2,8,16,0.93)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}} />
        <View style={[wmc.catBadge,{backgroundColor:work.is_original?C.navyBright:C.navyMid}]}>
          <Text style={wmc.catTxt}>{work.is_original?'★ ORIG':work.category.slice(0,4).toUpperCase()}</Text>
        </View>
        {work.score!=null&&<View style={wmc.scoreBadge}><Ionicons name="trending-up" size={8} color={C.green}/><Text style={wmc.scoreTxt}>{work.score}</Text></View>}
        {rank!=null&&<Text style={[wmc.rank,{color:rankColor}]}>{rank}</Text>}
        <View style={wmc.meta}>
          <Text style={wmc.title} numberOfLines={2}>{work.title}</Text>
          {work.adjective&&<Text style={wmc.adj} numberOfLines={1}>{work.adjective}</Text>}
          <View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:2}}>
            <Ionicons name="heart" size={9} color={C.gold}/>
            <Text style={wmc.likes}>{(work.likes??0).toLocaleString('fr-FR')}</Text>
            {work.duration&&<><Text style={wmc.dot}>·</Text><Text style={wmc.likes}>{work.duration}m</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const wmc = StyleSheet.create({
  card:      {width:WORK_W,height:WORK_H,borderRadius:14,overflow:'hidden',backgroundColor:C.navyMid},
  img:       {width:'100%',height:'100%'},
  catBadge:  {position:'absolute',top:8,left:8,paddingHorizontal:6,paddingVertical:3,borderRadius:6},
  catTxt:    {color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.3},
  scoreBadge:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(2,8,16,0.72)',paddingHorizontal:6,paddingVertical:3,borderRadius:6},
  scoreTxt:  {color:C.green,fontSize:8,fontWeight:'800'},
  rank:      {position:'absolute',bottom:36,right:6,fontSize:44,fontWeight:'900',lineHeight:44,letterSpacing:-3,opacity:0.85},
  meta:      {position:'absolute',bottom:8,left:8,right:8,gap:1},
  title:     {color:C.white,fontSize:11,fontWeight:'800',lineHeight:14},
  adj:       {color:'rgba(255,255,255,0.45)',fontSize:9,fontStyle:'italic'},
  likes:     {color:'rgba(255,255,255,0.55)',fontSize:9,fontWeight:'600'},
  dot:       {color:C.textTert,fontSize:9},
});

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM BANNER
// ─────────────────────────────────────────────────────────────────────────────
const AlgorithmBanner = memo(function AlgorithmBanner({ works }: { works:Work[] }) {
  const router = useRouter();
  const top = works[0];
  if (!top) return null;
  return (
    <TouchableOpacity style={ab.wrap} onPress={() => router.push(`/film/${top.id}` as any)} activeOpacity={0.90}>
      <Image source={{uri:resolveWorkImage(top.id,top.image)}} style={ab.img} resizeMode="cover"/>
      <LinearGradient colors={['rgba(2,8,16,0.3)','rgba(2,8,16,0.93)']} style={StyleSheet.absoluteFillObject}/>
      <View style={ab.content}>
        <View style={ab.badge}><Ionicons name="sparkles" size={10} color={"#fff"}/><Text style={ab.badgeTxt}>ALGORITHME UNIVERSE · N°1</Text></View>
        <Text style={ab.title} numberOfLines={2}>{top.title}</Text>
        <Text style={ab.meta}>{[top.director,String(top.year),top.genre].filter(Boolean).join(' · ')}</Text>
        <View style={ab.stats}>
          <View style={ab.stat}><Ionicons name="heart" size={11} color={C.red}/><Text style={ab.statTxt}>{(top.likes??0).toLocaleString('fr-FR')}</Text></View>
          <View style={ab.stat}><Ionicons name="trending-up" size={11} color={C.green}/><Text style={ab.statTxt}>Score {top.score}</Text></View>
          {top.is_original&&<View style={ab.origBadge}><Text style={ab.origTxt}>ORIGINAL</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
});
const ab = StyleSheet.create({
  wrap:     {marginHorizontal:EDGE,marginBottom:20,height:180,borderRadius:20,overflow:'hidden'},
  img:      {...StyleSheet.absoluteFillObject as any},
  content:  {position:'absolute',bottom:0,left:0,right:0,padding:16,gap:5},
  badge:    {flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start',backgroundColor:'rgba(90,150,230,0.20)',paddingHorizontal:9,paddingVertical:4,borderRadius:10,borderWidth:1,borderColor:C.violetDim,marginBottom:2},
  badgeTxt: {color:"#fff",fontSize:9,fontWeight:'800',letterSpacing:0.6},
  title:    {color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4,lineHeight:24},
  meta:     {color:'rgba(255,255,255,0.48)',fontSize:11},
  stats:    {flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},
  stat:     {flexDirection:'row',alignItems:'center',gap:4},
  statTxt:  {color:C.textSec,fontSize:11,fontWeight:'600'},
  origBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(90,150,230,0.20)',borderWidth:1,borderColor:C.borderBlue},
  origTxt:  {color:C.blue,fontSize:9,fontWeight:'800'},
});

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING WORKS ROW
// ─────────────────────────────────────────────────────────────────────────────
const TrendingWorksRow = memo(function TrendingWorksRow({ works, loading }: { works:Work[]; loading:boolean }) {
  const router = useRouter();
  if (loading) return (
    <View style={twr.wrap}>
      <View style={twr.head}><View style={{width:160,height:14,borderRadius:7,backgroundColor:C.surf}}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:12}}>
        {[0,1,2,3].map(i=><View key={i} style={{width:WORK_W,height:WORK_H,borderRadius:14,backgroundColor:C.surf}}/>)}
      </ScrollView>
    </View>
  );
  return (
    <View style={twr.wrap}>
      <View style={twr.head}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name="trending-up" size={15} color={C.green}/><Text style={twr.title}>En vogue · Algorithme</Text></View>
        <TouchableOpacity onPress={() => router.push('/search' as any)} hitSlop={8}><Text style={twr.seeAll}>Tout voir →</Text></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE}}>
        {works.slice(0,10).map((w,i) => <WorkMiniCard key={w.id} work={w} rank={i+1}/>)}
      </ScrollView>
    </View>
  );
});
const twr = StyleSheet.create({
  wrap: {marginBottom:24},
  head: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,marginBottom:14},
  title:{color:C.text,fontSize:16,fontWeight:'800'},
  seeAll:{color:C.blue,fontSize:12,fontWeight:'600'},
});

// ─────────────────────────────────────────────────────────────────────────────
// GENRE RADAR WIDGET
// ─────────────────────────────────────────────────────────────────────────────
const GenreRadar = memo(function GenreRadar({ posts }: { posts:Post[] }) {
  const counts = useMemo(() => {
    const map: Record<string,number> = {};
    posts.forEach(p => { if(p.work_genre) map[p.work_genre]=(map[p.work_genre]??0)+1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,6);
  }, [posts]);
  if (!counts.length) return null;
  const max = counts[0]?.[1] ?? 1;
  return (
    <View style={gr.wrap}>
      <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={gr.inner}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:12}}><Ionicons name="pie-chart-outline" size={14} color={C.blue}/><Text style={{color:C.text,fontSize:14,fontWeight:'800'}}>Genres populaires</Text></View>
        {counts.map(([genre,count]) => (
          <View key={genre} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8}}>
            <Text style={{color:C.textSec,fontSize:11,fontWeight:'600',width:90}} numberOfLines={1}>{genre}</Text>
            <View style={{flex:1,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
              <View style={{height:'100%',borderRadius:3,backgroundColor:C.blue,width:`${(count/max)*100}%` as any}}/>
            </View>
            <Text style={{color:C.textTert,fontSize:10,fontWeight:'700',width:20,textAlign:'right'}}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
const gr = StyleSheet.create({
  wrap: {marginHorizontal:EDGE,marginBottom:20,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:C.border},
  inner:{padding:16},
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR SPOTLIGHT
// ─────────────────────────────────────────────────────────────────────────────
const CreatorSpotlight = memo(function CreatorSpotlight({ posts }: { posts:Post[] }) {
  const router = useRouter();
  const top = useMemo(() => {
    const map: Record<string,{name:string;avatar:string;likes:number;count:number}> = {};
    posts.forEach(p => {
      if (!map[p.userId]) map[p.userId]={name:p.userName,avatar:p.avatar,likes:0,count:0};
      map[p.userId].likes+=p.likes; map[p.userId].count+=1;
    });
    return Object.entries(map).sort((a,b)=>b[1].likes-a[1].likes).slice(0,5);
  }, [posts]);
  if (!top.length) return null;
  return (
    <View style={{marginBottom:20}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}><Ionicons name="people-outline" size={14} color={C.gold}/><Text style={{color:C.text,fontSize:14,fontWeight:'800'}}>Top critiques du moment</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:10}}>
        {top.map(([uid,info]) => (
          <TouchableOpacity key={uid} style={csp.pill} onPress={()=>router.push(`/user/${uid}` as any)} activeOpacity={0.80}>
            <Image source={{uri:info.avatar}} style={csp.avi}/>
            <View><Text style={csp.name} numberOfLines={1}>{info.name}</Text><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="heart" size={9} color={C.red}/><Text style={csp.stat}>{info.likes} · {info.count} critique{info.count>1?'s':''}</Text></View></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});
const csp = StyleSheet.create({
  pill:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:C.surf,paddingVertical:9,paddingHorizontal:12,borderRadius:16,borderWidth:1,borderColor:C.border},
  avi: {width:34,height:34,borderRadius:17,borderWidth:1.5,borderColor:C.borderHi},
  name:{color:C.text,fontSize:12,fontWeight:'700',maxWidth:90},
  stat:{color:C.textTert,fontSize:10},
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = memo(function PostCard({ post, userId }: { post:Post; userId:string }) {
  const router = useRouter();
  const { liked, saved, toggleLike, toggleSave, sharePost } = useContext(InteractionCtx);
  const isLiked = !!liked[post.id], isSaved = !!saved[post.id];
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  const bounce = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.spring(anim,{toValue:1.42,useNativeDriver:true,tension:300,friction:7}),
      Animated.spring(anim,{toValue:1,   useNativeDriver:true,tension:200,friction:8}),
    ]).start();
  }, []);

  const onLike = useCallback(() => {
    bounce(likeScale);
    if (Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike(post.id, userId);
  }, [post.id, userId, toggleLike, likeScale, bounce]);

  const onSave = useCallback(() => {
    bounce(saveScale);
    toggleSave(post.id);
  }, [post.id, toggleSave, saveScale, bounce]);

  const toneInfo = useMemo(() => TONES.find(t=>t.key===post.tone)??TONES[0],[post.tone]);
  const imgSrc   = useMemo(()=>post.image_url?{uri:post.image_url}:{uri:`https://picsum.photos/seed/${post.id}/800/450`},[post.image_url,post.id]);
  const goWork   = useCallback(()=>{ if(post.workId) router.push(`/film/${post.workId}` as any); },[post.workId,router]);

  return (
    <View style={pcs.card}>
      <TouchableOpacity activeOpacity={0.92} onPress={goWork}>
        <Image source={imgSrc} style={pcs.img} resizeMode="cover"/>
        <LinearGradient colors={['rgba(2,8,16,0.15)','rgba(2,8,16,0.94)']} style={pcs.imgGrad}/>
        <BlurView intensity={12} tint="dark" style={[pcs.toneBadge,{borderColor:`${toneInfo.color}30`}]}>
          <Ionicons name={toneInfo.icon as any} size={10} color={toneInfo.color}/>
          <Text style={[pcs.toneTxt,{color:toneInfo.color}]}>{toneInfo.label}</Text>
        </BlurView>
        <BlurView intensity={10} tint="dark" style={pcs.readBadge}>
          <Ionicons name="time-outline" size={9} color={C.textSec}/>
          <Text style={pcs.readTxt}>{post.readTime} min</Text>
        </BlurView>
        <View style={pcs.filmOverlay}>
          <Text style={pcs.filmTitle} numberOfLines={1}>{post.work_title||'Œuvre inconnue'}</Text>
          {[post.work_director,post.work_year].filter(Boolean).join(' · ').length>0&&<Text style={pcs.filmMeta}>{[post.work_director,post.work_year].filter(Boolean).join(' · ')}</Text>}
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <StarRating value={post.rating} size={11}/>
            {post.work_genre.length>0&&<View style={pcs.genreChip}><Text style={pcs.genreChipTxt}>{post.work_genre}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>

      <View style={pcs.body}>
        <View style={pcs.authorRow}>
          <TouchableOpacity onPress={()=>router.push(`/user/${post.userId}` as any)}><Image source={{uri:post.avatar}} style={pcs.avi}/></TouchableOpacity>
          <View style={{flex:1}}><Text style={pcs.authorName}>{post.userName}</Text><Text style={pcs.authorTime}>{post.timeAgo}</Text></View>
          <TouchableOpacity style={pcs.workBtn} onPress={goWork}><Ionicons name="film-outline" size={11} color={C.blue}/><Text style={pcs.workBtnTxt} numberOfLines={1}>Voir l'œuvre</Text></TouchableOpacity>
        </View>
        <View style={pcs.critiqueBox}>
          <View style={pcs.accent}/>
          <Text style={pcs.content} numberOfLines={5}>{post.content}</Text>
        </View>
        {post.tags.length>0&&<View style={pcs.tagRow}>{post.tags.slice(0,4).map(tag=><View key={tag} style={pcs.tagPill}><Text style={pcs.tagTxt}>#{tag}</Text></View>)}</View>}
        <View style={pcs.divider}/>
        <View style={pcs.actions}>
          <TouchableOpacity style={pcs.action} onPress={onLike} activeOpacity={0.78}>
            <Animated.View style={{transform:[{scale:likeScale}]}}><Ionicons name={isLiked?'heart':'heart-outline'} size={18} color={isLiked?C.red:C.textSec}/></Animated.View>
            <Text style={[pcs.actionTxt,isLiked&&{color:C.red}]}>{post.likes+(isLiked?1:0)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pcs.action} onPress={()=>router.push(`/review/${post.id}` as any)} activeOpacity={0.78}><Ionicons name="chatbubble-outline" size={17} color={C.textSec}/></TouchableOpacity>
          <TouchableOpacity style={pcs.action} onPress={()=>sharePost(post.id,post.work_title,userId)} activeOpacity={0.78}><Ionicons name="share-outline" size={18} color={C.textSec}/><Text style={pcs.actionTxt}>{post.shares}</Text></TouchableOpacity>
          <View style={{flex:1}}/>
          <TouchableOpacity style={pcs.action} onPress={onSave} activeOpacity={0.78}>
            <Animated.View style={{transform:[{scale:saveScale}]}}><Ionicons name={isSaved?'bookmark':'bookmark-outline'} size={18} color={isSaved?C.gold:C.textSec}/></Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={pcs.arrowBtn} onPress={goWork}><Ionicons name="arrow-forward" size={14} color={C.white}/></TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const pcs = StyleSheet.create({
  card:       {marginHorizontal:EDGE,marginBottom:22,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:C.border,backgroundColor:C.surf},
  img:        {width:'100%',height:IMG_H},
  imgGrad:    {position:'absolute',bottom:0,left:0,right:0,height:'70%'},
  toneBadge:  {position:'absolute',top:10,left:10,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:5,borderRadius:10,borderWidth:1,overflow:'hidden'},
  toneTxt:    {fontSize:10,fontWeight:'800'},
  readBadge:  {position:'absolute',top:10,right:10,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:8,paddingVertical:4,borderRadius:9,overflow:'hidden'},
  readTxt:    {color:C.textSec,fontSize:9,fontWeight:'600'},
  filmOverlay:{position:'absolute',bottom:12,left:14,right:14,gap:4},
  filmTitle:  {color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4},
  filmMeta:   {color:'rgba(255,255,255,0.40)',fontSize:11},
  genreChip:  {paddingHorizontal:8,paddingVertical:3,borderRadius:8,backgroundColor:C.blueMid,borderWidth:1,borderColor:C.borderBlue},
  genreChipTxt:{color:C.blue,fontSize:9,fontWeight:'800'},
  body:       {padding:14},
  authorRow:  {flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},
  avi:        {width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:C.borderHi},
  authorName: {color:C.text,fontSize:13,fontWeight:'700'},
  authorTime: {color:C.textTert,fontSize:10,marginTop:1},
  workBtn:    {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:C.blueDim,borderWidth:1,borderColor:C.borderBlue},
  workBtnTxt: {color:C.blue,fontSize:10,fontWeight:'700',maxWidth:80},
  critiqueBox:{flexDirection:'row',gap:10,marginBottom:10},
  accent:     {width:3,borderRadius:2,backgroundColor:C.blue,opacity:0.6,minHeight:20},
  content:    {flex:1,color:C.textSec,fontSize:14,lineHeight:22,fontStyle:'italic'},
  tagRow:     {flexDirection:'row',gap:7,marginBottom:10,flexWrap:'wrap'},
  tagPill:    {paddingHorizontal:10,paddingVertical:4,borderRadius:10,backgroundColor:C.goldDim,borderWidth:1,borderColor:C.goldEdge},
  tagTxt:     {color:C.gold,fontSize:10,fontWeight:'700'},
  divider:    {height:1,backgroundColor:C.border,marginBottom:12},
  actions:    {flexDirection:'row',alignItems:'center',gap:2},
  action:     {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:14},
  actionTxt:  {color:C.textSec,fontSize:12,fontWeight:'600'},
  arrowBtn:   {width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:C.navyBright},
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL (slim)
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ['film','critique','media','preview'] as const;
type CStep = typeof STEPS[number];
const STEP_LBL:  Record<CStep,string> = {film:"L'Œuvre",critique:'Critique',media:'Image',preview:'Aperçu'};
const STEP_ICON: Record<CStep,string> = {film:'film-outline',critique:'create-outline',media:'image-outline',preview:'eye-outline'};

interface CForm { workTitle:string;workYear:string;workDirector:string;workGenre:string;rating:number;tone:Tone|null;body:string;tags:string[];imageUri:string;imageUrl:string;imageValid:boolean }
const INIT_FORM: CForm = {workTitle:'',workYear:'',workDirector:'',workGenre:'',rating:0,tone:null,body:'',tags:[],imageUri:'',imageUrl:'',imageValid:false};

function ComposeModal({ visible, onClose, onPublished, userId }: { visible:boolean;onClose:()=>void;onPublished?:()=>void;userId:string }) {
  const [step,setStep]           = useState<CStep>('film');
  const [form,setForm]           = useState<CForm>(INIT_FORM);
  const [publishing,setPub]      = useState(false);
  const [imgLoading,setImgLoad]  = useState(false);
  const [errors,setErrors]       = useState<Partial<Record<CStep,string>>>({});
  const slide = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (visible) { setStep('film');setForm(INIT_FORM);setErrors({});Animated.spring(slide,{toValue:0,tension:58,friction:12,useNativeDriver:true}).start(); }
    else Animated.timing(slide,{toValue:800,duration:220,useNativeDriver:true}).start();
  },[visible]);

  const patch  = useCallback(<K extends keyof CForm>(k:K,v:CForm[K])=>setForm(f=>({...f,[k]:v})),[]);
  const setErr = (s:CStep,m:string)=>setErrors(e=>({...e,[s]:m}));
  const clrErr = (s:CStep)=>setErrors(e=>({...e,[s]:''}));

  const validate = useCallback((s:CStep):string|null=>{
    if(s==='film'){if(!form.workTitle.trim())return'Titre obligatoire.';if(!form.workGenre)return'Genre requis.';if(form.rating===0)return'Note requise.';}
    if(s==='critique'){if(!form.tone)return'Ton requis.';if(form.body.trim().length<MIN_BODY)return`Min ${MIN_BODY} car.`;}
    return null;
  },[form]);

  const goNext = useCallback(()=>{const err=validate(step);if(err){setErr(step,err);return;}clrErr(step);const i=STEPS.indexOf(step);if(i<STEPS.length-1)setStep(STEPS[i+1]);},[step,validate]);
  const goBack = useCallback(()=>{const i=STEPS.indexOf(step);if(i>0)setStep(STEPS[i-1]);},[step]);

  const pickImage = useCallback(async()=>{
    const{granted}=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!granted){Alert.alert('Permission requise');return;}
    const res=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.85,allowsEditing:true,aspect:[16,9]});
    if(res.canceled||!res.assets?.[0])return;
    patch('imageUri',res.assets[0].uri);patch('imageValid',false);patch('imageUrl','');
    setImgLoad(true);clrErr('media');
    const url=await uploadImageToStorage(res.assets[0].uri);
    setImgLoad(false);
    if(!url){setErr('media','Upload échoué.');return;}
    patch('imageUrl',url);patch('imageValid',true);
  },[patch]);

  const publish=useCallback(async()=>{
    if(!form.imageValid||!form.tone)return;setPub(true);
    const id=await dbPublishPost({work_title:form.workTitle.trim(),work_year:form.workYear.trim(),work_director:form.workDirector.trim(),work_genre:form.workGenre,rating:form.rating,body:form.body.trim(),image_url:form.imageUrl,image_valid:true,tags:form.tags,tone:form.tone});
    setPub(false);if(id){onPublished?.();onClose();}else Alert.alert('Erreur','Publication échouée.');
  },[form,onPublished,onClose]);

  const stepIdx=STEPS.indexOf(step),bodyLen=form.body.trim().length,toneInfo=TONES.find(t=>t.key===form.tone);
  if(!visible)return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={cm.kav}>
          <Animated.View style={[cm.sheet,{transform:[{translateY:slide}]}]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}/>
            <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'rgba(6,15,30,0.62)'}]} pointerEvents="none"/>
            <View style={{flex:1}}>
              <View style={cm.handle}/>
              <View style={cm.topRow}>
                <View style={{flex:1}}><Text style={cm.title}>Nouvelle Critique</Text><Text style={cm.sub}>Cinéma indépendant</Text></View>
                <TouchableOpacity style={cm.closeBtn} onPress={onClose}><Ionicons name="close" size={15} color={C.textSec}/></TouchableOpacity>
              </View>
              <View style={cm.stepRow}>
                {STEPS.map((st,i)=>{const done=i<stepIdx,curr=i===stepIdx;return(
                  <View key={st} style={cm.stepItem}>
                    <View style={[cm.stepCircle,done&&cm.stepDone,curr&&cm.stepCurr]}>{done?<Ionicons name="checkmark" size={11} color={C.white}/>:<Ionicons name={STEP_ICON[st] as any} size={11} color={curr?C.white:C.textSec}/>}</View>
                    <Text style={[cm.stepLbl,curr&&{color:C.text},done&&{color:C.textSec}]}>{STEP_LBL[st]}</Text>
                    {i<STEPS.length-1&&<View style={[cm.stepLine,done&&{backgroundColor:C.navyBright}]}/>}
                  </View>
                );})}
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{paddingHorizontal:20}}>
                  {step==='film'&&(<>
                    <Text style={cm.label}>TITRE *</Text>
                    <TextInput style={cm.input} placeholderTextColor={C.textTert} placeholder="Ex : Portrait de la jeune fille en feu" value={form.workTitle} onChangeText={v=>{patch('workTitle',v);clrErr('film');}}/>
                    <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
                      <View style={{flex:1}}><Text style={cm.label}>RÉALISATEUR</Text><TextInput style={cm.input} placeholder="Nom" placeholderTextColor={C.textTert} value={form.workDirector} onChangeText={v=>patch('workDirector',v)}/></View>
                      <View style={{width:86}}><Text style={cm.label}>ANNÉE</Text><TextInput style={cm.input} placeholder="2025" placeholderTextColor={C.textTert} value={form.workYear} onChangeText={v=>patch('workYear',v)} keyboardType="numeric" maxLength={4}/></View>
                    </View>
                    <Text style={cm.label}>GENRE *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4,marginBottom:20}}>
                      {GENRES_LIST.map(g=>{const on=form.workGenre===g;return<TouchableOpacity key={g} style={[cm.chip,on&&cm.chipOn]} onPress={()=>{patch('workGenre',g);clrErr('film');}}><Text style={[cm.chipTxt,on&&{color:C.white}]}>{g}</Text></TouchableOpacity>;})}
                    </ScrollView>
                    <Text style={cm.label}>NOTE *</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}}>
                      <StarRating value={form.rating} onChange={v=>{patch('rating',v);clrErr('film');}}/>
                      <View style={cm.ratingBadge}><Text style={cm.ratingTxt}>{form.rating>0?`${form.rating}/5`:'--'}</Text></View>
                    </View>
                    {errors.film&&<Text style={cm.err}>{errors.film}</Text>}
                  </>)}
                  {step==='critique'&&(<>
                    <Text style={cm.label}>TON *</Text>
                    {[TONES.slice(0,4),TONES.slice(4)].map((row,ri)=>(
                      <View key={ri} style={[cm.toneGrid,{marginBottom:10}]}>
                        {row.map(t=>{const on=form.tone===t.key;return<TouchableOpacity key={t.key} style={[cm.toneCard,on&&{borderColor:t.color,backgroundColor:`${t.color}16`}]} onPress={()=>{patch('tone',t.key);clrErr('critique');}}><View style={[cm.toneIcon,on&&{backgroundColor:`${t.color}22`}]}><Ionicons name={t.icon as any} size={20} color={on?t.color:C.textSec}/></View><Text style={[cm.toneLbl,on&&{color:t.color}]}>{t.label}</Text></TouchableOpacity>;})}
                      </View>
                    ))}
                    <Text style={cm.label}>CRITIQUE *</Text>
                    <TextInput style={cm.textarea} multiline textAlignVertical="top" placeholder="Analysez la mise en scène…" placeholderTextColor={C.textTert} value={form.body} onChangeText={v=>{patch('body',v);clrErr('critique');}}/>
                    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:8,marginBottom:20}}>
                      <View style={{flex:1,height:2,borderRadius:1,backgroundColor:C.surf,overflow:'hidden'}}><View style={{height:'100%',borderRadius:1,backgroundColor:bodyLen>=MIN_BODY?C.green:C.blue,width:`${Math.min(100,(bodyLen/MIN_BODY)*100)}%` as any}}/></View>
                      <Text style={[{color:C.textSec,fontSize:11,fontWeight:'700'},bodyLen>=MIN_BODY&&{color:C.green}]}>{bodyLen}/{MIN_BODY}</Text>
                    </View>
                    <Text style={cm.label}>ASPECTS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4,marginBottom:16}}>
                      {ASPECTS.map(tag=>{const on=form.tags.includes(tag);return<TouchableOpacity key={tag} style={[cm.chip,on&&{borderColor:C.gold,backgroundColor:C.goldDim}]} onPress={()=>patch('tags',on?form.tags.filter(t=>t!==tag):[...form.tags,tag])}><Text style={[cm.chipTxt,on&&{color:C.gold}]}>{tag}</Text></TouchableOpacity>;})}
                    </ScrollView>
                    {errors.critique&&<Text style={cm.err}>{errors.critique}</Text>}
                  </>)}
                  {step==='media'&&(<>
                    {form.imageUri?(
                      <View style={cm.imgWrap}>
                        <Image source={{uri:form.imageUri}} style={cm.imgPreview} resizeMode="cover"/>
                        <LinearGradient colors={['transparent','rgba(2,8,16,0.80)']} style={StyleSheet.absoluteFillObject}/>
                        {form.imageValid&&!imgLoading&&<View style={cm.validBadge}><Ionicons name="checkmark-circle" size={13} color={C.green}/><Text style={{color:C.green,fontSize:11,fontWeight:'700'}}>Image prête</Text></View>}
                        {imgLoading&&<View style={cm.imgLoader}><ActivityIndicator color={C.blue}/></View>}
                        {!imgLoading&&<TouchableOpacity style={cm.changeBtn} onPress={pickImage}><Ionicons name="refresh-outline" size={12} color={C.textSec}/><Text style={{color:C.textSec,fontSize:11}}>Changer</Text></TouchableOpacity>}
                      </View>
                    ):(
                      <TouchableOpacity style={cm.pickBtn} onPress={pickImage} disabled={imgLoading}>
                        <View style={{width:64,height:64,borderRadius:32,backgroundColor:C.blueDim,justifyContent:'center',alignItems:'center'}}><Ionicons name="image-outline" size={36} color={C.blue}/></View>
                        <Text style={{color:C.text,fontSize:14,fontWeight:'700'}}>Sélectionner depuis la galerie</Text>
                        <Text style={{color:C.textSec,fontSize:11}}>JPEG · PNG · 16:9 recommandé</Text>
                      </TouchableOpacity>
                    )}
                    {errors.media&&<Text style={cm.err}>{errors.media}</Text>}
                  </>)}
                  {step==='preview'&&(<>
                    <View style={cm.previewCard}>
                      {form.imageUrl?<Image source={{uri:form.imageUrl}} style={cm.previewImg} resizeMode="cover"/>:<View style={[cm.previewImg,{backgroundColor:C.navyMid}]}/>}
                      <LinearGradient colors={['transparent','rgba(2,8,16,0.94)']} style={StyleSheet.absoluteFillObject}/>
                      <View style={{position:'absolute',bottom:0,left:0,right:0,padding:14}}>
                        {toneInfo&&<View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:1,borderColor:`${toneInfo.color}40`,backgroundColor:`${toneInfo.color}20`,marginBottom:7}}><Ionicons name={toneInfo.icon as any} size={9} color={toneInfo.color}/><Text style={{fontSize:9,fontWeight:'800',color:toneInfo.color,letterSpacing:0.6}}>{toneInfo.label.toUpperCase()}</Text></View>}
                        <Text style={{color:C.white,fontSize:18,fontWeight:'800',marginBottom:2}} numberOfLines={2}>{form.workTitle}</Text>
                        <Text style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginBottom:7}}>{[form.workDirector,form.workYear,form.workGenre].filter(Boolean).join(' · ')}</Text>
                        <StarRating value={form.rating} size={13}/>
                      </View>
                    </View>
                    <View style={cm.checklist}>
                      {[{ok:form.workTitle.trim().length>0,txt:'Œuvre identifiée'},{ok:form.rating>0,txt:'Note attribuée'},{ok:form.tone!==null,txt:'Ton défini'},{ok:bodyLen>=MIN_BODY,txt:`Critique ≥ ${MIN_BODY} car.`},{ok:form.imageValid,txt:'Image uploadée'}].map(item=>(
                        <View key={item.txt} style={{flexDirection:'row',alignItems:'center',gap:9}}>
                          <Ionicons name={item.ok?'checkmark-circle':'ellipse-outline'} size={15} color={item.ok?C.green:C.textTert}/>
                          <Text style={{color:item.ok?C.textSec:C.textTert,fontSize:13}}>{item.txt}</Text>
                        </View>
                      ))}
                    </View>
                  </>)}
                </View>
                <View style={{height:40}}/>
              </ScrollView>
              <View style={cm.footer}>
                {stepIdx>0&&<TouchableOpacity style={cm.backBtn} onPress={goBack}><Ionicons name="chevron-back" size={15} color={C.textSec}/><Text style={{color:C.textSec,fontSize:14,fontWeight:'600'}}>Retour</Text></TouchableOpacity>}
                {step!=='preview'?(
                  <TouchableOpacity style={[cm.nextBtn,stepIdx===0&&{marginLeft:'auto' as any}]} onPress={goNext}>
                    <LinearGradient colors={[C.navyBright,C.navyLight]} start={{x:0,y:0}} end={{x:1,y:0}} style={cm.btnGrad}><Text style={cm.btnTxt}>Continuer</Text><Ionicons name="chevron-forward" size={14} color={C.white}/></LinearGradient>
                  </TouchableOpacity>
                ):(
                  <TouchableOpacity style={[cm.nextBtn,publishing&&{opacity:0.55}]} onPress={publish} disabled={publishing}>
                    <LinearGradient colors={[C.blue,C.navyMid]} start={{x:0,y:0}} end={{x:1,y:0}} style={cm.btnGrad}>{publishing?<ActivityIndicator color={C.white} size="small"/>:<><Ionicons name="send" size={14} color={C.white}/><Text style={cm.btnTxt}>Publier</Text></>}</LinearGradient>
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
  overlay:    {flex:1,justifyContent:'flex-end',backgroundColor:'rgba(2,8,16,0.82)'},
  kav:        {flex:1,justifyContent:'flex-end'},
  sheet:      {maxHeight:'94%',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden',borderWidth:1,borderColor:C.border},
  handle:     {width:38,height:4,borderRadius:2,backgroundColor:C.navyLight,alignSelf:'center',marginTop:12},
  topRow:     {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:20,paddingTop:14,paddingBottom:10},
  title:      {color:C.text,fontSize:19,fontWeight:'800',letterSpacing:-0.4},
  sub:        {color:C.textTert,fontSize:11,marginTop:3},
  closeBtn:   {width:30,height:30,borderRadius:15,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center'},
  stepRow:    {flexDirection:'row',paddingHorizontal:20,marginBottom:16,alignItems:'flex-start'},
  stepItem:   {flex:1,alignItems:'center',position:'relative'},
  stepCircle: {width:28,height:28,borderRadius:14,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center',marginBottom:4},
  stepDone:   {backgroundColor:C.navyBright,borderColor:C.navyBright},
  stepCurr:   {backgroundColor:C.navyLight,borderColor:C.borderHi},
  stepLbl:    {color:C.textTert,fontSize:9,fontWeight:'700',letterSpacing:0.2,textAlign:'center'},
  stepLine:   {position:'absolute',top:14,left:'50%',right:'-50%',height:1,backgroundColor:C.border},
  label:      {color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'},
  input:      {backgroundColor:C.surf,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:15,marginBottom:20},
  textarea:   {backgroundColor:C.surf,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:14,minHeight:140,lineHeight:22},
  chip:       {paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:C.surf,borderWidth:1,borderColor:C.border},
  chipOn:     {borderColor:C.borderHi,backgroundColor:C.navyLight},
  chipTxt:    {color:C.textSec,fontSize:13,fontWeight:'600'},
  ratingBadge:{paddingHorizontal:10,paddingVertical:4,borderRadius:10,backgroundColor:C.goldDim,borderWidth:1,borderColor:C.goldEdge},
  ratingTxt:  {color:C.gold,fontSize:14,fontWeight:'800'},
  toneGrid:   {flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},
  toneCard:   {width:'48%',paddingVertical:16,borderRadius:14,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,alignItems:'center',gap:8},
  toneIcon:   {width:38,height:38,borderRadius:19,backgroundColor:C.navyMid,justifyContent:'center',alignItems:'center'},
  toneLbl:    {color:C.textSec,fontSize:13,fontWeight:'700'},
  imgWrap:    {height:200,borderRadius:16,overflow:'hidden',marginBottom:16},
  imgPreview: {width:'100%',height:'100%'},
  validBadge: {position:'absolute',bottom:10,left:10,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(2,8,16,0.80)',paddingHorizontal:10,paddingVertical:5,borderRadius:10},
  imgLoader:  {...StyleSheet.absoluteFillObject,backgroundColor:'rgba(2,8,16,0.65)',alignItems:'center',justifyContent:'center'},
  changeBtn:  {position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(2,8,16,0.75)',paddingHorizontal:10,paddingVertical:5,borderRadius:10},
  pickBtn:    {height:180,borderRadius:16,borderWidth:1,borderColor:C.borderBlue,borderStyle:'dashed',alignItems:'center',justifyContent:'center',gap:12,marginBottom:20},
  err:        {color:C.red,fontSize:12,marginBottom:12,fontWeight:'600'},
  previewCard:{height:200,borderRadius:18,overflow:'hidden',marginBottom:16,backgroundColor:C.navyMid},
  previewImg: {width:'100%',height:'100%'},
  checklist:  {backgroundColor:C.surf,borderRadius:14,borderWidth:1,borderColor:C.border,padding:14,gap:11,marginBottom:16},
  footer:     {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:Platform.OS==='ios'?34:18,paddingTop:14,borderTopWidth:1,borderTopColor:C.border,gap:12},
  backBtn:    {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingVertical:12},
  nextBtn:    {flex:1,borderRadius:22,overflow:'hidden'},
  btnGrad:    {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14},
  btnTxt:     {color:C.white,fontSize:15,fontWeight:'700'},
});

// ═════════════════════════════════════════════════════════════════════════════
// ★ PROS — Système de connexion LinkedIn Premium
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
const ConnBadge = memo(function ConnBadge({ status }: { status: ConnStatus }) {
  if (status === 'none') return null;
  const cfg = {
    pending:  { icon:'time-outline'        as const, color:'#fff', bg:'rgba(245,158,11,0.14)',  label:'En attente' },
    accepted: { icon:'checkmark-circle'    as const, color:'#fff', bg:'rgba(34,197,94,0.14)',   label:'Connecté'   },
    rejected: { icon:'close-circle-outline'as const, color:'#fff', bg:'rgba(239,68,68,0.14)',   label:'Refusé'     },
  }[status];
  return (
    <View style={[cbg.wrap,{backgroundColor:cfg.bg,borderColor:`${cfg.color}30`}]}>
      <Ionicons name={cfg.icon} size={10} color={cfg.color}/>
      <Text style={[cbg.txt,{color:cfg.color}]}>{cfg.label}</Text>
    </View>
  );
});
const cbg = StyleSheet.create({
  wrap:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:4,borderRadius:10,borderWidth:1},
  txt: {fontSize:10,fontWeight:'700'},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ CONNECTION REQUEST MODAL — LinkedIn Premium
// ─────────────────────────────────────────────────────────────────────────────
const ConnectionRequestModal = memo(function ConnectionRequestModal({
  pro, status, userId, onClose, onSent,
}: {
  pro:Pro|null; status:ConnStatus; userId:string; onClose:()=>void; onSent:(id:string)=>void;
}) {
  const [note,    setNote]    = useState('');
  const [sending, setSending] = useState(false);
  const [phase,   setPhase]   = useState<'form'|'success'|'already'>('form');
  const slide      = useRef(new Animated.Value(900)).current;
  const successSc  = useRef(new Animated.Value(0)).current;
  const checkFade  = useRef(new Animated.Value(0)).current;

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
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const { ok, error: err } = await dbSendConnectionRequest(pro.id, userId, note);
    setSending(false);
    if (ok) {
      setPhase('success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.spring(successSc, { toValue:1, tension:80, friction:8, useNativeDriver:true }),
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

  return (
    <Modal visible animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={crm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={crm.kav}>
          <Animated.View style={[crm.sheet,{transform:[{translateY:slide}]}]}>
            <BlurView intensity={Platform.OS==='ios'?90:70} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <LinearGradient colors={['rgba(13,8,40,0.90)','rgba(6,15,40,0.96)']} style={StyleSheet.absoluteFillObject}/>

            <View style={{flex:1}}>
              <View style={crm.handle}/>

              {/* ── SUCCESS ── */}
              {phase==='success'&&(
                <View style={crm.centeredPhase}>
                  <Animated.View style={[crm.successRing,{transform:[{scale:successSc}]}]}>
                    <LinearGradient colors={['#fff','#fff']} style={crm.successGrad}>
                      <Animated.View style={{opacity:checkFade}}><Ionicons name="checkmark" size={34} color="#03020A"/></Animated.View>
                    </LinearGradient>
                  </Animated.View>
                  <Text style={crm.phaseTitle}>Demande envoyée !</Text>
                  <Text style={crm.phaseSub}>
                    {pro.name} recevra votre invitation.{'\n'}Vous serez notifié dès qu'il/elle accepte.
                  </Text>
                  <View style={crm.infoRow}>
                    <Ionicons name="time-outline" size={13} color="#fff"/>
                    <Text style={crm.infoTxt}>Réponse habituelle sous 48h</Text>
                  </View>
                </View>
              )}

              {/* ── ALREADY CONNECTED ── */}
              {phase==='already'&&(
                <View style={crm.centeredPhase}>
                  <View style={[crm.successRing,{width:72,height:72}]}>
                    <LinearGradient colors={['#22C55E','#15803D']} style={crm.successGrad}>
                      <Ionicons name="people" size={30} color={C.white}/>
                    </LinearGradient>
                  </View>
                  <Text style={crm.phaseTitle}>Vous êtes connectés !</Text>
                  <Text style={crm.phaseSub}>
                    {pro.name} a accepté votre invitation.{'\n'}Vous pouvez maintenant vous contacter.
                  </Text>
                  <View style={{width:'100%',gap:10}}>
                    {pro.contact_email&&(
                      <TouchableOpacity style={crm.actionBtn} onPress={()=>Linking.openURL(`mailto:${pro.contact_email}?subject=Connexion Universe`).catch(()=>{})} activeOpacity={0.85}>
                        <Ionicons name="mail-outline" size={15} color={C.white}/><Text style={crm.actionBtnTxt}>Envoyer un email</Text>
                      </TouchableOpacity>
                    )}
                    {pro.website&&(
                      <TouchableOpacity style={[crm.actionBtn,{backgroundColor:'rgba(90,150,230,0.16)',borderColor:C.borderBlue}]} onPress={()=>Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.85}>
                        <Ionicons name="globe-outline" size={15} color={C.blue}/><Text style={[crm.actionBtnTxt,{color:C.blue}]}>Voir le portfolio</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={{alignSelf:'center',paddingVertical:10}}>
                      <Text style={{color:C.textSec,fontSize:13}}>Fermer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── FORM ── */}
              {phase==='form'&&(
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Pro header */}
                  <View style={crm.proHead}>
                    <View style={crm.proAvatarWrap}>
                      <Image source={{uri:pro.avatar??`https://i.pravatar.cc/100?u=${pro.id}`}} style={crm.proAvatar}/>
                      {pro.verified&&<View style={crm.verifiedDot}><Ionicons name="checkmark-circle" size={16} color={C.blue}/></View>}
                    </View>
                    <View style={{flex:1}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                        <Text style={crm.proName}>{pro.name}</Text>
                        {status==='pending'&&<ConnBadge status="pending"/>}
                      </View>
                      <Text style={crm.proRole}>{pro.role}</Text>
                      {pro.location&&<View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:2}}><Ionicons name="location-outline" size={11} color={C.textTert}/><Text style={{color:C.textTert,fontSize:10}}>{pro.location}</Text></View>}
                    </View>
                    <TouchableOpacity style={crm.closeBtnTop} onPress={onClose} hitSlop={10}><Ionicons name="close" size={14} color={C.textSec}/></TouchableOpacity>
                  </View>

                  {/* Premium badge */}
                  <View style={crm.premiumBadge}>
                    <LinearGradient colors={['rgba(245,196,66,0.22)','rgba(245,196,66,0.07)']} style={crm.premiumInner} start={{x:0,y:0}} end={{x:1,y:0}}>
                      <Ionicons name="star" size={12} color={C.gold}/>
                      <Text style={crm.premiumTxt}>Connexion Professionnelle Universe</Text>
                      <View style={{width:6,height:6,borderRadius:3,backgroundColor:C.gold}}/>
                    </LinearGradient>
                  </View>

                  {/* Films */}
                  {pro.films.length>0&&(
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:20,paddingVertical:4,marginBottom:16}}>
                      {pro.films.slice(0,5).map(film=>(
                        <View key={film} style={crm.filmChip}><Ionicons name="film-outline" size={10} color={C.textSec}/><Text style={{color:C.textSec,fontSize:10,fontWeight:'600',flexShrink:1}} numberOfLines={1}>{film}</Text></View>
                      ))}
                    </ScrollView>
                  )}

                  {/* State: pending */}
                  {status==='pending'?(
                    <View style={crm.pendingBox}>
                      <View style={crm.pendingIcon}><Ionicons name="time" size={22} color="#F59E0B"/></View>
                      <View style={{flex:1}}>
                        <Text style={crm.pendingTitle}>Invitation envoyée</Text>
                        <Text style={crm.pendingBody}>{pro.name} n'a pas encore répondu. Vous serez notifié dès qu'il/elle accepte.</Text>
                      </View>
                    </View>
                  ):(
                    /* Note form */
                    <View style={{paddingHorizontal:20}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:6}}>
                        <Ionicons name="create-outline" size={14} color={C.blue}/>
                        <Text style={{color:C.text,fontSize:13,fontWeight:'800',flex:1}}>Note personnalisée</Text>
                        <Text style={{color:'rgba(245,196,66,0.55)',fontSize:10,fontWeight:'700'}}>obligatoire</Text>
                      </View>
                      <Text style={{color:C.textTert,fontSize:11,lineHeight:17,marginBottom:12}}>
                        Expliquez pourquoi vous souhaitez vous connecter avec {pro.name.split(' ')[0]}.
                      </Text>
                      <View style={crm.noteWrap}>
                        <TextInput
                          style={crm.noteInput}
                          value={note}
                          onChangeText={setNote}
                          multiline maxLength={300}
                          textAlignVertical="top"
                          placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous ai découvert sur Universe et souhaite me connecter car…`}
                          placeholderTextColor={C.textTert}
                          selectionColor={C.gold}
                        />
                        <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingBottom:10}}>
                          <View style={{flex:1,height:2,borderRadius:1,backgroundColor:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
                            <View style={{height:'100%',borderRadius:1,backgroundColor:charOk?C.green:C.gold,width:`${charPct}%` as any}}/>
                          </View>
                          <Text style={[{color:C.textTert,fontSize:10,fontWeight:'700'},charOk&&{color:C.green}]}>{note.trim().length}/300</Text>
                        </View>
                        {!charOk&&note.length>0&&<Text style={{color:'rgba(245,196,66,0.50)',fontSize:10,paddingHorizontal:14,paddingBottom:10}}>Encore {20-note.trim().length} car. minimum</Text>}
                      </View>

                      {/* Open to */}
                      {pro.open_to.length>0&&(
                        <View style={crm.openToBox}>
                          <Text style={{color:C.green,fontSize:11,fontWeight:'700',marginBottom:6}}>Ouvert à :</Text>
                          <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
                            {pro.open_to.map(o=>(
                              <View key={o} style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:4,borderRadius:10,backgroundColor:'rgba(46,204,138,0.10)'}}>
                                <Ionicons name="checkmark" size={9} color={C.green}/><Text style={{color:C.green,fontSize:10,fontWeight:'600'}}>{o}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={{height:160}}/>
                </ScrollView>
              )}
            </View>

            {/* Footer */}
            {phase==='form'&&(
              <View style={crm.footer}>
                <TouchableOpacity style={crm.cancelBtn} onPress={onClose} activeOpacity={0.80}>
                  <Text style={crm.cancelTxt}>Annuler</Text>
                </TouchableOpacity>
                {status==='pending'?(
                  <TouchableOpacity style={[crm.sendBtn,{flex:1}]} onPress={onClose} activeOpacity={0.85}>
                    <LinearGradient colors={[C.navyBright,C.navyLight]} style={crm.sendGrad}><Text style={[crm.sendTxt,{color:C.white}]}>Fermer</Text></LinearGradient>
                  </TouchableOpacity>
                ):(
                  <TouchableOpacity style={[crm.sendBtn,(!charOk||sending)&&{opacity:0.45}]} onPress={handleSend} disabled={!charOk||sending} activeOpacity={0.88}>
                    <LinearGradient colors={charOk?['#F5C842','#D4A008']:['rgba(255,255,255,0.06)','rgba(255,255,255,0.06)']} style={crm.sendGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                      {sending?<ActivityIndicator color="#03020A" size="small"/>:<><Ionicons name="person-add-outline" size={15} color={charOk?'#03020A':C.textTert}/><Text style={[crm.sendTxt,{color:charOk?'#03020A':C.textTert}]}>Se connecter</Text></>}
                    </LinearGradient>
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
  overlay:      {flex:1,justifyContent:'flex-end',backgroundColor:'rgba(2,8,16,0.90)'},
  kav:          {flex:1,justifyContent:'flex-end'},
  sheet:        {maxHeight:'92%',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden',borderWidth:1,borderColor:'rgba(245,196,66,0.20)'},
  topAccent:    {position:'absolute',top:0,left:0,right:0,height:3},
  handle:       {width:40,height:4,borderRadius:2,backgroundColor:'rgba(245,196,66,0.25)',alignSelf:'center',marginTop:12,marginBottom:4},
  centeredPhase:{alignItems:'center',padding:36,gap:14,paddingVertical:48},
  successRing:  {width:84,height:84,borderRadius:42,overflow:'hidden',shadowColor:C.gold,shadowOpacity:0.5,shadowRadius:24,shadowOffset:{width:0,height:0},elevation:12},
  successGrad:  {flex:1,alignItems:'center',justifyContent:'center'},
  phaseTitle:   {color:C.white,fontSize:21,fontWeight:'900',textAlign:'center'},
  phaseSub:     {color:C.textSec,fontSize:13,textAlign:'center',lineHeight:20},
  infoRow:      {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:16,paddingVertical:10,borderRadius:14,backgroundColor:'rgba(245,196,66,0.08)',borderWidth:1,borderColor:'rgba(245,196,66,0.18)'},
  infoTxt:      {color:'rgba(245,196,66,0.65)',fontSize:11,flex:1},
  actionBtn:    {flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:22,paddingVertical:13,borderRadius:16,backgroundColor:'rgba(13,34,64,0.82)',borderWidth:1,borderColor:C.borderHi,justifyContent:'center'},
  actionBtnTxt: {color:C.white,fontSize:14,fontWeight:'700'},
  proHead:      {flexDirection:'row',alignItems:'flex-start',gap:14,paddingHorizontal:20,paddingTop:16,paddingBottom:14},
  proAvatarWrap:{position:'relative'},
  proAvatar:    {width:56,height:56,borderRadius:28,borderWidth:2,borderColor:'rgba(245,196,66,0.35)'},
  verifiedDot:  {position:'absolute',bottom:-2,right:-2,width:20,height:20,borderRadius:10,backgroundColor:C.bg0,alignItems:'center',justifyContent:'center'},
  proName:      {color:C.white,fontSize:16,fontWeight:'900',flexShrink:1},
  proRole:      {color:C.blue,fontSize:11,fontWeight:'700',marginTop:2},
  closeBtnTop:  {width:30,height:30,borderRadius:15,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  premiumBadge: {marginHorizontal:20,marginBottom:16,borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:'rgba(245,196,66,0.22)'},
  premiumInner: {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10},
  premiumTxt:   {flex:1,color:'rgba(245,196,66,0.80)',fontSize:11,fontWeight:'700'},
  filmChip:     {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,maxWidth:130},
  noteWrap:     {backgroundColor:'rgba(255,255,255,0.04)',borderRadius:16,borderWidth:1,borderColor:'rgba(245,196,66,0.18)',overflow:'hidden',marginBottom:14},
  noteInput:    {paddingHorizontal:14,paddingVertical:14,color:C.text,fontSize:14,minHeight:140,lineHeight:22},
  openToBox:    {backgroundColor:'rgba(46,204,138,0.06)',borderRadius:14,borderWidth:1,borderColor:'rgba(46,204,138,0.18)',padding:12,marginBottom:10},
  pendingBox:   {flexDirection:'row',alignItems:'flex-start',gap:14,marginHorizontal:20,marginBottom:20,backgroundColor:'rgba(245,158,11,0.08)',borderRadius:16,borderWidth:1,borderColor:'rgba(245,158,11,0.20)',padding:16},
  pendingIcon:  {width:44,height:44,borderRadius:22,backgroundColor:'rgba(245,158,11,0.14)',alignItems:'center',justifyContent:'center'},
  pendingTitle: {color:'#F59E0B',fontSize:14,fontWeight:'800',marginBottom:5},
  pendingBody:  {color:C.textSec,fontSize:12,lineHeight:18,flex:1},
  footer:       {flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingTop:14,paddingBottom:Platform.OS==='ios'?36:20,borderTopWidth:1,borderTopColor:'rgba(245,196,66,0.10)'},
  cancelBtn:    {paddingHorizontal:18,paddingVertical:14,borderRadius:16,backgroundColor:C.surf,borderWidth:1,borderColor:C.border},
  cancelTxt:    {color:C.textSec,fontSize:14,fontWeight:'600'},
  sendBtn:      {flex:1,borderRadius:16,overflow:'hidden'},
  sendGrad:     {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingVertical:15},
  sendTxt:      {fontSize:15,fontWeight:'900'},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ PRO CARD — 3 états : idle / pending / connected
// ─────────────────────────────────────────────────────────────────────────────
const ProCard2 = memo(function ProCard2({
  pro, status, onConnect,
}: { pro:Pro; status:ConnStatus; onConnect:(p:Pro)=>void }) {
  const btnCfg = useMemo(() => {
    if (status==='accepted') return { icon:'people',           label:'Connecté',      colors:['#22C55E','#15803D'] as const, tc:C.white,   border:'rgba(34,197,94,0.35)'  };
    if (status==='pending')  return { icon:'time-outline',     label:'En attente…',   colors:[C.surf,C.surf]       as const, tc:'#F59E0B', border:'rgba(245,158,11,0.30)' };
    return                        { icon:'person-add-outline', label:'Se connecter',  colors:['rgba(245,196,66,0.20)','rgba(245,196,66,0.07)'] as const, tc:C.gold, border:'rgba(245,196,66,0.30)' };
  }, [status]);

  return (
    <View style={pc2.wrap}>
      <BlurView intensity={Platform.OS==='ios'?14:9} tint="dark" style={StyleSheet.absoluteFillObject}/>
      {status==='accepted'&&<LinearGradient colors={['rgba(34,197,94,0.20)','transparent']} style={pc2.topAccent}/>}
      {status==='none'    &&<LinearGradient colors={['rgba(245,196,66,0.10)','transparent']} style={pc2.topAccent}/>}

      <View style={pc2.inner}>
        <View style={pc2.header}>
          <View style={{position:'relative'}}>
            <Image source={{uri:pro.avatar??`https://i.pravatar.cc/120?u=${pro.id}`}} style={pc2.avatar}/>
            {pro.verified&&<View style={pc2.verifiedBadge}><Ionicons name="checkmark-circle" size={14} color={C.blue}/></View>}
          </View>
          <View style={{flex:1,gap:3}}>
            <Text style={pc2.name} numberOfLines={1}>{pro.name}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="briefcase-outline" size={10} color={C.blue}/><Text style={pc2.role} numberOfLines={1}>{pro.role}</Text></View>
            {pro.location&&<View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="location-outline" size={10} color={C.textTert}/><Text style={{color:C.textTert,fontSize:10}}>{pro.location}</Text></View>}
          </View>
          <ConnBadge status={status}/>
        </View>

        {pro.bio&&<Text style={pc2.bio} numberOfLines={2}>{pro.bio}</Text>}

        {pro.films.length>0&&(
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
            {pro.films.slice(0,5).map(film=>(
              <View key={film} style={pc2.filmChip}><Ionicons name="film-outline" size={9} color={C.textSec}/><Text style={pc2.filmTxt} numberOfLines={1}>{film}</Text></View>
            ))}
          </ScrollView>
        )}

        {pro.open_to.length>0&&(
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
            {pro.open_to.slice(0,4).map(o=>(
              <View key={o} style={pc2.openChip}><Text style={pc2.openTxt}>{o}</Text></View>
            ))}
          </View>
        )}

        <View style={pc2.actions}>
          <TouchableOpacity
            style={[pc2.connBtn,{borderColor:btnCfg.border}]}
            onPress={() => { if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{}); onConnect(pro); }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={btnCfg.colors as any} style={pc2.connGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
              <Ionicons name={btnCfg.icon as any} size={13} color={btnCfg.tc}/>
              <Text style={[pc2.connTxt,{color:btnCfg.tc}]}>{btnCfg.label}</Text>
            </LinearGradient>
          </TouchableOpacity>
          {pro.website&&(
            <TouchableOpacity style={pc2.webBtn} onPress={()=>Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.80}>
              <Ionicons name="globe-outline" size={16} color={C.blue}/>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const pc2 = StyleSheet.create({
  wrap:        {marginHorizontal:EDGE,marginBottom:14,borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},
  topAccent:   {position:'absolute',top:0,left:0,right:0,height:60},
  inner:       {padding:16,gap:12},
  header:      {flexDirection:'row',alignItems:'flex-start',gap:12},
  avatar:      {width:52,height:52,borderRadius:26,borderWidth:1.5,borderColor:'rgba(245,196,66,0.22)'},
  verifiedBadge:{position:'absolute',bottom:-2,right:-2,width:18,height:18,borderRadius:9,backgroundColor:C.bg0,alignItems:'center',justifyContent:'center'},
  name:        {color:C.white,fontSize:15,fontWeight:'800',flexShrink:1},
  role:        {color:C.blue,fontSize:11,fontWeight:'700',flexShrink:1},
  bio:         {color:C.textSec,fontSize:13,lineHeight:18},
  filmChip:    {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:4,borderRadius:9,backgroundColor:C.surf,borderWidth:0.5,borderColor:C.border,maxWidth:130},
  filmTxt:     {color:C.textSec,fontSize:10,fontWeight:'600',flexShrink:1},
  openChip:    {paddingHorizontal:9,paddingVertical:3,borderRadius:10,backgroundColor:C.greenDim,borderWidth:0.5,borderColor:C.greenEdge},
  openTxt:     {color:C.green,fontSize:10,fontWeight:'600'},
  actions:     {flexDirection:'row',gap:10},
  connBtn:     {flex:1,borderRadius:14,overflow:'hidden',borderWidth:1},
  connGrad:    {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:11},
  connTxt:     {fontSize:13,fontWeight:'800'},
  webBtn:      {width:42,height:42,borderRadius:14,backgroundColor:C.surf,borderWidth:0.5,borderColor:C.border,alignItems:'center',justifyContent:'center'},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ PRO DIRECTORY 2 — FlatList + stats bar + connexion
// ─────────────────────────────────────────────────────────────────────────────
function ProDirectory2({ userId }: { userId:string }) {
  const [search,     setSearch]     = useState('');
  const [activeRole, setActiveRole] = useState('Réalisateur.ice');
  const [connectPro, setConnectPro] = useState<Pro|null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('none');
  const searchRef = useRef<TextInput>(null);

  const { pros, loading, error, refresh } = useProDirectory(search, activeRole);
  const { connections, setStatus } = useConnections(userId);

  const connectedCount = useMemo(() => Object.values(connections).filter(s=>s==='accepted').length, [connections]);
  const pendingCount   = useMemo(() => Object.values(connections).filter(s=>s==='pending').length,  [connections]);

  const handleOpen = useCallback((pro: Pro) => {
    setConnStatus(connections[pro.id] ?? 'none');
    setConnectPro(pro);
  }, [connections]);

  const handleSent = useCallback((proId: string) => {
    setStatus(proId, 'pending');
  }, [setStatus]);

  const renderItem = useCallback(({ item }: { item:Pro }) => (
    <ProCard2 pro={item} status={connections[item.id]??'none'} onConnect={handleOpen}/>
  ), [connections, handleOpen]);

  const keyExtractor = useCallback((p: Pro) => p.id, []);

  const ListHeader = useMemo(() => (
    <>
      {(connectedCount > 0 || pendingCount > 0) && (
        <View style={pd2.statsBar}>
          <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <View style={pd2.statsRow}>
            {connectedCount>0&&<View style={pd2.statItem}><Ionicons name="people" size={13} color={C.green}/><Text style={pd2.statTxt}><Text style={{color:C.green,fontWeight:'800'}}>{connectedCount}</Text> connexion{connectedCount>1?'s':''}</Text></View>}
            {pendingCount>0&&<View style={pd2.statItem}><Ionicons name="time-outline" size={13} color={C.gold}/><Text style={pd2.statTxt}><Text style={{color:C.gold,fontWeight:'800'}}>{pendingCount}</Text> en attente</Text></View>}
          </View>
        </View>
      )}
      <Text style={pd2.count}>
        {pros.length} professionnel{pros.length>1?'s':''}
        {activeRole!=='Tous'?` · ${activeRole}`:''}
      </Text>
    </>
  ), [connectedCount, pendingCount, pros.length, activeRole]);

  return (
    <View style={{flex:1,flexDirection:'column'}}>
      {/* Recherche & Filtres */}
      <View>
        <View style={pd2.searchWrap}>
          <BlurView intensity={Platform.OS==='ios'?16:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <View style={pd2.searchRow}>
            <Ionicons name="search" size={15} color={C.textTert}/>
            <TextInput ref={searchRef} style={pd2.searchInput} placeholder="Rechercher un professionnel…" placeholderTextColor={C.textTert} value={search} onChangeText={setSearch} returnKeyType="search" autoCorrect={false} autoCapitalize="words"/>
            {search.length>0&&<TouchableOpacity onPress={()=>{setSearch('');searchRef.current?.focus();}} hitSlop={8 as any}><Ionicons name="close-circle" size={15} color={C.textTert}/></TouchableOpacity>}
          </View>
        </View>

        {/* Filtres rôles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:8,paddingVertical:4}} style={{maxHeight:50,marginBottom:14}}>
          {PRO_ROLES.map(r=>{const on=activeRole===r;return(
            <TouchableOpacity key={r} style={[pd2.roleChip,on&&pd2.roleChipOn]} onPress={()=>setActiveRole(r)} activeOpacity={0.80}>
              <Text style={[pd2.roleTxt,on&&pd2.roleTxtOn]}>{r}</Text>
            </TouchableOpacity>
          );})}
        </ScrollView>
      </View>

      {/* Feed */}
      {loading?(
        <View style={pd2.center}><ActivityIndicator color={C.gold} size="large"/><Text style={pd2.loadTxt}>Chargement du répertoire…</Text></View>
      ):error?(
        <View style={pd2.center}>
          <View style={pd2.errorIcon}><Ionicons name="cloud-offline-outline" size={28} color={C.textTert}/></View>
          <Text style={{color:C.red,fontSize:13,textAlign:'center',paddingHorizontal:40,marginBottom:12}}>{error}</Text>
          <TouchableOpacity style={pd2.retryBtn} onPress={refresh}><Text style={{color:C.white,fontWeight:'700',fontSize:14}}>Réessayer</Text></TouchableOpacity>
        </View>
      ):(
        <FlatList
          data={pros}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom:120 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={pd2.center}>
              <Ionicons name="people-outline" size={40} color={C.textTert}/>
              <Text style={{color:C.textSec,fontSize:15,fontWeight:'700',marginTop:12}}>Aucun professionnel trouvé</Text>
              <Text style={{color:C.textTert,fontSize:12,marginTop:4}}>Modifiez votre recherche ou le filtre</Text>
            </View>
          }
        />
      )}

      <ConnectionRequestModal pro={connectPro} status={connStatus} userId={userId} onClose={()=>setConnectPro(null)} onSent={handleSent}/>
    </View>
  );
}

 


const pd2 = StyleSheet.create({
  statsBar:   {marginHorizontal:EDGE,marginBottom:12,borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:C.navyMid},
  statsRow:   {flexDirection:'row',gap:16,paddingHorizontal:14,paddingVertical:10},
  statItem:   {flexDirection:'row',alignItems:'center',gap:6},
  statTxt:    {color:C.textSec,fontSize:12},
  searchWrap: {marginHorizontal:EDGE,marginBottom:14,borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:C.border},
  searchRow:  {flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingVertical:12},
  searchInput:{flex:1,color:C.text,fontSize:14},
  roleChip:   {paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:C.surf,borderWidth:1,borderColor:C.border},
  roleChipOn: {backgroundColor:C.navyMid,borderColor:C.navyMid},
  roleTxt:    {color:"#fff",fontSize:12,fontWeight:'800'},
  roleTxtOn:  {color:"#fff",fontWeight:'800'},
  center:     {flex:1,alignItems:'center',justifyContent:'center',gap:12,paddingVertical:60},
  errorIcon:  {width:56,height:56,borderRadius:28,backgroundColor:C.surf,alignItems:'center',justifyContent:'center'},
  loadTxt:    {color:C.textSec,fontSize:13,marginTop:10},
  retryBtn:   {paddingHorizontal:22,paddingVertical:10,borderRadius:14,backgroundColor:C.navyLight,borderWidth:1,borderColor:C.borderHi},
  count:      {color:C.textTert,fontSize:12,paddingHorizontal:EDGE,marginBottom:12},
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL HEADER & FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────
const SocialHeader = memo(function SocialHeader({ onCompose }:{ onCompose:()=>void }) {
  const router = useRouter();
  return (
    <View style={hdr.row}>
      <View><Text style={hdr.eyebrow}>UNIVERSE · CINÉMA</Text><Text style={hdr.title}>Communauté</Text></View>
      <View style={hdr.actions}>
        <TouchableOpacity style={hdr.btn} onPress={()=>router.push('/notifications' as any)} activeOpacity={0.8}><Ionicons name="notifications-outline" size={19} color={C.textSec}/><View style={hdr.dot}/></TouchableOpacity>
      </View>
    </View>
  );
});
const hdr = StyleSheet.create({
  row:       {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingTop:10,paddingBottom:14},
  eyebrow:   {fontSize:9,fontWeight:'700',color:C.textTert,letterSpacing:1.5,marginBottom:2},
  title:     {fontSize:26,fontWeight:'800',color:C.text,letterSpacing:-0.5},
  actions:   {flexDirection:'row',gap:8},
  btn:       {width:38,height:38,borderRadius:19,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',position:'relative'},
  composeBtn:{borderColor:C.navyBright},
  dot:       {position:'absolute',top:8,right:8,width:7,height:7,borderRadius:4,backgroundColor:C.red,borderWidth:1.5,borderColor:C.bg0},
});

const FilterTabs = memo(function FilterTabs({ active,set }:{ active:FeedTab; set:(t:FeedTab)=>void }) {
  return (
    <View style={ft.row}>
      {FEED_TABS.map(t=>{
        const on=t===active, isPro=t==='Pros', isDiscover=t==='Découvrir';
        return (
          <TouchableOpacity key={t} onPress={()=>set(t)} style={ft.pill} activeOpacity={0.8}>
            <View style={ft.lw}>
             
              <Text style={[ft.txt,on&&ft.txtOn]}>{t}</Text>
            </View>
            {on&&<View style={[ft.line,isPro&&{backgroundColor:C.blue},isDiscover&&{backgroundColor:C.blue}]}/>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const ft = StyleSheet.create({
  row: {flexDirection:'row',paddingHorizontal:EDGE,gap:18,marginBottom:10,borderBottomWidth:1,borderBottomColor:C.border},
  pill:{paddingBottom:13,alignItems:'center',position:'relative'},
  lw:  {flexDirection:'row',alignItems:'center',gap:5},
  proBadge:{width:16,height:16,borderRadius:8,backgroundColor:C.goldDim,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.goldEdge},
  txt: {color:C.textSec,fontSize:13,fontWeight:'600'},
  txtOn:{color:C.text,fontWeight:'800'},
  line:{position:'absolute',bottom:0,left:0,right:0,height:2,borderRadius:1,backgroundColor:C.blue},
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const [activeTab,   setActiveTab]   = useState<FeedTab>('Pour vous');
  const [composeOpen, setComposeOpen] = useState(false);
  const [userId,      setUserId]      = useState('anonymous');
  const [refreshing,  setRefreshing]  = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
      else supabase.auth.getUser().then(({ data:{ user } }) => { if(user?.id) setUserId(user.id); });
    });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e,s) => { if(s?.user?.id) setUserId(s.user.id); });
    return () => subscription.unsubscribe();
  }, []);

  const { posts, loading, error, refresh, toggleLike } = usePostsFeed(activeTab);
  const { works, loading: worksLoading } = useWorksAlgorithm();

  const onRefresh = useCallback(async () => {
    setRefreshing(true); refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const trendingPosts = useMemo(() => {
    if (activeTab !== 'Tendances') return posts;
    return [...posts].sort((a,b) => (b.likes + b.shares*2) - (a.likes + a.shares*2));
  }, [posts, activeTab]);

  const listData = activeTab === 'Tendances' ? trendingPosts : posts;

  const renderItem   = useCallback(({ item }:{ item:Post }) => <PostCard post={item} userId={userId}/>, [userId]);
  const keyExtractor = useCallback((item:Post) => item.id, []);

  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)}/>
      <FilterTabs active={activeTab} set={setActiveTab}/>
      {activeTab==='Pour vous'&&<><TrendingWorksRow works={works} loading={worksLoading}/><CreatorSpotlight posts={posts}/>{posts.length>3&&<GenreRadar posts={posts}/>}</>}
      {activeTab==='Tendances'&&trendingPosts.length>0&&<AlgorithmBanner works={works}/>}
    </>
  ), [activeTab, trendingPosts, works, worksLoading, posts]);

  const ListEmpty = useMemo(() => {
    if (loading) return <View style={{alignItems:'center',paddingVertical:60,gap:14}}><ActivityIndicator color={C.blue} size="large"/><Text style={{color:C.textSec,fontSize:13}}>Chargement…</Text></View>;
    if (error)   return <View style={{alignItems:'center',paddingVertical:60,gap:12}}><Ionicons name="cloud-offline-outline" size={28} color={C.textTert}/><Text style={{color:C.red,fontSize:13,textAlign:'center',paddingHorizontal:40}}>{error}</Text><TouchableOpacity onPress={refresh} style={{paddingHorizontal:22,paddingVertical:10,borderRadius:14,backgroundColor:C.navyLight}}><Text style={{color:C.white,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>;
    return (
      <View style={{alignItems:'center',paddingVertical:80,paddingHorizontal:40,gap:12}}>
        <View style={{width:72,height:72,borderRadius:36,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center',marginBottom:4}}><Ionicons name="film-outline" size={36} color={C.textTert}/></View>
        <Text style={{color:C.textSec,fontSize:17,fontWeight:'700'}}>Aucune critique ici</Text>
        <TouchableOpacity style={{borderRadius:22,overflow:'hidden',marginTop:8}} onPress={()=>setComposeOpen(true)} activeOpacity={0.85}>
          <LinearGradient colors={[C.navyBright,C.navyLight]} start={{x:0,y:0}} end={{x:1,y:0}} style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:24,paddingVertical:13}}>
            <Ionicons name="create-outline" size={16} color={C.white}/><Text style={{color:C.white,fontSize:14,fontWeight:'700'}}>Écrire une critique</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [loading, error, refresh]);

  return (
    <InteractionProvider onToggleLike={toggleLike}>
      <View style={s.root}>
        <StatusBar style="light"/>
        <GalaxyBackground/>
        <SafeAreaView style={s.safe} edges={['top']}>
          <ComposeModal visible={composeOpen} onClose={()=>setComposeOpen(false)} onPublished={refresh} userId={userId}/>

          {/* ── DÉCOUVRIR ── */}
          {activeTab==='Découvrir'?(
            <View style={{flex:1}}>
              <SocialHeader onCompose={()=>setComposeOpen(true)}/>
              <FilterTabs active={activeTab} set={setActiveTab}/>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}}>
                <AlgorithmBanner works={works}/>
                <TrendingWorksRow works={works} loading={worksLoading}/>
                <View style={{paddingHorizontal:EDGE}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:14}}><Ionicons name="apps-outline" size={14} color={C.gold}/><Text style={{color:C.text,fontSize:16,fontWeight:'800'}}>Toutes les œuvres</Text></View>
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
                    {works.map(w=><WorkMiniCard key={w.id} work={w}/>)}
                  </View>
                </View>
              </ScrollView>
            </View>

          /* ── PROS ── */
          ):activeTab==='Pros'?(
            <View style={{flex:1}}>
              <SocialHeader onCompose={()=>setComposeOpen(true)}/>
              <FilterTabs active={activeTab} set={setActiveTab}/>
              <ProDirectory2 userId={userId}/>
            </View>

          /* ── FEED POSTS ── */
          ):(
            <FlatList
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={ListHeader}
              ListEmptyComponent={ListEmpty}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]}/>}
              removeClippedSubviews
              windowSize={7}
              maxToRenderPerBatch={4}
              updateCellsBatchingPeriod={50}
              initialNumToRender={4}
            />
          )}
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg0 },
  safe:        { flex:1 },
  listContent: { paddingBottom:120 },
});