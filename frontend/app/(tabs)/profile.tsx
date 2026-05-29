/**
 * app/(tabs)/profile.tsx — UNIVERSE · v7 NETLIFY-PROOF
 *
 * ★ FIX DÉFINITIF NETLIFY :
 *   1) Lecture directe du localStorage Supabase (pas de dépendance à getSession)
 *   2) supabase.auth.getUser() → appel serveur (bypass cache local)
 *   3) uid commence à null, jamais 'anonymous'
 *   4) isUUID() guard sur toute requête Supabase
 *
 * ★ Tab "CINÉMA" : menus déroulants interactifs (genres, spécialités, festivals…)
 * ★ Gamification : streak, level-up toast, badges interactifs, score animé
 * ★ Avatar photo ou monogramme (mis à jour depuis edit.tsx via realtime)
 * ★ Web-safe : RN Image partout, dimensions explicites
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
  blueFaint:'rgba(90,150,230,0.10)', goldFaint:'rgba(245,200,66,0.10)',
} as const;
const H_PAD = 20;
const CARD_W = 124, CARD_H = 185, REEL_W = 156, REEL_H = 220, CRIT_W = 214, CRIT_H = 144;

// ─── ★ UUID GUARD — la clé du fix Netlify ─────────────────────────────────────
function isUUID(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─── ★ FIX NETLIFY — lecture directe localStorage Supabase ───────────────────
// Sur Netlify web, getSession() peut échouer car AsyncStorage n'est pas hydraté.
// On lit le token JWT directement depuis localStorage avec la clé Supabase réelle.
const SUPABASE_PROJECT_REF = 'knrzbdqfflobfjdmqyte'; // extrait de l'URL

function getLocalStorageUserId(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    // Clé Supabase v2 (auth-helpers / @supabase/ssr)
    const keys = [
      `sb-${SUPABASE_PROJECT_REF}-auth-token`,
      `sb-${SUPABASE_PROJECT_REF}-auth-token-code-verifier`,
      'supabase.auth.token', // Supabase v1
    ];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        // v2 format: { user: { id }, access_token }
        const uid = parsed?.user?.id
          ?? parsed?.currentSession?.user?.id  // v1
          ?? parsed?.session?.user?.id;
        if (isUUID(uid)) return uid;
      } catch { /* continue */ }
    }
    // Fallback : parcourir toutes les clés du localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? '';
      if (!key.includes('supabase') && !key.includes('sb-')) continue;
      try {
        const raw = localStorage.getItem(key) ?? '';
        const parsed = JSON.parse(raw);
        const uid = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
        if (isUUID(uid)) return uid;
      } catch { /* skip */ }
    }
  } catch { /* SSR or no localStorage */ }
  return null;
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work { id:number; title:string; category:string; genre:string; year:number; likes:number; image:string|null; is_original:boolean; duration:number|null; director:string|null }
interface UserReel { id:string; video_url:string; thumbnail_url:string|null; title:string|null; genre:string|null; duration:number|null; status:'pending'|'approved'|'rejected'; likes_count:number; views_count:number; created_at:string }
interface ProfileData { display_name:string; username:string; bio:string; role:string; location:string; avatar_url:string; website:string; is_pro:boolean; is_industry_contact:boolean; specialties:string[]; festivals:string[]; open_to:string[]; notable_works:any[]; equipment:string; social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string }
interface ReviewItem { id:string; content:string; rating:number; likes:number; film:{ id:string; title:string; genre:string } }
type GridTab = 0|1|2;
interface Badge { id:string; label:string; desc:string; icon:keyof typeof Ionicons.glyphMap; earned:boolean; pts:number }
interface Mission { id:string; title:string; desc:string; reward:string; icon:keyof typeof Ionicons.glyphMap; target:number; progress:number; completed:boolean }
interface GamiStats { watchCount:number; critiqueCount:number; favCount:number; watchedGenres:Record<string,number>; isNight:boolean; totalLikedLowPopularity:number; streak:number }

const EMPTY_PROFILE: ProfileData = { display_name:'', username:'', bio:'', role:'creator', location:'', avatar_url:'', website:'', is_pro:false, is_industry_contact:false, specialties:[], festivals:[], open_to:[], notable_works:[], equipment:'', social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'' };
const ROLE_LABELS: Record<string,string> = { director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste', actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse', critic:'Critique', creator:'Créateur·rice', other:'Cinéaste' };
const GENRE_ICONS: Record<string,keyof typeof Ionicons.glyphMap> = { Drame:'sad-outline', Thriller:'eye-outline', 'Science-Fiction':'planet-outline', Documentaire:'library-outline', Animation:'color-palette-outline', 'Court-métrage':'film-outline', Expérimental:'flask-outline', Biopic:'person-outline', Horreur:'skull-outline', Comédie:'happy-outline', Romance:'heart-outline', Action:'flash-outline', Fantastique:'sparkles-outline', Policier:'shield-outline', Musical:'musical-notes-outline' };

const mapProfile = (r:any): ProfileData => ({ display_name:r?.display_name??'', username:r?.username??'', bio:r?.bio??'', role:r?.role??'creator', location:r?.location??'', avatar_url:r?.avatar_url??'', website:r?.website??'', is_pro:r?.is_pro??false, is_industry_contact:r?.is_industry_contact??false, specialties:Array.isArray(r?.specialties)?r.specialties:[], festivals:Array.isArray(r?.festivals)?r.festivals:[], open_to:Array.isArray(r?.open_to)?r.open_to:[], notable_works:Array.isArray(r?.notable_works)?r.notable_works:[], equipment:r?.equipment??'', social_instagram:r?.social_instagram??'', social_vimeo:r?.social_vimeo??'', social_youtube:r?.social_youtube??'', social_imdb:r?.social_imdb??'' });
const mapWork  = (r:any): Work => ({ id:Number(r?.id)||0, title:r?.title??'', category:r?.category??'', genre:r?.genre??'', year:Number(r?.year)||0, likes:Number(r?.likes)||0, image:r?.image??null, is_original:r?.is_original??false, duration:r?.duration!=null?Number(r.duration):null, director:r?.director??null });
const mapReel  = (r:any): UserReel => ({ id:String(r?.id??''), video_url:r?.video_url??'', thumbnail_url:r?.thumbnail_url??null, title:r?.title??null, genre:r?.genre??null, duration:r?.duration!=null?Number(r.duration):null, status:(['pending','approved','rejected'].includes(r?.status)?r.status:'pending') as any, likes_count:Number(r?.likes_count)||0, views_count:Number(r?.views_count)||0, created_at:r?.created_at??new Date().toISOString() });
const mapReview = (r:any): ReviewItem => ({ id:String(r?.id), content:String(r?.content??r?.body??''), rating:r?.rating!=null?Number(r.rating):0, likes:Number(r?.likes_count??r?.likes??0), film:{ id:String(r?.reel_id??r?.work_id??r?.id), title:String(r?.film_title??r?.work_title??r?.title??'—'), genre:r?.work_genre??'—' } });

const resolveImg = (id:number, img:string|null) => { if(!img)return`https://picsum.photos/seed/w${id}/400/600`; if(img.startsWith('http'))return img; try{return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;}catch{return`https://picsum.photos/seed/w${id}/400/600`;} };
const fmt = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(n>=1e4?0:1)}K`:`${n}`;
const momentum = (r:UserReel) => Math.round((r.views_count*0.3+r.likes_count*2)/Math.max(0.5,(Date.now()-new Date(r.created_at).getTime())/86400000));

// ─── GAMIFICATION ─────────────────────────────────────────────────────────────
function buildBadges(s:GamiStats):Badge[]{return[
  {id:'explorer', label:'Explorateur indé',   desc:'5 œuvres regardées',      icon:'compass-outline',  earned:s.watchCount>=5,                           pts:15},
  {id:'nocturne', label:'Cinéphile nocturne',  desc:'Actif après 22h',         icon:'moon-outline',     earned:s.isNight,                                 pts:5},
  {id:'pepiteur', label:'Pépites',             desc:'3 films rares aimés',     icon:'sparkles-outline', earned:s.totalLikedLowPopularity>=3,               pts:30},
  {id:'critique', label:'Critique en herbe',   desc:'5 avis publiés',          icon:'create-outline',   earned:s.critiqueCount>=5,                        pts:40},
  {id:'curateur', label:'Curateur',            desc:'10 favoris',              icon:'bookmark-outline', earned:s.favCount>=10,                            pts:20},
  {id:'omnivore', label:'Omnivore',            desc:'5 genres explorés',       icon:'layers-outline',   earned:Object.keys(s.watchedGenres).length>=5,    pts:25},
  {id:'streak',   label:'Habitué',             desc:'3 jours consécutifs',     icon:'flame-outline',    earned:s.streak>=3,                               pts:10},
];}
function buildMissions(s:GamiStats):Mission[]{return[
  {id:'watch5',  title:'Cinéphile actif',     desc:'5 œuvres visionnées',      reward:'+15 pts',         icon:'play-circle-outline', target:5,  progress:Math.min(5,s.watchCount),              completed:s.watchCount>=5},
  {id:'crit5',   title:'Voix critique',       desc:'5 critiques publiées',     reward:'+40 pts + badge', icon:'create-outline',      target:5,  progress:Math.min(5,s.critiqueCount),           completed:s.critiqueCount>=5},
  {id:'fav10',   title:'Curateur passionné',  desc:'10 favoris sauvegardés',   reward:'+20 pts + badge', icon:'bookmark-outline',    target:10, progress:Math.min(10,s.favCount),               completed:s.favCount>=10},
  {id:'pepite3', title:'Chasseur pépites',    desc:'3 films rares aimés',      reward:'+30 pts + badge', icon:'sparkles-outline',    target:3,  progress:Math.min(3,s.totalLikedLowPopularity), completed:s.totalLikedLowPopularity>=3},
];}
function cinephileLevel(score:number):{n:number;label:string;pct:number;nextAt:number}{
  const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];
  const c=[...L].reverse().find(x=>score>=x.at)??L[0]; const ni=L.findIndex(x=>x.n===c.n)+1; const nx=L[ni]??L[L.length-1];
  return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at)),nextAt:nx.at};
}

function useGamification(userId:string|null){
  const[stats,setStats]=useState<GamiStats>({watchCount:0,critiqueCount:0,favCount:0,watchedGenres:{},isNight:false,totalLikedLowPopularity:0,streak:0});
  const[prevLevel,setPrevLevel]=useState(0);
  const[levelUpVisible,setLevelUpVisible]=useState(false);
  useEffect(()=>{
    if(!isUUID(userId))return;
    const isNight=new Date().getHours()>=22||new Date().getHours()<4;
    Promise.all([
      supabase.from('user_history').select('work_id').eq('user_id',userId),
      supabase.from('critiques').select('id').eq('user_id',userId),
      supabase.from('user_favorites').select('work_id').eq('user_id',userId),
    ]).then(([h,c,f])=>setStats(prev=>({
      watchCount:(h.data??[]).length, critiqueCount:(c.data??[]).length,
      favCount:(f.data??[]).length, watchedGenres:{}, isNight,
      totalLikedLowPopularity:0, streak:prev.streak+1,
    }))).catch(e=>console.error('[gami]',e));
  },[userId]);
  const score   =useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+stats.totalLikedLowPopularity*10+(stats.isNight?5:0)+(stats.streak>=3?10:0),[stats]);
  const level   =useMemo(()=>cinephileLevel(score),[score]);
  const badges  =useMemo(()=>buildBadges(stats),[stats]);
  const missions=useMemo(()=>buildMissions(stats),[stats]);
  useEffect(()=>{if(prevLevel>0&&level.n>prevLevel){setLevelUpVisible(true);setTimeout(()=>setLevelUpVisible(false),3500);}setPrevLevel(level.n);},[level.n]);
  return{score,level,badges,missions,levelUpVisible};
}

// ─── MICRO UI ─────────────────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number;h:number;r?:number})=>{const op=useRef(new Animated.Value(0.15)).current;useEffect(()=>{const l=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.35,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.15,duration:900,useNativeDriver:true})]));l.start();return()=>l.stop();},[op]);return<Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;});
const HRow=memo(({c,pb=0}:{c:React.ReactNode;pb?:number})=>(<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,paddingBottom:pb}}>{c}</ScrollView>));
const Div=memo(()=>(<View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22}}/>));
const SecHead=memo(({icon,label,count,onMore}:{icon:keyof typeof Ionicons.glyphMap;label:string;count?:number;onMore?:()=>void})=>(<View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:22,paddingBottom:12,gap:7}}><Ionicons name={icon} size={13} color={C.mid}/><Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2,flex:1}}>{label}</Text>{count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}{onMore&&<TouchableOpacity onPress={onMore} hitSlop={8}><Text style={{color:C.muted,fontSize:11,fontWeight:'600'}}>Tout voir</Text></TouchableOpacity>}</View>));
const Empty=memo(({icon,text,sub}:{icon:keyof typeof Ionicons.glyphMap;text:string;sub?:string})=>(<View style={{alignItems:'center',paddingVertical:32,paddingHorizontal:H_PAD,gap:8}}><View style={{width:52,height:52,borderRadius:26,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={22} color={C.muted}/></View><Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>{text}</Text>{sub&&<Text style={{color:C.muted,fontSize:11,textAlign:'center',lineHeight:17}}>{sub}</Text>}</View>));


// ─── AVATAR / MONOGRAMME ──────────────────────────────────────────────────────
const Avatar=memo(({name,level,isPro,url}:{name:string;level:number;isPro:boolean;url:string})=>{
  const init=useMemo(()=>(name||'?').trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2),[name]);
  const[err,setErr]=useState(false);useEffect(()=>setErr(false),[url]);
  return(<View style={{position:'relative'}}><View style={{width:72,height:72,borderRadius:36,overflow:'hidden',borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid}}>{url&&!err?<Image source={{uri:url}} style={{width:72,height:72}} resizeMode="cover" onError={()=>setErr(true)}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.5}}>{init}</Text></View>}</View><View style={{position:'absolute',top:-4,right:-4,width:22,height:22,borderRadius:11,backgroundColor:C.navyLow,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:9,fontWeight:'900'}}>{level}</Text></View>{isPro&&<View style={{position:'absolute',bottom:0,right:0,width:18,height:18,borderRadius:9,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.borderHi,alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={8} color={C.white}/></View>}</View>);
});

// ─── BADGE INTERACTIF ─────────────────────────────────────────────────────────
const IBadge=memo(({b}:{b:Badge})=>{
  const[open,setOpen]=useState(false);const sc=useRef(new Animated.Value(1)).current;
  const press=()=>{Animated.sequence([Animated.spring(sc,{toValue:0.88,tension:300,friction:7,useNativeDriver:true}),Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();setOpen(v=>!v);};
  return(<Animated.View style={{transform:[{scale:sc}]}}><TouchableOpacity onPress={press} activeOpacity={0.85} style={[ib.w,b.earned&&ib.e]}><View style={[ib.ic,b.earned&&ib.eo]}><Ionicons name={b.icon} size={16} color={b.earned?C.white:C.muted}/></View><Text style={[ib.l,b.earned&&{color:C.white}]} numberOfLines={2}>{b.label}</Text>{b.earned&&<Text style={{color:C.gold,fontSize:8,fontWeight:'800'}}>+{b.pts}pts</Text>}{!b.earned&&<View style={{position:'absolute',top:7,right:7}}><Ionicons name="lock-closed" size={7} color={C.muted}/></View>}{open&&<View style={{position:'absolute',bottom:-30,left:0,right:0,backgroundColor:C.navyMid,borderRadius:8,padding:5,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,zIndex:10}}><Text style={{color:C.muted,fontSize:8,textAlign:'center'}}>{b.desc}</Text></View>}</TouchableOpacity></Animated.View>);
});
const ib=StyleSheet.create({w:{alignItems:'center',gap:5,padding:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:86,opacity:0.55},e:{opacity:1,borderColor:C.borderHi,backgroundColor:C.subtle},ic:{width:36,height:36,borderRadius:18,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},eo:{borderColor:C.borderHi},l:{color:C.muted,fontSize:9,fontWeight:'600',textAlign:'center',lineHeight:12}});

// ─── ANIMATED SCORE ───────────────────────────────────────────────────────────
const AnimScore=memo(({score,level}:{score:number;level:ReturnType<typeof cinephileLevel>})=>{
  const prog=useRef(new Animated.Value(0)).current,glow=useRef(new Animated.Value(0.4)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:1200,useNativeDriver:false}).start();Animated.loop(Animated.sequence([Animated.timing(glow,{toValue:1,duration:2500,useNativeDriver:true}),Animated.timing(glow,{toValue:0.4,duration:2500,useNativeDriver:true})])).start();},[level.pct]);
  return(<View style={asc.w}><Animated.View style={[asc.ring,{opacity:glow}]}/><View style={asc.circle}><Text style={asc.num}>{fmt(score)}</Text><Text style={asc.lbl}>POINTS</Text></View><View style={{flex:1,gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name="layers-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11,fontWeight:'700'}}>Niveau {level.n}</Text><View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Text style={{color:C.offWhite,fontSize:9,fontWeight:'800',letterSpacing:0.3}}>{level.label}</Text></View></View><View style={{height:4,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View>{level.n<5?<Text style={{color:C.mid,fontSize:10,fontWeight:'600'}}>{fmt(Math.max(0,level.nextAt-score))} pts → niv. {level.n+1}</Text>:<Text style={{color:C.gold,fontSize:10,fontWeight:'700'}}>Maximum ✦</Text>}</View></View>);
});
const asc=StyleSheet.create({w:{marginHorizontal:H_PAD,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,padding:16,flexDirection:'row',alignItems:'center',gap:16,marginBottom:4},ring:{position:'absolute',width:86,height:86,borderRadius:43,borderWidth:1.5,borderColor:'rgba(255,255,255,0.18)',top:8,left:8},circle:{width:72,height:72,borderRadius:36,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center',backgroundColor:C.navyMid},num:{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.8},lbl:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:2,marginTop:-2}});

// ─── MISSION CARD ─────────────────────────────────────────────────────────────
const MCard=memo(({m}:{m:Mission})=>{
  const pct=m.target>0?Math.min(1,m.progress/m.target):0;
  const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:pct,duration:900,useNativeDriver:false}).start();},[pct]);
  return(<View style={[mca.w,m.completed&&mca.done]}><BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={{flexDirection:'row',alignItems:'flex-start',gap:11,padding:13}}><View style={[mca.ic,m.completed&&mca.icDone]}><Ionicons name={m.completed?'checkmark-circle':m.icon} size={18} color={m.completed?C.white:C.mid}/></View><View style={{flex:1,gap:4}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:m.completed?C.white:C.offWhite,fontSize:12,fontWeight:'700',flex:1}} numberOfLines={1}>{m.title}</Text>{m.completed&&<View style={{paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:C.subtle,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}}><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.4}}>ACCOMPLI</Text></View>}</View><Text style={{color:C.muted,fontSize:10,lineHeight:14}}>{m.desc}</Text><View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{flex:1,height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:m.completed?C.white:C.subtle,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View><Text style={{color:m.completed?C.white:C.muted,fontSize:9,fontWeight:'700'}}>{m.progress}/{m.target}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="gift-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:9}}>{m.reward}</Text></View></View></View></View>);
});
const mca=StyleSheet.create({w:{marginHorizontal:H_PAD,marginBottom:8,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},done:{borderColor:C.borderHi},ic:{width:40,height:40,borderRadius:11,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},icDone:{backgroundColor:C.subtle,borderColor:C.borderHi}});

// ─── ★ ACCORDION (Tab Cinéma) ─────────────────────────────────────────────────
const Accordion=memo(function Accordion({icon,title,count,badge,defaultOpen=false,children}:{icon:keyof typeof Ionicons.glyphMap;title:string;count?:number;badge?:string;defaultOpen?:boolean;children:React.ReactNode}){
  const[open,setOpen]=useState(defaultOpen);
  const rot=useRef(new Animated.Value(defaultOpen?1:0)).current;
  const hgt=useRef(new Animated.Value(defaultOpen?1:0)).current;
  const toggle=()=>{
    const toV=open?0:1;
    Animated.parallel([
      Animated.spring(rot,{toValue:toV,tension:80,friction:10,useNativeDriver:true}),
      Animated.timing(hgt,{toValue:toV,duration:280,useNativeDriver:false}),
    ]).start();
    setOpen(!open);
  };
  return(<View style={{marginHorizontal:H_PAD,marginBottom:8,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:open?C.borderHi:C.border,backgroundColor:C.navyLow}}>
    <TouchableOpacity onPress={toggle} activeOpacity={0.80} style={{flexDirection:'row',alignItems:'center',gap:11,padding:15}}>
      <View style={{width:34,height:34,borderRadius:11,backgroundColor:open?C.subtle:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:open?C.borderHi:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={15} color={open?C.white:C.mid}/></View>
      <Text style={{color:open?C.white:C.offWhite,fontSize:13,fontWeight:'700',flex:1,letterSpacing:-0.2}}>{title}</Text>
      {badge&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{badge}</Text></View>}
      {count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}
      <Animated.View style={{transform:[{rotate:rot.interpolate({inputRange:[0,1],outputRange:['0deg','90deg']})}]}}><Ionicons name="chevron-forward" size={14} color={C.muted}/></Animated.View>
    </TouchableOpacity>
    {open&&<View style={{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border,paddingHorizontal:14,paddingTop:14,paddingBottom:16,gap:10}}>{children}</View>}
  </View>);
});

// ─── ★ GENRE BAR ──────────────────────────────────────────────────────────────
const GenreBar=memo(({genre,count,total}:{genre:string;count:number;total:number})=>{
  const pct=total>0?count/total:0;const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:pct,duration:800,useNativeDriver:false}).start();},[pct]);
  return(<View style={{flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name={GENRE_ICONS[genre]??'film-outline'} size={12} color={C.muted}/><Text style={{width:110,color:C.mid,fontSize:11,fontWeight:'600'}}>{genre}</Text><View style={{flex:1,height:4,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.subtle,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View><Text style={{color:C.muted,fontSize:10,fontWeight:'700',width:20,textAlign:'right'}}>{count}</Text></View>);
});

// ─── ★ RATING ROW ─────────────────────────────────────────────────────────────
const RatingRow=memo(({rating,count,max}:{rating:number;count:number;max:number})=>{
  const pct=max>0?count/max:0;const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:pct,duration:700,useNativeDriver:false}).start();},[pct]);
  return(<View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{flexDirection:'row',gap:1}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=rating?'star':'star-outline'} size={9} color={s<=rating?C.gold:C.muted}/>)}</View><View style={{flex:1,height:4,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.goldFaint,borderWidth:0.5,borderColor:C.gold,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View><Text style={{color:C.muted,fontSize:10,fontWeight:'700',width:18,textAlign:'right'}}>{count}</Text></View>);
});

// ─── PORTRAIT / REEL / CRITIQUE CARDS ─────────────────────────────────────────
const PortraitCard=memo(({item,rank}:{item:Work;rank?:number})=>{const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={ptc.card}><Image source={{uri}} style={ptc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={ptc.badge}><Text style={ptc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{rank!=null&&<Text style={ptc.rank}>{rank}</Text>}<View style={ptc.meta}><Text style={ptc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={ptc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>{item.year>0&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={ptc.stat}>{item.year}</Text></>}</View></View></View></TouchableOpacity>);});
const ptc=StyleSheet.create({card:{width:CARD_W,height:CARD_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:CARD_W,height:CARD_H},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},rank:{position:'absolute',bottom:32,right:5,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.10)'},meta:{position:'absolute',bottom:7,left:8,right:8,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

function useThumb(url:string,thumb:string|null):string|null{const[uri,setUri]=useState<string|null>(thumb??null);useEffect(()=>{if(thumb||!url||!VideoThumbnails)return;let ok=true;VideoThumbnails.getThumbnailAsync(url,{time:1500,quality:0.65}).then(({uri:u}:{uri:string})=>{if(ok)setUri(u);}).catch(()=>{});return()=>{ok=false;};},[url,thumb]);return uri;}
const S_CFG:Record<string,{icon:keyof typeof Ionicons.glyphMap;label:string}>={pending:{icon:'time-outline',label:'En attente'},approved:{icon:'checkmark-circle-outline',label:'Validée'},rejected:{icon:'close-circle-outline',label:'Refusée'}};
const ReelCard=memo(({reel,isHot}:{reel:UserReel;isHot:boolean})=>{const router=useRouter(),thumb=useThumb(reel.video_url,reel.thumbnail_url),cfg=S_CFG[reel.status]??S_CFG.pending,[err,setErr]=useState(false),m=momentum(reel);return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push({pathname:'/reel/[id]',params:{id:reel.id}} as any)} activeOpacity={0.88}><View style={rlc.card}>{thumb&&!err?<Image source={{uri:thumb}} style={rlc.img} resizeMode="cover" onError={()=>setErr(true)}/>:<View style={rlc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="film-outline" size={24} color={C.subtle}/></View>}<LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/><View style={{position:'absolute',top:'40%',alignSelf:'center',marginTop:-12}} pointerEvents="none"><Ionicons name="play-circle-outline" size={26} color={C.mid}/></View><View style={rlc.status}><Ionicons name={cfg.icon} size={9} color={C.mid}/><Text style={rlc.stTxt}>{cfg.label}</Text></View>{(isHot||reel.views_count>=10)&&<View style={rlc.mom}><Ionicons name={isHot?'flame-outline':'trending-up-outline'} size={8} color={C.mid}/><Text style={rlc.momTxt}>{isHot?'EN HAUSSE':`${fmt(reel.views_count)} vues`}</Text></View>}<View style={rlc.meta}><Text style={rlc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text>{reel.genre&&<Text style={{color:C.muted,fontSize:8}}>{reel.genre}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:2}}><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="eye-outline" size={8} color={C.muted}/><Text style={rlc.stTxt}>{fmt(reel.views_count)}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="heart-outline" size={8} color={C.muted}/><Text style={rlc.stTxt}>{fmt(reel.likes_count)}</Text></View>{m>0&&<Text style={{marginLeft:'auto' as any,color:C.muted,fontSize:7,fontWeight:'700'}}>{m}pts/j</Text>}</View></View></View></TouchableOpacity>);});
const rlc=StyleSheet.create({card:{width:REEL_W,height:REEL_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:REEL_W,height:REEL_H},ph:{width:REEL_W,height:REEL_H,alignItems:'center',justifyContent:'center'},status:{position:'absolute',top:8,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.72)'},stTxt:{color:C.muted,fontSize:7.5,fontWeight:'700'},mom:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:'rgba(7,12,23,0.82)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},momTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},meta:{position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},title:{color:C.white,fontSize:10.5,fontWeight:'800',lineHeight:13}});

const CritCard=memo(({r,rank,onPress}:{r:ReviewItem;rank:number;onPress:()=>void})=>{const stars=Math.round(r.rating??0);return(<TouchableOpacity style={{marginRight:10}} onPress={onPress} activeOpacity={0.88}><View style={{width:CRIT_W,height:CRIT_H,borderRadius:14,overflow:'hidden'}}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/><View style={{position:'absolute',top:9,left:9,paddingHorizontal:7,paddingVertical:3,borderRadius:7,backgroundColor:C.navyMid}}><Text style={{color:C.mid,fontSize:9,fontWeight:'800'}}>#{rank}</Text></View>{r.likes>0&&<View style={{position:'absolute',top:9,right:9,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.navyMid}}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:8,fontWeight:'700'}}>{fmt(r.likes)}</Text></View>}<View style={{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:3}}><Text style={{color:C.white,fontSize:12,fontWeight:'800',letterSpacing:-0.2}} numberOfLines={1}>{r.film?.title??'—'}</Text><View style={{flexDirection:'row',gap:2}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle}/>)}</View><Text style={{color:C.muted,fontSize:10,lineHeight:13}} numberOfLines={2}>{r.content||'—'}</Text></View><View style={{...StyleSheet.absoluteFillObject,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} pointerEvents="none"/></View></TouchableOpacity>);});

// ─── PROFILE HEADER ───────────────────────────────────────────────────────────
const ProfileHeader=memo(({profile,filmCount,critiqueCount,reelCount,level,onEdit}:{profile:ProfileData;filmCount:number;critiqueCount:number;reelCount:number;level:{n:number;label:string;pct:number;nextAt:number};onEdit:()=>void})=>{
  const[exp,setExp]=useState(false);const dn=profile.display_name||profile.username||'Cinéaste';
  const links=useMemo(()=>[{k:'ig',icon:'logo-instagram' as any,url:profile.social_instagram,l:'Instagram'},{k:'vi',icon:'videocam-outline' as any,url:profile.social_vimeo,l:'Vimeo'},{k:'yt',icon:'logo-youtube' as any,url:profile.social_youtube,l:'YouTube'},{k:'ws',icon:'globe-outline' as any,url:profile.website,l:'Portfolio'}].filter(l=>!!l.url),[profile]);
  return(<View style={{paddingHorizontal:H_PAD}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:18,marginTop:8}}>
      <Avatar name={dn} level={level.n} isPro={profile.is_pro} url={profile.avatar_url}/>
      <View style={{flex:1,flexDirection:'row',justifyContent:'space-around'}}>{[{v:fmt(filmCount),l:'films'},{v:fmt(critiqueCount),l:'critiques'},{v:fmt(reelCount),l:'créas'}].map(({v,l},i,arr)=>(<React.Fragment key={l}><View style={{alignItems:'center',gap:2}}><Text style={{color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.6}}>{v}</Text><Text style={{color:C.muted,fontSize:8,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5}}>{l}</Text></View>{i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,height:28,backgroundColor:C.faint}}/>}</React.Fragment>))}</View>
    </View>
    <View style={{marginTop:14,gap:3}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <Text style={{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4,flexShrink:1}}>{dn}</Text>
        {profile.is_pro&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Text style={{color:C.offWhite,fontSize:8,fontWeight:'900',letterSpacing:0.8}}>PRO</Text></View>}
        {profile.is_industry_contact&&<View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:2,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid}}><Ionicons name="briefcase-outline" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.6}}>INDUSTRIE</Text></View>}
      </View>
      <Text style={{color:C.muted,fontSize:12,letterSpacing:0.1}}>{ROLE_LABELS[profile.role]??'Créateur·rice'}{profile.location?` · ${profile.location}`:''} · {level.label}</Text>
    </View>
    {!!profile.bio&&(<Pressable onPress={()=>setExp(e=>!e)} style={{marginTop:10,gap:3}}><Text style={{color:C.mid,fontSize:12.5,lineHeight:18}} numberOfLines={exp?undefined:2}>{profile.bio}</Text>{profile.bio.length>100&&<Text style={{color:C.offWhite,fontSize:11,fontWeight:'700'}}>{exp?'Voir moins ↑':'Voir plus ↓'}</Text>}</Pressable>)}
    <TouchableOpacity style={{marginTop:12,borderRadius:10,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,paddingVertical:9,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:6}} onPress={onEdit} activeOpacity={0.80}><Ionicons name="create-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11.5,fontWeight:'700'}}>Modifier le profil</Text></TouchableOpacity>
    {links.length>0&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:14}}>{links.map(l=>(<TouchableOpacity key={l.k} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:10,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}><BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/><Ionicons name={l.icon} size={12} color={C.offWhite}/><Text style={{color:C.offWhite,fontSize:10,fontWeight:'600'}}>{l.l}</Text></TouchableOpacity>))}</View>}
    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:18}}/>
  </View>);
});

const TopNav=memo(({name}:{name:string})=>{const router=useRouter();return(<View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:6,paddingBottom:2}}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:2,textTransform:'uppercase'}}>UNIVERSE</Text><View style={{width:1,height:10,backgroundColor:C.faint}}/><Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2}}>{name}</Text></View><View style={{flexDirection:'row',gap:7}}>{([{icon:'notifications-outline',route:'/notifications',dot:true},{icon:'settings-outline',route:'/settings',dot:false}] as const).map(({icon,route,dot})=>(<TouchableOpacity key={icon} style={{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}} onPress={()=>router.push(route as any)} activeOpacity={0.75}><Ionicons name={icon} size={14} color={C.offWhite}/>{dot&&<View style={{position:'absolute',top:7,right:7,width:5,height:5,borderRadius:2.5,backgroundColor:C.white,borderWidth:1,borderColor:C.bg}}/>}</TouchableOpacity>))}</View></View>);});
const SkeletonSection=memo(()=>(<View><View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PAD,paddingTop:20,paddingBottom:12}}><Shimmer w={24} h={24} r={8}/><Shimmer w={120} h={11} r={6}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,gap:10}}>{[0,1,2,3].map(i=><Shimmer key={i} w={CARD_W} h={CARD_H} r={12}/>)}</ScrollView></View>));

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  // ★ null — jamais 'anonymous'
  const [uid, setUid]         = useState<string|null>(null);
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [reels, setReels]     = useState<UserReel[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [favWorks, setFavW]   = useState<Work[]>([]);
  const [watched, setWatched] = useState<Work[]>([]);
  const [recs, setRecs]       = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRef]  = useState(false);
  const [fetchError, setFErr] = useState(false);
  const [activeTab, setTab]   = useState<GridTab>(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // ★ FIX NETLIFY — résolution auth en 4 couches
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(()=>{
    let mounted = true;

    const resolve = async () => {
      // Couche 1 : getSession() immédiat
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && isUUID(session?.user?.id)) { setUid(session!.user.id); return; }
      } catch (e) { console.error('[profile] L1:', e); }

      // Couche 2 : lecture directe localStorage (fix Netlify web)
      // getSession() retourne null si AsyncStorage n'est pas encore hydraté
      const lsId = getLocalStorageUserId();
      if (mounted && isUUID(lsId)) { setUid(lsId!); return; }

      // Couche 3 : getUser() → appel serveur direct, bypass localStorage
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted && isUUID(user?.id)) { setUid(user!.id); return; }
      } catch (e) { console.error('[profile] L3:', e); }

      // Couche 4 : retry après 800ms (localStorage web pas encore disponible)
      await new Promise(r => setTimeout(r, 800));
      if (!mounted) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && isUUID(session?.user?.id)) { setUid(session!.user.id); return; }
        // Dernière chance : localStorage après délai
        const lsId2 = getLocalStorageUserId();
        if (mounted && isUUID(lsId2)) { setUid(lsId2!); return; }
      } catch (e) { console.error('[profile] L4:', e); }

      if (mounted) setLoading(false);
    };

    resolve();

    // Filet de sécurité — onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (!mounted) return;
      if (isUUID(s?.user?.id)) setUid(s!.user.id);
      else if (!s) { setUid(null); setLoading(false); }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // ★ FETCH — déclenché uniquement quand uid est un UUID valide
  const loadAll = useCallback(async (userId: string) => {
    if (!isUUID(userId)) return;
    setLoading(true); setFErr(false);
    try {
      const [profR, reelsR, critR, favR, histR] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('reels').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('critiques').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('user_favorites').select('work_id').eq('user_id', userId),
        supabase.from('user_history').select('work_id').eq('user_id', userId),
      ]);
      if (profR.data) setProfile(mapProfile(profR.data));
      setReels((reelsR.data ?? []).map(mapReel));
      setReviews((critR.data ?? []).map(mapReview).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)));
      const favIds = (favR.data ?? []).map((r: any) => r.work_id).filter(Boolean);
      const histIds = (histR.data ?? []).map((r: any) => r.work_id).filter(Boolean);
      const [favD, histD] = await Promise.all([
        favIds.length  ? supabase.from('works').select('*').in('id', favIds)  : null,
        histIds.length ? supabase.from('works').select('*').in('id', histIds) : null,
      ]);
      setFavW((favD?.data ?? []).map(mapWork));
      setWatched((histD?.data ?? []).map(mapWork));
      const seenIds = [...new Set([...favIds, ...histIds])];
      const genres = [...new Set([...(favD?.data ?? []), ...(histD?.data ?? [])].map((w: any) => w?.genre).filter(Boolean))];
      if (genres.length) {
        const { data: recData } = await supabase.from('works').select('*').in('genre', genres).order('likes', { ascending: false }).limit(12);
        if (recData) setRecs(recData.map(mapWork).filter(w => !seenIds.includes(w.id)));
      }
    } catch (e) { console.error('[profile] fetch:', e); setFErr(true); }
    finally { setLoading(false); setRef(false); }
  }, []);

  useEffect(() => { if (isUUID(uid)) loadAll(uid!); }, [uid]);

  // Realtime
  useEffect(() => {
    if (!isUUID(uid)) return;
    const ts = Date.now();
    const ch1 = supabase.channel(`rt_r_${ts}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reels' }, ({ new: r }) => setReels(p => p.map(x => x.id === (r as any).id ? mapReel(r) : x)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' }, ({ new: r }) => { const reel = mapReel(r); if (reel.id) setReels(p => [reel, ...p.filter(x => x.id !== reel.id)]); })
      .subscribe();
    const ch2 = supabase.channel(`rt_p_${ts}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, ({ new: r }) => { if ((r as any).id === uid) setProfile(mapProfile(r)); })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [uid]);

  const { score, level, badges, missions, levelUpVisible } = useGamification(uid);
  const hotId = useMemo(() => reels.length < 2 ? null : [...reels].sort((a, b) => momentum(b) - momentum(a))[0]?.id ?? null, [reels]);
  const reelsByCat = useMemo(() => { const courts: UserReel[] = [], moyens: UserReel[] = [], series: UserReel[] = []; reels.forEach(r => { if (!r.duration || r.duration <= 1800) courts.push(r); else if (r.duration <= 5400) moyens.push(r); else series.push(r); }); return { courts, moyens, series }; }, [reels]);
  const dn = profile.display_name || profile.username || 'Mon Profil';

  // ─── Genre breakdown from watched ─────────────────────────────────────────
  const genreStats = useMemo(() => {
    const m: Record<string, number> = {};
    watched.forEach(w => { if (w.genre) m[w.genre] = (m[w.genre] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [watched]);
  const maxGenre = useMemo(() => Math.max(1, ...genreStats.map(g => g[1])), [genreStats]);

  // ─── Rating distribution ───────────────────────────────────────────────────
  const ratingDist = useMemo(() => {
    const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => { const s = Math.round(r.rating); if (s >= 1 && s <= 5) d[s]++; });
    return d;
  }, [reviews]);
  const maxRating = useMemo(() => Math.max(1, ...Object.values(ratingDist)), [ratingDist]);

  // ─── Error state ───────────────────────────────────────────────────────────
  const ErrorState = () => (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12, paddingHorizontal: H_PAD }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.navyLow, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cloud-offline-outline" size={28} color={C.muted} />
      </View>
      <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>Impossible de charger les données.</Text>
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 17 }}>Vérifiez que les variables Supabase sont configurées dans Netlify (EXPO_PUBLIC_SUPABASE_URL + KEY).</Text>
      <TouchableOpacity style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 13, backgroundColor: C.navyLow, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }} onPress={() => isUUID(uid) && loadAll(uid!)}>
        <Text style={{ color: C.white, fontSize: 13, fontWeight: '700' }}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Tab : Films ───────────────────────────────────────────────────────────
  const renderFilms = () => {
    if (loading) return <View><SkeletonSection /><SkeletonSection /><SkeletonSection /></View>;
    if (fetchError) return <ErrorState />;
    return (<View>
      <SecHead icon="heart-outline" label="Œuvres favorites" count={favWorks.length} onMore={() => router.push('/profile/favorites' as any)} />
      {!favWorks.length ? <Empty icon="heart-outline" text="Aucun favori" sub="Sauvegardez des films depuis le catalogue" /> : <HRow c={favWorks.map((f, i) => <PortraitCard key={f.id} item={f} rank={i + 1} />)} />}
      <Div />
      <SecHead icon="create-outline" label="Mes critiques" count={reviews.length} onMore={() => router.push('/profile/reviews' as any)} />
      {!reviews.length ? <Empty icon="chatbubble-outline" text="Aucune critique" /> : <HRow c={reviews.map((r, i) => <CritCard key={r.id} r={r} rank={i + 1} onPress={() => router.push(`/review/${r.id}` as any)} />)} />}
      <Div />
      <SecHead icon="eye-outline" label="Œuvres visionnées" count={watched.length} onMore={() => router.push('/profile/seen_films' as any)} />
      {!watched.length ? <Empty icon="film-outline" text="Aucun visionnage" /> : <HRow c={watched.map((f, i) => <PortraitCard key={f.id} item={f} rank={i + 1} />)} />}
      <Div />
      <SecHead icon="shuffle-outline" label="Recommandés pour vous" />
      {!recs.length ? <Empty icon="planet-outline" text="Aucune recommandation" /> : <HRow c={recs.map(f => <PortraitCard key={f.id} item={f} />)} />}
      <View style={{ height: 110 }} />
    </View>);
  };

  // ─── Tab : Cinéma ★ (accordéons interactifs) ──────────────────────────────
  const renderCinema = () => {
    if (loading) return <View><SkeletonSection /></View>;
    return (<View style={{ marginTop: 16 }}>

      {/* 1. Identité cinématographique */}
      <Accordion icon="person-circle-outline" title="Identité cinématographique" defaultOpen badge={ROLE_LABELS[profile.role] ?? 'Cinéaste'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {[ROLE_LABELS[profile.role] ?? 'Cinéaste', ...profile.specialties].map((s, i) => (
            <View key={i} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: i === 0 ? C.borderHi : C.border, backgroundColor: i === 0 ? C.subtle : C.faint }}>
              <Text style={{ color: i === 0 ? C.white : C.mid, fontSize: 11, fontWeight: i === 0 ? '700' : '500' }}>{s}</Text>
            </View>
          ))}
        </View>
        {profile.location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
            <Ionicons name="location-outline" size={12} color={C.muted} />
            <Text style={{ color: C.muted, fontSize: 12 }}>{profile.location}</Text>
          </View>
        ) : null}
        {profile.equipment ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Équipement</Text>
            <Text style={{ color: C.mid, fontSize: 12, lineHeight: 18 }}>{profile.equipment}</Text>
          </View>
        ) : null}
      </Accordion>

      {/* 2. Genres explorés */}
      <Accordion icon="layers-outline" title="Genres explorés" count={genreStats.length}>
        {genreStats.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Regardez des films pour voir vos genres préférés</Text>
        ) : genreStats.map(([genre, count]) => (
          <GenreBar key={genre} genre={genre} count={count} total={maxGenre} />
        ))}
      </Accordion>

      {/* 3. Notes & Avis */}
      <Accordion icon="star-outline" title="Mes notes & avis" count={reviews.length}>
        {reviews.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Aucune critique publiée</Text>
        ) : (<View style={{ gap: 7 }}>
          {[5, 4, 3, 2, 1].map(s => <RatingRow key={s} rating={s} count={ratingDist[s] ?? 0} max={maxRating} />)}
          <Text style={{ color: C.muted, fontSize: 10, marginTop: 4, textAlign: 'center' }}>Note moyenne : {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '—'} / 5</Text>
        </View>)}
      </Accordion>

      {/* 4. Palmarès & Festivals */}
      <Accordion icon="trophy-outline" title="Palmarès & Festivals" count={profile.festivals.length}>
        {profile.festivals.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Ajoutez vos festivals depuis "Modifier le profil"</Text>
        ) : profile.festivals.map((f, i) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i < profile.festivals.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.goldFaint, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trophy-outline" size={13} color={C.gold} />
            </View>
            <Text style={{ color: C.offWhite, fontSize: 13, fontWeight: '600', flex: 1 }}>{f}</Text>
            <Text style={{ color: C.muted, fontSize: 10 }}>#{i + 1}</Text>
          </View>
        ))}
      </Accordion>

      {/* 5. Œuvres notables */}
      {profile.notable_works.length > 0 && (
        <Accordion icon="film-outline" title="Œuvres notables" count={profile.notable_works.length}>
          {profile.notable_works.map((w: any, i: number) => (
            <TouchableOpacity key={w.id ?? i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < profile.notable_works.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border }} onPress={() => w.url ? Linking.openURL(w.url).catch(() => {}) : null} activeOpacity={0.80}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.navyMid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.mid, fontSize: 11, fontWeight: '900' }}>{w.year?.slice(-2) ?? '—'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.white, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{w.title || 'Sans titre'}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{w.role || '—'}</Text>
              </View>
              {w.url && <Ionicons name="open-outline" size={13} color={C.muted} />}
            </TouchableOpacity>
          ))}
        </Accordion>
      )}

      {/* 6. Collaborations */}
      <Accordion icon="link-outline" title="Ouvert à collaborer">
        {profile.open_to.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Précisez vos disponibilités dans "Modifier le profil"</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {profile.open_to.map(c => (
              <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.blueFaint, backgroundColor: 'rgba(90,150,230,0.06)' }}>
                <Ionicons name="checkmark-circle-outline" size={11} color={C.blue} />
                <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600' }}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </Accordion>

      <View style={{ height: 110 }} />
    </View>);
  };

  // ─── Tab : Créations ──────────────────────────────────────────────────────
  const renderCreations = () => {
    if (loading) return <View><SkeletonSection /></View>;
    if (!reels.length) return (
      <View style={{ paddingTop: 50, paddingHorizontal: H_PAD }}>
        <Empty icon="videocam-outline" text="Aucune création" sub="Importez vos vidéos depuis l'onglet Créer" />
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow, paddingVertical: 13 }} onPress={() => router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={14} color={C.mid} />
          <Text style={{ color: C.mid, fontSize: 12.5, fontWeight: '700' }}>Importer une vidéo</Text>
        </TouchableOpacity>
        <View style={{ height: 110 }} />
      </View>
    );
    const approved = reels.filter(r => r.status === 'approved').length;
    const pending  = reels.filter(r => r.status === 'pending').length;
    const rejected = reels.filter(r => r.status === 'rejected').length;
    const totalV   = reels.reduce((s, r) => s + r.views_count, 0);
    const totalL   = reels.reduce((s, r) => s + r.likes_count, 0);
    const secs = reels.every(r => r.duration == null)
      ? [{ key: 'all', label: 'Mes vidéos', icon: 'videocam-outline' as const, sub: 'Toutes', data: reels }]
      : [
          { key: 'courts', label: 'Courts métrages', icon: 'videocam-outline' as const, sub: '≤ 30 min', data: reelsByCat.courts },
          { key: 'moyens', label: 'Moyens métrages', icon: 'tv-outline' as const,       sub: '30–90 min', data: reelsByCat.moyens },
          { key: 'series', label: 'Mini-séries',     icon: 'film-outline' as const,     sub: '> 90 min',  data: reelsByCat.series },
        ].filter(s => s.data.length > 0);
    return (<View>
      <View style={{ flexDirection: 'row', paddingHorizontal: H_PAD, paddingVertical: 14, marginBottom: 4 }}>
        {[{ icon: 'film-outline' as const, v: `${reels.length}`, l: 'vidéos' }, { icon: 'checkmark-circle-outline' as const, v: `${approved}`, l: 'validées' }, { icon: 'time-outline' as const, v: `${pending}`, l: 'attente' }, { icon: 'eye-outline' as const, v: fmt(totalV), l: 'vues' }, { icon: 'heart-outline' as const, v: fmt(totalL), l: 'likes' }].map(({ icon, v, l }, i, arr) => (
          <React.Fragment key={l}>
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}><Ionicons name={icon} size={11} color={C.muted} /><Text style={{ color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: -0.5 }}>{v}</Text><Text style={{ color: C.muted, fontSize: 7.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{l}</Text></View>
            {i < arr.length - 1 && <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: 4 }} />}
          </React.Fragment>
        ))}
      </View>
      {rejected > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: H_PAD, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow }}><Ionicons name="alert-circle-outline" size={12} color={C.mid} /><Text style={{ color: C.mid, fontSize: 11, flex: 1 }}>{rejected} création{rejected > 1 ? 's' : ''} refusée{rejected > 1 ? 's' : ''}</Text></View>}
      {secs.map((s, si) => (<View key={s.key}><SecHead icon={s.icon} label={s.label} /></View>))}
      {secs.map((s, si) => (<View key={s.key}><HRow pb={8} c={s.data.map(r => <ReelCard key={r.id} reel={r} isHot={r.id === hotId} />)} />{si < secs.length - 1 && <Div />}</View>))}
      <View style={{ height: 110 }} />
    </View>);
  };

  const tabs = [
    { icon: 'grid-outline' as const, label: 'Films' },
    { icon: 'clapperboard-outline' as const, label: 'Cinéma' },
    { icon: 'play-circle-outline' as const, label: 'Créations' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRef(true); if (isUUID(uid)) loadAll(uid!); }} tintColor={C.mid} />}>
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(7,12,23,0.70)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }} pointerEvents="none" />
          <TopNav name={dn} />
          <ProfileHeader profile={profile} filmCount={watched.length} critiqueCount={reviews.length} reelCount={reels.length} level={level} onEdit={() => router.push('/edit' as any)} />
        </SafeAreaView>

        {/* ★ GAMIFICATION */}
        <View style={{ marginTop: 18, gap: 14, marginBottom: 6 }}>
          <AnimScore score={score} level={level} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: H_PAD, marginBottom: 10 }}>
              <Ionicons name="ribbon-outline" size={12} color={C.mid} />
              <Text style={{ color: C.white, fontSize: 15, fontWeight: '800' }}>Badges</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginLeft: 'auto' as any }}>{badges.filter(b => b.earned).length}/{badges.length} · Touchez pour détails</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 8 }}>
              {[...badges.filter(b => b.earned), ...badges.filter(b => !b.earned)].map(b => <IBadge key={b.id} b={b} />)}
            </ScrollView>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: H_PAD, marginBottom: 10 }}>
              <Ionicons name="compass-outline" size={12} color={C.mid} />
              <Text style={{ color: C.white, fontSize: 15, fontWeight: '800' }}>Missions</Text>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: C.faint, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginLeft: 'auto' as any }}>
                <Text style={{ color: C.muted, fontSize: 9, fontWeight: '700' }}>{missions.filter(m => m.completed).length}/{missions.length}</Text>
              </View>
            </View>
            {missions.map(m => <MCard key={m.id} m={m} />)}
          </View>
        </View>

        {/* TABS */}
        <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: 18 }}>
          {tabs.map(({ icon, label }, idx) => {
            const active = activeTab === idx;
            const badge = idx === 2 ? reels.filter(r => r.status === 'pending').length : 0;
            return (
              <TouchableOpacity key={icon} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, position: 'relative' }} onPress={() => setTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active ? (icon.replace('-outline', '') as any) : icon} size={17} color={active ? C.white : C.muted} />
                <Text style={{ fontSize: 8.5, fontWeight: '700', color: active ? C.white : C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
                {active && <View style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: C.white, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />}
                {badge > 0 && <View style={{ position: 'absolute', top: 6, right: 10, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: C.navyMid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ color: C.white, fontSize: 7, fontWeight: '900' }}>{badge}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
        {activeTab === 0 && renderFilms()}
        {activeTab === 1 && renderCinema()}
        {activeTab === 2 && renderCreations()}
      </ScrollView>
    </View>
  );
}