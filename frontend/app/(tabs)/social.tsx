/**
 * app/(tabs)/social.tsx
 *
 * Mini réseau social Universe — Cinéma Indépendant
 *
 *  CARDS     : CompactPostCard (liste) + GridPostCard (grille 2 col.)
 *              Portrait-style comme search.tsx, image + overlay, cliquables
 *  REAL-TIME : INSERT + UPDATE sur community_posts → likes/shares live
 *  TABS      : Pour vous (liste compacte) · Tendances (grille) · Pros
 *  PROS      : Connexion LinkedIn Premium (ConnectionRequestModal)
 *  COMPOSE   : Modal 4 étapes image+critique
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
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system';
import * as Haptics       from 'expo-haptics';
import { decode }         from 'base64-arraybuffer';
import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const EDGE   = 18;
const COL_GAP = 10;
const GRID_W  = (W - EDGE * 2 - COL_GAP) / 2;

const C = {
  bg0:       '#020810',
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
  white:     '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TONE_KEYS = ['analyse','coup de coeur','deception','reflexion','détente','neutre','mitigé','enthousiaste'] as const;
type Tone = typeof TONE_KEYS[number];
const TONES: { key:Tone; label:string; icon:string; color:string }[] = [
  {key:'analyse',       label:'Analyse',      icon:'flask-outline',        color:C.blue    },
  {key:'coup de coeur', label:'Coup de cœur', icon:'heart-outline',        color:C.red     },
  {key:'deception',     label:'Déception',    icon:'thunderstorm-outline', color:C.gold    },
  {key:'reflexion',     label:'Réflexion',    icon:'bulb-outline',         color:'#A8C8F0' },
  {key:'détente',       label:'Détente',      icon:'cafe-outline',         color:'#86EEFF' },
  {key:'neutre',        label:'Neutre',       icon:'ellipse-outline',      color:C.textSec },
  {key:'mitigé',        label:'Mitigé',       icon:'remove-outline',       color:C.textSec },
  {key:'enthousiaste',  label:'Enthousiaste', icon:'star-outline',         color:C.gold    },
];
const GENRES_LIST = ['Drame','Thriller','Sci-Fi','Documentaire','Animation','Court métrage','Expérimental','Biopic'] as const;
const ASPECTS     = ['Photographie','Musique','Scénario','Montage','Interprétation','Rythme','Atmosphère','Décors'];
const FEED_TABS   = ['Pour vous','Tendances','Pros'] as const;
type FeedTab = typeof FEED_TABS[number];
const MIN_BODY = 80, POSTS_LIMIT = 40, WORKS_LIMIT = 50;
const PRO_ROLES = ['Tous','Réalisateur·ice','Producteur·ice','Acteur·ice','Scénariste','Dir. photo','Compositeur·ice','Monteur·euse','Distributeur·ice'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type ConnStatus = 'none'|'pending'|'accepted'|'rejected';
interface SupabasePost {
  id:string; user_id:string; work_id:number|null; work_title:string; work_year:string;
  work_director:string; work_genre:string; rating:number; body:string;
  image_url:string|null; image_valid:boolean|null; tags:string[]|null;
  tone:string|null; likes_count:number|null; shares_count:number|null; created_at:string;
  profiles?:{display_name:string;avatar_url:string}|null;
}
interface Post {
  id:string; userId:string; userName:string; avatar:string; timeAgo:string;
  content:string; likes:number; shares:number; workId:number;
  work_title:string; work_year:string; work_director:string; work_genre:string;
  rating:number; image_url:string; tags:string[]; tone:Tone;
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
interface ProConnection { id:string; pro_id:string; status:ConnStatus; message:string|null; created_at:string }
interface CForm { workTitle:string;workYear:string;workDirector:string;workGenre:string;rating:number;tone:Tone|null;body:string;tags:string[];imageUri:string;imageUrl:string;imageValid:boolean }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtAgo(iso:string): string {
  const s = (Date.now()-new Date(iso).getTime())/1000;
  if(s<60)    return "à l'instant";
  if(s<3600)  return `${Math.floor(s/60)} min`;
  if(s<86400) return `${Math.floor(s/3600)} h`;
  return `${Math.floor(s/86400)} j`;
}
function fmtK(n:number): string {
  if(n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if(n>=1_000)     return `${(n/1_000).toFixed(1)}K`;
  return `${n}`;
}
function resolveWorkImage(id:number, image:string|null): string {
  if(!image) return `https://picsum.photos/seed/work_${id}/800/500`;
  if(image.startsWith('http')) return image;
  try { return supabase.storage.from('community-images').getPublicUrl(image).data.publicUrl; }
  catch { return `https://picsum.photos/seed/work_${id}/800/500`; }
}
function computeWorkScore(w:Work): number {
  const d=(Date.now()-new Date(w.created_at).getTime())/86_400_000;
  return Math.round(w.likes*1.5+(w.comments??0)*1.2+Math.max(0,60-d)*2+(w.is_original?40:0)+(w.duration!=null&&w.duration<30?20:0));
}
function mapPost(r:SupabasePost): Post {
  const tone:Tone = (r.tone&&(TONE_KEYS as readonly string[]).includes(r.tone))?(r.tone as Tone):'analyse';
  return {
    id:r.id, userId:r.user_id,
    userName:r.profiles?.display_name??'Cinéphile',
    avatar:r.profiles?.avatar_url??`https://i.pravatar.cc/80?u=${r.user_id}`,
    timeAgo:fmtAgo(r.created_at),
    content:r.body??'', likes:r.likes_count??0, shares:r.shares_count??0,
    workId:r.work_id??0, work_title:r.work_title??'', work_year:r.work_year??'',
    work_director:r.work_director??'', work_genre:r.work_genre??'',
    rating:r.rating??0, image_url:r.image_url??'',
    tags:Array.isArray(r.tags)?r.tags:[], tone,
  };
}
const FEED_FIELDS = 'id,user_id,work_id,work_title,work_year,work_director,work_genre,rating,body,image_url,tags,tone,likes_count,shares_count,created_at';

// ─────────────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────────────
async function dbToggleLike(postId:string, userId:string, was:boolean) {
  if(was){ await supabase.from('post_likes').delete().match({post_id:postId,user_id:userId}); await supabase.rpc('decrement_likes',{pid:postId}); }
  else   { await supabase.from('post_likes').insert({post_id:postId,user_id:userId}); await supabase.rpc('increment_likes',{pid:postId}); }
}
async function dbRecordShare(postId:string, userId:string, platform:string) {
  await supabase.from('post_shares').insert({post_id:postId,user_id:userId,platform});
}
async function dbPublishPost(payload:any): Promise<string|null> {
  try {
    let uid=(await supabase.auth.getSession()).data.session?.user?.id;
    if(!uid) uid=(await supabase.auth.signInAnonymously()).data.session?.user?.id;
    if(!uid) return null;
    const{data,error}=await supabase.from('community_posts').insert({...payload,user_id:uid}).select('id').single();
    if(error)throw error;
    return(data as any)?.id??null;
  } catch{return null;}
}
async function uploadImage(localUri:string): Promise<string|null> {
  try {
    const isBlob=localUri.startsWith('blob:');
    const ext=['jpg','jpeg','png','webp'].includes(localUri.split('.').pop()?.toLowerCase()??'')?localUri.split('.').pop()!.toLowerCase():'jpg';
    const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
    const path=`posts/post_${Date.now()}.${ext}`;
    let payload:ArrayBuffer;
    if(Platform.OS==='web'||isBlob) payload=await(await fetch(localUri)).arrayBuffer();
    else payload=decode(await FileSystem.readAsStringAsync(localUri,{encoding:'base64'}));
    const{data,error}=await supabase.storage.from('community-images').upload(path,payload,{contentType:mime,upsert:false});
    if(error)throw error;
    return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;
  } catch{return null;}
}
async function dbSendConnection(proId:string, userId:string, message:string): Promise<{ok:boolean;error?:string}> {
  try {
    const{error}=await supabase.from('pro_connections').upsert({requester_id:userId,pro_id:proId,status:'pending',message:message.trim(),updated_at:new Date().toISOString()},{onConflict:'requester_id,pro_id'});
    return error?{ok:false,error:error.message}:{ok:true};
  } catch(e:any){return{ok:false,error:e?.message};}
}
async function dbFetchConnections(userId:string): Promise<ProConnection[]> {
  const{data}=await supabase.from('pro_connections').select('id,pro_id,status,message,created_at').eq('requester_id',userId);
  return(data??[])as ProConnection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function usePostsFeed(tab:FeedTab) {
  const[posts,   setPosts]   = useState<Post[]>([]);
  const[loading, setLoading] = useState(true);
  const[error,   setError]   = useState<string|null>(null);
  const[rk,      setRk]      = useState(0);
  const refresh = useCallback(()=>setRk(k=>k+1),[]);

  useEffect(()=>{
    if(tab==='Pros'){setLoading(false);return;}
    let dead=false; setLoading(true); setError(null);
    supabase.from('community_posts_enriched').select(FEED_FIELDS)
      .order('created_at',{ascending:false}).limit(POSTS_LIMIT)
      .then(({data,error:err})=>{
        if(dead)return;
        if(err){setError('Impossible de charger le feed.');setLoading(false);return;}
        setPosts((data??[]).filter(r=>r&&'id'in r).map(r=>mapPost(r as SupabasePost)));
        setLoading(false);
      });
    return()=>{dead=true;};
  },[tab,rk]);

  // ★ Realtime — nouveaux posts + likes live
  useEffect(()=>{
    if(tab==='Pros') return;
    const ts=Date.now();
    const ch = supabase.channel(`social_rt_${ts}`)
      // Nouveau post
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_posts'},
        async(payload)=>{
          const{data}=await supabase.from('community_posts').select(FEED_FIELDS).eq('id',payload.new.id).single();
          if(!data)return;
          const p=mapPost(data as unknown as SupabasePost);
          setPosts(prev=>prev.some(x=>x.id===p.id)?prev:[p,...prev]);
        })
      // ★ Likes / shares mis à jour en temps réel
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'community_posts'},
        ({new:row})=>{
          setPosts(prev=>prev.map(p=>p.id===row.id?{...p,likes:row.likes_count??p.likes,shares:row.shares_count??p.shares}:p));
        })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[tab]);

  const toggleLike = useCallback(async(postId:string, userId:string, was:boolean)=>{
    setPosts(prev=>prev.map(p=>p.id!==postId?p:{...p,likes:p.likes+(was?-1:1)}));
    try{await dbToggleLike(postId,userId,was);}
    catch{setPosts(prev=>prev.map(p=>p.id!==postId?p:{...p,likes:p.likes+(was?1:-1)}));}
  },[]);

  return{posts,loading,error,refresh,toggleLike};
}

function useWorksAlgorithm() {
  const[works,setWorks]=useState<Work[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    let dead=false;
    supabase.from('works').select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at').order('likes',{ascending:false}).limit(WORKS_LIMIT)
      .then(({data})=>{
        if(dead)return;
        setWorks(((data??[])as Work[]).map(w=>({...w,score:computeWorkScore(w)})).sort((a,b)=>(b.score??0)-(a.score??0)));
        setLoading(false);
      });
    return()=>{dead=true;};
  },[]);
  return{works,loading};
}

function useProDirectory(search:string, role:string) {
  const[pros,setPros]=useState<Pro[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      let q=supabase.from('professionals').select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to,created_at').order('verified',{ascending:false}).order('name',{ascending:true}).limit(80);
      if(role&&role!=='Tous') q=q.eq('role',role);
      if(search.trim())       q=q.ilike('name',`%${search.trim()}%`);
      const{data,error:err}=await q;
      if(err)throw err;
      setPros((data??[])as Pro[]);
    }catch{setError('Impossible de charger le répertoire.');}
    finally{setLoading(false);}
  },[search,role]);
  useEffect(()=>{load();},[load]);
  return{pros,loading,error,refresh:load};
}

function useConnections(userId:string) {
  const[connections,setConnections]=useState<Record<string,ConnStatus>>({});
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!userId||userId==='anonymous'){setLoading(false);return;}
    dbFetchConnections(userId).then(rows=>{
      const map:Record<string,ConnStatus>={};
      rows.forEach(r=>{map[r.pro_id]=r.status;});
      setConnections(map);setLoading(false);
    });
  },[userId]);
  useEffect(()=>{
    if(!userId||userId==='anonymous') return;
    const ch=supabase.channel(`pro_conn_${userId}_${Date.now()}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'pro_connections'},
        ({new:row})=>{const r=row as ProConnection;if(r?.pro_id)setConnections(prev=>({...prev,[r.pro_id]:r.status}));})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[userId]);
  const setStatus=useCallback((proId:string,status:ConnStatus)=>setConnections(prev=>({...prev,[proId]:status})),[]);
  return{connections,loading,setStatus};
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface ICtx { liked:Record<string,boolean>;saved:Record<string,boolean>;toggleLike:(id:string,uid:string)=>void;toggleSave:(id:string)=>void;sharePost:(id:string,title:string,uid:string)=>Promise<void> }
const ICtx = createContext<ICtx>({liked:{},saved:{},toggleLike:()=>{},toggleSave:()=>{},sharePost:async()=>{}});

function InteractionProvider({children,onToggleLike}:{children:React.ReactNode;onToggleLike:(id:string,uid:string,was:boolean)=>void}) {
  const[liked,setLiked]=useState<Record<string,boolean>>({});
  const[saved,setSaved]=useState<Record<string,boolean>>({});
  const toggleLike=useCallback((id:string,uid:string)=>{const was=!!liked[id];setLiked(p=>({...p,[id]:!was}));onToggleLike(id,uid,was);},[liked,onToggleLike]);
  const toggleSave=useCallback((id:string)=>setSaved(p=>({...p,[id]:!p[id]})),[]);
  const sharePost=useCallback(async(id:string,title:string,uid:string)=>{
    try{const r=await Share.share({message:`Découvrez cette critique de "${title}" sur Universe !`});if(r.action===Share.sharedAction)await dbRecordShare(id,uid,r.activityType??'unknown');}catch{}
  },[]);
  return <ICtx.Provider value={{liked,saved,toggleLike,toggleSave,sharePost}}>{children}</ICtx.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING (compact)
// ─────────────────────────────────────────────────────────────────────────────
const StarRow = memo(function StarRow({value,size=11}:{value:number;size?:number}) {
  return(
    <View style={{flexDirection:'row',gap:1}}>
      {[1,2,3,4,5].map(s=>(
        <Ionicons key={s} name={value>=s?'star':value>=s-0.5?'star-half':'star-outline'} size={size} color={value>=s||value>=s-0.5?C.gold:'rgba(255,255,255,0.20)'}/>
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ COMPACT POST CARD — portrait-style, feed liste
// ─────────────────────────────────────────────────────────────────────────────
const THUMB_W = 92;
const THUMB_H = 122;

const CompactPostCard = memo(function CompactPostCard({post,userId}:{post:Post;userId:string}) {
  const router = useRouter();
  const {liked,saved,toggleLike,toggleSave,sharePost} = useContext(ICtx);
  const isLiked = !!liked[post.id];
  const isSaved = !!saved[post.id];
  const likeAnim = useRef(new Animated.Value(1)).current;

  const toneInfo = useMemo(()=>TONES.find(t=>t.key===post.tone)??TONES[0],[post.tone]);
  const imgSrc   = useMemo(()=>post.image_url?{uri:post.image_url}:{uri:`https://picsum.photos/seed/${post.id}/400/600`},[post.image_url,post.id]);
  const goFilm   = useCallback(()=>{ if(post.workId) router.push(`/film/${post.workId}` as any); },[post.workId,router]);
  const goPost   = useCallback(()=>router.push(`/review/${post.id}` as any),[post.id,router]);

  const onLike = useCallback(()=>{
    Animated.sequence([
      Animated.spring(likeAnim,{toValue:1.4,tension:300,friction:7,useNativeDriver:true}),
      Animated.spring(likeAnim,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
    ]).start();
    if(Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    toggleLike(post.id,userId);
  },[post.id,userId,toggleLike,likeAnim]);

  return(
    <View style={cpc.wrap}>
      {/* Thumbnail cliquable → film */}
      <TouchableOpacity onPress={goFilm} activeOpacity={0.90} style={cpc.thumbWrap}>
        <Image source={imgSrc} style={cpc.thumb} resizeMode="cover"/>
        <LinearGradient colors={['rgba(2,8,16,0.08)','rgba(2,8,16,0.75)']} style={StyleSheet.absoluteFillObject}/>
        {/* Badge ton */}
        <View style={[cpc.toneBadge,{backgroundColor:`${toneInfo.color}22`,borderColor:`${toneInfo.color}40`}]}>
          <Ionicons name={toneInfo.icon as any} size={8} color={toneInfo.color}/>
        </View>
        {/* Note */}
        <View style={cpc.ratingBadge}>
          <Ionicons name="star" size={8} color={C.gold}/>
          <Text style={cpc.ratingTxt}>{post.rating.toFixed(1)}</Text>
        </View>
      </TouchableOpacity>

      {/* Contenu */}
      <TouchableOpacity style={cpc.content} onPress={goPost} activeOpacity={0.88}>
        {/* Œuvre */}
        <View style={cpc.workRow}>
          <Text style={cpc.workTitle} numberOfLines={1}>{post.work_title||'Œuvre inconnue'}</Text>
          {post.work_year&&<Text style={cpc.workYear}>{post.work_year}</Text>}
        </View>
        {post.work_genre.length>0&&<Text style={cpc.genre}>{post.work_genre}</Text>}
        <StarRow value={post.rating} size={10}/>

        {/* Extrait */}
        <Text style={cpc.excerpt} numberOfLines={3}>{post.content}</Text>

        {/* Auteur */}
        <View style={cpc.authorRow}>
          <Image source={{uri:post.avatar}} style={cpc.avi}/>
          <Text style={cpc.authorName} numberOfLines={1}>{post.userName}</Text>
          <Text style={cpc.timeAgo}>{post.timeAgo}</Text>
        </View>
      </TouchableOpacity>

      {/* Actions verticales */}
      <View style={cpc.actions}>
        <TouchableOpacity style={cpc.actionBtn} onPress={onLike} activeOpacity={0.78}>
          <Animated.View style={{transform:[{scale:likeAnim}]}}>
            <Ionicons name={isLiked?'heart':'heart-outline'} size={17} color={isLiked?C.red:'rgba(255,255,255,0.40)'}/>
          </Animated.View>
          {/* ★ Compteur live */}
          <Text style={[cpc.actionCount,isLiked&&{color:C.red}]}>{fmtK(post.likes+(isLiked?1:0))}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={cpc.actionBtn} onPress={goPost} activeOpacity={0.78}>
          <Ionicons name="chatbubble-outline" size={15} color="rgba(255,255,255,0.40)"/>
        </TouchableOpacity>

        <TouchableOpacity style={cpc.actionBtn} onPress={()=>sharePost(post.id,post.work_title,userId)} activeOpacity={0.78}>
          <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.40)"/>
          {post.shares>0&&<Text style={cpc.actionCount}>{fmtK(post.shares)}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={cpc.actionBtn} onPress={()=>toggleSave(post.id)} activeOpacity={0.78}>
          <Ionicons name={isSaved?'bookmark':'bookmark-outline'} size={16} color={isSaved?C.gold:'rgba(255,255,255,0.40)'}/>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const cpc = StyleSheet.create({
  wrap:      {flexDirection:'row',marginHorizontal:EDGE,marginBottom:12,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:C.border,backgroundColor:C.surf},
  thumbWrap: {width:THUMB_W,height:THUMB_H,position:'relative'},
  thumb:     {width:'100%',height:'100%'},
  toneBadge: {position:'absolute',top:7,left:7,width:20,height:20,borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:1},
  ratingBadge:{position:'absolute',bottom:7,left:5,flexDirection:'row',alignItems:'center',gap:2,paddingHorizontal:5,paddingVertical:2,borderRadius:7,backgroundColor:'rgba(2,8,16,0.72)'},
  ratingTxt: {color:C.gold,fontSize:8,fontWeight:'800'},
  content:   {flex:1,padding:11,gap:4,justifyContent:'space-between'},
  workRow:   {flexDirection:'row',alignItems:'center',gap:6},
  workTitle: {color:C.text,fontSize:12,fontWeight:'800',flex:1,letterSpacing:-0.2},
  workYear:  {color:C.textTert,fontSize:10,fontWeight:'600'},
  genre:     {color:C.blue,fontSize:9,fontWeight:'700',letterSpacing:0.3},
  excerpt:   {color:C.textSec,fontSize:11,lineHeight:16,fontStyle:'italic',flex:1},
  authorRow: {flexDirection:'row',alignItems:'center',gap:5},
  avi:       {width:16,height:16,borderRadius:8,borderWidth:1,borderColor:C.borderHi},
  authorName:{color:C.textSec,fontSize:9,fontWeight:'600',flex:1},
  timeAgo:   {color:C.textTert,fontSize:9},
  actions:   {width:36,alignItems:'center',justifyContent:'space-evenly',paddingVertical:8,borderLeftWidth:1,borderLeftColor:C.border},
  actionBtn: {alignItems:'center',gap:2,paddingVertical:4},
  actionCount:{color:'rgba(255,255,255,0.35)',fontSize:8,fontWeight:'700'},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ GRID POST CARD — 2 colonnes, portrait-style (Tendances)
// ─────────────────────────────────────────────────────────────────────────────
const GRID_H = 230;

const GridPostCard = memo(function GridPostCard({post,userId}:{post:Post;userId:string}) {
  const router  = useRouter();
  const {liked,toggleLike} = useContext(ICtx);
  const isLiked = !!liked[post.id];
  const likeAnim= useRef(new Animated.Value(1)).current;

  const toneInfo = useMemo(()=>TONES.find(t=>t.key===post.tone)??TONES[0],[post.tone]);
  const imgSrc   = useMemo(()=>post.image_url?{uri:post.image_url}:{uri:`https://picsum.photos/seed/${post.id}/400/600`},[post.image_url,post.id]);

  const onLike = useCallback(()=>{
    Animated.sequence([
      Animated.spring(likeAnim,{toValue:1.5,tension:300,friction:7,useNativeDriver:true}),
      Animated.spring(likeAnim,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
    ]).start();
    if(Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    toggleLike(post.id,userId);
  },[post.id,userId,toggleLike,likeAnim]);

  return(
    <TouchableOpacity
      style={gpc.wrap}
      onPress={()=>post.workId&&router.push(`/film/${post.workId}` as any)}
      onLongPress={()=>router.push(`/review/${post.id}` as any)}
      activeOpacity={0.88}
    >
      {/* Image plein fond */}
      <Image source={imgSrc} style={gpc.img} resizeMode="cover"/>
      <LinearGradient colors={['rgba(2,8,16,0.10)','rgba(2,8,16,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.2}} end={{x:0,y:1}}/>

      {/* Ton badge haut */}
      <View style={[gpc.toneBadge,{backgroundColor:`${toneInfo.color}1A`,borderColor:`${toneInfo.color}35`}]}>
        <Ionicons name={toneInfo.icon as any} size={9} color={toneInfo.color}/>
        <Text style={[gpc.toneTxt,{color:toneInfo.color}]}>{toneInfo.label}</Text>
      </View>

      {/* Meta bas */}
      <View style={gpc.meta}>
        {/* Catégorie */}
        {post.work_genre.length>0&&<Text style={gpc.genre}>{post.work_genre}</Text>}

        {/* Titre */}
        <Text style={gpc.title} numberOfLines={2}>{post.work_title||'Œuvre'}</Text>

        {/* Stars + note */}
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <StarRow value={post.rating} size={10}/>
          <Text style={gpc.ratingTxt}>{post.rating.toFixed(1)}</Text>
        </View>

        {/* Auteur + like live */}
        <View style={gpc.footer}>
          <Image source={{uri:post.avatar}} style={gpc.avi}/>
          <Text style={gpc.author} numberOfLines={1}>{post.userName}</Text>
          <TouchableOpacity onPress={onLike} activeOpacity={0.78} style={{flexDirection:'row',alignItems:'center',gap:3}}>
            <Animated.View style={{transform:[{scale:likeAnim}]}}>
              <Ionicons name={isLiked?'heart':'heart-outline'} size={13} color={isLiked?C.red:'rgba(255,255,255,0.55)'}/>
            </Animated.View>
            {/* ★ Compteur live */}
            <Text style={[gpc.likes,isLiked&&{color:C.red}]}>{fmtK(post.likes+(isLiked?1:0))}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const gpc = StyleSheet.create({
  wrap:    {width:GRID_W,height:GRID_H,borderRadius:16,overflow:'hidden',backgroundColor:C.navyMid,borderWidth:1,borderColor:C.border},
  img:     {position:'absolute',top:0,left:0,right:0,bottom:0},
  toneBadge:{position:'absolute',top:9,left:9,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:9,borderWidth:1},
  toneTxt: {fontSize:8,fontWeight:'800'},
  meta:    {position:'absolute',bottom:0,left:0,right:0,padding:11,gap:4},
  genre:   {color:'rgba(150,190,250,0.80)',fontSize:9,fontWeight:'700',letterSpacing:0.5,textTransform:'uppercase'},
  title:   {color:C.white,fontSize:12,fontWeight:'800',lineHeight:16,letterSpacing:-0.2},
  ratingTxt:{color:'rgba(255,255,255,0.55)',fontSize:9,fontWeight:'700'},
  footer:  {flexDirection:'row',alignItems:'center',gap:5,marginTop:2},
  avi:     {width:16,height:16,borderRadius:8,borderWidth:1,borderColor:C.borderHi},
  author:  {color:'rgba(255,255,255,0.55)',fontSize:9,flex:1},
  likes:   {color:'rgba(255,255,255,0.55)',fontSize:9,fontWeight:'700'},
});

// ─────────────────────────────────────────────────────────────────────────────
// WORK MINI CARD (Tendances header)
// ─────────────────────────────────────────────────────────────────────────────
const WK_W=142, WK_H=198;
const WorkMiniCard = memo(function WorkMiniCard({work,rank}:{work:Work;rank?:number}) {
  const router=useRouter();
  const uri=useMemo(()=>resolveWorkImage(work.id,work.image),[work.id,work.image]);
  const rc=rank===1?C.gold:rank===2?'#C0C0C0':rank===3?'#CD7F32':'rgba(255,255,255,0.35)';
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${work.id}` as any)} activeOpacity={0.88}>
      <View style={{width:WK_W,height:WK_H,borderRadius:14,overflow:'hidden',backgroundColor:C.navyMid}}>
        <Image source={{uri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(2,8,16,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/>
        <View style={{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:4,backgroundColor:work.is_original?C.navyBright:C.navyMid}}>
          <Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.3}}>{work.is_original?'ORIG':(work.category??'').slice(0,4).toUpperCase()}</Text>
        </View>
        {work.score!=null&&<View style={{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'rgba(2,8,16,0.72)',paddingHorizontal:5,paddingVertical:2.5,borderRadius:5}}>
          <Ionicons name="trending-up" size={7} color={C.green}/><Text style={{color:C.green,fontSize:7,fontWeight:'800'}}>{work.score}</Text>
        </View>}
        {rank!=null&&<Text style={{position:'absolute',bottom:28,right:4,fontSize:46,fontWeight:'900',letterSpacing:-4,opacity:0.90,color:rc,lineHeight:46}}>{rank}</Text>}
        <View style={{position:'absolute',bottom:7,left:8,right:8,gap:1}}>
          <Text style={{color:C.white,fontSize:10,fontWeight:'800',lineHeight:13}} numberOfLines={2}>{work.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
            <Ionicons name="heart" size={8} color={C.gold}/><Text style={{color:'rgba(255,255,255,0.55)',fontSize:9,fontWeight:'600'}}>{fmtK(work.likes??0)}</Text>
            {work.duration&&<><Text style={{color:C.textTert,fontSize:8}}>·</Text><Text style={{color:'rgba(255,255,255,0.45)',fontSize:9}}>{work.duration}m</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM BANNER (Tendances)
// ─────────────────────────────────────────────────────────────────────────────
const AlgorithmBanner = memo(function AlgorithmBanner({works}:{works:Work[]}) {
  const router=useRouter();
  const top=works[0];
  if(!top) return null;
  return(
    <TouchableOpacity style={ab.wrap} onPress={()=>router.push(`/film/${top.id}` as any)} activeOpacity={0.90}>
      <Image source={{uri:resolveWorkImage(top.id,top.image)}} style={StyleSheet.absoluteFillObject as any} resizeMode="cover"/>
      <LinearGradient colors={['rgba(2,8,16,0.25)','rgba(2,8,16,0.94)']} style={StyleSheet.absoluteFillObject}/>
      <View style={ab.content}>
        <View style={ab.badge}><Ionicons name="trending-up" size={10} color={C.green}/><Text style={ab.badgeTxt}>N°1 ALGORITHME UNIVERSE</Text></View>
        <Text style={ab.title} numberOfLines={2}>{top.title}</Text>
        <Text style={ab.meta}>{[top.director,String(top.year),top.genre].filter(Boolean).join(' · ')}</Text>
        <View style={{flexDirection:'row',gap:12,alignItems:'center'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={11} color={C.red}/><Text style={ab.stat}>{fmtK(top.likes??0)}</Text></View>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="trending-up" size={11} color={C.green}/><Text style={ab.stat}>Score {top.score}</Text></View>
          {top.is_original&&<View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:7,backgroundColor:C.blueDim,borderWidth:1,borderColor:C.borderBlue}}><Text style={{color:C.blue,fontSize:9,fontWeight:'800'}}>ORIGINAL</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
});
const ab = StyleSheet.create({
  wrap:    {marginHorizontal:EDGE,marginBottom:18,height:170,borderRadius:20,overflow:'hidden'},
  content: {position:'absolute',bottom:0,left:0,right:0,padding:16,gap:5},
  badge:   {flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start',backgroundColor:'rgba(46,204,138,0.18)',paddingHorizontal:9,paddingVertical:4,borderRadius:10,borderWidth:1,borderColor:'rgba(46,204,138,0.30)',marginBottom:2},
  badgeTxt:{color:C.green,fontSize:9,fontWeight:'800',letterSpacing:0.6},
  title:   {color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4,lineHeight:24},
  meta:    {color:'rgba(255,255,255,0.45)',fontSize:11},
  stat:    {color:C.textSec,fontSize:11,fontWeight:'600'},
});

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING ROW
// ─────────────────────────────────────────────────────────────────────────────
const TrendingRow = memo(function TrendingRow({works,loading}:{works:Work[];loading:boolean}) {
  const router=useRouter();
  return(
    <View style={{marginBottom:18}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,marginBottom:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name="trending-up" size={14} color={C.green}/><Text style={{color:C.text,fontSize:15,fontWeight:'800'}}>En vogue</Text></View>
        <TouchableOpacity onPress={()=>router.push('/search' as any)} hitSlop={8}><Text style={{color:C.blue,fontSize:12,fontWeight:'600'}}>Tout voir →</Text></TouchableOpacity>
      </View>
      {loading?(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:10}}>
          {[0,1,2,3].map(i=><View key={i} style={{width:WK_W,height:WK_H,borderRadius:14,backgroundColor:C.surf}}/>)}
        </ScrollView>
      ):(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE}}>
          {works.slice(0,10).map((w,i)=><WorkMiniCard key={w.id} work={w} rank={i+1}/>)}
        </ScrollView>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR SPOTLIGHT
// ─────────────────────────────────────────────────────────────────────────────
const CreatorSpotlight = memo(function CreatorSpotlight({posts}:{posts:Post[]}) {
  const router=useRouter();
  const top=useMemo(()=>{
    const m:Record<string,{name:string;avatar:string;likes:number;count:number}>={};
    posts.forEach(p=>{if(!m[p.userId])m[p.userId]={name:p.userName,avatar:p.avatar,likes:0,count:0};m[p.userId].likes+=p.likes;m[p.userId].count+=1;});
    return Object.entries(m).sort((a,b)=>b[1].likes-a[1].likes).slice(0,6);
  },[posts]);
  if(!top.length)return null;
  return(
    <View style={{marginBottom:18}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:10}}><Ionicons name="people-outline" size={14} color={C.gold}/><Text style={{color:C.text,fontSize:14,fontWeight:'800'}}>Top critiques</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:8}}>
        {top.map(([uid,info])=>(
          <TouchableOpacity key={uid} style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:C.surf,paddingVertical:8,paddingHorizontal:11,borderRadius:14,borderWidth:1,borderColor:C.border}} onPress={()=>router.push(`/user/${uid}` as any)} activeOpacity={0.80}>
            <Image source={{uri:info.avatar}} style={{width:30,height:30,borderRadius:15,borderWidth:1.5,borderColor:C.borderHi}}/>
            <View><Text style={{color:C.text,fontSize:11,fontWeight:'700',maxWidth:80}} numberOfLines={1}>{info.name}</Text><Text style={{color:C.textTert,fontSize:9}}>{fmtK(info.likes)} likes · {info.count} crit.</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GENRE RADAR
// ─────────────────────────────────────────────────────────────────────────────
const GenreRadar = memo(function GenreRadar({posts}:{posts:Post[]}) {
  const counts=useMemo(()=>{
    const m:Record<string,number>={};
    posts.forEach(p=>{if(p.work_genre)m[p.work_genre]=(m[p.work_genre]??0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);
  },[posts]);
  if(!counts.length)return null;
  const max=counts[0]?.[1]??1;
  return(
    <View style={{marginHorizontal:EDGE,marginBottom:18,borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.border}}>
      <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{padding:14}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:12}}><Ionicons name="pie-chart-outline" size={13} color={C.blue}/><Text style={{color:C.text,fontSize:13,fontWeight:'800'}}>Genres du moment</Text></View>
        {counts.map(([g,c])=>(
          <View key={g} style={{flexDirection:'row',alignItems:'center',gap:9,marginBottom:7}}>
            <Text style={{color:C.textSec,fontSize:11,fontWeight:'600',width:86}} numberOfLines={1}>{g}</Text>
            <View style={{flex:1,height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
              <View style={{height:'100%',borderRadius:3,backgroundColor:C.blue,width:`${(c/max)*100}%` as any}}/>
            </View>
            <Text style={{color:C.textTert,fontSize:10,fontWeight:'700',width:16,textAlign:'right'}}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// ★ PROS — Connexion professionnelle · Glass / Galaxy uniquement
// ═════════════════════════════════════════════════════════════════════════════

// Tokens glass (aucune couleur, transparence uniquement)
const G = {
  glass:       'rgba(255,255,255,0.04)',
  glassMd:     'rgba(255,255,255,0.07)',
  glassHi:     'rgba(255,255,255,0.11)',
  border:      'rgba(255,255,255,0.09)',
  borderHi:    'rgba(255,255,255,0.22)',
  borderFocus: 'rgba(255,255,255,0.55)',
  white:       '#FFFFFF',
  offWhite:    'rgba(255,255,255,0.80)',
  muted:       'rgba(255,255,255,0.36)',
  faint:       'rgba(255,255,255,0.10)',
  success:     '#22C55E',
  warn:        '#F59E0B',
  danger:      '#EF4444',
} as const;

// ── Statut badge ──────────────────────────────────────────────────────────────
const ProStatusBadge = memo(function ProStatusBadge({status}:{status:ConnStatus}) {
  if (status === 'none') return null;
  const cfg = {
    pending:  { icon:'time-outline'         as const, label:'En attente' },
    accepted: { icon:'checkmark-circle'     as const, label:'Connecté'   },
    rejected: { icon:'close-circle-outline' as const, label:'Refusé'     },
  }[status];
  return (
    <View style={psb.wrap}>
      <Ionicons name={cfg.icon} size={9} color={G.muted}/>
      <Text style={psb.txt}>{cfg.label}</Text>
    </View>
  );
});
const psb = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3,
          borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:G.border, backgroundColor:G.glass },
  txt:  { color:G.muted, fontSize:9, fontWeight:'700' },
});

// ── ProCard — glass pur ───────────────────────────────────────────────────────
const ProCard = memo(function ProCard({pro,status,onConnect}:{pro:Pro;status:ConnStatus;onConnect:(p:Pro)=>void}) {
  const connected = status === 'accepted';
  const pending   = status === 'pending';

  return (
    <View style={proc.wrap}>
      <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>

      <View style={proc.inner}>
        {/* Header */}
        <View style={proc.head}>
          <View style={proc.avatarWrap}>
            <Image
              source={{uri: pro.avatar ?? `https://i.pravatar.cc/120?u=${pro.id}`}}
              style={proc.avatar}
              resizeMode="cover"
            />
            {pro.verified && (
              <View style={proc.verifiedDot}>
                <Ionicons name="checkmark" size={8} color={G.white}/>
              </View>
            )}
          </View>

          <View style={{flex:1, gap:3}}>
            <Text style={proc.name} numberOfLines={1}>{pro.name}</Text>
            <Text style={proc.role} numberOfLines={1}>{pro.role}</Text>
            {pro.location && (
              <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                <Ionicons name="location-outline" size={9} color={G.muted}/>
                <Text style={proc.loc}>{pro.location}</Text>
              </View>
            )}
          </View>

          <ProStatusBadge status={status}/>
        </View>

        {/* Bio */}
        {!!pro.bio && (
          <Text style={proc.bio} numberOfLines={2}>{pro.bio}</Text>
        )}

        {/* Films chips */}
        {pro.films.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>
            {pro.films.slice(0,5).map(f => (
              <View key={f} style={proc.filmChip}>
                <Ionicons name="film-outline" size={8} color={G.muted}/>
                <Text style={proc.filmTxt} numberOfLines={1}>{f}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Open to chips */}
        {pro.open_to.length > 0 && (
          <View style={{flexDirection:'row', flexWrap:'wrap', gap:5}}>
            {pro.open_to.slice(0,4).map(o => (
              <View key={o} style={proc.openChip}>
                <Text style={proc.openTxt}>{o}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Séparateur */}
        <View style={proc.sep}/>

        {/* Actions */}
        <View style={proc.actions}>
          {/* Bouton connexion */}
          <TouchableOpacity
            style={[proc.connBtn, connected && proc.connBtnActive]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onConnect(pro);
            }}
            activeOpacity={0.82}
          >
            <Ionicons
              name={connected ? 'people' : pending ? 'time-outline' : 'person-add-outline'}
              size={13}
              color={connected ? G.success : G.muted}
            />
            <Text style={[proc.connTxt, connected && {color: G.success}]}>
              {connected ? 'Connecté' : pending ? 'En attente' : 'Se connecter'}
            </Text>
          </TouchableOpacity>

          {/* Portfolio */}
          {pro.website && (
            <TouchableOpacity
              style={proc.webBtn}
              onPress={() => Linking.openURL(pro.website!).catch(() => {})}
              activeOpacity={0.80}
            >
              <Ionicons name="globe-outline" size={14} color={G.muted}/>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const proc = StyleSheet.create({
  wrap:        { marginHorizontal:EDGE, marginBottom:10, borderRadius:20, overflow:'hidden',
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border },
  inner:       { padding:16, gap:12 },
  head:        { flexDirection:'row', alignItems:'flex-start', gap:12 },
  avatarWrap:  { position:'relative' },
  avatar:      { width:48, height:48, borderRadius:24, borderWidth:1, borderColor:G.border },
  verifiedDot: { position:'absolute', bottom:-1, right:-1, width:16, height:16, borderRadius:8,
                 backgroundColor:'rgba(34,197,94,0.90)', alignItems:'center', justifyContent:'center' },
  name:        { color:G.white, fontSize:14, fontWeight:'800', letterSpacing:-0.2 },
  role:        { color:G.muted, fontSize:11, fontWeight:'500' },
  loc:         { color:G.muted, fontSize:10 },
  bio:         { color:G.offWhite, fontSize:12, lineHeight:17 },
  filmChip:    { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:9, paddingVertical:4,
                 borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:G.border,
                 backgroundColor:G.glass, maxWidth:120 },
  filmTxt:     { color:G.muted, fontSize:9, fontWeight:'600', flexShrink:1 },
  openChip:    { paddingHorizontal:9, paddingVertical:3, borderRadius:10,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border, backgroundColor:G.glass },
  openTxt:     { color:G.muted, fontSize:9, fontWeight:'600' },
  sep:         { height:StyleSheet.hairlineWidth, backgroundColor:G.border },
  actions:     { flexDirection:'row', gap:9 },
  connBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7,
                 paddingVertical:10, borderRadius:14, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass },
  connBtnActive:{ borderColor:G.borderHi, backgroundColor:G.glassHi },
  connTxt:     { color:G.muted, fontSize:12, fontWeight:'700' },
  webBtn:      { width:40, height:40, borderRadius:14, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass, alignItems:'center', justifyContent:'center' },
});

// ── ConnectionRequestModal — glass ───────────────────────────────────────────
const ConnectionRequestModal = memo(function ConnectionRequestModal({
  pro, status, userId, onClose, onSent,
}: {
  pro:Pro|null; status:ConnStatus; userId:string; onClose:()=>void; onSent:(id:string)=>void;
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
      Animated.spring(slide, {toValue:0, tension:60, friction:12, useNativeDriver:true}).start();
    } else {
      Animated.timing(slide, {toValue:900, duration:240, useNativeDriver:true}).start();
    }
  }, [pro, status]);

  const handleSend = useCallback(async () => {
    if (!pro || note.trim().length < 20) return;
    setSending(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const {ok, error:err} = await dbSendConnection(pro.id, userId, note);
    setSending(false);
    if (ok) {
      setPhase('success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.spring(succSc,    {toValue:1, tension:80, friction:8, useNativeDriver:true}),
        Animated.timing(checkFade, {toValue:1, duration:400, useNativeDriver:true}),
      ]).start();
      onSent(pro.id);
      setTimeout(onClose, 2800);
    } else {
      Alert.alert('Erreur', err ?? "Impossible d\'envoyer la demande.");
    }
  }, [pro, userId, note, onSent, onClose]);

  if (!pro) return null;

  const charOk  = note.trim().length >= 20;
  const charPct = Math.min(100, (note.trim().length / 300) * 100);
  const lineColor = focusAnim.interpolate({ inputRange:[0,1], outputRange:[G.border, G.borderFocus] });

  return (
    <Modal visible animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={crm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={crm.kav}>
          <Animated.View style={[crm.sheet, {transform:[{translateY:slide}]}]}>
            <BlurView intensity={Platform.OS==='ios'?90:70} tint="dark" style={StyleSheet.absoluteFillObject}/>

            <View style={{flex:1}}>
              {/* Handle */}
              <View style={crm.handle}/>

              {/* ── SUCCESS ── */}
              {phase === 'success' && (
                <View style={crm.centered}>
                  <Animated.View style={[crm.successRing, {transform:[{scale:succSc}]}]}>
                    <Animated.View style={{opacity:checkFade}}>
                      <Ionicons name="checkmark" size={34} color={G.white}/>
                    </Animated.View>
                  </Animated.View>
                  <Text style={crm.phaseTitle}>Demande envoyée</Text>
                  <Text style={crm.phaseSub}>
                    {pro.name} recevra votre invitation.{'\n'}
                    Vous serez notifié dès qu'il/elle accepte.
                  </Text>
                  <View style={crm.infoRow}>
                    <Ionicons name="time-outline" size={12} color={G.muted}/>
                    <Text style={crm.infoTxt}>Réponse habituelle sous 48h</Text>
                  </View>
                </View>
              )}

              {/* ── ALREADY CONNECTED ── */}
              {phase === 'already' && (
                <View style={crm.centered}>
                  <View style={crm.connectedRing}>
                    <Ionicons name="people" size={28} color={G.white}/>
                  </View>
                  <Text style={crm.phaseTitle}>Vous êtes connectés</Text>
                  <Text style={crm.phaseSub}>
                    {pro.name} a accepté votre invitation.
                  </Text>
                  <View style={{width:'100%', gap:9}}>
                    {pro.contact_email && (
                      <TouchableOpacity
                        style={crm.actionBtn}
                        onPress={() => Linking.openURL(`mailto:${pro.contact_email}`).catch(() => {})}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="mail-outline" size={14} color={G.white}/>
                        <Text style={crm.actionTxt}>Envoyer un email</Text>
                      </TouchableOpacity>
                    )}
                    {pro.website && (
                      <TouchableOpacity
                        style={crm.actionBtn}
                        onPress={() => Linking.openURL(pro.website!).catch(() => {})}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="globe-outline" size={14} color={G.white}/>
                        <Text style={crm.actionTxt}>Voir le portfolio</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={{alignSelf:'center', paddingVertical:10}}>
                      <Text style={{color:G.muted, fontSize:13}}>Fermer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── FORM ── */}
              {phase === 'form' && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Pro info */}
                  <View style={crm.proHead}>
                    <Image
                      source={{uri: pro.avatar ?? `https://i.pravatar.cc/100?u=${pro.id}`}}
                      style={crm.proAvatar}
                      resizeMode="cover"
                    />
                    <View style={{flex:1, gap:3}}>
                      <View style={{flexDirection:'row', alignItems:'center', gap:7}}>
                        <Text style={crm.proName}>{pro.name}</Text>
                        {status === 'pending' && <ProStatusBadge status="pending"/>}
                      </View>
                      <Text style={crm.proRole}>{pro.role}</Text>
                      {pro.location && <Text style={crm.proLoc}>{pro.location}</Text>}
                    </View>
                    <TouchableOpacity style={crm.closeBtn} onPress={onClose} hitSlop={10}>
                      <Ionicons name="close" size={14} color={G.muted}/>
                    </TouchableOpacity>
                  </View>

                  {/* Films du pro */}
                  {pro.films.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap:7, paddingHorizontal:20, paddingBottom:16}}>
                      {pro.films.slice(0,5).map(f => (
                        <View key={f} style={crm.filmChip}>
                          <Ionicons name="film-outline" size={9} color={G.muted}/>
                          <Text style={{color:G.muted, fontSize:10, fontWeight:'600', flexShrink:1}} numberOfLines={1}>{f}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Pending state */}
                  {status === 'pending' ? (
                    <View style={crm.pendingBox}>
                      <Ionicons name="time-outline" size={18} color={G.muted}/>
                      <View style={{flex:1}}>
                        <Text style={crm.pendingTitle}>Invitation envoyée</Text>
                        <Text style={crm.pendingBody}>
                          {pro.name} n'a pas encore répondu. Vous serez notifié dès qu'il/elle accepte.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{paddingHorizontal:20}}>
                      {/* Label + compteur */}
                      <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                        <Text style={crm.noteLabel}>Note personnalisée</Text>
                        <Text style={crm.noteReq}>obligatoire</Text>
                      </View>
                      <Text style={crm.noteHint}>
                        Expliquez à {pro.name.split(' ')[0]} pourquoi vous souhaitez vous connecter.
                      </Text>

                      {/* Input */}
                      <TextInput
                        style={crm.noteInput}
                        value={note}
                        onChangeText={setNote}
                        multiline maxLength={300}
                        textAlignVertical="top"
                        placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous ai découvert sur Universe…`}
                        placeholderTextColor="rgba(255,255,255,0.18)"
                        selectionColor={G.white}
                        onFocus={() => Animated.timing(focusAnim,{toValue:1,duration:180,useNativeDriver:false}).start()}
                        onBlur ={() => Animated.timing(focusAnim,{toValue:0,duration:180,useNativeDriver:false}).start()}
                      />
                      <Animated.View style={{height:StyleSheet.hairlineWidth, backgroundColor:lineColor, marginBottom:10}}/>

                      {/* Progress bar */}
                      <View style={{flexDirection:'row', alignItems:'center', gap:10, marginBottom:6}}>
                        <View style={crm.charBarBg}>
                          <View style={[crm.charBarFill, {width:`${charPct}%` as any, backgroundColor: charOk ? G.success : G.muted}]}/>
                        </View>
                        <Text style={[crm.charCount, charOk && {color:G.success}]}>{note.trim().length}/300</Text>
                      </View>
                      {!charOk && note.length > 0 && (
                        <Text style={crm.charHint}>Encore {20-note.trim().length} caractères minimum</Text>
                      )}

                      {/* Open to */}
                      {pro.open_to.length > 0 && (
                        <View style={crm.openToBox}>
                          <Text style={crm.openToLabel}>Ouvert à</Text>
                          <View style={{flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:8}}>
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
                  <View style={{height:160}}/>
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
                  <TouchableOpacity style={[crm.sendBtn, crm.sendBtnActive]} onPress={onClose} activeOpacity={0.85}>
                    <Text style={crm.sendTxt}>Fermer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[crm.sendBtn, charOk && crm.sendBtnActive, (sending || !charOk) && {opacity:0.45}]}
                    onPress={handleSend}
                    disabled={!charOk || sending}
                    activeOpacity={0.88}
                  >
                    {sending
                      ? <ActivityIndicator color={G.white} size="small"/>
                      : <><Ionicons name="person-add-outline" size={14} color={G.white}/><Text style={crm.sendTxt}>Se connecter</Text></>
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
  overlay:     { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(2,8,16,0.88)' },
  kav:         { flex:1, justifyContent:'flex-end' },
  sheet:       { maxHeight:'92%', borderTopLeftRadius:28, borderTopRightRadius:28,
                 overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:G.border },
  handle:      { width:40, height:4, borderRadius:2, backgroundColor:G.border,
                 alignSelf:'center', marginTop:12, marginBottom:4 },

  // Phases centrées
  centered:    { alignItems:'center', padding:36, paddingVertical:48, gap:14 },
  successRing: { width:80, height:80, borderRadius:40, borderWidth:1, borderColor:G.border,
                 backgroundColor:G.glassHi, alignItems:'center', justifyContent:'center' },
  connectedRing:{ width:72, height:72, borderRadius:36, borderWidth:1, borderColor:G.border,
                 backgroundColor:G.glassHi, alignItems:'center', justifyContent:'center' },
  phaseTitle:  { color:G.white, fontSize:20, fontWeight:'900', textAlign:'center' },
  phaseSub:    { color:G.muted, fontSize:13, textAlign:'center', lineHeight:20 },
  infoRow:     { flexDirection:'row', alignItems:'center', gap:7,
                 paddingHorizontal:16, paddingVertical:10, borderRadius:14,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border, backgroundColor:G.glass },
  infoTxt:     { color:G.muted, fontSize:11, flex:1 },
  actionBtn:   { flexDirection:'row', alignItems:'center', gap:9, paddingHorizontal:22,
                 paddingVertical:12, borderRadius:16, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass, justifyContent:'center' },
  actionTxt:   { color:G.white, fontSize:14, fontWeight:'700' },

  // Pro header
  proHead:     { flexDirection:'row', alignItems:'flex-start', gap:14,
                 paddingHorizontal:20, paddingTop:16, paddingBottom:16 },
  proAvatar:   { width:52, height:52, borderRadius:26, borderWidth:1, borderColor:G.border },
  proName:     { color:G.white, fontSize:15, fontWeight:'900', flexShrink:1 },
  proRole:     { color:G.muted, fontSize:11, fontWeight:'500' },
  proLoc:      { color:G.muted, fontSize:10 },
  closeBtn:    { width:30, height:30, borderRadius:15, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass, alignItems:'center', justifyContent:'center' },
  filmChip:    { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:9, paddingVertical:4,
                 borderRadius:9, borderWidth:StyleSheet.hairlineWidth, borderColor:G.border,
                 backgroundColor:G.glass, maxWidth:130 },

  // Note input
  noteLabel:   { color:G.white, fontSize:13, fontWeight:'700', flex:1 },
  noteReq:     { color:G.muted, fontSize:10, fontWeight:'600' },
  noteHint:    { color:G.muted, fontSize:11, lineHeight:17, marginBottom:14 },
  noteInput:   { color:G.white, fontSize:14, minHeight:130, lineHeight:22, paddingVertical:4 },
  charBarBg:   { flex:1, height:2, borderRadius:1, backgroundColor:G.faint, overflow:'hidden' },
  charBarFill: { height:'100%', borderRadius:1 },
  charCount:   { color:G.muted, fontSize:10, fontWeight:'700', minWidth:40, textAlign:'right' },
  charHint:    { color:G.muted, fontSize:10, marginBottom:10 },
  openToBox:   { marginTop:14, padding:14, borderRadius:14, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass },
  openToLabel: { color:G.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase' },
  openToChip:  { paddingHorizontal:10, paddingVertical:4, borderRadius:10,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border, backgroundColor:G.glass },
  openToTxt:   { color:G.muted, fontSize:10, fontWeight:'600' },

  // Pending
  pendingBox:  { flexDirection:'row', alignItems:'flex-start', gap:12, marginHorizontal:20,
                 marginBottom:20, padding:16, borderRadius:16, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass },
  pendingTitle:{ color:G.offWhite, fontSize:13, fontWeight:'700', marginBottom:5 },
  pendingBody: { color:G.muted, fontSize:12, lineHeight:18 },

  // Footer
  footer:      { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:20,
                 paddingTop:14, paddingBottom: Platform.OS==='ios'?36:20,
                 borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:G.border },
  cancelBtn:   { paddingHorizontal:18, paddingVertical:13, borderRadius:16,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border, backgroundColor:G.glass },
  cancelTxt:   { color:G.muted, fontSize:14, fontWeight:'600' },
  sendBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                 paddingVertical:13, borderRadius:16, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:G.border, backgroundColor:G.glass },
  sendBtnActive:{ backgroundColor:G.glassHi, borderColor:G.borderHi },
  sendTxt:     { color:G.white, fontSize:14, fontWeight:'800' },
});

// ── ProDirectory ──────────────────────────────────────────────────────────────
// ── Section header pour chaque catégorie de pros ────────────────────────────
const ProSectionHeader = memo(function ProSectionHeader({
  title, count,
}: { title:string; count:number }) {
  return (
    <View style={pd.secHead}>
      <View style={pd.secLine}/>
      <Text style={pd.secTitle}>{title}</Text>
      <View style={pd.secCount}><Text style={pd.secCountTxt}>{count}</Text></View>
      <View style={pd.secLine}/>
    </View>
  );
});

function ProDirectory2({userId}:{userId:string}) {
  const [search,     setSearch]     = useState('');
  const [activeRole, setActiveRole] = useState('Tous');
  const [connectPro, setConnectPro] = useState<Pro|null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('none');
  const searchRef   = useRef<TextInput>(null);
  const searchFocus = useRef(new Animated.Value(0)).current;

  // On charge TOUS les pros (pas de filtre role côté serveur quand 'Tous')
  // le filtre activeRole est appliqué côté client pour le groupement
  const {pros, loading, error, refresh} = useProDirectory(search, activeRole);
  const {connections, setStatus}        = useConnections(userId);

  const connectedCount = useMemo(() =>
    Object.values(connections).filter(s=>s==='accepted').length, [connections]);
  const pendingCount = useMemo(() =>
    Object.values(connections).filter(s=>s==='pending').length, [connections]);

  // ★ Groupement par catégorie de rôle
  const grouped = useMemo(() => {
    if (!pros.length) return [];
    if (activeRole !== 'Tous') {
      // Filtre simple déjà fait par le hook — une seule section
      return [{ title: activeRole, data: pros }];
    }
    // Groupe par role, puis tri alphabétique des catégories
    const map: Record<string, Pro[]> = {};
    pros.forEach(p => {
      const cat = p.role?.trim() || 'Autre';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([title, data]) => ({ title, data }));
  }, [pros, activeRole]);

  const handleOpen = useCallback((pro:Pro) => {
    setConnStatus(connections[pro.id] ?? 'none');
    setConnectPro(pro);
  }, [connections]);

  const searchLineColor = searchFocus.interpolate({
    inputRange: [0,1], outputRange: [G.border, G.borderFocus],
  });

  return (
    <View style={{ flex:1 }}>

      {/* ══ HEADER FIXE — ne se déplace pas lors du scroll ══ */}
      <View style={pd.fixedHeader}>
        {/* Stats connexions */}
        {(connectedCount > 0 || pendingCount > 0) && (
          <View style={pd.statsBar}>
            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={pd.statsRow}>
              {connectedCount > 0 && (
                <View style={pd.statItem}>
                  <Ionicons name="people" size={12} color={G.muted}/>
                  <Text style={pd.statTxt}>
                    {connectedCount} connecté{connectedCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {pendingCount > 0 && (
                <View style={pd.statItem}>
                  <Ionicons name="time-outline" size={12} color={G.muted}/>
                  <Text style={pd.statTxt}>{pendingCount} en attente</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Barre de recherche */}
        <View style={pd.searchRow}>
          <Ionicons name="search" size={14} color={G.muted} style={{ marginTop:2 }}/>
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
              selectionColor={G.white}
              onFocus={() => Animated.timing(searchFocus,{toValue:1,duration:180,useNativeDriver:false}).start()}
              onBlur ={() => Animated.timing(searchFocus,{toValue:0,duration:180,useNativeDriver:false}).start()}
            />
            <Animated.View style={{ height:StyleSheet.hairlineWidth, backgroundColor:searchLineColor }}/>
          </View>
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearch(''); searchRef.current?.focus(); }}
              hitSlop={8 as any}
            >
              <Ionicons name="close-circle" size={14} color={G.muted}/>
            </TouchableOpacity>
          )}
        </View>

        {/* Filtres rôles — scrollable horizontal */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:EDGE, gap:7 }}
          style={{ marginTop:12 }}
        >
          {PRO_ROLES.map(r => {
            const on = activeRole === r;
            return (
              <TouchableOpacity
                key={r}
                style={[pd.roleChip, on && pd.roleChipOn]}
                onPress={() => setActiveRole(r)}
                activeOpacity={0.80}
              >
                <Text style={[pd.roleTxt, on && pd.roleTxtOn]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Séparateur bas du header */}
        <View style={pd.headerSep}/>
      </View>

      {/* ══ LISTE SCROLLABLE ══ */}
      {loading ? (
        <View style={pd.center}>
          <ActivityIndicator color={G.muted} size="large"/>
          <Text style={pd.emptyTxt}>Chargement du répertoire…</Text>
        </View>
      ) : error ? (
        <View style={pd.center}>
          <Ionicons name="cloud-offline-outline" size={28} color={G.muted}/>
          <Text style={pd.emptyTxt}>{error}</Text>
          <TouchableOpacity style={pd.retryBtn} onPress={refresh}>
            <Text style={pd.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : grouped.length === 0 ? (
        <View style={pd.center}>
          <Ionicons name="people-outline" size={40} color={G.muted}/>
          <Text style={pd.emptyTxt}>Aucun professionnel trouvé</Text>
          <Text style={{ color:G.muted, fontSize:11, opacity:0.6, textAlign:'center' }}>
            Modifiez votre recherche ou le filtre
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom:0 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ★ Sections par catégorie */}
          {grouped.map(section => (
            <View key={section.title}>
              <ProSectionHeader title={section.title} count={section.data.length}/>
              {section.data.map(pro => (
                <ProCard
                  key={pro.id}
                  pro={pro}
                  status={connections[pro.id] ?? 'none'}
                  onConnect={handleOpen}
                />
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
        onSent={(id) => setStatus(id, 'pending')}
      />
    </View>
  );
}

const pd = StyleSheet.create({
  // Header fixe
  fixedHeader: {
    paddingTop:8,
    paddingBottom:10,
    borderBottomWidth: 0,   // le headerSep gère la séparation
  },
  headerSep:   {
    height:StyleSheet.hairlineWidth,
    backgroundColor:G.border,
    marginTop:14,
  },

  // Stats bar
  statsBar:    { marginHorizontal:EDGE, marginBottom:12, borderRadius:12, overflow:'hidden',
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border },
  statsRow:    { flexDirection:'row', gap:16, paddingHorizontal:14, paddingVertical:9 },
  statItem:    { flexDirection:'row', alignItems:'center', gap:6 },
  statTxt:     { color:G.muted, fontSize:11 },

  // Search
  searchRow:   { flexDirection:'row', alignItems:'center', gap:12,
                 paddingHorizontal:EDGE, gap:10 },
  searchInput: { color:G.white, fontSize:14, paddingVertical:10, flex:1 },

  // Role chips
  roleChip:    { paddingHorizontal:13, paddingVertical:7, borderRadius:18,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border,
                 backgroundColor:G.glass },
  roleChipOn:  { backgroundColor:G.glassHi, borderColor:G.borderHi },
  roleTxt:     { color:G.muted, fontSize:11, fontWeight:'600' },
  roleTxtOn:   { color:G.white, fontWeight:'700' },

  // Section header
  secHead:     { flexDirection:'row', alignItems:'center', gap:12,
                 paddingHorizontal:EDGE, paddingTop:22, paddingBottom:12 },
  secLine:     { flex:1, height:StyleSheet.hairlineWidth, backgroundColor:G.border },
  secTitle:    { color:G.offWhite, fontSize:11, fontWeight:'700',
                 letterSpacing:1.2, textTransform:'uppercase' },
  secCount:    { paddingHorizontal:8, paddingVertical:2, borderRadius:10,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border,
                 backgroundColor:G.glass },
  secCountTxt: { color:G.muted, fontSize:10, fontWeight:'700' },

  // États vides / erreur
  center:      { flex:1, alignItems:'center', justifyContent:'center',
                 gap:12, paddingVertical:60 },
  emptyTxt:    { color:G.muted, fontSize:14, fontWeight:'600',
                 textAlign:'center', paddingHorizontal:40 },
  retryBtn:    { paddingHorizontal:20, paddingVertical:9, borderRadius:14,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:G.border,
                 backgroundColor:G.glass },
  retryTxt:    { color:G.white, fontSize:13, fontWeight:'700' },
});


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL
// ─────────────────────────────────────────────────────────────────────────────
const STEPS=['film','critique','media','preview'] as const;type CStep=typeof STEPS[number];
const STEP_LBL:Record<CStep,string>={film:"L'Œuvre",critique:'Critique',media:'Image',preview:'Aperçu'};
const STEP_ICON:Record<CStep,string>={film:'film-outline',critique:'create-outline',media:'image-outline',preview:'eye-outline'};
const INIT_FORM:CForm={workTitle:'',workYear:'',workDirector:'',workGenre:'',rating:0,tone:null,body:'',tags:[],imageUri:'',imageUrl:'',imageValid:false};

function ComposeModal({visible,onClose,onPublished,userId}:{visible:boolean;onClose:()=>void;onPublished?:()=>void;userId:string}) {
  const[step,setStep]=useState<CStep>('film');const[form,setForm]=useState<CForm>(INIT_FORM);const[publishing,setPub]=useState(false);const[imgLoading,setImgLoad]=useState(false);const[errors,setErrors]=useState<Partial<Record<CStep,string>>>({});
  const slide=useRef(new Animated.Value(800)).current;
  useEffect(()=>{if(visible){setStep('film');setForm(INIT_FORM);setErrors({});Animated.spring(slide,{toValue:0,tension:58,friction:12,useNativeDriver:true}).start();}else Animated.timing(slide,{toValue:800,duration:220,useNativeDriver:true}).start();},[visible]);
  const patch=useCallback(<K extends keyof CForm>(k:K,v:CForm[K])=>setForm(f=>({...f,[k]:v})),[]);
  const setErr=(s:CStep,m:string)=>setErrors(e=>({...e,[s]:m}));
  const clrErr=(s:CStep)=>setErrors(e=>({...e,[s]:''}));
  const validate=useCallback((s:CStep):string|null=>{
    if(s==='film'){if(!form.workTitle.trim())return'Titre obligatoire.';if(!form.workGenre)return'Genre requis.';if(form.rating===0)return'Note requise.';}
    if(s==='critique'){if(!form.tone)return'Ton requis.';if(form.body.trim().length<MIN_BODY)return`Min ${MIN_BODY} car.`;}
    return null;
  },[form]);
  const goNext=useCallback(()=>{const err=validate(step);if(err){setErr(step,err);return;}clrErr(step);const i=STEPS.indexOf(step);if(i<STEPS.length-1)setStep(STEPS[i+1]);},[step,validate]);
  const goBack=useCallback(()=>{const i=STEPS.indexOf(step);if(i>0)setStep(STEPS[i-1]);},[step]);
  const pickImage=useCallback(async()=>{
    const{granted}=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!granted){Alert.alert('Permission requise');return;}
    const res=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.85,allowsEditing:true,aspect:[16,9]});
    if(res.canceled||!res.assets?.[0])return;
    patch('imageUri',res.assets[0].uri);patch('imageValid',false);patch('imageUrl','');setImgLoad(true);clrErr('media');
    const url=await uploadImage(res.assets[0].uri);setImgLoad(false);
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
  return(
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(2,8,16,0.82)'}}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end'}}>
          <Animated.View style={{maxHeight:'94%',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden',borderWidth:1,borderColor:C.border,transform:[{translateY:slide}]}}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}/>
            <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(6,15,30,0.62)'}} pointerEvents="none"/>
            <View style={{flex:1}}>
              <View style={{width:38,height:4,borderRadius:2,backgroundColor:C.navyLight,alignSelf:'center',marginTop:12}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:20,paddingTop:14,paddingBottom:10}}>
                <View style={{flex:1}}><Text style={{color:C.text,fontSize:19,fontWeight:'800',letterSpacing:-0.4}}>Nouvelle Critique</Text><Text style={{color:C.textTert,fontSize:11,marginTop:3}}>Cinéma indépendant</Text></View>
                <TouchableOpacity style={{width:30,height:30,borderRadius:15,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center'}} onPress={onClose}><Ionicons name="close" size={15} color={C.textSec}/></TouchableOpacity>
              </View>
              {/* Step indicator */}
              <View style={{flexDirection:'row',paddingHorizontal:20,marginBottom:16,alignItems:'flex-start'}}>
                {STEPS.map((st,i)=>{const done=i<stepIdx,curr=i===stepIdx;return(
                  <View key={st} style={{flex:1,alignItems:'center',position:'relative'}}>
                    <View style={{width:28,height:28,borderRadius:14,backgroundColor:done?C.navyBright:curr?C.navyLight:C.surf,borderWidth:1,borderColor:done?C.navyBright:curr?C.borderHi:C.border,justifyContent:'center',alignItems:'center',marginBottom:4}}>
                      {done?<Ionicons name="checkmark" size={11} color={C.white}/>:<Ionicons name={STEP_ICON[st] as any} size={11} color={curr?C.white:C.textSec}/>}
                    </View>
                    <Text style={{color:curr?C.text:C.textTert,fontSize:9,fontWeight:'700',letterSpacing:0.2,textAlign:'center'}}>{STEP_LBL[st]}</Text>
                    {i<STEPS.length-1&&<View style={{position:'absolute',top:14,left:'50%',right:'-50%',height:1,backgroundColor:done?C.navyBright:C.border}}/>}
                  </View>
                );})}
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{paddingHorizontal:20}}>
                  {step==='film'&&(<>
                    <Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>TITRE *</Text>
                    <TextInput style={{backgroundColor:C.surf,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:15,marginBottom:20}} placeholderTextColor={C.textTert} placeholder="Ex : Portrait de la jeune fille en feu" value={form.workTitle} onChangeText={v=>{patch('workTitle',v);clrErr('film');}}/>
                    <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
                      <View style={{flex:1}}><Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>RÉALISATEUR</Text><TextInput style={{backgroundColor:C.surf,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:15}} placeholder="Nom" placeholderTextColor={C.textTert} value={form.workDirector} onChangeText={v=>patch('workDirector',v)}/></View>
                      <View style={{width:86}}><Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>ANNÉE</Text><TextInput style={{backgroundColor:C.surf,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:15}} placeholder="2025" placeholderTextColor={C.textTert} value={form.workYear} onChangeText={v=>patch('workYear',v)} keyboardType="numeric" maxLength={4}/></View>
                    </View>
                    <Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>GENRE *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4,marginBottom:20}}>
                      {GENRES_LIST.map(g=>{const on=form.workGenre===g;return<TouchableOpacity key={g} style={{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:on?C.navyLight:C.surf,borderWidth:1,borderColor:on?C.borderHi:C.border}} onPress={()=>{patch('workGenre',g);clrErr('film');}}><Text style={{color:on?C.white:C.textSec,fontSize:13,fontWeight:'600'}}>{g}</Text></TouchableOpacity>;})}
                    </ScrollView>
                    <Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>NOTE *</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}}>
                      <View style={{flexDirection:'row',gap:3}}>{[1,2,3,4,5].map(s=><TouchableOpacity key={s} onPress={()=>{patch('rating',s);clrErr('film');}} hitSlop={6 as any}><Ionicons name={form.rating>=s?'star':'star-outline'} size={28} color={form.rating>=s?C.gold:C.textSec}/></TouchableOpacity>)}</View>
                      <View style={{paddingHorizontal:10,paddingVertical:4,borderRadius:10,backgroundColor:C.goldDim,borderWidth:1,borderColor:C.goldEdge}}><Text style={{color:C.gold,fontSize:14,fontWeight:'800'}}>{form.rating>0?`${form.rating}/5`:'--'}</Text></View>
                    </View>
                    {errors.film&&<Text style={{color:C.red,fontSize:12,marginBottom:12,fontWeight:'600'}}>{errors.film}</Text>}
                  </>)}
                  {step==='critique'&&(<>
                    <Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>TON *</Text>
                    {[TONES.slice(0,4),TONES.slice(4)].map((row,ri)=>(
                      <View key={ri} style={{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between',marginBottom:10}}>
                        {row.map(t=>{const on=form.tone===t.key;return<TouchableOpacity key={t.key} style={{width:'48%',paddingVertical:16,borderRadius:14,backgroundColor:on?`${t.color}16`:C.surf,borderWidth:1,borderColor:on?t.color:C.border,alignItems:'center',gap:8}} onPress={()=>{patch('tone',t.key);clrErr('critique');}}>
                          <View style={{width:38,height:38,borderRadius:19,backgroundColor:on?`${t.color}22`:C.navyMid,justifyContent:'center',alignItems:'center'}}><Ionicons name={t.icon as any} size={20} color={on?t.color:C.textSec}/></View>
                          <Text style={{color:on?t.color:C.textSec,fontSize:13,fontWeight:'700'}}>{t.label}</Text>
                        </TouchableOpacity>;})}
                      </View>
                    ))}
                    <Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>CRITIQUE *</Text>
                    <TextInput style={{backgroundColor:C.surf,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:14,minHeight:140,lineHeight:22}} multiline textAlignVertical="top" placeholder="Analysez la mise en scène…" placeholderTextColor={C.textTert} value={form.body} onChangeText={v=>{patch('body',v);clrErr('critique');}}/>
                    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:8,marginBottom:20}}>
                      <View style={{flex:1,height:2,borderRadius:1,backgroundColor:C.surf,overflow:'hidden'}}><View style={{height:'100%',borderRadius:1,backgroundColor:bodyLen>=MIN_BODY?C.green:C.blue,width:`${Math.min(100,(bodyLen/MIN_BODY)*100)}%` as any}}/></View>
                      <Text style={{color:bodyLen>=MIN_BODY?C.green:C.textSec,fontSize:11,fontWeight:'700'}}>{bodyLen}/{MIN_BODY}</Text>
                    </View>
                    <Text style={{color:C.textSec,fontSize:10,fontWeight:'700',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>ASPECTS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4,marginBottom:16}}>
                      {ASPECTS.map(tag=>{const on=form.tags.includes(tag);return<TouchableOpacity key={tag} style={{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:on?C.goldDim:C.surf,borderWidth:1,borderColor:on?C.goldEdge:C.border}} onPress={()=>patch('tags',on?form.tags.filter(t=>t!==tag):[...form.tags,tag])}><Text style={{color:on?C.gold:C.textSec,fontSize:13,fontWeight:'600'}}>{tag}</Text></TouchableOpacity>;})}
                    </ScrollView>
                    {errors.critique&&<Text style={{color:C.red,fontSize:12,marginBottom:12,fontWeight:'600'}}>{errors.critique}</Text>}
                  </>)}
                  {step==='media'&&(<>
                    {form.imageUri?(
                      <View style={{height:200,borderRadius:16,overflow:'hidden',marginBottom:16}}>
                        <Image source={{uri:form.imageUri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>
                        <LinearGradient colors={['transparent','rgba(2,8,16,0.80)']} style={StyleSheet.absoluteFillObject}/>
                        {form.imageValid&&!imgLoading&&<View style={{position:'absolute',bottom:10,left:10,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(2,8,16,0.80)',paddingHorizontal:10,paddingVertical:5,borderRadius:10}}><Ionicons name="checkmark-circle" size={13} color={C.green}/><Text style={{color:C.green,fontSize:11,fontWeight:'700'}}>Image prête</Text></View>}
                        {imgLoading&&<View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(2,8,16,0.65)',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={C.blue}/></View>}
                        {!imgLoading&&<TouchableOpacity style={{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(2,8,16,0.75)',paddingHorizontal:10,paddingVertical:5,borderRadius:10}} onPress={pickImage}><Ionicons name="refresh-outline" size={12} color={C.textSec}/><Text style={{color:C.textSec,fontSize:11}}>Changer</Text></TouchableOpacity>}
                      </View>
                    ):(
                      <TouchableOpacity style={{height:180,borderRadius:16,borderWidth:1,borderColor:C.borderBlue,borderStyle:'dashed',alignItems:'center',justifyContent:'center',gap:12,marginBottom:20}} onPress={pickImage} disabled={imgLoading}>
                        <View style={{width:64,height:64,borderRadius:32,backgroundColor:C.blueDim,justifyContent:'center',alignItems:'center'}}><Ionicons name="image-outline" size={36} color={C.blue}/></View>
                        <Text style={{color:C.text,fontSize:14,fontWeight:'700'}}>Sélectionner depuis la galerie</Text>
                        <Text style={{color:C.textSec,fontSize:11}}>JPEG · PNG · 16:9 recommandé</Text>
                      </TouchableOpacity>
                    )}
                    {errors.media&&<Text style={{color:C.red,fontSize:12,marginBottom:12,fontWeight:'600'}}>{errors.media}</Text>}
                  </>)}
                  {step==='preview'&&(<>
                    <View style={{height:200,borderRadius:18,overflow:'hidden',marginBottom:16,backgroundColor:C.navyMid}}>
                      {form.imageUrl&&<Image source={{uri:form.imageUrl}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>}
                      <LinearGradient colors={['transparent','rgba(2,8,16,0.94)']} style={StyleSheet.absoluteFillObject}/>
                      <View style={{position:'absolute',bottom:0,left:0,right:0,padding:14}}>
                        {toneInfo&&<View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:1,borderColor:`${toneInfo.color}40`,backgroundColor:`${toneInfo.color}20`,marginBottom:7}}><Ionicons name={toneInfo.icon as any} size={9} color={toneInfo.color}/><Text style={{fontSize:9,fontWeight:'800',color:toneInfo.color,letterSpacing:0.6}}>{toneInfo.label.toUpperCase()}</Text></View>}
                        <Text style={{color:C.white,fontSize:18,fontWeight:'800',marginBottom:2}} numberOfLines={2}>{form.workTitle}</Text>
                        <Text style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginBottom:7}}>{[form.workDirector,form.workYear,form.workGenre].filter(Boolean).join(' · ')}</Text>
                        <View style={{flexDirection:'row',gap:3}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={form.rating>=s?'star':'star-outline'} size={13} color={form.rating>=s?C.gold:C.textSec}/>)}</View>
                      </View>
                    </View>
                    <View style={{backgroundColor:C.surf,borderRadius:14,borderWidth:1,borderColor:C.border,padding:14,gap:11,marginBottom:16}}>
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
              <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:Platform.OS==='ios'?34:18,paddingTop:14,borderTopWidth:1,borderTopColor:C.border,gap:12}}>
                {stepIdx>0&&<TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingVertical:12}} onPress={goBack}><Ionicons name="chevron-back" size={15} color={C.textSec}/><Text style={{color:C.textSec,fontSize:14,fontWeight:'600'}}>Retour</Text></TouchableOpacity>}
                {step!=='preview'?(
                  <TouchableOpacity style={{flex:1,borderRadius:22,overflow:'hidden',marginLeft:stepIdx===0?'auto' as any:0}} onPress={goNext}>
                    <LinearGradient colors={[C.navyBright,C.navyLight]} start={{x:0,y:0}} end={{x:1,y:0}} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14}}><Text style={{color:C.white,fontSize:15,fontWeight:'700'}}>Continuer</Text><Ionicons name="chevron-forward" size={14} color={C.white}/></LinearGradient>
                  </TouchableOpacity>
                ):(
                  <TouchableOpacity style={{flex:1,borderRadius:22,overflow:'hidden',opacity:publishing?0.55:1}} onPress={publish} disabled={publishing}>
                    <LinearGradient colors={[C.blue,C.navyMid]} start={{x:0,y:0}} end={{x:1,y:0}} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14}}>{publishing?<ActivityIndicator color={C.white} size="small"/>:<><Ionicons name="send" size={14} color={C.white}/><Text style={{color:C.white,fontSize:15,fontWeight:'700'}}>Publier</Text></>}</LinearGradient>
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

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const[activeTab,  setActiveTab]  = useState<FeedTab>('Pour vous');
  const[composeOpen,setCompose]    = useState(false);
  const[userId,     setUserId]     = useState('anonymous');
  const[refreshing, setRefreshing] = useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user?.id)setUserId(session.user.id);
      else supabase.auth.getUser().then(({data:{user}})=>{if(user?.id)setUserId(user.id);});
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{if(s?.user?.id)setUserId(s.user.id);});
    return()=>subscription.unsubscribe();
  },[]);

  const{posts,loading,error,refresh,toggleLike}=usePostsFeed(activeTab);
  const{works,loading:wLoading}=useWorksAlgorithm();

  const onRefresh=useCallback(async()=>{setRefreshing(true);refresh();setTimeout(()=>setRefreshing(false),800);},[refresh]);

  // Pour "Tendances" : tri par (likes + shares×2)
  const trendData=useMemo(()=>{
    if(activeTab!=='Tendances')return posts;
    return[...posts].sort((a,b)=>(b.likes+b.shares*2)-(a.likes+a.shares*2));
  },[posts,activeTab]);

  const router=useRouter();

  // ── Header commun ─────────────────────────────────────────────────────────
  const SocialHeader=(
    <View style={sc.header}>
      <View>
        <Text style={sc.eyebrow}>UNIVERSE · CINÉMA</Text>
        <Text style={sc.title}>Communauté</Text>
      </View>
      <View style={{flexDirection:'row',gap:8}}>
        <TouchableOpacity style={sc.iconBtn} onPress={()=>router.push('/notifications' as any)} activeOpacity={0.80}>
          <Ionicons name="notifications-outline" size={18} color={"#fff"}/>
          <View style={sc.dot}/>
        </TouchableOpacity>
       
      </View>
    </View>
  );

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const TabBar=(
    <View style={sc.tabs}>
      {FEED_TABS.map(t=>{
        const on=t===activeTab;
        return(
          <TouchableOpacity key={t} onPress={()=>setActiveTab(t)} style={sc.tab} activeOpacity={0.80}>
            <Text style={[sc.tabTxt,on&&sc.tabTxtOn]}>{t}</Text>
            {on&&<View style={[sc.tabLine,t==='Pros'&&{backgroundColor:C.gold}]}/>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── ListEmpty ─────────────────────────────────────────────────────────────
  const ListEmpty=useMemo(()=>{
    if(loading)return<View style={{alignItems:'center',paddingVertical:60,gap:14}}><ActivityIndicator color={C.blue} size="large"/><Text style={{color:C.textSec,fontSize:13}}>Chargement…</Text></View>;
    if(error)  return<View style={{alignItems:'center',paddingVertical:60,gap:12}}><Ionicons name="cloud-offline-outline" size={28} color={C.textTert}/><Text style={{color:C.red,fontSize:13,textAlign:'center',paddingHorizontal:40}}>{error}</Text><TouchableOpacity onPress={refresh} style={{paddingHorizontal:22,paddingVertical:10,borderRadius:14,backgroundColor:C.navyLight}}><Text style={{color:C.white,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>;
    return(
      <View style={{alignItems:'center',paddingVertical:80,paddingHorizontal:40,gap:12}}>
        <View style={{width:72,height:72,borderRadius:36,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center'}}><Ionicons name="film-outline" size={36} color={C.textTert}/></View>
        <Text style={{color:C.textSec,fontSize:17,fontWeight:'700'}}>Aucune critique</Text>
        <TouchableOpacity style={{borderRadius:22,overflow:'hidden'}} onPress={()=>setCompose(true)} activeOpacity={0.85}>
          <LinearGradient colors={[C.navyBright,C.navyLight]} start={{x:0,y:0}} end={{x:1,y:0}} style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:24,paddingVertical:13}}>
            <Ionicons name="create-outline" size={16} color={C.white}/><Text style={{color:C.white,fontSize:14,fontWeight:'700'}}>Écrire une critique</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  },[loading,error,refresh]);

  return(
    <InteractionProvider onToggleLike={toggleLike}>
      <View style={sc.root}>
        <StatusBar style="light"/>
        <GalaxyBackground/>
        <SafeAreaView style={sc.safe} edges={['top']}>
          <ComposeModal visible={composeOpen} onClose={()=>setCompose(false)} onPublished={refresh} userId={userId}/>

          {/* ── PROS ── */}
          {activeTab==='Pros'?(
            <View style={{flex:1}}>
              {SocialHeader}{TabBar}
              <ProDirectory2 userId={userId}/>
            </View>

          /* ── TENDANCES — grille 2 colonnes ── */
          ):activeTab==='Tendances'?(
            <FlatList
              key="grid-2col"
              data={trendData}
              numColumns={2}
              columnWrapperStyle={{gap:COL_GAP,paddingHorizontal:EDGE,marginBottom:COL_GAP}}
              keyExtractor={item=>item.id}
              renderItem={({item})=><GridPostCard post={item} userId={userId}/>}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingBottom:120}}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]}/>}
              ListHeaderComponent={
                <View>
                  {SocialHeader}{TabBar}
                  <AlgorithmBanner works={works}/>
                  <TrendingRow works={works} loading={wLoading}/>
                </View>
              }
              ListEmptyComponent={ListEmpty}
              removeClippedSubviews windowSize={5} maxToRenderPerBatch={6} initialNumToRender={6}
            />

          /* ── POUR VOUS — liste compacte ── */
          ):(
            <FlatList
              key="list-1col"
              data={posts}
              keyExtractor={item=>item.id}
              renderItem={({item})=><CompactPostCard post={item} userId={userId}/>}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingBottom:120}}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]}/>}
              ListHeaderComponent={
                <View>
                  {SocialHeader}{TabBar}
                  <TrendingRow works={works} loading={wLoading}/>
                  <CreatorSpotlight posts={posts}/>
                  {posts.length>4&&<GenreRadar posts={posts}/>}
                </View>
              }
              ListEmptyComponent={ListEmpty}
              removeClippedSubviews windowSize={7} maxToRenderPerBatch={5} initialNumToRender={5}
              updateCellsBatchingPeriod={50}
            />
          )}
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}

const sc = StyleSheet.create({
  root:    {flex:1,backgroundColor:C.bg0},
  safe:    {flex:1},
  header:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingTop:10,paddingBottom:14},
  eyebrow: {fontSize:9,fontWeight:'700',color:C.textTert,letterSpacing:1.5,marginBottom:2},
  title:   {fontSize:26,fontWeight:'800',color:C.text,letterSpacing:-0.5},
  iconBtn: {width:38,height:38,borderRadius:19,backgroundColor:C.surf,borderWidth:1,borderColor:C.navyMid,alignItems:'center',justifyContent:'center',position:'relative'},
  dot:     {position:'absolute',top:8,right:8,width:7,height:7,borderRadius:4,backgroundColor:"#fff",borderColor:C.bg0},
  tabs:    {flexDirection:'row',paddingHorizontal:EDGE,gap:20,marginBottom:12,borderBottomWidth:1,borderBottomColor:C.border},
  tab:     {paddingBottom:12,alignItems:'center',position:'relative'},
  tabTxt:  {color:C.textSec,fontSize:13,fontWeight:'600'},
  tabTxtOn:{color:C.text,fontWeight:'800'},
  tabLine: {position:'absolute',bottom:0,left:0,right:0,height:2,borderRadius:1,backgroundColor:C.blue},
});