/**
 * components/reels/DropdownMenu.tsx — UNIVERSE
 *
 * ★ getDeviceId()  — ZERO supabase.auth.* (replace auth.getUser partout)
 * ★ Profil dynamique : profiles (avatar / nom / rôle / pro) — Realtime UPDATE
 * ★ Genres 100% dynamiques depuis public.genres — filtrage réel des reels
 * ★ Rubrique "Tous les genres" fixe en tête de liste
 * ★ PanelGalaxy · swipe-to-close · stagger animations — UX v4 identique
 *
 * ★★ FILTRAGE PAR GENRE (important) ★★
 * `key` de chaque item = `genres.value` EXACT (jamais un label formaté).
 * C'est cette valeur qui doit matcher la colonne `reels.genre` en DB.
 * Le parent (écran feed) doit consommer `onSelect(key)` ainsi :
 *
 *   const handleGenreSelect = (key: MenuKey) => {
 *     setActiveGenre(key); // 'all' | 'drame_intimiste' | 'film_auteur' | ...
 *   };
 *
 *   // Query reels :
 *   let q = supabase.from('reels').select('*').eq('status','approved');
 *   if (activeGenre !== 'all') q = q.eq('genre', activeGenre);
 *
 * Si le filtre ne renvoie toujours rien après ça : vérifier que
 * `reels.genre` contient bien exactement les mêmes strings que
 * `genres.value` (accents/casse/underscores identiques des deux côtés).
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
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
  bg:       '#03000A',
} as const;

const { width: W, height: H } = Dimensions.get('window');
const PANEL_W = Math.min(W * 0.80, 320);

// ─── Formattage d'affichage — retire underscores/tirets, capitalise ──────────
// N'affecte QUE le texte affiché à l'écran. La clé de sélection (value DB)
// n'est jamais modifiée pour garantir un matching exact avec reels.genre.
function formatLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Icône par genre (heuristique sur value — genres 100% DB) ────────────────
function iconForGenre(value: string): keyof typeof Ionicons.glyphMap {
  const v = value.toLowerCase();
  if (v.includes('drame'))                           return 'heart-outline';
  if (v.includes('comedie') || v.includes('comédie')) return 'happy-outline';
  if (v.includes('thriller'))                        return 'skull-outline';
  if (v.includes('horreur'))                         return 'flash-outline';
  if (v.includes('scifi') || v.includes('science'))   return 'planet-outline';
  if (v.includes('documentaire'))                    return 'camera-outline';
  if (v.includes('animation'))                       return 'brush-outline';
  if (v.includes('romance'))                         return 'rose-outline';
  if (v.includes('action'))                          return 'flame-outline';
  if (v.includes('fantastique'))                     return 'sparkles-outline';
  if (v.includes('policier'))                        return 'shield-outline';
  if (v.includes('biopic'))                          return 'person-outline';
  if (v.includes('court'))                           return 'film-outline';
  if (v.includes('experimental') || v.includes('expérimental')) return 'color-wand-outline';
  if (v.includes('auteur'))                          return 'create-outline';
  if (v.includes('intimiste'))                       return 'heart-half-outline' as any;
  return 'film-outline';
}

const ALL_GENRES_KEY = 'all';

export type MenuKey = string;

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItem    { icon:keyof typeof Ionicons.glyphMap; label:string; key:string }
interface DropdownMenuProps { visible:boolean; onClose:()=>void; onSelect:(key:MenuKey)=>void; activeKey:MenuKey }
interface ProfileData {
  id:string; username:string; display_name:string;
  avatar_url:string; role:string; is_pro:boolean;
}
interface GenreRow {
  id:number; value:string; label:string; description:string|null; sort_order:number;
}

const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
  critic:'Critique', creator:'Créateur·rice',
};

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

// ─── ★ PROFILE HEADER (avatar / nom / rôle) ──────────────────────────────────
const ProfileHeader = memo(function ProfileHeader({
  profile, loading, statsAnim,
}:{
  profile:ProfileData|null; loading:boolean;
  statsAnim:Animated.Value;
}) {
  const ty = statsAnim.interpolate({inputRange:[0,1],outputRange:[8,0]});

  if (loading || !profile) return(
    <Animated.View style={[ph.section,{opacity:statsAnim,transform:[{translateY:ty}]}]}>
      <View style={ph.profileRow}>
        <Shimmer w={52} h={52} r={26}/>
        <View style={{flex:1,gap:6}}><Shimmer w="60%" h={14}/><Shimmer w="40%" h={11}/></View>
      </View>
    </Animated.View>
  );

  const roleLabel   = ROLE_LABELS[profile.role] ?? 'Cinéphile';
  const avatarUri   = profile.avatar_url || `https://i.pravatar.cc/100?u=${profile.id}`;
  const displayName = profile.display_name || profile.username;

  return(
    <Animated.View style={[ph.section,{opacity:statsAnim,transform:[{translateY:ty}]}]}>
      <View style={ph.profileRow}>
        <View style={ph.avatarWrap}>
          <Image source={{uri:avatarUri}} style={ph.avatar} contentFit="cover"/>
          {profile.is_pro && <View style={ph.proBadge}><Ionicons name="checkmark-circle" size={12} color={T.gold}/></View>}
        </View>
        <View style={{flex:1,gap:2}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={ph.name} numberOfLines={1}>{displayName}</Text>
            {profile.is_pro && <View style={ph.proChip}><Text style={ph.proChipTxt}>PRO</Text></View>}
          </View>
          <Text style={ph.handle}>@{profile.username}</Text>
          <Text style={ph.niveau}>{roleLabel}</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const ph = StyleSheet.create({
  section:    {paddingHorizontal:20,paddingTop:14,paddingBottom:16},
  profileRow: {flexDirection:'row',alignItems:'center',gap:13},
  avatarWrap: {position:'relative'},
  avatar:     {width:52,height:52,borderRadius:26,borderWidth:2,borderColor:T.bg},
  proBadge:   {position:'absolute',bottom:0,right:0,width:16,height:16,borderRadius:8,backgroundColor:T.bg,alignItems:'center',justifyContent:'center'},
  name:       {color:'#FFFFFF',fontSize:15,fontWeight:'800',letterSpacing:-0.2,flexShrink:1},
  handle:     {color:'rgba(255,255,255,0.45)',fontSize:11,fontWeight:'500'},
  niveau:     {color:'rgba(255,255,255,0.30)',fontSize:9,fontWeight:'600',letterSpacing:0.3},
  proChip:    {paddingHorizontal:6,paddingVertical:1,borderRadius:6,backgroundColor:'rgba(245,200,66,0.20)',borderWidth:1,borderColor:'rgba(245,200,66,0.40)'},
  proChipTxt: {color:T.gold,fontSize:8,fontWeight:'900',letterSpacing:0.8},
});

// ─── Menu Item Row ────────────────────────────────────────────────────────────
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
  item:           {flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,gap:12,overflow:'hidden'},
  itemActive:     {backgroundColor:T.active},
  accentBar:      {position:'absolute',left:0,top:5,bottom:5,width:3,backgroundColor:'rgba(255,255,255,0.45)',borderRadius:2},
  iconWrap:       {width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  iconWrapActive: {backgroundColor:T.surfHi,borderColor:T.borderHi},
  label:          {flex:1,color:T.textSec,fontSize:13,fontWeight:'500'},
  labelActive:    {color:T.text,fontWeight:'700'},
});

// ─── ★ MAIN ───────────────────────────────────────────────────────────────────
const DropdownMenu = memo(function DropdownMenu({
  visible, onClose, onSelect, activeKey,
}:DropdownMenuProps) {

  const [profile,      setProfile]      = useState<ProfileData|null>(null);
  const [profLoading,  setProfLoading]  = useState(true);
  const [genreItems,   setGenreItems]   = useState<MenuItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(true);

  const slideX    = useRef(new Animated.Value(-PANEL_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef<Animated.Value[]>([]).current;
  const rtRef     = useRef<ReturnType<typeof supabase.channel>|null>(null);

  // itemAnims doit couvrir "Tous les genres" (1) + N genres. Recrée le pool
  // seulement quand la taille change, pour éviter tout re-render inutile.
  if (itemAnims.length !== genreItems.length + 1) {
    itemAnims.length = 0;
    itemAnims.push(...Array.from({length:genreItems.length + 1},()=>new Animated.Value(0)));
  }

  // ── ★ Fetch profil — getDeviceId() ────────────────────────────────────────
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      const uid = await getDeviceId();
      if (cancelled) return;

      const { data } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,role,is_pro')
        .eq('id',uid).maybeSingle();

      if (!cancelled) {
        if (data) setProfile(data as any);
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

  // ── ★ Genres 100% dynamiques depuis public.genres ─────────────────────────
  useEffect(()=>{
    (async()=>{
      const { data, error } = await supabase
        .from('genres')
        .select('id,value,label,description,sort_order')
        .eq('active', true)
        .order('sort_order', { ascending:true })
        .order('label',      { ascending:true });

      if (!error && data) {
        const items: MenuItem[] = (data as GenreRow[]).map(g=>({
          icon:  iconForGenre(g.value),
          label: formatLabel(g.label || g.value), // affichage propre, sans "_"
          key:   g.value,                         // ★ valeur EXACTE pour le filtre reels.genre
        }));
        setGenreItems(items);
      }
      setGenreLoading(false);
    })();
  },[]);

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

  // ── Animations open / close ────────────────────────────────────────────────
  useEffect(()=>{
    if(visible){
      itemAnims.forEach(a=>a.setValue(0));
      statsAnim.setValue(0);
      slideX.setValue(0);
      bgOpacity.setValue(0.55);
      Animated.parallel([
        Animated.timing(statsAnim,{toValue:1,duration:200,useNativeDriver:true}),
        Animated.stagger(10,itemAnims.map(a=>
          Animated.timing(a,{toValue:1,duration:140,useNativeDriver:true})
        )),
      ]).start();
    } else {
      slideX.setValue(-PANEL_W);
      bgOpacity.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible,genreItems.length]);

  const handleSelect = useCallback((key:MenuKey)=>{
    hapticLight(); onSelect(key); onClose();
  },[onSelect,onClose]);

  if (!visible) return null;

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

          {/* ★ Profil dynamique */}
          <ProfileHeader profile={profile} loading={profLoading} statsAnim={statsAnim}/>

          <View style={dm.sep}/>

          {/* ★ Tous les genres — rubrique fixe, affiche tous les reels */}
          <Text style={dm.sectionLabel}>GENRES</Text>
          <MenuItemRow
            item={{ icon:'grid-outline', label:'Tous les genres', key:ALL_GENRES_KEY }}
            isActive={activeKey===ALL_GENRES_KEY}
            onPress={()=>handleSelect(ALL_GENRES_KEY)}
            slideAnim={itemAnims[0]}
          />

          {(genreItems.length>0||genreLoading)&&(
            <>
              <View style={dm.sep}/>
              <Text style={dm.sectionLabel}>
                {genreLoading?'CHARGEMENT…':`PAR GENRE · ${genreItems.length}`}
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
              : genreItems.map((item,idx)=>(
                  <MenuItemRow
                    key={item.key} item={item}
                    isActive={activeKey===item.key}
                    onPress={()=>handleSelect(item.key)}
                    slideAnim={itemAnims[1+idx]}
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

// ─── Panel styles ─────────────────────────────────────────────────────────────
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