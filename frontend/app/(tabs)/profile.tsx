/**
 * app/(tabs)/profile.tsx — UNIVERSE · CREATOR EDITION
 *
 * ★ Profil cinéaste neutre (monogramme — pas d'avatar photo)
 * ★ Header épuré, inspirant, identité cinéaste avant tout
 * ★ Gamification dynamique identique à search.tsx
 *   (niveaux, badges, missions, défi de la semaine)
 * ★ Fetch parallèle (Promise.all) · getSession() UUID garanti
 * ★ WEB-SAFE pour Netlify :
 *   – pas d'expo-image (React Native Image partout)
 *   – composants inlinés (plus de dépendances @/components/profile/)
 *   – cards avec dimensions explicites (pas de width:'100%')
 *   – Platform.select pour VideoThumbnails
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, Linking, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import GalaxyBackground from '@/components/social/GalaxyBackground';
import { supabase }     from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');

// VideoThumbnails — web-safe Metro tree-shaking
const VideoThumbnails: any = Platform.select({
  native: () => { try { return require('expo-video-thumbnails'); } catch { return null; } },
  default: () => null,
})?.() ?? null;

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
} as const;
const H_PAD = 20;
const CARD_W = 124, CARD_H = 185;
const REEL_W = 156, REEL_H = 220;
const CRIT_W = 214, CRIT_H = 144;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work { id:number; title:string; category:string; genre:string; year:number; likes:number; image:string|null; is_original:boolean; duration:number|null; director:string|null }
interface UserReel { id:string; video_url:string; thumbnail_url:string|null; title:string|null; genre:string|null; duration:number|null; status:'pending'|'approved'|'rejected'; likes_count:number; views_count:number; created_at:string }
interface ProfileData { display_name:string; username:string; bio:string; role:string; location:string; avatar_url:string; website:string; is_pro:boolean; is_industry_contact:boolean; specialties:string[]; festivals:string[]; open_to:string[]; social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string }
interface ReviewItem { id:string; filmId:string; content:string; rating:number; likes:number; date:string; film:{ id:string; title:string; posterUrl:string; genre:string; type:'film' } }
type GridTab = 0|1|2;

// ─── GAMIFICATION TYPES (= search.tsx) ───────────────────────────────────────
interface UserStats { watchCount:number; critiqueCount:number; favCount:number; watchedGenres:Record<string,number>; watchedDirectors:string[]; isNight:boolean; totalLikedLowPopularity:number }
interface Mission { id:string; title:string; desc:string; reward:string; icon:keyof typeof Ionicons.glyphMap; target:number; progress:number; completed:boolean; filter:(w:any)=>boolean }
interface Badge { id:string; label:string; desc:string; icon:keyof typeof Ionicons.glyphMap; earned:boolean }

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────
const EMPTY_PROFILE: ProfileData = {
  display_name:'', username:'', bio:'', role:'creator', location:'', avatar_url:'', website:'',
  is_pro:false, is_industry_contact:false, specialties:[], festivals:[], open_to:[],
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
};
const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
  critic:'Critique', creator:'Créateur·rice', other:'Cinéaste',
};

// ─── MAPPERS ──────────────────────────────────────────────────────────────────
const mapProfile = (r:any): ProfileData => ({
  display_name:r?.display_name??'', username:r?.username??'', bio:r?.bio??'',
  role:r?.role??'creator', location:r?.location??'', avatar_url:r?.avatar_url??'',
  website:r?.website??'', is_pro:r?.is_pro??false, is_industry_contact:r?.is_industry_contact??false,
  specialties:Array.isArray(r?.specialties)?r.specialties:[], festivals:Array.isArray(r?.festivals)?r.festivals:[],
  open_to:Array.isArray(r?.open_to)?r.open_to:[], social_instagram:r?.social_instagram??'',
  social_vimeo:r?.social_vimeo??'', social_youtube:r?.social_youtube??'', social_imdb:r?.social_imdb??'',
});
const mapWork = (r:any): Work => ({ id:Number(r?.id)||0, title:r?.title??'', category:r?.category??'', genre:r?.genre??'', year:Number(r?.year)||0, likes:Number(r?.likes)||0, image:r?.image??null, is_original:r?.is_original??false, duration:r?.duration!=null?Number(r.duration):null, director:r?.director??null });
const mapReel = (r:any): UserReel => ({ id:String(r?.id??''), video_url:r?.video_url??'', thumbnail_url:r?.thumbnail_url??null, title:r?.title??null, genre:r?.genre??null, duration:r?.duration!=null?Number(r.duration):null, status:(['pending','approved','rejected'].includes(r?.status)?r.status:'pending') as any, likes_count:Number(r?.likes_count)||0, views_count:Number(r?.views_count)||0, created_at:r?.created_at??new Date().toISOString() });
const mapCritique = (r:any): ReviewItem => ({ id:String(r?.id), filmId:String(r?.reel_id??r?.work_id??r?.id), content:String(r?.content??r?.body??''), rating:r?.rating!=null?Number(r.rating):0, likes:Number(r?.likes_count??r?.likes??0), date:r?.created_at?new Date(r.created_at).toISOString():new Date().toISOString(), film:{ id:String(r?.reel_id??r?.id), title:String(r?.film_title??r?.work_title??r?.title??'—'), posterUrl:`https://picsum.photos/seed/crit_${r?.id}/400/600`, genre:'—', type:'film' as const } });

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const resolveImage = (id:number, image:string|null) => {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try { return supabase.storage.from('community-images').getPublicUrl(image).data.publicUrl; }
  catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
};
const fmt = (n:number) => n>=1_000_000?`${(n/1_000_000).toFixed(1)}M`:n>=1_000?`${(n/1_000).toFixed(n>=10_000?0:1)}K`:`${n}`;
const fmtDur = (s:number|null) => { if(!s)return''; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h${m>0?` ${m}min`:''}`:m>0?`${m}min`:''; };
const momentum = (r:UserReel) => Math.round((r.views_count*0.3+r.likes_count*2)/Math.max(0.5,(Date.now()-new Date(r.created_at).getTime())/86400000));

// ─── GAMIFICATION (identique search.tsx) ─────────────────────────────────────
function buildMissions(stats:UserStats): Mission[] {
  return [
    { id:'explorateur', title:'Explorateur indé', desc:'5 courts-métrages regardés', reward:'Badge · Explorateur indé', icon:'compass-outline', target:5, progress:Math.min(5,stats.watchCount), completed:stats.watchCount>=5, filter:()=>true },
    { id:'pepites', title:'Découvreur de pépites', desc:'3 films rares aimés (< 100 likes)', reward:'Badge · Chasseur de pépites', icon:'sparkles-outline', target:3, progress:Math.min(3,stats.totalLikedLowPopularity), completed:stats.totalLikedLowPopularity>=3, filter:()=>true },
    { id:'critique', title:'Critique en herbe', desc:'5 avis argumentés publiés', reward:'Badge · Voix critique', icon:'create-outline', target:5, progress:Math.min(5,stats.critiqueCount), completed:stats.critiqueCount>=5, filter:()=>true },
  ];
}
function buildBadges(stats:UserStats): Badge[] {
  return [
    { id:'explorer',  label:'Explorateur indé',     desc:'5 courts regardés',     icon:'compass-outline',       earned:stats.watchCount>=5 },
    { id:'nocturne',  label:'Cinéphile nocturne',    desc:'Actif après 22h',       icon:'moon-outline',          earned:stats.isNight },
    { id:'pepiteur',  label:'Découvreur de pépites', desc:'3 films rares aimés',   icon:'sparkles-outline',      earned:stats.totalLikedLowPopularity>=3 },
    { id:'critique',  label:'Critique en herbe',     desc:'5 avis publiés',        icon:'create-outline',        earned:stats.critiqueCount>=5 },
    { id:'curateur',  label:'Curateur',              desc:'10 favoris',            icon:'bookmark-outline',      earned:stats.favCount>=10 },
    { id:'omnivore',  label:'Cinéphile omnivore',    desc:'5 genres explorés',     icon:'layers-outline',        earned:Object.keys(stats.watchedGenres).length>=5 },
  ];
}
function cinephileLevel(score:number):{n:number;label:string;pct:number} {
  const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];
  const c=[...L].reverse().find(x=>score>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===c.n)+1; const nx=L[ni]??L[L.length-1];
  return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at))};
}

function useGamification(userId:string) {
  const[stats,setStats]=useState<UserStats>({watchCount:0,critiqueCount:0,favCount:0,watchedGenres:{},watchedDirectors:[],isNight:false,totalLikedLowPopularity:0});
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!userId||userId==='anonymous'){setLoading(false);return;}
    const isNight=new Date().getHours()>=22||new Date().getHours()<4;
    Promise.all([
      supabase.from('user_history').select('work_id').eq('user_id',userId),
      supabase.from('critiques').select('id').eq('user_id',userId),
      supabase.from('user_favorites').select('work_id').eq('user_id',userId),
    ]).then(([hist,crit,favs])=>{
      const histIds=(hist.data??[]).map((r:any)=>r.work_id);
      const genres:Record<string,number>={};
      setStats({watchCount:histIds.length,critiqueCount:(crit.data??[]).length,favCount:(favs.data??[]).length,watchedGenres:genres,watchedDirectors:[],isNight,totalLikedLowPopularity:0});
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[userId]);
  const missions = useMemo(()=>buildMissions(stats),[stats]);
  const badges   = useMemo(()=>buildBadges(stats),[stats]);
  const score    = useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+stats.totalLikedLowPopularity*10+(stats.isNight?5:0),[stats]);
  const level    = useMemo(()=>cinephileLevel(score),[score]);
  return{missions,badges,score,level,loading};
}

// ─── DB ───────────────────────────────────────────────────────────────────────
async function db<T>(fn:()=>PromiseLike<{data:T|null;error:any}>, label?:string): Promise<T|null> {
  try { const{data,error}=await fn(); if(error){if(__DEV__)console.warn('[profile]',label,error.code);return null;} return data; }
  catch(e){ if(__DEV__)console.warn('[profile]',label,e); return null; }
}

// ─── SHIMMER ──────────────────────────────────────────────────────────────────
const Shimmer = memo(({w,h,r=8}:{w:number;h:number;r?:number}) => {
  const op=useRef(new Animated.Value(0.15)).current;
  useEffect(()=>{ const l=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.35,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.15,duration:900,useNativeDriver:true})])); l.start(); return()=>l.stop(); },[op]);
  return <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});

// ─── INLINE UI COMPONENTS ─────────────────────────────────────────────────────
// HScrollRow — horizontal scroll, web-safe
const HScrollRow = memo(({children,pb=0}:{children:React.ReactNode;pb?:number}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,paddingBottom:pb}}>
    {children}
  </ScrollView>
));

// SectionHeader
const SectionHeader = memo(({icon,label,subtitle,count,onViewAll}:{icon:keyof typeof Ionicons.glyphMap;label:string;subtitle?:string;count?:number;onViewAll?:()=>void}) => (
  <View style={{flexDirection:'row',alignItems:'flex-start',paddingHorizontal:H_PAD,paddingTop:22,paddingBottom:12}}>
    <View style={{flex:1,gap:2}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
        <Ionicons name={icon} size={13} color={C.mid}/>
        <Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2}}>{label}</Text>
        {count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}
      </View>
      {subtitle&&<Text style={{color:C.muted,fontSize:11,marginLeft:20}}>{subtitle}</Text>}
    </View>
    {onViewAll&&<TouchableOpacity onPress={onViewAll} hitSlop={8}><Text style={{color:C.muted,fontSize:11,fontWeight:'600'}}>Tout voir</Text></TouchableOpacity>}
  </View>
));

// EmptyState
const EmptyState = memo(({icon,text,subtext}:{icon:keyof typeof Ionicons.glyphMap;text:string;subtext?:string}) => (
  <View style={{alignItems:'center',paddingVertical:32,paddingHorizontal:H_PAD,gap:8}}>
    <View style={{width:52,height:52,borderRadius:26,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}>
      <Ionicons name={icon} size={22} color={C.muted}/>
    </View>
    <Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>{text}</Text>
    {subtext&&<Text style={{color:C.muted,fontSize:11,textAlign:'center',lineHeight:17}}>{subtext}</Text>}
  </View>
));

// ─── ★ MONOGRAMME — remplace l'avatar photo ───────────────────────────────────
const Monogram = memo(({name,level,isPro}:{name:string;level:number;isPro:boolean}) => {
  const initials = useMemo(()=>(name||'?').trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2),[name]);
  return(
    <View style={{position:'relative'}}>
      <View style={mono.circle}><Text style={mono.txt}>{initials}</Text></View>
      <View style={mono.lvlBadge}><Text style={mono.lvlTxt}>{level}</Text></View>
      {isPro&&<View style={mono.proBadge}><Ionicons name="checkmark" size={8} color={C.white}/></View>}
    </View>
  );
});
const mono=StyleSheet.create({
  circle:{width:72,height:72,borderRadius:36,backgroundColor:C.navyMid,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  txt:   {color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.5},
  lvlBadge:{position:'absolute',top:-4,right:-4,width:22,height:22,borderRadius:11,backgroundColor:C.navyLow,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  lvlTxt:{color:C.white,fontSize:9,fontWeight:'900'},
  proBadge:{position:'absolute',bottom:0,right:0,width:18,height:18,borderRadius:9,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.borderHi,alignItems:'center',justifyContent:'center'},
});

// ─── ★ PORTRAIT CARD — React Native Image (web-safe) ─────────────────────────
const PortraitCard = memo(({item,rank}:{item:Work;rank?:number}) => {
  const router=useRouter();
  const uri=useMemo(()=>resolveImage(item.id,item.image),[item.id,item.image]);
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        {/* ★ React Native Image — pas expo-image → compatible Netlify */}
        <Image source={{uri}} style={pc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
        <View style={pc.badge}><Text style={pc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>
        {rank!=null&&<Text style={pc.rank}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={pc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>
            {item.year>0&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc=StyleSheet.create({
  card: {width:CARD_W,height:CARD_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},
  img:  {width:CARD_W,height:CARD_H},
  badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},
  badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},
  rank: {position:'absolute',bottom:32,right:5,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.10)'},
  meta: {position:'absolute',bottom:7,left:8,right:8,gap:3},
  title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},
  stat: {color:C.muted,fontSize:9,fontWeight:'600'},
});

// ─── REEL CARD ────────────────────────────────────────────────────────────────
const S_CFG: Record<string,{icon:keyof typeof Ionicons.glyphMap;label:string}> = {
  pending:{icon:'time-outline',label:'En attente'}, approved:{icon:'checkmark-circle-outline',label:'Validée'}, rejected:{icon:'close-circle-outline',label:'Refusée'},
};
function useThumb(url:string, thumb:string|null): string|null {
  const[uri,setUri]=useState<string|null>(thumb??null);
  useEffect(()=>{ if(thumb||!url||!VideoThumbnails)return; let ok=true; VideoThumbnails.getThumbnailAsync(url,{time:1500,quality:0.65}).then(({uri:u}:{uri:string})=>{if(ok)setUri(u);}).catch(()=>{}); return()=>{ok=false;}; },[url,thumb]);
  return uri;
}
const ReelCard = memo(({reel,isHot}:{reel:UserReel;isHot:boolean}) => {
  const router=useRouter(), thumb=useThumb(reel.video_url,reel.thumbnail_url), cfg=S_CFG[reel.status]??S_CFG.pending, [err,setErr]=useState(false), m=momentum(reel);
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push({pathname:'/reel/[id]',params:{id:reel.id}} as any)} activeOpacity={0.88}>
      <View style={rc.card}>
        {thumb&&!err
          ?<Image source={{uri:thumb}} style={rc.img} resizeMode="cover" onError={()=>setErr(true)}/>
          :<View style={rc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="film-outline" size={24} color={C.subtle}/></View>
        }
        <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/>
        <View style={{position:'absolute',top:'40%',alignSelf:'center',marginTop:-12}} pointerEvents="none"><Ionicons name="play-circle-outline" size={26} color={C.mid}/></View>
        <View style={rc.status}><Ionicons name={cfg.icon} size={9} color={C.mid}/><Text style={rc.stTxt}>{cfg.label}</Text></View>
        {(isHot||reel.views_count>=10)&&<View style={rc.mom}><Ionicons name={isHot?'flame-outline':'trending-up-outline'} size={8} color={C.mid}/><Text style={rc.momTxt}>{isHot?'EN HAUSSE':`${fmt(reel.views_count)} vues`}</Text></View>}
        <View style={rc.meta}>
          <Text style={rc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text>
          {reel.genre&&<Text style={{color:C.muted,fontSize:8}}>{reel.genre}</Text>}
          <View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="eye-outline" size={8} color={C.muted}/><Text style={rc.stTxt}>{fmt(reel.views_count)}</Text></View>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="heart-outline" size={8} color={C.muted}/><Text style={rc.stTxt}>{fmt(reel.likes_count)}</Text></View>
            {m>0&&<Text style={{marginLeft:'auto' as any,color:C.muted,fontSize:7,fontWeight:'700'}}>{m}pts/j</Text>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const rc=StyleSheet.create({
  card:{width:REEL_W,height:REEL_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},
  img: {width:REEL_W,height:REEL_H},
  ph:  {width:REEL_W,height:REEL_H,alignItems:'center',justifyContent:'center'},
  status:{position:'absolute',top:8,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.72)'},
  stTxt:{color:C.muted,fontSize:7.5,fontWeight:'700'},
  mom:  {position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:'rgba(7,12,23,0.82)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  momTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},
  meta: {position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},
  title:{color:C.white,fontSize:10.5,fontWeight:'800',lineHeight:13},
});

// ─── CRITIQUE CARD ────────────────────────────────────────────────────────────
const SD=[{t:8,l:18,op:0.28,r:1.5},{t:22,l:155,op:0.30,r:1.8},{t:48,l:190,op:0.20,r:1.2},{t:70,l:130,op:0.15,r:0.8},{t:92,l:200,op:0.26,r:1.5}];
const CritiqueCard = memo(({review,rank,onPress}:{review:ReviewItem;rank:number;onPress:()=>void}) => {
  const stars=Math.round(review.rating??0);
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={onPress} activeOpacity={0.88}>
      <View style={{width:CRIT_W,height:CRIT_H,borderRadius:14,overflow:'hidden'}}>
        <LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/>
        {SD.map((s,i)=><View key={i} style={{position:'absolute',top:s.t,left:s.l,opacity:s.op,width:s.r,height:s.r,borderRadius:s.r/2,backgroundColor:C.white}}/>)}
        <View style={{position:'absolute',top:9,left:9,paddingHorizontal:7,paddingVertical:3,borderRadius:7,backgroundColor:C.navyMid}}><Text style={{color:C.mid,fontSize:9,fontWeight:'800'}}>#{rank}</Text></View>
        {(review.likes??0)>0&&<View style={{position:'absolute',top:9,right:9,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.navyMid}}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:8,fontWeight:'700'}}>{fmt(review.likes??0)}</Text></View>}
        <View style={{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:3}}>
          <Text style={{color:C.white,fontSize:12,fontWeight:'800',letterSpacing:-0.2}} numberOfLines={1}>{review.film?.title??'—'}</Text>
          <View style={{flexDirection:'row',gap:2}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle}/>)}</View>
          <Text style={{color:C.muted,fontSize:10,lineHeight:13}} numberOfLines={2}>{review.content||'Aucun contenu'}</Text>
        </View>
        <View style={{...StyleSheet.absoluteFillObject,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} pointerEvents="none"/>
      </View>
    </TouchableOpacity>
  );
});

// ─── GAMIFICATION COMPONENTS (= search.tsx) ───────────────────────────────────
const CinephileBanner = memo(({level,score,badges}:{level:{n:number;label:string;pct:number};score:number;badges:Badge[]}) => {
  const earned=badges.filter(b=>b.earned).length;
  const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:1000,useNativeDriver:false}).start();},[level.pct]);
  return(
    <View style={gb.wrap}>
      <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
        <View style={gb.circle}><Text style={gb.lvlNum}>{level.n}</Text><Text style={gb.lvlLbl}>NIV</Text></View>
        <View style={{flex:1,gap:6}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:C.white,fontSize:13,fontWeight:'700',flex:1}}>{level.label}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Ionicons name="star" size={9} color={C.mid}/><Text style={{color:C.mid,fontSize:10,fontWeight:'700'}}>{score} pts</Text></View>
          </View>
          <View style={{height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}>
            <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
            <Ionicons name="ribbon-outline" size={9} color={C.muted}/>
            <Text style={{color:C.muted,fontSize:10}}>{earned}/{badges.length} badges débloqués</Text>
          </View>
        </View>
      </View>
    </View>
  );
});
const gb=StyleSheet.create({
  wrap:  {marginHorizontal:H_PAD,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14},
  circle:{width:50,height:50,borderRadius:25,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
  lvlNum:{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.5},
  lvlLbl:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:1.5,marginTop:-2},
});

const BadgesRow = memo(({badges}:{badges:Badge[]}) => {
  const all=[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)];
  return(
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,gap:8}}>
      {all.map(b=>(
        <View key={b.id} style={[br.wrap,b.earned&&br.earned]}>
          <View style={[br.icon,b.earned&&br.iconOn]}><Ionicons name={b.icon} size={15} color={b.earned?C.white:C.muted}/></View>
          <Text style={[br.lbl,b.earned&&{color:C.white}]} numberOfLines={2}>{b.label}</Text>
          {!b.earned&&<View style={br.lock}><Ionicons name="lock-closed" size={7} color={C.muted}/></View>}
        </View>
      ))}
    </ScrollView>
  );
});
const br=StyleSheet.create({
  wrap:  {alignItems:'center',gap:6,padding:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:84,opacity:0.55},
  earned:{opacity:1,borderColor:C.borderHi,backgroundColor:C.subtle},
  icon:  {width:36,height:36,borderRadius:18,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  iconOn:{borderColor:C.borderHi},
  lbl:   {color:C.muted,fontSize:9,fontWeight:'600',textAlign:'center',lineHeight:12},
  lock:  {position:'absolute',top:7,right:7},
});

const MissionCard = memo(({mission,onPress}:{mission:Mission;onPress:(m:Mission)=>void}) => {
  const pct=mission.target>0?Math.min(1,mission.progress/mission.target):0;
  return(
    <TouchableOpacity style={[miss.wrap,mission.completed&&miss.wrapDone]} onPress={()=>onPress(mission)} activeOpacity={0.85}>
      <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{flexDirection:'row',alignItems:'flex-start',gap:11,padding:13}}>
        <View style={[miss.icon,mission.completed&&miss.iconDone]}><Ionicons name={mission.completed?'checkmark-circle':mission.icon} size={18} color={mission.completed?C.white:C.mid}/></View>
        <View style={{flex:1,gap:4}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:mission.completed?C.white:C.offWhite,fontSize:12,fontWeight:'700',flex:1}} numberOfLines={1}>{mission.title}</Text>
            {mission.completed&&<View style={{paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:C.subtle,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}}><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.4}}>ACCOMPLI</Text></View>}
          </View>
          <Text style={{color:C.muted,fontSize:10,lineHeight:14}} numberOfLines={1}>{mission.desc}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <View style={{flex:1,height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><View style={{height:'100%',borderRadius:2,width:`${pct*100}%` as any,backgroundColor:mission.completed?C.white:C.subtle}}/></View>
            <Text style={{color:mission.completed?C.white:C.muted,fontSize:9,fontWeight:'700'}}>{mission.progress}/{mission.target}</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="gift-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:9}}>{mission.reward}</Text></View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const miss=StyleSheet.create({
  wrap:    {marginHorizontal:H_PAD,marginBottom:8,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  wrapDone:{borderColor:C.borderHi},
  icon:    {width:40,height:40,borderRadius:11,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  iconDone:{backgroundColor:C.subtle,borderColor:C.borderHi},
});

// ─── ★ PROFILE HEADER — épuré, identité cinéaste ─────────────────────────────
const ProfileHeader = memo(({profile,filmCount,critiqueCount,reelCount,level,onEdit}:{
  profile:ProfileData; filmCount:number; critiqueCount:number; reelCount:number;
  level:{n:number;label:string;pct:number}; onEdit:()=>void;
}) => {
  const[exp,setExp]=useState(false);
  const displayName=profile.display_name||profile.username||'Cinéaste';
  const links=useMemo(()=>[
    {key:'ig',icon:'logo-instagram' as any,url:profile.social_instagram,label:'Instagram'},
    {key:'vi',icon:'videocam-outline' as any,url:profile.social_vimeo,label:'Vimeo'},
    {key:'yt',icon:'logo-youtube' as any,url:profile.social_youtube,label:'YouTube'},
    {key:'ws',icon:'globe-outline' as any,url:profile.website,label:'Portfolio'},
  ].filter(l=>!!l.url),[profile]);

  return(
    <View style={{paddingHorizontal:H_PAD}}>
      {/* Ligne supérieure : monogramme + stats */}
      <View style={{flexDirection:'row',alignItems:'center',gap:18,marginTop:8}}>
        <Monogram name={displayName} level={level.n} isPro={profile.is_pro}/>
        <View style={{flex:1,flexDirection:'row',justifyContent:'space-around'}}>
          {[{v:fmt(filmCount),l:'films'},{v:fmt(critiqueCount),l:'critiques'},{v:fmt(reelCount),l:'créas'}].map(({v,l},i,arr)=>(
            <React.Fragment key={l}>
              <View style={{alignItems:'center',gap:2}}>
                <Text style={{color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.6}}>{v}</Text>
                <Text style={{color:C.muted,fontSize:8,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5}}>{l}</Text>
              </View>
              {i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,height:28,backgroundColor:C.faint}}/>}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Identité cinéaste */}
      <View style={{marginTop:14,gap:3}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Text style={{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4,flexShrink:1}}>{displayName}</Text>
          {profile.is_pro&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Text style={{color:C.offWhite,fontSize:8,fontWeight:'900',letterSpacing:0.8}}>PRO</Text></View>}
          {profile.is_industry_contact&&<View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:2,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Ionicons name="briefcase-outline" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.6}}>INDUSTRIE</Text></View>}
        </View>
        <Text style={{color:C.muted,fontSize:12,letterSpacing:0.1}}>
          {ROLE_LABELS[profile.role]??'Créateur·rice'}
          {profile.location?` · ${profile.location}`:''}
          {` · ${level.label}`}
        </Text>
      </View>

      {/* Bio */}
      {!!profile.bio&&(
        <Pressable onPress={()=>setExp(e=>!e)} style={{marginTop:10,gap:3}}>
          <Text style={{color:C.mid,fontSize:12.5,lineHeight:18}} numberOfLines={exp?undefined:2}>{profile.bio}</Text>
          {profile.bio.length>100&&<Text style={{color:C.offWhite,fontSize:11,fontWeight:'700'}}>{exp?'Voir moins ↑':'Voir plus ↓'}</Text>}
        </Pressable>
      )}

      {/* Bouton modifier */}
      <TouchableOpacity style={ph.editBtn} onPress={onEdit} activeOpacity={0.80}>
        <Ionicons name="create-outline" size={12} color={C.mid}/>
        <Text style={{color:C.mid,fontSize:11.5,fontWeight:'700',letterSpacing:0.1}}>Modifier le profil</Text>
      </TouchableOpacity>

      {/* Spécialités */}
      {profile.specialties.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingVertical:2}} style={{marginTop:12}}>
          {profile.specialties.map(s=><View key={s} style={ph.chip}><Text style={{color:C.offWhite,fontSize:10.5,fontWeight:'600'}}>{s}</Text></View>)}
        </ScrollView>
      )}

      {/* Festivals */}
      {profile.festivals.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingVertical:2}} style={{marginTop:8}}>
          {profile.festivals.map(f=><View key={f} style={ph.fest}><Ionicons name="trophy-outline" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:10,fontWeight:'600'}}>{f}</Text></View>)}
        </ScrollView>
      )}

      {/* Réseaux sociaux */}
      {links.length>0&&(
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:14}}>
          {links.map(l=>(
            <TouchableOpacity key={l.key} style={ph.soc} onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}>
              <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name={l.icon} size={12} color={C.offWhite}/>
              <Text style={{color:C.offWhite,fontSize:10,fontWeight:'600'}}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:18}}/>
    </View>
  );
});
const ph=StyleSheet.create({
  editBtn:{marginTop:12,borderRadius:10,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,paddingVertical:9,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:6},
  chip:   {paddingHorizontal:10,paddingVertical:5,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},
  fest:   {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:4,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},
  soc:    {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:10,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
});

// ─── TOP NAV ──────────────────────────────────────────────────────────────────
const TopNav = memo(({name}:{name:string}) => {
  const router=useRouter();
  return(
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:6,paddingBottom:2}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        <View style={{width:1,height:10,backgroundColor:C.faint}}/>
        <Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2}}>{name}</Text>
      </View>
      <View style={{flexDirection:'row',gap:7}}>
        {([{icon:'notifications-outline',route:'/notifications',dot:true},{icon:'settings-outline',route:'/settings',dot:false},{icon:'eye-outline',route:'/backoffice/universe-admin',dot:false}] as const).map(({icon,route,dot})=>(
          <TouchableOpacity key={icon} style={{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}} onPress={()=>router.push(route as any)} activeOpacity={0.75}>
            <Ionicons name={icon} size={14} color={C.offWhite}/>
            {dot&&<View style={{position:'absolute',top:7,right:7,width:5,height:5,borderRadius:2.5,backgroundColor:C.white,borderWidth:1,borderColor:C.bg}}/>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const SkeletonSection = memo(() => (
  <View>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PAD,paddingTop:20,paddingBottom:12}}>
      <Shimmer w={24} h={24} r={8}/><Shimmer w={120} h={11} r={6}/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,gap:10}}>
      {[0,1,2,3].map(i=><Shimmer key={i} w={CARD_W} h={CARD_H} r={12}/>)}
    </ScrollView>
  </View>
));

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router=useRouter();
  const[uid,setUid]=useState<string|null>(null);
  const[profile,setProfile]=useState<ProfileData>(EMPTY_PROFILE);
  const[reels,setReels]=useState<UserReel[]>([]);
  const[reviews,setReviews]=useState<ReviewItem[]>([]);
  const[favWorks,setFavWorks]=useState<Work[]>([]);
  const[watched,setWatched]=useState<Work[]>([]);
  const[recs,setRecs]=useState<Work[]>([]);
  const[loading,setLoading]=useState(true);
  const[refreshing,setRefreshing]=useState(false);
  const[activeTab,setActiveTab]=useState<GridTab>(0);

  // Auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{if(session?.user?.id)setUid(session.user.id);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setUid(s?.user?.id??null));
    return()=>subscription.unsubscribe();
  },[]);

  // Gamification
  const{missions,badges,score,level}=useGamification(uid||'anonymous');

  // Fetch parallèle
  const loadAll=useCallback(async(userId:string)=>{
    setLoading(true);
    try{
      const[prof,reelsData,critData,favIds,histIds]=await Promise.all([
        db<any>(()=>supabase.from('profiles').select('*').eq('id',userId).maybeSingle(),'profiles'),
        db<any[]>(()=>supabase.from('reels').select('*').eq('user_id',userId).order('created_at',{ascending:false}),'reels'),
        db<any[]>(()=>supabase.from('critiques').select('*').eq('user_id',userId).order('created_at',{ascending:false}),'critiques'),
        db<any[]>(()=>supabase.from('user_favorites').select('work_id').eq('user_id',userId),'favorites'),
        db<any[]>(()=>supabase.from('user_history').select('work_id').eq('user_id',userId),'history'),
      ]);
      if(prof)setProfile(mapProfile(prof));
      setReels((reelsData??[]).map(mapReel));
      setReviews((critData??[]).map(mapCritique).sort((a,b)=>(b.likes??0)-(a.likes??0)));
      const favIds2=(favIds??[]).map((r:any)=>r.work_id).filter(Boolean);
      const histIds2=(histIds??[]).map((r:any)=>r.work_id).filter(Boolean);
      const[favData,histData]=await Promise.all([
        favIds2.length?db<any[]>(()=>supabase.from('works').select('*').in('id',favIds2),'works-fav'):null,
        histIds2.length?db<any[]>(()=>supabase.from('works').select('*').in('id',histIds2),'works-hist'):null,
      ]);
      if(favData)setFavWorks(favData.map(mapWork));
      if(histData)setWatched(histData.map(mapWork));
      const seenIds=[...new Set([...favIds2,...histIds2])];
      const genres=[...new Set([...(favData??[]),...(histData??[])].map((w:any)=>w?.genre).filter(Boolean))];
      if(genres.length){const recData=await db<any[]>(()=>supabase.from('works').select('*').in('genre',genres).order('likes',{ascending:false}).limit(12),'recs');if(recData)setRecs(recData.map(mapWork).filter(w=>!seenIds.includes(w.id)));}
    }catch(e){if(__DEV__)console.error('[profile]',e);}
    finally{setLoading(false);setRefreshing(false);}
  },[]);

  useEffect(()=>{if(uid)loadAll(uid);},[uid,loadAll]);
  useFocusEffect(useCallback(()=>{if(uid)loadAll(uid);},[uid,loadAll]));

  // Realtime profiles + reels
  useEffect(()=>{
    if(!uid)return;
    const ts=Date.now();
    const ch1=supabase.channel(`rt_r_${ts}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reels'},({new:r})=>{const u=mapReel(r);setReels(p=>p.map(x=>x.id===u.id?u:x));})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'reels'},({new:r})=>{const reel=mapReel(r);if(reel.id)setReels(p=>[reel,...p.filter(x=>x.id!==reel.id)]);})
      .subscribe();
    const ch2=supabase.channel(`rt_p_${ts}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},({new:r})=>{if((r as any).id===uid)setProfile(mapProfile(r));})
      .subscribe();
    return()=>{supabase.removeChannel(ch1);supabase.removeChannel(ch2);};
  },[uid]);

  const hotId=useMemo(()=>reels.length<2?null:[...reels].sort((a,b)=>momentum(b)-momentum(a))[0]?.id??null,[reels]);
  const reelsByCat=useMemo(()=>{const courts:UserReel[]=[],moyens:UserReel[]=[],series:UserReel[]=[];reels.forEach(r=>{if(!r.duration||r.duration<=1800)courts.push(r);else if(r.duration<=5400)moyens.push(r);else series.push(r);});return{courts,moyens,series};},[reels]);
  const displayName=profile.display_name||profile.username||'Mon Profil';

  // ── RENDERS ──────────────────────────────────────────────────────────────────
  const renderFilms=()=>{
    if(loading)return<View><SkeletonSection/><SkeletonSection/><SkeletonSection/></View>;
    return(
      <View>
        <SectionHeader icon="heart-outline" label="Œuvres favorites" count={favWorks.length} onViewAll={()=>router.push('/profile/favorites' as any)}/>
        {!favWorks.length?<EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegardez des films depuis le catalogue"/>:<HScrollRow>{favWorks.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}</HScrollRow>}
        <View style={pg.div}/>
        <SectionHeader icon="create-outline" label="Mes critiques" subtitle="Par popularité" onViewAll={()=>router.push('/profile/reviews' as any)}/>
        {!reviews.length?<EmptyState icon="chatbubble-outline" text="Aucune critique"/>:<HScrollRow>{reviews.map((r,i)=><CritiqueCard key={r.id} review={r} rank={i+1} onPress={()=>router.push(`/review/${r.id}` as any)}/>)}</HScrollRow>}
        <View style={pg.div}/>
        <SectionHeader icon="eye-outline" label="Œuvres visionnées" onViewAll={()=>router.push('/profile/seen_films' as any)}/>
        {!watched.length?<EmptyState icon="film-outline" text="Aucun visionnage"/>:<HScrollRow>{watched.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}</HScrollRow>}
        <View style={pg.div}/>
        <SectionHeader icon="shuffle-outline" label="Recommandés" subtitle="Basé sur vos goûts"/>
        {!recs.length?<EmptyState icon="planet-outline" text="Aucune recommandation"/>:<HScrollRow>{recs.map(f=><PortraitCard key={f.id} item={f}/>)}</HScrollRow>}
        <View style={{height:110}}/>
      </View>
    );
  };

  const renderCreations=()=>{
    if(loading)return<View><SkeletonSection/></View>;
    if(!reels.length)return(
      <View style={{paddingTop:50,paddingHorizontal:H_PAD}}>
        <EmptyState icon="videocam-outline" text="Aucune création" subtext="Importez vos vidéos depuis l'onglet Créer"/>
        <TouchableOpacity style={pg.importBtn} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={14} color={C.mid}/>
          <Text style={{color:C.mid,fontSize:12.5,fontWeight:'700'}}>Importer une vidéo</Text>
        </TouchableOpacity>
        <View style={{height:110}}/>
      </View>
    );
    const approved=reels.filter(r=>r.status==='approved').length,pending=reels.filter(r=>r.status==='pending').length,rejected=reels.filter(r=>r.status==='rejected').length;
    const totalV=reels.reduce((s,r)=>s+r.views_count,0),totalL=reels.reduce((s,r)=>s+r.likes_count,0);
    const secs=reels.every(r=>r.duration==null)?[{key:'all',label:'Mes vidéos',icon:'videocam-outline' as const,sub:'Toutes',data:reels}]:[{key:'courts',label:'Courts métrages',icon:'videocam-outline' as const,sub:'≤ 30 min',data:reelsByCat.courts},{key:'moyens',label:'Moyens métrages',icon:'tv-outline' as const,sub:'30–90 min',data:reelsByCat.moyens},{key:'series',label:'Mini-séries',icon:'film-outline' as const,sub:'> 90 min',data:reelsByCat.series}].filter(s=>s.data.length>0);
    return(
      <View>
        <View style={pg.reelStats}>
          {[{icon:'film-outline' as const,v:`${reels.length}`,l:'vidéos'},{icon:'checkmark-circle-outline' as const,v:`${approved}`,l:'validées'},{icon:'time-outline' as const,v:`${pending}`,l:'attente'},{icon:'eye-outline' as const,v:fmt(totalV),l:'vues'},{icon:'heart-outline' as const,v:fmt(totalL),l:'likes'}].map(({icon,v,l},i,arr)=>(
            <React.Fragment key={l}>
              <View style={pg.reelStat}><Ionicons name={icon} size={11} color={C.muted}/><Text style={pg.rsV}>{v}</Text><Text style={pg.rsL}>{l}</Text></View>
              {i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:4}}/>}
            </React.Fragment>
          ))}
        </View>
        {rejected>0&&<View style={pg.rejBar}><Ionicons name="alert-circle-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11,flex:1}}>{rejected} création{rejected>1?'s':''} refusée{rejected>1?'s':''}</Text></View>}
        {secs.map((s,si)=>(
          <View key={s.key}>
            <SectionHeader icon={s.icon} label={s.label} subtitle={s.sub}/>
            <HScrollRow pb={8}>{s.data.map(r=><ReelCard key={r.id} reel={r} isHot={r.id===hotId}/>)}</HScrollRow>
            {si<secs.length-1&&<View style={pg.div}/>}
          </View>
        ))}
        <View style={{height:110}}/>
      </View>
    );
  };

  const tabs=[{icon:'grid-outline' as const,label:'Films'},{icon:'play-circle-outline' as const,label:'Créations'},{icon:'pricetag-outline' as const,label:'Tags'}];

  return(
    <View style={pg.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);if(uid)loadAll(uid);}} tintColor={C.mid}/>}
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(7,12,23,0.70)','transparent']} style={pg.topGrad} pointerEvents="none"/>
          <TopNav name={displayName}/>
          <ProfileHeader
            profile={profile} filmCount={watched.length}
            critiqueCount={reviews.length} reelCount={reels.length}
            level={level} onEdit={()=>router.push('/edit' as any)}
          />
        </SafeAreaView>

        {/* ★ GAMIFICATION (= search.tsx) */}
        <View style={{marginTop:18,gap:14,marginBottom:6}}>
          <CinephileBanner level={level} score={score} badges={badges}/>
          <View>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:H_PAD,marginBottom:10}}>
              <Ionicons name="ribbon-outline" size={12} color={C.mid}/>
              <Text style={{color:C.white,fontSize:15,fontWeight:'800'}}>Mes badges</Text>
            </View>
            <BadgesRow badges={badges}/>
          </View>
          <View>
          </View>
        </View>

        {/* Tabs */}
        <View style={pg.tabBar}>
          {tabs.map(({icon,label},idx)=>{
            const active=activeTab===idx;
            const badge=idx===1?reels.filter(r=>r.status==='pending').length:0;
            return(
              <TouchableOpacity key={icon} style={pg.tabItem} onPress={()=>setActiveTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active?(icon.replace('-outline','') as any):icon} size={17} color={active?C.white:C.muted}/>
                <Text style={[pg.tabLabel,active&&pg.tabLabelOn]}>{label}</Text>
                {active&&<View style={pg.tabInd}/>}
                {badge>0&&<View style={pg.badge}><Text style={pg.badgeTxt}>{badge}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
        {activeTab===0&&renderFilms()}
        {activeTab===1&&renderCreations()}
        {activeTab===2&&<View style={{paddingTop:50}}><EmptyState icon="pricetag-outline" text="Onglet Tags" subtext="Les œuvres où vous êtes crédité·e apparaîtront ici."/><View style={{height:110}}/></View>}
      </ScrollView>
    </View>
  );
}

const pg=StyleSheet.create({
  root:      {flex:1,backgroundColor:C.bg},
  topGrad:   {position:'absolute',top:0,left:0,right:0,height:160},
  div:       {height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22},
  tabBar:    {flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginTop:18},
  tabItem:   {flex:1,alignItems:'center',paddingVertical:10,gap:3,position:'relative'},
  tabLabel:  {fontSize:8.5,fontWeight:'700',color:C.muted,letterSpacing:0.5,textTransform:'uppercase'},
  tabLabelOn:{color:C.white},
  tabInd:    {position:'absolute',top:0,left:'20%',right:'20%',height:2,backgroundColor:C.white,borderBottomLeftRadius:2,borderBottomRightRadius:2},
  badge:     {position:'absolute',top:6,right:10,minWidth:14,height:14,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',paddingHorizontal:3},
  badgeTxt:  {color:C.white,fontSize:7,fontWeight:'900'},
  reelStats: {flexDirection:'row',paddingHorizontal:H_PAD,paddingVertical:14,marginBottom:4},
  reelStat:  {flex:1,alignItems:'center',gap:3},
  rsV:       {color:C.white,fontSize:15,fontWeight:'900',letterSpacing:-0.5},
  rsL:       {color:C.muted,fontSize:7.5,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  rejBar:    {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:H_PAD,marginBottom:10,paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},
  importBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:16,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,paddingVertical:13},
});