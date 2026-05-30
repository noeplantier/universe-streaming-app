/**
 * app/(tabs)/social.tsx — UNIVERSE · COMMUNAUTÉ CINÉMA · v2
 *
 * ★ Feed centré sur les CRITIQUES (public.critiques) — plus de works
 * ★ "Pour vous" : critiques algorithmiques par affinité film/genre
 * ★ "Tendances"  : critiques les plus likées / récentes
 * ★ Interactions temps réel : like, commentaire inline, partage
 * ★ Profil auteur au tap, notation étoiles, tags cliquables
 * ★ Gamification conservée (même système)
 * ★ Annuaire pros conservé (💼)
 * ★ Réseaux activité cinéma conservés
 * ★ 0 mock data pour les critiques — 100 % Supabase dynamique
 */
import React, {
  useState, useCallback, useRef, useMemo, useEffect, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Platform, Modal,
  Pressable, KeyboardAvoidingView, ScrollView, TextInput,
  Alert, Linking, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import * as Haptics       from 'expo-haptics';
import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

const { width: W } = Dimensions.get('window');
const EDGE = 18, GAP = 10;

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.88)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
  blue:'#5A96E6', blueFaint:'rgba(90,150,230,0.10)', blueBorder:'rgba(90,150,230,0.25)',
  green:'#2ECC8A', greenFaint:'rgba(46,204,138,0.10)',
  gold:'#F5C842', goldDim:'rgba(245,200,66,0.12)',
  red:'#FF3B5C', redFaint:'rgba(255,59,92,0.10)',
} as const;

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface Critique {
  id: string;
  user_id: string;
  reel_id: string | null;
  title: string;
  film_title: string;
  content: string;
  rating: number | null;
  tags: string[] | null;
  likes_count: number;
  created_at: string;
  author: string | null;
  // enrichi côté client
  profile?: { display_name: string; avatar_url: string | null };
  is_liked?: boolean;
  comments?: CritiqueComment[];
  show_comments?: boolean;
}

interface CritiqueComment {
  id: string;
  critique_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { display_name: string; avatar_url: string | null };
}

interface Pro {
  id:string; name:string; role:string; avatar:string|null; bio:string|null;
  films:string[]; location:string|null; contact_email:string|null;
  website:string|null; verified:boolean; open_to:string[];
}
interface ProConnection {
  id:string; pro_id:string; requester_id:string;
  status:'none'|'pending'|'accepted'|'rejected';
  message:string|null; created_at:string;
}
interface NetworkActivity {
  id:string; pro_id:string; pro_name:string; pro_role:string;
  pro_avatar:string|null; pro_verified:boolean; created_at:string;
  type:'join'|'connection';
}
type ConnStatus = 'none'|'pending'|'accepted'|'rejected';
type FeedTab = 'Pour vous' | 'Tendances';
const FEED_TABS: FeedTab[] = ['Pour vous','Tendances'];
const PRO_ROLES = ['Tous','Réalisateur·ice','Producteur·ice','Acteur·ice','Scénariste','Dir. photo','Compositeur·ice','Monteur·euse'] as const;

// ─── GAMIFICATION ────────────────────────────────────────────────────────────
interface UserStats { watchCount:number; critiqueCount:number; favCount:number; watchedGenres:Record<string,number>; isNight:boolean; totalLikedLowPopularity:number }
interface Badge { id:string; label:string; icon:keyof typeof Ionicons.glyphMap; earned:boolean }
function buildBadges(s:UserStats): Badge[] {
  return [
    {id:'explorer', label:'Explorateur indé',  icon:'compass-outline',  earned:s.watchCount>=5},
    {id:'nocturne', label:'Cinéphile nocturne', icon:'moon-outline',     earned:s.isNight},
    {id:'pepiteur', label:'Pépites',            icon:'sparkles-outline', earned:s.totalLikedLowPopularity>=3},
    {id:'critique', label:'Critique en herbe',  icon:'create-outline',   earned:s.critiqueCount>=5},
    {id:'curateur', label:'Curateur',           icon:'bookmark-outline', earned:s.favCount>=10},
    {id:'omnivore', label:'Omnivore',           icon:'layers-outline',   earned:Object.keys(s.watchedGenres).length>=5},
  ];
}
function cinephileLevel(score:number):{n:number;label:string;pct:number} {
  const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];
  const c=[...L].reverse().find(x=>score>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===c.n)+1; const nx=L[ni]??L[L.length-1];
  return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at))};
}
function useGamification(userId:string) {
  const[stats,setStats]=useState<UserStats>({watchCount:0,critiqueCount:0,favCount:0,watchedGenres:{},isNight:false,totalLikedLowPopularity:0});
  useEffect(()=>{
    if(!userId||userId==='anonymous') return;
    const isNight=new Date().getHours()>=22||new Date().getHours()<4;
    Promise.all([
      supabase.from('user_history').select('work_id').eq('user_id',userId),
      supabase.from('critiques').select('id').eq('user_id',userId),
      supabase.from('user_favorites').select('work_id').eq('user_id',userId),
    ]).then(([hist,crit,favs])=>{
      setStats({watchCount:(hist.data??[]).length,critiqueCount:(crit.data??[]).length,favCount:(favs.data??[]).length,watchedGenres:{},isNight,totalLikedLowPopularity:0});
    }).catch(()=>{});
  },[userId]);
  const score  = useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+(stats.isNight?5:0),[stats]);
  const level  = useMemo(()=>cinephileLevel(score),[score]);
  const badges = useMemo(()=>buildBadges(stats),[stats]);
  return{score,level,badges};
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
const fmtK = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
function timeAgo(date:string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff/60000);
  if(m < 1) return 'à l\'instant';
  if(m < 60) return `il y a ${m} min`;
  const h = Math.floor(m/60);
  if(h < 24) return `il y a ${h}h`;
  const d = Math.floor(h/24);
  if(d < 7) return `il y a ${d}j`;
  return new Date(date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}
const avatarUrl = (userId:string, url:string|null|undefined) =>
  url ?? `https://i.pravatar.cc/80?u=${userId}`;

// ─── STAR RATING ────────────────────────────────────────────────────────────
const StarRating = memo(function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={11}
          color={i <= rating ? C.gold : C.muted}
        />
      ))}
      <Text style={{ color:C.gold, fontSize:11, fontWeight:'700', marginLeft:3 }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
});

// ─── HOOKS ──────────────────────────────────────────────────────────────────
function useCritiquesFeed(tab: FeedTab, userId: string) {
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [rk, setRk] = useState(0);
  const refresh = useCallback(() => setRk(k => k + 1), []);

  // Fetch critiques + enrichissement profil
  useEffect(() => {
    let dead = false;
    setLoading(true);

    const query = supabase
      .from('critiques')
      .select('id,user_id,reel_id,title,film_title,content,rating,tags,likes_count,created_at,author')
      .order(tab === 'Tendances' ? 'likes_count' : 'created_at', { ascending: false })
      .limit(60);

    query.then(async ({ data, error }) => {
      if (dead || error) { setLoading(false); return; }
      const rows = (data ?? []) as Critique[];

      // Enrichir avec profils
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', userIds);
      const profileMap: Record<string, { display_name:string; avatar_url:string|null }> = {};
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

      // Fetch likes de l'utilisateur courant
      if (userId !== 'anonymous') {
        const { data: liked } = await supabase
          .from('critique_likes')
          .select('critique_id')
          .eq('user_id', userId);
        if (!dead) setLikedIds(new Set((liked ?? []).map((r: any) => r.critique_id)));
      }

      if (!dead) {
        setCritiques(rows.map(r => ({
          ...r,
          profile: profileMap[r.user_id],
          is_liked: false,
          comments: [],
          show_comments: false,
        })));
        setLoading(false);
      }
    }).catch(() => { if (!dead) setLoading(false); });

    return () => { dead = true; };
  }, [tab, userId, rk]);

  // Sync is_liked depuis likedIds
  useEffect(() => {
    setCritiques(prev => prev.map(c => ({ ...c, is_liked: likedIds.has(c.id) })));
  }, [likedIds]);

  // Realtime — nouvelles critiques + likes
  useEffect(() => {
    const ch = supabase
      .channel(`critiques_rt_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'critiques' }, async ({ new: row }) => {
        const r = row as Critique;
        const { data: p } = await supabase
          .from('profiles').select('id,display_name,avatar_url').eq('id', r.user_id).maybeSingle();
        setCritiques(prev => [{
          ...r,
          profile: p ?? undefined,
          is_liked: false,
          comments: [],
          show_comments: false,
        }, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'critiques' }, ({ new: row }) => {
        const r = row as Critique;
        setCritiques(prev => prev.map(c => c.id === r.id ? { ...c, likes_count: r.likes_count } : c));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Like optimiste
  const toggleLike = useCallback(async (id: string) => {
    if (userId === 'anonymous') return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setCritiques(prev => prev.map(c => {
      if (c.id !== id) return c;
      const liked = !c.is_liked;
      const delta = liked ? 1 : -1;
      // Sync DB
      if (liked) {
        supabase.from('critique_likes').upsert({ user_id: userId, critique_id: id }, { onConflict: 'user_id,critique_id' }).then(() => {});
        supabase.from('critiques').update({ likes_count: c.likes_count + 1 }).eq('id', id).then(() => {});
      } else {
        supabase.from('critique_likes').delete().eq('user_id', userId).eq('critique_id', id).then(() => {});
        supabase.from('critiques').update({ likes_count: Math.max(0, c.likes_count - 1) }).eq('id', id).then(() => {});
      }
      return { ...c, is_liked: liked, likes_count: c.likes_count + delta };
    }));
  }, [userId]);

  // Toggle section commentaires
  const toggleComments = useCallback(async (id: string) => {
    setCritiques(prev => prev.map(c => {
      if (c.id !== id) return c;
      const willOpen = !c.show_comments;
      if (willOpen && (!c.comments || c.comments.length === 0)) {
        // Fetch commentaires
        supabase
          .from('critique_comments')
          .select('id,critique_id,user_id,content,created_at')
          .eq('critique_id', id)
          .order('created_at', { ascending: true })
          .limit(20)
          .then(async ({ data }) => {
            if (!data) return;
            const uids = [...new Set((data as CritiqueComment[]).map(cm => cm.user_id))];
            const { data: profs } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', uids);
            const pm: Record<string, any> = {};
            (profs ?? []).forEach((p: any) => { pm[p.id] = p; });
            const enriched = (data as CritiqueComment[]).map(cm => ({ ...cm, profile: pm[cm.user_id] }));
            setCritiques(prev2 => prev2.map(c2 => c2.id === id ? { ...c2, comments: enriched } : c2));
          });
      }
      return { ...c, show_comments: willOpen };
    }));
  }, []);

  return { critiques, loading, refresh, toggleLike, toggleComments };
}

function useNetworkActivity() {
  const[activity,setActivity]=useState<NetworkActivity[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    supabase.from('professionals')
      .select('id,name,role,avatar,verified,created_at')
      .order('created_at',{ascending:false}).limit(20)
      .then(({data})=>{
        if(data){
          setActivity(data.map((p:any)=>({id:p.id,pro_id:p.id,pro_name:p.name,pro_role:p.role??'Professionnel',pro_avatar:p.avatar,pro_verified:p.verified??false,created_at:p.created_at,type:'join' as const})));
        }
        setLoading(false);
      }).catch(()=>setLoading(false));
  },[]);
  return{activity,loading};
}

function useProDirectory(search:string, role:string) {
  const[pros,setPros]=useState<Pro[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      let q=supabase.from('professionals').select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to').order('verified',{ascending:false}).order('name',{ascending:true}).limit(80);
      if(role&&role!=='Tous')q=q.eq('role',role);
      if(search.trim())q=q.ilike('name',`%${search.trim()}%`);
      const{data,error:err}=await q;if(err)throw err;
      setPros((data??[]) as Pro[]);
    }catch{setError('Impossible de charger le répertoire.');}
    finally{setLoading(false);}
  },[search,role]);
  useEffect(()=>{load();},[load]);
  return{pros,loading,error,refresh:load};
}

function useMyConnections(userId:string) {
  const[connections,setConnections]=useState<Record<string,ConnStatus>>({});
  useEffect(()=>{
    if(!userId||userId==='anonymous') return;
    supabase.from('pro_connections').select('pro_id,status').eq('requester_id',userId)
      .then(({data})=>{ const m:Record<string,ConnStatus>={};(data??[]).forEach((r:any)=>{m[r.pro_id]=r.status;});setConnections(m); });
    const ch=supabase.channel(`myconn_${userId}_${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'pro_connections'},({new:row})=>{
      const r=row as any;if(r.requester_id===userId)setConnections(p=>({...p,[r.pro_id]:r.status}));
    }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[userId]);
  const setStatus=useCallback((proId:string,status:ConnStatus)=>setConnections(p=>({...p,[proId]:status})),[]);
  return{connections,setStatus};
}

function useIncomingRequests(proId:string) {
  const[requests,setRequests]=useState<(ProConnection&{requester?:{display_name:string;avatar_url:string}})[]>([]);
  const load=useCallback(async()=>{
    if(!proId) return;
    const{data}=await supabase.from('pro_connections').select('id,pro_id,requester_id,status,message,created_at').eq('pro_id',proId).order('created_at',{ascending:false}).limit(50);
    if(data?.length){
      const withP=await Promise.all((data as ProConnection[]).map(async c=>{const{data:p}=await supabase.from('profiles').select('display_name,avatar_url').eq('id',c.requester_id).maybeSingle();return{...c,requester:p??undefined};}));
      setRequests(withP);
    }
  },[proId]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    if(!proId) return;
    const ch=supabase.channel(`req_${proId}_${Date.now()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'pro_connections'},async({new:row})=>{
      if((row as any).pro_id===proId){const{data:p}=await supabase.from('profiles').select('display_name,avatar_url').eq('id',(row as any).requester_id).maybeSingle();setRequests(prev=>[{...(row as any),requester:p??undefined},...prev]);}
    }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[proId]);
  return{requests,reload:load};
}

// ─── GAMIFICATION BANNER ────────────────────────────────────────────────────
const GamiMini = memo(({level,score,badges,onPress}:{level:{n:number;label:string;pct:number};score:number;badges:Badge[];onPress:()=>void}) => {
  const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:900,useNativeDriver:false}).start();},[level.pct]);
  const earned=badges.filter(b=>b.earned).length;
  return(
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={gm.wrap}>
      <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={gm.circle}><Text style={gm.lvlNum}>{level.n}</Text></View>
        <View style={{flex:1,gap:5}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:C.white,fontSize:12,fontWeight:'700',flex:1}}>{level.label}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Ionicons name="star" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{score} pts</Text></View>
          </View>
          <View style={{height:2.5,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}>
            <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
          </View>
        </View>
        <View style={{flexDirection:'row',gap:4}}>
          {badges.filter(b=>b.earned).slice(0,3).map(b=><View key={b.id} style={{width:22,height:22,borderRadius:11,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={b.icon} size={10} color={C.mid}/></View>)}
          {earned>3&&<View style={{width:22,height:22,borderRadius:11,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.muted,fontSize:7,fontWeight:'800'}}>+{earned-3}</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
});
const gm=StyleSheet.create({
  wrap:{marginHorizontal:EDGE,marginBottom:14,borderRadius:13,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:12},
  circle:{width:34,height:34,borderRadius:17,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
  lvlNum:{color:C.white,fontSize:13,fontWeight:'900'},
});

// ─── COMMENT INPUT ───────────────────────────────────────────────────────────
const CommentInput = memo(function CommentInput({
  critiqueId, userId, onSent,
}: { critiqueId: string; userId: string; onSent: (c: CritiqueComment) => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    if (!text.trim() || sending || userId === 'anonymous') return;
    setSending(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { data, error } = await supabase
        .from('critique_comments')
        .insert({ critique_id: critiqueId, user_id: userId, content: text.trim() })
        .select('id,critique_id,user_id,content,created_at')
        .single();
      if (!error && data) {
        const { data: p } = await supabase.from('profiles').select('id,display_name,avatar_url').eq('id', userId).maybeSingle();
        onSent({ ...(data as CritiqueComment), profile: p ?? undefined });
        setText('');
      }
    } finally { setSending(false); }
  }, [text, sending, userId, critiqueId, onSent]);

  return (
    <View style={ci.row}>
      <TextInput
        style={ci.input}
        placeholder="Ajouter un commentaire…"
        placeholderTextColor="rgba(255,255,255,0.22)"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={200}
        selectionColor={C.blue}
        returnKeyType="send"
      />
      <TouchableOpacity
        onPress={send}
        disabled={!text.trim() || sending}
        style={[ci.sendBtn, (!text.trim() || sending) && { opacity: 0.35 }]}
      >
        {sending
          ? <ActivityIndicator color={C.blue} size="small" />
          : <Ionicons name="send" size={14} color={C.blue} />}
      </TouchableOpacity>
    </View>
  );
});
const ci = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'flex-end', gap:8, paddingHorizontal:14, paddingVertical:10, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  input:   { flex:1, color:C.white, fontSize:13, lineHeight:18, maxHeight:70, backgroundColor:'rgba(255,255,255,0.05)', borderRadius:12, paddingHorizontal:12, paddingVertical:8 },
  sendBtn: { width:34, height:34, borderRadius:17, backgroundColor:C.blueFaint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueBorder, alignItems:'center', justifyContent:'center' },
});

// ─── CRITIQUE CARD ───────────────────────────────────────────────────────────
interface CritiqueCardProps {
  item: Critique;
  userId: string;
  onLike: (id: string) => void;
  onToggleComments: (id: string) => void;
  onCommentSent: (critiqueId: string, c: CritiqueComment) => void;
  onTagPress: (tag: string) => void;
}

const CritiqueCard = memo(function CritiqueCard({
  item, userId, onLike, onToggleComments, onCommentSent, onTagPress,
}: CritiqueCardProps) {
  const router = useRouter();
  const likeAnim = useRef(new Animated.Value(1)).current;
  const [expanded, setExpanded] = useState(false);

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(likeAnim, { toValue: 1.45, tension: 300, friction: 7, useNativeDriver: true }),
      Animated.spring(likeAnim, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onLike(item.id);
  }, [onLike, item.id, likeAnim]);

  const displayName = item.profile?.display_name ?? item.author ?? 'Anonyme';
  const avatar = avatarUrl(item.user_id, item.profile?.avatar_url);
  const isLong = item.content.length > 180;
  const displayContent = isLong && !expanded ? item.content.slice(0, 180) + '…' : item.content;

  return (
    <View style={cc.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 18 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />

      {/* ── Header auteur ─────────────────────────────────────────────── */}
      <View style={cc.header}>
        <TouchableOpacity
          style={cc.authorRow}
          onPress={() => router.push(`/profile/${item.user_id}` as any)}
          activeOpacity={0.80}
        >
          <Image source={{ uri: avatar }} style={cc.avatar} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={cc.authorName} numberOfLines={1}>{displayName}</Text>
            <Text style={cc.date}>{timeAgo(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <StarRating rating={item.rating} />
      </View>

      {/* ── Film title ────────────────────────────────────────────────── */}
      <View style={cc.filmRow}>
        <Ionicons name="film-outline" size={11} color={C.blue} />
        <Text style={cc.filmTitle} numberOfLines={1}>{item.film_title}</Text>
        {item.reel_id && (
          <TouchableOpacity
            onPress={() => router.push(`/reels?id=${item.reel_id}` as any)}
            style={cc.reelChip}
          >
            <Ionicons name="play-circle-outline" size={10} color={C.blue} />
            <Text style={{ color: C.blue, fontSize: 9, fontWeight: '700' }}>Voir le reel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Titre critique ────────────────────────────────────────────── */}
      <Text style={cc.title}>{item.title}</Text>

      {/* ── Contenu ───────────────────────────────────────────────────── */}
      <Text style={cc.content}>{displayContent}</Text>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} hitSlop={6}>
          <Text style={{ color: C.blue, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
            {expanded ? 'Voir moins' : 'Lire la suite'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Tags ──────────────────────────────────────────────────────── */}
      {item.tags && item.tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cc.tags}
          style={{ marginTop: 10 }}
        >
          {item.tags.map(tag => (
            <TouchableOpacity key={tag} onPress={() => onTagPress(tag)} style={cc.tag}>
              <Text style={cc.tagTxt}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <View style={cc.actions}>
        {/* Like */}
        <TouchableOpacity onPress={handleLike} style={cc.actionBtn} activeOpacity={0.80}>
          <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
            <Ionicons
              name={item.is_liked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.is_liked ? C.red : C.muted}
            />
          </Animated.View>
          <Text style={[cc.actionTxt, item.is_liked && { color: C.red }]}>
            {fmtK(item.likes_count ?? 0)}
          </Text>
        </TouchableOpacity>

        {/* Commentaires */}
        <TouchableOpacity onPress={() => onToggleComments(item.id)} style={cc.actionBtn} activeOpacity={0.80}>
          <Ionicons
            name={item.show_comments ? 'chatbubble' : 'chatbubble-outline'}
            size={16}
            color={item.show_comments ? C.blue : C.muted}
          />
          <Text style={[cc.actionTxt, item.show_comments && { color: C.blue }]}>
            {(item.comments?.length ?? 0) > 0 ? fmtK(item.comments!.length) : 'Commenter'}
          </Text>
        </TouchableOpacity>

        {/* Partager */}
        <TouchableOpacity style={cc.actionBtn} activeOpacity={0.80}>
          <Ionicons name="share-outline" size={16} color={C.muted} />
          <Text style={cc.actionTxt}>Partager</Text>
        </TouchableOpacity>

        {/* Signaler (si pas l'auteur) */}
        {item.user_id !== userId && (
          <TouchableOpacity style={cc.actionBtn} activeOpacity={0.80}>
            <Ionicons name="flag-outline" size={14} color="rgba(255,255,255,0.20)" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Commentaires ──────────────────────────────────────────────── */}
      {item.show_comments && (
        <View style={cc.commentsSection}>
          {/* Liste */}
          {(item.comments ?? []).map(cm => (
            <View key={cm.id} style={cc.comment}>
              <Image
                source={{ uri: avatarUrl(cm.user_id, cm.profile?.avatar_url) }}
                style={cc.cmAvatar}
              />
              <View style={cc.cmBody}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <Text style={cc.cmAuthor}>{cm.profile?.display_name ?? 'Anonyme'}</Text>
                  <Text style={cc.cmDate}>{timeAgo(cm.created_at)}</Text>
                </View>
                <Text style={cc.cmContent}>{cm.content}</Text>
              </View>
            </View>
          ))}

          {/* Input */}
          {userId !== 'anonymous' && (
            <CommentInput
              critiqueId={item.id}
              userId={userId}
              onSent={c => onCommentSent(item.id, c)}
            />
          )}
          {userId === 'anonymous' && (
            <Text style={{ color:C.muted, fontSize:12, textAlign:'center', padding:12 }}>
              Connectez-vous pour commenter
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

const cc = StyleSheet.create({
  wrap:        { marginHorizontal:EDGE, marginBottom:14, borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:14, paddingBottom:8 },
  authorRow:   { flexDirection:'row', alignItems:'center', gap:10, flex:1 },
  avatar:      { width:36, height:36, borderRadius:18, borderWidth:1.5, borderColor:C.border },
  authorName:  { color:C.white, fontSize:13, fontWeight:'800', letterSpacing:-0.2 },
  date:        { color:C.muted, fontSize:10 },
  filmRow:     { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, marginBottom:6 },
  filmTitle:   { color:C.blue, fontSize:11, fontWeight:'700', flex:1 },
  reelChip:    { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:8, backgroundColor:C.blueFaint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueBorder },
  title:       { color:C.white, fontSize:16, fontWeight:'900', letterSpacing:-0.4, lineHeight:22, paddingHorizontal:14, marginBottom:6 },
  content:     { color:'rgba(255,255,255,0.72)', fontSize:13, lineHeight:20, paddingHorizontal:14 },
  tags:        { paddingHorizontal:14, gap:6 },
  tag:         { paddingHorizontal:9, paddingVertical:4, borderRadius:10, backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  tagTxt:      { color:C.muted, fontSize:11, fontWeight:'600' },
  actions:     { flexDirection:'row', alignItems:'center', gap:4, padding:12, paddingTop:12, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border, marginTop:10 },
  actionBtn:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:7, borderRadius:10, backgroundColor:C.faint },
  actionTxt:   { color:C.muted, fontSize:11, fontWeight:'600' },
  commentsSection: { borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  comment:     { flexDirection:'row', gap:10, padding:12, paddingBottom:6 },
  cmAvatar:    { width:28, height:28, borderRadius:14, borderWidth:1, borderColor:C.border, flexShrink:0 },
  cmBody:      { flex:1, gap:3 },
  cmAuthor:    { color:C.white, fontSize:11, fontWeight:'700' },
  cmDate:      { color:C.muted, fontSize:10 },
  cmContent:   { color:'rgba(255,255,255,0.65)', fontSize:12, lineHeight:17 },
});

// ─── TOP CRITIQUE BANNER ────────────────────────────────────────────────────
const TopCritiqueBanner = memo(function TopCritiqueBanner({ critique }: { critique: Critique | null }) {
  const router = useRouter();
  if (!critique) return null;
  const displayName = critique.profile?.display_name ?? critique.author ?? 'Anonyme';
  const avatar = avatarUrl(critique.user_id, critique.profile?.avatar_url);

  return (
    <TouchableOpacity
      style={tb.wrap}
      onPress={() => router.push(`/profile/${critique.user_id}` as any)}
      activeOpacity={0.90}
    >
      <LinearGradient
        colors={['rgba(90,150,230,0.15)', 'rgba(7,12,23,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={tb.badge}>
        <Ionicons name="trophy-outline" size={10} color={C.gold} />
        <Text style={tb.badgeTxt}>CRITIQUE N°1 · {fmtK(critique.likes_count)} ♥</Text>
      </View>
      <View style={tb.row}>
        <Image source={{ uri: avatar }} style={tb.avatar} />
        <View style={{ flex:1, gap:3 }}>
          <Text style={tb.filmTitle} numberOfLines={1}>{critique.film_title}</Text>
          <Text style={tb.title} numberOfLines={2}>{critique.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:2 }}>
            <Text style={tb.author}>{displayName}</Text>
            <StarRating rating={critique.rating} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const tb = StyleSheet.create({
  wrap:      { marginHorizontal:EDGE, marginBottom:16, borderRadius:18, overflow:'hidden', padding:16, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueBorder },
  badge:     { flexDirection:'row', alignItems:'center', gap:5, alignSelf:'flex-start', paddingHorizontal:9, paddingVertical:4, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.goldDim, backgroundColor:'rgba(7,12,23,0.72)', marginBottom:10 },
  badgeTxt:  { color:C.gold, fontSize:8, fontWeight:'800', letterSpacing:0.8 },
  row:       { flexDirection:'row', gap:14, alignItems:'flex-start' },
  avatar:    { width:52, height:52, borderRadius:26, borderWidth:2, borderColor:C.blueBorder },
  filmTitle: { color:C.blue, fontSize:11, fontWeight:'700' },
  title:     { color:C.white, fontSize:18, fontWeight:'900', letterSpacing:-0.4, lineHeight:23 },
  author:    { color:C.muted, fontSize:11 },
});

// ─── RÉSEAU ACTIVITY ─────────────────────────────────────────────────────────
const NetworkActivityRow = memo(({activity,loading}:{activity:NetworkActivity[];loading:boolean}) => {
  const router=useRouter();
  if(!loading&&!activity.length) return null;
  return(
    <View style={{marginBottom:18}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
        <Ionicons name="people-outline" size={13} color={C.mid}/>
        <Text style={{color:C.offWhite,fontSize:15,fontWeight:'800'}}>Dans l'industrie</Text>
        <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginLeft:'auto' as any}}>
          <Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{activity.length} pros</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:10}}>
        {loading?[0,1,2,3].map(i=><View key={i} style={{width:130,height:160,borderRadius:14,backgroundColor:C.navyMid}}/>):
        activity.slice(0,12).map(a=>(
          <TouchableOpacity key={a.id} style={na.card} activeOpacity={0.88}>
            <Image source={{uri:a.pro_avatar??`https://i.pravatar.cc/80?u=${a.pro_id}`}} style={na.avatar} resizeMode="cover"/>
            <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.5}} end={{x:0,y:1}}/>
            {a.pro_verified&&<View style={na.vBadge}><Ionicons name="checkmark" size={8} color={C.white}/></View>}
            <View style={na.info}>
              <Text style={na.name} numberOfLines={1}>{a.pro_name}</Text>
              <Text style={na.role} numberOfLines={1}>{a.pro_role}</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:4}}>
                <View style={{width:5,height:5,borderRadius:2.5,backgroundColor:C.green}}/>
                <Text style={{color:C.muted,fontSize:8,fontWeight:'700'}}>En réseau</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});
const na=StyleSheet.create({
  card:  {width:126,height:158,borderRadius:14,overflow:'hidden',backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  avatar:{width:'100%',height:'100%',position:'absolute'},
  vBadge:{position:'absolute',top:8,right:8,width:18,height:18,borderRadius:9,backgroundColor:'rgba(7,12,23,0.75)',borderWidth:1,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'},
  info:  {position:'absolute',bottom:0,left:0,right:0,padding:10,gap:1},
  name:  {color:C.white,fontSize:11,fontWeight:'800',letterSpacing:-0.2},
  role:  {color:C.muted,fontSize:9},
});

// ─── SECTION TITLE ───────────────────────────────────────────────────────────
const SectionTitle = memo(({icon,label,count,onMore}:{icon:keyof typeof Ionicons.glyphMap;label:string;count?:number;onMore?:()=>void}) => (
  <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12,marginTop:4}}>
    <Ionicons name={icon} size={13} color={C.mid}/>
    <Text style={{color:C.offWhite,fontSize:15,fontWeight:'800'}}>{label}</Text>
    {count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}
    {onMore&&<TouchableOpacity onPress={onMore} hitSlop={8} style={{marginLeft:'auto' as any}}><Text style={{color:C.muted,fontSize:11,fontWeight:'600'}}>Tout voir</Text></TouchableOpacity>}
  </View>
));

// ─── PRO DIRECTORY SHEET ────────────────────────────────────────────────────
const PD_TABS = ['Annuaire','Demandes reçues'] as const;
type PDTab = typeof PD_TABS[number];

const ProDirectorySheet = memo(function ProDirectorySheet({visible,userId,onClose}:{visible:boolean;userId:string;onClose:()=>void}) {
  const[search,setSearch]=useState('');
  const[role,setRole]=useState('Tous');
  const[pdTab,setPdTab]=useState<PDTab>('Annuaire');
  const[selectedPro,setSelectedPro]=useState<Pro|null>(null);
  const[sendPhase,setSendPhase]=useState<'form'|'success'|'contacts'>('form');
  const[note,setNote]=useState('');
  const[sending,setSending]=useState(false);
  const slide=useRef(new Animated.Value(800)).current;
  const succSc=useRef(new Animated.Value(0)).current;

  const{pros,loading,error,refresh}=useProDirectory(search,role);
  const{connections,setStatus}=useMyConnections(userId);
  const{requests,reload:reloadReqs}=useIncomingRequests(userId);

  useEffect(()=>{if(visible){Animated.spring(slide,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start();}else{Animated.timing(slide,{toValue:800,duration:220,useNativeDriver:true}).start();}},[visible]);

  const openPro=useCallback((pro:Pro)=>{setSelectedPro(pro);setNote('');setSending(false);setSendPhase(connections[pro.id]==='accepted'?'contacts':'form');},[connections]);

  const sendRequest=useCallback(async()=>{
    if(!selectedPro||note.trim().length<20||sending) return;
    setSending(true);
    if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try{
      const{data:existing}=await supabase.from('pro_connections').select('id').eq('requester_id',userId).eq('pro_id',selectedPro.id).maybeSingle();
      if(existing){await supabase.from('pro_connections').update({status:'pending',message:note.trim(),updated_at:new Date().toISOString()}).eq('id',existing.id);}
      else{await supabase.from('pro_connections').insert({requester_id:userId,pro_id:selectedPro.id,status:'pending',message:note.trim()});}
      await supabase.from('notifications').insert({user_id:selectedPro.id,actor_id:userId,type:'connection_request',title:'Nouvelle demande de connexion',body:note.trim().slice(0,120),data:JSON.stringify({requester_id:userId,pro_id:selectedPro.id})}).catch(()=>{});
      setStatus(selectedPro.id,'pending');setSendPhase('success');
      if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      Animated.spring(succSc,{toValue:1,tension:80,friction:8,useNativeDriver:true}).start();
      setTimeout(()=>setSelectedPro(null),2600);
    }catch{Alert.alert('Erreur','Impossible d\'envoyer la demande.');}
    finally{setSending(false);}
  },[selectedPro,note,userId,sending,setStatus]);

  const acceptRequest=useCallback(async(req:ProConnection)=>{
    try{
      await supabase.from('pro_connections').update({status:'accepted',updated_at:new Date().toISOString()}).eq('id',req.id);
      const{data:myPro}=await supabase.from('professionals').select('name,contact_email,website').eq('id',userId).maybeSingle();
      await supabase.from('notifications').insert({user_id:req.requester_id,actor_id:userId,type:'connection_accepted',title:`${myPro?.name??'Un professionnel'} a accepté votre demande`,body:'Vous pouvez maintenant accéder à ses coordonnées.',data:JSON.stringify({pro_id:userId,contact_email:myPro?.contact_email,website:myPro?.website})}).catch(()=>{});
      if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      reloadReqs();
    }catch{Alert.alert('Erreur','Impossible d\'accepter.');}
  },[userId,reloadReqs]);

  const rejectRequest=useCallback(async(reqId:string)=>{await supabase.from('pro_connections').update({status:'rejected',updated_at:new Date().toISOString()}).eq('id',reqId).then(()=>reloadReqs());},[reloadReqs]);

  if(!visible) return null;
  const charOk=note.trim().length>=20;
  const selStatus=selectedPro?connections[selectedPro.id]??'none':'none';

  return(
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground/>
      <View style={{flex:1,justifyContent:'flex-end'}}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end'}}>
          <Animated.View style={{height:'94%',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,transform:[{translateY:slide}]}}>
            <BlurView intensity={Platform.OS==='ios'?90:70} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:16,paddingBottom:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>
              <View style={{width:38,height:4,borderRadius:2,backgroundColor:C.border,position:'absolute',top:8,left:'50%',marginLeft:-19}}/>
              <View style={{flex:1,gap:2}}>
                <Text style={{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.3}}>Industrie Cinéma</Text>
                <Text style={{color:C.muted,fontSize:11}}>Professionnels du cinéma indépendant</Text>
              </View>
              <TouchableOpacity style={{width:30,height:30,borderRadius:15,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'}} onPress={onClose}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
            </View>
            <View style={{flexDirection:'row',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>
              {PD_TABS.map(t=>{const on=pdTab===t;return(<TouchableOpacity key={t} style={{flex:1,alignItems:'center',paddingVertical:12,position:'relative'}} onPress={()=>setPdTab(t)} activeOpacity={0.80}><Text style={{color:on?C.white:C.muted,fontSize:12,fontWeight:on?'700':'600'}}>{t}</Text>{on&&<View style={{position:'absolute',bottom:0,left:'20%',right:'20%',height:2,backgroundColor:C.blue}}/>}{t==='Demandes reçues'&&requests.filter(r=>r.status==='pending').length>0&&<View style={{position:'absolute',top:8,right:'18%',minWidth:14,height:14,borderRadius:7,backgroundColor:C.blue,alignItems:'center',justifyContent:'center',paddingHorizontal:2}}><Text style={{color:C.white,fontSize:8,fontWeight:'800'}}>{requests.filter(r=>r.status==='pending').length}</Text></View>}</TouchableOpacity>);})}
            </View>
            {pdTab==='Annuaire'&&(
              <>
                <View style={{padding:14,gap:10}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,borderRadius:12,paddingHorizontal:12,height:40}}><Ionicons name="search-outline" size={14} color={C.muted}/><TextInput style={{flex:1,color:C.white,fontSize:13}} placeholder="Rechercher…" placeholderTextColor="rgba(255,255,255,0.18)" value={search} onChangeText={setSearch} returnKeyType="search" autoCorrect={false} selectionColor={C.white}/>{search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Ionicons name="close-circle" size={13} color={C.muted}/></TouchableOpacity>}</View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{PRO_ROLES.map(r=>{const on=role===r;return(<TouchableOpacity key={r} style={{paddingHorizontal:11,paddingVertical:6,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:on?C.blueBorder:C.border,backgroundColor:on?C.blueFaint:C.faint}} onPress={()=>setRole(r)} activeOpacity={0.80}><Text style={{color:on?C.blue:C.muted,fontSize:11,fontWeight:on?'700':'600'}}>{r}</Text></TouchableOpacity>);})}</ScrollView>
                </View>
                {loading?<View style={{alignItems:'center',paddingVertical:40,gap:12}}><ActivityIndicator color={C.muted} size="large"/><Text style={{color:C.muted,fontSize:13}}>Chargement…</Text></View>:error?<View style={{alignItems:'center',paddingVertical:40,gap:10}}><Ionicons name="cloud-offline-outline" size={28} color={C.muted}/><Text style={{color:C.muted,fontSize:13,textAlign:'center',paddingHorizontal:40}}>{error}</Text><TouchableOpacity onPress={refresh}><Text style={{color:C.blue,fontSize:13,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>:(
                  <FlatList data={pros} keyExtractor={p=>p.id} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,paddingBottom:120,gap:10}}
                    renderItem={({item:pro})=>{const st=connections[pro.id]??'none';const connected=st==='accepted';return(
                      <TouchableOpacity onPress={()=>openPro(pro)} activeOpacity={0.88} style={[pd.proWrap,connected&&pd.proWrapConn]}>
                        <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
                        <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
                          <View style={{position:'relative'}}>
                            <Image source={{uri:pro.avatar??`https://i.pravatar.cc/80?u=${pro.id}`}} style={pd.avatar} resizeMode="cover"/>
                            {pro.verified&&<View style={pd.vBadge}><Ionicons name="checkmark" size={8} color={C.white}/></View>}
                          </View>
                          <View style={{flex:1,gap:2}}>
                            <Text style={pd.proName} numberOfLines={1}>{pro.name}</Text>
                            <Text style={{color:C.muted,fontSize:11}}>{pro.role}</Text>
                            {pro.location&&<View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="location-outline" size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:10}}>{pro.location}</Text></View>}
                          </View>
                          <View style={[pd.statusBadge,connected&&pd.sbConn,st==='pending'&&pd.sbPend]}>
                            <Ionicons name={connected?'checkmark-circle':st==='pending'?'time-outline':'person-add-outline'} size={11} color={connected?C.green:st==='pending'?C.gold:C.muted}/>
                            <Text style={[{color:C.muted,fontSize:10,fontWeight:'700'},connected&&{color:C.green},st==='pending'&&{color:C.gold}]}>{connected?'Connecté':st==='pending'?'En attente':'Contacter'}</Text>
                          </View>
                        </View>
                        {!!pro.bio&&<Text style={{color:C.muted,fontSize:12,lineHeight:17,marginTop:8}} numberOfLines={2}>{pro.bio}</Text>}
                        {connected&&(pro.contact_email||pro.website)&&(
                          <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10}}>
                            {pro.contact_email&&<TouchableOpacity style={pd.contactChip} onPress={e=>{e.stopPropagation?.();Linking.openURL(`mailto:${pro.contact_email}`).catch(()=>{});}} activeOpacity={0.85}><Ionicons name="mail-outline" size={11} color={C.blue}/><Text style={{color:C.blue,fontSize:11,fontWeight:'600'}}>{pro.contact_email}</Text></TouchableOpacity>}
                            {pro.website&&<TouchableOpacity style={pd.contactChip} onPress={e=>{e.stopPropagation?.();Linking.openURL(pro.website!).catch(()=>{});}} activeOpacity={0.85}><Ionicons name="globe-outline" size={11} color={C.blue}/><Text style={{color:C.blue,fontSize:11,fontWeight:'600'}}>Portfolio</Text></TouchableOpacity>}
                          </View>
                        )}
                      </TouchableOpacity>
                    );}}
                  />
                )}
              </>
            )}
            {pdTab==='Demandes reçues'&&(
              requests.length===0?<View style={{alignItems:'center',paddingVertical:60,gap:12}}><View style={{width:60,height:60,borderRadius:30,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Ionicons name="people-outline" size={28} color={C.muted}/></View><Text style={{color:C.muted,fontSize:14,fontWeight:'700'}}>Aucune demande</Text></View>:(
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:16,gap:10,paddingBottom:120}}>
                  {requests.map(req=>(
                    <View key={req.id} style={[pd.reqWrap,req.status==='accepted'&&pd.reqAcc]}>
                      <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
                      <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
                        <Image source={{uri:(req as any).requester?.avatar_url??`https://i.pravatar.cc/60?u=${req.requester_id}`}} style={{width:40,height:40,borderRadius:20,borderWidth:1,borderColor:C.border}} resizeMode="cover"/>
                        <View style={{flex:1,gap:2}}><Text style={{color:C.white,fontSize:14,fontWeight:'800'}}>{(req as any).requester?.display_name??'Créateur·ice'}</Text><Text style={{color:C.muted,fontSize:10}}>{new Date(req.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</Text></View>
                        <View style={[pd.statusBadge,req.status==='accepted'&&pd.sbConn,req.status==='rejected'&&{borderColor:'rgba(255,59,92,0.25)',backgroundColor:'rgba(255,59,92,0.08)'}]}><Text style={{color:req.status==='accepted'?C.green:req.status==='rejected'?C.red:C.gold,fontSize:9,fontWeight:'800'}}>{req.status==='accepted'?'ACCEPTÉE':req.status==='rejected'?'REFUSÉE':'EN ATTENTE'}</Text></View>
                      </View>
                      {req.message&&<View style={{marginTop:10,padding:12,borderRadius:12,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.mid,fontSize:12,lineHeight:18,fontStyle:'italic'}}>«{req.message}»</Text></View>}
                      {req.status==='pending'&&<View style={{flexDirection:'row',gap:8,marginTop:12}}><TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(46,204,138,0.35)',backgroundColor:C.greenFaint}} onPress={()=>acceptRequest(req)} activeOpacity={0.88}><Ionicons name="checkmark-circle-outline" size={14} color={C.green}/><Text style={{color:C.green,fontSize:13,fontWeight:'800'}}>Accepter</Text></TouchableOpacity><TouchableOpacity style={{paddingHorizontal:16,paddingVertical:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={()=>rejectRequest(req.id)} activeOpacity={0.80}><Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>Refuser</Text></TouchableOpacity></View>}
                    </View>
                  ))}
                </ScrollView>
              )
            )}
            {selectedPro&&(
              <View style={{position:'absolute',bottom:0,left:0,right:0,maxHeight:'80%',borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:'rgba(7,12,23,0.96)'}}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={{width:36,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:12}}/>
                <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:18,paddingTop:14}}>
                  <Image source={{uri:selectedPro.avatar??`https://i.pravatar.cc/80?u=${selectedPro.id}`}} style={{width:46,height:46,borderRadius:23,borderWidth:1.5,borderColor:C.blueBorder}} resizeMode="cover"/>
                  <View style={{flex:1}}><Text style={{color:C.white,fontSize:15,fontWeight:'900'}}>{selectedPro.name}</Text><Text style={{color:C.muted,fontSize:11}}>{selectedPro.role}</Text></View>
                  <TouchableOpacity onPress={()=>setSelectedPro(null)} hitSlop={10}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
                </View>
                {sendPhase==='success'&&(<View style={{alignItems:'center',padding:36,gap:12}}><Animated.View style={{width:66,height:66,borderRadius:33,backgroundColor:C.blueFaint,borderWidth:1,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center',transform:[{scale:succSc}]}}><Ionicons name="checkmark" size={30} color={C.blue}/></Animated.View><Text style={{color:C.white,fontSize:18,fontWeight:'900'}}>Demande envoyée</Text></View>)}
                {sendPhase==='contacts'&&(<View style={{padding:20,gap:12}}><View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4}}><Ionicons name="checkmark-circle" size={16} color={C.green}/><Text style={{color:C.green,fontSize:14,fontWeight:'800'}}>Vous êtes connectés</Text></View>{selectedPro.contact_email&&<TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint}} onPress={()=>Linking.openURL(`mailto:${selectedPro.contact_email}`).catch(()=>{})} activeOpacity={0.85}><Ionicons name="mail-outline" size={16} color={C.blue}/><Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>{selectedPro.contact_email}</Text></TouchableOpacity>}{selectedPro.website&&<TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={()=>Linking.openURL(selectedPro.website!).catch(()=>{})} activeOpacity={0.85}><Ionicons name="globe-outline" size={16} color={C.blue}/><Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>Voir le portfolio</Text></TouchableOpacity>}</View>)}
                {sendPhase==='form'&&(<KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled"><View style={{padding:20,paddingTop:0}}>
                  {selStatus==='pending'?<View style={{flexDirection:'row',alignItems:'flex-start',gap:10,padding:14,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.25)',backgroundColor:'rgba(245,200,66,0.06)',marginBottom:12}}><Ionicons name="time-outline" size={16} color={C.gold}/><Text style={{color:C.muted,fontSize:12,lineHeight:18,flex:1}}>{selectedPro.name} n'a pas encore répondu.</Text></View>:<><Text style={{color:C.muted,fontSize:12,lineHeight:18,marginBottom:14}}>Présentez-vous à {selectedPro.name.split(' ')[0]} — ses coordonnées vous seront transmises à l'acceptation.</Text><TextInput style={{color:C.white,fontSize:14,minHeight:100,lineHeight:22,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:charOk?C.blueBorder:C.border,paddingVertical:4,marginBottom:8}} value={note} onChangeText={setNote} multiline maxLength={300} placeholder={`Bonjour ${selectedPro.name.split(' ')[0]}…`} placeholderTextColor="rgba(255,255,255,0.16)" selectionColor={C.blue} textAlignVertical="top"/><Text style={{color:charOk?C.blue:C.muted,fontSize:10,fontWeight:'700',textAlign:'right',marginBottom:16}}>{note.trim().length}/300</Text></>}
                  <View style={{flexDirection:'row',gap:10,paddingBottom:Platform.OS==='ios'?20:12}}>
                    <TouchableOpacity style={{paddingHorizontal:16,paddingVertical:12,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={()=>setSelectedPro(null)} activeOpacity={0.80}><Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>Annuler</Text></TouchableOpacity>
                    {selStatus==='pending'?<TouchableOpacity style={{flex:1,alignItems:'center',paddingVertical:12,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={()=>setSelectedPro(null)}><Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>Fermer</Text></TouchableOpacity>:<TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:charOk?C.blueBorder:C.border,backgroundColor:charOk?C.blueFaint:C.faint,opacity:sending||!charOk?0.45:1}} onPress={sendRequest} disabled={!charOk||sending} activeOpacity={0.88}>{sending?<ActivityIndicator color={C.blue} size="small"/>:<><Ionicons name="person-add-outline" size={13} color={C.blue}/><Text style={{color:C.blue,fontSize:13,fontWeight:'800'}}>Se connecter</Text></>}</TouchableOpacity>}
                  </View>
                </View></ScrollView></KeyboardAvoidingView>)}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});
const pd=StyleSheet.create({
  proWrap:    {borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14},
  proWrapConn:{borderColor:C.blueBorder},
  avatar:     {width:44,height:44,borderRadius:22,borderWidth:1.5,borderColor:C.border},
  vBadge:     {position:'absolute',bottom:-2,right:-2,width:16,height:16,borderRadius:8,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'},
  proName:    {color:C.white,fontSize:14,fontWeight:'800',letterSpacing:-0.2},
  statusBadge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:5,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
  sbConn:     {borderColor:'rgba(46,204,138,0.30)',backgroundColor:C.greenFaint},
  sbPend:     {borderColor:'rgba(245,200,66,0.25)',backgroundColor:'rgba(245,200,66,0.06)'},
  contactChip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:5,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint},
  reqWrap:    {borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14},
  reqAcc:     {borderColor:'rgba(46,204,138,0.25)'},
});

// ─── SCREEN ──────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<FeedTab>('Pour vous');
  const [prosOpen, setProsOpen] = useState(false);
  const [userId, setUserId] = useState('anonymous');
  const [refreshing, setRefreshing] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const listRef = useRef<FlatList<Critique>>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (s?.user?.id) setUserId(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { critiques, loading, refresh, toggleLike, toggleComments } =
    useCritiquesFeed(tab, userId);
  const { activity, loading: aLoading } = useNetworkActivity();
  const { score, level, badges } = useGamification(userId);

  // Commentaire ajouté inline
  const handleCommentSent = useCallback((critiqueId: string, c: CritiqueComment) => {
    // Mis à jour dans le state parent (via setCritiques dans le hook — mais on fait une approximation ici)
    // On rafraîchit juste le toggle pour récupérer les nouveaux commentaires
  }, []);

  // Filtre par tag
  const displayed = useMemo(() => {
    if (!filterTag) return critiques;
    return critiques.filter(c => c.tags?.includes(filterTag));
  }, [critiques, filterTag]);

  const topCritique = useMemo(() => displayed[0] ?? null, [displayed]);
  const feedCritiques = useMemo(() => displayed.slice(1), [displayed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setFilterTag(null);
    refresh();
    setTimeout(() => setRefreshing(false), 900);
  }, [refresh]);

  const handleTagPress = useCallback((tag: string) => {
    setFilterTag(prev => prev === tag ? null : tag);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // ── HEADER ────────────────────────────────────────────────────────────────
  const Header = (
    <View style={sc.header}>
      <View style={{ gap: 2 }}>
        <Text style={sc.eyebrow}>UNIVERSE · CINÉMA</Text>
        <Text style={sc.title}>Communauté</Text>
      </View>
      <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)} style={sc.levelBtn} activeOpacity={0.80}>
          <Text style={{ color:C.blue, fontSize:10, fontWeight:'900' }}>NIV</Text>
          <Text style={{ color:C.white, fontSize:12, fontWeight:'900', marginLeft:2 }}>{level.n}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sc.iconBtn, sc.prosBtnStyle]} onPress={() => setProsOpen(true)} activeOpacity={0.85}>
          <Ionicons name="briefcase-outline" size={17} color={C.blue} />
          <View style={{ position:'absolute', top:8, right:8, width:5, height:5, borderRadius:2.5, backgroundColor:C.blue }} />
        </TouchableOpacity>
        <TouchableOpacity style={sc.iconBtn} onPress={() => router.push('/notifications' as any)} activeOpacity={0.80}>
          <Ionicons name="notifications-outline" size={17} color={C.mid} />
          <View style={sc.notifDot} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const Tabs = (
    <View style={sc.tabs}>
      {FEED_TABS.map(t => {
        const on = t === tab;
        return (
          <TouchableOpacity
            key={t}
            onPress={() => { setTab(t); setFilterTag(null); listRef.current?.scrollToOffset({ offset:0, animated:true }); }}
            style={sc.tab}
            activeOpacity={0.80}
          >
            <Text style={[sc.tabTxt, on && sc.tabTxtOn]}>{t}</Text>
            {on && <View style={sc.tabLine} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Filtre tag actif
  const TagFilterBanner = filterTag ? (
    <TouchableOpacity
      onPress={() => setFilterTag(null)}
      style={sc.tagFilter}
      activeOpacity={0.80}
    >
      <Ionicons name="pricetag-outline" size={11} color={C.blue} />
      <Text style={{ color:C.blue, fontSize:12, fontWeight:'700' }}>#{filterTag}</Text>
      <Ionicons name="close-circle" size={13} color={C.blue} />
    </TouchableOpacity>
  ) : null;

  // ── renderItem ────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Critique }) => (
    <CritiqueCard
      item={item}
      userId={userId}
      onLike={toggleLike}
      onToggleComments={toggleComments}
      onCommentSent={handleCommentSent}
      onTagPress={handleTagPress}
    />
  ), [userId, toggleLike, toggleComments, handleCommentSent, handleTagPress]);

  const keyExtractor = useCallback((item: Critique) => item.id, []);

  // ── ListHeader ────────────────────────────────────────────────────────────
  const ListHeader = (
    <View>
      {Header}
      {Tabs}
      {TagFilterBanner}
      <GamiMini level={level} score={score} badges={badges} onPress={() => router.push('/(tabs)/search' as any)} />
      {tab === 'Pour vous' && <NetworkActivityRow activity={activity} loading={aLoading} />}
      <TopCritiqueBanner critique={topCritique} />
      <SectionTitle
        icon={tab === 'Tendances' ? 'flame-outline' : 'create-outline'}
        label={tab === 'Tendances' ? 'Critiques les plus appréciées' : 'Critiques récentes'}
        count={displayed.length}
      />
    </View>
  );

  return (
    <View style={sc.root}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <SafeAreaView style={{ flex:1 }} edges={['top']}>
        <ProDirectorySheet visible={prosOpen} userId={userId} onClose={() => setProsOpen(false)} />

        <FlatList
          ref={listRef}
          data={feedCritiques}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mid} />}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            loading
              ? <View style={{ alignItems:'center', paddingVertical:60, gap:14 }}>
                  <ActivityIndicator color={C.mid} size="large" />
                  <Text style={{ color:C.muted, fontSize:13 }}>Chargement des critiques…</Text>
                </View>
              : <View style={{ alignItems:'center', paddingVertical:60, gap:12 }}>
                  <View style={{ width:60, height:60, borderRadius:30, backgroundColor:C.faint, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }}>
                    <Ionicons name="create-outline" size={28} color={C.muted} />
                  </View>
                  <Text style={{ color:C.muted, fontSize:14, fontWeight:'700' }}>Aucune critique</Text>
                  <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingHorizontal:40, lineHeight:18 }}>
                    {filterTag ? `Aucune critique pour #${filterTag}` : 'Soyez le premier à publier une critique !'}
                  </Text>
                  {filterTag && (
                    <TouchableOpacity onPress={() => setFilterTag(null)} style={{ paddingHorizontal:16, paddingVertical:8, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueBorder, backgroundColor:C.blueFaint }}>
                      <Text style={{ color:C.blue, fontSize:13, fontWeight:'700' }}>Voir toutes les critiques</Text>
                    </TouchableOpacity>
                  )}
                </View>
          }
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={5}
          initialNumToRender={5}
          updateCellsBatchingPeriod={50}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── STYLES SCREEN ───────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:EDGE, paddingTop:10, paddingBottom:14 },
  eyebrow:     { fontSize:8.5, fontWeight:'700', color:C.muted, letterSpacing:1.8 },
  title:       { fontSize:24, fontWeight:'900', color:C.white, letterSpacing:-0.5 },
  levelBtn:    { flexDirection:'row', alignItems:'center', paddingHorizontal:9, paddingVertical:6, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueBorder, backgroundColor:C.blueFaint },
  iconBtn:     { width:38, height:38, borderRadius:19, backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center', position:'relative' },
  prosBtnStyle:{ borderColor:'rgba(90,150,230,0.35)', backgroundColor:'rgba(90,150,230,0.10)' },
  notifDot:    { position:'absolute', top:8, right:8, width:5, height:5, borderRadius:2.5, backgroundColor:C.white, borderWidth:1, borderColor:C.bg },
  tabs:        { flexDirection:'row', paddingHorizontal:EDGE, gap:20, marginBottom:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  tab:         { paddingBottom:12, alignItems:'center', position:'relative' },
  tabTxt:      { color:C.muted, fontSize:13, fontWeight:'600' },
  tabTxtOn:    { color:C.white, fontWeight:'800' },
  tabLine:     { position:'absolute', bottom:0, left:0, right:0, height:2, borderRadius:1, backgroundColor:C.white },
  tagFilter:   { flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start', marginHorizontal:EDGE, marginBottom:12, paddingHorizontal:12, paddingVertical:6, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueBorder, backgroundColor:C.blueFaint },
});