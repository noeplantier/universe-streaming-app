// ═══════════════════════════════════════════════════════════════════
//  index.tsx — UNIVERSE / Feed principal (Reels)
//  ─────────────────────────────────────────────────────────────────
//  Reproduction pixel-perfect du mockup image.
//
//  Fonctionnalités :
//  ┌─ GalaxyCanvas           — fond étoilé animé (7 couches)
//  ├─ Header                 — "≡ Pour vous ↓"  +  "Amies 🧑‍🤝‍🧑 🌍"
//  ├─ DropdownMenu           — panneau glissant, goûts ciné
//  ├─ FeedItem (plein écran) — video/image + overlay galaxie
//  │   ├─ CaptionText        — sous-titre style citation
//  │   ├─ RightActionBar     — ••• · ♥ · ≡↑ · ★
//  │   └─ BottomCard         — épisode · progress · amis · follow
//  └─ GalaxyTabBar           — Accueil · Reels · ✦ · Amies · Profil
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Animated, Easing, Dimensions, Modal, StatusBar,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useRouter }         from 'expo-router';
import { COLORS, RADIUS, GRADIENTS } from '../../constants/theme';
import { filmsAPI }          from '../../services/api';

const { width: W, height: H } = Dimensions.get('window');
const ITEM_H = H; // chaque item = plein écran

// ═══════════════════════════════════════════════════════════════════
//  PALETTE
// ═══════════════════════════════════════════════════════════════════
const P = {
  bg:      '#07000F',
  surface: '#130025',
  glass:   'rgba(255,255,255,0.07)',
  primary: '#9240D6',
  primL:   '#C060FF',
  primGl:  'rgba(146,64,214,0.38)',
  t1:      '#F0E8FF',
  t2:      'rgba(240,232,255,0.62)',
  t3:      'rgba(240,232,255,0.36)',
  bord:    'rgba(146,64,214,0.30)',
  bordL:   'rgba(255,255,255,0.10)',
  red:     '#EF4444',
  gold:    '#FFD60A',
  // galaxy
  neb0: 'rgba(105,16,190,0.30)',
  neb1: 'rgba(170,24,158,0.20)',
  neb2: 'rgba(22,14,182,0.15)',
  neb3: 'rgba(52,0,90,0.26)',
  mwC:  'rgba(125,55,215,0.09)',
  mwE:  'rgba(80,30,130,0.00)',
  sW:   '#F2ECFF', sB:'#B0CAFF',
  sG:   '#FFE068', sP:'#CC95FF', sCy:'#84ECFF',
};

// ═══════════════════════════════════════════════════════════════════
//  GALAXY ANIMATION — auto-contenu, 7 couches, 60fps
// ═══════════════════════════════════════════════════════════════════
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id:number;x:number;y:number;sz:number;col:string;del:number;dur:number;mn:number;mx:number; }
interface Sp  extends Pt { arm:number; }
interface Neb { x:number;y:number;w:number;h:number;col:string;del:number;dur:number; }
interface Met { id:number;sx:number;sy:number;ang:number;len:number; }

const DUST:   Pt[] = Array.from({length:55},(_,i)=>({id:i,x:rnd(0,W),y:rnd(0,H*1.1),sz:rnd(0.3,1.0),col:pick([P.sW,P.sW,P.sB]),del:rnd(0,6000),dur:rnd(2800,6400),mn:0.04,mx:0.38}));
const STARS:  Pt[] = Array.from({length:40},(_,i)=>({id:i,x:rnd(0,W),y:rnd(0,H*1.1),sz:rnd(0.9,2.1),col:pick([P.sW,P.sB,P.sP,P.sG,P.sW]),del:rnd(0,4200),dur:rnd(1500,4000),mn:0.22,mx:0.92}));
const BRIGHT: Pt[] = Array.from({length:12},(_,i)=>({id:i,x:rnd(0,W),y:rnd(0,H),sz:rnd(2.3,3.9),col:pick([P.sW,P.sCy,P.sP]),del:rnd(0,3000),dur:rnd(900,2600),mn:0.40,mx:1.0}));
const SPARKS: Sp[] = Array.from({length:7}, (_,i)=>({id:i,x:rnd(W*0.04,W*0.96),y:rnd(0,H*0.85),sz:2,arm:rnd(7,18),col:pick([P.sW,'#C29EFF',P.sG]),del:rnd(0,4800),dur:rnd(1900,5000),mn:0.18,mx:0.85}));
const NEBULAE: Neb[] = [
  {x:-90,y:-75,w:310,h:255,col:P.neb0,del:0,dur:5500},
  {x:W*0.48,y:H*0.06,w:275,h:215,col:P.neb1,del:1600,dur:6200},
  {x:-50,y:H*0.45,w:300,h:240,col:P.neb2,del:2800,dur:5800},
  {x:W*0.54,y:H*0.64,w:250,h:200,col:P.neb3,del:750,dur:6500},
];
;

// ═══════════════════════════════════════════════════════════════════
//  TYPES & MOCK DATA
// ═══════════════════════════════════════════════════════════════════

interface Friend {
  id: string; name: string; avatar: string; followed: boolean;
}

interface FeedFilm {
  id: string; title: string; series: string;
  episode: number; episode_title: string;
  poster_url: string; video_url?: string;
  caption: string; duration: string;
  likes: number; liked_by_friends: Friend[];
  tags: string[]; director: string; year: number;
  comment?: string;
}

const FRIENDS_POOL: Friend[] = [
  { id:'f1', name:'@lucie_mv',  avatar:'https://i.pravatar.cc/60?img=9',  followed:true  },
  { id:'f2', name:'@marc.film', avatar:'https://i.pravatar.cc/60?img=12', followed:false },
  { id:'f3', name:'@anaelle_c', avatar:'https://i.pravatar.cc/60?img=22', followed:true  },
  { id:'f4', name:'@hugo_cine', avatar:'https://i.pravatar.cc/60?img=33', followed:false },
  { id:'f5', name:'@soph_art',  avatar:'https://i.pravatar.cc/60?img=47', followed:true  },
];

const MOCK_FEED: FeedFilm[] = [
  {
    id:'1', title:'Puffers', series:'Puffers', episode:1,
    episode_title:'Reprends là où tu t\'es arrêté',
    poster_url:'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    caption:'oh you are an actor...\nwhat have i seen you in?',
    duration:'3:00', likes:1324,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[1],FRIENDS_POOL[2]],
    tags:['Thriller','Indépendant'], director:'Sophie Martin', year:2024,
    comment:'ça a l\'air super...',
  },
  {
    id:'2', title:'Nuit de Verre', series:'Nuit de Verre', episode:1,
    episode_title:'La première fracture',
    poster_url:'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    caption:'parfois l\'obscurité\nest la seule lumière',
    duration:'4:30', likes:872,
    liked_by_friends:[FRIENDS_POOL[2],FRIENDS_POOL[4]],
    tags:['Drame','Court métrage'], director:'Karim Belhadj', year:2024,
    comment:'cette scène m\'a touché...',
  },
  {
    id:'3', title:'Horizon Brisé', series:'Horizon Brisé', episode:2,
    episode_title:'Le dernier signal',
    poster_url:'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    caption:'jusqu\'où peut-on\naller pour la vérité ?',
    duration:'5:12', likes:2100,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[3],FRIENDS_POOL[4]],
    tags:['Sci-Fi','ORIGINAL'], director:'Emma Dupont', year:2023,
    comment:'le bro Enzo boit l\'eau des pates',
  },
  {
    id:'4', title:'Velours Rouge', series:'Velours Rouge', episode:3,
    episode_title:'Masques',
    poster_url:'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    caption:'qui sommes-nous\nsans nos masques ?',
    duration:'6:45', likes:3400,
    liked_by_friends:[FRIENDS_POOL[1],FRIENDS_POOL[2]],
    tags:['Romance','Festival'], director:'Isabelle Morin', year:2024,
    comment:'romantique et douloureux...',
  },
  {
    id:'5', title:'Fractures', series:'Fractures', episode:1,
    episode_title:'Avant le tremblement',
    poster_url:'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    caption:'dans chaque fissure\nse cache une histoire',
    duration:'8:10', likes:2750,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[1],FRIENDS_POOL[2],FRIENDS_POOL[3]],
    tags:['Documentaire','Indépendant'], director:'Lucas Moreau', year:2023,
  },
  {
    id:'6', title:'Échos du Passé', series:'Échos du Passé', episode:4,
    episode_title:'Les voix oubliées',
    poster_url:'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    caption:'les souvenirs\nsont des fantômes bienveillants',
    duration:'7:20', likes:2890,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[1],FRIENDS_POOL[3]],
    tags:['Fantasy','Indépendant'], director:'Sophie Martin', year:2023,
    comment:'une aventure onirique incroyable !',
    },
    {
    id:'7', title:'Miroirs Brisés', series:'Miroirs Brisés', episode:2,
    episode_title:'Reflets déformés',
    poster_url:'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Yosemite.mp4',
    caption:'parfois le reflet\nest plus vrai que la réalité',
    duration:'5:50', likes:1980,
    liked_by_friends:[FRIENDS_POOL[1],FRIENDS_POOL[4]],
    tags:['Thriller','Festival'], director:'Karim Belhadj', year:2024,

    },
    {
    id:'8', title:'Sables Mouvants', series:'Sables Mouvants', episode:1,
    episode_title:'Enfouis sous les pas',
    poster_url:'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Zeus.mp4',
    caption:'parfois il faut s\'enfoncer\npour mieux se relever',
    duration:'6:30', likes:1650,
    liked_by_friends:[FRIENDS_POOL[2],FRIENDS_POOL[3]],
    tags:['Thriller','ORIGINAL'], director:'Emma Dupont', year:2024,
    },
    {

    id:'9', title:'Lueurs d\'Espoir', series:'Lueurs d\'Espoir', episode:3,
    episode_title:'Au bout du tunnel',
    poster_url:'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    caption:'même dans les ténèbres\nune lueur peut guider nos pas',
    duration:'4:45', likes:2200,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[4]],
    tags:['Drame','Indépendant'], director:'Isabelle Morin', year:2023,

    },
    {
    id:'10', title:'Rêves Suspendus', series:'Rêves Suspendus', episode:2,
    episode_title:'Entre deux mondes',
    poster_url:'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    caption:'parfois les rêves\nsont les seuls refuges qui restent',
    duration:'7:05', likes:3100,
    liked_by_friends:[FRIENDS_POOL[1],FRIENDS_POOL[2],FRIENDS_POOL[3],FRIENDS_POOL[4]],
    tags:['Fantasy','Festival'], director:'Lucas Moreau', year:2024,

    },
    {
    id:'11', title:'Ombres Errantes', series:'Ombres Errantes', episode:1,
    episode_title:'Perdus dans la nuit',
    poster_url:'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    caption:'parfois il faut se perdre\npour mieux se retrouver',
    duration:'5:40', likes:2750,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[3]],
    tags:['Thriller','Indépendant'], director:'Sophie Martin', year:2023,
    },
  
    {
    id:'14', title:'Sombres Horizons', series:'Sombres Horizons', episode:3,
    episode_title:'L\'aube d\'un nouveau jour',
    poster_url:'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    caption:'même dans les moments les plus sombres\nil y a toujours une lueur d\'espoir',
    duration:'7:30', likes:3200,
    liked_by_friends:[FRIENDS_POOL[0],FRIENDS_POOL[1],FRIENDS_POOL[4]],
    tags:['Sci-Fi','Indépendant'], director:'Isabelle Morin', year:2024,
    comment:'une épopée futuriste époustouflante !',
      },
      {
    id:'15', title:'Mémoires Oubliées', series:'Mémoires Oubliées', episode:1,
    episode_title:'Les fragments du passé',
    poster_url:'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    video_url:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerSmiles.mp4',
    caption:'parfois les souvenirs oubliés\nsont les plus précieux',
    duration:'5:55', likes:2100,
    liked_by_friends:[FRIENDS_POOL[1],FRIENDS_POOL[3]],
    tags:['Documentaire','Festival'], director:'Lucas Moreau', year:2023,
    comment:'un voyage émouvant à travers les souvenirs perdus...',



      }

];

// ═══════════════════════════════════════════════════════════════════
//  MENU DÉROULANT — Goûts cinématographiques
// ═══════════════════════════════════════════════════════════════════

const MENU_ITEMS = [
  { icon:'🎬', label:'Pour vous',      key:'foryou',   active:true  },
  { icon:'🌟', label:'Courts métrages',key:'short',    active:false },
  { icon:'🎭', label:'Drame',          key:'drama',    active:false },
  { icon:'🚀', label:'Science-Fiction',key:'scifi',    active:false },
  { icon:'💜', label:'Romance',        key:'romance',  active:false },
  { icon:'🔪', label:'Thriller',       key:'thriller', active:false },
  { icon:'✨', label:'Films ORIGINAL', key:'original', active:false },
  { icon:'🏆', label:'Sélection Cannes',key:'cannes',  active:false },
  { icon:'🎪', label:'Fantasy',        key:'fantasy',  active:false },
  { icon:'📽',  label:'Documentaire',  key:'docu',     active:false },
  { icon:'🎨', label:'Animation',      key:'anim',     active:false },
  { icon:'🔥', label:'Tendances',      key:'trend',    active:false },
];

interface DropdownMenuProps { visible:boolean; onClose:()=>void; onSelect:(key:string)=>void; activeKey:string; }
function DropdownMenu({ visible, onClose, onSelect, activeKey }: DropdownMenuProps) {
  const slideX = useRef(new Animated.Value(-W * 0.78)).current;
  const bgOp   = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(visible){
      Animated.parallel([
        Animated.spring(slideX,{toValue:0,useNativeDriver:true,speed:18,bounciness:3}),
        Animated.timing(bgOp,{toValue:1,duration:250,useNativeDriver:true}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,{toValue:-W*0.78,duration:230,easing:Easing.in(Easing.quad),useNativeDriver:true}),
        Animated.timing(bgOp,{toValue:0,duration:220,useNativeDriver:true}),
      ]).start();
    }
  },[visible]);

  if(!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dark overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.6)',opacity:bgOp}]}/>
      </TouchableWithoutFeedback>

      {/* Slide-in panel */}
      <Animated.View style={[dm.panel,{transform:[{translateX:slideX}]}]}>
        {/* Galaxy accent strip */}
        <View style={dm.glowStrip}/>

        <SafeAreaView edges={['top']} style={{flex:1}}>
          {/* Header */}
          <View style={dm.header}>
            <Text style={dm.headerTitle}>Mon Univers</Text>
            <Text style={dm.headerSub}>Mes goûts cinématographiques</Text>
          </View>

          {/* Items */}
          {MENU_ITEMS.map(item=>{
            const isActive = activeKey===item.key;
            return(
              <TouchableOpacity key={item.key} onPress={()=>{onSelect(item.key);onClose();}} activeOpacity={0.75}
                style={[dm.item, isActive&&dm.itemActive]}>
                {isActive && <View style={dm.itemAccentBar}/>}
                <Text style={dm.itemIcon}>{item.icon}</Text>
                <Text style={[dm.itemLabel,isActive&&dm.itemLabelActive]}>{item.label}</Text>
                {isActive && <View style={dm.itemDot}/>}
              </TouchableOpacity>
            );
          })}

          {/* Footer */}
          <View style={dm.footer}>
            <Text style={dm.footerTxt}>UNIVERSE · Films indépendants</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const dm = StyleSheet.create({
  panel:        { position:'absolute', left:0, top:0, bottom:0, width:W*0.78, backgroundColor:'rgba(10,0,22,0.97)', borderRightWidth:1, borderRightColor:P.bord },
  glowStrip:    { position:'absolute', right:0, top:0, bottom:0, width:1.5, backgroundColor:P.primL, opacity:0.45, shadowColor:P.primL, shadowOffset:{width:0,height:0}, shadowOpacity:1, shadowRadius:8 },
  header:       { paddingHorizontal:22, paddingTop:16, paddingBottom:22, borderBottomWidth:1, borderBottomColor:'rgba(146,64,214,0.20)' },
  headerTitle:  { color:P.t1, fontSize:20, fontWeight:'900', letterSpacing:0.3, marginBottom:3 },
  headerSub:    { color:P.t3, fontSize:12 },
  item:         { flexDirection:'row', alignItems:'center', paddingHorizontal:22, paddingVertical:15, gap:14, position:'relative' },
  itemActive:   { backgroundColor:'rgba(146,64,214,0.14)' },
  itemAccentBar:{ position:'absolute', left:0, top:0, bottom:0, width:3, backgroundColor:P.primL, borderRadius:2 },
  itemIcon:     { fontSize:20, width:28, textAlign:'center' },
  itemLabel:    { flex:1, color:P.t2, fontSize:15, fontWeight:'500' },
  itemLabelActive:{ color:P.t1, fontWeight:'800' },
  itemDot:      { width:7, height:7, borderRadius:4, backgroundColor:P.primL, shadowColor:P.primL, shadowOffset:{width:0,height:0}, shadowOpacity:1, shadowRadius:5 },
  footer:       { position:'absolute', bottom:40, left:22, right:22 },
  footerTxt:    { color:P.t3, fontSize:10, letterSpacing:2, fontWeight:'700' },
});

// ═══════════════════════════════════════════════════════════════════
//  HEADER TOP — "≡ Pour vous ↓"  +  "Amies 🧑‍🤝‍🧑 🌍"
// ═══════════════════════════════════════════════════════════════════
interface TopHeaderProps { feedKey:string; onMenuPress:()=>void; }
function TopHeader({ feedKey, onMenuPress }: TopHeaderProps) {
  const router = useRouter();
  const item = MENU_ITEMS.find(m=>m.key===feedKey) ?? MENU_ITEMS[0];

  return (
    <View style={th.container} pointerEvents="box-none">
      {/* Left: ≡ + label + ↓ */}
      <TouchableOpacity 
        onPress={onMenuPress} 
        style={th.leftBtn} 
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={th.hamburger}>
          <View style={[th.hLine,{width:18}]}/><View style={[th.hLine,{width:12}]}/><View style={[th.hLine,{width:18}]}/>
        </View>
        <Text style={th.feedLabel}>{item.label}</Text>
        <Ionicons name="chevron-down" size={12} color={P.t2} style={{marginTop:2}}/>
      </TouchableOpacity>

      {/* Right: "Amies" + emoji avatars */}
      <TouchableOpacity 
        style={th.rightGroup} 
        activeOpacity={0.7}
        onPress={() => router.push('/social')}
      >
        <Text style={th.amiesLabel}>Amies</Text>
        <View style={th.avatarPile}>
          {FRIENDS_POOL.slice(0,2).map((f,i)=>(
            <Image 
              key={f.id} 
              source={{uri:f.avatar}} 
              style={[th.avatar,{marginLeft:i>0?-10:0,zIndex:10-i}]}
            />
          ))}
          {/* Globe icon */}
          <View style={[th.avatar,th.globeCircle,{marginLeft:-10,zIndex:0}]}>
            <Text style={{fontSize:12}}>🌍</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const th = StyleSheet.create({
  container:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:12 },
  leftBtn:    { flexDirection:'row', alignItems:'center', gap:10 },
  hamburger:  { gap:4 },
  hLine:      { height:2, borderRadius:1, backgroundColor:P.t1 },
  feedLabel:  { color:P.t1, fontSize:18, fontWeight:'700', letterSpacing:0.2 },
  
  rightGroup: { flexDirection:'row', alignItems:'center', gap:10, paddingLeft:10 },
  amiesLabel: { color:P.t2, fontSize:15, fontWeight:'600' },
  avatarPile: { flexDirection:'row', alignItems:'center' },
  avatar:     { width:32, height:32, borderRadius:16, borderWidth:2, borderColor:P.bg },
  globeCircle:{ backgroundColor:P.surface, alignItems:'center', justifyContent:'center', borderColor:P.bg },
});

// ═══════════════════════════════════════════════════════════════════
//  RIGHT ACTION BAR  — ••• · ♥ · ≡↑ · ★
// ═══════════════════════════════════════════════════════════════════
interface RightBarProps { film:FeedFilm; liked:boolean; onLike:()=>void; onInfo:()=>void; onStar:()=>void; }
function RightBar({ film, liked, onLike, onInfo, onStar }: RightBarProps) {
  const heartSc = useRef(new Animated.Value(1)).current;

  function pressHeart() {
    Animated.sequence([
      Animated.timing(heartSc,{toValue:1.42,duration:110,useNativeDriver:true}),
      Animated.spring(heartSc,{toValue:1,useNativeDriver:true,speed:22}),
    ]).start();
    onLike();
  }

  return (
    <View style={rb.bar}>
      {/* ••• More */}
      <TouchableOpacity style={rb.btn} activeOpacity={0.8}>
        <View style={rb.dots}><View style={rb.dot}/><View style={rb.dot}/><View style={rb.dot}/></View>
      </TouchableOpacity>

      {/* ♥ Like */}
      <View style={rb.item}>
        <TouchableOpacity onPress={pressHeart} activeOpacity={0.85}>
          <Animated.View style={{transform:[{scale:heartSc}]}}>
            <Ionicons name={liked?'heart':'heart-outline'} size={34} color={liked?'#C060FF':'rgba(240,232,255,0.85)'} />
          </Animated.View>
        </TouchableOpacity>
        <Text style={rb.count}>{(film.likes + (liked?1:0)).toLocaleString('fr-FR')}</Text>
      </View>

      {/* ≡↑ Info */}
      <View style={rb.item}>
        <TouchableOpacity onPress={onInfo} activeOpacity={0.8}>
          <View style={rb.infoIcon}>
            <View style={[rb.infoLine,{width:20}]}/><View style={[rb.infoLine,{width:15}]}/><View style={[rb.infoLine,{width:20}]}/>
            {/* Arrow up */}
            <View style={rb.arrowUp}/>
          </View>
        </TouchableOpacity>
      </View>

      {/* ★ Star/Review */}
      <View style={rb.item}>
        <TouchableOpacity onPress={onStar} activeOpacity={0.8}>
          <Ionicons name="star" size={32} color={P.primL} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const rb = StyleSheet.create({
  bar:      { position:'absolute', right:14, bottom:210, alignItems:'center', gap:22 },
  btn:      { width:44, height:44, alignItems:'center', justifyContent:'center' },
  dots:     { flexDirection:'row', gap:4 },
  dot:      { width:5, height:5, borderRadius:2.5, backgroundColor:'rgba(240,232,255,0.80)' },
  item:     { alignItems:'center', gap:5 },
  count:    { color:'rgba(240,232,255,0.88)', fontSize:13, fontWeight:'700' },
  infoIcon: { width:34, height:34, alignItems:'center', justifyContent:'center', gap:3.5 },
  infoLine: { height:2, borderRadius:1, backgroundColor:'rgba(240,232,255,0.80)' },
  arrowUp:  { width:0, height:0, borderLeftWidth:4, borderRightWidth:4, borderBottomWidth:6, borderLeftColor:'transparent', borderRightColor:'transparent', borderBottomColor:'rgba(240,232,255,0.80)', marginTop:1 },
});

// ═══════════════════════════════════════════════════════════════════
//  BOTTOM EPISODE CARD  — glassmorphism
// ═══════════════════════════════════════════════════════════════════
interface BottomCardProps { film:FeedFilm; progress:number; onFollow:(fid:string)=>void; }
function BottomCard({ film, progress, onFollow }: BottomCardProps) {
  // Parse duration → total seconds
  const [min,sec] = film.duration.split(':').map(Number);
  const totalSec  = (min||0)*60+(sec||0);
  const elapsed   = Math.floor(totalSec * Math.min(progress, 1));
  const elMin     = String(Math.floor(elapsed/60)).padStart(2,'0');
  const elSec2    = String(elapsed%60).padStart(2,'0');

  return (
    <View style={bc.wrap}>
      <BlurView intensity={35} tint="dark" style={bc.blurCard}>
        <View style={bc.inner}>

          {/* Episode label + series */}
          <View style={bc.topRow}>
            <View>
              <Text style={bc.epLabel}>Épisode {film.episode}</Text>
              <Text style={bc.seriesName}>{film.series}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={bc.progressTrack}>
            <View style={[bc.progressFill,{width:`${Math.min(progress*100,100)}%`}]}/>
            {/* Thumb */}
            <View style={[bc.progressThumb,{left:`${Math.min(progress*100,100)}%`}]}/>
          </View>

          {/* Timestamps */}
          <View style={bc.timesRow}>
            <Text style={bc.timeText}>{elMin}:{elSec2}</Text>
            <Text style={bc.timeText}>{film.duration}</Text>
          </View>

          {/* Friends row */}
          <View style={bc.friendsRow}>
            {/* Stacked friend avatars */}
            <View style={bc.avatarStack}>
              {film.liked_by_friends.slice(0,3).map((f,i)=>(
                <View key={f.id} style={[bc.friendAvWrap,{marginLeft:i>0?-12:0,zIndex:10-i}]}>
                  <Image source={{uri:f.avatar}} style={bc.friendAv}/>
                  {/* Download icon on second avatar */}
                  {i===1 && (
                    <View style={bc.friendBadge}>
                      <Ionicons name="arrow-down" size={8} color="#fff"/>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Follow button: +username of first unfollowed friend */}
            {film.liked_by_friends.find(f=>!f.followed) && (
              <TouchableOpacity
                onPress={()=>onFollow(film.liked_by_friends.find(f=>!f.followed)!.id)}
                style={bc.followBtn} activeOpacity={0.8}
              >
                <View style={bc.followDot}/>
                <Text style={bc.followTxt}>+{film.liked_by_friends.find(f=>!f.followed)?.name.replace('@','')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Comment */}
          {film.comment && <Text style={bc.comment}>{film.comment}</Text>}
        </View>
      </BlurView>
    </View>
  );
}
const bc = StyleSheet.create({
  wrap:         { position:'absolute', bottom:90, left:16, right:16 },
  blurCard:     { borderRadius:20, overflow:'hidden', borderWidth:1, borderColor:'rgba(146,64,214,0.28)' },
  inner:        { padding:16, gap:10 },
  topRow:       { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' },
  epLabel:      { color:P.t1, fontSize:15, fontWeight:'800', marginBottom:2 },
  seriesName:   { color:P.t2, fontSize:13 },
  progressTrack:{ height:3, backgroundColor:'rgba(255,255,255,0.18)', borderRadius:2, position:'relative', overflow:'visible' },
  progressFill: { height:'100%', backgroundColor:P.primL, borderRadius:2 },
  progressThumb:{ position:'absolute', top:-4, marginLeft:-5, width:11, height:11, borderRadius:5.5, backgroundColor:P.primL, shadowColor:P.primL, shadowOffset:{width:0,height:0}, shadowOpacity:0.9, shadowRadius:5 },
  timesRow:     { flexDirection:'row', justifyContent:'space-between' },
  timeText:     { color:P.t3, fontSize:11 },
  friendsRow:   { flexDirection:'row', alignItems:'center', gap:12 },
  avatarStack:  { flexDirection:'row', alignItems:'center' },
  friendAvWrap: { position:'relative' },
  friendAv:     { width:38, height:38, borderRadius:19, borderWidth:2.5, borderColor:'rgba(10,0,22,0.9)' },
  friendBadge:  { position:'absolute', bottom:-2, right:-2, width:16, height:16, borderRadius:8, backgroundColor:P.primary, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:'rgba(10,0,22,0.9)' },
  followBtn:    { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(146,64,214,0.25)', borderRadius:999, paddingHorizontal:14, paddingVertical:7, borderWidth:1, borderColor:P.bord },
  followDot:    { width:6, height:6, borderRadius:3, backgroundColor:P.primL, shadowColor:P.primL, shadowOffset:{width:0,height:0}, shadowOpacity:1, shadowRadius:4 },
  followTxt:    { color:P.t1, fontSize:13, fontWeight:'700' },
  comment:      { color:P.t2, fontSize:13, fontStyle:'italic' },
});

// ═══════════════════════════════════════════════════════════════════
//  FEED ITEM — plein écran, vidéo + overlay
// ═══════════════════════════════════════════════════════════════════
interface FeedItemProps { film:FeedFilm; isActive:boolean; onFollowFriend:(fid:string)=>void; }
function FeedItem({ film, isActive, onFollowFriend }: FeedItemProps) {
  const router = useRouter();
  const [liked,    setLiked]    = useState(false);
  const [progress, setProgress] = useState(0.04);
  const [playing,  setPlaying]  = useState(false);
  const videoRef = useRef<Video>(null);

  // Start/stop video with active state
  useEffect(()=>{
    if(isActive && film.video_url){
      videoRef.current?.playAsync().catch(()=>{});
      setPlaying(true);
    } else {
      videoRef.current?.pauseAsync().catch(()=>{});
      setPlaying(false);
    }
  },[isActive, film.video_url]);

  // Progress bar update
  function onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if(!status.isLoaded) return;
    if(status.durationMillis && status.positionMillis != null){
      setProgress(status.positionMillis / status.durationMillis);
    }
  }

  // Double-tap to like
  const lastTap  = useRef(0);
  const heartAnim= useRef(new Animated.Value(0)).current;
  function handleDoubleTap(){
    const now = Date.now();
    if(now - lastTap.current < 300){
      if(!liked) setLiked(true);
      Animated.sequence([
        Animated.timing(heartAnim,{toValue:1,duration:200,useNativeDriver:true}),
        Animated.delay(600),
        Animated.timing(heartAnim,{toValue:0,duration:300,useNativeDriver:true}),
      ]).start();
    }
    lastTap.current = now;
  }

  // Toggle play/pause on single tap
  function handleTap(){
    if(playing){ videoRef.current?.pauseAsync().catch(()=>{}); setPlaying(false); }
    else        { videoRef.current?.playAsync().catch(()=>{});  setPlaying(true);  }
  }

  const heartScale = heartAnim.interpolate({inputRange:[0,0.5,1],outputRange:[0,1.3,1]});
  const heartOpacity = heartAnim;

  // Caption lines
  const captionLines = film.caption.split('\n');

  return (
    <TouchableWithoutFeedback onPress={handleTap} onLongPress={handleDoubleTap}>
      <View style={{width:W, height:ITEM_H, backgroundColor:'#000'}}>

        {/* Video or image */}
        {film.video_url ? (
          <Video
            ref={videoRef}
            source={{uri:film.video_url}}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted={false}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          />
        ) : (
          <Image source={{uri:film.poster_url}} style={StyleSheet.absoluteFill} resizeMode="cover"/>
        )}

        {/* Multi-layer gradient overlay */}
        <LinearGradient
          colors={['rgba(7,0,15,0.12)','transparent','rgba(7,0,15,0.40)','rgba(7,0,15,0.92)']}
          locations={[0,0.30,0.65,1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Left purple atmosphere */}
        <LinearGradient
          colors={['rgba(110,28,205,0.35)','transparent']}
          start={{x:0,y:0.5}} end={{x:0.35,y:0.5}}
          style={StyleSheet.absoluteFill}
        />

        {/* Caption text — centre-bas */}
        <View style={cap.wrap} pointerEvents="none">
          {captionLines.map((line,i)=>(
            <Text key={i} style={cap.line}>{line}</Text>
          ))}
        </View>

        {/* Double-tap heart animation */}
        <Animated.View style={[cap.bigHeart,{opacity:heartOpacity,transform:[{scale:heartScale}]}]} pointerEvents="none">
          <Ionicons name="heart" size={90} color="#C060FF"/>
        </Animated.View>

        {/* Pause icon */}
        {!playing && (
          <View style={cap.pauseIcon} pointerEvents="none">
            <Ionicons name="pause" size={48} color="rgba(255,255,255,0.70)"/>
          </View>
        )}

        {/* Right action bar */}
        <RightBar
          film={film}
          liked={liked}
          onLike={()=>setLiked(p=>!p)}
          onInfo={()=>router.push(`/film/${film.id}`)}
          onStar={()=>router.push(`/film/${film.id}`)}
        />

        {/* Bottom episode card */}
        <BottomCard film={film} progress={progress} onFollow={onFollowFriend}/>
      </View>
    </TouchableWithoutFeedback>
  );
}

const cap = StyleSheet.create({
  wrap:     { position:'absolute', bottom:310, left:16, right:90 },
  line:     { color:'rgba(255,255,255,0.90)', fontSize:22, fontWeight:'700', lineHeight:30, textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:2}, textShadowRadius:8 },
  bigHeart: { position:'absolute', top:'50%', left:'50%', marginTop:-45, marginLeft:-45 },
  pauseIcon:{ position:'absolute', top:'50%', left:'50%', marginTop:-24, marginLeft:-24 },
});

// ═══════════════════════════════════════════════════════════════════
//  GALAXY TABBAR
// ═══════════════════════════════════════════════════════════════════
function GalaxyTabBar({ active, set }: { active:string; set:(v:string)=>void }) {
  const glow  = useRef(new Animated.Value(0.5)).current;
  const spinV = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.loop(Animated.sequence([Animated.timing(glow,{toValue:1,duration:1650,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(glow,{toValue:0.5,duration:1650,easing:Easing.inOut(Easing.sin),useNativeDriver:true})])).start();
    Animated.loop(Animated.timing(spinV,{toValue:1,duration:9500,easing:Easing.linear,useNativeDriver:true})).start();
  },[]);
  const spin = spinV.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});

  const TABS = [
    {key:'accueil',label:'Accueil',  icon:'home-outline'    as const},
    {key:'reels',  label:'Reels',    icon:'play-outline'    as const},
    {key:'spark',  label:'',         icon:'sparkles'        as const},
    {key:'amies',  label:'Amies',    icon:'people-outline'  as const},
    {key:'profil', label:'Profil',   icon:'person-circle'   as const},
  ] as const;

  return(
    <View style={tb.wrap}>
      <View style={tb.glass}/>
      <View style={tb.borderTop}/>
      <View style={tb.row}>
        {TABS.map(item=>{
          const on=active===item.key;
          const c=on?P.primL:'rgba(240,232,255,0.38)';
          if(item.key==='spark') return(
            <TouchableOpacity key={item.key} onPress={()=>set(item.key)} style={tb.sparkWrap} activeOpacity={0.9}>
              <Animated.View style={[tb.sparkGlow,{opacity:glow}]}/>
              <Animated.View style={[tb.sparkRing,{transform:[{rotate:spin}]}]}>
                <LinearGradient colors={['#E080FF','#5A0090','#E080FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
              </Animated.View>
              <LinearGradient colors={['#8B2FCC','#B855FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={tb.sparkInner}>
                <View style={tb.spkV}/><View style={tb.spkH}/>
                <View style={[tb.spkD,{transform:[{rotate:'45deg'}]}]}/>
                <View style={[tb.spkD,{transform:[{rotate:'-45deg'}]}]}/>
                <View style={tb.spkCtr}/>
              </LinearGradient>
            </TouchableOpacity>
          );
          if(item.key==='profil') return(
            <TouchableOpacity key={item.key} onPress={()=>set(item.key)} style={tb.tab} activeOpacity={0.8}>
              <View style={[tb.avBox,on&&tb.avBoxOn]}>
                <Image source={{uri:'https://i.pravatar.cc/50?img=11'}} style={{width:'100%',height:'100%',borderRadius:13}}/>
              </View>
              <Text style={[tb.label,on&&tb.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
          return(
            <TouchableOpacity key={item.key} onPress={()=>set(item.key)} style={tb.tab} activeOpacity={0.8}>
              <View style={[tb.iconBox,on&&tb.iconOn]}>
                <Ionicons name={item.icon} size={23} color={c}/>
              </View>
              <Text style={[tb.label,on&&tb.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  wrap:    {position:'absolute',bottom:0,left:0,right:0,paddingBottom:20},
  glass:   {...StyleSheet.absoluteFillObject,backgroundColor:'rgba(7,0,15,0.90)'},
  borderTop:{height:1,backgroundColor:'rgba(146,64,214,0.42)'},
  row:     {flexDirection:'row',alignItems:'center',paddingTop:8,paddingHorizontal:4},
  tab:     {flex:1,alignItems:'center',gap:3,paddingVertical:4},
  iconBox: {width:40,height:32,alignItems:'center',justifyContent:'center',borderRadius:10},
  iconOn:  {backgroundColor:'rgba(146,64,214,0.18)'},
  label:   {fontSize:10,fontWeight:'500',color:'rgba(240,232,255,0.38)'},
  labelOn: {color:P.primL,fontWeight:'800'},
  avBox:   {width:28,height:28,borderRadius:14,overflow:'hidden',backgroundColor:P.surface},
  avBoxOn: {borderWidth:2,borderColor:P.primL},
  sparkWrap:{width:64,alignItems:'center',justifyContent:'center',marginTop:-22},
  sparkGlow:{...StyleSheet.absoluteFillObject,borderRadius:32,backgroundColor:P.primary,transform:[{scale:1.55}]},
  sparkRing:{position:'absolute',width:58,height:58,borderRadius:29,overflow:'hidden'},
  sparkInner:{width:52,height:52,borderRadius:26,alignItems:'center',justifyContent:'center'},
  spkV:    {position:'absolute',width:1.8,height:28,borderRadius:1,backgroundColor:'rgba(255,255,255,0.94)'},
  spkH:    {position:'absolute',height:1.8,width:28,borderRadius:1,backgroundColor:'rgba(255,255,255,0.94)'},
  spkD:    {position:'absolute',width:1.3,height:19,borderRadius:1,backgroundColor:'rgba(255,255,255,0.58)'},
  spkCtr:  {width:5.5,height:5.5,borderRadius:2.75,backgroundColor:'#fff'},
});

// ═══════════════════════════════════════════════════════════════════
//  MAIN — index (default export)
// ═══════════════════════════════════════════════════════════════════
export default function ReelsScreen() {
  const router = useRouter();

  const [feedFilms,   setFeedFilms]   = useState<FeedFilm[]>(MOCK_FEED);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [feedKey,     setFeedKey]     = useState('foryou');
  const [activeTab,   setActiveTab]   = useState('reels');
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  // Enrichir avec données API si disponibles
  useEffect(()=>{
    filmsAPI.getFeed?.().then((data:any[])=>{
      if(data && data.length > 0){
        const enriched: FeedFilm[] = data.map((f:any, i:number)=>({
          id:            f.id,
          title:         f.title,
          series:        f.title,
          episode:       1,
          episode_title: f.synopsis?.slice(0,40)??'',
          poster_url:    f.poster_url,
          video_url:     f.video_url,
          caption:       f.synopsis?.slice(0,60)??f.title,
          duration:      `${Math.floor((f.duration_minutes??3)*60/60)}:${String((f.duration_minutes??3)*60%60).padStart(2,'0')}`,
          likes:         f.views_count??Math.floor(Math.random()*3000+200),
          liked_by_friends:[FRIENDS_POOL[i%FRIENDS_POOL.length]],
          tags:          [f.genre??'Film'],
          director:      f.director??'',
          year:          f.year??2024,
          comment:       '',
        }));
        setFeedFilms([...MOCK_FEED, ...enriched]);
      }
    }).catch(()=>{});
  },[]);

  const onViewableItemsChanged = useCallback(({viewableItems}:any)=>{
    if(viewableItems.length>0) setActiveIndex(viewableItems[0].index??0);
  },[]);

  function handleFollowFriend(fid:string){
    setFeedFilms(prev=>prev.map(film=>({
      ...film,
      liked_by_friends: film.liked_by_friends.map(f=>f.id===fid?{...f,followed:true}:f),
    })));
  }

  return (
    <View style={sc.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>

   

      {/* Feed vertical plein écran */}
      <FlatList
        data={feedFilms}
        keyExtractor={item=>item.id}
        renderItem={({item,index})=>(
          <FeedItem
            film={item}
            isActive={index===activeIndex}
            onFollowFriend={handleFollowFriend}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_,index)=>({length:ITEM_H, offset:ITEM_H*index, index})}
        removeClippedSubviews
        windowSize={3}
        maxToRenderPerBatch={2}
      />

      {/* Top header — "≡ Pour vous ↓" + "Amies" */}
      <SafeAreaView edges={['top']} style={sc.headerSafe} pointerEvents="box-none">
        <TopHeader feedKey={feedKey} onMenuPress={()=>setMenuOpen(true)}/>
      </SafeAreaView>

      {/* Dropdown menu */}
      <Modal visible={menuOpen} transparent animationType="none" statusBarTranslucent onRequestClose={()=>setMenuOpen(false)}>
        <DropdownMenu visible={menuOpen} onClose={()=>setMenuOpen(false)} onSelect={setFeedKey} activeKey={feedKey}/>
      </Modal>


    </View>
  );
}

const sc = StyleSheet.create({
  root:       { flex:1, backgroundColor:'#000' },
  headerSafe: { position:'absolute', top:0, left:0, right:0, zIndex:50, pointerEvents:'box-none' },
});