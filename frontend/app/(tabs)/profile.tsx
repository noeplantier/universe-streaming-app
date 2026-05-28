/**
 * app/(tabs)/profile.tsx — UNIVERSE · v6 NETLIFY-PROOF
 *
 * ★ FIX CRITIQUE : jamais 'anonymous' passé à Supabase
 *   uid commence à null → aucune requête avant auth résolue
 *   isUUID() guard sur CHAQUE appel Supabase
 * ★ Retry auth x2 avec délai (fix localStorage web Netlify)
 * ★ Gamification dynamique : streak, level-up toast, badges interactifs
 * ★ Web-safe : RN Image, composants inlinés, dimensions explicites
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Image, Linking, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import GalaxyBackground from '@/components/social/GalaxyBackground';
import { supabase }     from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');
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
  blue:'#5A96E6', gold:'#F5C842', green:'#2ECC8A',
} as const;
const H_PAD=20, CARD_W=124, CARD_H=185, REEL_W=156, REEL_H=220, CRIT_W=214, CRIT_H=144;

// ─── UUID GUARD — jamais 'anonymous' ou valeur invalide envoyée à Supabase ────
function isUUID(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work { id:number; title:string; category:string; genre:string; year:number; likes:number; image:string|null; is_original:boolean; duration:number|null; director:string|null }
interface UserReel { id:string; video_url:string; thumbnail_url:string|null; title:string|null; genre:string|null; duration:number|null; status:'pending'|'approved'|'rejected'; likes_count:number; views_count:number; created_at:string }
interface ProfileData { display_name:string; username:string; bio:string; role:string; location:string; avatar_url:string; website:string; is_pro:boolean; is_industry_contact:boolean; specialties:string[]; festivals:string[]; open_to:string[]; social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string }
interface ReviewItem { id:string; filmId:string; content:string; rating:number; likes:number; date:string; film:{ id:string; title:string; posterUrl:string; genre:string; type:'film' } }
type GridTab = 0|1|2;
interface Badge { id:string; label:string; desc:string; icon:keyof typeof Ionicons.glyphMap; earned:boolean; pts:number }
interface Mission { id:string; title:string; desc:string; reward:string; icon:keyof typeof Ionicons.glyphMap; target:number; progress:number; completed:boolean }
interface GamiStats { watchCount:number; critiqueCount:number; favCount:number; watchedGenres:Record<string,number>; isNight:boolean; totalLikedLowPopularity:number; streak:number }

const EMPTY_PROFILE: ProfileData = { display_name:'', username:'', bio:'', role:'creator', location:'', avatar_url:'', website:'', is_pro:false, is_industry_contact:false, specialties:[], festivals:[], open_to:[], social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'' };
const ROLE_LABELS: Record<string,string> = { director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste', actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse', critic:'Critique', creator:'Créateur·rice', other:'Cinéaste' };

const mapProfile=(r:any):ProfileData=>({display_name:r?.display_name??'',username:r?.username??'',bio:r?.bio??'',role:r?.role??'creator',location:r?.location??'',avatar_url:r?.avatar_url??'',website:r?.website??'',is_pro:r?.is_pro??false,is_industry_contact:r?.is_industry_contact??false,specialties:Array.isArray(r?.specialties)?r.specialties:[],festivals:Array.isArray(r?.festivals)?r.festivals:[],open_to:Array.isArray(r?.open_to)?r.open_to:[],social_instagram:r?.social_instagram??'',social_vimeo:r?.social_vimeo??'',social_youtube:r?.social_youtube??'',social_imdb:r?.social_imdb??''});
const mapWork=(r:any):Work=>({id:Number(r?.id)||0,title:r?.title??'',category:r?.category??'',genre:r?.genre??'',year:Number(r?.year)||0,likes:Number(r?.likes)||0,image:r?.image??null,is_original:r?.is_original??false,duration:r?.duration!=null?Number(r.duration):null,director:r?.director??null});
const mapReel=(r:any):UserReel=>({id:String(r?.id??''),video_url:r?.video_url??'',thumbnail_url:r?.thumbnail_url??null,title:r?.title??null,genre:r?.genre??null,duration:r?.duration!=null?Number(r.duration):null,status:(['pending','approved','rejected'].includes(r?.status)?r.status:'pending') as any,likes_count:Number(r?.likes_count)||0,views_count:Number(r?.views_count)||0,created_at:r?.created_at??new Date().toISOString()});
const mapCritique=(r:any):ReviewItem=>({id:String(r?.id),filmId:String(r?.reel_id??r?.work_id??r?.id),content:String(r?.content??r?.body??''),rating:r?.rating!=null?Number(r.rating):0,likes:Number(r?.likes_count??r?.likes??0),date:r?.created_at?new Date(r.created_at).toISOString():new Date().toISOString(),film:{id:String(r?.reel_id??r?.id),title:String(r?.film_title??r?.work_title??r?.title??'—'),posterUrl:`https://picsum.photos/seed/crit_${r?.id}/400/600`,genre:'—',type:'film' as const}});

const resolveImage=(id:number,image:string|null)=>{if(!image)return`https://picsum.photos/seed/work_${id}/400/600`;if(image.startsWith('http'))return image;try{return supabase.storage.from('community-images').getPublicUrl(image).data.publicUrl;}catch{return`https://picsum.photos/seed/work_${id}/400/600`;}};
const fmt=(n:number)=>n>=1_000_000?`${(n/1_000_000).toFixed(1)}M`:n>=1_000?`${(n/1_000).toFixed(n>=10_000?0:1)}K`:`${n}`;
const fmtDur=(s:number|null)=>{if(!s)return'';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?`${h}h${m>0?` ${m}min`:''}`:m>0?`${m}min`:''};
const momentum=(r:UserReel)=>Math.round((r.views_count*0.3+r.likes_count*2)/Math.max(0.5,(Date.now()-new Date(r.created_at).getTime())/86400000));

// ─── GAMIFICATION ─────────────────────────────────────────────────────────────
function buildBadges(s:GamiStats):Badge[]{return[
  {id:'explorer',  label:'Explorateur indé',    desc:'5 œuvres regardées',     icon:'compass-outline',  earned:s.watchCount>=5,          pts:15},
  {id:'nocturne',  label:'Cinéphile nocturne',  desc:'Actif après 22h',        icon:'moon-outline',     earned:s.isNight,                pts:5},
  {id:'pepiteur',  label:'Découvreur pépites',  desc:'3 films rares aimés',    icon:'sparkles-outline', earned:s.totalLikedLowPopularity>=3, pts:30},
  {id:'critique',  label:'Critique en herbe',   desc:'5 avis publiés',         icon:'create-outline',   earned:s.critiqueCount>=5,       pts:40},
  {id:'curateur',  label:'Curateur',            desc:'10 favoris sauvegardés', icon:'bookmark-outline', earned:s.favCount>=10,           pts:20},
  {id:'omnivore',  label:'Cinéphile omnivore',  desc:'5 genres explorés',      icon:'layers-outline',   earned:Object.keys(s.watchedGenres).length>=5, pts:25},
  {id:'streak',    label:'Habitué',             desc:'3 jours consécutifs',    icon:'flame-outline',    earned:s.streak>=3,              pts:10},
];}
function buildMissions(s:GamiStats):Mission[]{return[
  {id:'watch5',  title:'Cinéphile actif',     desc:'Regardez 5 œuvres',              reward:'+15 pts',        icon:'play-circle-outline', target:5,  progress:Math.min(5,s.watchCount),              completed:s.watchCount>=5},
  {id:'crit5',   title:'Voix critique',       desc:'5 critiques publiées',           reward:'+40 pts + badge',icon:'create-outline',      target:5,  progress:Math.min(5,s.critiqueCount),           completed:s.critiqueCount>=5},
  {id:'fav10',   title:'Curateur passionné',  desc:'10 favoris sauvegardés',         reward:'+20 pts + badge',icon:'bookmark-outline',    target:10, progress:Math.min(10,s.favCount),               completed:s.favCount>=10},
  {id:'pepite3', title:'Chasseur de pépites', desc:'3 films < 100 likes aimés',      reward:'+30 pts + badge',icon:'sparkles-outline',    target:3,  progress:Math.min(3,s.totalLikedLowPopularity), completed:s.totalLikedLowPopularity>=3},
];}
function cinephileLevel(score:number):{n:number;label:string;pct:number;nextAt:number}{const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];const c=[...L].reverse().find(x=>score>=x.at)??L[0];const ni=L.findIndex(x=>x.n===c.n)+1;const nx=L[ni]??L[L.length-1];return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at)),nextAt:nx.at};}

// ★ userId: string|null — jamais 'anonymous'
function useGamification(userId: string|null) {
  const[stats,setStats]=useState<GamiStats>({watchCount:0,critiqueCount:0,favCount:0,watchedGenres:{},isNight:false,totalLikedLowPopularity:0,streak:0});
  const[loading,setLoading]=useState(true);
  const[prevLevel,setPrevLevel]=useState(0);
  const[levelUpVisible,setLevelUpVisible]=useState(false);

  useEffect(()=>{
    // ★ GUARD UUID — ne jamais envoyer une requête Supabase sans UUID valide
    if(!isUUID(userId)){setLoading(false);return;}
    const isNight=new Date().getHours()>=22||new Date().getHours()<4;
    Promise.all([
      supabase.from('user_history').select('work_id').eq('user_id',userId),
      supabase.from('critiques').select('id').eq('user_id',userId),
      supabase.from('user_favorites').select('work_id').eq('user_id',userId),
    ]).then(([hist,crit,favs])=>{
      const histIds=(hist.data??[]).map((r:any)=>r.work_id);
      setStats(prev=>({watchCount:histIds.length,critiqueCount:(crit.data??[]).length,favCount:(favs.data??[]).length,watchedGenres:{},isNight,totalLikedLowPopularity:0,streak:prev.streak+1}));
      setLoading(false);
    }).catch(e=>{console.error('[gamification]',e);setLoading(false);});
  },[userId]);

  const score   =useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+stats.totalLikedLowPopularity*10+(stats.isNight?5:0)+(stats.streak>=3?10:0),[stats]);
  const level   =useMemo(()=>cinephileLevel(score),[score]);
  const badges  =useMemo(()=>buildBadges(stats),[stats]);
  const missions=useMemo(()=>buildMissions(stats),[stats]);

  useEffect(()=>{if(prevLevel>0&&level.n>prevLevel){setLevelUpVisible(true);setTimeout(()=>setLevelUpVisible(false),3500);}setPrevLevel(level.n);},[level.n]);

  return{score,level,badges,missions,loading,levelUpVisible};
}

// ─── SHIMMER ──────────────────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number;h:number;r?:number})=>{const op=useRef(new Animated.Value(0.15)).current;useEffect(()=>{const l=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.35,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.15,duration:900,useNativeDriver:true})]));l.start();return()=>l.stop();},[op]);return<Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;});

// ─── INLINE UI ────────────────────────────────────────────────────────────────
const HScrollRow=memo(({children,pb=0}:{children:React.ReactNode;pb?:number})=>(<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,paddingBottom:pb}}>{children}</ScrollView>));
const SectionHeader=memo(({icon,label,subtitle,count,onViewAll}:{icon:keyof typeof Ionicons.glyphMap;label:string;subtitle?:string;count?:number;onViewAll?:()=>void})=>(<View style={{flexDirection:'row',alignItems:'flex-start',paddingHorizontal:H_PAD,paddingTop:22,paddingBottom:12}}><View style={{flex:1,gap:2}}><View style={{flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name={icon} size={13} color={C.mid}/><Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2}}>{label}</Text>{count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}</View>{subtitle&&<Text style={{color:C.muted,fontSize:11,marginLeft:20}}>{subtitle}</Text>}</View>{onViewAll&&<TouchableOpacity onPress={onViewAll} hitSlop={8}><Text style={{color:C.muted,fontSize:11,fontWeight:'600'}}>Tout voir</Text></TouchableOpacity>}</View>));
const EmptyState=memo(({icon,text,subtext}:{icon:keyof typeof Ionicons.glyphMap;text:string;subtext?:string})=>(<View style={{alignItems:'center',paddingVertical:32,paddingHorizontal:H_PAD,gap:8}}><View style={{width:52,height:52,borderRadius:26,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={22} color={C.muted}/></View><Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>{text}</Text>{subtext&&<Text style={{color:C.muted,fontSize:11,textAlign:'center',lineHeight:17}}>{subtext}</Text>}</View>));

// ─── ★ LEVEL-UP TOAST ─────────────────────────────────────────────────────────
const LevelUpToast=memo(({visible,level}:{visible:boolean;level:number})=>{
  const ty=useRef(new Animated.Value(-80)).current;const op=useRef(new Animated.Value(0)).current;
  useEffect(()=>{if(visible){Animated.parallel([Animated.spring(ty,{toValue:0,tension:60,friction:10,useNativeDriver:true}),Animated.timing(op,{toValue:1,duration:300,useNativeDriver:true})]).start();setTimeout(()=>Animated.parallel([Animated.timing(ty,{toValue:-80,duration:300,useNativeDriver:true}),Animated.timing(op,{toValue:0,duration:300,useNativeDriver:true})]).start(),3000);}else{ty.setValue(-80);op.setValue(0);}},[visible]);
  if(!visible)return null;
  return(<Animated.View style={{position:'absolute',top:0,left:H_PAD,right:H_PAD,zIndex:999,transform:[{translateY:ty}],opacity:op}}><BlurView intensity={60} tint="dark" style={{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.gold,padding:16}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:44,height:44,borderRadius:22,backgroundColor:'rgba(245,200,66,0.15)',borderWidth:1,borderColor:C.gold,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.gold,fontSize:18,fontWeight:'900'}}>{level}</Text></View><View style={{flex:1}}><Text style={{color:C.gold,fontSize:13,fontWeight:'900',letterSpacing:0.5}}>NIVEAU {level} ATTEINT !</Text><Text style={{color:C.muted,fontSize:11,marginTop:2}}>Votre cinéphilie évolue…</Text></View><Ionicons name="star" size={20} color={C.gold}/></View></BlurView></Animated.View>);
});

// ─── ★ AVATAR OU MONOGRAMME ───────────────────────────────────────────────────
const AvatarOrMonogram=memo(({name,level,isPro,avatarUrl}:{name:string;level:number;isPro:boolean;avatarUrl:string})=>{
  const initials=useMemo(()=>(name||'?').trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2),[name]);
  const[imgErr,setImgErr]=useState(false);
  useEffect(()=>{setImgErr(false);},[avatarUrl]);
  return(<View style={{position:'relative'}}><View style={{width:72,height:72,borderRadius:36,overflow:'hidden',borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid}}>{avatarUrl&&!imgErr?<Image source={{uri:avatarUrl}} style={{width:72,height:72}} resizeMode="cover" onError={()=>setImgErr(true)}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.5}}>{initials}</Text></View>}</View><View style={{position:'absolute',top:-4,right:-4,width:22,height:22,borderRadius:11,backgroundColor:C.navyLow,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:9,fontWeight:'900'}}>{level}</Text></View>{isPro&&<View style={{position:'absolute',bottom:0,right:0,width:18,height:18,borderRadius:9,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.borderHi,alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={8} color={C.white}/></View>}</View>);
});

// ─── ★ BADGES INTERACTIFS ─────────────────────────────────────────────────────
const InteractiveBadge=memo(({badge}:{badge:Badge})=>{
  const[open,setOpen]=useState(false);const sc=useRef(new Animated.Value(1)).current;
  const press=()=>{Animated.sequence([Animated.spring(sc,{toValue:0.88,tension:300,friction:7,useNativeDriver:true}),Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();setOpen(v=>!v);};
  return(<Animated.View style={{transform:[{scale:sc}]}}><TouchableOpacity onPress={press} activeOpacity={0.85} style={[ib.wrap,badge.earned&&ib.earned]}><View style={[ib.icon,badge.earned&&ib.iconOn]}><Ionicons name={badge.icon} size={16} color={badge.earned?C.white:C.muted}/></View><Text style={[ib.label,badge.earned&&{color:C.white}]} numberOfLines={2}>{badge.label}</Text>{badge.earned&&<Text style={ib.pts}>+{badge.pts}pts</Text>}{!badge.earned&&<View style={ib.lock}><Ionicons name="lock-closed" size={7} color={C.muted}/></View>}{open&&<View style={ib.tooltip}><Text style={ib.ttTxt}>{badge.desc}</Text></View>}</TouchableOpacity></Animated.View>);
});
const ib=StyleSheet.create({wrap:{alignItems:'center',gap:5,padding:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:86,opacity:0.55},earned:{opacity:1,borderColor:C.borderHi,backgroundColor:C.subtle},icon:{width:36,height:36,borderRadius:18,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},iconOn:{borderColor:C.borderHi},label:{color:C.muted,fontSize:9,fontWeight:'600',textAlign:'center',lineHeight:12},pts:{color:C.gold,fontSize:8,fontWeight:'800'},lock:{position:'absolute',top:7,right:7},tooltip:{position:'absolute',bottom:-30,left:0,right:0,backgroundColor:C.navyMid,borderRadius:8,padding:5,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,zIndex:10},ttTxt:{color:C.muted,fontSize:8,textAlign:'center'}});

// ─── ★ ANIMATED SCORE ─────────────────────────────────────────────────────────
const AnimatedScore=memo(({score,level}:{score:number;level:ReturnType<typeof cinephileLevel>})=>{
  const prog=useRef(new Animated.Value(0)).current;const glow=useRef(new Animated.Value(0.4)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:1200,useNativeDriver:false}).start();Animated.loop(Animated.sequence([Animated.timing(glow,{toValue:1,duration:2500,useNativeDriver:true}),Animated.timing(glow,{toValue:0.4,duration:2500,useNativeDriver:true})])).start();},[level.pct]);
  return(<View style={as.wrap}><Animated.View style={[as.ring,{opacity:glow}]}/><View style={as.circle}><Text style={as.score}>{fmt(score)}</Text><Text style={as.scoreLbl}>POINTS</Text></View><View style={{flex:1,gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name="layers-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11,fontWeight:'700'}}>Niveau {level.n}</Text><View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Text style={{color:C.offWhite,fontSize:9,fontWeight:'800',letterSpacing:0.3}}>{level.label}</Text></View></View><View style={{height:4,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View>{level.n<5?<Text style={{color:C.mid,fontSize:10,fontWeight:'600'}}>{fmt(Math.max(0,level.nextAt-score))} pts → niveau {level.n+1}</Text>:<Text style={{color:C.gold,fontSize:10,fontWeight:'700'}}>Niveau maximum ✦</Text>}</View></View>);
});
const as=StyleSheet.create({wrap:{marginHorizontal:H_PAD,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,padding:16,flexDirection:'row',alignItems:'center',gap:16,marginBottom:4},ring:{position:'absolute',width:86,height:86,borderRadius:43,borderWidth:1.5,borderColor:'rgba(255,255,255,0.18)',top:8,left:8},circle:{width:72,height:72,borderRadius:36,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center',backgroundColor:C.navyMid},score:{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.8},scoreLbl:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:2,marginTop:-2}});

// ─── ★ MISSION CARD ───────────────────────────────────────────────────────────
const MissionCard=memo(({mission}:{mission:Mission})=>{
  const pct=mission.target>0?Math.min(1,mission.progress/mission.target):0;
  const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:pct,duration:900,useNativeDriver:false}).start();},[pct]);
  return(<View style={[mc.wrap,mission.completed&&mc.wrapDone]}><BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={{flexDirection:'row',alignItems:'flex-start',gap:11,padding:13}}><View style={[mc.icon,mission.completed&&mc.iconDone]}><Ionicons name={mission.completed?'checkmark-circle':mission.icon} size={18} color={mission.completed?C.white:C.mid}/></View><View style={{flex:1,gap:4}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:mission.completed?C.white:C.offWhite,fontSize:12,fontWeight:'700',flex:1}} numberOfLines={1}>{mission.title}</Text>{mission.completed&&<View style={{paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:C.subtle,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}}><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.4}}>ACCOMPLI</Text></View>}</View><Text style={{color:C.muted,fontSize:10,lineHeight:14}} numberOfLines={1}>{mission.desc}</Text><View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{flex:1,height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:mission.completed?C.white:C.subtle,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View><Text style={{color:mission.completed?C.white:C.muted,fontSize:9,fontWeight:'700'}}>{mission.progress}/{mission.target}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="gift-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:9}}>{mission.reward}</Text></View></View></View></View>);
});
const mc=StyleSheet.create({wrap:{marginHorizontal:H_PAD,marginBottom:8,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},wrapDone:{borderColor:C.borderHi},icon:{width:40,height:40,borderRadius:11,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},iconDone:{backgroundColor:C.subtle,borderColor:C.borderHi}});

// ─── CARDS ────────────────────────────────────────────────────────────────────
const PortraitCard=memo(({item,rank}:{item:Work;rank?:number})=>{const router=useRouter();const uri=useMemo(()=>resolveImage(item.id,item.image),[item.id,item.image]);return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={pc.card}><Image source={{uri}} style={pc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={pc.badge}><Text style={pc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{rank!=null&&<Text style={pc.rank}>{rank}</Text>}<View style={pc.meta}><Text style={pc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={pc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>{item.year>0&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={pc.stat}>{item.year}</Text></>}</View></View></View></TouchableOpacity>);});
const pc=StyleSheet.create({card:{width:CARD_W,height:CARD_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:CARD_W,height:CARD_H},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},rank:{position:'absolute',bottom:32,right:5,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.10)'},meta:{position:'absolute',bottom:7,left:8,right:8,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

const S_CFG:Record<string,{icon:keyof typeof Ionicons.glyphMap;label:string}>={pending:{icon:'time-outline',label:'En attente'},approved:{icon:'checkmark-circle-outline',label:'Validée'},rejected:{icon:'close-circle-outline',label:'Refusée'}};
function useThumb(url:string,thumb:string|null):string|null{const[uri,setUri]=useState<string|null>(thumb??null);useEffect(()=>{if(thumb||!url||!VideoThumbnails)return;let ok=true;VideoThumbnails.getThumbnailAsync(url,{time:1500,quality:0.65}).then(({uri:u}:{uri:string})=>{if(ok)setUri(u);}).catch(()=>{});return()=>{ok=false;};},[url,thumb]);return uri;}
const ReelCard=memo(({reel,isHot}:{reel:UserReel;isHot:boolean})=>{const router=useRouter(),thumb=useThumb(reel.video_url,reel.thumbnail_url),cfg=S_CFG[reel.status]??S_CFG.pending,[err,setErr]=useState(false),m=momentum(reel);return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push({pathname:'/reel/[id]',params:{id:reel.id}} as any)} activeOpacity={0.88}><View style={rc.card}>{thumb&&!err?<Image source={{uri:thumb}} style={rc.img} resizeMode="cover" onError={()=>setErr(true)}/>:<View style={rc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="film-outline" size={24} color={C.subtle}/></View>}<LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/><View style={{position:'absolute',top:'40%',alignSelf:'center',marginTop:-12}} pointerEvents="none"><Ionicons name="play-circle-outline" size={26} color={C.mid}/></View><View style={rc.status}><Ionicons name={cfg.icon} size={9} color={C.mid}/><Text style={rc.stTxt}>{cfg.label}</Text></View>{(isHot||reel.views_count>=10)&&<View style={rc.mom}><Ionicons name={isHot?'flame-outline':'trending-up-outline'} size={8} color={C.mid}/><Text style={rc.momTxt}>{isHot?'EN HAUSSE':`${fmt(reel.views_count)} vues`}</Text></View>}<View style={rc.meta}><Text style={rc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text>{reel.genre&&<Text style={{color:C.muted,fontSize:8}}>{reel.genre}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:2}}><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="eye-outline" size={8} color={C.muted}/><Text style={rc.stTxt}>{fmt(reel.views_count)}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="heart-outline" size={8} color={C.muted}/><Text style={rc.stTxt}>{fmt(reel.likes_count)}</Text></View>{m>0&&<Text style={{marginLeft:'auto' as any,color:C.muted,fontSize:7,fontWeight:'700'}}>{m}pts/j</Text>}</View></View></View></TouchableOpacity>);});
const rc=StyleSheet.create({card:{width:REEL_W,height:REEL_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:REEL_W,height:REEL_H},ph:{width:REEL_W,height:REEL_H,alignItems:'center',justifyContent:'center'},status:{position:'absolute',top:8,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.72)'},stTxt:{color:C.muted,fontSize:7.5,fontWeight:'700'},mom:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:'rgba(7,12,23,0.82)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},momTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},meta:{position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},title:{color:C.white,fontSize:10.5,fontWeight:'800',lineHeight:13}});

const SD=[{t:8,l:18,op:0.28,r:1.5},{t:22,l:155,op:0.30,r:1.8},{t:48,l:190,op:0.20,r:1.2},{t:70,l:130,op:0.15,r:0.8}];
const CritiqueCard=memo(({review,rank,onPress}:{review:ReviewItem;rank:number;onPress:()=>void})=>{const stars=Math.round(review.rating??0);return(<TouchableOpacity style={{marginRight:10}} onPress={onPress} activeOpacity={0.88}><View style={{width:CRIT_W,height:CRIT_H,borderRadius:14,overflow:'hidden'}}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/>{SD.map((s,i)=><View key={i} style={{position:'absolute',top:s.t,left:s.l,opacity:s.op,width:s.r,height:s.r,borderRadius:s.r/2,backgroundColor:C.white}}/>)}<View style={{position:'absolute',top:9,left:9,paddingHorizontal:7,paddingVertical:3,borderRadius:7,backgroundColor:C.navyMid}}><Text style={{color:C.mid,fontSize:9,fontWeight:'800'}}>#{rank}</Text></View>{(review.likes??0)>0&&<View style={{position:'absolute',top:9,right:9,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.navyMid}}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:8,fontWeight:'700'}}>{fmt(review.likes??0)}</Text></View>}<View style={{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:3}}><Text style={{color:C.white,fontSize:12,fontWeight:'800',letterSpacing:-0.2}} numberOfLines={1}>{review.film?.title??'—'}</Text><View style={{flexDirection:'row',gap:2}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle}/>)}</View><Text style={{color:C.muted,fontSize:10,lineHeight:13}} numberOfLines={2}>{review.content||'Aucun contenu'}</Text></View><View style={{...StyleSheet.absoluteFillObject,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} pointerEvents="none"/></View></TouchableOpacity>);});

// ─── PROFILE HEADER ───────────────────────────────────────────────────────────
const ProfileHeader=memo(({profile,filmCount,critiqueCount,reelCount,level,onEdit}:{profile:ProfileData;filmCount:number;critiqueCount:number;reelCount:number;level:{n:number;label:string;pct:number;nextAt:number};onEdit:()=>void})=>{
  const[exp,setExp]=useState(false);const displayName=profile.display_name||profile.username||'Cinéaste';
  const links=useMemo(()=>[{key:'ig',icon:'logo-instagram' as any,url:profile.social_instagram,label:'Instagram'},{key:'vi',icon:'videocam-outline' as any,url:profile.social_vimeo,label:'Vimeo'},{key:'yt',icon:'logo-youtube' as any,url:profile.social_youtube,label:'YouTube'},{key:'ws',icon:'globe-outline' as any,url:profile.website,label:'Portfolio'}].filter(l=>!!l.url),[profile]);
  return(<View style={{paddingHorizontal:H_PAD}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:18,marginTop:8}}>
      <AvatarOrMonogram name={displayName} level={level.n} isPro={profile.is_pro} avatarUrl={profile.avatar_url}/>
      <View style={{flex:1,flexDirection:'row',justifyContent:'space-around'}}>{[{v:fmt(filmCount),l:'films'},{v:fmt(critiqueCount),l:'critiques'},{v:fmt(reelCount),l:'créas'}].map(({v,l},i,arr)=>(<React.Fragment key={l}><View style={{alignItems:'center',gap:2}}><Text style={{color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.6}}>{v}</Text><Text style={{color:C.muted,fontSize:8,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5}}>{l}</Text></View>{i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,height:28,backgroundColor:C.faint}}/>}</React.Fragment>))}</View>
    </View>
    <View style={{marginTop:14,gap:3}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <Text style={{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4,flexShrink:1}}>{displayName}</Text>
        {profile.is_pro&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Text style={{color:C.offWhite,fontSize:8,fontWeight:'900',letterSpacing:0.8}}>PRO</Text></View>}
        {profile.is_industry_contact&&<View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:2,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Ionicons name="briefcase-outline" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.6}}>INDUSTRIE</Text></View>}
      </View>
      <Text style={{color:C.muted,fontSize:12,letterSpacing:0.1}}>{ROLE_LABELS[profile.role]??'Créateur·rice'}{profile.location?` · ${profile.location}`:''} · {level.label}</Text>
    </View>
    {!!profile.bio&&(<Pressable onPress={()=>setExp(e=>!e)} style={{marginTop:10,gap:3}}><Text style={{color:C.mid,fontSize:12.5,lineHeight:18}} numberOfLines={exp?undefined:2}>{profile.bio}</Text>{profile.bio.length>100&&<Text style={{color:C.offWhite,fontSize:11,fontWeight:'700'}}>{exp?'Voir moins ↑':'Voir plus ↓'}</Text>}</Pressable>)}
    <TouchableOpacity style={{marginTop:12,borderRadius:10,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,paddingVertical:9,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:6}} onPress={onEdit} activeOpacity={0.80}><Ionicons name="create-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11.5,fontWeight:'700'}}>Modifier le profil</Text></TouchableOpacity>
    {profile.specialties.length>0&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingVertical:2}} style={{marginTop:12}}>{profile.specialties.map(s=><View key={s} style={{paddingHorizontal:10,paddingVertical:5,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}}><Text style={{color:C.offWhite,fontSize:10.5,fontWeight:'600'}}>{s}</Text></View>)}</ScrollView>}
    {profile.festivals.length>0&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingVertical:2}} style={{marginTop:8}}>{profile.festivals.map(f=><View key={f} style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:4,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}}><Ionicons name="trophy-outline" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:10,fontWeight:'600'}}>{f}</Text></View>)}</ScrollView>}
    {links.length>0&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:14}}>{links.map(l=>(<TouchableOpacity key={l.key} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:10,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}><BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/><Ionicons name={l.icon} size={12} color={C.offWhite}/><Text style={{color:C.offWhite,fontSize:10,fontWeight:'600'}}>{l.label}</Text></TouchableOpacity>))}</View>}
    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:18}}/>
  </View>);
});

const TopNav=memo(({name}:{name:string})=>{const router=useRouter();return(<View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:6,paddingBottom:2}}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:2,textTransform:'uppercase'}}>UNIVERSE</Text><Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2}}>{name}</Text></View><View style={{flexDirection:'row',gap:7}}>{([{icon:'notifications-outline',route:'/notifications',dot:true},{icon:'settings-outline',route:'/settings',dot:false}] as const).map(({icon,route,dot})=>(<TouchableOpacity key={icon} style={{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}} onPress={()=>router.push(route as any)} activeOpacity={0.75}><Ionicons name={icon} size={14} color={C.offWhite}/>{dot&&<View style={{position:'absolute',top:7,right:7,width:5,height:5,borderRadius:2.5,backgroundColor:C.white,borderWidth:1,borderColor:C.bg}}/>}</TouchableOpacity>))}</View></View>);});
const SkeletonSection=memo(()=>(<View><View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PAD,paddingTop:20,paddingBottom:12}}><Shimmer w={24} h={24} r={8}/><Shimmer w={120} h={11} r={6}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,gap:10}}>{[0,1,2,3].map(i=><Shimmer key={i} w={CARD_W} h={CARD_H} r={12}/>)}</ScrollView></View>));

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router=useRouter();
  // ★ CRITICAL: uid commence à null — jamais 'anonymous'
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
  const[fetchError,setFetchError]=useState(false);

  // ★ AUTH ROBUSTE — résout le problème Netlify localStorage
  useEffect(()=>{
    let mounted=true;

    const resolveAuth=async()=>{
      // Tentative 1 — immédiate
      try{
        const{data:{session}}=await supabase.auth.getSession();
        if(mounted&&isUUID(session?.user?.id)){setUid(session!.user.id);return;}
      }catch(e){console.error('[profile] auth attempt 1:',e);}

      // Tentative 2 — 700ms (localStorage web pas encore hydraté)
      await new Promise(r=>setTimeout(r,700));
      if(!mounted)return;
      try{
        const{data:{session}}=await supabase.auth.getSession();
        if(mounted&&isUUID(session?.user?.id)){setUid(session!.user.id);return;}
      }catch(e){console.error('[profile] auth attempt 2:',e);}

      // Aucune session valide
      if(mounted)setLoading(false);
    };

    resolveAuth();

    // Filet de sécurité — capture tout changement d'état auth
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!mounted)return;
      if(isUUID(session?.user?.id))setUid(session!.user.id);
      else if(!session){setUid(null);setLoading(false);}
    });

    return()=>{mounted=false;subscription.unsubscribe();};
  },[]);

  // ★ FETCH — déclenché uniquement quand uid est un UUID valide
  const loadAll=useCallback(async(userId:string)=>{
    // Double-check UUID avant TOUTE requête Supabase
    if(!isUUID(userId))return;
    setLoading(true);setFetchError(false);
    try{
      const[profRes,reelsRes,critRes,favRes,histRes]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',userId).maybeSingle(),
        supabase.from('reels').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
        supabase.from('critiques').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
        supabase.from('user_favorites').select('work_id').eq('user_id',userId),
        supabase.from('user_history').select('work_id').eq('user_id',userId),
      ]);
      if(profRes.data)setProfile(mapProfile(profRes.data));
      setReels((reelsRes.data??[]).map(mapReel));
      setReviews((critRes.data??[]).map(mapCritique).sort((a,b)=>(b.likes??0)-(a.likes??0)));
      const favIds=(favRes.data??[]).map((r:any)=>r.work_id).filter(Boolean);
      const histIds=(histRes.data??[]).map((r:any)=>r.work_id).filter(Boolean);
      const[favD,histD]=await Promise.all([
        favIds.length?supabase.from('works').select('*').in('id',favIds):null,
        histIds.length?supabase.from('works').select('*').in('id',histIds):null,
      ]);
      setFavWorks((favD?.data??[]).map(mapWork));
      setWatched((histD?.data??[]).map(mapWork));
      const seenIds=[...new Set([...favIds,...histIds])];
      const genres=[...new Set([...(favD?.data??[]),...(histD?.data??[])].map((w:any)=>w?.genre).filter(Boolean))];
      if(genres.length){
        const{data:recData}=await supabase.from('works').select('*').in('genre',genres).order('likes',{ascending:false}).limit(12);
        if(recData)setRecs(recData.map(mapWork).filter(w=>!seenIds.includes(w.id)));
      }
    }catch(e){console.error('[profile] fetch:',e);setFetchError(true);}
    finally{setLoading(false);setRefreshing(false);}
  },[]);

  // Déclencher le fetch uniquement quand uid est un vrai UUID
  useEffect(()=>{if(isUUID(uid))loadAll(uid!);},[uid]);

  // ★ Realtime — même guard UUID
  useEffect(()=>{
    if(!isUUID(uid))return;
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

  // ★ Gamification — uid passé directement (string|null), jamais 'anonymous'
  const{score,level,badges,missions,levelUpVisible}=useGamification(uid);

  const hotId=useMemo(()=>reels.length<2?null:[...reels].sort((a,b)=>momentum(b)-momentum(a))[0]?.id??null,[reels]);
  const reelsByCat=useMemo(()=>{const courts:UserReel[]=[],moyens:UserReel[]=[],series:UserReel[]=[];reels.forEach(r=>{if(!r.duration||r.duration<=1800)courts.push(r);else if(r.duration<=5400)moyens.push(r);else series.push(r);});return{courts,moyens,series};},[reels]);
  const displayName=profile.display_name||profile.username||'Mon Profil';

  const renderFilms=()=>{
    if(loading)return<View><SkeletonSection/><SkeletonSection/><SkeletonSection/></View>;
    if(fetchError)return(<View style={{alignItems:'center',paddingVertical:40,gap:12,paddingHorizontal:H_PAD}}><View style={{width:60,height:60,borderRadius:30,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name="cloud-offline-outline" size={28} color={C.muted}/></View><Text style={{color:C.muted,fontSize:14,textAlign:'center'}}>Impossible de charger vos données.</Text><Text style={{color:C.muted,fontSize:12,textAlign:'center',lineHeight:18}}>Vérifiez votre connexion internet et que les variables Supabase sont configurées dans Netlify.</Text><TouchableOpacity style={{paddingHorizontal:20,paddingVertical:10,borderRadius:13,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>isUUID(uid)&&loadAll(uid!)}><Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>);
    return(<View>
      <SectionHeader icon="heart-outline" label="Œuvres favorites" count={favWorks.length} onViewAll={()=>router.push('/profile/favorites' as any)}/>{!favWorks.length?<EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegardez des films depuis le catalogue"/>:<HScrollRow>{favWorks.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}</HScrollRow>}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22}}/>
      <SectionHeader icon="create-outline" label="Mes critiques" subtitle="Par popularité" onViewAll={()=>router.push('/profile/reviews' as any)}/>{!reviews.length?<EmptyState icon="chatbubble-outline" text="Aucune critique"/>:<HScrollRow>{reviews.map((r,i)=><CritiqueCard key={r.id} review={r} rank={i+1} onPress={()=>router.push(`/review/${r.id}` as any)}/>)}</HScrollRow>}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22}}/>
      <SectionHeader icon="eye-outline" label="Œuvres visionnées" onViewAll={()=>router.push('/profile/seen_films' as any)}/>{!watched.length?<EmptyState icon="film-outline" text="Aucun visionnage"/>:<HScrollRow>{watched.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}</HScrollRow>}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22}}/>
      <SectionHeader icon="shuffle-outline" label="Recommandés" subtitle="Basé sur vos goûts"/>{!recs.length?<EmptyState icon="planet-outline" text="Aucune recommandation"/>:<HScrollRow>{recs.map(f=><PortraitCard key={f.id} item={f}/>)}</HScrollRow>}
      <View style={{height:110}}/>
    </View>);
  };

  const renderCreations=()=>{
    if(loading)return<View><SkeletonSection/></View>;
    if(!reels.length)return(<View style={{paddingTop:50,paddingHorizontal:H_PAD}}><EmptyState icon="videocam-outline" text="Aucune création" subtext="Importez vos vidéos depuis l'onglet Créer"/><TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:16,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,paddingVertical:13}} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}><Ionicons name="add-circle-outline" size={14} color={C.mid}/><Text style={{color:C.mid,fontSize:12.5,fontWeight:'700'}}>Importer une vidéo</Text></TouchableOpacity><View style={{height:110}}/></View>);
    const approved=reels.filter(r=>r.status==='approved').length,pending=reels.filter(r=>r.status==='pending').length,rejected=reels.filter(r=>r.status==='rejected').length;
    const totalV=reels.reduce((s,r)=>s+r.views_count,0),totalL=reels.reduce((s,r)=>s+r.likes_count,0);
    const secs=reels.every(r=>r.duration==null)?[{key:'all',label:'Mes vidéos',icon:'videocam-outline' as const,sub:'Toutes',data:reels}]:[{key:'courts',label:'Courts métrages',icon:'videocam-outline' as const,sub:'≤ 30 min',data:reelsByCat.courts},{key:'moyens',label:'Moyens métrages',icon:'tv-outline' as const,sub:'30–90 min',data:reelsByCat.moyens},{key:'series',label:'Mini-séries',icon:'film-outline' as const,sub:'> 90 min',data:reelsByCat.series}].filter(s=>s.data.length>0);
    return(<View>
      <View style={{flexDirection:'row',paddingHorizontal:H_PAD,paddingVertical:14,marginBottom:4}}>{[{icon:'film-outline' as const,v:`${reels.length}`,l:'vidéos'},{icon:'checkmark-circle-outline' as const,v:`${approved}`,l:'validées'},{icon:'time-outline' as const,v:`${pending}`,l:'attente'},{icon:'eye-outline' as const,v:fmt(totalV),l:'vues'},{icon:'heart-outline' as const,v:fmt(totalL),l:'likes'}].map(({icon,v,l},i,arr)=>(<React.Fragment key={l}><View style={{flex:1,alignItems:'center',gap:3}}><Ionicons name={icon} size={11} color={C.muted}/><Text style={{color:C.white,fontSize:15,fontWeight:'900',letterSpacing:-0.5}}>{v}</Text><Text style={{color:C.muted,fontSize:7.5,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4}}>{l}</Text></View>{i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:4}}/>}</React.Fragment>))}</View>
      {rejected>0&&<View style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:H_PAD,marginBottom:10,paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}}><Ionicons name="alert-circle-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11,flex:1}}>{rejected} création{rejected>1?'s':''} refusée{rejected>1?'s':''}</Text></View>}
      {secs.map((s,si)=>(<View key={s.key}><SectionHeader icon={s.icon} label={s.label} subtitle={s.sub}/><HScrollRow pb={8}>{s.data.map(r=><ReelCard key={r.id} reel={r} isHot={r.id===hotId}/>)}</HScrollRow>{si<secs.length-1&&<View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22}}/>}</View>))}
      <View style={{height:110}}/>
    </View>);
  };

  const tabs=[{icon:'grid-outline' as const,label:'Films'},{icon:'play-circle-outline' as const,label:'Créations'},{icon:'pricetag-outline' as const,label:'Tags'}];

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <LevelUpToast visible={levelUpVisible} level={level.n}/>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);if(isUUID(uid))loadAll(uid!);}} tintColor={C.mid}/>}
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(7,12,23,0.70)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:160}} pointerEvents="none"/>
          <TopNav name={''}/>
          <ProfileHeader profile={profile} filmCount={watched.length} critiqueCount={reviews.length} reelCount={reels.length} level={level} onEdit={()=>router.push('/edit' as any)}/>
        </SafeAreaView>

        {/* ★ GAMIFICATION */}
        <View style={{marginTop:18,gap:14,marginBottom:6}}>
          <AnimatedScore score={score} level={level}/>
          <View>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:H_PAD,marginBottom:10}}>
              <Ionicons name="ribbon-outline" size={12} color={C.mid}/>
              <Text style={{color:C.white,fontSize:15,fontWeight:'800'}}>Badges</Text>
              <Text style={{color:C.muted,fontSize:11,marginLeft:'auto' as any}}>{badges.filter(b=>b.earned).length}/{badges.length} · Touchez pour détails</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,gap:8}}>
              {[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)].map(b=><InteractiveBadge key={b.id} badge={b}/>)}
            </ScrollView>
          </View>
          <View>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:H_PAD,marginBottom:10}}>
              <Ionicons name="compass-outline" size={12} color={C.mid}/>
              <Text style={{color:C.white,fontSize:15,fontWeight:'800'}}>Missions</Text>
              <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginLeft:'auto' as any}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{missions.filter(m=>m.completed).length}/{missions.length}</Text></View>
            </View>
            {missions.map(m=><MissionCard key={m.id} mission={m}/>)}
          </View>
        </View>

        {/* Tabs */}
        <View style={{flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginTop:18}}>
          {tabs.map(({icon,label},idx)=>{const active=activeTab===idx;const badge=idx===1?reels.filter(r=>r.status==='pending').length:0;return(<TouchableOpacity key={icon} style={{flex:1,alignItems:'center',paddingVertical:10,gap:3,position:'relative'}} onPress={()=>setActiveTab(idx as GridTab)} activeOpacity={0.75}><Ionicons name={active?(icon.replace('-outline','') as any):icon} size={17} color={active?C.white:C.muted}/><Text style={{fontSize:8.5,fontWeight:'700',color:active?C.white:C.muted,letterSpacing:0.5,textTransform:'uppercase'}}>{label}</Text>{active&&<View style={{position:'absolute',top:0,left:'20%',right:'20%',height:2,backgroundColor:C.white,borderBottomLeftRadius:2,borderBottomRightRadius:2}}/>}{badge>0&&<View style={{position:'absolute',top:6,right:10,minWidth:14,height:14,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',paddingHorizontal:3}}><Text style={{color:C.white,fontSize:7,fontWeight:'900'}}>{badge}</Text></View>}</TouchableOpacity>);})}
        </View>
        {activeTab===0&&renderFilms()}
        {activeTab===1&&renderCreations()}
        {activeTab===2&&<View style={{paddingTop:50}}><EmptyState icon="pricetag-outline" text="Onglet Tags" subtext="Les œuvres où vous êtes crédité·e apparaîtront ici."/><View style={{height:110}}/></View>}
      </ScrollView>
    </View>
  );
}


