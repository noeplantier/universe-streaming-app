/**
 * app/review/[id].tsx
 *
 * Page de critique cinéma — Universe
 *
 *  VIDEO     : extrait direct depuis public.reels (video_url) via reel_id
 *              Player custom avec thumbnail, play/pause, mute, plein écran
 *  DONNÉES   : public.critiques JOIN profiles + reels, tout dynamique
 *  REALTIME  : likes_count mis à jour live via Supabase channel
 *  RELATED   : autres critiques sur le même film (film_title)
 *  UX        : GalaxyBackground identique, animations soignées
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, Animated, Easing, Share,
  ActivityIndicator, Pressable, Alert,
} from 'react-native';
import { Image }            from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient }   from 'expo-linear-gradient';
import { BlurView }         from 'expo-blur';
import { Ionicons }         from '@expo/vector-icons';
import { StatusBar }        from 'expo-status-bar';
import { SafeAreaView }     from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics         from 'expo-haptics';
import { supabase }         from '@/lib/supabase';
import GalaxyBackground     from '@/components/shared/GalaxyBackground';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS — glass/blanc, cohérent avec le reste de l'app
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#03000A',
  glass:     'rgba(255,255,255,0.05)',
  glassMd:   'rgba(255,255,255,0.08)',
  glassHi:   'rgba(255,255,255,0.13)',
  border:    'rgba(255,255,255,0.09)',
  borderHi:  'rgba(255,255,255,0.20)',
  white:     '#FFFFFF',
  offWhite:  'rgba(255,255,255,0.82)',
  muted:     'rgba(255,255,255,0.40)',
  faint:     'rgba(255,255,255,0.15)',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.18)',
  red:       '#FF3B5C',
  blue:      '#5A96E6',
  blueDim:   'rgba(90,150,230,0.14)',
  success:   '#22C55E',
} as const;

// GalaxyBackground partagé (Skia) — voir components/shared/GalaxyBackground.tsx.
// Cet écran avait sa propre 3e réimplémentation locale du champ d'étoiles
// (palette dorée distincte, Animated.loop sans cleanup) ; consolidée ici.

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Reel {
  id:string; video_url:string; thumbnail_url:string|null;
  title:string|null; duration:number|null;
}
interface Profile {
  id:string; username:string; display_name:string|null;
  avatar_url:string|null; role:string|null;
}
interface Critique {
  id:string; user_id:string; reel_id:string|null;
  title:string; film_title:string; content:string;
  rating:number|null; tags:string[]|null; likes_count:number;
  created_at:string; updated_at:string;
  author:string|null;
  profiles: Profile|null;
  reels:    Reel|null;
}
interface RelatedCritique {
  id:string; title:string; film_title:string;
  rating:number|null; likes_count:number; created_at:string;
  profiles:{ username:string; avatar_url:string|null }|null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function readingTime(txt:string): string {
  return `${Math.max(1,Math.round(txt.trim().split(/\s+/).length/200))} min`;
}

function relTime(iso:string): string {
  const d=Math.floor((Date.now()-new Date(iso).getTime())/86_400_000);
  if(d===0)return"Aujourd'hui";
  if(d===1)return'Hier';
  if(d<7)  return`Il y a ${d} jours`;
  if(d<30) return`Il y a ${Math.floor(d/7)} sem.`;
  if(d<365)return`Il y a ${Math.floor(d/30)} mois`;
  return`Il y a ${Math.floor(d/365)} an${Math.floor(d/365)>1?'s':''}`;
}

function fmtDuration(sec:number|null): string {
  if(!sec) return '';
  const m=Math.floor(sec/60), s=sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtK(n:number): string {
  if(n>=1000) return `${(n/1000).toFixed(1)}K`;
  return String(n);
}

const RATING_LABELS = ['','Décevant','Passable','Bien','Excellent','Chef-d\'œuvre'];

// ─────────────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────────────
// ★ FIX 400 : critiques.user_id → auth.users (pas public.profiles)
//   PostgREST ne traverse pas le schéma auth automatiquement.
//   Fix : deux requêtes parallèles — profil récupéré via profiles.id = user_id.
const CRITIQUE_SELECT = [
  'id','user_id','reel_id','title','film_title','content',
  'rating','tags','likes_count','created_at','updated_at','author',
  'reels:reel_id(id,video_url,thumbnail_url,title,duration)',
].join(',');

async function dbFetchCritique(id:string): Promise<Critique|null> {
  // 1. Critique + reel (FK directe public.reels → JOIN valide)
  const { data, error } = await supabase
    .from('critiques')
    .select(CRITIQUE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data)  return null;

  // 2. Profil en requête séparée — profiles.id = critiques.user_id
  let profiles: Profile | null = null;
  if ((data as any).user_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,role')
      .eq('id', (data as any).user_id)
      .maybeSingle();
    profiles = p as Profile | null;
  }

  return { ...(data as any), profiles } as Critique;
}

async function dbFetchRelated(filmTitle:string, excludeId:string): Promise<RelatedCritique[]> {
  // ★ FIX : pas de JOIN profiles:user_id (FK vers auth.users pas public.profiles)
  //   On récupère user_id puis on résout les profils séparément
  const { data } = await supabase
    .from('critiques')
    .select('id,user_id,title,film_title,rating,likes_count,created_at')
    .eq('film_title', filmTitle)
    .neq('id', excludeId)
    .order('likes_count', { ascending:false })
    .limit(5);

  if (!data?.length) return [];

  // Batch: récupère les profils en une seule requête
  const userIds = [...new Set(data.map((d:any) => d.user_id).filter(Boolean))];
  const { data: profs } = userIds.length
    ? await supabase.from('profiles').select('id,username,avatar_url').in('id', userIds)
    : { data: [] };

  const profMap: Record<string,{username:string;avatar_url:string|null}> = {};
  (profs ?? []).forEach((p:any) => { profMap[p.id] = p; });

  return data.map((d:any) => ({
    ...d,
    profiles: profMap[d.user_id] ?? null,
  })) as RelatedCritique[];
}

async function dbToggleLike(critiqueId:string, userId:string, wasLiked:boolean): Promise<void> {
  const delta = wasLiked ? -1 : 1;
  await supabase.rpc('increment_critique_likes', { cid: critiqueId, delta });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({w,h,r=12}:{w:number|string;h:number;r?:number}) {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.timing(op,{toValue:0.50,duration:850,useNativeDriver:true}),
      Animated.timing(op,{toValue:0.22,duration:850,useNativeDriver:true}),
    ])).start();
  },[]);
  return <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:'rgba(255,255,255,0.08)',opacity:op}}/>;
});

const Skeleton = memo(function Skeleton() {
  return(
    <View style={{paddingHorizontal:20,paddingTop:16,gap:16}}>
      <Shimmer w="100%" h={W*0.56} r={20}/>
      <Shimmer w="70%"  h={18}/>
      <Shimmer w="45%"  h={14}/>
      <View style={{flexDirection:'row',gap:10,marginTop:4}}>
        <Shimmer w={40}  h={40} r={20}/>
        <View style={{flex:1,gap:8}}>
          <Shimmer w="50%" h={14}/>
          <Shimmer w="30%" h={11}/>
        </View>
      </View>
      <Shimmer w="100%" h={120} r={16}/>
      <View style={{flexDirection:'row',gap:8}}>
        <Shimmer w="48%" h={48} r={14}/>
        <Shimmer w="48%" h={48} r={14}/>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ VIDEO PLAYER — extrait depuis public.reels
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_H = W * 0.56;  // ratio 16/9

const VideoPlayer = memo(function VideoPlayer({reel}:{reel:Reel}) {
  const videoRef = useRef<Video>(null);
  const [status,    setStatus]    = useState<AVPlaybackStatus|null>(null);
  const [muted,     setMuted]     = useState(true);
  const [fullscreen,setFullscreen]= useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const controlFade = useRef(new Animated.Value(1)).current;
  const hideTimer   = useRef<ReturnType<typeof setTimeout>>();

  const isPlaying = (status as any)?.isPlaying ?? false;
  const pos       = (status as any)?.positionMillis ?? 0;
  const dur       = (status as any)?.durationMillis ?? 0;
  const progress  = dur > 0 ? pos/dur : 0;

  // Auto-hide controls
  const showControls = useCallback(()=>{
    Animated.timing(controlFade,{toValue:1,duration:180,useNativeDriver:true}).start();
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(()=>{
      if (isPlaying)
        Animated.timing(controlFade,{toValue:0,duration:400,useNativeDriver:true}).start();
    }, 2800);
  },[controlFade,isPlaying]);

  useEffect(()=>()=>clearTimeout(hideTimer.current),[]);

  const togglePlay = useCallback(async()=>{
    showControls();
    if (!videoRef.current) return;
    if (Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    if (isPlaying) await videoRef.current.pauseAsync();
    else            await videoRef.current.playAsync();
  },[isPlaying,showControls]);

  const toggleMute = useCallback(async()=>{
    setMuted(m=>!m);
    await videoRef.current?.setIsMutedAsync(!muted);
  },[muted]);

  const thumbnailUri = reel.thumbnail_url ?? `https://picsum.photos/seed/reel_${reel.id}/800/450`;

  if (error) return(
    <View style={vp.errorWrap}>
      <Ionicons name="videocam-off-outline" size={32} color={C.muted}/>
      <Text style={{color:C.muted,fontSize:12,marginTop:8}}>Vidéo indisponible</Text>
    </View>
  );

  return(
    <Pressable style={vp.wrap} onPress={showControls}>
      {/* Video */}
      <Video
        ref={videoRef}
        source={{uri:reel.video_url}}
        style={vp.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isMuted={muted}
        isLooping={false}
        onPlaybackStatusUpdate={setStatus}
        onLoad={()=>setLoading(false)}
        onError={()=>{setLoading(false);setError(true);}}
        posterSource={{uri:thumbnailUri}}
        usePoster={!isPlaying&&loading}
        posterStyle={vp.video}
      />

      {/* Overlay gradient */}
      <LinearGradient
        colors={['rgba(2,5,15,0.30)','transparent','rgba(2,5,15,0.72)']}
        style={StyleSheet.absoluteFillObject}
        start={{x:0,y:0}} end={{x:0,y:1}}
      />

      {/* Loading spinner */}
      {loading&&!error&&(
        <View style={vp.loadWrap}>
          <ActivityIndicator color={C.white} size="large"/>
        </View>
      )}

      {/* Controls overlay */}
      <Animated.View style={[vp.controls,{opacity:controlFade}]}>
        {/* Top row — mute + duration */}
        <View style={vp.topRow}>
          {reel.duration!=null&&(
            <View style={vp.durationBadge}>
              <Ionicons name="time-outline" size={9} color={C.white}/>
              <Text style={vp.durationTxt}>{fmtDuration(reel.duration)}</Text>
            </View>
          )}
          <TouchableOpacity style={vp.iconBtn} onPress={toggleMute} activeOpacity={0.80}>
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <Ionicons name={muted?'volume-mute-outline':'volume-high-outline'} size={14} color={C.white}/>
          </TouchableOpacity>
        </View>

        {/* Centre — play/pause */}
        <TouchableOpacity onPress={togglePlay} style={vp.playBtn} activeOpacity={0.88}>
          <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <Ionicons name={isPlaying?'pause':'play'} size={24} color={C.white}/>
        </TouchableOpacity>

        {/* Bottom — barre de progression */}
        <View style={vp.bottomRow}>
          <View style={vp.progressTrack}>
            <View style={[vp.progressFill,{width:`${progress*100}%` as any}]}/>
            {/* Thumb */}
            <View style={[vp.progressThumb,{left:`${progress*100}%` as any}]}/>
          </View>
          <View style={vp.timeRow}>
            <Text style={vp.timeTxt}>{fmtDuration(Math.floor(pos/1000))}</Text>
            {dur>0&&<Text style={vp.timeTxt}>{fmtDuration(Math.floor(dur/1000))}</Text>}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const vp = StyleSheet.create({
  wrap:         { width:'100%', height:VIDEO_H, borderRadius:20, overflow:'hidden', backgroundColor:'#0D1828', marginBottom:24 },
  video:        { width:'100%', height:'100%' },
  errorWrap:    { width:'100%', height:VIDEO_H, borderRadius:20, backgroundColor:C.glass, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center', marginBottom:24 },
  loadWrap:     { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center' },
  controls:     { ...StyleSheet.absoluteFillObject, justifyContent:'space-between' },
  topRow:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', padding:12 },
  durationBadge:{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(2,5,15,0.70)', paddingHorizontal:8, paddingVertical:4, borderRadius:9 },
  durationTxt:  { color:C.white, fontSize:10, fontWeight:'700' },
  iconBtn:      { width:32, height:32, borderRadius:16, overflow:'hidden', alignItems:'center', justifyContent:'center' },
  playBtn:      { width:56, height:56, borderRadius:28, overflow:'hidden', alignSelf:'center', alignItems:'center', justifyContent:'center' },
  bottomRow:    { padding:12, gap:6 },
  progressTrack:{ height:3, borderRadius:2, backgroundColor:'rgba(255,255,255,0.20)', overflow:'visible' },
  progressFill: { position:'absolute', left:0, top:0, bottom:0, backgroundColor:C.white, borderRadius:2 },
  progressThumb:{ position:'absolute', top:-4, width:11, height:11, borderRadius:5.5, backgroundColor:C.white, marginLeft:-5.5 },
  timeRow:      { flexDirection:'row', justifyContent:'space-between' },
  timeTxt:      { color:'rgba(255,255,255,0.70)', fontSize:10, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL FALLBACK (quand pas de reel_id)
// ─────────────────────────────────────────────────────────────────────────────
const FilmPoster = memo(function FilmPoster({filmTitle,onPress}:{filmTitle:string;onPress:()=>void}) {
  const uri = `https://picsum.photos/seed/${encodeURIComponent(filmTitle)}/800/450`;
  return(
    <TouchableOpacity style={fp.wrap} onPress={onPress} activeOpacity={0.90}>
      <Image source={{uri}} style={StyleSheet.absoluteFillObject} contentFit="cover"/>
      <LinearGradient colors={['transparent','rgba(2,5,15,0.88)']} style={StyleSheet.absoluteFillObject}/>
      <View style={fp.overlay}>
        <View style={fp.playHint}>
          <Ionicons name="film-outline" size={16} color={C.muted}/>
          <Text style={fp.playTxt}>Voir l'œuvre</Text>
          <Ionicons name="arrow-forward" size={12} color={C.muted}/>
        </View>
        <Text style={fp.title} numberOfLines={2}>{filmTitle}</Text>
      </View>
    </TouchableOpacity>
  );
});
const fp = StyleSheet.create({
  wrap:     { width:'100%', height:VIDEO_H, borderRadius:20, overflow:'hidden', marginBottom:24 },
  overlay:  { position:'absolute', bottom:0, left:0, right:0, padding:18, gap:6 },
  playHint: { flexDirection:'row', alignItems:'center', gap:6 },
  playTxt:  { color:C.muted, fontSize:11, fontWeight:'600', flex:1 },
  title:    { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHOR ROW
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_LABELS:Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice',
  writer:'Scénariste', actor:'Acteur·rice', dp:'Dir. photo',
  editor:'Monteur·euse', critic:'Critique', creator:'Créateur·rice',
};

const AuthorRow = memo(function AuthorRow({profile,authorFallback}:{profile:Profile|null;authorFallback:string|null}) {
  const router = useRouter();
  const name   = profile?.display_name || profile?.username || authorFallback || 'Anonyme';
  const role   = profile?.role ? (ROLE_LABELS[profile.role]??profile.role) : 'Critique cinéma';
  const avatar = profile?.avatar_url ?? `https://i.pravatar.cc/100?u=${profile?.id??'anon'}`;

  return(
    <TouchableOpacity
      style={aut.row}
      onPress={()=>profile?.id&&router.push(`/user/${profile.id}` as any)}
      activeOpacity={0.80}
    >
      <Image source={{uri:avatar}} style={aut.avatar} contentFit="cover"/>
      <View style={{flex:1}}>
        <Text style={aut.name}>{name}</Text>
        <Text style={aut.role}>{role}</Text>
      </View>
      <View style={aut.badge}>
        <Ionicons name="ribbon-outline" size={11} color={C.muted}/>
        <Text style={aut.badgeTxt}>Critique</Text>
      </View>
    </TouchableOpacity>
  );
});
const aut = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', gap:12, marginBottom:20 },
  avatar:   { width:46, height:46, borderRadius:23, borderWidth:1, borderColor:C.borderHi },
  name:     { color:C.white, fontSize:14, fontWeight:'700' },
  role:     { color:C.muted, fontSize:11, marginTop:2 },
  badge:    { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.glass },
  badgeTxt: { color:C.muted, fontSize:10, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// RATING DISPLAY — étoiles + barre animée
// ─────────────────────────────────────────────────────────────────────────────
const RatingDisplay = memo(function RatingDisplay({rating}:{rating:number}) {
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.timing(bar,{toValue:rating/5,duration:900,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
  },[rating]);
  const barW = bar.interpolate({inputRange:[0,1],outputRange:['0%','100%']});

  return(
    <View style={rat.wrap}>
      <View style={rat.top}>
        <View style={{flexDirection:'row',gap:5}}>
          {[1,2,3,4,5].map(i=>(
            <Ionicons key={i}
              name={rating>=i?'star':rating>=i-0.5?'star-half':'star-outline'}
              size={20} color={rating>=i||rating>=i-0.5?C.gold:'rgba(255,255,255,0.20)'}
            />
          ))}
        </View>
        <Text style={rat.label}>{RATING_LABELS[Math.round(rating)]??''}</Text>
      </View>
      <View style={rat.track}>
        <Animated.View style={[rat.fill,{width:barW}]}/>
      </View>
      <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:5}}>
        <Text style={rat.frac}>{rating.toFixed(1)} / 5</Text>
        <View style={rat.goldBadge}>
          <Ionicons name="star" size={9} color={C.gold}/>
          <Text style={rat.goldTxt}>{rating.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
});
const rat = StyleSheet.create({
  wrap:      { marginBottom:20 },
  top:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  label:     { color:C.muted, fontSize:12, fontWeight:'600' },
  track:     { height:3, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' },
  fill:      { height:'100%', backgroundColor:C.gold, borderRadius:2 },
  frac:      { color:C.muted, fontSize:10 },
  goldBadge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.goldDim, paddingHorizontal:8, paddingVertical:3, borderRadius:9 },
  goldTxt:   { color:C.gold, fontSize:10, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE WIDGET — critique expandable
// ─────────────────────────────────────────────────────────────────────────────
const QuoteWidget = memo(function QuoteWidget({content}:{content:string}) {
  const [expanded,setExpanded]=useState(false);
  const MAX=300;
  const long=content.length>MAX;
  const text=long&&!expanded?content.slice(0,MAX)+'…':content;
  return(
    <View style={qw.wrap}>
      <View style={qw.accent}/>
      <View style={qw.inner}>
        <Text style={qw.text}>{text}</Text>
        {long&&(
          <TouchableOpacity onPress={()=>setExpanded(v=>!v)} style={{marginTop:12}} activeOpacity={0.80}>
            <Text style={qw.more}>{expanded?'Réduire ↑':'Lire la suite ↓'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
const qw = StyleSheet.create({
  wrap:  { flexDirection:'row', marginBottom:20, borderRadius:16, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.glass },
  accent:{ width:3, backgroundColor:'rgba(255,255,255,0.28)' },
  inner: { flex:1, padding:18 },
  text:  { color:C.offWhite, fontSize:15, lineHeight:26, fontStyle:'italic', letterSpacing:0.1 },
  more:  { color:C.muted, fontSize:12, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// TAGS ROW
// ─────────────────────────────────────────────────────────────────────────────
const TagsRow = memo(function TagsRow({tags}:{tags:string[]}) {
  if (!tags.length) return null;
  return(
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:20}}>
      {tags.map(tag=>(
        <View key={tag} style={tg.pill}>
          <Text style={tg.txt}>#{tag}</Text>
        </View>
      ))}
    </View>
  );
});
const tg = StyleSheet.create({
  pill: { paddingHorizontal:11,paddingVertical:5,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.glass },
  txt:  { color:C.muted,fontSize:11,fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// DATE BADGE
// ─────────────────────────────────────────────────────────────────────────────
const DateBadge = memo(function DateBadge({iso}:{iso:string}) {
  const date=new Date(iso);
  const ok=!isNaN(date.getTime());
  const day=ok?date.getDate():'—';
  const mon=ok?date.toLocaleString('fr-FR',{month:'short'}).toUpperCase():'—';
  return(
    <View style={db.row}>
      <View style={db.cal}>
        <View style={db.calTop}><Text style={db.monTxt}>{mon}</Text></View>
        <View style={db.calBody}><Text style={db.dayTxt}>{day}</Text></View>
      </View>
      <View>
        <Text style={db.full}>{ok?date.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—'}</Text>
        {ok&&<Text style={db.rel}>{relTime(iso)}</Text>}
      </View>
    </View>
  );
});
const db = StyleSheet.create({
  row:     { flexDirection:'row',alignItems:'center',gap:12,marginBottom:16 },
  cal:     { width:44,height:44,borderRadius:10,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border },
  calTop:  { backgroundColor:C.glassMd,paddingVertical:3,alignItems:'center' },
  monTxt:  { color:C.muted,fontSize:7.5,fontWeight:'800',letterSpacing:0.5 },
  calBody: { flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.glass },
  dayTxt:  { color:C.white,fontSize:16,fontWeight:'900' },
  full:    { color:C.white,fontSize:13,fontWeight:'600' },
  rel:     { color:C.muted,fontSize:11,marginTop:2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STAT ROW
// ─────────────────────────────────────────────────────────────────────────────
const StatRow = memo(function StatRow({likes,content,createdAt}:{likes:number;content:string;createdAt:string}) {
  const stats=[
    {icon:'book-outline',     val:readingTime(content),    lbl:'lecture'},
    {icon:'calendar-outline', val:relTime(createdAt),      lbl:'publiée'},
    {icon:'heart-outline',    val:fmtK(likes),             lbl:"j'aimes"},
  ];
  return(
    <View style={{flexDirection:'row',gap:8,marginBottom:20}}>
      {stats.map(st=>(
        <View key={st.lbl} style={sr.pill}>
          <Ionicons name={st.icon as any} size={12} color={C.muted}/>
          <Text style={sr.val}>{st.val}</Text>
          <Text style={sr.lbl}>{st.lbl}</Text>
        </View>
      ))}
    </View>
  );
});
const sr = StyleSheet.create({
  pill: { flex:1,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,paddingHorizontal:9,paddingVertical:8,borderRadius:12,flexWrap:'wrap' },
  val:  { color:C.white,fontSize:11,fontWeight:'700',flexShrink:1 },
  lbl:  { color:C.muted,fontSize:9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ LIKE BUTTON — optimiste + realtime sync
// ─────────────────────────────────────────────────────────────────────────────
const LikeButton = memo(function LikeButton({
  critiqueId, initialCount, userId,
}: { critiqueId:string; initialCount:number; userId:string }) {
  const [liked,  setLiked]  = useState(false);
  const [count,  setCount]  = useState(initialCount);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(async()=>{
    const wasLiked=liked;
    setLiked(v=>!v);
    setCount(c=>wasLiked?c-1:c+1);
    Animated.sequence([
      Animated.spring(scale,{toValue:1.45,tension:300,friction:7,useNativeDriver:true}),
      Animated.spring(scale,{toValue:1,   tension:200,friction:8,useNativeDriver:true}),
    ]).start();
    if(Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try{await dbToggleLike(critiqueId,userId,wasLiked);}
    catch{setLiked(wasLiked);setCount(c=>wasLiked?c+1:c-1);}
  },[liked,critiqueId,userId,scale]);

  return(
    <TouchableOpacity style={[lk.btn,liked&&lk.btnActive]} onPress={handlePress} activeOpacity={0.80}>
      <Animated.View style={{transform:[{scale}]}}>
        <Ionicons name={liked?'heart':'heart-outline'} size={18} color={liked?C.red:C.muted}/>
      </Animated.View>
      <Text style={[lk.count,liked&&{color:C.red}]}>{fmtK(count)}</Text>
      <Text style={lk.lbl}>{liked?"Aimé":"J'aime"}</Text>
    </TouchableOpacity>
  );
});
const lk = StyleSheet.create({
  btn:       { flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,
               backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,
               paddingVertical:14,borderRadius:16 },
  btnActive:  { borderColor:'rgba(255,59,92,0.35)',backgroundColor:'rgba(255,59,92,0.08)' },
  count:     { color:C.white,fontSize:15,fontWeight:'700' },
  lbl:       { color:C.muted,fontSize:11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATED CRITIQUE CARD
// ─────────────────────────────────────────────────────────────────────────────
const RelatedCard = memo(function RelatedCard({item}:{item:RelatedCritique}) {
  const router=useRouter();
  const stars=Math.round(item.rating??0);
  const avatar=item.profiles?.avatar_url??`https://i.pravatar.cc/60?u=${item.id}`;
  return(
    <TouchableOpacity
      style={rc.card}
      onPress={()=>router.push(`/review/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{gap:7}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Image source={{uri:avatar}} style={rc.avatar} contentFit="cover"/>
          <Text style={rc.author} numberOfLines={1}>{item.profiles?.username??'Anonyme'}</Text>
        </View>
        <Text style={rc.title} numberOfLines={2}>{item.title}</Text>
        <View style={{flexDirection:'row',gap:2}}>
          {[1,2,3,4,5].map(s=>(
            <Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9}
              color={s<=stars?C.gold:'rgba(255,255,255,0.18)'}/>
          ))}
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Ionicons name="heart-outline" size={10} color={C.muted}/>
          <Text style={rc.stat}>{fmtK(item.likes_count??0)}</Text>
          <Text style={rc.dot}>·</Text>
          <Text style={rc.stat}>{relTime(item.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const rc = StyleSheet.create({
  card:   { width:180, borderRadius:16, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, padding:14 },
  avatar: { width:22, height:22, borderRadius:11, borderWidth:1, borderColor:C.border },
  author: { color:C.muted, fontSize:10, fontWeight:'600', flex:1 },
  title:  { color:C.white, fontSize:12, fontWeight:'700', lineHeight:17 },
  stat:   { color:C.muted, fontSize:9, fontWeight:'600' },
  dot:    { color:C.muted, fontSize:9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────
const SectionLabel = memo(function SectionLabel({label}:{label:string}) {
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
      <Text style={{color:C.muted,fontSize:9,fontWeight:'700',letterSpacing:1.8,textTransform:'uppercase'}}>{label}</Text>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:C.border}}/>
    </View>
  );
});

const Divider = ()=><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginBottom:20}}/>;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ReviewDetailScreen() {
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{id:string}>();

  const [critique, setCritique] = useState<Critique|null>(null);
  const [related,  setRelated]  = useState<RelatedCritique[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [userId,   setUserId]   = useState('anonymous');

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{if(user?.id)setUserId(user.id);});
  },[]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async()=>{
    if (!id) return;
    setLoading(true); setError(false);
    try {
      const data = await dbFetchCritique(id);
      if (!data) { setError(true); return; }
      setCritique(data);
      // Fetch related en parallèle
      dbFetchRelated(data.film_title, id).then(setRelated);
    } catch(e) {
      console.error('[review]',e);
      setError(true);
    } finally {
      setLoading(false);
    }
  },[id]);

  useEffect(()=>{ load(); },[load]);

  // ★ Realtime — likes mis à jour live
  useEffect(()=>{
    if (!id) return;
    const ch = supabase.channel(`critique_live_${id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'critiques'},
        ({new:row})=>{
          if((row as any).id===id){
            setCritique(prev=>prev?{...prev,likes_count:(row as any).likes_count??prev.likes_count}:prev);
          }
        })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[id]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return(
    <View style={s.root}>
      <GalaxyBackground/>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.navBtn} onPress={()=>router.back()} activeOpacity={0.80}>
            <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="chevron-back" size={20} color={C.white}/>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Critique</Text>
          <View style={[s.navBtn,{backgroundColor:C.glass}]}/>
        </View>
        <Skeleton/>
      </SafeAreaView>
    </View>
  );

  if (error || !critique) return(
    <View style={[s.root,{justifyContent:'center',alignItems:'center'}]}>
      <GalaxyBackground/>
      <Ionicons name="alert-circle-outline" size={52} color={C.muted}/>
      <Text style={{color:C.muted,fontSize:16,fontWeight:'700',marginTop:14}}>Critique introuvable</Text>
      <TouchableOpacity style={s.retryCta} onPress={()=>router.back()} activeOpacity={0.80}>
        <Text style={{color:C.white,fontWeight:'700',fontSize:13}}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const { reels: reel, profiles: profile } = critique;
  const router_ = router;

  return(
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <SafeAreaView style={{flex:1}} edges={['top']}>
        {/* ── NAV ── */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.navBtn} onPress={()=>router_.back()} activeOpacity={0.80}>
            <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="chevron-back" size={20} color={C.white}/>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{critique.film_title}</Text>
          <TouchableOpacity style={s.navBtn} activeOpacity={0.80}>
            <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="bookmark-outline" size={16} color={C.muted}/>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ★ VIDEO ou POSTER */}
          {reel?.video_url ? (
            <VideoPlayer reel={reel}/>
          ) : (
            <FilmPoster
              filmTitle={critique.film_title}
              onPress={()=>{}}
            />
          )}

          {/* Film title + metadata */}
          <View style={s.filmMeta}>
            <Text style={s.filmTitle}>{critique.film_title}</Text>
            <Text style={s.critiqueTitle}>{critique.title}</Text>
          </View>

          {/* ── AUTEUR ── */}
          <SectionLabel label="Auteur"/>
          <AuthorRow profile={profile} authorFallback={critique.author}/>
          <Divider/>

          {/* ── NOTE ── */}
          <SectionLabel label="Note"/>
          <RatingDisplay rating={critique.rating??0}/>
          <Divider/>

          {/* ── STATS ── */}
          <StatRow
            likes={critique.likes_count}
            content={critique.content}
            createdAt={critique.created_at}
          />
          <Divider/>

          {/* ── CRITIQUE ── */}
          <SectionLabel label="La critique"/>
          <QuoteWidget content={critique.content}/>

          {/* Tags */}
          {critique.tags&&critique.tags.length>0&&(
            <>
              <SectionLabel label="Tags"/>
              <TagsRow tags={critique.tags}/>
            </>
          )}

          {/* ── DATE ── */}
          <SectionLabel label="Publication"/>
          <DateBadge iso={critique.created_at}/>
          <Divider/>

          {/* ── ACTIONS ── */}
          <View style={s.actions}>
            {/* ★ Like realtime */}
            <LikeButton
              critiqueId={critique.id}
              initialCount={critique.likes_count}
              userId={userId}
            />
            <TouchableOpacity
              style={s.shareBtn}
              onPress={async()=>{
                try{
                  await Share.share({
                    message:`🎬 Critique de "${critique.film_title}"\n\n${critique.content.slice(0,200)}…`,
                  });
                }catch{}
              }}
              activeOpacity={0.80}
            >
              <Ionicons name="share-outline" size={18} color={C.muted}/>
              <Text style={s.shareTxt}>Partager</Text>
            </TouchableOpacity>
          </View>

          {/* ── CRITIQUES LIÉES ── */}
          {related.length > 0 && (
            <View style={{marginTop:32}}>
              <SectionLabel label={`Autres critiques · ${critique.film_title}`}/>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{gap:10}}
              >
                {related.map(item=><RelatedCard key={item.id} item={item}/>)}
              </ScrollView>
            </View>
          )}

          <View style={{height:80}}/>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES GLOBAUX
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg },
  headerRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                 paddingHorizontal:18, paddingTop:8, paddingBottom:14 },
  navBtn:      { width:38, height:38, borderRadius:19, overflow:'hidden',
                 alignItems:'center', justifyContent:'center',
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  headerTitle: { color:C.white, fontSize:15, fontWeight:'700',
                 flex:1, textAlign:'center', paddingHorizontal:10 },
  scroll:      { paddingHorizontal:18, paddingTop:4 },

  filmMeta:    { marginBottom:20 },
  filmTitle:   { color:C.white, fontSize:22, fontWeight:'900', letterSpacing:-0.5, lineHeight:28 },
  critiqueTitle:{ color:C.muted, fontSize:13, marginTop:5, lineHeight:19 },

  actions:     { flexDirection:'row', gap:10 },
  shareBtn:    { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                 backgroundColor:C.glass, borderWidth:StyleSheet.hairlineWidth,
                 borderColor:C.border, paddingVertical:14, borderRadius:16 },
  shareTxt:    { color:C.white, fontSize:14, fontWeight:'600' },

  retryCta:    { marginTop:20, paddingHorizontal:24, paddingVertical:11, borderRadius:20,
                 borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.glass },
});