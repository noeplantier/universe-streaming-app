/**
 * components/reels/DropdownMenu.tsx — UNIVERSE
 *
 * ★ getDeviceId()  — ZERO supabase.auth.* (replace auth.getUser partout)
 * ★ Profil dynamique : profiles · user_favorites · critiques · reels live
 * ★ Realtime profiles UPDATE → avatar / nom / is_pro sync instantané
 * ★ Gamification : score · XP bar animée · level badge · badges interactifs
 * ★ Genres filtrés par public.reels approved (réactif DB)
 * ★ PanelGalaxy · swipe-to-close · stagger animations — UX v4 identique
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Easing, PanResponder,
  Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Image }          from 'expo-image';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase }       from '@/lib/supabase';
import { getDeviceId }    from '@/services/api';

// ─── Web-safe Haptics ─────────────────────────────────────────────────────────
let _Haptics: any = null;
if (Platform.OS !== 'web') { try { _Haptics = require('expo-haptics'); } catch {} }
function hapticLight() { _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(()=>{}); }

// ─── Tokens ───────────────────────────────────────────────────────────────────
const NAVY = '#0D2240';
const T = {
  text:     'rgba(255,255,255,0.90)',
  textSec:  'rgba(255,255,255,0.48)',
  textTert: 'rgba(255,255,255,0.22)',
  surf:     'rgba(255,255,255,0.05)',
  surfHi:   'rgba(255,255,255,0.10)',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.14)',
  active:   'rgba(255,255,255,0.08)',
  gold:     '#F5C842',
  goldDim:  'rgba(245,200,66,0.14)',
  bg:       '#03000A',
} as const;

const { width: W, height: H } = Dimensions.get('window');
const PANEL_W = Math.min(W * 0.80, 320);

// ─── Genres (identique import modal) ─────────────────────────────────────────
const GENRES = [
  'Drame','Comédie','Thriller','Horreur','Science-Fiction',
  'Documentaire','Animation','Romance','Action','Fantastique',
  'Policier','Biopic','Court-métrage','Expérimental',
] as const;

type GenreType = typeof GENRES[number];

const GENRE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Drame':'heart-outline','Comédie':'happy-outline','Thriller':'skull-outline',
  'Horreur':'flash-outline','Science-Fiction':'planet-outline','Documentaire':'camera-outline',
  'Animation':'brush-outline','Romance':'rose-outline','Action':'flame-outline',
  'Fantastique':'sparkles-outline','Policier':'shield-outline','Biopic':'person-outline',
  'Court-métrage':'film-outline','Expérimental':'color-wand-outline',
};

const STATIC_ITEMS = [
  { icon:'play-circle-outline' as const, label:'Pour vous',       key:'foryou'   },
  { icon:'flame-outline'       as const, label:'Tendances',        key:'trending' },
  { icon:'sparkles-outline'    as const, label:'Films ORIGINAL',   key:'original' },
  { icon:'trophy-outline'      as const, label:'Sélection Cannes', key:'cannes'   },
] as const;

export type MenuKey = string;
export { GENRES };

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItem    { icon:keyof typeof Ionicons.glyphMap; label:string; key:string }
interface DropdownMenuProps { visible:boolean; onClose:()=>void; onSelect:(key:MenuKey)=>void; activeKey:MenuKey }
interface ProfileData {
  id:string; username:string; display_name:string;
  avatar_url:string; role:string; is_pro:boolean;
  filmCount:number; critiqueCount:number; reelCount:number;
}
interface Badge { id:string; label:string; icon:keyof typeof Ionicons.glyphMap; earned:boolean; pts:number; desc:string }
interface GamiStats { watchCount:number; critiqueCount:number; favCount:number; isNight:boolean }

const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
  critic:'Critique', creator:'Créateur·rice',
};

// ─── Gamification helpers ─────────────────────────────────────────────────────
function buildBadges(s:GamiStats): Badge[] {
  return [
    {id:'explorer', label:'Explorateur',  icon:'compass-outline',  earned:s.watchCount>=5,    pts:15, desc:'5 films vus'        },
    {id:'nocturne', label:'Insomniaque',   icon:'moon-outline',     earned:s.isNight,           pts:5,  desc:'Actif entre 22h-4h' },
    {id:'critique', label:'Critique',      icon:'create-outline',   earned:s.critiqueCount>=5, pts:40, desc:'5 critiques publiées'},
    {id:'curateur', label:'Curateur',      icon:'bookmark-outline', earned:s.favCount>=10,     pts:20, desc:'10 favoris'         },
    {id:'omnivore', label:'Omnivore',      icon:'layers-outline',   earned:s.watchCount>=15,   pts:25, desc:'15 films vus'       },
  ];
}
function cinephileLevel(score:number):{n:number;label:string;pct:number;nextAt:number} {
  const L=[{at:0,n:1,l:'Spectateur'},{at:50,n:2,l:'Explorateur'},{at:150,n:3,l:'Critique'},{at:400,n:4,l:'Curateur'},{at:900,n:5,l:'Ambassadeur'}];
  const cur=[...L].reverse().find(x=>score>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===cur.n)+1;
  const nxt=L[ni]??L[L.length-1];
  return{n:cur.n,label:cur.l,pct:cur.n===5?1:Math.min(1,(score-cur.at)/(nxt.at-cur.at)),nextAt:nxt.at};
}
const fmtPts = (n:number) => n>=1000?`${(n/1000).toFixed(1)}K`:String(n);

// ─── PanelGalaxy ─────────────────────────────────────────────────────────────
const rnd  = (a:number,b:number) => a+Math.random()*(b-a);
const pick = <T,>(arr:T[]): T => arr[Math.floor(Math.random()*arr.length)];
const STAR_COLS = ['#F3EDFF','#B2CCFF','#FFE270','rgba(255,255,255,0.55)'];
interface StarPt { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number }
interface Met    { id:number; sx:number; sy:number; ang:number; len:number }

const PANEL_STARS: StarPt[] = Array.from({length:40},(_,i)=>({
  id:i, x:rnd(0,PANEL_W), y:rnd(0,H), sz:rnd(0.8,2.0),
  col:pick(STAR_COLS), del:rnd(0,3500), dur:rnd(2000,5000),
}));

const PanelStar = memo(function PanelStar({p}:{p:StarPt}) {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.delay(p.del%p.dur),
      Animated.timing(op,{toValue:0.85,duration:p.dur*0.5,useNativeDriver:true}),
      Animated.timing(op,{toValue:0.18,duration:p.dur*0.5,useNativeDriver:true}),
    ])).start();
  },[]);
  return <Animated.View style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:op}}/>;
});

const PanelShoot = memo(function PanelShoot({m,onDone}:{m:Met;onDone:()=>void}) {
  const prog=useRef(new Animated.Value(0)).current, op=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.sequence([Animated.timing(op,{toValue:1,duration:100,useNativeDriver:true}),Animated.timing(op,{toValue:0,duration:400,delay:150,useNativeDriver:true})]),
      Animated.timing(prog,{toValue:1,duration:700,easing:Easing.out(Easing.quad),useNativeDriver:true}),
    ]).start(onDone);
  },[]);
  const tx=prog.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(m.ang*Math.PI/180)*140]});
  const ty=prog.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(m.ang*Math.PI/180)*140]});
  return(
    <Animated.View style={{position:'absolute',left:m.sx,top:m.sy,opacity:op,transform:[{translateX:tx},{translateY:ty},{rotate:`${m.ang}deg`}]}}>
      <LinearGradient colors={['transparent','rgba(255,255,255,0.15)','#fff']} start={{x:0,y:0}} end={{x:1,y:0}} style={{width:m.len,height:1.2,borderRadius:1}}/>
    </Animated.View>
  );
});

const PanelGalaxy = memo(function PanelGalaxy() {
  const [meteors, setMeteors] = useState<Met[]>([]);
  useEffect(()=>{
    const iv=setInterval(()=>{ if(Math.random()>0.70) setMeteors(ms=>[...ms,{id:Date.now(),sx:rnd(0,PANEL_W),sy:rnd(0,H*0.4),ang:rnd(25,55),len:rnd(60,120)}]); },3000);
    return()=>clearInterval(iv);
  },[]);
  return(
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#03000A','#060F1E','#0A0A1E']} style={StyleSheet.absoluteFill}/>
      {PANEL_STARS.map(s=><PanelStar key={s.id} p={s}/>)}
      {meteors.map(m=><PanelShoot key={m.id} m={m} onDone={()=>setMeteors(ms=>ms.filter(x=>x.id!==m.id))}/>)}
      <View style={{...StyleSheet.absoluteFillObject,backgroundColor:`${NAVY}72`} as any}/>
    </View>
  );
});

// ─── Shimmer ─────────────────────────────────────────────────────────────────
const _shim = new Animated.Value(0.18);
let _shimGo = false;
function startShim() {
  if (_shimGo) return; _shimGo=true;
  Animated.loop(Animated.sequence([
    Animated.timing(_shim,{toValue:0.42,duration:800,useNativeDriver:true}),
    Animated.timing(_shim,{toValue:0.18,duration:800,useNativeDriver:true}),
  ])).start();
}
const Shimmer = memo(function Shimmer({w,h,r=6}:{w:number|string;h:number;r?:number}) {
  useEffect(()=>startShim(),[]);
  return <Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:'rgba(255,255,255,0.09)',opacity:_shim}}/>;
});

// ─── ★ Badges interactifs (strip horizontal) ──────────────────────────────────
const BadgeChip = memo(function BadgeChip({b}:{b:Badge}) {
  const [open,setOpen] = useState(false);
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => {
    hapticLight();
    Animated.sequence([
      Animated.spring(sc,{toValue:0.88,tension:350,friction:7,useNativeDriver:true}),
      Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
    ]).start();
    setOpen(v=>!v);
  };
  const ptsStr = `+${b.pts}pts`;
  return (
    <Animated.View style={{transform:[{scale:sc}]}}>
      <TouchableOpacity onPress={press} activeOpacity={0.80} style={[bc.wrap, b.earned&&bc.wrapOn]}>
        <View style={[bc.icon, b.earned&&bc.iconOn]}>
          <Ionicons name={b.icon} size={12} color={b.earned?'#fff':T.textTert}/>
        </View>
        <Text style={[bc.label, b.earned&&{color:'#fff'}]} numberOfLines={1}>{b.label}</Text>
        {b.earned
          ? <Text style={bc.pts}>{ptsStr}</Text>
          : <Ionicons name="lock-closed" size={7} color={T.textTert}/>
        }
        {open && <Text style={bc.desc}>{b.desc}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
});
const bc = StyleSheet.create({
  wrap:    {alignItems:'center',gap:3,paddingVertical:7,paddingHorizontal:8,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,backgroundColor:'rgba(255,255,255,0.03)',opacity:0.52,minWidth:60},
  wrapOn:  {opacity:1,borderColor:T.borderHi,backgroundColor:T.surf},
  icon:    {width:24,height:24,borderRadius:7,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.04)',borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  iconOn:  {borderColor:T.borderHi,backgroundColor:T.surfHi},
  label:   {color:T.textTert,fontSize:8,fontWeight:'600',textAlign:'center'},
  pts:     {color:T.gold,fontSize:7,fontWeight:'800'},
  desc:    {color:T.textTert,fontSize:7,textAlign:'center',lineHeight:10,marginTop:2},
});

// ─── ★ PROFILE HEADER (doc 4 + gamification greffée) ─────────────────────────
const ProfileHeader = memo(function ProfileHeader({
  profile, loading, score, level, badges, statsAnim,
}:{
  profile:ProfileData|null; loading:boolean;
  score:number; level:ReturnType<typeof cinephileLevel>; badges:Badge[];
  statsAnim:Animated.Value;
}) {
  const ty  = statsAnim.interpolate({inputRange:[0,1],outputRange:[8,0]});
  const xp  = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    Animated.timing(xp,{toValue:level.pct,duration:1000,useNativeDriver:false}).start();
  },[level.pct]);

  const barW   = xp.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
  // Strings pré-calculés (évite text node)
  const levelStr = `Niv.${level.n} · ${level.label}`;
  const scoreStr = `${fmtPts(score)} pts`;
  const ptsLeft  = Math.max(0, level.nextAt - score);
  const nextStr  = `${fmtPts(ptsLeft)} pts → Niv.${level.n+1}`;
  const earnedCount = badges.filter(b=>b.earned).length;
  const badgesStr   = `${earnedCount}/${badges.length}`;

  if (loading || !profile) return(
    <Animated.View style={[ph.section,{opacity:statsAnim,transform:[{translateY:ty}]}]}>
      <View style={ph.profileRow}>
        <Shimmer w={52} h={52} r={26}/>
        <View style={{flex:1,gap:6}}><Shimmer w="60%" h={14}/><Shimmer w="40%" h={11}/></View>
      </View>
      <Shimmer w="100%" h={44} r={12}/>
    </Animated.View>
  );

  const roleLabel   = ROLE_LABELS[profile.role] ?? 'Cinéphile';
  const avatarUri   = profile.avatar_url || `https://i.pravatar.cc/100?u=${profile.id}`;
  const displayName = profile.display_name || profile.username;

  return(
    <Animated.View style={[ph.section,{opacity:statsAnim,transform:[{translateY:ty}]}]}>

      {/* ── Avatar + nom/rôle — identique doc 4 ── */}
      <View style={ph.profileRow}>
        <View style={ph.avatarWrap}>
       
          <Image source={{uri:avatarUri}} style={ph.avatar} contentFit="cover"/>
          {/* ★ Level badge sur l'avatar */}
          <View style={ph.lvlBadge}><Text style={ph.lvlTxt}>{level.n}</Text></View>
          {profile.is_pro && <View style={ph.proBadge}><Ionicons name="checkmark-circle" size={12} color={T.gold}/></View>}
        </View>
        <View style={{flex:1,gap:2}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={ph.name} numberOfLines={1}>{displayName}</Text>
            {profile.is_pro && <View style={ph.proChip}><Text style={ph.proChipTxt}>PRO</Text></View>}
          </View>
          <Text style={ph.handle}>@{profile.username}</Text>
          {/* ★ Score pill inline avec le rôle — compact */}
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={ph.niveau}>{roleLabel}</Text>
            <View style={ph.scorePill}>
              <Ionicons name="star" size={7} color={T.gold}/>
              <Text style={ph.scoreTxt}>{scoreStr}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── ★ XP bar animée (compacte, 3px) ── */}
      <View style={ph.xpRow}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
          <Text style={ph.xpLabel}>{levelStr}</Text>
          {level.n < 5
            ? <Text style={ph.xpHint}>{nextStr}</Text>
            : <Text style={[ph.xpHint,{color:T.gold}]}>Maximum ✦</Text>
          }
        </View>
        <View style={ph.xpTrack}>
          <Animated.View style={[ph.xpFill,{width:barW}]}/>
        </View>
      </View>

      {/* ── Compteurs films / critiques / créas — identique doc 4 ── */}
      <View style={ph.countsRow}>
        {[
          {v:profile.filmCount,     l:'films'    },
          {v:profile.critiqueCount, l:'critiques'},
          {v:profile.reelCount,     l:'créas'    },
        ].map(({v,l},i,arr)=>(
          <React.Fragment key={l}>
            <View style={ph.countItem}>
              <Text style={ph.countVal}>{v>=1000?`${(v/1000).toFixed(1)}K`:String(v)}</Text>
              <Text style={ph.countLbl}>{l}</Text>
            </View>
            {i<arr.length-1 && <View style={ph.countDiv}/>}
          </React.Fragment>
        ))}
      </View>

      {/* ── ★ Badges interactifs — strip sous les compteurs ── */}
      <View style={{marginTop:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:7}}>
          <Ionicons name="ribbon-outline" size={10} color={T.textTert}/>
          <Text style={ph.badgeTitle}>BADGES</Text>
          <View style={ph.badgePill}><Text style={ph.badgePillTxt}>{badgesStr}</Text></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>
          {[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)].map(b=>(
            <BadgeChip key={b.id} b={b}/>
          ))}
        </ScrollView>
      </View>

    </Animated.View>
  );
});

const ph = StyleSheet.create({
  section:     {paddingHorizontal:20,paddingTop:14,paddingBottom:16},
  profileRow:  {flexDirection:'row',alignItems:'center',gap:13,marginBottom:12},
  avatarWrap:  {position:'relative'},
  avatarRing:  {position:'absolute',top:-2,left:-2,right:-2,bottom:-2,borderRadius:29},
  avatar:      {width:52,height:52,borderRadius:26,borderWidth:2,borderColor:T.bg},
  lvlBadge:    {position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:8,backgroundColor:'#03000A',borderWidth:1.5,borderColor:'rgba(255,255,255,0.22)',alignItems:'center',justifyContent:'center'},
  lvlTxt:      {color:'#fff',fontSize:7,fontWeight:'900'},
  proBadge:    {position:'absolute',bottom:0,right:0,width:16,height:16,borderRadius:8,backgroundColor:T.bg,alignItems:'center',justifyContent:'center'},
  onlineDot:   {position:'absolute',bottom:0,left:0,width:10,height:10,borderRadius:5,backgroundColor:'rgba(255,255,255,0.55)',borderWidth:2,borderColor:'#03000A'},
  name:        {color:'#FFFFFF',fontSize:15,fontWeight:'800',letterSpacing:-0.2,flexShrink:1},
  handle:      {color:'rgba(255,255,255,0.45)',fontSize:11,fontWeight:'500'},
  niveau:      {color:'rgba(255,255,255,0.30)',fontSize:9,fontWeight:'600',letterSpacing:0.3},
  scorePill:   {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:1.5,borderRadius:7,backgroundColor:T.goldDim,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.30)'},
  scoreTxt:    {color:T.gold,fontSize:8,fontWeight:'700'},
  proChip:     {paddingHorizontal:6,paddingVertical:1,borderRadius:6,backgroundColor:'rgba(245,200,66,0.20)',borderWidth:1,borderColor:'rgba(245,200,66,0.40)'},
  proChipTxt:  {color:T.gold,fontSize:8,fontWeight:'900',letterSpacing:0.8},
  // XP
  xpRow:       {marginBottom:10,paddingHorizontal:2},
  xpLabel:     {color:'rgba(255,255,255,0.45)',fontSize:9,fontWeight:'600'},
  xpHint:      {color:'rgba(255,255,255,0.25)',fontSize:8,fontWeight:'500'},
  xpTrack:     {height:3,borderRadius:1.5,backgroundColor:'rgba(255,255,255,0.08)',overflow:'hidden'},
  xpFill:      {height:'100%',borderRadius:1.5,backgroundColor:'rgba(255,255,255,0.50)'},
  // Compteurs (identique doc 4)
  countsRow:   {flexDirection:'row',paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border},
  countItem:   {flex:1,alignItems:'center',gap:2},
  countVal:    {color:'#FFFFFF',fontSize:15,fontWeight:'900',letterSpacing:-0.3},
  countLbl:    {color:'rgba(255,255,255,0.30)',fontSize:8,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  countDiv:    {width:StyleSheet.hairlineWidth,height:26,backgroundColor:T.border},
  // Badges
  badgeTitle:  {color:T.textTert,fontSize:8,fontWeight:'700',letterSpacing:2,flex:1},
  badgePill:   {paddingHorizontal:6,paddingVertical:1,borderRadius:6,backgroundColor:T.surf},
  badgePillTxt:{color:T.textTert,fontSize:7.5,fontWeight:'700'},
});

// ─── Menu Item Row — identique doc 4 ─────────────────────────────────────────
const MenuItemRow = memo(function MenuItemRow({
  item, isActive, onPress, slideAnim,
}:{item:MenuItem;isActive:boolean;onPress:()=>void;slideAnim:Animated.Value}) {
  const tx = slideAnim.interpolate({inputRange:[0,1],outputRange:[-24,0]});
  const op = slideAnim.interpolate({inputRange:[0,1],outputRange:[0,1]});
  return(
    <Animated.View style={{transform:[{translateX:tx}],opacity:op}}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.65} style={[mi.item,isActive&&mi.itemActive]}>
        {isActive && <View style={mi.accentBar}/>}
        <View style={[mi.iconWrap,isActive&&mi.iconWrapActive]}>
          <Ionicons name={item.icon} size={17} color={isActive?'#FFFFFF':T.textSec}/>
        </View>
        <Text style={[mi.label,isActive&&mi.labelActive]} numberOfLines={1}>{item.label}</Text>
        {isActive && <Ionicons name="chevron-forward" size={12} color={T.textTert}/>}
      </TouchableOpacity>
    </Animated.View>
  );
});
const mi = StyleSheet.create({
  item:          {flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,gap:12,overflow:'hidden'},
  itemActive:    {backgroundColor:T.active},
  accentBar:     {position:'absolute',left:0,top:5,bottom:5,width:3,backgroundColor:'rgba(255,255,255,0.45)',borderRadius:2},
  iconWrap:      {width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  iconWrapActive:{backgroundColor:T.surfHi,borderColor:T.borderHi},
  label:         {flex:1,color:T.textSec,fontSize:13,fontWeight:'500'},
  labelActive:   {color:T.text,fontWeight:'700'},
});

// ─── ★ MAIN ───────────────────────────────────────────────────────────────────
const DropdownMenu = memo(function DropdownMenu({
  visible, onClose, onSelect, activeKey,
}:DropdownMenuProps) {

  const [profile,      setProfile]      = useState<ProfileData|null>(null);
  const [profLoading,  setProfLoading]  = useState(true);
  const [genreItems,   setGenreItems]   = useState<MenuItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(true);
  const [gamiStats,    setGamiStats]    = useState<GamiStats>({watchCount:0,critiqueCount:0,favCount:0,isNight:false});

  const slideX    = useRef(new Animated.Value(-PANEL_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const MAX_ITEMS = STATIC_ITEMS.length + GENRES.length;
  const itemAnims = useRef(Array.from({length:MAX_ITEMS},()=>new Animated.Value(0))).current;
  const rtRef     = useRef<ReturnType<typeof supabase.channel>|null>(null);

  // ── ★ Fetch profil + comptes + stats gami — getDeviceId() ─────────────────
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      const uid = await getDeviceId();
      if (cancelled) return;

      const isNight = new Date().getHours()>=22||new Date().getHours()<4;

      const [profRes, favsRes, critRes, reelsRes, histRes] = await Promise.all([
        supabase.from('profiles')
          .select('id,username,display_name,avatar_url,role,is_pro')
          .eq('id',uid).maybeSingle(),
        supabase.from('user_favorites')
          .select('id',{count:'exact',head:true}).eq('user_id',uid),
        supabase.from('critiques')
          .select('id',{count:'exact',head:true}).eq('user_id',uid),
        supabase.from('reels')
          .select('id',{count:'exact',head:true}).eq('user_id',uid),
        supabase.from('user_history')
          .select('work_id',{count:'exact',head:true}).eq('user_id',uid),
      ]);

      if (!cancelled) {
        if (profRes.data) {
          setProfile({
            ...(profRes.data as any),
            filmCount:     favsRes.count  ?? 0,
            critiqueCount: critRes.count  ?? 0,
            reelCount:     reelsRes.count ?? 0,
          });
        }
        setGamiStats({
          watchCount:    histRes.count  ?? 0,
          critiqueCount: critRes.count  ?? 0,
          favCount:      favsRes.count  ?? 0,
          isNight,
        });
        setProfLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[]);

  // ── ★ Realtime profiles UPDATE → avatar/nom live ──────────────────────────
  useEffect(()=>{
    let alive = true;
    getDeviceId().then(uid=>{
      if (!alive) return;
      if (rtRef.current){supabase.removeChannel(rtRef.current);rtRef.current=null;}
      rtRef.current = supabase
        .channel(`dm_prof_${Date.now()}_${uid}`)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:`id=eq.${uid}`},
          ({new:row})=>{ if(alive) setProfile(prev=>prev?{...prev,...(row as any)}:prev); }
        )
        .subscribe();
    });
    return()=>{ alive=false; if(rtRef.current){supabase.removeChannel(rtRef.current);rtRef.current=null;} };
  },[]);

  // ── Genres disponibles dans public.reels approved ─────────────────────────
  useEffect(()=>{
    (async()=>{
      const {data} = await supabase.from('reels').select('genre').eq('status','approved').not('genre','is',null);
      const available = new Set((data??[]).map((r:any)=>(r.genre as string)?.trim()).filter(Boolean));
      const filtered: MenuItem[] = GENRES
        .filter(g=>available.has(g))
        .map(g=>({icon:GENRE_ICON[g]??'film-outline',label:g,key:g.toLowerCase().replace(/[^a-z0-9]/g,'-')}));
      setGenreItems(filtered);
      setGenreLoading(false);
    })();
  },[]);

  // ── Gamification computed ─────────────────────────────────────────────────
  const score  = useMemo(()=>gamiStats.watchCount*3+gamiStats.critiqueCount*8+gamiStats.favCount*2+(gamiStats.isNight?5:0),[gamiStats]);
  const level  = useMemo(()=>cinephileLevel(score),[score]);
  const badges = useMemo(()=>buildBadges(gamiStats),[gamiStats]);

  // ── Tous les items ─────────────────────────────────────────────────────────
  const allItems: MenuItem[] = useMemo(()=>[
    ...(STATIC_ITEMS as unknown as MenuItem[]),
    ...genreItems,
  ],[genreItems]);

  // ── Swipe-to-close ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder:(_,g)=>g.dx<-15&&Math.abs(g.dy)<40,
      onPanResponderMove:(_,g)=>{if(g.dx<0)slideX.setValue(Math.max(g.dx,-PANEL_W));},
      onPanResponderRelease:(_,g)=>{
        if(g.dx<-60||g.vx<-0.6) onClose();
        else Animated.spring(slideX,{toValue:0,useNativeDriver:true,speed:22,bounciness:4}).start();
      },
    })
  ).current;

  // ── Animations open / close — identique doc 4 ─────────────────────────────
  useEffect(()=>{
    if(visible){
      itemAnims.forEach(a=>a.setValue(0));
      statsAnim.setValue(0);
      slideX.setValue(0);
      bgOpacity.setValue(0.55);
      Animated.parallel([
        Animated.timing(statsAnim,{toValue:1,duration:200,useNativeDriver:true}),
        Animated.stagger(10,itemAnims.slice(0,allItems.length).map(a=>
          Animated.timing(a,{toValue:1,duration:140,useNativeDriver:true})
        )),
      ]).start();
    } else {
      slideX.setValue(-PANEL_W);
      bgOpacity.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible]);

  const handleSelect = useCallback((key:MenuKey)=>{
    hapticLight(); onSelect(key); onClose();
  },[onSelect,onClose]);

  if (!visible) return null;
  const staticCount = STATIC_ITEMS.length;

  return(
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.55)',opacity:bgOpacity}]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}/>
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[dm.panel,{transform:[{translateX:slideX}]}]} {...panResponder.panHandlers}>
        <PanelGalaxy/>
        <View style={dm.edgeLine}/>

        <SafeAreaView edges={['top','bottom']} style={{flex:1}}>

          {/* ★ Profile dynamique + XP + badges */}
          <ProfileHeader
            profile={profile} loading={profLoading}
            score={score} level={level} badges={badges}
            statsAnim={statsAnim}
          />

          <View style={dm.sep}/>

          {/* Items statiques */}
          <Text style={dm.sectionLabel}>NAVIGATION</Text>
          {allItems.slice(0,staticCount).map((item,idx)=>(
            <MenuItemRow
              key={item.key} item={item}
              isActive={activeKey===item.key}
              onPress={()=>handleSelect(item.key)}
              slideAnim={itemAnims[idx]}
            />
          ))}

          {/* Genres dynamiques */}
          {(genreItems.length>0||genreLoading)&&(
            <>
              <View style={dm.sep}/>
              <Text style={dm.sectionLabel}>
                {genreLoading?'GENRES…':`GENRES · ${genreItems.length}`}
              </Text>
            </>
          )}

          <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{paddingBottom:12}}>
            {genreLoading
              ? Array.from({length:4}).map((_,i)=>(
                  <View key={i} style={{paddingHorizontal:16,paddingVertical:8,flexDirection:'row',gap:12,alignItems:'center'}}>
                    <Shimmer w={32} h={32} r={10}/><Shimmer w={100} h={13} r={6}/>
                  </View>
                ))
              : allItems.slice(staticCount).map((item,idx)=>(
                  <MenuItemRow
                    key={item.key} item={item}
                    isActive={activeKey===item.key}
                    onPress={()=>handleSelect(item.key)}
                    slideAnim={itemAnims[staticCount+idx]}
                  />
                ))
            }
          </ScrollView>

          {/* Footer */}
          <View style={dm.footer}>
            <View style={dm.footerLine}/>
            <Text style={dm.footerBrand}>UNIVERSE</Text>
            <Text style={dm.footerSub}>Cinéma Indépendant · Beta</Text>
          </View>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
});

export default DropdownMenu;

// ─── Panel styles (identique doc 4) ──────────────────────────────────────────
const dm = StyleSheet.create({
  panel:        {position:'absolute',left:0,top:0,bottom:0,width:PANEL_W,borderRightWidth:StyleSheet.hairlineWidth,borderRightColor:T.border,overflow:'hidden',shadowColor:'#000',shadowOffset:{width:8,height:0},shadowOpacity:0.40,shadowRadius:24,elevation:20},
  edgeLine:     {position:'absolute',right:0,top:0,bottom:0,width:StyleSheet.hairlineWidth,backgroundColor:T.borderHi},
  sep:          {height:StyleSheet.hairlineWidth,backgroundColor:T.border,marginHorizontal:18,marginTop:8,marginBottom:8},
  sectionLabel: {color:T.textTert,fontSize:9,fontWeight:'700',letterSpacing:2.2,paddingHorizontal:20,marginBottom:4},
  footer:       {paddingHorizontal:20,paddingBottom:10,paddingTop:12,gap:3,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border},
  footerLine:   {width:20,height:StyleSheet.hairlineWidth,backgroundColor:T.border,marginBottom:6},
  footerBrand:  {color:T.textSec,fontSize:11,fontWeight:'900',letterSpacing:3},
  footerSub:    {color:T.textTert,fontSize:9,letterSpacing:0.5},
});