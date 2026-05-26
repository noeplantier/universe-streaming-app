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
import * as Haptics       from 'expo-haptics';
import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';
import NotifService       from '@/services/notifService';

// Platform.select → web-safe (Metro tree-shaking)
const FileSystem: any = Platform.select({
  native: () => { try { return require('expo-file-system'); } catch { return null; } },
  default: () => null,
})?.() ?? null;
let decode: ((s:string)=>ArrayBuffer)|null = null;
try { decode = require('base64-arraybuffer').decode; } catch {}

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const { width:W } = Dimensions.get('window');
const EDGE=18, GAP=10, GRID_W=(W-EDGE*2-GAP)/2;
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.15)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
} as const;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TONE_KEYS = ['analyse','coup de coeur','deception','reflexion','détente','neutre','mitigé','enthousiaste'] as const;
type Tone = typeof TONE_KEYS[number];
const TONES: {key:Tone;label:string;icon:keyof typeof Ionicons.glyphMap}[] = [
  {key:'analyse',       label:'Analyse',      icon:'flask-outline'},
  {key:'coup de coeur', label:'Coup de cœur', icon:'heart-outline'},
  {key:'deception',     label:'Déception',    icon:'cloud-offline-outline'},
  {key:'reflexion',     label:'Réflexion',    icon:'bulb-outline'},
  {key:'détente',       label:'Détente',      icon:'cafe-outline'},
  {key:'neutre',        label:'Neutre',       icon:'remove-outline'},
  {key:'mitigé',        label:'Mitigé',       icon:'git-branch-outline'},
  {key:'enthousiaste',  label:'Enthousiaste', icon:'star-outline'},
];
const GENRES_LIST = ['Drame','Thriller','Sci-Fi','Documentaire','Animation','Court métrage','Expérimental','Biopic'] as const;
const ASPECTS = ['Photographie','Musique','Scénario','Montage','Interprétation','Rythme','Atmosphère','Décors'];
const FEED_TABS = ['Pour vous','Tendances','Pros'] as const;
type FeedTab = typeof FEED_TABS[number];
type ConnStatus = 'none'|'pending'|'accepted'|'rejected';
const MIN_BODY=80, POSTS_LIMIT=40, WORKS_LIMIT=50;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Post { id:string; userId:string; userName:string; avatar:string; timeAgo:string; content:string; likes:number; shares:number; workId:number; work_title:string; work_year:string; work_director:string; work_genre:string; rating:number; image_url:string; tags:string[]; tone:Tone; created_at:string; isRecent:boolean; algoScore:number }
interface Work { id:number; title:string; category:string; genre:string; year:number; likes:number; comments:number|null; image:string|null; is_original:boolean; duration:number|null; director:string|null; created_at:string; score?:number }
interface Pro { id:string; name:string; role:string; avatar:string|null; bio:string|null; films:string[]; location:string|null; contact_email:string|null; website:string|null; verified:boolean; open_to:string[]; created_at:string }
interface CForm { workTitle:string; workYear:string; workDirector:string; workGenre:string; rating:number; tone:Tone|null; body:string; tags:string[]; imageUri:string; imageUrl:string; imageValid:boolean }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtAgo = (iso:string) => { const s=(Date.now()-new Date(iso).getTime())/1000; if(s<60)return"à l'instant"; if(s<3600)return`${Math.floor(s/60)} min`; if(s<86400)return`${Math.floor(s/3600)} h`; return`${Math.floor(s/86400)} j`; };
const fmtK   = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const resolveImg = (id:number, img:string|null) => { if(!img)return`https://picsum.photos/seed/w${id}/800/500`; if(img.startsWith('http'))return img; try{return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;}catch{return`https://picsum.photos/seed/w${id}/800/500`;} };

/** ★ ALGORITHME CENTRAL — score engagement + fraîcheur + genre affinité */
function computePostScore(post: { likes:number; shares:number; created_at:string; work_genre:string }, genreAffinity: Record<string,number> = {}): number {
  const ageSec = (Date.now() - new Date(post.created_at).getTime()) / 1000;
  const recencyBonus = Math.max(0, 3600 - ageSec) / 60; // décroît sur 1h
  const genreBoost   = (genreAffinity[post.work_genre] ?? 0) * 5;
  return Math.round(post.likes * 1.5 + post.shares * 3 + recencyBonus + genreBoost);
}
function computeWorkScore(w:Work): number {
  const ageDays=(Date.now()-new Date(w.created_at).getTime())/86_400_000;
  return Math.round(w.likes*1.5+(w.comments??0)*1.2+Math.max(0,60-ageDays)*2+(w.is_original?40:0));
}
const FEED_FIELDS='id,user_id,work_id,work_title,work_year,work_director,work_genre,rating,body,image_url,tags,tone,likes_count,shares_count,created_at';
function mapPost(r:any, genreAffinity:Record<string,number>={}): Post {
  const tone:Tone=(r.tone&&(TONE_KEYS as readonly string[]).includes(r.tone))?r.tone:'analyse';
  const base={likes:r.likes_count??0,shares:r.shares_count??0,created_at:r.created_at,work_genre:r.work_genre??''};
  return {
    id:r.id, userId:r.user_id, userName:r.profiles?.display_name??'Cinéphile',
    avatar:r.profiles?.avatar_url??`https://i.pravatar.cc/80?u=${r.user_id}`,
    timeAgo:fmtAgo(r.created_at), content:r.body??'',
    likes:base.likes, shares:base.shares, workId:r.work_id??0,
    work_title:r.work_title??'', work_year:r.work_year??'', work_director:r.work_director??'',
    work_genre:r.work_genre??'', rating:r.rating??0, image_url:r.image_url??'',
    tags:Array.isArray(r.tags)?r.tags:[], tone, created_at:r.created_at,
    isRecent:(Date.now()-new Date(r.created_at).getTime())<30*60*1000,
    algoScore:computePostScore(base,genreAffinity),
  };
}

// ─── DB ───────────────────────────────────────────────────────────────────────
async function dbToggleLike(postId:string,userId:string,was:boolean) {
  if(was){await supabase.from('post_likes').delete().match({post_id:postId,user_id:userId});await supabase.rpc('decrement_likes',{pid:postId});}
  else{await supabase.from('post_likes').insert({post_id:postId,user_id:userId});await supabase.rpc('increment_likes',{pid:postId});}
}
async function dbRecordShare(postId:string,userId:string,platform:string){await supabase.from('post_shares').insert({post_id:postId,user_id:userId,platform});}
async function dbPublishPost(payload:Record<string,unknown>):Promise<string|null> {
  try{let uid=(await supabase.auth.getSession()).data.session?.user?.id;if(!uid)uid=(await supabase.auth.signInAnonymously()).data.session?.user?.id;if(!uid)return null;const{data,error}=await supabase.from('community_posts').insert({...payload,user_id:uid}).select('id').single();if(error)throw error;return(data as any)?.id??null;}catch{return null;}
}
async function uploadImage(uri:string):Promise<string|null> {
  try{const isBlob=uri.startsWith('blob:');const ext=['jpg','jpeg','png','webp'].includes(uri.split('.').pop()?.toLowerCase()??'')?uri.split('.').pop()!:'jpg';const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';const path=`posts/post_${Date.now()}.${ext}`;let payload:Blob|ArrayBuffer;if(Platform.OS==='web'||isBlob){payload=await fetch(uri).then(r=>r.blob());}else{payload=decode!(await FileSystem!.readAsStringAsync(uri,{encoding:'base64'}));}const{data,error}=await supabase.storage.from('community-images').upload(path,payload,{contentType:mime,upsert:false});if(error)throw error;return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;}catch{return null;}
}
async function dbSendConnection(proId:string,userId:string,message:string){
  const{data:existing}=await supabase.from('pro_connections').select('id').eq('requester_id',userId).eq('pro_id',proId).single();
  if(existing){return supabase.from('pro_connections').update({status:'pending',message:message.trim(),updated_at:new Date().toISOString()}).eq('id',existing.id);}
  return supabase.from('pro_connections').insert({requester_id:userId,pro_id:proId,status:'pending',message:message.trim()});
}

// ─── INTERACTION CONTEXT ──────────────────────────────────────────────────────
interface ICtx{liked:Record<string,boolean>;saved:Record<string,boolean>;toggleLike:(id:string,uid:string)=>void;toggleSave:(id:string)=>void;sharePost:(id:string,title:string,uid:string)=>Promise<void>}
const ICtx=createContext<ICtx>({liked:{},saved:{},toggleLike:()=>{},toggleSave:()=>{},sharePost:async()=>{}});
function InteractionProvider({children,onToggleLike}:{children:React.ReactNode;onToggleLike:(id:string,uid:string,was:boolean)=>void}){
  const[liked,setLiked]=useState<Record<string,boolean>>({});
  const[saved,setSaved]=useState<Record<string,boolean>>({});
  const toggleLike=useCallback((id:string,uid:string)=>{const was=!!liked[id];setLiked(p=>({...p,[id]:!was}));onToggleLike(id,uid,was);},[liked,onToggleLike]);
  const toggleSave=useCallback((id:string)=>setSaved(p=>({...p,[id]:!p[id]})),[]);
  const sharePost=useCallback(async(id:string,title:string,uid:string)=>{try{const r=await Share.share({message:`Découvrez cette critique de "${title}" sur Universe !`});if(r.action===Share.sharedAction)await dbRecordShare(id,uid,r.activityType??'unknown');}catch{}},[]);
  return<ICtx.Provider value={{liked,saved,toggleLike,toggleSave,sharePost}}>{children}</ICtx.Provider>;
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function usePostsFeed(tab:FeedTab,genreAffinity:Record<string,number>){
  const[posts,setPosts]=useState<Post[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[newCount,setNewCount]=useState(0);
  const[rk,setRk]=useState(0);
  const refresh=useCallback(()=>{setNewCount(0);setRk(k=>k+1);},[]);
  useEffect(()=>{
    if(tab==='Pros'){setLoading(false);return;}
    let dead=false; setLoading(true); setError(null);
    supabase.from('community_posts_enriched').select(FEED_FIELDS).order('created_at',{ascending:false}).limit(POSTS_LIMIT)
      .then(({data,error:err})=>{if(dead)return;if(err){setError('Impossible de charger le feed.');setLoading(false);return;}
        const mapped=(data??[]).filter(r=>r&&'id'in r).map(r=>mapPost(r as any,genreAffinity));
        // ★ Tri algo : "Pour vous" trié par algoScore, "Tendances" par engagement
        const sorted=tab==='Pour vous'?[...mapped].sort((a,b)=>b.algoScore-a.algoScore):mapped;
        setPosts(sorted);setLoading(false);
      });
    return()=>{dead=true;};
  },[tab,rk,genreAffinity]);

  useEffect(()=>{
    if(tab==='Pros')return;
    const ch=supabase.channel(`soc_rt_${Date.now()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_posts'},async payload=>{
        const{data}=await supabase.from('community_posts').select(FEED_FIELDS).eq('id',payload.new.id).single();
        if(!data)return;
        const p=mapPost(data as any,genreAffinity);
        setPosts(prev=>prev.some(x=>x.id===p.id)?prev:[p,...prev]);
        setNewCount(n=>n+1);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'community_posts'},({new:row})=>{
        setPosts(prev=>prev.map(p=>p.id===row.id?{...p,likes:row.likes_count??p.likes,shares:row.shares_count??p.shares,algoScore:computePostScore({...p,likes:row.likes_count??p.likes,shares:row.shares_count??p.shares},genreAffinity)}:p));
      }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[tab,genreAffinity]);

  const toggleLike=useCallback(async(postId:string,userId:string,was:boolean)=>{
    setPosts(prev=>prev.map(p=>p.id!==postId?p:{...p,likes:p.likes+(was?-1:1)}));
    try{await dbToggleLike(postId,userId,was);}catch{setPosts(prev=>prev.map(p=>p.id!==postId?p:{...p,likes:p.likes+(was?1:-1)}));}
  },[]);

  return{posts,loading,error,refresh,toggleLike,newCount};
}

function useWorksAlgorithm(){
  const[works,setWorks]=useState<Work[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{let dead=false;supabase.from('works').select('id,title,category,genre,year,likes,comments,image,is_original,duration,director,created_at').order('likes',{ascending:false}).limit(WORKS_LIMIT).then(({data})=>{if(dead)return;setWorks(((data??[]) as Work[]).map(w=>({...w,score:computeWorkScore(w)})).sort((a,b)=>(b.score??0)-(a.score??0)));setLoading(false);});return()=>{dead=true;};},[]);
  return{works,loading};
}

function useProDirectory(search:string,role:string){
  const[pros,setPros]=useState<Pro[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{let q=supabase.from('professionals').select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to,created_at').order('verified',{ascending:false}).order('name',{ascending:true}).limit(80);if(role&&role!=='Tous')q=q.eq('role',role);if(search.trim())q=q.ilike('name',`%${search.trim()}%`);const{data,error:err}=await q;if(err)throw err;setPros((data??[]) as Pro[]);}catch{setError('Impossible de charger le répertoire.');}finally{setLoading(false);}},[ search,role]);
  useEffect(()=>{load();},[load]);
  return{pros,loading,error,refresh:load};
}

function useConnections(userId:string){
  const[connections,setConnections]=useState<Record<string,ConnStatus>>({});
  useEffect(()=>{if(!userId||userId==='anonymous')return;supabase.from('pro_connections').select('pro_id,status').eq('requester_id',userId).then(({data})=>{const m:Record<string,ConnStatus>={};(data??[]).forEach((r:any)=>{m[r.pro_id]=r.status;});setConnections(m);});},[userId]);
  useEffect(()=>{if(!userId||userId==='anonymous')return;const ch=supabase.channel(`conn_${userId}_${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'pro_connections'},({new:row})=>{const r=row as any;if(r?.pro_id)setConnections(p=>({...p,[r.pro_id]:r.status}));}).subscribe();return()=>{supabase.removeChannel(ch);};},[userId]);
  const setStatus=useCallback((proId:string,status:ConnStatus)=>setConnections(p=>({...p,[proId]:status})),[]);
  return{connections,setStatus};
}

// ─── STAR ROW ─────────────────────────────────────────────────────────────────
const StarRow=memo(({value,size=11}:{value:number;size?:number})=>(
  <View style={{flexDirection:'row',gap:1}}>
    {[1,2,3,4,5].map(s=><Ionicons key={s} name={value>=s?'star':value>=s-0.5?'star-half':'star-outline'} size={size} color={value>=s||value>=s-0.5?C.offWhite:C.subtle}/>)}
  </View>
));

// ─── NEW POSTS BANNER ─────────────────────────────────────────────────────────
const NewPostsBanner=memo(({count,onPress}:{count:number;onPress:()=>void})=>{
  const ty=useRef(new Animated.Value(-60)).current;
  useEffect(()=>{Animated.spring(ty,{toValue:count>0?0:-60,tension:60,friction:10,useNativeDriver:true}).start();},[count,ty]);
  if(!count)return null;
  return(<Animated.View style={[nb.wrap,{transform:[{translateY:ty}]}]}><TouchableOpacity style={nb.inner} onPress={onPress} activeOpacity={0.88}><BlurView intensity={Platform.OS==='ios'?40:28} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={{width:6,height:6,borderRadius:3,backgroundColor:C.white}}/><Text style={nb.txt}>{count} nouvelle{count>1?'s':''} critique{count>1?'s':''}</Text><Ionicons name="arrow-up-outline" size={13} color={C.offWhite}/></TouchableOpacity></Animated.View>);
});
const nb=StyleSheet.create({wrap:{position:'absolute',top:0,left:EDGE,right:EDGE,zIndex:100},inner:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingVertical:11,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},txt:{flex:1,color:C.offWhite,fontSize:12,fontWeight:'700'}});

// ─── ★ ALGO SCORE BADGE ───────────────────────────────────────────────────────
const AlgoScoreBadge=memo(({score,isTop}:{score:number;isTop:boolean})=>(
  <View style={[asb.wrap,isTop&&asb.top]}>
    <Ionicons name={isTop?'flame-outline':'trending-up-outline'} size={7} color={isTop?C.white:C.muted}/>
    <Text style={[asb.txt,isTop&&{color:C.white}]}>{score}</Text>
  </View>
));
const asb=StyleSheet.create({wrap:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2,borderRadius:6,backgroundColor:'rgba(7,12,23,0.75)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},top:{borderColor:'rgba(255,255,255,0.35)',backgroundColor:'rgba(255,255,255,0.12)'},txt:{color:C.muted,fontSize:7,fontWeight:'800'}});

// ─── COMPACT POST CARD (Pour vous) ────────────────────────────────────────────
const THUMB_W=92, THUMB_H=122;
const CompactPostCard=memo(function CompactPostCard({post,userId}:{post:Post;userId:string}){
  const router=useRouter();
  const{liked,saved,toggleLike,toggleSave,sharePost}=useContext(ICtx);
  const isLiked=!!liked[post.id],isSaved=!!saved[post.id];
  const likeA=useRef(new Animated.Value(1)).current;
  const toneInfo=useMemo(()=>TONES.find(t=>t.key===post.tone)??TONES[0],[post.tone]);
  const imgSrc=useMemo(()=>post.image_url?{uri:post.image_url}:{uri:`https://picsum.photos/seed/${post.id}/400/600`},[post.image_url,post.id]);
  const onLike=useCallback(()=>{Animated.sequence([Animated.spring(likeA,{toValue:1.45,tension:300,friction:7,useNativeDriver:true}),Animated.spring(likeA,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});toggleLike(post.id,userId);},[post.id,userId,toggleLike,likeA]);
  return(
    <View style={cpc.wrap}>
      <TouchableOpacity onPress={()=>post.workId&&router.push(`/film/${post.workId}` as any)} activeOpacity={0.90} style={cpc.thumb}>
        <Image source={imgSrc} style={{width:'100%',height:'100%'}} resizeMode="cover"/>
        <LinearGradient colors={['rgba(7,12,23,0.06)','rgba(7,12,23,0.78)']} style={StyleSheet.absoluteFillObject}/>
        {post.isRecent&&<View style={cpc.recentBadge}><Text style={cpc.recentTxt}>RÉCENT</Text></View>}
        <View style={cpc.toneBadge}><Ionicons name={toneInfo.icon} size={9} color={C.muted}/></View>
        <View style={{position:'absolute',bottom:7,left:6,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:7,backgroundColor:'rgba(7,12,23,0.80)'}}><Ionicons name="star" size={8} color={C.offWhite}/><Text style={{color:C.offWhite,fontSize:8,fontWeight:'800'}}>{post.rating.toFixed(1)}</Text></View>
        {/* ★ Score algo visible */}
        <View style={{position:'absolute',bottom:7,right:6}}><AlgoScoreBadge score={post.algoScore} isTop={post.algoScore>50}/></View>
      </TouchableOpacity>
      <TouchableOpacity style={cpc.body} onPress={()=>router.push(`/review/${post.id}` as any)} activeOpacity={0.88}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={cpc.workTitle} numberOfLines={1}>{post.work_title||'Œuvre'}</Text>{!!post.work_year&&<Text style={cpc.workYear}>{post.work_year}</Text>}</View>
        {!!post.work_genre&&<Text style={{color:C.mid,fontSize:9,fontWeight:'700',letterSpacing:0.3}}>{post.work_genre}</Text>}
        <StarRow value={post.rating} size={10}/>
        <Text style={cpc.excerpt} numberOfLines={3}>{post.content}</Text>
        {post.tags.length>0&&<View style={{flexDirection:'row',gap:5}}>{post.tags.slice(0,2).map(tag=><View key={tag} style={cpc.tag}><Text style={cpc.tagTxt}>{tag}</Text></View>)}</View>}
        <View style={{flexDirection:'row',alignItems:'center',gap:5}}><Image source={{uri:post.avatar}} style={cpc.avi}/><Text style={{color:C.muted,fontSize:9,fontWeight:'600',flex:1}} numberOfLines={1}>{post.userName}</Text><Text style={{color:C.muted,fontSize:9,opacity:0.7}}>{post.timeAgo}</Text></View>
      </TouchableOpacity>
      <View style={cpc.actions}>
        <TouchableOpacity style={cpc.actionBtn} onPress={onLike} activeOpacity={0.78}><Animated.View style={{transform:[{scale:likeA}]}}><Ionicons name={isLiked?'heart':'heart-outline'} size={17} color={isLiked?C.white:C.muted}/></Animated.View><Text style={[cpc.cnt,isLiked&&{color:C.offWhite}]}>{fmtK(post.likes+(isLiked?1:0))}</Text></TouchableOpacity>
        <TouchableOpacity style={cpc.actionBtn} onPress={()=>sharePost(post.id,post.work_title,userId)} activeOpacity={0.78}><Ionicons name="share-outline" size={16} color={C.muted}/>{post.shares>0&&<Text style={cpc.cnt}>{fmtK(post.shares)}</Text>}</TouchableOpacity>
        <TouchableOpacity style={cpc.actionBtn} onPress={()=>toggleSave(post.id)} activeOpacity={0.78}><Ionicons name={isSaved?'bookmark':'bookmark-outline'} size={16} color={isSaved?C.white:C.muted}/></TouchableOpacity>
      </View>
    </View>
  );
});
const cpc=StyleSheet.create({wrap:{flexDirection:'row',marginHorizontal:EDGE,marginBottom:10,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},thumb:{width:THUMB_W,height:THUMB_H,position:'relative'},recentBadge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.80)'},recentTxt:{color:C.white,fontSize:6.5,fontWeight:'900',letterSpacing:0.8},toneBadge:{position:'absolute',top:7,right:7,width:20,height:20,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(7,12,23,0.72)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},body:{flex:1,padding:11,gap:4,justifyContent:'space-between'},workTitle:{color:C.white,fontSize:12,fontWeight:'800',flex:1,letterSpacing:-0.2},workYear:{color:C.muted,fontSize:10,fontWeight:'600'},excerpt:{color:C.muted,fontSize:11,lineHeight:16,fontStyle:'italic',flex:1},tag:{paddingHorizontal:7,paddingVertical:2,borderRadius:8,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},tagTxt:{color:C.muted,fontSize:8,fontWeight:'600'},avi:{width:16,height:16,borderRadius:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},actions:{width:36,alignItems:'center',justifyContent:'space-evenly',paddingVertical:8,borderLeftWidth:StyleSheet.hairlineWidth,borderLeftColor:C.border},actionBtn:{alignItems:'center',gap:2,paddingVertical:5},cnt:{color:C.muted,fontSize:8,fontWeight:'700'}});

// ─── GRID POST CARD (Tendances) ────────────────────────────────────────────────
const GridPostCard=memo(function GridPostCard({post,userId,isTopScore}:{post:Post;userId:string;isTopScore:boolean}){
  const router=useRouter();
  const{liked,toggleLike}=useContext(ICtx);
  const isLiked=!!liked[post.id];
  const likeA=useRef(new Animated.Value(1)).current;
  const toneInfo=useMemo(()=>TONES.find(t=>t.key===post.tone)??TONES[0],[post.tone]);
  const imgSrc=useMemo(()=>post.image_url?{uri:post.image_url}:{uri:`https://picsum.photos/seed/${post.id}/400/600`},[post.image_url,post.id]);
  const onLike=useCallback(()=>{Animated.sequence([Animated.spring(likeA,{toValue:1.5,tension:300,friction:7,useNativeDriver:true}),Animated.spring(likeA,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});toggleLike(post.id,userId);},[post.id,userId,toggleLike,likeA]);
  return(
    <TouchableOpacity style={gpc.wrap} onPress={()=>post.workId&&router.push(`/film/${post.workId}` as any)} onLongPress={()=>router.push(`/review/${post.id}` as any)} activeOpacity={0.88}>
      <Image source={imgSrc} style={{position:'absolute',top:0,left:0,right:0,bottom:0}} resizeMode="cover"/>
      <LinearGradient colors={['rgba(7,12,23,0.08)','rgba(7,12,23,0.97)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.2}} end={{x:0,y:1}}/>
      {post.isRecent&&<View style={gpc.recentBadge}><View style={{width:5,height:5,borderRadius:2.5,backgroundColor:C.white}}/><Text style={gpc.recentTxt}>RÉCENT</Text></View>}
      <View style={gpc.toneBadge}><Ionicons name={toneInfo.icon} size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'700'}}>{toneInfo.label}</Text></View>
      {/* ★ Score algo proéminent sur les tendances */}
      <View style={{position:'absolute',top:9,right:9}}><AlgoScoreBadge score={post.algoScore} isTop={isTopScore}/></View>
      <View style={gpc.meta}>
        {!!post.work_genre&&<Text style={{color:C.muted,fontSize:8,fontWeight:'700',letterSpacing:0.8}}>{post.work_genre.toUpperCase()}</Text>}
        <Text style={gpc.title} numberOfLines={2}>{post.work_title||'Œuvre'}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><StarRow value={post.rating} size={9}/><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{post.rating.toFixed(1)}</Text></View>
        <View style={{flexDirection:'row',alignItems:'center',gap:5,marginTop:2}}>
          <Image source={{uri:post.avatar}} style={{width:15,height:15,borderRadius:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}/>
          <Text style={{color:C.muted,fontSize:9,flex:1}} numberOfLines={1}>{post.userName}</Text>
          <TouchableOpacity onPress={onLike} activeOpacity={0.78} style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <Animated.View style={{transform:[{scale:likeA}]}}><Ionicons name={isLiked?'heart':'heart-outline'} size={12} color={isLiked?C.white:C.muted}/></Animated.View>
            <Text style={{color:isLiked?C.white:C.muted,fontSize:9,fontWeight:'700'}}>{fmtK(post.likes+(isLiked?1:0))}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const gpc=StyleSheet.create({wrap:{width:GRID_W,height:235,borderRadius:14,overflow:'hidden',backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},recentBadge:{position:'absolute',top:9,left:9,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:7,paddingVertical:3.5,borderRadius:9,backgroundColor:'rgba(7,12,23,0.82)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},recentTxt:{color:C.offWhite,fontSize:7.5,fontWeight:'900',letterSpacing:0.8},toneBadge:{position:'absolute',top:34,left:9,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:9,backgroundColor:'rgba(7,12,23,0.72)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},meta:{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:4},title:{color:C.white,fontSize:12,fontWeight:'800',lineHeight:16,letterSpacing:-0.2}});

// ─── WORK MINI CARD ───────────────────────────────────────────────────────────
const WorkMiniCard=memo(({work,rank}:{work:Work;rank?:number})=>{const router=useRouter();const uri=useMemo(()=>resolveImg(work.id,work.image),[work.id,work.image]);return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${work.id}` as any)} activeOpacity={0.88}><View style={{width:138,height:192,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid}}><Image source={{uri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/><View style={{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'}}><Text style={{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4}}>{work.is_original?'ORIG':(work.category??'').slice(0,4).toUpperCase()}</Text></View>{work.score!=null&&<View style={{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(7,12,23,0.72)',paddingHorizontal:5,paddingVertical:2.5,borderRadius:5}}><Ionicons name="trending-up-outline" size={7} color={C.mid}/><Text style={{color:C.mid,fontSize:7,fontWeight:'800'}}>{work.score}</Text></View>}{rank!=null&&<Text style={{position:'absolute',bottom:30,right:5,fontSize:44,fontWeight:'900',lineHeight:44,letterSpacing:-4,color:'rgba(255,255,255,0.10)'}}>{rank}</Text>}<View style={{position:'absolute',bottom:7,left:8,right:8,gap:2}}><Text style={{color:C.white,fontSize:10,fontWeight:'800',lineHeight:13}} numberOfLines={2}>{work.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.muted,fontSize:9,fontWeight:'600'}}>{fmtK(work.likes??0)}</Text>{work.duration&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={{color:C.muted,fontSize:9,fontWeight:'600'}}>{work.duration}min</Text></>}</View></View></View></TouchableOpacity>);});

// ─── ★ ALGORITHM BANNER — N°1 score réel ─────────────────────────────────────
const AlgorithmBanner=memo(({works}:{works:Work[]})=>{const router=useRouter();const top=works[0];if(!top)return null;return(<TouchableOpacity style={alb.wrap} onPress={()=>router.push(`/film/${top.id}` as any)} activeOpacity={0.90}><Image source={{uri:resolveImg(top.id,top.image)}} style={StyleSheet.absoluteFillObject as any} resizeMode="cover"/><LinearGradient colors={['rgba(7,12,23,0.22)','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject}/><View style={alb.content}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={alb.badge}><Ionicons name="flame-outline" size={10} color={C.offWhite}/><Text style={alb.badgeTxt}>N°1 · SCORE UNIVERSE {top.score}</Text></View>{top.is_original&&<View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:7,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Text style={{color:C.mid,fontSize:8,fontWeight:'800',letterSpacing:0.5}}>ORIGINAL</Text></View>}</View><Text style={alb.title} numberOfLines={2}>{top.title}</Text><Text style={{color:C.muted,fontSize:11}}>{[top.director,String(top.year),top.genre].filter(Boolean).join(' · ')}</Text><View style={{flexDirection:'row',gap:14,alignItems:'center'}}><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={11} color={C.mid}/><Text style={{color:C.mid,fontSize:11,fontWeight:'600'}}>{fmtK(top.likes??0)}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="bar-chart-outline" size={11} color={C.mid}/><Text style={{color:C.mid,fontSize:11,fontWeight:'600'}}>Score {top.score}</Text></View></View></View></TouchableOpacity>);});
const alb=StyleSheet.create({wrap:{marginHorizontal:EDGE,marginBottom:16,height:166,borderRadius:18,overflow:'hidden'},content:{position:'absolute',bottom:0,left:0,right:0,padding:16,gap:6},badge:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:4,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(7,12,23,0.70)',marginBottom:2},badgeTxt:{color:C.mid,fontSize:8,fontWeight:'800',letterSpacing:0.8},title:{color:C.white,fontSize:19,fontWeight:'900',letterSpacing:-0.4,lineHeight:24}});

// ─── TRENDING ROW ─────────────────────────────────────────────────────────────
const TrendingRow=memo(({works,loading}:{works:Work[];loading:boolean})=>{const router=useRouter();return(<View style={{marginBottom:16}}><View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}><Ionicons name="bar-chart-outline" size={13} color={C.mid}/><Text style={{color:C.offWhite,fontSize:14,fontWeight:'800'}}>En vogue</Text><TouchableOpacity onPress={()=>router.push('/search' as any)} hitSlop={8} style={{marginLeft:'auto' as any}}><Text style={{color:C.muted,fontSize:11,fontWeight:'600'}}>Tout voir</Text></TouchableOpacity></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE}}>{loading?[0,1,2,3].map(i=><View key={i} style={{width:138,height:192,borderRadius:13,backgroundColor:C.navyMid,marginRight:10}}/>):works.slice(0,10).map((w,i)=><WorkMiniCard key={w.id} work={w} rank={i+1}/>)}</ScrollView></View>);});

// ─── CREATOR SPOTLIGHT ────────────────────────────────────────────────────────
const CreatorSpotlight=memo(({posts}:{posts:Post[]})=>{const router=useRouter();const top=useMemo(()=>{const m:Record<string,{name:string;avatar:string;likes:number;count:number}>={};posts.forEach(p=>{if(!m[p.userId])m[p.userId]={name:p.userName,avatar:p.avatar,likes:0,count:0};m[p.userId].likes+=p.likes;m[p.userId].count+=1;});return Object.entries(m).sort((a,b)=>b[1].likes-a[1].likes).slice(0,6);},[posts]);if(!top.length)return null;return(<View style={{marginBottom:16}}><View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:10}}><Ionicons name="people-outline" size={13} color={C.mid}/><Text style={{color:C.offWhite,fontSize:13,fontWeight:'800'}}>Top critiques</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:8}}>{top.map(([uid,info])=><TouchableOpacity key={uid} style={csp.card} onPress={()=>router.push(`/user/${uid}` as any)} activeOpacity={0.80}><BlurView intensity={Platform.OS==='ios'?10:7} tint="dark" style={StyleSheet.absoluteFillObject}/><Image source={{uri:info.avatar}} style={csp.avi}/><View><Text style={csp.name} numberOfLines={1}>{info.name}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:2}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:9}}>{fmtK(info.likes)}</Text><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={{color:C.muted,fontSize:9}}>{info.count} crit.</Text></View></View></TouchableOpacity>)}</ScrollView></View>);});
const csp=StyleSheet.create({card:{flexDirection:'row',alignItems:'center',gap:9,overflow:'hidden',paddingVertical:9,paddingHorizontal:12,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},avi:{width:30,height:30,borderRadius:15,borderWidth:1,borderColor:C.border},name:{color:C.offWhite,fontSize:11,fontWeight:'700',maxWidth:90}});

// ─── GENRE RADAR ──────────────────────────────────────────────────────────────
const GenreRadar=memo(({posts}:{posts:Post[]})=>{const counts=useMemo(()=>{const m:Record<string,number>={};posts.forEach(p=>{if(p.work_genre)m[p.work_genre]=(m[p.work_genre]??0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);},[posts]);if(!counts.length)return null;const max=counts[0]?.[1]??1;return(<View style={gr.wrap}><BlurView intensity={Platform.OS==='ios'?10:7} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={{padding:14}}><View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:12}}><Ionicons name="pie-chart-outline" size={12} color={C.mid}/><Text style={{color:C.offWhite,fontSize:12,fontWeight:'800'}}>Genres du moment</Text></View>{counts.map(([genre,count])=><View key={genre} style={{flexDirection:'row',alignItems:'center',gap:9,marginBottom:8}}><Text style={{color:C.mid,fontSize:11,fontWeight:'600',width:90}} numberOfLines={1}>{genre}</Text><View style={{flex:1,height:4,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><View style={{height:'100%',borderRadius:2,backgroundColor:C.subtle,width:`${(count/max)*100}%` as any}}/></View><Text style={{color:C.muted,fontSize:9,fontWeight:'700',width:18,textAlign:'right'}}>{count}</Text></View>)}</View></View>);});
const gr=StyleSheet.create({wrap:{marginHorizontal:EDGE,marginBottom:16,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}});

// ─── PRO CARD ─────────────────────────────────────────────────────────────────
const ProCard=memo(function ProCard({pro,status,onConnect}:{pro:Pro;status:ConnStatus;onConnect:(p:Pro)=>void}){const connected=status==='accepted',pending=status==='pending';return(<View style={proc.wrap}><BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={proc.inner}><View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}><View style={{position:'relative'}}><Image source={{uri:pro.avatar??`https://i.pravatar.cc/120?u=${pro.id}`}} style={proc.avatar} resizeMode="cover"/>{pro.verified&&<View style={proc.vDot}><Ionicons name="checkmark" size={8} color={C.white}/></View>}</View><View style={{flex:1,gap:3}}><Text style={proc.name} numberOfLines={1}>{pro.name}</Text><Text style={{color:C.muted,fontSize:11}}>{pro.role}</Text>{pro.location&&<View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="location-outline" size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:10}}>{pro.location}</Text></View>}</View>{status!=='none'&&<View style={{paddingHorizontal:8,paddingVertical:3,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{connected?'Connecté':pending?'En attente':'Refusé'}</Text></View>}</View>{!!pro.bio&&<Text style={{color:C.mid,fontSize:12,lineHeight:17}} numberOfLines={2}>{pro.bio}</Text>}{pro.films.length>0&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>{pro.films.slice(0,5).map(f=><View key={f} style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:4,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,maxWidth:120}}><Ionicons name="film-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1}} numberOfLines={1}>{f}</Text></View>)}</ScrollView>}{pro.open_to.length>0&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>{pro.open_to.slice(0,4).map(o=><View key={o} style={{paddingHorizontal:9,paddingVertical:3,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.muted,fontSize:9,fontWeight:'600'}}>{o}</Text></View>)}</View>}<View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border}}/><View style={{flexDirection:'row',gap:9}}><TouchableOpacity style={[proc.connBtn,connected&&proc.connBtnOn]} onPress={()=>{if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});onConnect(pro);}} activeOpacity={0.82}><Ionicons name={connected?'people':pending?'time-outline':'person-add-outline'} size={13} color={connected?C.white:C.muted}/><Text style={[{color:C.muted,fontSize:12,fontWeight:'700'},connected&&{color:C.white}]}>{connected?'Connecté':pending?'En attente':'Se connecter'}</Text></TouchableOpacity>{pro.website&&<TouchableOpacity style={{width:40,height:40,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'}} onPress={()=>Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.80}><Ionicons name="globe-outline" size={14} color={C.muted}/></TouchableOpacity>}</View></View></View>);});
const proc=StyleSheet.create({wrap:{marginHorizontal:EDGE,marginBottom:10,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},inner:{padding:16,gap:12},avatar:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:C.border},vDot:{position:'absolute',bottom:-1,right:-1,width:16,height:16,borderRadius:8,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.borderHi,alignItems:'center',justifyContent:'center'},name:{color:C.white,fontSize:14,fontWeight:'800',letterSpacing:-0.2},connBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:10,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},connBtnOn:{borderColor:C.borderHi,backgroundColor:C.subtle}});

// ─── CONNECTION REQUEST MODAL ─────────────────────────────────────────────────
const ConnModal=memo(function ConnModal({pro,status,userId,onClose,onSent}:{pro:Pro|null;status:ConnStatus;userId:string;onClose:()=>void;onSent:(id:string)=>void}){
  const[note,setNote]=useState('');
  const[sending,setSending]=useState(false);
  const[phase,setPhase]=useState<'form'|'success'>('form');
  const slide=useRef(new Animated.Value(900)).current;
  const succSc=useRef(new Animated.Value(0)).current;
  useEffect(()=>{if(pro){setNote('');setSending(false);setPhase(status==='accepted'?'success':'form');Animated.spring(slide,{toValue:0,tension:60,friction:12,useNativeDriver:true}).start();}else{Animated.timing(slide,{toValue:900,duration:240,useNativeDriver:true}).start();}},[pro,status]);
  const handleSend=useCallback(async()=>{if(!pro||note.trim().length<20)return;setSending(true);const{error:err}=await dbSendConnection(pro.id,userId,note);setSending(false);if(!err){setPhase('success');Animated.spring(succSc,{toValue:1,tension:80,friction:8,useNativeDriver:true}).start();onSent(pro.id);setTimeout(onClose,2500);}else{Alert.alert('Erreur','Impossible d\'envoyer la demande.');}},[pro,userId,note,onSent,onClose]);
  if(!pro)return null;
  const charOk=note.trim().length>=20;
  return(<Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><View style={{flex:1,justifyContent:'flex-end'}}><Pressable style={StyleSheet.absoluteFill} onPress={onClose}/><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end'}}><Animated.View style={{maxHeight:'90%',borderTopLeftRadius:26,borderTopRightRadius:26,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,transform:[{translateY:slide}]}}><BlurView intensity={Platform.OS==='ios'?90:70} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={{width:36,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:12}}/>{phase==='success'?(<View style={{alignItems:'center',padding:40,gap:14}}><Animated.View style={{width:76,height:76,borderRadius:38,borderWidth:1,borderColor:C.border,backgroundColor:C.subtle,alignItems:'center',justifyContent:'center',transform:[{scale:succSc}]}}><Ionicons name="checkmark" size={34} color={C.white}/></Animated.View><Text style={{color:C.white,fontSize:20,fontWeight:'900'}}>Demande envoyée</Text><Text style={{color:C.muted,fontSize:13,textAlign:'center',lineHeight:20}}>{pro.name} recevra votre invitation.</Text></View>):(<><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={{flexDirection:'row',alignItems:'flex-start',gap:14,padding:20}}><Image source={{uri:pro.avatar??`https://i.pravatar.cc/100?u=${pro.id}`}} style={{width:52,height:52,borderRadius:26,borderWidth:1,borderColor:C.border}} resizeMode="cover"/><View style={{flex:1,gap:3}}><Text style={{color:C.white,fontSize:15,fontWeight:'900'}}>{pro.name}</Text><Text style={{color:C.muted,fontSize:11}}>{pro.role}</Text></View><TouchableOpacity style={{width:30,height:30,borderRadius:15,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'}} onPress={onClose}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity></View><View style={{paddingHorizontal:20}}><Text style={{color:C.white,fontSize:13,fontWeight:'700',marginBottom:8}}>Note personnalisée <Text style={{color:C.muted,fontSize:10,fontWeight:'600'}}>min 20 car.</Text></Text><TextInput style={{color:C.white,fontSize:14,minHeight:120,lineHeight:22,paddingVertical:4}} value={note} onChangeText={setNote} multiline maxLength={300} placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous ai découvert sur Universe…`} placeholderTextColor="rgba(255,255,255,0.16)" selectionColor={C.white}/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:charOk?C.borderHi:C.border,marginBottom:6}}/><Text style={{color:charOk?C.white:C.muted,fontSize:10,fontWeight:'700',textAlign:'right'}}>{note.trim().length}/300</Text></View><View style={{height:80}}/></ScrollView><View style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingBottom:Platform.OS==='ios'?34:18,paddingTop:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border}}><TouchableOpacity style={{paddingHorizontal:18,paddingVertical:13,borderRadius:15,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={onClose} activeOpacity={0.80}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity><TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:15,borderWidth:StyleSheet.hairlineWidth,borderColor:charOk?C.borderHi:C.border,backgroundColor:charOk?C.subtle:C.faint,opacity:(sending||!charOk)?0.40:1}} onPress={handleSend} disabled={!charOk||sending} activeOpacity={0.88}>{sending?<ActivityIndicator color={C.white} size="small"/>:<><Ionicons name="person-add-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:14,fontWeight:'800'}}>Se connecter</Text></>}</TouchableOpacity></View></>)}</Animated.View></KeyboardAvoidingView></View></Modal>);
});

// ─── PRO DIRECTORY ────────────────────────────────────────────────────────────
const PRO_ROLES=['Tous','Réalisateur·ice','Producteur·ice','Acteur·ice','Scénariste','Dir. photo','Compositeur·ice','Monteur·euse'] as const;
function ProDirectory({userId}:{userId:string}){
  const[search,setSearch]=useState('');
  const[role,setRole]=useState('Tous');
  const[connectPro,setConnectPro]=useState<Pro|null>(null);
  const[connStatus,setConnStatus]=useState<ConnStatus>('none');
  const{pros,loading,error,refresh}=useProDirectory(search,role);
  const{connections,setStatus}=useConnections(userId);
  const grouped=useMemo(()=>{if(!pros.length)return[];if(role!=='Tous')return[{title:role,data:pros}];const m:Record<string,Pro[]>={};pros.forEach(p=>{const c=p.role?.trim()||'Autre';if(!m[c])m[c]=[];m[c].push(p);});return Object.entries(m).sort(([a],[b])=>a.localeCompare(b,'fr')).map(([title,data])=>({title,data}));},[pros,role]);
  const handleOpen=useCallback((pro:Pro)=>{setConnStatus(connections[pro.id]??'none');setConnectPro(pro);},[connections]);
  return(<View style={{flex:1}}><View style={{padding:EDGE,gap:12}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name="search-outline" size={14} color={C.muted}/><TextInput style={{flex:1,color:C.white,fontSize:14,paddingVertical:8}} placeholder="Rechercher…" placeholderTextColor="rgba(255,255,255,0.18)" value={search} onChangeText={setSearch} returnKeyType="search" autoCorrect={false} selectionColor={C.white}/>{search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Ionicons name="close-circle" size={14} color={C.muted}/></TouchableOpacity>}</View><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border}}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{PRO_ROLES.map(r=>{const on=role===r;return(<TouchableOpacity key={r} style={{paddingHorizontal:13,paddingVertical:7,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:on?C.borderHi:C.border,backgroundColor:on?C.subtle:C.faint}} onPress={()=>setRole(r)} activeOpacity={0.80}><Text style={{color:on?C.white:C.muted,fontSize:11,fontWeight:on?'700':'600'}}>{r}</Text></TouchableOpacity>);})}</ScrollView></View>{loading?<View style={{alignItems:'center',paddingVertical:60,gap:14}}><ActivityIndicator color={C.muted} size="large"/><Text style={{color:C.muted,fontSize:13}}>Chargement…</Text></View>:error?<View style={{alignItems:'center',paddingVertical:60,gap:12}}><Ionicons name="cloud-offline-outline" size={28} color={C.muted}/><Text style={{color:C.mid,fontSize:13,textAlign:'center',paddingHorizontal:40}}>{error}</Text><TouchableOpacity style={{paddingHorizontal:20,paddingVertical:9,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={refresh}><Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>:<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}} keyboardShouldPersistTaps="handled">{grouped.map(s=>(<View key={s.title}><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:EDGE,paddingTop:22,paddingBottom:12}}><View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:C.border}}/><Text style={{color:C.offWhite,fontSize:10,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase'}}>{s.title}</Text><View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{s.data.length}</Text></View><View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:C.border}}/></View>{s.data.map(pro=><ProCard key={pro.id} pro={pro} status={connections[pro.id]??'none'} onConnect={handleOpen}/>)}</View>))}</ScrollView>}<ConnModal pro={connectPro} status={connStatus} userId={userId} onClose={()=>setConnectPro(null)} onSent={id=>{setStatus(id,'pending');NotifService.connectionRequest({proUserId:id,requesterId:userId,message:'Demande de connexion Universe'}).catch(()=>{});}}/></View>);
}

// ─── COMPOSE MODAL ────────────────────────────────────────────────────────────
const STEPS=['film','critique','media','preview'] as const;
type CStep=typeof STEPS[number];
const STEP_LBL:Record<CStep,string>={film:"L'Œuvre",critique:'Critique',media:'Image',preview:'Aperçu'};
const STEP_ICON:Record<CStep,keyof typeof Ionicons.glyphMap>={film:'film-outline',critique:'create-outline',media:'image-outline',preview:'eye-outline'};
const INIT_FORM:CForm={workTitle:'',workYear:'',workDirector:'',workGenre:'',rating:0,tone:null,body:'',tags:[],imageUri:'',imageUrl:'',imageValid:false};
function ComposeModal({visible,onClose,onPublished,userId}:{visible:boolean;onClose:()=>void;onPublished?:()=>void;userId:string}){
  const[step,setStep]=useState<CStep>('film');
  const[form,setForm]=useState<CForm>(INIT_FORM);
  const[pub,setPub]=useState(false);
  const[imgL,setImgL]=useState(false);
  const[errs,setErrs]=useState<Partial<Record<CStep,string>>>({});
  const slide=useRef(new Animated.Value(800)).current;
  useEffect(()=>{if(visible){setStep('film');setForm(INIT_FORM);setErrs({});Animated.spring(slide,{toValue:0,tension:58,friction:12,useNativeDriver:true}).start();}else{Animated.timing(slide,{toValue:800,duration:220,useNativeDriver:true}).start();}},[visible]);
  const patch=useCallback(<K extends keyof CForm>(k:K,v:CForm[K])=>setForm(f=>({...f,[k]:v})),[]);
  const validate=useCallback((s:CStep):string|null=>{if(s==='film'){if(!form.workTitle.trim())return'Titre obligatoire.';if(!form.workGenre)return'Genre requis.';if(form.rating===0)return'Note requise.';}if(s==='critique'){if(!form.tone)return'Ton requis.';if(form.body.trim().length<MIN_BODY)return`Min ${MIN_BODY} car.`;}return null;},[form]);
  const goNext=useCallback(()=>{const err=validate(step);if(err){setErrs(e=>({...e,[step]:err}));return;}setErrs(e=>({...e,[step]:''}));const i=STEPS.indexOf(step);if(i<STEPS.length-1)setStep(STEPS[i+1]);},[step,validate]);
  const goBack=useCallback(()=>{const i=STEPS.indexOf(step);if(i>0)setStep(STEPS[i-1]);},[step]);
  const pickImage=useCallback(async()=>{const{granted}=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!granted){Alert.alert('Permission requise');return;}const res=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.85,allowsEditing:true,aspect:[16,9]});if(res.canceled||!res.assets?.[0])return;patch('imageUri',res.assets[0].uri);patch('imageValid',false);patch('imageUrl','');setImgL(true);setErrs(e=>({...e,media:''}));const url=await uploadImage(res.assets[0].uri);setImgL(false);if(!url){setErrs(e=>({...e,media:'Upload échoué.'}));return;}patch('imageUrl',url);patch('imageValid',true);},[patch]);
  const publish=useCallback(async()=>{if(!form.imageValid||!form.tone)return;setPub(true);const id=await dbPublishPost({work_title:form.workTitle.trim(),work_year:form.workYear.trim(),work_director:form.workDirector.trim(),work_genre:form.workGenre,rating:form.rating,body:form.body.trim(),image_url:form.imageUrl,image_valid:true,tags:form.tags,tone:form.tone});setPub(false);if(id){NotifService.resolveMentions(form.body).then(ids=>ids.forEach(uid=>{if(uid!==userId)NotifService.mention({mentionedUserId:uid,actorId:userId,postId:id,filmTitle:form.workTitle.trim(),bodyExcerpt:form.body.slice(0,80)}).catch(()=>{});}));onPublished?.();onClose();}else{Alert.alert('Erreur','Publication échouée.');}},[form,onPublished,onClose,userId]);
  if(!visible)return null;
  const si=STEPS.indexOf(step),bodyLen=form.body.trim().length,toneInfo=TONES.find(t=>t.key===form.tone);
  return(
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(7,12,23,0.85)'}}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end'}}>
          <Animated.View style={{maxHeight:'94%',borderTopLeftRadius:26,borderTopRightRadius:26,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,transform:[{translateY:slide}]}}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}/>
            <View>
              <View style={{width:36,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:12}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:20,paddingTop:14,paddingBottom:10}}>
                <View>
                  <Text style={{color:C.white,fontSize:18,fontWeight:'800',letterSpacing:-0.3}}>Nouvelle Critique</Text>
                  <Text style={{color:C.muted,fontSize:11,marginTop:3}}>Cinéma indépendant</Text>
                </View>
                <TouchableOpacity style={{width:30,height:30,borderRadius:15,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',alignItems:'center'}} onPress={onClose}>
                  <Ionicons name="close" size={14} color={C.muted}/>
                </TouchableOpacity>
              </View>
              <View style={{flexDirection:'row',paddingHorizontal:20,marginBottom:16,alignItems:'flex-start'}}>
                {STEPS.map((st,i)=>{const done=i<si,curr=i===si;return(<View key={st} style={{flex:1,alignItems:'center',position:'relative'}}>
                  <View style={{width:28,height:28,borderRadius:14,backgroundColor:done?C.navyMid:curr?C.subtle:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:done||curr?C.borderHi:C.border,justifyContent:'center',alignItems:'center',marginBottom:4}}>
                    <Ionicons name={done?'checkmark':STEP_ICON[st]} size={11} color={done||curr?C.white:C.muted}/>
                  </View>
                  <Text style={{color:curr?C.offWhite:C.muted,fontSize:9,fontWeight:'700',letterSpacing:0.2,textAlign:'center'}}>{STEP_LBL[st]}</Text>
                  {i<STEPS.length-1&&<View style={{position:'absolute',top:14,left:'50%',right:'-50%',height:StyleSheet.hairlineWidth,backgroundColor:done?C.subtle:C.border}}/>}
                </View>);})}
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{paddingHorizontal:20}}>
                  {step==='film'&&(<>
                    <Text style={cm.fl}>TITRE *</Text>
                    <TextInput style={cm.inp} placeholderTextColor={C.muted} placeholder="Ex : Portrait de la jeune fille en feu" value={form.workTitle} onChangeText={v=>{patch('workTitle',v);setErrs(e=>({...e,film:''}));}}/>
                    <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
                      <View style={{flex:1}}>
                        <Text style={cm.fl}>RÉALISATEUR</Text>
                        <TextInput style={cm.inp} placeholder="Nom" placeholderTextColor={C.muted} value={form.workDirector} onChangeText={v=>patch('workDirector',v)}/>
                      </View>
                      <View style={{width:84}}>
                        <Text style={cm.fl}>ANNÉE</Text>
                        <TextInput style={cm.inp} placeholder="2025" placeholderTextColor={C.muted} value={form.workYear} onChangeText={v=>patch('workYear',v)} keyboardType="numeric" maxLength={4}/>
                      </View>
                    </View>
                    <Text style={cm.fl}>GENRE *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4,marginBottom:20}}>
                      {GENRES_LIST.map(g=>{const on=form.workGenre===g;return(<TouchableOpacity key={g} style={[cm.chip,on&&cm.chipOn]} onPress={()=>{patch('workGenre',g);setErrs(e=>({...e,film:''}));}}><Text style={[cm.chipTxt,on&&{color:C.white}]}>{g}</Text></TouchableOpacity>);})}
                    </ScrollView>
                    <Text style={cm.fl}>NOTE *</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}}>
                      <View style={{flexDirection:'row',gap:4}}>
                        {[1,2,3,4,5].map(s=><TouchableOpacity key={s} onPress={()=>{patch('rating',s);setErrs(e=>({...e,film:''}));}} hitSlop={6 as any}><Ionicons name={form.rating>=s?'star':'star-outline'} size={28} color={form.rating>=s?C.offWhite:C.subtle}/></TouchableOpacity>)}
                      </View>
                      <Text style={{color:C.mid,fontSize:15,fontWeight:'700'}}>{form.rating>0?`${form.rating}/5`:'—'}</Text>
                    </View>
                    {!!errs.film&&<Text style={cm.err}>{errs.film}</Text>}
                  </>)}
                  {step==='critique'&&(<>
                    <Text style={cm.fl}>TON *</Text>
                    <View style={{flexDirection:'row',flexWrap:'wrap',gap:9,marginBottom:20}}>
                      {TONES.map(t=>{const on=form.tone===t.key;return(<TouchableOpacity key={t.key} style={[cm.toneTile,on&&cm.toneTileOn]} onPress={()=>{patch('tone',t.key);setErrs(e=>({...e,critique:''}));}}><Ionicons name={t.icon} size={18} color={on?C.white:C.muted}/><Text style={{color:on?C.white:C.muted,fontSize:12,fontWeight:'700'}}>{t.label}</Text></TouchableOpacity>);})}
                    </View>
                    <Text style={cm.fl}>CRITIQUE *</Text>
                    <TextInput style={[cm.inp,{minHeight:140,textAlignVertical:'top'}]} multiline placeholder="Analysez la mise en scène…" placeholderTextColor={C.muted} value={form.body} onChangeText={v=>{patch('body',v);setErrs(e=>({...e,critique:''}));}}/>
                    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:8,marginBottom:8}}>
                      <View style={{flex:1,height:2,borderRadius:1,backgroundColor:C.faint,overflow:'hidden'}}>
                        <View style={{height:'100%',borderRadius:1,width:`${Math.min(100,(bodyLen/MIN_BODY)*100)}%` as any,backgroundColor:bodyLen>=MIN_BODY?C.white:C.subtle}}/>
                      </View>
                      <Text style={{color:bodyLen>=MIN_BODY?C.white:C.muted,fontSize:11,fontWeight:'700'}}>{bodyLen}/{MIN_BODY}</Text>
                    </View>
                    <Text style={[cm.fl,{marginTop:12}]}>ASPECTS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4,marginBottom:16}}>
                      {ASPECTS.map(tag=>{const on=form.tags.includes(tag);return(<TouchableOpacity key={tag} style={[cm.chip,on&&cm.chipOn]} onPress={()=>patch('tags',on?form.tags.filter(t=>t!==tag):[...form.tags,tag])}><Text style={[cm.chipTxt,on&&{color:C.white}]}>{tag}</Text></TouchableOpacity>);})}
                    </ScrollView>
                    {!!errs.critique&&<Text style={cm.err}>{errs.critique}</Text>}
                  </>)}
                  {step==='media'&&(<>
                    {form.imageUri?(<View style={{height:200,borderRadius:14,overflow:'hidden',marginBottom:16}}>
                      <Image source={{uri:form.imageUri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>
                      <LinearGradient colors={['transparent','rgba(7,12,23,0.82)']} style={StyleSheet.absoluteFillObject}/>
                      {form.imageValid&&!imgL&&<View style={{position:'absolute',bottom:10,left:10,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(7,12,23,0.80)',paddingHorizontal:10,paddingVertical:5,borderRadius:10}}><Ionicons name="checkmark-circle-outline" size={12} color={C.white}/><Text style={{color:C.white,fontSize:11,fontWeight:'700'}}>Image prête</Text></View>}
                      {imgL&&<View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(7,12,23,0.65)',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={C.white}/></View>}
                      {!imgL&&<TouchableOpacity style={{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(7,12,23,0.75)',paddingHorizontal:10,paddingVertical:5,borderRadius:10}} onPress={pickImage}><Ionicons name="refresh-outline" size={11} color={C.muted}/><Text style={{color:C.muted,fontSize:11}}>Changer</Text></TouchableOpacity>}
                    </View>):(<TouchableOpacity style={{height:180,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,borderStyle:'dashed',alignItems:'center',justifyContent:'center',gap:10,marginBottom:20}} onPress={pickImage} disabled={imgL}><View style={{width:60,height:60,borderRadius:30,backgroundColor:C.faint,justifyContent:'center',alignItems:'center'}}><Ionicons name="image-outline" size={34} color={C.muted}/></View><Text style={{color:C.offWhite,fontSize:13,fontWeight:'700'}}>Sélectionner depuis la galerie</Text><Text style={{color:C.muted,fontSize:11}}>JPEG · PNG · 16:9 recommandé</Text></TouchableOpacity>)}
                    {!!errs.media&&<Text style={cm.err}>{errs.media}</Text>}
                  </>)}
                  {step==='preview'&&(<>
                    <View style={{height:210,borderRadius:16,overflow:'hidden',backgroundColor:C.navyMid,marginBottom:16}}>
                      {form.imageUrl&&<Image source={{uri:form.imageUrl}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>}
                      <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject}/>
                      <View style={{position:'absolute',bottom:0,left:0,right:0,padding:14,gap:5}}>
                        {toneInfo&&<View style={{flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start',paddingHorizontal:8,paddingVertical:3,borderRadius:7,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(7,12,23,0.72)',marginBottom:4}}><Ionicons name={toneInfo.icon} size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:0.5}}>{toneInfo.label.toUpperCase()}</Text></View>}
                        <Text style={{color:C.white,fontSize:17,fontWeight:'800'}} numberOfLines={2}>{form.workTitle}</Text>
                        <Text style={{color:C.muted,fontSize:11}}>{[form.workDirector,form.workYear,form.workGenre].filter(Boolean).join(' · ')}</Text>
                        <StarRow value={form.rating} size={13}/>
                      </View>
                    </View>
                    <View style={{backgroundColor:C.navyLow,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,gap:11,marginBottom:16}}>
                      {[{ok:form.workTitle.trim().length>0,txt:'Œuvre identifiée'},{ok:form.rating>0,txt:'Note attribuée'},{ok:form.tone!==null,txt:'Ton défini'},{ok:bodyLen>=MIN_BODY,txt:`Critique ≥ ${MIN_BODY} car.`},{ok:form.imageValid,txt:'Image uploadée'}].map(item=><View key={item.txt} style={{flexDirection:'row',alignItems:'center',gap:9}}><Ionicons name={item.ok?'checkmark-circle-outline':'ellipse-outline'} size={14} color={item.ok?C.white:C.subtle}/><Text style={{color:item.ok?C.offWhite:C.muted,fontSize:12}}>{item.txt}</Text></View>)}
                    </View>
                  </>)}
                </View>
                <View style={{height:40}}/>
              </ScrollView>
              <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:Platform.OS==='ios'?34:18,paddingTop:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border,gap:12}}>
                {si>0&&<TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingVertical:12}} onPress={goBack}><Ionicons name="chevron-back" size={14} color={C.muted}/><Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>Retour</Text></TouchableOpacity>}
                {step!=='preview'?<TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,borderRadius:22,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.subtle,marginLeft:si===0?'auto' as any:0}} onPress={goNext}><Text style={{color:C.white,fontSize:14,fontWeight:'700'}}>Continuer</Text><Ionicons name="chevron-forward" size={13} color={C.white}/></TouchableOpacity>:<TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,borderRadius:22,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.subtle,opacity:pub?0.50:1}} onPress={publish} disabled={pub}>{pub?<ActivityIndicator color={C.white} size="small"/>:<><Ionicons name="send-outline" size={13} color={C.white}/><Text style={{color:C.white,fontSize:14,fontWeight:'700'}}>Publier</Text></>}</TouchableOpacity>}
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const cm=StyleSheet.create({fl:{color:C.muted,fontSize:9,fontWeight:'800',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'},inp:{backgroundColor:C.navyLow,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,paddingHorizontal:14,paddingVertical:13,color:C.white,fontSize:14,marginBottom:20},chip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},chipOn:{backgroundColor:C.subtle,borderColor:C.borderHi},chipTxt:{color:C.muted,fontSize:12,fontWeight:'600'},toneTile:{width:'48%',paddingVertical:16,borderRadius:13,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',gap:7},toneTileOn:{backgroundColor:C.subtle,borderColor:C.borderHi},err:{color:C.offWhite,fontSize:12,marginBottom:12,fontWeight:'600'}});

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function SocialScreen(){
  const[tab,setTab]=useState<FeedTab>('Pour vous');
  const[compose,setCompose]=useState(false);
  const[userId,setUserId]=useState('anonymous');
  const[refreshing,setRefreshing]=useState(false);
  const listRef=useRef<FlatList<Post>>(null);

  // Auth immédiat
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{if(session?.user?.id)setUserId(session.user.id);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{if(s?.user?.id)setUserId(s.user.id);});
    return()=>subscription.unsubscribe();
  },[]);

  // ★ Affinité genre — mémorise les genres likés pour booster l'algo
  const[genreAffinity,setGenreAffinity]=useState<Record<string,number>>({});
  const boostGenre=useCallback((genre:string)=>setGenreAffinity(p=>({...p,[genre]:(p[genre]??0)+1})),[]);

  const{posts,loading,error,refresh,toggleLike,newCount}=usePostsFeed(tab,genreAffinity);
  const{works,loading:wLoading}=useWorksAlgorithm();

  // Sort tendances : likes + shares×2 (algorithme temps réel)
  const trendData=useMemo(()=>tab==='Tendances'?[...posts].sort((a,b)=>(b.likes+b.shares*2)-(a.likes+a.shares*2)):posts,[posts,tab]);
  const maxScore=useMemo(()=>Math.max(...posts.map(p=>p.algoScore),1),[posts]);

  const onRefresh=useCallback(()=>{setRefreshing(true);refresh();setTimeout(()=>setRefreshing(false),800);},[refresh]);
  const handleBanner=useCallback(()=>{refresh();listRef.current?.scrollToOffset({offset:0,animated:true});},[refresh]);

  // Toggle like + boost genre affinité
  const handleToggleLike=useCallback((id:string,uid:string,was:boolean)=>{toggleLike(id,uid,was);if(!was){const p=posts.find(x=>x.id===id);if(p?.work_genre)boostGenre(p.work_genre);}},[toggleLike,posts,boostGenre]);

  const router=useRouter();

  const Header=(
    <View style={sc.header}><View><Text style={sc.eyebrow}>UNIVERSE · CINÉMA</Text><Text style={sc.title}>Communauté</Text></View><View style={{flexDirection:'row',gap:8}}>
      <TouchableOpacity style={sc.iconBtn} onPress={()=>router.push('/notifications' as any)} activeOpacity={0.80}><Ionicons name="notifications-outline" size={17} color={C.mid}/><View style={sc.notifDot}/></TouchableOpacity>
      <TouchableOpacity style={[sc.iconBtn,sc.composeBtnStyle]} onPress={()=>setCompose(true)} activeOpacity={0.85}><Ionicons name="create-outline" size={17} color={C.offWhite}/></TouchableOpacity>
    </View></View>
  );
  const Tabs=(
    <View style={sc.tabs}>{FEED_TABS.map(t=>{const on=t===tab;return(<TouchableOpacity key={t} onPress={()=>setTab(t)} style={sc.tab} activeOpacity={0.80}><Text style={[sc.tabTxt,on&&sc.tabTxtOn]}>{t}</Text>{on&&<View style={sc.tabLine}/>}</TouchableOpacity>);})}</View>
  );
  const Empty=useMemo(()=>{if(loading)return<View style={{alignItems:'center',paddingVertical:60,gap:14}}><ActivityIndicator color={C.mid} size="large"/><Text style={{color:C.muted,fontSize:13}}>Chargement…</Text></View>;if(error)return<View style={{alignItems:'center',paddingVertical:60,gap:12}}><Ionicons name="cloud-offline-outline" size={28} color={C.muted}/><Text style={{color:C.mid,fontSize:13,textAlign:'center',paddingHorizontal:40}}>{error}</Text><TouchableOpacity onPress={refresh} style={{paddingHorizontal:20,paddingVertical:9,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>;return<View style={{alignItems:'center',paddingVertical:80,paddingHorizontal:40,gap:14}}><View style={{width:70,height:70,borderRadius:35,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',alignItems:'center'}}><Ionicons name="film-outline" size={34} color={C.muted}/></View><Text style={{color:C.mid,fontSize:16,fontWeight:'700'}}>Aucune critique</Text><TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:24,paddingVertical:13,borderRadius:22,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.subtle}} onPress={()=>setCompose(true)} activeOpacity={0.85}><Ionicons name="create-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:14,fontWeight:'700'}}>Écrire une critique</Text></TouchableOpacity></View>;},[loading,error,refresh]);

  return(
    <InteractionProvider onToggleLike={handleToggleLike}>
      <View style={sc.root}><StatusBar style="light"/><GalaxyBackground/>
        <SafeAreaView style={{flex:1}} edges={['top']}>
          <ComposeModal visible={compose} onClose={()=>setCompose(false)} onPublished={refresh} userId={userId}/>
          {tab==='Pros'?(
            <View style={{flex:1}}>{Header}{Tabs}<ProDirectory userId={userId}/></View>
          ):tab==='Tendances'?(
            <View style={{flex:1}}>
              <NewPostsBanner count={newCount} onPress={handleBanner}/>
              <FlatList key="grid" ref={listRef as any} data={trendData} numColumns={2}
                columnWrapperStyle={{gap:GAP,paddingHorizontal:EDGE,marginBottom:GAP}}
                keyExtractor={item=>item.id}
                renderItem={({item,index})=><GridPostCard post={item} userId={userId} isTopScore={index===0}/>}
                showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mid}/>}
                ListHeaderComponent={<View>{Header}{Tabs}<AlgorithmBanner works={works}/><TrendingRow works={works} loading={wLoading}/></View>}
                ListEmptyComponent={Empty} removeClippedSubviews windowSize={5} maxToRenderPerBatch={6} initialNumToRender={6}/>
            </View>
          ):(
            <View style={{flex:1}}>
              <NewPostsBanner count={newCount} onPress={handleBanner}/>
              <FlatList key="list" ref={listRef} data={posts} keyExtractor={item=>item.id}
                renderItem={({item})=><CompactPostCard post={item} userId={userId}/>}
                showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mid}/>}
                ListHeaderComponent={<View>{Header}{Tabs}<TrendingRow works={works} loading={wLoading}/><CreatorSpotlight posts={posts}/>{posts.length>4&&<GenreRadar posts={posts}/>}</View>}
                ListEmptyComponent={Empty} removeClippedSubviews windowSize={7} maxToRenderPerBatch={5} initialNumToRender={5} updateCellsBatchingPeriod={50}/>
            </View>
          )}
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}
const sc=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingTop:10,paddingBottom:14},eyebrow:{fontSize:8.5,fontWeight:'700',color:C.muted,letterSpacing:1.8,marginBottom:2},title:{fontSize:24,fontWeight:'800',color:C.white,letterSpacing:-0.5},iconBtn:{width:38,height:38,borderRadius:19,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',position:'relative'},composeBtnStyle:{borderColor:C.borderHi,backgroundColor:C.subtle},notifDot:{position:'absolute',top:8,right:8,width:6,height:6,borderRadius:3,backgroundColor:C.white,borderWidth:1,borderColor:C.bg},tabs:{flexDirection:'row',paddingHorizontal:EDGE,gap:20,marginBottom:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},tab:{paddingBottom:12,alignItems:'center',position:'relative'},tabTxt:{color:C.muted,fontSize:13,fontWeight:'600'},tabTxtOn:{color:C.white,fontWeight:'800'},tabLine:{position:'absolute',bottom:0,left:0,right:0,height:2,borderRadius:1,backgroundColor:C.white}});
