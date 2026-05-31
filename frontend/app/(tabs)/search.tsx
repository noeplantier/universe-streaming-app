import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, FlatList, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase }          from '@/lib/supabase';
import GalaxyBackground      from '@/components/social/GalaxyBackground';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
  blue:'#5A96E6', blueFaint:'rgba(90,150,230,0.10)',
  gold:'#F5C842', green:'#2ECC8A',
} as const;
const EDGE = 20;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null;
  director:string|null; created_at?:string;
}
interface UserStats {
  watchCount:number; critiqueCount:number; favCount:number;
  watchedGenres:Record<string,number>; watchedDirectors:string[];
  isNight:boolean; totalLikedLowPopularity:number;
}
interface Mission {
  id:string; title:string; desc:string; reward:string;
  icon:keyof typeof Ionicons.glyphMap;
  target:number; progress:number; completed:boolean;
  filter:(w:Work)=>boolean;
}
interface Badge {
  id:string; label:string; desc:string;
  icon:keyof typeof Ionicons.glyphMap; earned:boolean;
}

// ─── Types défi hebdomadaire ───────────────────────────────────────────────
interface ChallengeStep {
  index:       number;
  title:       string;
  desc:        string;
  action:      string;  // go_profile | go_create | go_social | go_catalog | filter_courts | filter_pepites | filter_originals
  actionLabel: string;
  icon:        keyof typeof Ionicons.glyphMap;
}
interface WeeklyChallenge {
  id:            number;
  week_number:   number;
  title:         string;
  subtitle:      string;
  description:   string;
  icon:          keyof typeof Ionicons.glyphMap;
  color_accent:  string;
  steps:         ChallengeStep[];
  filter_config: { type: string; value?: any; max?: number } | null;
  reward_label:  string;
  reward_points: number;
}
interface ChallengeProgress {
  step_index: number;
  completed:  boolean;
  points_earned: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const resolveImg = (id:number, img:string|null) => {
  if (!img) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (img.startsWith('http')) return img;
  try { return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl; }
  catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
};
const fmtK   = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const fmtDur = (m:number|null) => { if(!m)return''; if(m>=60)return`${Math.floor(m/60)}h${m%60>0?` ${m%60}min`:''}`; return`${m}min`; };

// Numéro de semaine ISO courant (1-52, cyclique)
function currentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week  = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return ((week - 1) % 52) + 1;
}

// Fallback si pas de DB
const FALLBACK_CHALLENGE: WeeklyChallenge = {
  id: 0, week_number: currentWeekNumber(),
  title: 'Bienvenue sur Universe',
  subtitle: 'Votre première création',
  description: 'Découvrez comment importer et partager votre première œuvre cinématographique.',
  icon: 'film-outline',
  color_accent: '#5A96E6',
  steps: [
    { index:0, title:'Créez votre profil',    desc:'Personnalisez votre page créateur — bio, spécialités, liens sociaux.',      action:'go_profile',  actionLabel:'Mon profil',       icon:'person-outline'       },
    { index:1, title:'Importez une vidéo',    desc:'Rendez-vous dans Créer pour importer votre premier reel. Format MP4/MOV.',  action:'go_create',   actionLabel:'Importer',         icon:'cloud-upload-outline' },
    { index:2, title:'Explorez le catalogue', desc:'Regardez des œuvres, likez, commentez pour construire votre profil.',      action:'go_catalog',  actionLabel:'Explorer',         icon:'compass-outline'      },
    { index:3, title:'Rejoignez les pros',    desc:'Connectez-vous à des réalisateurs et producteurs depuis Communauté.',      action:'go_social',   actionLabel:'Voir les pros',    icon:'briefcase-outline'    },
  ],
  filter_config: null,
  reward_label: 'Badge Nouvel Arrivant',
  reward_points: 30,
};

// ─── GAMIFICATION ─────────────────────────────────────────────────────────────
function buildMissions(stats:UserStats, works:Work[]): Mission[] {
  return [
    { id:'explorateur_indie', title:'Explorateur indé', desc:'Regardez 5 courts-métrages de moins de 30 min', reward:'Badge · Explorateur indé', icon:'compass-outline', target:5, progress:Math.min(5,Math.floor(stats.watchCount*0.4)), completed:stats.watchCount>=5, filter:(w)=>(w.duration??0)>0&&(w.duration??0)<30 },
    { id:'decouvreur_pepites', title:'Découvreur de pépites', desc:'Aimez 3 films avant qu\'ils deviennent populaires', reward:'Badge · Chasseur de pépites', icon:'sparkles-outline', target:3, progress:Math.min(3,stats.totalLikedLowPopularity), completed:stats.totalLikedLowPopularity>=3, filter:(w)=>(w.likes??0)<100 },
    { id:'critique_herbe', title:'Critique en herbe', desc:'Publiez 5 avis argumentés sur des œuvres', reward:'Badge · Voix critique', icon:'create-outline', target:5, progress:Math.min(5,stats.critiqueCount), completed:stats.critiqueCount>=5, filter:()=>true },
  ];
}
function buildBadges(stats:UserStats): Badge[] {
  return [
    { id:'explorer',  label:'Explorateur indé',     desc:'5 courts regardés',         icon:'compass-outline',  earned:stats.watchCount>=5 },
    { id:'nocturne',  label:'Cinéphile nocturne',    desc:'Actif après 22h',           icon:'moon-outline',     earned:stats.isNight },
    { id:'pepiteur',  label:'Découvreur de pépites', desc:'3 films rares aimés',       icon:'sparkles-outline', earned:stats.totalLikedLowPopularity>=3 },
    { id:'critique',  label:'Critique en herbe',     desc:'5 avis publiés',            icon:'create-outline',   earned:stats.critiqueCount>=5 },
    { id:'curateur',  label:'Curateur',              desc:'10 favoris sauvegardés',    icon:'bookmark-outline', earned:stats.favCount>=10 },
    { id:'omnivore',  label:'Cinéphile omnivore',    desc:'5 genres explorés',         icon:'layers-outline',   earned:Object.keys(stats.watchedGenres).length>=5 },
  ];
}
function cinephileLevel(score:number): { n:number; label:string; pct:number } {
  const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];
  const c=[...L].reverse().find(x=>score>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===c.n)+1;const nx=L[ni]??L[L.length-1];
  return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at))};
}

function useGamification(userId:string, works:Work[]) {
  const [stats,setStats]=useState<UserStats>({watchCount:0,critiqueCount:0,favCount:0,watchedGenres:{},watchedDirectors:[],isNight:false,totalLikedLowPopularity:0});
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!userId||userId==='anonymous'){setLoading(false);return;}
    const isNight=new Date().getHours()>=22||new Date().getHours()<4;
    Promise.all([
      supabase.from('user_history').select('work_id').eq('user_id',userId),
      supabase.from('critiques').select('id').eq('user_id',userId),
      supabase.from('user_favorites').select('work_id').eq('user_id',userId),
    ]).then(([hist,crit,favs])=>{
      const histIds=(hist.data??[]).map((r:any)=>r.work_id);
      const watchedWorks=works.filter(w=>histIds.includes(w.id));
      const genres:Record<string,number>={};
      watchedWorks.forEach(w=>{if(w.genre)genres[w.genre]=(genres[w.genre]??0)+1;});
      const likedLowPop=works.filter(w=>histIds.includes(w.id)&&(w.likes??0)<100).length;
      setStats({watchCount:histIds.length,critiqueCount:(crit.data??[]).length,favCount:(favs.data??[]).length,watchedGenres:genres,watchedDirectors:[],isNight,totalLikedLowPopularity:likedLowPop});
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[userId,works.length]);
  const missions=useMemo(()=>buildMissions(stats,works),[stats,works]);
  const badges  =useMemo(()=>buildBadges(stats),[stats]);
  const score   =useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+stats.totalLikedLowPopularity*10+(stats.isNight?5:0),[stats]);
  const level   =useMemo(()=>cinephileLevel(score),[score]);
  return{missions,badges,stats,score,level,loading};
}

// ─── FETCH WORKS ──────────────────────────────────────────────────────────────
const COLS='id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at';
async function fetchAllWorks():Promise<Work[]>{
  const{data,error}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(200);
  if(error){const{data:fb}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(100);return(fb??[]) as Work[];}
  return(data??[]) as Work[];
}

// ─── FETCH WEEKLY CHALLENGE ───────────────────────────────────────────────────
async function fetchWeeklyChallenge(): Promise<WeeklyChallenge | null> {
  const weekNum = currentWeekNumber();
  const { data, error } = await supabase
    .from('weekly_challenges')
    .select('*')
    .eq('week_number', weekNum)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    steps: Array.isArray(data.steps) ? data.steps : [],
    filter_config: data.filter_config ?? null,
  } as WeeklyChallenge;
}

async function fetchChallengeProgress(userId:string, weekNum:number): Promise<ChallengeProgress | null> {
  if (!userId || userId === 'anonymous') return null;
  const { data } = await supabase
    .from('challenge_progress')
    .select('step_index,completed,points_earned')
    .eq('user_id', userId)
    .eq('week_number', weekNum)
    .maybeSingle();
  return data ?? null;
}

async function upsertChallengeProgress(userId:string, weekNum:number, stepIndex:number, completed:boolean, points:number) {
  if (!userId || userId === 'anonymous') return;
  await supabase.from('challenge_progress').upsert({
    user_id:       userId,
    week_number:   weekNum,
    step_index:    stepIndex,
    completed,
    points_earned: points,
    completed_at:  completed ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,week_number' });
}

// ─── SHIMMER ──────────────────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number|string;h:number;r?:number})=>{
  const op=useRef(new Animated.Value(0.18)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.38,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.18,duration:900,useNativeDriver:true})]));a.start();return()=>a.stop();},[op]);
  return<Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H=SH*0.50,AUTO_MS=5000;
const HeroSlide=memo(({item,width,onPress}:{item:Work;width:number;onPress:()=>void})=>{
  const fade=useRef(new Animated.Value(0)).current;
  const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const isPepite=(item.likes??0)<100;
  return(<TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{width,height:HERO_H}}><View style={[StyleSheet.absoluteFill,{backgroundColor:C.navyMid}]}/><Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover" onLoad={()=>Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/><LinearGradient colors={['rgba(7,12,23,0.50)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:140}} pointerEvents="none"/><LinearGradient colors={['transparent','rgba(7,12,23,0.72)','rgba(7,12,23,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/><View style={hs.content}><View style={{flexDirection:'row',alignItems:'center',gap:6}}>{item.is_original&&<View style={hs.origBadge}><Ionicons name="star" size={8} color={C.white}/><Text style={hs.origTxt}>ORIGINAL</Text></View>}{isPepite&&<View style={hs.pepiteBadge}><Ionicons name="sparkles" size={8} color={C.white}/><Text style={hs.pepiteTxt}>PÉPITE</Text></View>}</View><Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>{!!(item.adjective||item.genre)&&<Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={11} color={C.mid}/><Text style={hs.statTxt}>{fmtK(item.likes??0)}</Text></View>{item.duration!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.subtle}}/><Text style={hs.statTxt}>{fmtDur(item.duration)}</Text></>}</View><View style={hs.actions}><TouchableOpacity style={hs.playBtn} onPress={onPress} activeOpacity={0.85}><Ionicons name="play" size={14} color={C.navyMid}/><Text style={{color:C.navyMid,fontSize:13,fontWeight:'700'}}>Regarder</Text></TouchableOpacity><TouchableOpacity style={hs.infoBtn} onPress={onPress} activeOpacity={0.80}><Ionicons name="information-circle-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:13,fontWeight:'600'}}>Détails</Text></TouchableOpacity></View></View></TouchableOpacity>);
});
const hs=StyleSheet.create({content:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:52,gap:8},origBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(255,255,255,0.08)'},origTxt:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},pepiteBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:'rgba(255,255,255,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},pepiteTxt:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},title:{color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32},sub:{color:C.muted,fontSize:13},statTxt:{color:C.muted,fontSize:11,fontWeight:'600'},actions:{flexDirection:'row',gap:10,marginTop:2},playBtn:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24},infoBtn:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}});

const HeroBanner=memo(({works,loading}:{works:Work[];loading:boolean})=>{
  const router=useRouter();const scrollX=useRef(new Animated.Value(0)).current;const flatRef=useRef<FlatList<Work>>(null);const timer=useRef<ReturnType<typeof setInterval>>();const paused=useRef(false),idxRef=useRef(0);const[slotW,setSlotW]=useState(SW);
  const scrollTo=useCallback((i:number,animated=true)=>{if(!works.length||slotW===0)return;const next=((i%works.length)+works.length)%works.length;flatRef.current?.scrollToOffset({offset:next*slotW,animated});idxRef.current=next;},[works.length,slotW]);
  useEffect(()=>{if(works.length<2)return;clearInterval(timer.current);timer.current=setInterval(()=>{if(!paused.current)scrollTo(idxRef.current+1);},AUTO_MS);return()=>clearInterval(timer.current);},[works.length,scrollTo]);
  const onScroll=useMemo(()=>Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}],{useNativeDriver:false}),[scrollX]);
  const renderItem=useCallback(({item}:ListRenderItemInfo<Work>)=><HeroSlide item={item} width={slotW} onPress={()=>router.push(`/film/${item.id}` as any)}/>,[router,slotW]);
  const keyExtract=useCallback((w:Work)=>`hero-${w.id}`,[]);
  if(loading||!works.length)return<View style={{height:HERO_H,backgroundColor:C.navyLow}}><View style={{...StyleSheet.absoluteFillObject,padding:22,justifyContent:'flex-end',gap:10}}><Shimmer w="50%" h={12}/><Shimmer w="75%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="54%" h={40} r={24}/></View></View>;
  const dotCount=Math.min(works.length,8);
  return(<View style={{height:HERO_H,overflow:'hidden'}} onLayout={e=>setSlotW(e.nativeEvent.layout.width)}><FlatList ref={flatRef} data={works} keyExtractor={keyExtract} renderItem={renderItem} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={()=>{paused.current=true;}} onMomentumScrollEnd={e=>{idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW);paused.current=false;}} windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>{works.length>1&&<View style={{position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5}}>{Array.from({length:dotCount}).map((_,i)=>{const inp=[(i-1)*slotW,i*slotW,(i+1)*slotW];return(<TouchableOpacity key={i} onPress={()=>scrollTo(i)} hitSlop={10}><Animated.View style={{height:3,borderRadius:2,backgroundColor:C.white,opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'})}}/></TouchableOpacity>);})}</View>}</View>);
});

// ─── PORTRAIT CARD ────────────────────────────────────────────────────────────
const PORT_W=128,PORT_H=190;
const PortraitCard=memo(({item,rank,isPepite}:{item:Work;rank?:number;isPepite?:boolean})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={prc.card}><Image source={{uri}} style={prc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.90)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={prc.badge}><Text style={prc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{isPepite&&<View style={prc.pepite}><Ionicons name="sparkles" size={7} color={C.white}/><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5}}>PÉPITE</Text></View>}{rank!=null&&<Text style={prc.rankNum}>{rank}</Text>}<View style={prc.meta}><Text style={prc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={prc.stat}>{fmtK(item.likes??0)}</Text>{item.year&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={prc.stat}>{item.year}</Text></>}</View></View></View></TouchableOpacity>);
});
const prc=StyleSheet.create({card:{width:PORT_W,height:PORT_H,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',resizeMode:'cover'},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},pepite:{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},rankNum:{position:'absolute',bottom:32,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.12)'},meta:{position:'absolute',bottom:8,left:9,right:9,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

// ─── LANDSCAPE CARD ───────────────────────────────────────────────────────────
const LAND_W=226,LAND_H=128;
const LandscapeCard=memo(({item}:{item:Work})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={lc.card}><Image source={{uri}} style={lc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>{item.duration!=null&&<View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'600'}}>{fmtDur(item.duration)}</Text></View>}<View style={lc.meta}><Text style={lc.title} numberOfLines={1}>{item.title}</Text>{!!item.adjective&&<Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{item.adjective}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={lc.stat}>{fmtK(item.likes??0)}</Text>{item.director&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}</View></View></View></TouchableOpacity>);
});
const lc=StyleSheet.create({card:{width:LAND_W,height:LAND_H,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',resizeMode:'cover'},dur:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(7,12,23,0.72)',paddingHorizontal:7,paddingVertical:3,borderRadius:7},meta:{position:'absolute',bottom:9,left:10,right:10,gap:2},title:{color:C.white,fontSize:12,fontWeight:'700'},stat:{color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1}});

// ─── ROW SECTION ──────────────────────────────────────────────────────────────
const RowSection=memo(({title,subtitle,count,items,loading,variant,showRank,showPepite}:{title:string;subtitle?:string;count?:number;items:Work[];loading:boolean;variant:'portrait'|'landscape';showRank?:boolean;showPepite?:boolean})=>{
  const isPort=variant==='portrait';const CW=isPort?PORT_W:LAND_W;const CH=isPort?PORT_H:LAND_H;const SNAP=CW+10;
  const renderItem=useCallback(({item,index}:{item:Work;index:number})=>isPort?<PortraitCard item={item} rank={showRank?index+1:undefined} isPepite={showPepite&&(item.likes??0)<100}/>:<LandscapeCard item={item}/>,[isPort,showRank,showPepite]);
  const getLayout=useCallback((_:any,i:number)=>({length:SNAP,offset:SNAP*i,index:i}),[SNAP]);
  const keyExtract=useCallback((w:Work)=>`${variant}-${w.id}`,[variant]);
  if(loading)return(<View style={{marginBottom:0}}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:10}}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>);
  if(!items.length)return null;
  return(<View style={{marginBottom:0}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:EDGE,marginBottom:14}}><View style={{flex:1,gap:2}}><Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3}}>{title}</Text>{(subtitle||count!=null)&&<Text style={{color:C.muted,fontSize:11}}>{[subtitle,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}</View></View><FlatList horizontal data={items} keyExtractor={keyExtract} renderItem={renderItem} getItemLayout={getLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE}} decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start" initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/></View>);
});

// ─── MISSION CARD ─────────────────────────────────────────────────────────────
const MissionCard=memo(({mission,onPress}:{mission:Mission;onPress:(m:Mission)=>void})=>{
  const pct=mission.target>0?Math.min(1,mission.progress/mission.target):0;
  return(<TouchableOpacity style={[mc.wrap,mission.completed&&mc.wrapDone]} onPress={()=>onPress(mission)} activeOpacity={0.85}><BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={mc.row}><View style={[mc.iconWrap,mission.completed&&mc.iconDone]}><Ionicons name={mission.completed?'checkmark-circle':mission.icon} size={20} color={mission.completed?C.white:C.mid}/></View><View style={{flex:1,gap:4}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={[mc.title,mission.completed&&mc.titleDone]} numberOfLines={1}>{mission.title}</Text>{mission.completed&&<View style={mc.badge}><Text style={mc.badgeTxt}>ACCOMPLI</Text></View>}</View><Text style={mc.desc} numberOfLines={1}>{mission.desc}</Text><View style={mc.progressRow}><View style={mc.track}><View style={[mc.fill,{width:`${pct*100}%`,backgroundColor:mission.completed?C.white:C.subtle}]}/></View><Text style={[mc.pct,mission.completed&&{color:C.white}]}>{mission.progress}/{mission.target}</Text></View><View style={mc.rewardRow}><Ionicons name="gift-outline" size={9} color={C.muted}/><Text style={mc.rewardTxt}>{mission.reward}</Text></View></View><Ionicons name="chevron-forward" size={13} color={C.border} style={{alignSelf:'center'}}/></View></TouchableOpacity>);
});
const mc=StyleSheet.create({wrap:{marginHorizontal:EDGE,marginBottom:10,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},wrapDone:{borderColor:C.borderHi},row:{flexDirection:'row',alignItems:'flex-start',gap:12,padding:14},iconWrap:{width:44,height:44,borderRadius:12,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},iconDone:{backgroundColor:C.subtle,borderColor:C.borderHi},title:{color:C.offWhite,fontSize:13,fontWeight:'700',flex:1},titleDone:{color:C.white},desc:{color:C.muted,fontSize:11,lineHeight:15},progressRow:{flexDirection:'row',alignItems:'center',gap:8},track:{flex:1,height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},fill:{height:'100%',borderRadius:2},pct:{color:C.muted,fontSize:10,fontWeight:'700'},badge:{paddingHorizontal:7,paddingVertical:2,borderRadius:8,backgroundColor:C.subtle,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},badgeTxt:{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5},rewardRow:{flexDirection:'row',alignItems:'center',gap:5},rewardTxt:{color:C.muted,fontSize:10}});

// ─── BADGES ROW ───────────────────────────────────────────────────────────────
const BadgesRow=memo(({badges}:{badges:Badge[]})=>{
  const all=[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)];
  return(<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:8}}>{all.map(b=><TouchableOpacity key={b.id} style={[br.wrap,b.earned&&br.earned]} activeOpacity={0.80}><View style={[br.icon,b.earned&&br.iconEarned]}><Ionicons name={b.icon} size={16} color={b.earned?C.white:C.muted}/></View><Text style={[br.label,b.earned&&br.labelEarned]} numberOfLines={2}>{b.label}</Text>{!b.earned&&<View style={br.lock}><Ionicons name="lock-closed" size={8} color={C.muted}/></View>}</TouchableOpacity>)}</ScrollView>);
});
const br=StyleSheet.create({wrap:{alignItems:'center',gap:7,padding:12,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:88,opacity:0.55},earned:{opacity:1,borderColor:C.borderHi,backgroundColor:C.subtle},icon:{width:38,height:38,borderRadius:19,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},iconEarned:{borderColor:C.borderHi},label:{color:C.muted,fontSize:9,fontWeight:'600',textAlign:'center',lineHeight:13},labelEarned:{color:C.white},lock:{position:'absolute',top:8,right:8}});

// ─════════════════════════════════════════════════════════════════════════════
// ★ WEEKLY CHALLENGE CARD (compacte, sur la page principale)
// ─════════════════════════════════════════════════════════════════════════════
const WeeklyChallengeCard = memo(function WeeklyChallengeCard({
  challenge, progress, onOpen,
}: {
  challenge: WeeklyChallenge;
  progress:  ChallengeProgress | null;
  onOpen:    () => void;
}) {
  const stepsDone = progress?.step_index ?? 0;
  const total     = challenge.steps.length;
  const pct       = total > 0 ? stepsDone / total : 0;
  const accent    = challenge.color_accent;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (progress?.completed) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:1.04, duration:1800, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,    duration:1800, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [progress?.completed, pulseAnim]);

  return (
    <Animated.View style={{ transform:[{ scale: pulseAnim }], marginHorizontal:EDGE, marginBottom:6 }}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={wcc.wrap}>
        <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>

        {/* Accent color strip */}
        <View style={[wcc.strip, { backgroundColor: accent }]} />

        <View style={wcc.inner}>
          {/* Header */}
          <View style={wcc.header}>
            <View style={[wcc.iconCircle, { borderColor: accent + '40', backgroundColor: accent + '18' }]}>
              <Ionicons name={challenge.icon} size={20} color={accent}/>
            </View>
            <View style={{ flex:1, gap:2 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <View style={[wcc.weekBadge, { borderColor: accent + '35', backgroundColor: accent + '12' }]}>
                  <Ionicons name="flame-outline" size={9} color={accent}/>
                  <Text style={[wcc.weekTxt, { color: accent }]}>DÉFI SEMAINE {challenge.week_number}</Text>
                </View>
                {progress?.completed && (
                  <View style={wcc.completedBadge}>
                    <Ionicons name="checkmark-circle" size={10} color={C.green}/>
                    <Text style={wcc.completedTxt}>TERMINÉ</Text>
                  </View>
                )}
              </View>
              <Text style={wcc.title}>{challenge.title}</Text>
              <Text style={wcc.subtitle}>{challenge.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted}/>
          </View>

          {/* Progress bar */}
          <View style={wcc.progressWrap}>
            <View style={wcc.progressTrack}>
              <View style={[wcc.progressFill, { width: `${pct * 100}%` as any, backgroundColor: accent }]}/>
            </View>
            <Text style={wcc.progressLabel}>
              {progress?.completed ? `+${challenge.reward_points} pts gagnés` : `${stepsDone}/${total} étapes · ${challenge.reward_points} pts`}
            </Text>
          </View>

          {/* Reward hint */}
          <View style={wcc.rewardRow}>
            <Ionicons name="gift-outline" size={10} color={C.muted}/>
            <Text style={wcc.rewardTxt}>{challenge.reward_label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const wcc = StyleSheet.create({
  wrap:           { borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi },
  strip:          { position:'absolute', left:0, top:0, bottom:0, width:3 },
  inner:          { padding:16, paddingLeft:20, gap:12 },
  header:         { flexDirection:'row', alignItems:'flex-start', gap:12 },
  iconCircle:     { width:46, height:46, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  weekBadge:      { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:8, borderWidth:StyleSheet.hairlineWidth },
  weekTxt:        { fontSize:8, fontWeight:'800', letterSpacing:0.8 },
  completedBadge: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:8, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(46,204,138,0.30)', backgroundColor:'rgba(46,204,138,0.08)' },
  completedTxt:   { color:C.green, fontSize:8, fontWeight:'800', letterSpacing:0.5 },
  title:          { color:C.white, fontSize:16, fontWeight:'800', letterSpacing:-0.3 },
  subtitle:       { color:C.muted, fontSize:12 },
  progressWrap:   { gap:5 },
  progressTrack:  { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
  progressFill:   { height:'100%', borderRadius:2 },
  progressLabel:  { color:C.muted, fontSize:10, fontWeight:'600' },
  rewardRow:      { flexDirection:'row', alignItems:'center', gap:6 },
  rewardTxt:      { color:C.muted, fontSize:10 },
});

// ─════════════════════════════════════════════════════════════════════════════
// ★ WEEKLY CHALLENGE MODAL — tutoriel interactif pas-à-pas
// Style identique à la SearchOverlay (GalaxyBackground + slide-up)
// ─════════════════════════════════════════════════════════════════════════════
const WeeklyChallengeModal = memo(function WeeklyChallengeModal({
  visible, onClose, challenge, progress, onStepComplete, works, userId,
}: {
  visible:        boolean;
  onClose:        () => void;
  challenge:      WeeklyChallenge;
  progress:       ChallengeProgress | null;
  onStepComplete: (stepIndex:number, completed:boolean) => void;
  works:          Work[];
  userId:         string;
}) {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(SH)).current;
  const accent   = challenge.color_accent;

  // Étape active — commence à la progression sauvegardée
  const [activeStep, setActiveStep] = useState(progress?.step_index ?? 0);

  useEffect(() => {
    if (progress) setActiveStep(progress.step_index);
  }, [progress]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue:0, tension:65, friction:12, useNativeDriver:true }).start();
    } else {
      Animated.timing(slideY, { toValue:SH, duration:220, useNativeDriver:true }).start();
    }
  }, [visible, slideY]);

  const steps   = challenge.steps;
  const total   = steps.length;
  const current = steps[activeStep] ?? steps[0];
  const isDone  = progress?.completed ?? false;
  const pct     = total > 0 ? (activeStep + (isDone ? 1 : 0)) / total : 0;

  // Works filtrés selon le défi pour l'illustration en bas de modale
  const filteredWorks = useMemo(() => {
    const cfg = challenge.filter_config;
    if (!cfg) return works.slice(0, 10);
    if (cfg.type === 'duration' && cfg.max)  return works.filter(w=>(w.duration??0)>0&&(w.duration??0)<=cfg.max!).slice(0,10);
    if (cfg.type === 'likes_max')            return works.filter(w=>(w.likes??0)<(cfg.value??100)).slice(0,10);
    if (cfg.type === 'original')             return works.filter(w=>w.is_original).slice(0,10);
    return works.slice(0, 10);
  }, [challenge.filter_config, works]);

  const handleAction = useCallback((action:string) => {
    switch (action) {
      case 'go_profile':  onClose(); setTimeout(()=>router.push('/profile' as any),250); break;
      case 'go_create':   onClose(); setTimeout(()=>router.push('/(tabs)/create' as any),250); break;
      case 'go_social':   onClose(); setTimeout(()=>router.push('/(tabs)/social' as any),250); break;
      case 'go_catalog':  onClose(); break; // reste sur search
      case 'filter_courts':
      case 'filter_pepites':
      case 'filter_originals':
        onClose();
        break;
      default: break;
    }
  }, [onClose, router]);

  const handleNextStep = useCallback(() => {
    if (activeStep < total - 1) {
      const next = activeStep + 1;
      setActiveStep(next);
      onStepComplete(next, false);
    } else {
      // Dernière étape → terminer
      onStepComplete(activeStep, true);
    }
  }, [activeStep, total, onStepComplete]);

  const handlePrevStep = useCallback(() => {
    if (activeStep > 0) setActiveStep(s => s - 1);
  }, [activeStep]);

  if (!visible) return null;

  const CW = (SW - 42) / 2;

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground />
      <Animated.View style={[wcm.root, { transform:[{ translateY:slideY }] }]}>

        {/* ── Top bar ──────────────────────────────────────────────── */}
        <View style={[wcm.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10, flex:1 }}>
            <View style={[wcm.topIcon, { backgroundColor: accent + '18', borderColor: accent + '35' }]}>
              <Ionicons name={challenge.icon} size={14} color={accent}/>
            </View>
            <View style={{ gap:1 }}>
              <Text style={[wcm.topBadge, { color: accent }]}>DÉFI · SEMAINE {challenge.week_number}</Text>
              <Text style={wcm.topTitle}>{challenge.title}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={wcm.closeBtn}>
            <Ionicons name="close" size={15} color={C.muted}/>
          </TouchableOpacity>
        </View>

        {/* ── Barre de progression globale ─────────────────────────── */}
        <View style={wcm.globalProgressWrap}>
          <View style={wcm.globalTrack}>
            <Animated.View style={[wcm.globalFill, { width:`${pct*100}%` as any, backgroundColor:accent }]}/>
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:6 }}>
            <Text style={wcm.progressInfo}>
              {isDone ? '✓ Défi complété !' : `Étape ${activeStep + 1} sur ${total}`}
            </Text>
            <Text style={[wcm.progressInfo, { color: accent }]}>
              {challenge.reward_points} pts
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardDismissMode="on-drag"
        >
          {/* ── Étapes indicateurs (dots) ─────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={wcm.stepsNav}
          >
            {steps.map((s, i) => {
              const done    = i < activeStep || isDone;
              const current = i === activeStep && !isDone;
              return (
                <TouchableOpacity
                  key={s.index}
                  onPress={() => setActiveStep(i)}
                  style={[wcm.stepDot, done && wcm.stepDotDone, current && wcm.stepDotActive]}
                  activeOpacity={0.75}
                >
                  {done
                    ? <Ionicons name="checkmark" size={10} color={C.white}/>
                    : <Text style={[wcm.stepDotNum, current && { color: accent }]}>{i+1}</Text>
                  }
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Carte étape courante ──────────────────────────────── */}
          {!isDone && current && (
            <View style={wcm.stepCard}>
              <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>

              {/* Icône étape */}
              <View style={[wcm.stepIconWrap, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
                <Ionicons name={current.icon} size={28} color={accent}/>
              </View>

              {/* Contenu */}
              <Text style={wcm.stepTitle}>{current.title}</Text>
              <Text style={wcm.stepDesc}>{current.desc}</Text>

              {/* Bouton action */}
              <TouchableOpacity
                style={[wcm.actionBtn, { borderColor: accent + '40', backgroundColor: accent + '12' }]}
                onPress={() => handleAction(current.action)}
                activeOpacity={0.80}
              >
                <Text style={[wcm.actionBtnTxt, { color: accent }]}>{current.actionLabel}</Text>
                <Ionicons name="arrow-forward" size={13} color={accent}/>
              </TouchableOpacity>

              {/* Navigation étapes */}
              <View style={wcm.stepNav}>
                <TouchableOpacity
                  onPress={handlePrevStep}
                  disabled={activeStep === 0}
                  style={[wcm.navBtn, activeStep === 0 && { opacity:0.3 }]}
                >
                  <Ionicons name="chevron-back" size={14} color={C.muted}/>
                  <Text style={wcm.navBtnTxt}>Précédent</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextStep}
                  style={[wcm.nextBtn, { backgroundColor: accent }]}
                  activeOpacity={0.85}
                >
                  <Text style={wcm.nextBtnTxt}>
                    {activeStep === total - 1 ? 'Terminer le défi' : 'Étape suivante'}
                  </Text>
                  <Ionicons name={activeStep === total - 1 ? 'checkmark-circle' : 'chevron-forward'} size={14} color={C.white}/>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Défi complété ─────────────────────────────────────── */}
          {isDone && (
            <View style={wcm.completedCard}>
              <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <View style={[wcm.completedIcon, { backgroundColor: C.green + '20', borderColor: C.green + '40' }]}>
                <Ionicons name="trophy-outline" size={32} color={C.green}/>
              </View>
              <Text style={wcm.completedTitle}>Défi accompli !</Text>
              <Text style={wcm.completedDesc}>
                Vous avez gagné {challenge.reward_points} points et le badge «{challenge.reward_label}».
              </Text>
              <View style={[wcm.rewardPill, { borderColor: C.green + '30', backgroundColor: C.green + '10' }]}>
                <Ionicons name="ribbon-outline" size={11} color={C.green}/>
                <Text style={[wcm.rewardPillTxt, { color:C.green }]}>{challenge.reward_label}</Text>
              </View>
            </View>
          )}

          {/* ── Description du défi ───────────────────────────────── */}
          <View style={wcm.descCard}>
            <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
              <Ionicons name="information-circle-outline" size={14} color={C.muted}/>
              <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.5 }}>À PROPOS DE CE DÉFI</Text>
            </View>
            <Text style={wcm.descText}>{challenge.description}</Text>
            <View style={wcm.rewardRow2}>
              <Ionicons name="gift-outline" size={11} color={C.muted}/>
              <Text style={wcm.rewardLabel2}>Récompense : {challenge.reward_label} · +{challenge.reward_points} pts</Text>
            </View>
          </View>

          {/* ── Œuvres liées au défi ──────────────────────────────── */}
          {filteredWorks.length > 0 && (
            <View style={{ marginTop:8 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:EDGE, marginBottom:12 }}>
                <Ionicons name="film-outline" size={12} color={C.muted}/>
                <Text style={{ color:C.white, fontSize:14, fontWeight:'800' }}>Œuvres pour ce défi</Text>
                <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }}>
                  <Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>{filteredWorks.length}</Text>
                </View>
              </View>
              <FlatList
                horizontal
                data={filteredWorks}
                keyExtractor={w=>`cw-${w.id}`}
                renderItem={({item})=><PortraitCard item={item} isPepite={(item.likes??0)<100}/>}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal:EDGE }}
                initialNumToRender={6}
              />
            </View>
          )}

          {/* ── Toutes les étapes (résumé) ────────────────────────── */}
          <View style={{ paddingHorizontal:EDGE, marginTop:20 }}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.5, marginBottom:12 }}>
              TOUTES LES ÉTAPES
            </Text>
            {steps.map((s, i) => {
              const done = i < activeStep || isDone;
              return (
                <TouchableOpacity
                  key={s.index}
                  onPress={() => setActiveStep(i)}
                  style={[wcm.allStepRow, done && wcm.allStepRowDone, i === activeStep && !isDone && { borderColor: accent + '40' }]}
                  activeOpacity={0.80}
                >
                  <View style={[wcm.allStepNum, done && { backgroundColor: C.green + '20', borderColor: C.green + '40' }, i === activeStep && !isDone && { backgroundColor: accent + '15', borderColor: accent + '35' }]}>
                    {done
                      ? <Ionicons name="checkmark" size={10} color={C.green}/>
                      : <Text style={[wcm.allStepNumTxt, i === activeStep && { color: accent }]}>{i+1}</Text>
                    }
                  </View>
                  <View style={{ flex:1, gap:2 }}>
                    <Text style={[wcm.allStepTitle, done && { color: C.white }, i === activeStep && !isDone && { color: C.white }]}>{s.title}</Text>
                    <Text style={wcm.allStepDesc} numberOfLines={1}>{s.desc}</Text>
                  </View>
                  <Ionicons name={done ? 'checkmark-circle' : 'chevron-forward'} size={14} color={done ? C.green : C.border}/>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
});

const wcm = StyleSheet.create({
  root:           { flex:1, backgroundColor:'rgba(7,12,23,0.30)' },
  topBar:         { flexDirection:'row', alignItems:'center', paddingHorizontal:EDGE, paddingBottom:12, gap:10 },
  topIcon:        { width:32, height:32, borderRadius:10, borderWidth:1, alignItems:'center', justifyContent:'center' },
  topBadge:       { fontSize:8, fontWeight:'800', letterSpacing:1 },
  topTitle:       { color:C.white, fontSize:15, fontWeight:'800', letterSpacing:-0.2 },
  closeBtn:       { width:32, height:32, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },

  globalProgressWrap: { paddingHorizontal:EDGE, marginBottom:16 },
  globalTrack:    { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
  globalFill:     { height:'100%', borderRadius:2 },
  progressInfo:   { color:C.muted, fontSize:10, fontWeight:'600' },

  stepsNav:       { paddingHorizontal:EDGE, gap:8, marginBottom:16 },
  stepDot:        { width:28, height:28, borderRadius:14, borderWidth:1.5, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },
  stepDotDone:    { backgroundColor:C.green+'20', borderColor:C.green+'50' },
  stepDotActive:  { borderWidth:1.5 },
  stepDotNum:     { color:C.muted, fontSize:11, fontWeight:'700' },

  stepCard:       { marginHorizontal:EDGE, borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi, padding:20, gap:14, marginBottom:12 },
  stepIconWrap:   { width:60, height:60, borderRadius:16, borderWidth:1, alignItems:'center', justifyContent:'center', alignSelf:'flex-start' },
  stepTitle:      { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.4, lineHeight:26 },
  stepDesc:       { color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:22 },
  actionBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, paddingHorizontal:20, borderRadius:14, borderWidth:1 },
  actionBtnTxt:   { fontSize:14, fontWeight:'700' },
  stepNav:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:4 },
  navBtn:         { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:10, paddingHorizontal:14, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint },
  navBtnTxt:      { color:C.muted, fontSize:13, fontWeight:'600' },
  nextBtn:        { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, borderRadius:14, marginLeft:10 },
  nextBtnTxt:     { color:C.white, fontSize:14, fontWeight:'800' },

  completedCard:  { marginHorizontal:EDGE, borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(46,204,138,0.30)', padding:24, alignItems:'center', gap:12, marginBottom:12 },
  completedIcon:  { width:72, height:72, borderRadius:20, borderWidth:1, alignItems:'center', justifyContent:'center' },
  completedTitle: { color:C.white, fontSize:22, fontWeight:'900', letterSpacing:-0.4 },
  completedDesc:  { color:C.muted, fontSize:13, textAlign:'center', lineHeight:20 },
  rewardPill:     { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1 },
  rewardPillTxt:  { fontSize:12, fontWeight:'700' },

  descCard:       { marginHorizontal:EDGE, borderRadius:14, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, padding:14, marginTop:12 },
  descText:       { color:'rgba(255,255,255,0.55)', fontSize:13, lineHeight:21 },
  rewardRow2:     { flexDirection:'row', alignItems:'center', gap:6, marginTop:10 },
  rewardLabel2:   { color:C.muted, fontSize:11 },

  allStepRow:     { flexDirection:'row', alignItems:'center', gap:12, padding:12, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, marginBottom:8 },
  allStepRowDone: { borderColor:'rgba(46,204,138,0.20)', backgroundColor:'rgba(46,204,138,0.04)' },
  allStepNum:     { width:28, height:28, borderRadius:14, borderWidth:1, borderColor:C.border, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center', flexShrink:0 },
  allStepNumTxt:  { color:C.muted, fontSize:11, fontWeight:'700' },
  allStepTitle:   { color:C.muted, fontSize:12, fontWeight:'700' },
  allStepDesc:    { color:C.muted, fontSize:10 },
});

// ─── SEARCH OVERLAY ───────────────────────────────────────────────────────────
const SearchOverlay=memo(({visible,onClose,works}:{visible:boolean;onClose:()=>void;works:Work[]})=>{
  const router=useRouter();const insets=useSafeAreaInsets();const[q,setQ]=useState('');const inputRef=useRef<TextInput>(null);const slideY=useRef(new Animated.Value(SH)).current;
  useEffect(()=>{if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:65,friction:10}).start();const t=setTimeout(()=>inputRef.current?.focus(),300);return()=>clearTimeout(t);}else{setQ('');Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}},[visible,slideY]);
  const results=useMemo(()=>{if(!q.trim())return works.slice(0,40);const lower=q.toLowerCase();return works.filter(w=>(w.title??'').toLowerCase().includes(lower)||(w.genre??'').toLowerCase().includes(lower)||(w.director??'').toLowerCase().includes(lower)||(w.adjective??'').toLowerCase().includes(lower)).slice(0,80);},[q,works]);
  const CW=(SW-42)/2;
  const goFilm=useCallback((id:number)=>{onClose();router.push(`/film/${id}` as any);},[onClose,router]);
  const renderResult=useCallback(({item}:ListRenderItemInfo<Work>)=>(<TouchableOpacity style={[so.card,{width:CW}]} onPress={()=>goFilm(item.id)} activeOpacity={0.85}><Image source={{uri:resolveImg(item.id,item.image)}} style={so.cardImg} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject}/>{(item.likes??0)<100&&<View style={so.pepiteBadge}><Ionicons name="sparkles" size={7} color={C.white}/><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}<View style={so.cardInfo}><Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={so.cardMeta}>{fmtK(item.likes??0)}</Text>{item.duration!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={so.cardMeta}>{fmtDur(item.duration)}</Text></>}</View></View></TouchableOpacity>),[goFilm,CW]);
  if(!visible)return null;
  return(<Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><Animated.View style={{flex:1,transform:[{translateY:slideY}]}}><View style={[so.topBar,{paddingTop:insets.top+10}]}><View style={so.inputRow}><Ionicons name="search-outline" size={15} color={C.muted}/><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"/></View><TouchableOpacity onPress={onClose} style={{paddingLeft:8}}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity></View><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` pour « ${q.trim()} »`:' · Catalogue'}</Text></View>{results.length===0?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="search-outline" size={36} color={C.white}/><Text style={{color:C.mid,fontSize:15,fontWeight:'600'}}>Aucun résultat</Text></View>:<FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderResult} numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}} contentContainerStyle={[{paddingHorizontal:16},{paddingBottom:insets.bottom+40}]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}</Animated.View></Modal>);
});
const so=StyleSheet.create({topBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},inputRow:{flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},input:{flex:1,color:C.white,fontSize:14},card:{height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},cardImg:{width:'100%',height:'100%'},cardInfo:{position:'absolute',bottom:8,left:9,right:9,gap:4},cardTitle:{color:C.white,fontSize:12,fontWeight:'700'},cardMeta:{color:C.muted,fontSize:10,fontWeight:'600'},pepiteBadge:{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}});

// ─═══════════════════════════════════════════════════════════════════════════
// ★★★ SCREEN
// ─═══════════════════════════════════════════════════════════════════════════
export default function SearchScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [works,      setWorks]     = useState<Work[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [searchOpen, setSearchOpen]= useState(false);
  const [userId,     setUserId]    = useState('anonymous');
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Défi hebdomadaire ────────────────────────────────────────────────────
  const [challenge,         setChallenge]        = useState<WeeklyChallenge>(FALLBACK_CHALLENGE);
  const [challengeProgress, setChallengeProgress]= useState<ChallengeProgress|null>(null);
  const [challengeOpen,     setChallengeOpen]    = useState(false);

  useEffect(()=>{
    fetchWeeklyChallenge().then(c=>{ if(c) setChallenge(c); }).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(userId==='anonymous') return;
    fetchChallengeProgress(userId, challenge.week_number)
      .then(p=>{ if(p) setChallengeProgress(p); })
      .catch(()=>{});
  },[userId, challenge.week_number]);

  const handleStepComplete = useCallback(async (stepIndex:number, completed:boolean) => {
    const points = completed ? challenge.reward_points : 0;
    setChallengeProgress({ step_index:stepIndex, completed, points_earned:points });
    await upsertChallengeProgress(userId, challenge.week_number, stepIndex, completed, points);
  },[userId, challenge.week_number, challenge.reward_points]);

  // Auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ if(session?.user?.id) setUserId(session.user.id); });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{ if(s?.user?.id) setUserId(s.user.id); });
    return()=>subscription.unsubscribe();
  },[]);

  // Works
  useEffect(()=>{
    let dead=false;setLoading(true);
    fetchAllWorks().then(data=>{if(!dead){setWorks(data);setLoading(false);}}).catch(()=>{if(!dead)setLoading(false);});
    return()=>{dead=true;};
  },[]);

  const{missions,badges,score,level,loading:gLoading}=useGamification(userId,works);

  // Sections
  const heroItems=useMemo(()=>works.slice(0,20),[works]);
  const popular  =useMemo(()=>works,[works]);
  const recent   =useMemo(()=>[...works].sort((a,b)=>{const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30),[works]);
  const originals=useMemo(()=>works.filter(w=>w.is_original),[works]);
  const courts   =useMemo(()=>works.filter(w=>(w.duration??0)>0&&(w.duration??0)<60),[works]);
  const moyens   =useMemo(()=>works.filter(w=>(w.duration??0)>=60&&(w.duration??0)<=100),[works]);
  const longs    =useMemo(()=>works.filter(w=>(w.duration??0)>100),[works]);
  const pepites  =useMemo(()=>works.filter(w=>(w.likes??0)<100&&(w.likes??0)>5).sort((a,b)=>(b.likes??0)-(a.likes??0)).slice(0,20),[works]);

  const headerOp=scrollY.interpolate({inputRange:[0,80],outputRange:[1,0],extrapolate:'clamp'});

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      {/* Floating header */}
      <Animated.View style={{position:'absolute',top:5,left:0,right:0,zIndex:10,flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingTop:insets.top+4,paddingBottom:8,opacity:headerOp}} pointerEvents="box-none">
        <Text style={{flex:1,color:C.white,fontSize:30,fontWeight:'800',letterSpacing:-0.5}}>UNIVERSE</Text>
        <TouchableOpacity style={{width:38,height:38,borderRadius:19,backgroundColor:C.subtle,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>setSearchOpen(true)} activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>

      <SearchOverlay visible={searchOpen} onClose={()=>setSearchOpen(false)} works={works}/>

      {/* ★ Modale défi hebdomadaire */}
      <WeeklyChallengeModal
        visible={challengeOpen}
        onClose={()=>setChallengeOpen(false)}
        challenge={challenge}
        progress={challengeProgress}
        onStepComplete={handleStepComplete}
        works={works}
        userId={userId}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:120 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}
      >
        {/* Hero */}
        <HeroBanner works={heroItems} loading={loading}/>
        <View style={{ height:24 }}/>

        {/* ★ DÉFI DE LA SEMAINE — carte compacte */}
        <View style={{ marginBottom:20 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:EDGE, marginBottom:12 }}>
            <Ionicons name="flame-outline" size={13} color={C.mid}/>
            <Text style={{ color:C.white, fontSize:17, fontWeight:'800' }}>Défi de la semaine</Text>
            {!challengeProgress?.completed && (
              <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:'rgba(245,200,66,0.12)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,200,66,0.25)', marginLeft:'auto' as any }}>
                <Text style={{ color:C.gold, fontSize:9, fontWeight:'700' }}>NOUVEAU</Text>
              </View>
            )}
          </View>
          <WeeklyChallengeCard
            challenge={challenge}
            progress={challengeProgress}
            onOpen={() => setChallengeOpen(true)}
          />
        </View>

        {/* Badges */}
        {userId!=='anonymous'&&!gLoading&&(
          <View style={{gap:16,marginBottom:28}}>
            <View>
              <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
                <Ionicons name="ribbon-outline" size={13} color={C.mid}/>
                <Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Mes badges</Text>
              </View>
              <BadgesRow badges={badges}/>
            </View>
          </View>
        )}

        {/* Séparateur */}
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginBottom:28}}/>

        {/* Populaires */}
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} variant="portrait" showRank/>
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/>

        {/* Récents */}
        {(recent.length>0||loading)&&<><RowSection title="Récemment ajoutés" subtitle="Nouvelles œuvres" items={recent} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Pépites */}
        {pepites.length>0&&<>
          <View style={{marginBottom:0}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
              <Ionicons name="sparkles-outline" size={13} color={C.mid}/>
              <Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Pépites cachées</Text>
              <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:'rgba(255,255,255,0.12)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,marginLeft:'auto' as any}}>
                <Text style={{color:C.white,fontSize:9,fontWeight:'700'}}>À découvrir</Text>
              </View>
            </View>
            <RowSection title="" items={pepites} loading={loading} variant="portrait" showPepite/>
          </View>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/>
        </>}

        {/* Originaux */}
        {(originals.length>0||loading)&&<><RowSection title="Originaux Universe" subtitle="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} variant="portrait"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Courts */}
        {(courts.length>0||loading)&&<><RowSection title="Courts métrages" subtitle="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Moyens */}
        {(moyens.length>0||loading)&&<><RowSection title="Moyens métrages" subtitle="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Séries */}
        {(longs.length>0||loading)&&<RowSection title="Mini-séries" subtitle="Plus de 100 min" count={loading?undefined:longs.length} items={longs} loading={loading} variant="landscape"/>}

        <View style={{ height:120 }}/>
      </Animated.ScrollView>
    </View>
  );
}