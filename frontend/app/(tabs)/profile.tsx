import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Easing, Image, Linking, Modal, Platform,
  RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, FlatList,
} from 'react-native';
import { LinearGradient }              from 'expo-linear-gradient';
import { Ionicons }                    from '@expo/vector-icons';
import { useRouter, useFocusEffect }   from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }                   from 'expo-status-bar';
import GalaxyBackground                from '@/components/shared/GalaxyBackground';
import { supabase }                    from '@/lib/supabase';
import { getDeviceId }                 from '@/services/api';
import {
  xpToLevel, TITLES, resolveImg as resolveImgGami,
  type GamiProfile, type Work,
  useGamification, useDailyQuests,
  XPFloat, XPBar as GamiXPBar, LevelUpCelebration, DailyQuestsPanel,
} from '@/contexts/GamificationSystem';

const { width: SW } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830', navyDark:'#06101F',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.88)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.35)',
  faint:'rgba(255,255,255,0.07)', subtle:'rgba(255,255,255,0.13)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.20)',
  gold:'#F5C842', goldDim:'rgba(245,200,66,0.12)', goldBd:'rgba(245,200,66,0.28)',
  blue:'#5A96E6', blueDim:'rgba(90,150,230,0.10)',
  purple:'#BF5FFF', purpleDim:'rgba(191,95,255,0.12)',
  ring:'rgba(255,255,255,0.22)',
} as const;

// ─── Gamification badge constants (identiques à search.tsx) ──────────────────
const SECTIONS = [
  { label:'Galaxie XP', icon:'planet-outline'   as const },
  { label:'Cosmos',     icon:'infinite-outline' as const },
];
const FOMO = [
  "Tu es à quelques XP du prochain niveau — continue.",
  "Ton streak reste ton meilleur atout.",
  "Une critique = 50 XP. C'est maintenant ou jamais.",
  "Chaque film visionné = +20 XP directs.",
  "3 minutes d'action = XP garantis.",
  "Chaque défi terminé = badge en approche.",
];
function levelIcon(lvl: number): keyof typeof Ionicons.glyphMap {
  if (lvl >= 9) return 'planet';
  if (lvl >= 7) return 'star';
  if (lvl >= 5) return 'flash';
  if (lvl >= 3) return 'compass-outline';
  return 'film-outline';
}
let _Hp: any = null;
if (Platform.OS !== 'web') { try { _Hp = require('expo-haptics'); } catch {} }
function hL() { _Hp?.impactAsync?.(_Hp.ImpactFeedbackStyle?.Light).catch(() => {}); }

const H_PAD = 20;
const CARD_W = 124, CARD_H = 185;
const REEL_W = 156, REEL_H = 220;
const CRIT_W = 214, CRIT_H = 144;
const GRID_GAP = 10;
const GRID_COL = (SW - 32 - GRID_GAP) / 2;
const WORK_COLS = 'id,title,category,genre,year,likes,image,is_original,duration,director';


// ─── GENRE META ───────────────────────────────────────────────────────────────
const GENRE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Drame:'sad-outline', Thriller:'eye-outline', 'Science-Fiction':'planet-outline',
  Documentaire:'library-outline', Animation:'color-palette-outline', Expérimental:'flask-outline',
  Biopic:'person-outline', Horreur:'skull-outline', Comédie:'happy-outline',
  Romance:'heart-outline', Action:'flash-outline', Fantastique:'sparkles-outline',
  Policier:'shield-outline', Musical:'musical-notes-outline',
};
const GENRE_COLORS: Record<string, string> = {
  Drame:'#A78BFA', Thriller:'#F87171', 'Science-Fiction':'#38BDF8',
  Documentaire:'#34D399', Horreur:'#FB7185', Comédie:'#FDE68A',
  Romance:'#F472B6', Action:'#FB923C', Fantastique:'#C084FC',
  Expérimental:'#67E8F9', Animation:'#4ADE80', Biopic:'#94A3B8',
};
const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
  critic:'Critique', creator:'Créateur·rice', other:'Cinéaste',
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface LocalWork { id:number;title:string;category:string;genre:string;year:number;likes:number;image:string|null;is_original:boolean;duration:number|null;director:string|null }
interface UserReel { id:string;video_url:string;thumbnail_url:string|null;title:string|null;genre:string|null;duration:number|null;status:'pending'|'approved'|'rejected';likes_count:number;views_count:number;created_at:string }
interface ReviewItem { id:string;content:string;rating:number;likes:number;film:{id:string;title:string;genre:string} }
interface VeloceItem { id:string;title:string|null;thumbnail_url:string|null;video_url:string;likes_count:number;views_count:number;genre:string|null }
interface ProfileData { display_name:string;username:string;bio:string;role:string;location:string;avatar_url:string;website:string;is_pro:boolean;is_industry_contact:boolean;specialties:string[];open_to:string[];notable_works:any[];equipment:string;social_instagram:string;social_vimeo:string;social_youtube:string;social_imdb:string;films_seen_count:number;following_count:number }
interface Badge { id:string;label:string;icon:keyof typeof Ionicons.glyphMap;earned:boolean;pts:number;desc:string }
interface GamiStats { watchCount:number;critiqueCount:number;favCount:number;isNight:boolean;streak:number }
type GridTab   = 0|1|2;
type ModalType = 'favorites'|'reviews'|'watched'|'recs'|'creations';

const EMPTY_PROFILE: ProfileData = {
  display_name:'',username:'',bio:'',role:'creator',location:'',avatar_url:'',website:'',
  is_pro:false,is_industry_contact:false,specialties:[],open_to:[],
  notable_works:[],equipment:'',social_instagram:'',social_vimeo:'',social_youtube:'',social_imdb:'',
  films_seen_count:0,following_count:0,
};

// ─── MAPPERS ──────────────────────────────────────────────────────────────────
const mapProfile = (r:any): ProfileData => ({
  display_name:r?.display_name??'',username:r?.username??'',bio:r?.bio??'',role:r?.role??'creator',
  location:r?.location??'',avatar_url:r?.avatar_url??'',website:r?.website??'',
  is_pro:r?.is_pro??false,is_industry_contact:r?.is_industry_contact??false,
  specialties:Array.isArray(r?.specialties)?r.specialties:[],
  open_to:Array.isArray(r?.open_to)?r.open_to:[],notable_works:Array.isArray(r?.notable_works)?r.notable_works:[],
  equipment:r?.equipment??'',social_instagram:r?.social_instagram??'',
  social_vimeo:r?.social_vimeo??'',social_youtube:r?.social_youtube??'',social_imdb:r?.social_imdb??'',
  films_seen_count:Number(r?.films_seen_count)||0,following_count:Number(r?.following_count)||0,
});
const mapWork   = (r:any): LocalWork => ({
  id:Number(r?.id)||0,title:r?.title??'',category:r?.category??'',genre:r?.genre??'',
  year:Number(r?.year)||0,likes:Number(r?.likes)||0,image:r?.image??null,
  is_original:r?.is_original??false,duration:r?.duration!=null?Number(r.duration):null,director:r?.director??null,
});
const mapReel   = (r:any): UserReel => ({
  id:String(r?.id??''),video_url:r?.video_url??'',thumbnail_url:r?.thumbnail_url??null,
  title:r?.title??null,genre:r?.genre??null,duration:r?.duration!=null?Number(r.duration):null,
  status:(['pending','approved','rejected'].includes(r?.status)?r.status:'pending') as any,
  likes_count:Number(r?.likes_count)||0,views_count:Number(r?.views_count)||0,
  created_at:r?.created_at??new Date().toISOString(),
});
const mapVeloce = (r:any): VeloceItem => ({
  id:String(r?.id??''),title:r?.title??null,thumbnail_url:r?.thumbnail_url??null,
  video_url:r?.video_url??'',likes_count:Number(r?.likes_count)||0,
  views_count:Number(r?.views_count)||0,genre:r?.genre??null,
});
const mapReview = (r:any): ReviewItem => ({
  id:String(r?.id??''),content:String(r?.content??r?.contenu??''),
  rating:r?.rating!=null?Number(r.rating):r?.note!=null?Number(r.note):0,
  likes:Number(r?.likes_count??0),
  film:{id:String(r?.reel_id??r?.work_id??r?.id),title:String(r?.film_title??r?.work_title??r?.title??r?.titre??'—'),genre:r?.work_genre??r?.genre??'—'},
});

const resolveImg = (id:number, img:string|null) => {
  if(!img)return`https://picsum.photos/seed/w${id}/400/600`;
  if(img.startsWith('http'))return img;
  try{return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;}
  catch{return`https://picsum.photos/seed/w${id}/400/600`;}
};
const fmt = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(n>=1e4?0:1)}K`:`${n}`;
const momentum = (r:UserReel) => Math.round((r.views_count*0.3+r.likes_count*2)/Math.max(0.5,(Date.now()-new Date(r.created_at).getTime())/86400000));

// ─── FETCH HELPERS ────────────────────────────────────────────────────────────
async function fetchCritiques(uid:string): Promise<ReviewItem[]> {
  try {
    const{data:v,error:vErr}=await supabase.from('v_user_critiques')
      .select('id,user_id,reel_id,work_id,film_title,work_title,title,titre,content,contenu,rating,note,likes_count,work_genre,genre,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false});
    if(!vErr&&v)return v.map(mapReview).sort((a,b)=>(b.likes??0)-(a.likes??0));
  } catch {}
  try {
    const{data:c}=await supabase.from('critiques')
      .select('id,user_id,reel_id,film_title,title,titre,content,contenu,rating,note,likes_count,tags,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false});
    return(c??[]).map(mapReview).sort((a,b)=>(b.likes??0)-(a.likes??0));
  } catch{return[];}
}
async function fetchSeen(uid:string): Promise<{workId:number;watchedAt:string}[]> {
  const{data:sf,error:sfErr}=await supabase.from('seen_films').select('film_id,created_at').eq('user_id',uid);
  if(!sfErr&&sf){const i=sf.map((r:any)=>({workId:Number(r.film_id),watchedAt:r.created_at??''})).filter(r=>r.workId>0);if(i.length>0)return i;}
  const{data:usf,error:usfErr}=await supabase.from('user_seen_films').select('film_id,created_at').eq('user_id',uid);
  if(!usfErr&&usf){const i=usf.map((r:any)=>({workId:Number(r.film_id),watchedAt:r.created_at??''})).filter(r=>r.workId>0);if(i.length>0)return i;}
  const{data:uh}=await supabase.from('user_history').select('work_id,watched_at').eq('user_id',uid).order('watched_at',{ascending:false});
  return(uh??[]).map((r:any)=>({workId:Number(r.work_id),watchedAt:r.watched_at??''})).filter(r=>r.workId>0);
}

// ─── GAMIFICATION LOCALE (badges activité + score strip) ─────────────────────
function buildBadges(s:GamiStats): Badge[] {
  return [
    {id:'explorer', label:'Explorateur',  icon:'compass-outline',  earned:s.watchCount>=5,    pts:15, desc:'5 œuvres visionnées'  },
    {id:'nocturne', label:'Insomniaque',   icon:'moon-outline',     earned:s.isNight,           pts:5,  desc:'Actif entre 22h et 4h'},
    {id:'critique', label:'Critique',      icon:'create-outline',   earned:s.critiqueCount>=5, pts:40, desc:'5 critiques publiées'  },
    {id:'curateur', label:'Curateur',      icon:'bookmark-outline', earned:s.favCount>=10,     pts:20, desc:'10 favoris sauvegardés'},
    {id:'omnivore', label:'Omnivore',      icon:'layers-outline',   earned:s.watchCount>=15,   pts:25, desc:'15 œuvres visionnées'  },
    {id:'streak',   label:'Habitué',       icon:'flame-outline',    earned:s.streak>=3,         pts:10, desc:'3 sessions consécutives'},
  ];
}
function cinephileLevel(score:number):{n:number;label:string;pct:number;nextAt:number} {
  const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];
  const cur=[...L].reverse().find(x=>score>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===cur.n)+1;
  const nxt=L[ni]??L[L.length-1];
  return{n:cur.n,label:cur.l,pct:cur.n===5?1:Math.min(1,(score-cur.at)/(nxt.at-cur.at)),nextAt:nxt.at};
}
function useLocalGamification(uid:string|null) {
  const[stats,setStats]=useState<GamiStats>({watchCount:0,critiqueCount:0,favCount:0,isNight:false,streak:0});
  useEffect(()=>{
    if(!uid)return;
    const isNight=new Date().getHours()>=22||new Date().getHours()<4;
    Promise.all([
      supabase.from('user_history').select('work_id',{count:'exact',head:true}).eq('user_id',uid),
      supabase.from('critiques').select('id',{count:'exact',head:true}).eq('user_id',uid),
      supabase.from('user_favorites').select('work_id',{count:'exact',head:true}).eq('user_id',uid),
    ]).then(([h,c,f])=>setStats(p=>({watchCount:h.count??0,critiqueCount:c.count??0,favCount:f.count??0,isNight,streak:p.streak+1}))).catch(()=>{});
  },[uid]);
  const score  = useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+(stats.isNight?5:0)+(stats.streak>=3?10:0),[stats]);
  const level  = useMemo(()=>cinephileLevel(score),[score]);
  const badges = useMemo(()=>buildBadges(stats),[stats]);
  return{score,level,badges};
}

// ─── GALAXY ANIMATION PRIMITIVES ─────────────────────────────────────────────
function useGalaxyTap() {
  const ring=useRef(new Animated.Value(0)).current,ringOp=useRef(new Animated.Value(0)).current,glow=useRef(new Animated.Value(0)).current;
  const fire=useCallback(()=>{ring.setValue(0.25);ringOp.setValue(0.85);glow.setValue(1);Animated.parallel([Animated.timing(ring,{toValue:2.4,duration:500,easing:Easing.out(Easing.cubic),useNativeDriver:true}),Animated.timing(ringOp,{toValue:0,duration:500,useNativeDriver:true}),Animated.timing(glow,{toValue:0,duration:600,useNativeDriver:false})]).start();},[]);
  return{fire,ring,ringOp,glow};
}

// ─── MICRO UI ─────────────────────────────────────────────────────────────────
const Shimmer = memo(({w,h,r=8}:{w:number;h:number;r?:number}) => {
  const op=useRef(new Animated.Value(0.12)).current;
  useEffect(()=>{const l=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.30,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.12,duration:900,useNativeDriver:true})]));l.start();return()=>l.stop();},[]);
  return<Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});
const HRow  = memo(({c,pb=0}:{c:React.ReactNode;pb?:number}) => <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,paddingBottom:pb}}>{c}</ScrollView>);
const Div   = memo(() => <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:22}}/>);
const SecHead = memo(({icon,label,count,onMore}:{icon:keyof typeof Ionicons.glyphMap;label:string;count?:number;onMore?:()=>void}) => (
  <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:22,paddingBottom:12,gap:7}}>
    <Ionicons name={icon} size={13} color={C.mid}/>
    <Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2,flex:1}}>{label}</Text>
    {count!=null&&<View style={sh.pill}><Text style={sh.pillTxt}>{count}</Text></View>}
    {onMore&&<TouchableOpacity onPress={onMore} hitSlop={8} style={sh.btn}><Text style={sh.btnTxt}>Tout voir</Text><Ionicons name="chevron-forward" size={11} color={C.blue}/></TouchableOpacity>}
  </View>
));
const sh = StyleSheet.create({
  pill:   {paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  pillTxt:{color:C.muted,fontSize:9,fontWeight:'700'},
  btn:    {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:C.blueDim,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(90,150,230,0.20)'},
  btnTxt: {color:C.blue,fontSize:11,fontWeight:'700'},
});
const Empty = memo(({icon,text,sub}:{icon:keyof typeof Ionicons.glyphMap;text:string;sub?:string}) => (
  <View style={{alignItems:'center',paddingVertical:32,gap:8}}>
    <View style={{width:52,height:52,borderRadius:26,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}>
      <Ionicons name={icon} size={22} color={C.muted}/>
    </View>
    <Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>{text}</Text>
    {!!sub&&<Text style={{color:C.muted,fontSize:11,textAlign:'center',lineHeight:17,paddingHorizontal:H_PAD}}>{sub}</Text>}
  </View>
));

// ════════════════════════════════════════════════════════════════════════════
// ★ PROFILE HEADER — redesigné : aéré, gamiProfile depuis GamificationSystem
//   Avatar tap → édition implicite (pas de bouton edit dans la top bar)
// ════════════════════════════════════════════════════════════════════════════
const AVATAR_SIZE = 90;
const RING_SIZE   = AVATAR_SIZE;

const ProfileHeader = memo(function ProfileHeader({
  profile, filmCount, critiqueCount, reelCount, followersCount,
  gamiProfile, showLevel,
  streak,
  onAvatarEdit, onAdmin, onSettings,
}:{
  profile:ProfileData; filmCount:number; critiqueCount:number; reelCount:number; followersCount:number;
  gamiProfile:GamiProfile; showLevel:boolean;
  streak:number;
  onAvatarEdit:()=>void; onAdmin:()=>void; onSettings:()=>void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const glowAnim = useRef(new Animated.Value(0.30)).current;
  const ringAnim = useRef(new Animated.Value(1)).current;

  useEffect(()=>setImgErr(false),[profile.avatar_url]);

  useEffect(()=>{
    const gl = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim,{toValue:0.92,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(glowAnim,{toValue:0.30,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    const rg = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim,{toValue:1.04,duration:3200,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(ringAnim,{toValue:1,   duration:3200,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    gl.start(); rg.start();
    return()=>{gl.stop();rg.stop();};
  },[]);

  // Pré-calcul strings (perf)
  const dn    = profile.display_name || profile.username || 'Cinéphile';
  const init  = dn.trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const links = useMemo(()=>[
    {k:'ig',icon:'logo-instagram' as const,url:profile.social_instagram,label:'Instagram'},
    {k:'vi',icon:'videocam-outline' as const,url:profile.social_vimeo,label:'Vimeo'},
    {k:'yt',icon:'logo-youtube' as const,url:profile.social_youtube,label:'YouTube'},
    {k:'ws',icon:'globe-outline' as const,url:profile.website,label:'Portfolio'},
  ].filter(l=>!!l.url),[profile.social_instagram,profile.social_vimeo,profile.social_youtube,profile.website]);

  const ringScale = ringAnim;

  // Couleur accent par niveau (GamificationSystem)
  const levelColor = useMemo(()=>{
    const l = gamiProfile.level;
    if(l>=9)return C.gold;
    if(l>=7)return'#C084FC';
    if(l>=5)return C.blue;
    return C.mid;
  },[gamiProfile.level]);

  const lvlStr = String(gamiProfile.level);
  const subLine = [profile.username&&`@${profile.username}`,profile.location].filter(Boolean).join(' · ');

  return (
    <View style={ph.root}>
      {/* ── Top bar : UNIVERSE · role · [backoffice | settings] ── */}
      <View style={ph.topBar}>
        <View style={ph.topLeft}>
          <Text style={ph.brand}>UNIVERSE</Text>
          <View style={ph.dot}/>
          <Text style={ph.roleChip}>{ROLE_LABELS[profile.role] ?? 'Cinéaste'}</Text>
        </View>
        <View style={ph.actions}>
          <TouchableOpacity style={ph.btnBackoffice} onPress={onAdmin} activeOpacity={0.80}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.blue}/>
          </TouchableOpacity>
          <TouchableOpacity style={ph.btn} onPress={onSettings} activeOpacity={0.80}>
            <Ionicons name="settings-outline" size={16} color={C.mid}/>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Identité : avatar + infos principales — hauteur fixe ── */}
      <View style={ph.identRow}>
        {/* Avatar — tap implicite → édition */}
        <TouchableOpacity onPress={onAvatarEdit} activeOpacity={0.82} style={{flexShrink:0}}>
          <View style={{position:'relative',width:RING_SIZE,height:RING_SIZE,alignItems:'center',justifyContent:'center'}}>
            {/* Ring pulsant */}
            <Animated.View style={[ph.ring,{
              borderColor:`${levelColor}55`,
              transform:[{scale:ringScale}],
              opacity:glowAnim,
            }]}/>
            {/* Avatar image / fallback */}
            {profile.avatar_url&&!imgErr
              ? <Image source={{uri:profile.avatar_url}} style={ph.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
              : <View style={[ph.avatar,ph.avatarFb]}><Text style={ph.avatarInit}>{init}</Text></View>
            }
            {/* Badge PRO — seul badge sur l'avatar désormais */}
            {profile.is_pro&&<View style={ph.proBadge}><Text style={ph.proBadgeTxt}>PRO</Text></View>}
          </View>
        </TouchableOpacity>

        {/* Infos identité — chaque ligne réserve une hauteur fixe, qu'elle ait du contenu ou non */}
        <View style={ph.infoCol}>
          <View style={ph.nameRow}>
            <Text style={ph.name} numberOfLines={1}>{dn}</Text>
            {profile.is_industry_contact&&<View style={ph.indBadge}><Text style={ph.indTxt}>INDUSTRIE</Text></View>}
            {streak>=3&&<View style={ph.streakBadge}>
              <Ionicons name="flame-outline" size={9} color={C.gold}/>
              <Text style={[ph.indTxt,{color:C.gold}]}>{streak}J</Text>
            </View>}
          </View>

          <View style={ph.subLine}>
            {!!subLine&&<Text style={ph.sub} numberOfLines={1}>{subLine}</Text>}
          </View>

          {/* Stats principales + réseaux (icônes fixes) sur une seule ligne */}
          <View style={ph.statsRow}>
            <Text style={ph.statTxt}><Text style={ph.statNum}>{reelCount}</Text> Créations</Text>
            <Text style={ph.statTxt}>·</Text>
            <Text style={ph.statTxt}><Text style={ph.statNum}>{followersCount}</Text> Abonnés</Text>
            {links.length>0&&(
              <View style={ph.socialRow}>
                {links.map(l=>(
                  <TouchableOpacity key={l.k} style={ph.socialIcon} onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}>
                    <Ionicons name={l.icon} size={11} color={C.mid}/>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={ph.bioLine}>
            {!!profile.bio&&<Text style={ph.bio} numberOfLines={1}>{profile.bio}</Text>}
          </View>
        </View>

     
      </View>
    </View>
  );
});

const ph = StyleSheet.create({
  root:       {position:'relative'},
  // Top bar — UX/UI identique aux icônes pro/notifications de social.tsx
  topBar:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:6,paddingBottom:12},
  topLeft:    {flexDirection:'row',alignItems:'center',gap:5},
  brand:      {color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:2.5,textTransform:'uppercase'},
  dot:        {width:2,height:8,backgroundColor:C.faint,borderRadius:1},
  roleChip:   {color:C.muted,fontSize:9,fontWeight:'600',letterSpacing:0.3},
  actions:    {flexDirection:'row',gap:7},
  btn:        {width:36,height:36,borderRadius:18,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',position:'relative'},
  btnBackoffice:{width:36,height:36,borderRadius:18,backgroundColor:'rgba(90,150,230,0.10)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(90,150,230,0.25)',alignItems:'center',justifyContent:'center',position:'relative'},
  // Identity row — hauteur fixe (gouvernée par l'avatar 90px), relative pour ancrer le badge niveau
  identRow:   {position:'relative',flexDirection:'row',alignItems:'flex-start',paddingHorizontal:H_PAD,marginBottom:14,gap:16},
  // Avatar
  ring:       {position:'absolute',top:0,left:0,right:0,bottom:0,width:RING_SIZE,height:RING_SIZE,borderRadius:RING_SIZE/2,borderWidth:1.5},
  avatar:     {width:AVATAR_SIZE,height:AVATAR_SIZE,borderRadius:AVATAR_SIZE/2,backgroundColor:C.navyMid},
  avatarFb:   {alignItems:'center',justifyContent:'center'},
  avatarInit: {color:C.white,fontSize:26,fontWeight:'900'},
  proBadge:   {position:'absolute',bottom:2,right:-4,paddingHorizontal:5,paddingVertical:2,borderRadius:4,
    backgroundColor:C.navyDark,borderWidth:1,borderColor:C.borderHi},
  proBadgeTxt:{color:C.offWhite,fontSize:6.5,fontWeight:'900',letterSpacing:0.6},
  // Info column — chaque ligne a une hauteur fixe réservée ; paddingRight constant
  // (que showLevel soit actif ou non) pour que le badge niveau n'empiète jamais
  // sur le nom et ne fasse varier aucune mise en page au toggle.
  infoCol:    {flex:1,paddingTop:2,paddingRight:56},
  nameRow:    {height:24,flexDirection:'row',alignItems:'center',gap:6},
  name:       {color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4,flexShrink:1},
  indBadge:   {paddingHorizontal:6,paddingVertical:2,borderRadius:5,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid},
  indTxt:     {color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:0.5},
  streakBadge:{flexDirection:'row',alignItems:'center',gap:2,paddingHorizontal:6,paddingVertical:2,borderRadius:5,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.28)',backgroundColor:'rgba(245,200,66,0.07)'},
  subLine:    {height:15,justifyContent:'center'},
  sub:        {color:C.muted,fontSize:10.5,fontWeight:'500'},
  statsRow:   {height:20,flexDirection:'row',alignItems:'center',gap:8},
  statTxt:    {color:C.muted,fontSize:10.5,fontWeight:'500'},
  statNum:    {color:C.white,fontSize:10.5,fontWeight:'800'},
  socialRow:  {flexDirection:'row',alignItems:'center',gap:6,marginLeft:2},
  socialIcon: {width:20,height:20,borderRadius:10,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  bioLine:    {height:17,justifyContent:'center',marginTop:2},
  bio:        {color:C.mid,fontSize:12,lineHeight:16},
  // Niveau discreet — ancré à identRow (loin des icônes du haut), jamais la hauteur ne varie
  levelAbs:   {position:'absolute',top:0,right:0,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:3,borderRadius:8,borderWidth:StyleSheet.hairlineWidth},
  levelAbsTxt:{fontSize:9,fontWeight:'800',letterSpacing:0.3},
});

// ─── ★ SCORE STRIP ────────────────────────────────────────────────────────────
const ScoreStrip = memo(function ScoreStrip({
  score, level, badges,
}:{score:number;level:ReturnType<typeof cinephileLevel>;badges:Badge[]}) {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:1200,useNativeDriver:false}).start();},[level.pct]);
  const barW   = prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
  const earned = badges.filter(b=>b.earned).length;
  const ptsLeft  = Math.max(0,level.nextAt-score);
  const scoreStr = `${fmt(score)} pts`;
  const earnedStr = `${earned}/${badges.length}`;
  const nextStr  = `${fmt(ptsLeft)} pts → niv.${level.n+1}`;
  return(
    <View style={ss.row}>
      <View style={ss.scoreCircle}>
        <Text style={ss.scoreNum}>{fmt(score)}</Text>
        <Text style={ss.scoreLbl}>PTS</Text>
      </View>
      <View style={{flex:1,gap:0}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Text style={ss.levelTxt}>Activité Niv.{level.n}</Text>
          <View style={ss.levelPill}><Text style={ss.levelPillTxt}>{level.label}</Text></View>
          <View style={ss.badgePill}><Ionicons name="ribbon-outline" size={9} color={C.gold}/><Text style={ss.badgePillTxt}>{earnedStr}</Text></View>
        </View>
        <View style={ss.xpTrack}><Animated.View style={[ss.xpFill,{width:barW}]}/></View>
        {level.n<5?<Text style={ss.xpHint}>{nextStr}</Text>:<Text style={[ss.xpHint,{color:C.gold}]}>Maximum ✦</Text>}
      </View>
    </View>
  );
});
const ss = StyleSheet.create({
  row:         {flexDirection:'row',alignItems:'center',gap:14,marginHorizontal:H_PAD,marginBottom:4,padding:14,borderRadius:14,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  scoreCircle: {width:54,height:54,borderRadius:27,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
  scoreNum:    {color:C.white,fontSize:14,fontWeight:'900',letterSpacing:-0.5},
  scoreLbl:    {color:C.muted,fontSize:6.5,fontWeight:'800',letterSpacing:1.5,marginTop:-2},
  levelTxt:    {color:C.mid,fontSize:11,fontWeight:'700'},
  levelPill:   {paddingHorizontal:7,paddingVertical:2,borderRadius:7,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid},
  levelPillTxt:{color:C.offWhite,fontSize:9,fontWeight:'700'},
  badgePill:   {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:C.goldDim,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.25)'},
  badgePillTxt:{color:C.gold,fontSize:8,fontWeight:'700'},
  xpTrack:     {height:3,borderRadius:1.5,backgroundColor:C.faint,overflow:'hidden'},
  xpFill:      {height:'100%',borderRadius:1.5,backgroundColor:C.white},
  xpHint:      {color:C.muted,fontSize:9,fontWeight:'600'},
});

// ─── ★ BADGE INTERACTIF ───────────────────────────────────────────────────────
const IBadge = memo(function IBadge({b}:{b:Badge}) {
  const[open,setOpen]=useState(false);
  const sc=useRef(new Animated.Value(1)).current;
  const press=()=>{
    Animated.sequence([Animated.spring(sc,{toValue:0.88,tension:350,friction:7,useNativeDriver:true}),Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();
    setOpen(v=>!v);
  };
  const ptsStr=`+${b.pts}pts`;
  return(
    <Animated.View style={{transform:[{scale:sc}]}}>
      <TouchableOpacity onPress={press} activeOpacity={0.85} style={[ib.wrap,b.earned&&ib.wrapOn,open&&ib.wrapExpanded]}>
        <View style={[ib.icon,b.earned&&ib.iconOn]}><Ionicons name={b.icon} size={16} color={b.earned?C.white:C.muted}/></View>
        <Text style={[ib.label,b.earned&&{color:C.white}]} numberOfLines={open?undefined:2}>{b.label}</Text>
        {b.earned?<Text style={ib.pts}>{ptsStr}</Text>:<View style={{position:'absolute',top:6,right:6}}><Ionicons name="lock-closed" size={7} color={C.muted}/></View>}
        {open&&<Text style={ib.desc}>{b.desc}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
});
const ib = StyleSheet.create({
  wrap:        {alignItems:'center',gap:5,padding:10,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:86,opacity:0.52},
  wrapOn:      {opacity:1,borderColor:C.borderHi,backgroundColor:C.subtle},
  wrapExpanded:{width:108},
  icon:        {width:34,height:34,borderRadius:17,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  iconOn:      {borderColor:C.borderHi},
  label:       {color:C.muted,fontSize:9,fontWeight:'600',textAlign:'center',lineHeight:11},
  pts:         {color:C.gold,fontSize:8,fontWeight:'800'},
  desc:        {color:C.muted,fontSize:8,textAlign:'center',lineHeight:11,marginTop:2},
});

// ─── CARDS ────────────────────────────────────────────────────────────────────
const PortraitCard = memo(({item,rank}:{item:LocalWork;rank?:number}) => {
  const router=useRouter(),uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={ptc.card}>
        <Image source={{uri}} style={ptc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
        <View style={ptc.badge}><Text style={ptc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>
        {rank!=null&&<Text style={ptc.rank}>{rank}</Text>}
        <View style={ptc.meta}><Text style={ptc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={ptc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>{item.year>0&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={ptc.stat}>{item.year}</Text></>}</View></View>
      </View>
    </TouchableOpacity>
  );
});
const ptc=StyleSheet.create({card:{width:CARD_W,height:CARD_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:CARD_W,height:CARD_H},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},rank:{position:'absolute',bottom:45,right:5,fontSize:44,fontWeight:'900',lineHeight:44,letterSpacing:-3,color:'rgba(255, 255, 255, 0.55)'},meta:{position:'absolute',bottom:7,left:8,right:8,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

const WorkGridCard=memo(({item,onPress}:{item:LocalWork;onPress:()=>void})=>{const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);return(<TouchableOpacity style={gc.card} onPress={onPress} activeOpacity={0.88}><Image source={{uri}} style={gc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={gc.badge}><Text style={gc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View><View style={gc.meta}>{item.genre?<Text style={gc.genre}>{item.genre.toUpperCase()}</Text>:null}<Text style={gc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5,marginTop:2}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={gc.stat}>{fmt(item.likes??0)}</Text>{item.year>0&&<><Text style={{color:C.muted,fontSize:9}}>·</Text><Text style={gc.stat}>{item.year}</Text></>}</View></View></TouchableOpacity>);});
const gc=StyleSheet.create({card:{width:GRID_COL,height:GRID_COL*1.5,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',position:'absolute'},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},meta:{position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},genre:{color:C.muted,fontSize:8,fontWeight:'700',letterSpacing:0.8},title:{color:C.white,fontSize:12,fontWeight:'800',lineHeight:16},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});
const CritiqueGridCard=memo(({r,rank,onPress}:{r:ReviewItem;rank:number;onPress:()=>void})=>{const stars=Math.round(r.rating??0);return(<TouchableOpacity style={cgc.card} onPress={onPress} activeOpacity={0.88}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><View style={{position:'absolute',top:9,left:9,paddingHorizontal:7,paddingVertical:3,borderRadius:7,backgroundColor:C.navyDark}}><Text style={{color:C.mid,fontSize:9,fontWeight:'800'}}>#{rank}</Text></View>{r.likes>0&&<View style={{position:'absolute',top:9,right:9,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.navyDark}}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:8,fontWeight:'700'}}>{fmt(r.likes)}</Text></View>}<View style={{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:3}}><Text style={{color:C.white,fontSize:12,fontWeight:'800',letterSpacing:-0.2}} numberOfLines={1}>{r.film?.title??'—'}</Text><View style={{flexDirection:'row',gap:2}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle}/>)}</View><Text style={{color:C.muted,fontSize:10,lineHeight:13}} numberOfLines={2}>{r.content||'—'}</Text></View><View style={{...StyleSheet.absoluteFillObject,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} pointerEvents="none"/></TouchableOpacity>);});
const cgc=StyleSheet.create({card:{width:GRID_COL,height:GRID_COL*1.1,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid}});
const CritCard=memo(({r,rank,onPress}:{r:ReviewItem;rank:number;onPress:()=>void})=>{const stars=Math.round(r.rating??0);return(<TouchableOpacity style={{marginRight:10}} onPress={onPress} activeOpacity={0.88}><View style={{width:CRIT_W,height:CRIT_H,borderRadius:14,overflow:'hidden'}}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><View style={{position:'absolute',top:9,left:9,paddingHorizontal:7,paddingVertical:3,borderRadius:7,backgroundColor:C.navyDark}}><Text style={{color:C.mid,fontSize:9,fontWeight:'800'}}>#{rank}</Text></View>{r.likes>0&&<View style={{position:'absolute',top:9,right:9,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.navyDark}}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:8,fontWeight:'700'}}>{fmt(r.likes)}</Text></View>}<View style={{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:3}}><Text style={{color:C.white,fontSize:12,fontWeight:'800',letterSpacing:-0.2}} numberOfLines={1}>{r.film?.title??'—'}</Text><View style={{flexDirection:'row',gap:2}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle}/>)}</View><Text style={{color:C.muted,fontSize:10,lineHeight:13}} numberOfLines={2}>{r.content||'—'}</Text></View><View style={{...StyleSheet.absoluteFillObject,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} pointerEvents="none"/></View></TouchableOpacity>);});

const VideoThumbnails:any=Platform.select({native:()=>{try{return require('expo-video-thumbnails');}catch{return null;}},default:()=>null})?.()??null;
function useThumb(url:string,thumb:string|null):string|null{const[uri,setUri]=useState<string|null>(thumb??null);useEffect(()=>{if(thumb||!url||!VideoThumbnails)return;let ok=true;VideoThumbnails.getThumbnailAsync(url,{time:1500,quality:0.65}).then(({uri:u}:{uri:string})=>{if(ok)setUri(u);}).catch(()=>{});return()=>{ok=false;};},[url,thumb]);return uri;}
const STATUS_CFG:Record<string,{icon:keyof typeof Ionicons.glyphMap;label:string}>={pending:{icon:'time-outline',label:'En attente'},approved:{icon:'checkmark-circle-outline',label:'Validée'},rejected:{icon:'close-circle-outline',label:'Refusée'}};
const ReelCard=memo(({reel,isHot}:{reel:UserReel;isHot:boolean})=>{const router=useRouter(),thumb=useThumb(reel.video_url,reel.thumbnail_url),cfg=STATUS_CFG[reel.status]??STATUS_CFG.pending,[err,setErr]=useState(false),m=momentum(reel);return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push({pathname:'/reel/[id]',params:{id:reel.id}} as any)} activeOpacity={0.88}><View style={rlc.card}>{thumb&&!err?<Image source={{uri:thumb}} style={rlc.img} resizeMode="cover" onError={()=>setErr(true)}/>:<View style={rlc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="film-outline" size={24} color={C.subtle}/></View>}<LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/><View style={{position:'absolute',top:'38%',alignSelf:'center',marginTop:-13}} pointerEvents="none"><Ionicons name="play-circle-outline" size={26} color={C.mid}/></View><View style={rlc.status}><Ionicons name={cfg.icon} size={9} color={C.mid}/><Text style={rlc.stTxt}>{cfg.label}</Text></View>{(isHot||reel.views_count>=10)&&<View style={rlc.mom}><Ionicons name={isHot?'flame-outline':'trending-up-outline'} size={8} color={C.mid}/><Text style={rlc.momTxt}>{isHot?'EN HAUSSE':`${fmt(reel.views_count)} vues`}</Text></View>}<View style={rlc.meta}><Text style={rlc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text><View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:2}}><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="eye-outline" size={8} color={C.muted}/><Text style={rlc.stTxt}>{fmt(reel.views_count)}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="heart-outline" size={8} color={C.muted}/><Text style={rlc.stTxt}>{fmt(reel.likes_count)}</Text></View>{m>0&&<Text style={{marginLeft:'auto' as any,color:C.muted,fontSize:7,fontWeight:'700'}}>{m}pts/j</Text>}</View></View></View></TouchableOpacity>);});
const rlc=StyleSheet.create({card:{width:REEL_W,height:REEL_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:REEL_W,height:REEL_H},ph:{width:REEL_W,height:REEL_H,alignItems:'center',justifyContent:'center'},status:{position:'absolute',top:8,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.72)'},stTxt:{color:C.muted,fontSize:7.5,fontWeight:'700'},mom:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:'rgba(7,12,23,0.82)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},momTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},meta:{position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},title:{color:C.white,fontSize:10.5,fontWeight:'800',lineHeight:13}});
const ReelGridCard=memo(({reel,isHot,onPress}:{reel:UserReel;isHot:boolean;onPress:()=>void})=>{const thumb=useThumb(reel.video_url,reel.thumbnail_url);const[err,setErr]=useState(false);const cfg=STATUS_CFG[reel.status]??STATUS_CFG.pending;return(<TouchableOpacity style={rgc.card} onPress={onPress} activeOpacity={0.88}>{thumb&&!err?<Image source={{uri:thumb}} style={rgc.img} resizeMode="cover" onError={()=>setErr(true)}/>:<View style={rgc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="film-outline" size={22} color={C.subtle}/></View>}<LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/><View style={rgc.status}><Ionicons name={cfg.icon} size={9} color={C.mid}/><Text style={rgc.stTxt}>{cfg.label}</Text></View>{isHot&&<View style={rgc.hot}><Ionicons name="flame-outline" size={8} color={C.mid}/></View>}<View style={rgc.meta}><Text style={rgc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text><View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}><View style={{flexDirection:'row',alignItems:'center',gap:2}}><Ionicons name="eye-outline" size={8} color={C.muted}/><Text style={rgc.stat}>{fmt(reel.views_count)}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:2}}><Ionicons name="heart-outline" size={8} color={C.muted}/><Text style={rgc.stat}>{fmt(reel.likes_count)}</Text></View></View></View></TouchableOpacity>);});
const rgc=StyleSheet.create({card:{width:GRID_COL,height:GRID_COL*1.4,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',position:'absolute'},ph:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},status:{position:'absolute',top:8,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.72)'},stTxt:{color:C.muted,fontSize:7.5,fontWeight:'700'},hot:{position:'absolute',top:8,right:8,width:22,height:22,borderRadius:11,backgroundColor:'rgba(7,12,23,0.72)',alignItems:'center',justifyContent:'center'},meta:{position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},title:{color:C.white,fontSize:11,fontWeight:'800',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

// ─── ★ VELOCE CARD ────────────────────────────────────────────────────────────
const VeloceCard=memo(function VeloceCard({item}:{item:VeloceItem}){
  const router=useRouter();const[err,setErr]=useState(false);
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push({pathname:'/reel/[id]',params:{id:item.id}} as any)} activeOpacity={0.88}>
      <View style={vc.card}>
        {item.thumbnail_url&&!err
          ?<Image source={{uri:item.thumbnail_url}} style={vc.img} resizeMode="cover" onError={()=>setErr(true)}/>
          :<View style={vc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="play-circle-outline" size={22} color={C.subtle}/></View>
        }
        <LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
        <View style={vc.meta}>
          {!!item.genre&&<Text style={vc.genre}>{item.genre.toUpperCase()}</Text>}
          <Text style={vc.title} numberOfLines={2}>{item.title||'Sans titre'}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="heart" size={8} color={C.muted}/><Text style={vc.stat}>{fmt(item.likes_count)}</Text></View>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="eye-outline" size={8} color={C.muted}/><Text style={vc.stat}>{fmt(item.views_count)}</Text></View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const vc=StyleSheet.create({
  card:{width:REEL_W,height:REEL_H,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid},
  img:{width:REEL_W,height:REEL_H},
  ph:{width:REEL_W,height:REEL_H,alignItems:'center',justifyContent:'center'},
  genre:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:0.8,marginBottom:1},
  meta:{position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},
  title:{color:C.white,fontSize:10.5,fontWeight:'800',lineHeight:13},
  stat:{color:C.muted,fontSize:8,fontWeight:'600'},
});

// ─── SEE ALL MODAL ────────────────────────────────────────────────────────────
interface SeeAllModalProps{visible:boolean;onClose:()=>void;type:ModalType;title:string;icon:keyof typeof Ionicons.glyphMap;works?:LocalWork[];reviews?:ReviewItem[];reels?:UserReel[];hotReelId?:string|null}
const SeeAllModal=memo(function SeeAllModal({visible,onClose,type,title,icon,works=[],reviews=[],reels=[],hotReelId=null}:SeeAllModalProps){
  const router=useRouter(),insets=useSafeAreaInsets(),[q,setQ]=useState('');
  const inputRef=useRef<TextInput>(null),slideY=useRef(new Animated.Value(600)).current;
  useEffect(()=>{if(visible){setQ('');Animated.spring(slideY,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start();setTimeout(()=>inputRef.current?.focus(),280);}else{Animated.timing(slideY,{toValue:600,duration:210,useNativeDriver:true}).start();}},[visible,slideY]);
  const fW=useMemo(()=>q.trim()?works.filter(w=>w.title.toLowerCase().includes(q.toLowerCase())||(w.genre??'').toLowerCase().includes(q.toLowerCase())):works,[works,q]);
  const fR=useMemo(()=>q.trim()?reviews.filter(r=>r.film?.title.toLowerCase().includes(q.toLowerCase())||r.content.toLowerCase().includes(q.toLowerCase())):reviews,[reviews,q]);
  const fRl=useMemo(()=>q.trim()?reels.filter(r=>(r.title??'').toLowerCase().includes(q.toLowerCase())):reels,[reels,q]);
  const count=type==='reviews'?fR.length:type==='creations'?fRl.length:fW.length;
  const renderWork=useCallback(({item}:{item:LocalWork})=><WorkGridCard item={item} onPress={()=>{onClose();router.push(`/film/${item.id}` as any);}}/>,[router,onClose]);
  const renderRev=useCallback(({item,index}:{item:ReviewItem;index:number})=><CritiqueGridCard r={item} rank={index+1} onPress={()=>{onClose();router.push(`/review/${item.id}` as any);}}/>,[router,onClose]);
  const renderReel=useCallback(({item}:{item:UserReel})=><ReelGridCard reel={item} isHot={item.id===hotReelId} onPress={()=>{onClose();router.push({pathname:'/reel/[id]',params:{id:item.id}} as any);}}/>,[router,onClose,hotReelId]);
  if(!visible)return null;
  return(<Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><Animated.View style={[sam.root,{transform:[{translateY:slideY}]}]}><View style={[sam.topBar,{paddingTop:insets.top+10}]}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name={icon} size={15} color={C.muted}/><Text style={sam.title}>{title}</Text></View><TouchableOpacity onPress={onClose}><Text style={sam.close}>Fermer</Text></TouchableOpacity></View><View style={sam.inputWrap}><Ionicons name="search-outline" size={14} color={C.muted}/><TextInput ref={inputRef} style={sam.input} value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"/></View><Text style={sam.count}>{count} résultat{count!==1?'s':''}{q.trim()?` · «${q.trim()}»`:''}</Text>{count===0?<View style={sam.empty}><Ionicons name="search-outline" size={36} color={C.muted}/><Text style={{color:C.mid,fontSize:14,fontWeight:'600'}}>Aucun résultat</Text></View>:type==='reviews'?<FlatList data={fR} keyExtractor={r=>`r_${r.id}`} renderItem={renderRev} numColumns={2} columnWrapperStyle={sam.col} contentContainerStyle={[sam.list,{paddingBottom:insets.bottom+40}]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8}/>:type==='creations'?<FlatList data={fRl} keyExtractor={r=>`rl_${r.id}`} renderItem={renderReel} numColumns={2} columnWrapperStyle={sam.col} contentContainerStyle={[sam.list,{paddingBottom:insets.bottom+40}]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8}/>:<FlatList data={fW} keyExtractor={w=>`w_${w.id}`} renderItem={renderWork} numColumns={2} columnWrapperStyle={sam.col} contentContainerStyle={[sam.list,{paddingBottom:insets.bottom+40}]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8}/>}</Animated.View></Modal>);
});
const sam=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:10},title:{color:C.white,fontSize:16,fontWeight:'800',letterSpacing:-0.3},close:{color:C.muted,fontSize:14,fontWeight:'600'},inputWrap:{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:16,marginBottom:8,paddingHorizontal:14,height:42,borderRadius:13,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},input:{flex:1,color:C.white,fontSize:14},count:{color:C.muted,fontSize:10,paddingHorizontal:16,marginBottom:12},col:{justifyContent:'space-between',gap:GRID_GAP,marginBottom:GRID_GAP},list:{paddingHorizontal:16},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:10,paddingBottom:80}});

// ─── ★ CINEMA — composants réactifs avec interactions galaxie ─────────────────
const AnimBar = memo(({value,max,color='rgba(255,255,255,0.45)',h=4}:{value:number;max:number;color?:string;h?:number}) => {
  const pct=max>0?value/max:0,prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:pct,duration:800,useNativeDriver:false}).start();},[pct]);
  return(<View style={{flex:1,height:h,borderRadius:h/2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:h/2,backgroundColor:color,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View>);
});
const GenreRowGalaxy=memo(function GenreRowGalaxy({genre,count,max}:{genre:string;count:number;max:number}){
  const[detail,setDetail]=useState(false);const{fire,glow}=useGalaxyTap();const iconScale=useRef(new Animated.Value(1)).current;const color=GENRE_COLORS[genre]??'rgba(255,255,255,0.45)';const icon=GENRE_ICONS[genre]??'film-outline';const pct=max>0?Math.round(count/max*100):0;
  const handleTap=()=>{setDetail(v=>!v);fire();Animated.sequence([Animated.spring(iconScale,{toValue:1.45,tension:350,friction:6,useNativeDriver:true}),Animated.spring(iconScale,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();};
  const rowBg=glow.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0)','rgba(245,200,66,0.09)']});
  return(<TouchableOpacity onPress={handleTap} activeOpacity={0.80}><Animated.View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:7,paddingHorizontal:8,borderRadius:10,backgroundColor:rowBg}}><Animated.View style={{transform:[{scale:iconScale}]}  }><Ionicons name={icon} size={13} color={color}/></Animated.View><Text style={{width:108,color:C.mid,fontSize:11,fontWeight:'600'}}>{genre}</Text><AnimBar value={count} max={max} color={color}/><Text style={{color:C.muted,fontSize:10,fontWeight:'700',width:22,textAlign:'right'}}>{count}</Text></Animated.View>{detail&&<View style={{paddingLeft:34,paddingRight:8,paddingBottom:6}}><Text style={{color:C.muted,fontSize:9,lineHeight:13}}>{count} film{count>1?'s':''} · {pct}% de ta filmothèque</Text></View>}</TouchableOpacity>);
});
const NotableWorkGalaxy=memo(function NotableWorkGalaxy({w,isLast}:{w:any;isLast:boolean}){
  const{fire,ring,ringOp,glow}=useGalaxyTap();const yearStr=w.year?.slice(-2)??'—';
  const handleTap=()=>{fire();if(w.url)Linking.openURL(w.url).catch(()=>{});};
  const rowBg=glow.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0)','rgba(191,95,255,0.07)']});
  return(<TouchableOpacity onPress={handleTap} activeOpacity={0.80}><Animated.View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,paddingHorizontal:4,borderRadius:9,borderBottomWidth:isLast?0:StyleSheet.hairlineWidth,borderBottomColor:C.border,backgroundColor:rowBg}}><View style={{width:36,height:36,position:'relative',alignItems:'center',justifyContent:'center'}}><Animated.View style={{position:'absolute',width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:C.purple,transform:[{scale:ring}],opacity:ringOp}} pointerEvents="none"/><View style={{width:36,height:36,borderRadius:10,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.mid,fontSize:11,fontWeight:'900'}}>{yearStr}</Text></View></View><View style={{flex:1,gap:2}}><Text style={{color:C.white,fontSize:13,fontWeight:'700'}} numberOfLines={1}>{w.title||'Sans titre'}</Text><Text style={{color:C.muted,fontSize:11}}>{w.role||'—'}</Text></View>{w.url&&<Ionicons name="open-outline" size={13} color={C.muted}/>}</Animated.View></TouchableOpacity>);
});
const StarRatingRowGalaxy=memo(function StarRatingRowGalaxy({rating,count,max}:{rating:number;count:number;max:number}){
  const{fire,glow}=useGalaxyTap();const rowBg=glow.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0)','rgba(245,200,66,0.08)']});
  return(<TouchableOpacity onPress={fire} activeOpacity={0.85}><Animated.View style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:3,paddingHorizontal:4,borderRadius:8,backgroundColor:rowBg}}><View style={{flexDirection:'row',gap:1,width:54}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=rating?'star':'star-outline'} size={9} color={s<=rating?C.gold:C.muted}/>)}</View><AnimBar value={count} max={max} color={C.goldDim} h={4}/><Text style={{color:C.muted,fontSize:10,fontWeight:'700',width:18,textAlign:'right'}}>{count}</Text></Animated.View></TouchableOpacity>);
});
const CinemaAccordion=memo(function CinemaAccordion({icon,title,count,badge,defaultOpen=false,children}:{icon:keyof typeof Ionicons.glyphMap;title:string;count?:number;badge?:string;defaultOpen?:boolean;children:React.ReactNode}){
  const[open,setOpen]=useState(defaultOpen);const rot=useRef(new Animated.Value(defaultOpen?1:0)).current;const nebulaPulse=useRef(new Animated.Value(0)).current;
  const toggle=()=>{const next=!open;Animated.spring(rot,{toValue:next?1:0,tension:80,friction:10,useNativeDriver:true}).start();if(next){Animated.sequence([Animated.timing(nebulaPulse,{toValue:1,duration:220,useNativeDriver:false}),Animated.timing(nebulaPulse,{toValue:0,duration:500,useNativeDriver:false})]).start();}setOpen(next);};
  const iconBg=nebulaPulse.interpolate({inputRange:[0,1],outputRange:[open?C.subtle:C.navyMid,'rgba(191,95,255,0.28)']});
  return(<View style={{marginHorizontal:H_PAD,marginBottom:8,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:open?C.borderHi:C.border,backgroundColor:C.navyLow}}><TouchableOpacity onPress={toggle} activeOpacity={0.80} style={{flexDirection:'row',alignItems:'center',gap:11,padding:15}}><Animated.View style={{width:34,height:34,borderRadius:11,backgroundColor:iconBg,borderWidth:StyleSheet.hairlineWidth,borderColor:open?C.borderHi:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={15} color={open?C.white:C.mid}/></Animated.View><Text style={{color:open?C.white:C.offWhite,fontSize:13,fontWeight:'700',flex:1,letterSpacing:-0.2}}>{title}</Text>{!!badge&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{badge}</Text></View>}{count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}<Animated.View style={{transform:[{rotate:rot.interpolate({inputRange:[0,1],outputRange:['0deg','90deg']})}]}}><Ionicons name="chevron-forward" size={14} color={C.muted}/></Animated.View></TouchableOpacity>{open&&<View style={{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border,paddingHorizontal:14,paddingTop:14,paddingBottom:16,gap:10}}>{children}</View>}</View>);
});
const SkeletonSection=memo(()=>(<View><View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PAD,paddingTop:20,paddingBottom:12}}><Shimmer w={24} h={24} r={8}/><Shimmer w={120} h={11} r={6}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PAD,gap:10}}>{[0,1,2,3].map(i=><Shimmer key={i} w={CARD_W} h={CARD_H} r={12}/>)}</ScrollView></View>));

// ─── GAMIFICATION BADGE (identique à search.tsx) ─────────────────────────────
const GamificationBadge = memo(function GamificationBadge({
  profile, earnedCount, onPress,
}: { profile: GamiProfile; earnedCount: number; onPress: () => void }) {
  const [si, setSi] = useState(0);
  const fade  = useRef(new Animated.Value(1)).current;
  const btnSc = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue:1.0, duration:1600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
      Animated.timing(glowOp, { toValue:0.18, duration:1600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
    ]));
    l.start(); return () => l.stop();
  }, [glowOp]);
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(fade, { toValue:0, duration:200, useNativeDriver:true }).start(() => {
        setSi(i => (i + 1) % SECTIONS.length);
        Animated.timing(fade, { toValue:1, duration:260, useNativeDriver:true }).start();
      });
    }, 3600);
    return () => clearInterval(t);
  }, [fade]);
  const press = () => {
    hL();
    Animated.sequence([
      Animated.timing(btnSc, { toValue:0.94, duration:80, useNativeDriver:true }),
      Animated.spring(btnSc, { toValue:1, tension:300, friction:8, useNativeDriver:true }),
    ]).start(onPress);
  };
  const sec = SECTIONS[si];
  const phrase = FOMO[Math.floor((profile.xp + si * 37) % FOMO.length)];
  const fmtXP = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  const glowStyle: any = {
    position:'absolute', top:-3, bottom:-3, left:-3, right:-3, borderRadius:21,
    ...(Platform.OS === 'web'
      ? { boxShadow:'0 0 24px 8px rgba(245,200,66,0.42), 0 0 8px 2px rgba(245,200,66,0.18)' }
      : { shadowColor:C.gold, shadowOffset:{width:0,height:0}, shadowOpacity:0.82, shadowRadius:16, elevation:8 }),
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={1} style={{ marginHorizontal:H_PAD, marginBottom:14 }}>
      <Animated.View style={{ transform:[{ scale:btnSc }] }}>
        <Animated.View style={[glowStyle, { opacity:glowOp }]} pointerEvents="none"/>
        <LinearGradient
          colors={['rgba(245,200,66,0.12)','rgba(13,32,64,0.88)','rgba(4,8,15,0.97)']}
          start={{ x:0, y:0 }} end={{ x:1, y:1 }}
          style={{ height:88, borderRadius:18, paddingHorizontal:17, borderWidth:1, borderColor:C.goldBd, flexDirection:'row', alignItems:'center', gap:14 }}
        >
          <View style={{ width:46, height:46, borderRadius:14, flexShrink:0, backgroundColor:C.goldDim, borderWidth:1.5, borderColor:C.goldBd, alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={levelIcon(profile.level)} size={21} color={C.gold}/>
          </View>
          <View style={{ flex:1, gap:4 }}>
            <Animated.View style={{ opacity:fade, flexDirection:'row', alignItems:'center', gap:6 }}>
              <Ionicons name={sec.icon} size={11} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:12, fontWeight:'900', letterSpacing:0.4 }}>{sec.label}</Text>
              <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:C.goldDim, borderWidth:StyleSheet.hairlineWidth, borderColor:C.goldBd }}>
                <Text style={{ color:C.gold, fontSize:9, fontWeight:'800' }}>NIV.{profile.level}</Text>
              </View>
            </Animated.View>
            <Animated.Text style={{ color:C.muted, fontSize:11, fontStyle:'italic', opacity:fade }} numberOfLines={1}>{phrase}</Animated.Text>
            <View style={{ height:3, backgroundColor:C.faint, borderRadius:2, overflow:'hidden' }}>
              <View style={{ height:'100%', borderRadius:2, backgroundColor:C.gold, width:`${profile.pct * 100}%` as any }}/>
            </View>
          </View>
          <View style={{ alignItems:'flex-end', gap:5, flexShrink:0 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={11} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:13, fontWeight:'900' }}>{fmtXP(profile.xp)}</Text>
            </View>
            {profile.streak_days > 0 && <Text style={{ color:C.gold, fontSize:10, fontWeight:'800' }}>★{profile.streak_days}j</Text>}
            {earnedCount > 0 && <Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>{earnedCount} badges</Text>}
            <Ionicons name="chevron-forward" size={13} color={C.muted}/>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── COSMOS MODAL (défis du jour + XP bar) ───────────────────────────────────
const CosmosModal = memo(function CosmosModal({
  visible, onClose, profile, userId, earnedCount, awardXP,
}: {
  visible: boolean; onClose: () => void; profile: GamiProfile;
  userId: string; earnedCount: number; awardXP: (xp: number, reason: string) => void;
}) {
  const [burst, setBurst] = useState({ n:0, v:false });
  const showBurst = (xp: number) => { setBurst({ n:xp, v:true }); setTimeout(() => setBurst(b => ({ ...b, v:false })), 1200); };
  const daily = useDailyQuests(userId, (xp, questId) => { awardXP(xp, `daily_${questId}`); showBurst(xp); });
  const handleClaim  = useCallback((questId: string) => { daily.claimDailyQuest(questId); }, [daily]);
  const handleAction = useCallback((_action: string) => { onClose(); }, [onClose]);
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'#070C17' }}>
        <LinearGradient colors={['rgba(245,200,66,0.08)','rgba(7,12,23,0)','rgba(7,12,23,0)']} style={{ position:'absolute', top:0, left:0, right:0, height:220 }} pointerEvents="none"/>
        <ScrollView contentContainerStyle={{ paddingBottom:60 }}>
          <View style={{ paddingTop:Platform.OS==='ios'?56:32, paddingHorizontal:H_PAD }}>
            <TouchableOpacity onPress={onClose} hitSlop={14} style={{ alignSelf:'flex-end', marginBottom:12, padding:8 }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)"/>
            </TouchableOpacity>
            <Text style={{ color:'#fff', fontSize:22, fontWeight:'900', letterSpacing:-0.5, marginBottom:4 }}>Galaxie XP</Text>
            <Text style={{ color:C.gold, fontSize:11, fontWeight:'700', marginBottom:18 }}>{profile.title} · {profile.xp.toLocaleString()} XP</Text>
            <GamiXPBar profile={profile}/>
            <View style={{ height:24 }}/>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.6, marginBottom:10, textTransform:'uppercase' }}>
              {daily.completedToday} défi{daily.completedToday > 1 ? 's' : ''} réclamé{daily.completedToday > 1 ? 's' : ''} aujourd'hui
            </Text>
            <DailyQuestsPanel
              questsWithStatus={daily.questsWithStatus}
              completedToday={daily.completedToday}
              onClaim={handleClaim}
              onAction={handleAction}
            />
          </View>
        </ScrollView>
        <XPFloat amount={burst.n} visible={burst.v} onDone={() => {}}/>
      </View>
    </Modal>
  );
});

// ════════════════════════════════════════════════════════════════════════════
// ★★★  PROFILE SCREEN
// ════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const router = useRouter();

  const [uid,          setUid]     = useState<string|null>(null);
  const [profile,      setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [reels,        setReels]   = useState<UserReel[]>([]);
  const [reviews,      setReviews] = useState<ReviewItem[]>([]);
  const [favWorks,     setFavW]    = useState<LocalWork[]>([]);
  const [watched,      setWatched] = useState<LocalWork[]>([]);
  const [recs,         setRecs]    = useState<LocalWork[]>([]);
  const [loading,      setLoading] = useState(true);
  const [refreshing,   setRef]     = useState(false);
  const [fetchError,   setFErr]    = useState(false);
  const [activeTab,    setTab]     = useState<GridTab>(0);
  const [modal,        setModal]   = useState<ModalType|null>(null);
  const [streak,         setStreak]       = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [likedReels,     setLikedReels]  = useState<VeloceItem[]>([]);
  const [savedReels,     setSavedReels]  = useState<VeloceItem[]>([]);
  const [veloceErr,      setVeloceErr]   = useState(false);
  // ★ Gamification réelle depuis GamificationSystem (profiles)
  const { profile: gamiProfile, badges: gamiBadges, awardXP } = useGamification(uid ?? '');
  const [showLevel,     setShowLevel]    = useState(true);
  const [cosmosVisible, setCosmosVisible] = useState(false);
  const [levelUp,       setLevelUp]      = useState<{ level: number; title: string } | null>(null);

  const { score, level, badges } = useLocalGamification(uid);
  const isFirstLoad = useRef(false);

  useEffect(()=>{
    getDeviceId().then(deviceId=>{
      setUid(deviceId);
      isFirstLoad.current=true;
      loadAll(deviceId);
      loadStreak(deviceId);
      loadShowLevel(deviceId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useFocusEffect(useCallback(()=>{
    if(!uid||!isFirstLoad.current)return;
    loadAll(uid);
    loadShowLevel(uid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]));

  const loadStreak = useCallback(async(userId:string)=>{
    try{const{data}=await supabase.from('user_history').select('watched_at').eq('user_id',userId).order('watched_at',{ascending:false}).limit(30);const rows=data??[];if(!rows.length)return;let s=1;for(let i=1;i<rows.length;i++){const g=new Date(rows[i-1].watched_at).getTime()-new Date(rows[i].watched_at).getTime();if(g<=86400000*2)s++;else break;}setStreak(s);}catch{}
  },[]);

  const loadShowLevel = useCallback(async(userId:string)=>{
    try{
      // show_level_on_profile n'existe pas encore → lire depuis la pref privée existante, défaut true
      const{data}=await supabase.from('user_preferences').select('private_profile').eq('user_id',userId).maybeSingle();
      void data; // colonne show_level_on_profile à ajouter via migration SQL
      setShowLevel(true);
    }catch(e){console.error('[profile] lecture show_level_on_profile:',e);}
  },[]);

  

  // Load all profile data: profile, reels, critiques, favorites, seen items, followers count, liked/saved reels, recommendations

  const loadAll = useCallback(async(userId:string)=>{
    if(!userId)return;
    setLoading(true);setFErr(false);
    try{
      const[profR,reelsR,critiques,favR,seenItems,followersR]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',userId).maybeSingle(),
        supabase.from('reels').select('id,video_url,thumbnail_url,title,genre,duration,status,likes_count,views_count,created_at').eq('user_id',userId).order('created_at',{ascending:false}),
        fetchCritiques(userId),
        supabase.from('user_favorites').select('work_id').eq('user_id',userId),
        fetchSeen(userId),
        supabase.from('follows').select('follower_id',{count:'exact',head:true}).eq('following_id',userId),
      ]);
      if(profR.data)setProfile(mapProfile(profR.data));
      setReels((reelsR.data??[]).map(mapReel));
      setReviews(critiques);
      setFollowersCount((followersR as any).count ?? 0);
      const favIds=[...new Set((favR.data??[]).map((r:any)=>Number(r.work_id)).filter(Boolean))];
      const seenIds=[...new Set(seenItems.map(r=>r.workId).filter(Boolean))];
      const allIds=[...new Set([...favIds,...seenIds])];
      const[favD,seenD,likedIdsR,savedIdsR]=await Promise.all([
        favIds.length?supabase.from('works').select(WORK_COLS).in('id',favIds):Promise.resolve({data:[]}),
        seenIds.length?supabase.from('works').select(WORK_COLS).in('id',seenIds):Promise.resolve({data:[]}),
        supabase.from('user_liked_reels').select('reel_id').eq('user_id',userId).limit(20),
        supabase.from('user_saved_reels').select('reel_id').eq('user_id',userId).limit(20),
      ]);
      const favWks=((favD.data??[]) as any[]).map(mapWork);
      const seenWks=((seenD.data??[]) as any[]).map(mapWork);
      setFavW(favWks);setWatched(seenWks);
      setVeloceErr(!!(likedIdsR.error||savedIdsR.error));
      const likedRIds=(likedIdsR.data??[]).map((r:any)=>String(r.reel_id)).filter(Boolean);
      const savedRIds=(savedIdsR.data??[]).map((r:any)=>String(r.reel_id)).filter(Boolean);
      const REEL_V_COLS='id,title,thumbnail_url,video_url,likes_count,views_count,genre';
      const[lVD,sVD]=await Promise.all([
        likedRIds.length?supabase.from('reels').select(REEL_V_COLS).in('id',likedRIds):Promise.resolve({data:[]}),
        savedRIds.length?supabase.from('reels').select(REEL_V_COLS).in('id',savedRIds):Promise.resolve({data:[]}),
      ]);
      setLikedReels((lVD.data??[]).map(mapVeloce));
      setSavedReels((sVD.data??[]).map(mapVeloce));
      const gW:Record<string,number>={};
      favWks.forEach(w=>{if(w.genre)gW[w.genre]=(gW[w.genre]??0)+3;if(w.category)gW[w.category]=(gW[w.category]??0)+1.5;});
      seenWks.forEach(w=>{if(w.genre)gW[w.genre]=(gW[w.genre]??0)+1;});
      critiques.forEach(c=>{if(c.rating<3)return;if(c.film?.genre&&c.film.genre!=='—')gW[c.film.genre]=(gW[c.film.genre]??0)+(c.rating/5)*2;});
      const topG=Object.entries(gW).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([g])=>g);
      if(topG.length){
        const exc=allIds.length?`(${allIds.slice(0,150).join(',')})`:null;
        let q=supabase.from('works').select(WORK_COLS).in('genre',topG).order('likes',{ascending:false}).limit(30);
        if(exc)q=(q as any).not('id','in',exc);
        const{data:rd}=await q;
        if(rd?.length){const maxL=Math.max(1,...rd.map((w:any)=>w.likes??0));setRecs(rd.map((w:any)=>({...w,_s:(gW[w.genre]??0)*10+((w.likes??0)/maxL)*5})).sort((a:any,b:any)=>b._s-a._s).slice(0,12).map(mapWork));}
      }
    }catch(e){console.error('[profile] loadAll:',e);setFErr(true);}
    finally{setLoading(false);setRef(false);}
  },[]);

  const hotId      = useMemo(()=>reels.length<2?null:[...reels].sort((a,b)=>momentum(b)-momentum(a))[0]?.id??null,[reels]);
  const reelsByCat = useMemo(()=>{const co:UserReel[]=[],mo:UserReel[]=[],se:UserReel[]=[];reels.forEach(r=>{if(!r.duration||r.duration<=1800)co.push(r);else if(r.duration<=5400)mo.push(r);else se.push(r);});return{courts:co,moyens:mo,series:se};},[reels]);
  const genreStats = useMemo(()=>{const m:Record<string,number>={};[...favWorks,...watched].forEach(w=>{if(w.genre)m[w.genre]=(m[w.genre]??0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10);},[favWorks,watched]);
  const maxGenre   = useMemo(()=>Math.max(1,...genreStats.map(g=>g[1])),[genreStats]);
  const ratingDist = useMemo(()=>{const d:Record<number,number>={1:0,2:0,3:0,4:0,5:0};reviews.forEach(r=>{const s=Math.round(r.rating);if(s>=1&&s<=5)d[s]++;});return d;},[reviews]);
  const maxRating  = useMemo(()=>Math.max(1,...Object.values(ratingDist)),[ratingDist]);
  const avgRating  = useMemo(()=>reviews.length?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):'—',[reviews]);

  const nav = useMemo(()=>({
    settings: () => router.push('/settings' as any),
    admin:    () => router.push('/backoffice/universe-admin' as any),
    avatarEdit: () => router.push('/edit' as any), // ★ avatar tap → edit
  }),[router]);

  const ErrorState = useCallback(()=>(
    <View style={{alignItems:'center',paddingVertical:40,gap:12,paddingHorizontal:H_PAD}}>
      <View style={{width:60,height:60,borderRadius:30,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Ionicons name="cloud-offline-outline" size={28} color={C.muted}/></View>
      <Text style={{color:C.muted,fontSize:13,textAlign:'center'}}>Impossible de charger les données</Text>
      <TouchableOpacity style={{paddingHorizontal:20,paddingVertical:10,borderRadius:13,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>uid&&loadAll(uid)}>
        <Text style={{color:C.white,fontSize:13,fontWeight:'700'}}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  ),[uid,loadAll]);

  // ─── Tab Films ─────────────────────────────────────────────────────────────
  const renderFilms = useCallback(()=>{
    if(loading)return<View><SkeletonSection/><SkeletonSection/><SkeletonSection/></View>;
    if(fetchError)return<ErrorState/>;
    return(
      <View style={{marginBottom:80,gap:20}}>
        <SecHead icon="heart-outline" label="Œuvres favorites" count={favWorks.length} onMore={favWorks.length>0?()=>setModal('favorites'):undefined}/>
        {!favWorks.length?<Empty icon="heart-outline" text="Aucun favori" sub="Sauvegardez des films depuis le catalogue"/>:<HRow c={favWorks.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}/>}
        <Div/>
        <SecHead icon="create-outline" label="Mes critiques" count={reviews.length} onMore={reviews.length>0?()=>setModal('reviews'):undefined}/>
        {!reviews.length?<Empty icon="chatbubble-outline" text="Aucune critique"/>:<HRow c={reviews.map((r,i)=><CritCard key={r.id} r={r} rank={i+1} onPress={()=>router.push(`/review/${r.id}` as any)}/>)}/>}
        <Div/>
        <SecHead icon="eye-outline" label="Œuvres visionnées" count={watched.length} onMore={watched.length>0?()=>setModal('watched'):undefined}/>
        {!watched.length?<Empty icon="film-outline" text="Aucun visionnage"/>:<HRow c={watched.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}/>}
        <Div/>
        {/* <SecHead icon="shuffle-outline" label="Recommandés pour vous" onMore={recs.length>0?()=>setModal('recs'):undefined}/>
        {!recs.length?<Empty icon="planet-outline" text="Regardez des films pour des recs personnalisées"/>:<HRow c={recs.map(f=><PortraitCard key={f.id} item={f}/>)}/>}
        <View style={{height:110}}/> */}
      </View>
    );
  },[loading,fetchError,favWorks,reviews,watched,recs,router,ErrorState]);

  // ─── Tab Cinéma ─────────────────────────────────────────────────────────────
  const renderCinema = useCallback(()=>{
    if(loading)return<View><SkeletonSection/></View>;
    return(
      <View style={{marginTop:5}}>
        <SecHead icon="heart-outline" label="Véloces Favoris" count={veloceErr?undefined:likedReels.length}/>
        {veloceErr
          ?<Empty icon="alert-circle-outline" text="Permissions manquantes" sub="Exécuter fix_rls_liked_saved_reels.sql dans le Dashboard Supabase"/>
          :likedReels.length===0
            ?<Empty icon="heart-outline" text="Aucun Véloce aimé" sub="Les Véloces likés apparaissent ici"/>
            :<HRow pb={8} c={likedReels.map(r=><VeloceCard key={r.id} item={r}/>)}/>
        }
        <Div/>
        <SecHead icon="bookmark-outline" label="Véloces Enregistrés" count={veloceErr?undefined:savedReels.length}/>
        {veloceErr
          ?<Empty icon="alert-circle-outline" text="Permissions manquantes" sub="Exécuter fix_rls_liked_saved_reels.sql dans le Dashboard Supabase"/>
          :savedReels.length===0
            ?<Empty icon="bookmark-outline" text="Aucun Véloce enregistré" sub="Les Véloces sauvegardés apparaissent ici"/>
            :<HRow pb={8} c={savedReels.map(r=><VeloceCard key={r.id} item={r}/>)}/>
        }
        {profile.notable_works.length>0&&(
          <>
            <Div/>
            
          </>
        )}
        <View style={{height:110}}/>
      </View>
    );
  },[loading,profile.notable_works,likedReels,savedReels,veloceErr]);

  // ─── Tab Créations ──────────────────────────────────────────────────────────
  const renderCreations = useCallback(()=>{
    if(loading)return<View><SkeletonSection/></View>;
    if(!reels.length)return(
      <View style={{paddingTop:50,paddingHorizontal:H_PAD}}>
        <Empty icon="videocam-outline" text="Aucune création" sub="Importez vos vidéos depuis l'onglet Créer"/>
        <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:16,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,paddingVertical:13}} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={14} color={C.mid}/>
          <Text style={{color:C.mid,fontSize:12.5,fontWeight:'700'}}>Importer une vidéo</Text>
        </TouchableOpacity>
        <View style={{height:110}}/>
      </View>
    );
    const rejected=reels.filter(r=>r.status==='rejected').length;
    const secs=reels.every(r=>r.duration==null)?[{key:'all',icon:'videocam-outline' as const,data:reels}]:[{key:'courts',icon:'videocam-outline' as const,data:reelsByCat.courts},{key:'moyens',icon:'tv-outline' as const,data:reelsByCat.moyens},{key:'series',icon:'film-outline' as const,data:reelsByCat.series}].filter(s=>s.data.length>0);
    return(
      <View>
        {rejected>0&&<View style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:H_PAD,marginBottom:10,paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}}><Ionicons name="alert-circle-outline" size={12} color={C.mid}/><Text style={{color:C.mid,fontSize:11,flex:1}}>{rejected} création{rejected>1?'s':''} refusée{rejected>1?'s':''}</Text></View>}
        <SecHead icon="play-circle-outline" label="Toutes mes créations" count={reels.length} onMore={reels.length>0?()=>setModal('creations'):undefined}/>
        {secs.map((s,si)=>(<View key={s.key}><HRow pb={8} c={s.data.map(r=><ReelCard key={r.id} reel={r} isHot={r.id===hotId}/>)}/>{si<secs.length-1&&<Div/>}</View>))}
        <View style={{height:110}}/>
      </View>
    );
  },[loading,reels,reelsByCat,hotId,router]);

  const tabs=[{icon:'grid-outline' as const,label:'Films'},{icon:'star-outline' as const,label:'Véloces'},{icon:'play-circle-outline' as const,label:'Créations'}];

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRef(true);if(uid){loadAll(uid);loadShowLevel(uid);}}} tintColor={C.mid}/>}>
        <SafeAreaView edges={['top']}>
          {/* ★ Header branché sur gamiProfile (GamificationSystem) */}
          <ProfileHeader
            profile={profile}
            filmCount={watched.length}
            critiqueCount={reviews.length}
            reelCount={reels.length}
            followersCount={followersCount}
            gamiProfile={gamiProfile}
            showLevel={showLevel}
            streak={streak}
            onAvatarEdit={nav.avatarEdit}
            onAdmin={nav.admin}
            onSettings={nav.settings}
          />
        </SafeAreaView>

        {/* ── Photo de profil obligatoire — Modal bloquant ── */}
        <Modal
          visible={!loading && !profile.avatar_url}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={()=>{}}
        >
          <View style={{flex:1,backgroundColor:'rgba(3,2,10,0.94)',alignItems:'center',justifyContent:'center',padding:28}}>
            <LinearGradient
              colors={['#0D2040','#070C17']}
              style={{width:'100%',borderRadius:22,padding:30,alignItems:'center',borderWidth:1,borderColor:'rgba(245,200,66,0.22)'}}
            >
              <View style={{width:76,height:76,borderRadius:38,backgroundColor:'rgba(245,200,66,0.10)',alignItems:'center',justifyContent:'center',marginBottom:22,borderWidth:1,borderColor:'rgba(245,200,66,0.25)'}}>
                <Ionicons name="camera-outline" size={36} color={C.gold}/>
              </View>
              <Text style={{color:C.white,fontSize:20,fontWeight:'900',textAlign:'center',marginBottom:10,letterSpacing:0.2}}>
                Photo de profil requise
              </Text>
              <Text style={{color:C.muted,fontSize:13,textAlign:'center',lineHeight:21,marginBottom:30}}>
                Votre identité Universe est incomplète.{'\n'}Une photo est nécessaire pour continuer.
              </Text>
              <TouchableOpacity
                onPress={nav.avatarEdit}
                activeOpacity={0.85}
                style={{width:'100%',borderRadius:14,overflow:'hidden'}}
              >
                <LinearGradient
                  colors={['#F5C842','#D4A800']}
                  start={{x:0,y:0}} end={{x:1,y:0}}
                  style={{paddingVertical:15,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:9}}
                >
                  <Ionicons name="camera" size={18} color="#070C17"/>
                  <Text style={{color:'#070C17',fontSize:15,fontWeight:'900',letterSpacing:0.1}}>Ajouter ma photo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* Tabs */}
        <View style={{flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginTop:10}}>
          {tabs.map(({icon,label},idx)=>{
            const active=activeTab===idx;
            const badge=idx===2?reels.filter(r=>r.status==='pending').length:0;
            return(
              <TouchableOpacity key={icon} style={{flex:1,alignItems:'center',paddingVertical:10,gap:3,position:'relative'}} onPress={()=>setTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active?(icon.replace('-outline','') as any):icon} size={17} color={active?C.white:C.muted}/>
                <Text style={{fontSize:8.5,fontWeight:'700',color:active?C.white:C.muted,letterSpacing:0.5,textTransform:'uppercase'}}>{label}</Text>
                {active&&<View style={{position:'absolute',top:0,left:'20%',right:'20%',height:2,backgroundColor:C.white,borderBottomLeftRadius:2,borderBottomRightRadius:2}}/>}
                {badge>0&&<View style={{position:'absolute',top:6,right:10,minWidth:14,height:14,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',paddingHorizontal:3}}><Text style={{color:C.white,fontSize:7,fontWeight:'900'}}>{badge}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab===0&&renderFilms()}
        {activeTab===1&&renderCinema()}
        {activeTab===2&&renderCreations()}
      </ScrollView>

      <SeeAllModal visible={modal==='favorites'} onClose={()=>setModal(null)} type="favorites" title="Œuvres favorites"  icon="heart-outline"       works={favWorks}/>
      <SeeAllModal visible={modal==='reviews'}   onClose={()=>setModal(null)} type="reviews"   title="Mes critiques"     icon="create-outline"      reviews={reviews}/>
      <SeeAllModal visible={modal==='watched'}   onClose={()=>setModal(null)} type="watched"   title="Œuvres visionnées" icon="eye-outline"         works={watched}/>
      <SeeAllModal visible={modal==='recs'}      onClose={()=>setModal(null)} type="recs"      title="Recommandations"   icon="shuffle-outline"     works={recs}/>
      <SeeAllModal visible={modal==='creations'} onClose={()=>setModal(null)} type="creations" title="Mes créations"     icon="play-circle-outline" reels={reels} hotReelId={hotId}/>
      {uid && (
        <CosmosModal
          visible={cosmosVisible}
          onClose={() => setCosmosVisible(false)}
          profile={gamiProfile}
          userId={uid}
          earnedCount={gamiBadges.filter(b => b.earned).length}
          awardXP={awardXP}
        />
      )}
      {levelUp && (
        <LevelUpCelebration
          level={levelUp.level}
          title={levelUp.title}
          visible={!!levelUp}
          onClose={() => setLevelUp(null)}
        />
      )}
    </View>
  );
}