/**
 * components/reels/DropdownMenu.tsx
 *
 * Sidebar navigation — Universe
 *
 *  FOND      : GalaxyBackground (étoiles + météores) dans le panel
 *  PROFIL    : fetch dynamique public.profiles → avatar · stats · rôle · is_pro
 *              realtime UPDATE sync live
 *  GENRES    : liste GENRES (identique import modal) filtrée par public.reels approved
 *  STATIQUES : Pour vous · Tendances · Originaux · Cannes (toujours présents)
 *  WEB-SAFE  : BlurView + Haptics en require conditionnel
 */

import React, {
  memo, useEffect, useRef, useCallback, useState, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, ScrollView,
  PanResponder, Platform,
} from 'react-native';
import { Image }          from 'expo-image';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase }       from '@/lib/supabase';

// ── Web-safe ──────────────────────────────────────────────────────────────────
let _Haptics: any = null;
if (Platform.OS !== 'web') {
  try { _Haptics = require('expo-haptics'); } catch {}
}
function hapticLight() { _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(() => {}); }

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
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
  bg:       '#03000A',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get('window');
const PANEL_W = Math.min(W * 0.80, 320);

// ─────────────────────────────────────────────────────────────────────────────
// ★ GENRES — identique à l'import modal (create.tsx / GENRES)
// ─────────────────────────────────────────────────────────────────────────────
const GENRES = [
  'Drame','Comédie','Thriller','Horreur','Science-Fiction',
  'Documentaire','Animation','Romance','Action','Fantastique',
  'Policier','Biopic','Court-métrage','Expérimental',
] as const;

type GenreType = typeof GENRES[number];

const GENRE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Drame':           'heart-outline',
  'Comédie':         'happy-outline',
  'Thriller':        'skull-outline',
  'Horreur':         'flash-outline',
  'Science-Fiction': 'planet-outline',
  'Documentaire':    'camera-outline',
  'Animation':       'brush-outline',
  'Romance':         'rose-outline',
  'Action':          'flame-outline',
  'Fantastique':     'sparkles-outline',
  'Policier':        'shield-outline',
  'Biopic':          'person-outline',
  'Court-métrage':   'film-outline',
  'Expérimental':    'color-wand-outline',
};

// Items statiques en tête (toujours présents)
const STATIC_ITEMS = [
  { icon:'play-circle-outline' as const, label:'Pour vous',       key:'foryou'   },
  { icon:'flame-outline'       as const, label:'Tendances',        key:'trending' },
  { icon:'sparkles-outline'    as const, label:'Films ORIGINAL',   key:'original' },
  { icon:'trophy-outline'      as const, label:'Sélection Cannes', key:'cannes'   },
] as const;

export type MenuKey = string;
export { GENRES };

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface MenuItem {
  icon:  keyof typeof Ionicons.glyphMap;
  label: string;
  key:   string;
}
interface DropdownMenuProps {
  visible:   boolean;
  onClose:   () => void;
  onSelect:  (key: MenuKey) => void;
  activeKey: MenuKey;
}
interface ProfileData {
  id:               string;
  username:         string;
  display_name:     string;
  avatar_url:       string;
  role:             string;
  is_pro:           boolean;
  films_seen_count: number;
  followers_count:  number;
  following_count:  number;
  // Compteurs enrichis côté client
  filmCount?:     number;
  critiqueCount?: number;
  reelCount?:     number;
}

const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice',
  writer:'Scénariste',         actor:'Acteur·rice',
  dp:'Dir. photo',             editor:'Monteur·euse',
  critic:'Critique',           creator:'Créateur·rice',
};

// ─────────────────────────────────────────────────────────────────────────────
// ★ GALAXY BACKGROUND — inline pour le panel
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a:number,b:number) => a + Math.random()*(b-a);
const pick = <T,>(arr:T[]): T => arr[Math.floor(Math.random()*arr.length)];
const STAR_COLS = ['#F3EDFF','#B2CCFF','#FFE270','rgba(255,255,255,0.55)'];

interface StarPt { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number }
interface Met    { id:number; sx:number; sy:number; ang:number; len:number }

const PANEL_STARS: StarPt[] = Array.from({ length:40 }, (_,i) => ({
  id:i, x:rnd(0,PANEL_W), y:rnd(0,H), sz:rnd(0.8,2.0),
  col:pick(STAR_COLS), del:rnd(0,3500), dur:rnd(2000,5000),
}));

const PanelStar = memo(function PanelStar({ p }: { p:StarPt }) {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op,{toValue:0.85,duration:p.dur*0.5,useNativeDriver:true}),
      Animated.timing(op,{toValue:0.18,duration:p.dur*0.5,useNativeDriver:true}),
    ])).start();
  },[]);
  return <Animated.View style={{ position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:op }}/>;
});

const PanelShoot = memo(function PanelShoot({ m, onDone }: { m:Met; onDone:()=>void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op,{toValue:1,duration:100,useNativeDriver:true}),
        Animated.timing(op,{toValue:0,duration:400,delay:150,useNativeDriver:true}),
      ]),
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
    const iv = setInterval(()=>{
      if (Math.random()>0.70)
        setMeteors(ms=>[...ms,{id:Date.now(),sx:rnd(0,PANEL_W),sy:rnd(0,H*0.4),ang:rnd(25,55),len:rnd(60,120)}]);
    }, 3000);
    return ()=>clearInterval(iv);
  },[]);
  return(
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Fond gradient profond (visible = GalaxyBackground) */}
      <LinearGradient
        colors={['#03000A','#060F1E','#0A0A1E']}
        style={StyleSheet.absoluteFill}
      />
      {/* Étoiles */}
      {PANEL_STARS.map(s=><PanelStar key={s.id} p={s}/>)}
      {/* Météores */}
      {meteors.map(m=><PanelShoot key={m.id} m={m} onDone={()=>setMeteors(ms=>ms.filter(x=>x.id!==m.id))}/>)}
      {/* Voile navyMid léger pour lisibilité (opacity 0.45, pas 1.0) */}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor:`${NAVY}72` } as any}/>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const _shim = new Animated.Value(0.18);
let _shimGo = false;
function startShim() {
  if (_shimGo) return; _shimGo = true;
  Animated.loop(Animated.sequence([
    Animated.timing(_shim,{toValue:0.42,duration:800,useNativeDriver:true}),
    Animated.timing(_shim,{toValue:0.18,duration:800,useNativeDriver:true}),
  ])).start();
}
const Shimmer = memo(function Shimmer({ w,h,r=6 }:{ w:number|string; h:number; r?:number }) {
  useEffect(()=>{startShim();},[]);
  return <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:'rgba(255,255,255,0.09)',opacity:_shim}}/>;
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE HEADER — dynamique
// ─────────────────────────────────────────────────────────────────────────────
const ProfileHeader = memo(function ProfileHeader({
  profile, loading, statsAnim,
}: { profile:ProfileData|null; loading:boolean; statsAnim:Animated.Value }) {
  const ty = statsAnim.interpolate({ inputRange:[0,1], outputRange:[8,0] });

  if (loading||!profile) return(
    <Animated.View style={[ph.section,{opacity:statsAnim,transform:[{translateY:ty}]}]}>
      <View style={ph.profileRow}>
        <Shimmer w={52} h={52} r={26}/>
        <View style={{flex:1,gap:6}}>
          <Shimmer w="60%" h={14}/><Shimmer w="40%" h={11}/>
        </View>
      </View>
      <Shimmer w="100%" h={52} r={14}/>
    </Animated.View>
  );

  const roleLabel   = ROLE_LABELS[profile.role] ?? 'Cinéphile';
  const avatarUri   = profile.avatar_url || `https://i.pravatar.cc/100?u=${profile.id}`;
  const displayName = profile.display_name || profile.username;

  return(
    <Animated.View style={[ph.section,{opacity:statsAnim,transform:[{translateY:ty}]}]}>
      <View style={ph.profileRow}>
        <View style={ph.avatarWrap}>
          <LinearGradient colors={['#BF5FFF','#5A96E6','#F5C842']} style={ph.avatarRing} start={{x:0,y:0}} end={{x:1,y:1}}/>
          <Image source={{uri:avatarUri}} style={ph.avatar} contentFit="cover"/>
          {profile.is_pro&&<View style={ph.proBadge}><Ionicons name="checkmark-circle" size={12} color={T.gold}/></View>}
          <View style={ph.onlineDot}/>
        </View>
        <View style={{flex:1,gap:2}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={ph.name} numberOfLines={1}>{displayName}</Text>
            {profile.is_pro&&<View style={ph.proChip}><Text style={ph.proChipTxt}>PRO</Text></View>}
          </View>
          <Text style={ph.handle}>@{profile.username}</Text>
          <Text style={ph.niveau}>{roleLabel}</Text>
        </View>
      </View>


      {/* ★ Compteurs films / critiques / créas (comme profile.tsx header) */}
      <View style={ph.countsRow}>
        {[
          {v:profile.filmCount??0,     l:'films'    },
          {v:profile.critiqueCount??0, l:'critiques'},
          {v:profile.reelCount??0,     l:'créas'    },
        ].map(({v,l},i,arr)=>(
          <React.Fragment key={l}>
            <View style={ph.countItem}>
              <Text style={ph.countVal}>{v>=1000?`${(v/1000).toFixed(1)}K`:v}</Text>
              <Text style={ph.countLbl}>{l}</Text>
            </View>
            {i<arr.length-1&&<View style={ph.countDiv}/>}
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
});

const ph = StyleSheet.create({
  section:    {paddingHorizontal:20,paddingTop:14,paddingBottom:18},
  profileRow: {flexDirection:'row',alignItems:'center',gap:13,marginBottom:14},
  avatarWrap: {position:'relative'},
  avatarRing: {position:'absolute',top:-2,left:-2,right:-2,bottom:-2,borderRadius:29},
  avatar:     {width:52,height:52,borderRadius:26,borderWidth:2,borderColor:T.bg},
  proBadge:   {position:'absolute',bottom:0,right:0,width:16,height:16,borderRadius:8,backgroundColor:T.bg,alignItems:'center',justifyContent:'center'},
  onlineDot:  {position:'absolute',bottom:0,left:0,width:10,height:10,borderRadius:5,backgroundColor:'rgba(255,255,255,0.55)',borderWidth:2,borderColor:'#03000A'},
  name:       {color:'#FFFFFF',fontSize:15,fontWeight:'800',letterSpacing:-0.2,flexShrink:1},
  handle:     {color:'rgba(255,255,255,0.50)',fontSize:12,fontWeight:'500'},
  niveau:     {color:'rgba(255,255,255,0.30)',fontSize:10,fontWeight:'600',letterSpacing:0.3},
  proChip:    {paddingHorizontal:6,paddingVertical:1,borderRadius:6,backgroundColor:'rgba(245,200,66,0.20)',borderWidth:1,borderColor:'rgba(245,200,66,0.40)'},
  proChipTxt: {color:T.gold,fontSize:8,fontWeight:'900',letterSpacing:0.8},
  statsRow:   {flexDirection:'row',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:14,padding:12,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  statBlock:  {flex:1,alignItems:'center',gap:3},
  statVal:    {color:'#FFFFFF',fontSize:16,fontWeight:'900'},
  statLbl:    {color:'rgba(255,255,255,0.30)',fontSize:9,fontWeight:'600',textAlign:'center',letterSpacing:0.5},
  statDiv:    {width:StyleSheet.hairlineWidth,backgroundColor:T.border,marginVertical:4},
  // Films / critiques / créas row
  countsRow:  {flexDirection:'row',marginTop:10,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border},
  countItem:  {flex:1,alignItems:'center',gap:2},
  countVal:   {color:'#FFFFFF',fontSize:15,fontWeight:'900',letterSpacing:-0.3},
  countLbl:   {color:'rgba(255,255,255,0.35)',fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  countDiv:   {width:StyleSheet.hairlineWidth,height:28,backgroundColor:T.border},
});

// ─────────────────────────────────────────────────────────────────────────────
// MENU ITEM ROW
// ─────────────────────────────────────────────────────────────────────────────
const MenuItemRow = memo(function MenuItemRow({
  item, isActive, onPress, slideAnim,
}: { item:MenuItem; isActive:boolean; onPress:()=>void; slideAnim:Animated.Value }) {
  const tx = slideAnim.interpolate({inputRange:[0,1],outputRange:[-24,0]});
  const op = slideAnim.interpolate({inputRange:[0,1],outputRange:[0,1]});
  return(
    <Animated.View style={{transform:[{translateX:tx}],opacity:op}}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.65} style={[mi.item,isActive&&mi.itemActive]}>
        {isActive&&<View style={mi.accentBar}/>}
        <View style={[mi.iconWrap,isActive&&mi.iconWrapActive]}>
          <Ionicons name={item.icon} size={17} color={isActive?'#FFFFFF':T.textSec}/>
        </View>
        <Text style={[mi.label,isActive&&mi.labelActive]} numberOfLines={1}>{item.label}</Text>
        {isActive&&<Ionicons name="chevron-forward" size={12} color={T.textTert}/>}
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const DropdownMenu = memo(function DropdownMenu({
  visible, onClose, onSelect, activeKey,
}: DropdownMenuProps) {

  const [profile,      setProfile]      = useState<ProfileData|null>(null);
  const [profLoading,  setProfLoading]  = useState(true);
  const [genreItems,   setGenreItems]   = useState<MenuItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(true);

  const slideX    = useRef(new Animated.Value(-PANEL_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const MAX_ITEMS = STATIC_ITEMS.length + GENRES.length;
  const itemAnims = useRef(Array.from({length:MAX_ITEMS},()=>new Animated.Value(0))).current;

  // ── Fetch profile + counts (films / critiques / créas) ─────────────────────
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser();
      if (!user||cancelled){setProfLoading(false);return;}

      const [profRes, favsRes, critRes, reelsRes] = await Promise.all([
        supabase.from('profiles')
          .select('id,username,display_name,avatar_url,role,is_pro,films_seen_count,followers_count,following_count')
          .eq('id',user.id).maybeSingle(),
        supabase.from('user_favorites')
          .select('id',{count:'exact',head:true}).eq('user_id',user.id),
        supabase.from('critiques')
          .select('id',{count:'exact',head:true}).eq('user_id',user.id),
        supabase.from('reels')
          .select('id',{count:'exact',head:true}).eq('user_id',user.id),
      ]);

      if (!cancelled && profRes.data) {
        setProfile({
          ...(profRes.data as ProfileData),
          filmCount:     favsRes.count  ?? 0,
          critiqueCount: critRes.count  ?? 0,
          reelCount:     reelsRes.count ?? 0,
        });
        setProfLoading(false);
      } else if (!cancelled) {
        setProfLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[]);

  // ── Realtime profile ───────────────────────────────────────────────────────
  useEffect(()=>{
    let ch: ReturnType<typeof supabase.channel>|null=null;
    let mounted=true;
    supabase.auth.getUser().then(({data:{user}})=>{
      if (!user||!mounted) return;
      ch = supabase.channel(`dm_prof_${user.id}`)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},
          ({new:row})=>{
            if ((row as any).id===user.id&&mounted)
              setProfile(prev=>prev?{...prev,...(row as any)}:prev);
          })
        .subscribe();
    });
    return()=>{mounted=false;if(ch)supabase.removeChannel(ch);};
  },[]);

  // ── Fetch genres disponibles dans public.reels (approved) ─────────────────
  useEffect(()=>{
    (async()=>{
      const {data} = await supabase
        .from('reels').select('genre').eq('status','approved').not('genre','is',null);

      // Genres présents dans la DB (normalisés)
      const available = new Set(
        (data??[]).map((r:any)=>(r.genre as string)?.trim()).filter(Boolean)
      );

      // ★ Filtre GENRES (liste exacte de l'import modal) par ceux disponibles
      const filtered: MenuItem[] = GENRES
        .filter(g => available.has(g))
        .map(g => ({
          icon:  GENRE_ICON[g] ?? 'film-outline',
          label: g,
          key:   g.toLowerCase().replace(/[^a-z0-9]/g,'-'),
        }));

      setGenreItems(filtered);
      setGenreLoading(false);
    })();
  },[]);

  // ── Tous les items ─────────────────────────────────────────────────────────
  const allItems: MenuItem[] = useMemo(()=>[
    ...(STATIC_ITEMS as unknown as MenuItem[]),
    ...genreItems,
  ],[genreItems]);

  // ── Swipe-to-close ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder:(_,g)=>g.dx<-15&&Math.abs(g.dy)<40,
      onPanResponderMove:(_,g)=>{ if(g.dx<0) slideX.setValue(Math.max(g.dx,-PANEL_W)); },
      onPanResponderRelease:(_,g)=>{
        if (g.dx<-60||g.vx<-0.6) onClose();
        else Animated.spring(slideX,{toValue:0,useNativeDriver:true,speed:22,bounciness:4}).start();
      },
    }),
  ).current;

  // ── Animations open/close ──────────────────────────────────────────────────
  useEffect(()=>{
    if (visible){
      itemAnims.forEach(a=>a.setValue(0));
      statsAnim.setValue(0);
      slideX.setValue(0);
      bgOpacity.setValue(0.55);
      Animated.parallel([
        Animated.timing(statsAnim,{toValue:1,duration:200,useNativeDriver:true}),
        Animated.stagger(10, itemAnims.slice(0,allItems.length).map(a=>
          Animated.timing(a,{toValue:1,duration:140,useNativeDriver:true})
        )),
      ]).start();
    } else {
      slideX.setValue(-PANEL_W);
      bgOpacity.setValue(0);
    }
  },[visible]); // eslint-disable-line

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
      <Animated.View
        style={[dm.panel,{transform:[{translateX:slideX}]}]}
        {...panResponder.panHandlers}
      >
        {/* ★ GalaxyBackground dans le panel */}
        <PanelGalaxy/>

        {/* Bord droit */}
        <View style={dm.edgeLine}/>

        <SafeAreaView edges={['top','bottom']} style={{flex:1}}>

          {/* Profil dynamique */}
          <ProfileHeader profile={profile} loading={profLoading} statsAnim={statsAnim}/>

          <View style={dm.sep}/>

          {/* Items statiques */}
          <Text style={dm.sectionLabel}>NAVIGATION</Text>
          {allItems.slice(0,staticCount).map((item,idx)=>(
            <MenuItemRow
              key={item.key}
              item={item}
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
                {genreLoading ? 'GENRES…' : `GENRES · ${genreItems.length}`}
              </Text>
            </>
          )}

          <ScrollView
            style={{flex:1}}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{paddingBottom:12}}
          >
            {genreLoading ? (
              Array.from({length:4}).map((_,i)=>(
                <View key={i} style={{paddingHorizontal:16,paddingVertical:8,flexDirection:'row',gap:12,alignItems:'center'}}>
                  <Shimmer w={32} h={32} r={10}/><Shimmer w={100} h={13} r={6}/>
                </View>
              ))
            ) : (
              allItems.slice(staticCount).map((item,idx)=>(
                <MenuItemRow
                  key={item.key}
                  item={item}
                  isActive={activeKey===item.key}
                  onPress={()=>handleSelect(item.key)}
                  slideAnim={itemAnims[staticCount+idx]}
                />
              ))
            )}
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

// ─────────────────────────────────────────────────────────────────────────────
const dm = StyleSheet.create({
  panel: {
    position:'absolute',left:0,top:0,bottom:0,width:PANEL_W,
    borderRightWidth:StyleSheet.hairlineWidth,borderRightColor:T.border,
    overflow:'hidden',
    shadowColor:'#000',shadowOffset:{width:8,height:0},
    shadowOpacity:0.40,shadowRadius:24,elevation:20,
  },
  edgeLine: {position:'absolute',right:0,top:0,bottom:0,width:StyleSheet.hairlineWidth,backgroundColor:T.borderHi},
  sep:          {height:StyleSheet.hairlineWidth,backgroundColor:T.border,marginHorizontal:18,marginTop:8,marginBottom:8},
  sectionLabel: {color:T.textTert,fontSize:9,fontWeight:'700',letterSpacing:2.2,paddingHorizontal:20,marginBottom:4},
  footer:       {paddingHorizontal:20,paddingBottom:10,paddingTop:12,gap:3,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border},
  footerLine:   {width:20,height:StyleSheet.hairlineWidth,backgroundColor:T.border,marginBottom:6},
  footerBrand:  {color:T.textSec,fontSize:11,fontWeight:'900',letterSpacing:3},
  footerSub:    {color:T.textTert,fontSize:9,letterSpacing:0.5},
});