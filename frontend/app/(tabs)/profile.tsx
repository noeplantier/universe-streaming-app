/**
 * app/profile.tsx
 *
 * Profil Instagram-style pour créateurs de cinéma indépendant
 *
 *  HEADER    : avatar + stats + bio + spécialités + festivals + réseaux sociaux
 *  TAB 0     : Films — favoris / critiques / visionnés / recommandations
 *  TAB 1     : Créations — reels avec miniatures vidéo (expo-video-thumbnails)
 *  TAB 2     : Tags — œuvres dans lesquelles l'user apparaît (cast_list)
 *
 *  DYNAMIQUE : realtime sur profiles, reels, user_favorites, user_history,
 *              critiques + useFocusEffect au retour depuis edit.tsx
 */

import React, {
  memo, useCallback, useEffect,
  useMemo, useRef, useState,
} from 'react';
import {
   Animated, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Image }                     from 'expo-image';
import { LinearGradient }            from 'expo-linear-gradient';
import { BlurView }                  from 'expo-blur';
import { Ionicons }                  from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { StatusBar }                 from 'expo-status-bar';

import { useAuth }                   from '../../contexts/AuthContext';
import api                           from '../../services/api';
import GalaxyBackground              from '../../components/social/GalaxyBackground';
import { ImageWithFallback }         from '../../components/profile/ImageWithFallback';
import {
  EmptyState, HScrollRow,
  SectionHeader, StatColumn,
} from '../../components/profile/Section';
import {
  CARD_H, CARD_W, G,
  H_PADDING, NUM_ITEM_W, NUM_OVERLAP, NUM_W, CARD_GAP,
} from '../../components/profile/theme';
import {
  DEFAULT_REVIEWS, DEFAULT_SEEN,
  type FilmItem, type ReviewItem,
} from '../../components/profile/data';
import { supabase } from '@/lib/supabase';
import NotifService from '@/services/notifService';
import { Platform } from 'react-native';

let VideoThumbnails: any = null;
if (Platform.OS !== 'web') {
  try { VideoThumbnails = require('expo-video-thumbnails'); } catch {}
}

// Logo Universe
const LOGO = require('@/assets/images/logouniverse2.png');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#03000A',
  glass:    'rgba(255,255,255,0.05)',
  glassMd:  'rgba(255,255,255,0.08)',
  border:   'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.20)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.80)',
  muted:    'rgba(255,255,255,0.38)',
  faint:    'rgba(255,255,255,0.12)',
  gold:     G.gold,
  primary:  G.primary,
  success:  '#22C55E',
  amber:    '#F59E0B',
  error:    '#EF4444',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null;
  director:string|null; cast_list:string[]|null;
}

interface UserReel {
  id:string; video_url:string; thumbnail_url:string|null;
  title:string|null; genre:string|null; director:string|null;
  year:string|null; synopsis:string|null; duration:number|null;
  status:'pending'|'approved'|'rejected';
  rejection_category:string|null; rejection_reason:string|null;
  likes_count:number; views_count:number; created_at:string;
}

interface ProfileData {
  display_name:string; username:string; bio:string; role:string;
  location:string; avatar_url:string; website:string;
  is_pro:boolean; is_industry_contact:boolean;
  specialties:string[]; festivals:string[]; open_to:string[];
  social_instagram:string; social_vimeo:string;
  social_youtube:string; social_imdb:string;
}

const PROFILE_EMPTY: ProfileData = {
  display_name:'', username:'', bio:'', role:'creator', location:'',
  avatar_url:'', website:'', is_pro:false, is_industry_contact:false,
  specialties:[], festivals:[], open_to:[],
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
};

const PROFILE_COLS = [
  'display_name','username','bio','role','location','avatar_url','website',
  'is_pro','is_industry_contact','specialties','festivals','open_to',
  'social_instagram','social_vimeo','social_youtube','social_imdb',
].join(',');

type GridTab = 0|1|2;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(id:number, image:string|null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/400/600`;
  } catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
}

function fmtNumber(n:number): string {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n>=1_000)     return `${(n/1_000).toFixed(n>=10_000?0:1)}K`;
  return `${n}`;
}

function fmtDuration(sec:number|null): string {
  if (!sec) return '';
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  if (h>0) return `${h}h${m>0?` ${m}m`:''}`;
  return `${m}m`;
}

function reelCategory(dur:number|null): 'courts'|'moyens'|'series' {
  if (!dur||dur<=1800) return 'courts';
  if (dur<=5400)       return 'moyens';
  return 'series';
}

const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice',
  writer:'Scénariste',         actor:'Acteur·rice',
  dp:'Dir. photo',             editor:'Monteur·euse',
  critic:'Critique',           creator:'Créateur·rice',
  other:'Cinéaste',
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — miniature vidéo avec cache local
// ─────────────────────────────────────────────────────────────────────────────
function useVideoThumbnail(videoUrl:string, thumbnailUrl:string|null): string|null {
  const [uri, setUri] = useState<string|null>(thumbnailUrl ?? null);

  useEffect(() => {
    if (thumbnailUrl) { setUri(thumbnailUrl); return; }
    if (!videoUrl || !VideoThumbnails) return;
    let active = true;
    (async () => {
      try {
        const { uri: generated } = await VideoThumbnails.getThumbnailAsync(
          videoUrl, { time: 1500, quality: 0.65 }
        );
        if (active) setUri(generated);
      } catch {}
    })();
    return () => { active = false; };
  }, [videoUrl, thumbnailUrl]);

  return uri;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({w,h,r=8}:{w:number;h:number;r?:number}) {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(()=>{
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op,{toValue:0.50,duration:850,useNativeDriver:true}),
      Animated.timing(op,{toValue:0.22,duration:850,useNativeDriver:true}),
    ]));
    loop.start(); return ()=>loop.stop();
  },[op]);
  return <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:'rgba(255,255,255,0.09)',opacity:op}}/>;
});

const SkeletonSection = memo(function SkeletonSection({accentColor=G.primary}:{accentColor?:string}) {
  return (
    <View>
      <View style={sk.header}>
        <View style={[sk.iconBox,{backgroundColor:`${accentColor}14`}]}/>
        <View style={sk.titleBar}/>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingLeft:H_PADDING,paddingRight:H_PADDING,gap:CARD_GAP}}>
        {[0,1,2,3].map(i=>(
          <View key={i} style={{flexDirection:'row',alignItems:'flex-end',width:NUM_ITEM_W}}>
            <View style={sk.numCol}><View style={sk.ghostNum}/></View>
            <View style={[sk.ghostCard,{marginLeft:-NUM_OVERLAP}]}><Shimmer w={CARD_W} h={CARD_H} r={12}/></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
const sk = StyleSheet.create({
  header:  {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PADDING,paddingTop:22,paddingBottom:12},
  iconBox: {width:26,height:26,borderRadius:9},
  titleBar:{height:12,width:120,borderRadius:6,backgroundColor:'rgba(255,255,255,0.06)'},
  numCol:  {width:NUM_W,height:CARD_H,justifyContent:'flex-start',paddingTop:6},
  ghostNum:{height:68,width:38,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:6,alignSelf:'flex-end'},
  ghostCard:{borderRadius:13,overflow:'hidden'},
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD (Films tab)
// ─────────────────────────────────────────────────────────────────────────────
const PortraitCard = memo(function PortraitCard({item,rank,noMargin}:{item:Work;rank?:number;noMargin?:boolean}) {
  const router = useRouter();
  const uri = useMemo(()=>resolveImage(item.id,item.image),[item.id,item.image]);
  const rankColor = rank===1?C.gold:rank===2?'#C0C0C0':rank===3?'#CD7F32':'rgba(255,255,255,0.40)';
  return (
    <TouchableOpacity style={{marginRight:noMargin?0:12}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{uri}} style={pc.img} contentFit="cover"/>
        <LinearGradient colors={['transparent','rgba(2,8,16,0.88)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.38}} end={{x:0,y:1}}/>
        <View style={[pc.badge,{backgroundColor:item.is_original?'#1E4A7A':'#0D2240'}]}>
          <Text style={pc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text>
        </View>
        {rank!=null&&<Text style={[pc.rankNum,{color:rankColor}]}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
            <Ionicons name="heart" size={9} color={C.gold}/>
            <Text style={pc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>
            {item.year&&<><Text style={pc.dot}>·</Text><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc = StyleSheet.create({
  card:    {width:CARD_W,height:CARD_H,borderRadius:14,overflow:'hidden',backgroundColor:'#0D2240'},
  img:     {width:'100%' as any,height:'100%' as any},
  badge:   {position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:4},
  badgeTxt:{color:'#FFF',fontSize:7,fontWeight:'800',letterSpacing:0.3},
  rankNum: {position:'absolute',bottom:30,right:5,fontSize:52,fontWeight:'900',lineHeight:52,letterSpacing:-4,opacity:0.9},
  meta:    {position:'absolute',bottom:8,left:8,right:8,gap:2},
  title:   {color:'#FFF',fontSize:11,fontWeight:'700',lineHeight:14},
  stat:    {color:'rgba(255,255,255,0.55)',fontSize:9,fontWeight:'600'},
  dot:     {color:'rgba(255,255,255,0.25)',fontSize:9},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ VIDEO REEL CARD — miniature avec expo-video-thumbnails + fallback
// ─────────────────────────────────────────────────────────────────────────────
const REEL_W = 160;
const REEL_H = 220;

const STATUS_CFG = {
  pending:  {icon:'time-outline'         as const,color:'#F59E0B',bg:'rgba(245,158,11,0.20)'},
  approved: {icon:'checkmark-circle'     as const,color:'#22C55E',bg:'rgba(34,197,94,0.20)' },
  rejected: {icon:'close-circle-outline' as const,color:'#EF4444',bg:'rgba(239,68,68,0.20)' },
};

const VideoReelCard = memo(function VideoReelCard({reel}:{reel:UserReel}) {
  const router = useRouter();
  const thumb  = useVideoThumbnail(reel.video_url, reel.thumbnail_url);
  const cfg    = STATUS_CFG[reel.status] ?? STATUS_CFG.pending;
  const [imgErr, setImgErr] = useState(false);

  return (
    <TouchableOpacity
      style={{marginRight:12}}
      onPress={()=>router.push({pathname:'/reel/[id]',params:{id:reel.id}} as any)}
      activeOpacity={0.88}
    >
      <View style={vrc.card}>
        {/* Miniature vidéo ou placeholder */}
        {thumb && !imgErr ? (
          <Image
            source={{uri:thumb}}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={()=>setImgErr(true)}
          />
        ) : (
          <View style={vrc.placeholder}>
            <LinearGradient colors={['#0D1828','#060E1A']} style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="film-outline" size={28} color="rgba(255,255,255,0.15)"/>
          </View>
        )}

        {/* Gradient bas */}
        <LinearGradient colors={['transparent','rgba(2,5,15,0.94)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/>

        {/* Bouton play */}
        <View style={vrc.playRing} pointerEvents="none">
          <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.65)"/>
        </View>

        {/* Badge statut */}
        <View style={[vrc.statusBadge,{backgroundColor:cfg.bg}]}>
          <Ionicons name={cfg.icon} size={8} color={cfg.color}/>
        </View>

        {/* Durée */}
        {reel.duration!=null&&(
          <View style={vrc.durationBadge}>
            <Text style={vrc.durationTxt}>{fmtDuration(reel.duration)||'—'}</Text>
          </View>
        )}

        {/* Meta */}
        <View style={vrc.meta}>
          <Text style={vrc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text>
          {reel.genre&&<Text style={vrc.genre} numberOfLines={1}>{reel.genre}</Text>}
          <View style={vrc.statsRow}>
            <Ionicons name="eye-outline" size={9} color="rgba(255,255,255,0.40)"/>
            <Text style={vrc.statTxt}>{fmtNumber(reel.views_count??0)}</Text>
            <Ionicons name="heart-outline" size={9} color="rgba(255,255,255,0.40)"/>
            <Text style={vrc.statTxt}>{fmtNumber(reel.likes_count??0)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const vrc = StyleSheet.create({
  card:        {width:REEL_W,height:REEL_H,borderRadius:16,overflow:'hidden',backgroundColor:'#0D1828'},
  placeholder: {flex:1,alignItems:'center',justifyContent:'center'},
  playRing:    {position:'absolute',top:'40%',alignSelf:'center',marginTop:-14},
  statusBadge: {position:'absolute',top:8,left:8,width:20,height:20,borderRadius:10,alignItems:'center',justifyContent:'center'},
  durationBadge:{position:'absolute',top:8,right:8,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(2,5,15,0.72)'},
  durationTxt: {color:'rgba(255,255,255,0.85)',fontSize:9,fontWeight:'700'},
  meta:        {position:'absolute',bottom:0,left:0,right:0,padding:11,gap:2},
  title:       {color:'#FFF',fontSize:11,fontWeight:'800',lineHeight:14},
  genre:       {color:'rgba(255,255,255,0.45)',fontSize:9,fontStyle:'italic'},
  statsRow:    {flexDirection:'row',alignItems:'center',gap:4,marginTop:4},
  statTxt:     {color:'rgba(255,255,255,0.45)',fontSize:9,fontWeight:'600'},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ WORK TAG CARD — œuvres où l'user est crédité (Tags tab)
// ─────────────────────────────────────────────────────────────────────────────
const TAG_W = 150;
const TAG_H = 210;

const WorkTagCard = memo(function WorkTagCard({work,userLabel}:{work:Work;userLabel:string}) {
  const router = useRouter();
  const uri    = useMemo(()=>resolveImage(work.id,work.image),[work.id,work.image]);

  // Trouve le rôle de l'utilisateur dans cast_list ou director
  const creditLabel = useMemo(()=>{
    if (work.director && [userLabel].some(n=>work.director?.toLowerCase().includes(n.toLowerCase())))
      return 'Réalisateur·rice';
    const match = (work.cast_list??[]).find(c=>c.toLowerCase().includes(userLabel.toLowerCase()));
    return match ? 'Casting' : 'Collaborateur·rice';
  },[work,userLabel]);

  return (
    <TouchableOpacity style={{marginRight:12}} onPress={()=>router.push(`/film/${work.id}` as any)} activeOpacity={0.88}>
      <View style={wtc.card}>
        <Image source={{uri}} style={StyleSheet.absoluteFillObject} contentFit="cover"/>
        <LinearGradient colors={['rgba(2,8,16,0.18)','rgba(2,8,16,0.94)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:0,y:1}}/>

        {/* Badge type */}
        {work.is_original&&(
          <View style={wtc.origBadge}><Text style={wtc.origTxt}>ORIGINAL</Text></View>
        )}

        {/* Chip rôle */}
        <View style={wtc.roleBadge}>
          <Ionicons name="person-circle-outline" size={9} color={G.primary}/>
          <Text style={wtc.roleTxt}>{creditLabel}</Text>
        </View>

        <View style={wtc.meta}>
          <Text style={wtc.title} numberOfLines={2}>{work.title}</Text>
          <Text style={wtc.sub}>{[work.genre,work.year?String(work.year):null].filter(Boolean).join(' · ')}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:3,marginTop:3}}>
            <Ionicons name="heart" size={9} color={C.gold}/>
            <Text style={wtc.likes}>{fmtNumber(work.likes??0)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const wtc = StyleSheet.create({
  card:      {width:TAG_W,height:TAG_H,borderRadius:14,overflow:'hidden',backgroundColor:'#0D2240'},
  origBadge: {position:'absolute',top:8,left:8,paddingHorizontal:6,paddingVertical:2,borderRadius:4,backgroundColor:'#1E4A7A'},
  origTxt:   {color:'#FFF',fontSize:7,fontWeight:'800',letterSpacing:0.3},
  roleBadge: {position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(2,5,15,0.70)'},
  roleTxt:   {color:G.primary,fontSize:8,fontWeight:'700'},
  meta:      {position:'absolute',bottom:0,left:0,right:0,padding:10,gap:2},
  title:     {color:'#FFF',fontSize:11,fontWeight:'800',lineHeight:14},
  sub:       {color:'rgba(255,255,255,0.42)',fontSize:9},
  likes:     {color:'rgba(255,255,255,0.55)',fontSize:9,fontWeight:'600'},
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITIQUE CARD
// ─────────────────────────────────────────────────────────────────────────────
const STAR_POS=[
  {t:8,l:18,op:0.55,r:1.8},{t:14,l:88,op:0.35,r:1.2},{t:22,l:155,op:0.60,r:2.0},
  {t:38,l:42,op:0.28,r:1.0},{t:48,l:190,op:0.45,r:1.5},{t:58,l:72,op:0.50,r:1.6},
  {t:70,l:130,op:0.32,r:1.0},{t:80,l:8,op:0.40,r:1.4},{t:92,l:200,op:0.55,r:1.8},
];
const CritiqueCard = memo(function CritiqueCard({review,rank,onPress}:{review:ReviewItem;rank:number;onPress:()=>void}) {
  const stars = Math.round(review.rating??0);
  return (
    <TouchableOpacity style={{marginRight:12}} onPress={onPress} activeOpacity={0.88}>
      <View style={cric.card}>
        <LinearGradient colors={['#0D0822','#0A1628','#060C1A']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/>
        {STAR_POS.map((s,i)=><View key={i} style={[cric.star,{top:s.t,left:s.l,opacity:s.op,width:s.r,height:s.r,borderRadius:s.r/2}]}/>)}
        <Image source={LOGO} style={cric.logo} contentFit="contain"/>
        <View style={cric.badge}><Text style={cric.badgeTxt}>#{rank}</Text></View>
        <View style={cric.body}>
          <Text style={cric.filmTitle} numberOfLines={1}>{review.film?.title??'—'}</Text>
          <View style={{flexDirection:'row',gap:2}}>
            {[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={10} color={C.gold}/>)}
          </View>
          <Text style={cric.excerpt} numberOfLines={3}>{review.content||'Aucun contenu'}</Text>
        </View>
        <View style={cric.border} pointerEvents="none"/>
      </View>
    </TouchableOpacity>
  );
});
const cric = StyleSheet.create({
  card:     {width:220,height:148,borderRadius:16,overflow:'hidden'},
  star:     {position:'absolute',backgroundColor:'#FFF'},
  logo:     {position:'absolute',right:8,bottom:8,width:48,height:48,opacity:0.09},
  badge:    {position:'absolute',top:10,left:10,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(0,19,127,0.28)'},
  badgeTxt: {color:'#FFF',fontSize:9,fontWeight:'800'},
  body:     {position:'absolute',bottom:0,left:0,right:0,padding:12,gap:4},
  filmTitle:{color:'#FFF',fontSize:13,fontWeight:'800',letterSpacing:-0.2},
  excerpt:  {color:'rgba(255,255,255,0.46)',fontSize:10,lineHeight:14},
  border:   {...StyleSheet.absoluteFillObject,borderRadius:16,borderWidth:1,borderColor:'rgba(124,94,252,0.18)'},
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ PROFILE HEADER — Instagram-style pour cinéastes
// ─────────────────────────────────────────────────────────────────────────────
interface HeaderProps {
  profile:    ProfileData;
  avatarUri:  string;
  roleLabel:  string;
  filmCount:  number;
  critiqueCount: number;
  reelCount:  number;
  onEdit:     () => void;
}

const ProfileHeader = memo(function ProfileHeader({
  profile, avatarUri, roleLabel, filmCount, critiqueCount, reelCount, onEdit,
}: HeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);

  const socialLinks = useMemo(()=>[
    { key:'instagram', icon:'logo-instagram',  url:profile.social_instagram, label:'Instagram' },
    { key:'vimeo',     icon:'videocam-outline', url:profile.social_vimeo,     label:'Vimeo'     },
    { key:'youtube',   icon:'logo-youtube',     url:profile.social_youtube,   label:'YouTube'   },
    { key:'imdb',      icon:'film-outline',     url:profile.social_imdb,      label:'IMDb'      },
    { key:'website',   icon:'globe-outline',    url:profile.website,          label:'Portfolio' },
  ].filter(l=>!!l.url),[profile]);

  return (
    <View style={hdr.wrap}>
      {/* ── Ligne 1 : avatar + stats ── */}
      <View style={hdr.topRow}>
        {/* Avatar */}
        <View style={hdr.avatarWrap}>
          <LinearGradient
            colors={['#BF5FFF','#5A96E6','#F5C842']}
            style={hdr.avatarRing}
            start={{x:0,y:0}} end={{x:1,y:1}}
          />
          <ImageWithFallback uri={avatarUri} style={hdr.avatar} fallbackColors={[G.surface,G.bg]}/>
          {profile.is_pro&&(
            <View style={hdr.proBadge}>
              <Ionicons name="checkmark-circle" size={16} color={C.gold}/>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={hdr.statsRow}>
          <View style={hdr.statItem}>
            <Text style={hdr.statVal}>{fmtNumber(filmCount)}</Text>
            <Text style={hdr.statLabel}>films</Text>
          </View>
          <View style={hdr.statDiv}/>
          <View style={hdr.statItem}>
            <Text style={hdr.statVal}>{fmtNumber(critiqueCount)}</Text>
            <Text style={hdr.statLabel}>critiques</Text>
          </View>
          <View style={hdr.statDiv}/>
          <View style={hdr.statItem}>
            <Text style={hdr.statVal}>{fmtNumber(reelCount)}</Text>
            <Text style={hdr.statLabel}>créations</Text>
          </View>
        </View>
      </View>

      {/* ── Ligne 2 : nom + rôle ── */}
      <View style={hdr.nameRow}>
        <Text style={hdr.displayName}>{profile.display_name||profile.username||'Cinéaste'}</Text>
        {profile.is_pro&&<View style={hdr.proChip}><Text style={hdr.proChipTxt}>PRO</Text></View>}
      </View>
      <Text style={hdr.roleLabel}>{roleLabel}{profile.location?` · ${profile.location}`:''}</Text>

      {/* ── Bio ── */}
      {!!profile.bio&&(
        <Pressable onPress={()=>setBioExpanded(e=>!e)} style={hdr.bioWrap}>
          <Text style={hdr.bioTxt} numberOfLines={bioExpanded?undefined:3}>
            {profile.bio}
          </Text>
          {profile.bio.length>120&&(
            <Text style={hdr.bioMore}>{bioExpanded?'Voir moins':'Voir plus'}</Text>
          )}
        </Pressable>
      )}

      {/* ── Bouton Modifier ── */}
      <TouchableOpacity style={hdr.editBtn} onPress={onEdit} activeOpacity={0.82}>
        <Text style={hdr.editTxt}>Modifier le profil</Text>
      </TouchableOpacity>

      {/* ── Spécialités ── */}
      {profile.specialties.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={hdr.chipRow} style={{marginTop:12}}>
          {profile.specialties.map(s=>(
            <View key={s} style={hdr.chip}>
              <Text style={hdr.chipTxt}>{s}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Festivals ── */}
      {profile.festivals.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[hdr.chipRow,{marginTop:8}]}>
          {profile.festivals.map(f=>(
            <View key={f} style={hdr.festivalChip}>
              <Ionicons name="trophy-outline" size={9} color={C.gold}/>
              <Text style={hdr.festivalTxt}>{f}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Liens sociaux ── */}
      {socialLinks.length>0&&(
        <View style={hdr.socialRow}>
          {socialLinks.map(l=>(
            <TouchableOpacity key={l.key} style={hdr.socialBtn}
              onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}>
              <BlurView intensity={Platform.OS==='ios'?16:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name={l.icon as any} size={16} color={C.offWhite}/>
              <Text style={hdr.socialLabel}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Séparateur */}
      <View style={hdr.sep}/>
    </View>
  );
});

const hdr = StyleSheet.create({
  wrap:        {paddingHorizontal:H_PADDING},
  topRow:      {flexDirection:'row',alignItems:'center',gap:16,marginTop:6},
  avatarWrap:  {position:'relative'},
  avatarRing:  {position:'absolute',top:-3,left:-3,right:-3,bottom:-3,borderRadius:47},
  avatar:      {width:84,height:84,borderRadius:42,borderWidth:3,borderColor:C.bg},
  proBadge:    {position:'absolute',bottom:0,right:0,width:22,height:22,borderRadius:11,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'},
  statsRow:    {flex:1,flexDirection:'row',justifyContent:'space-around'},
  statItem:    {alignItems:'center',gap:2},
  statVal:     {color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.5},
  statLabel:   {color:C.muted,fontSize:10,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  statDiv:     {width:1,height:32,backgroundColor:'rgba(255,255,255,0.07)'},
  nameRow:     {flexDirection:'row',alignItems:'center',gap:8,marginTop:12},
  displayName: {color:C.white,fontSize:17,fontWeight:'900',letterSpacing:-0.3,flexShrink:1},
  proChip:     {paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:'rgba(245,200,66,0.18)',borderWidth:1,borderColor:'rgba(245,200,66,0.35)'},
  proChipTxt:  {color:C.gold,fontSize:9,fontWeight:'900',letterSpacing:0.8},
  roleLabel:   {color:C.muted,fontSize:12,marginTop:2},
  bioWrap:     {marginTop:10,gap:3},
  bioTxt:      {color:'rgba(255,255,255,0.70)',fontSize:13,lineHeight:19},
  bioMore:     {color:G.primary,fontSize:12,fontWeight:'600',marginTop:2},
  editBtn:     {marginTop:14,borderRadius:12,backgroundColor:C.glass,borderWidth:1,borderColor:C.border,paddingVertical:10,alignItems:'center'},
  editTxt:     {color:C.offWhite,fontSize:13,fontWeight:'700'},
  chipRow:     {gap:7,paddingVertical:2},
  chip:        {paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:'rgba(90,150,230,0.14)',borderWidth:1,borderColor:'rgba(90,150,230,0.25)'},
  chipTxt:     {color:'rgba(150,190,250,0.90)',fontSize:11,fontWeight:'600'},
  festivalChip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:20,backgroundColor:'rgba(245,200,66,0.10)',borderWidth:1,borderColor:'rgba(245,200,66,0.22)'},
  festivalTxt: {color:'rgba(245,200,66,0.80)',fontSize:10,fontWeight:'600'},
  socialRow:   {flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14},
  socialBtn:   {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  socialLabel: {color:C.offWhite,fontSize:11,fontWeight:'600'},
  sep:         {height:StyleSheet.hairlineWidth,backgroundColor:'rgba(191,95,255,0.14)',marginTop:20},
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP NAV
// ─────────────────────────────────────────────────────────────────────────────
const TopNav = memo(function TopNav({username,onNotif,onSettings,onAdmin}:{username:string;onNotif:()=>void;onSettings:()=>void;onAdmin:()=>void}) {
  return (
    <View style={nav.wrap}>
      <View style={nav.left}>
        <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.40)"/>
        <Text style={nav.username}>{username}</Text>
        <Ionicons name="chevron-down" size={10} color="rgba(255,255,255,0.30)"/>
      </View>
      <View style={nav.right}>
        {[
          {icon:'notifications-outline',cb:onNotif,dot:true},
          {icon:'settings-outline',     cb:onSettings},
          {icon:'eye-outline',          cb:onAdmin},
        ].map(({icon,cb,dot})=>(
          <TouchableOpacity key={icon} style={nav.iconBtn} onPress={cb} activeOpacity={0.75}>
            <BlurView intensity={Platform.OS==='ios'?14:9} tint="dark" style={nav.iconBg}/>
            <Ionicons name={icon as any} size={17} color={G.primary}/>
            {dot&&<View style={nav.dot}/>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});
const nav = StyleSheet.create({
  wrap:    {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PADDING,paddingTop:8,paddingBottom:4},
  left:    {flexDirection:'row',alignItems:'center',gap:5},
  username:{color:G.text,fontSize:17,fontWeight:'800',letterSpacing:-0.2},
  right:   {flexDirection:'row',gap:8},
  iconBtn: {width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,0.12)'},
  iconBg:  {position:'absolute',top:0,left:0,right:0,bottom:0},
  dot:     {position:'absolute',top:6,right:6,width:7,height:7,borderRadius:3.5,backgroundColor:G.primary,borderWidth:1.5,borderColor:G.bg},
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const scrollY  = useRef(new Animated.Value(0)).current;

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<GridTab>(0);
  const [reviews,         setReviews]         = useState<ReviewItem[]>([]);
  const [favWorks,        setFavWorks]        = useState<Work[]>([]);
  const [watchedWorks,    setWatchedWorks]    = useState<Work[]>([]);
  const [recommendations, setRecommendations] = useState<Work[]>([]);
  const [userReels,       setUserReels]       = useState<UserReel[]>([]);
  const [taggedWorks,     setTaggedWorks]     = useState<Work[]>([]);
  const [profileData,     setProfileData]     = useState<ProfileData>(PROFILE_EMPTY);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [userId,          setUserId]          = useState('');

  // ── Refs stables pour callbacks ───────────────────────────────────────────
  const favRef     = useRef<Work[]>([]);
  const watchedRef = useRef<Work[]>([]);
  favRef.current     = favWorks;
  watchedRef.current = watchedWorks;

  // ── Init userId ───────────────────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user:u}})=>{if(u?.id)setUserId(u.id);});
  },[user]);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const loadProfileData = useCallback(async (uid:string)=>{
    const {data} = await supabase.from('profiles').select(PROFILE_COLS).eq('id',uid).maybeSingle();
    if (data) setProfileData(data as ProfileData);
  },[]);

  const fetchFavWorks = useCallback(async (uid:string)=>{
    const {data} = await supabase.from('user_favorites').select('works(*)').eq('user_id',uid);
    const items = (data?.map((d:any)=>d.works).filter(Boolean)??[]) as Work[];
    setFavWorks(items); return items;
  },[]);

  const fetchWatchedWorks = useCallback(async (uid:string)=>{
    const {data} = await supabase.from('user_history').select('works(*)').eq('user_id',uid);
    const items = (data?.map((d:any)=>d.works).filter(Boolean)??[]) as Work[];
    setWatchedWorks(items); return items;
  },[]);

  const fetchRecommendations = useCallback(async (favs:Work[],watched:Work[])=>{
    const combined=[...favs,...watched];
    if (!combined.length) return;
    const genres=[...new Set(combined.map(w=>w.genre))];
    const excl=combined.map(w=>w.id);
    const {data} = await supabase.from('works')
      .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list')
      .in('genre',genres).order('likes',{ascending:false}).limit(12);
    setRecommendations(((data??[]) as Work[]).filter(w=>!excl.includes(w.id)));
  },[]);

  const loadReviews = useCallback(async (uid:string)=>{
    const {data,error} = await supabase.from('critiques')
      .select('id,user_id,reel_id,film_title,title,content,rating,likes_count,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false});
    if (error) { setReviews([]); return; }
    setReviews((data??[]).map((c:any)=>({
      id:String(c.id), filmId:String(c.reel_id??c.id),
      content:String(c.content??''),
      rating:c.rating==null?0:Number(c.rating),
      likes:c.likes_count??0,
      date:c.created_at?new Date(c.created_at).toISOString():new Date().toISOString(),
      film:{id:String(c.reel_id??c.id),title:String(c.film_title??c.title??'—'),
        posterUrl:`https://picsum.photos/seed/crit_${c.id}/400/600`,genre:'—',type:'film' as const},
    } satisfies ReviewItem)));
  },[]);

  const loadUserReels = useCallback(async (uid:string)=>{
    const {data} = await supabase.from('reels')
      .select('id,video_url,thumbnail_url,title,genre,director,year,synopsis,duration,status,rejection_category,rejection_reason,likes_count,views_count,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false});
    setUserReels((data??[]) as UserReel[]);
  },[]);

  // ★ Œuvres où l'user est crédité dans cast_list ou director
  const loadTaggedWorks = useCallback(async (uid:string, name:string, username:string)=>{
    if (!name && !username) return;
    const searchNames = [...new Set([name,username].filter(Boolean))];
    try {
      // Query: works where cast_list overlaps with user's names OR director matches
      const queries = searchNames.map(n=>
        supabase.from('works')
          .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list')
          .overlaps('cast_list',[n])
      );
      const dirQuery = supabase.from('works')
        .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list')
        .or(searchNames.map(n=>`director.ilike.%${n}%`).join(','));

      const results = await Promise.all([...queries, dirQuery]);
      const all = results.flatMap(r=>(r.data??[]) as Work[]);
      const unique = [...new Map(all.map(w=>[w.id,w])).values()];
      setTaggedWorks(unique);
    } catch(e){ console.warn('[profile] tagged works:',e); }
  },[]);

  // ─────────────────────────────────────────────────────────────────────────
  // CHARGEMENT GLOBAL
  // ─────────────────────────────────────────────────────────────────────────
  const loadData = useCallback(async ()=>{
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    setLoading(true);
    try {
      await loadProfileData(uid);
      const [favs,watched] = await Promise.all([
        fetchFavWorks(uid),
        fetchWatchedWorks(uid),
        loadReviews(uid),
        loadUserReels(uid),
      ]);
      fetchRecommendations(favs,watched);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },[userId,fetchFavWorks,fetchWatchedWorks,loadReviews,loadUserReels,loadProfileData,fetchRecommendations]);

  useEffect(()=>{ if(userId) loadData(); },[userId]);

  // ★ Charge les tags une fois le profil connu
  useEffect(()=>{
    if (!userId||!profileData.display_name) return;
    loadTaggedWorks(userId, profileData.display_name, profileData.username);
  },[userId, profileData.display_name, profileData.username, loadTaggedWorks]);

  // ★ useFocusEffect — reload + notification visite si profil externe
  useFocusEffect(useCallback(()=>{
    if (userId) loadData();
    // Notifie le propriétaire du profil si c'est une visite externe
    // (dans un contexte de navigation /user/:id, passer profileOwnerId)
  },[userId,loadData]));

  // ─────────────────────────────────────────────────────────────────────────
  // REALTIME
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if (!userId) return;
    const ts = Date.now();

    // Profile updates (depuis edit.tsx)
    const chProf = supabase.channel(`pf_profile_${ts}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},
        ({new:row})=>{if((row as any).id===userId)setProfileData(prev=>({...prev,...(row as any)}))} )
      .subscribe();

    // Favoris
    const chFav = supabase.channel(`pf_fav_${ts}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'user_favorites'},
        ()=>fetchFavWorks(userId).then(favs=>fetchRecommendations(favs,watchedRef.current)))
      .subscribe();

    // Historique
    const chHist = supabase.channel(`pf_hist_${ts}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'user_history'},
        ()=>fetchWatchedWorks(userId).then(watched=>fetchRecommendations(favRef.current,watched)))
      .subscribe();

    // Critiques
    const chCrit = supabase.channel(`pf_crit_${ts}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'critiques'},
        ()=>loadReviews(userId))
      .subscribe();

    // Reels
    const chReels = supabase.channel(`pf_reels_${ts}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'reels'},
        ({new:row})=>{const r=row as UserReel;if(r.id)setUserReels(prev=>prev.some(x=>x.id===r.id)?prev:[r,...prev]);})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reels'},
        ({new:row})=>{const r=row as UserReel;setUserReels(prev=>prev.map(x=>x.id===r.id?r:x));})
      .subscribe();

    return ()=>{
      supabase.removeChannel(chProf);
      supabase.removeChannel(chFav);
      supabase.removeChannel(chHist);
      supabase.removeChannel(chCrit);
      supabase.removeChannel(chReels);
    };
  },[userId,fetchFavWorks,fetchWatchedWorks,loadReviews,fetchRecommendations]);

  // ─────────────────────────────────────────────────────────────────────────
  // DÉRIVÉS
  // ─────────────────────────────────────────────────────────────────────────
  const sortedReviews = useMemo(
    ()=>[...reviews].sort((a,b)=>(b.likes??0)-(a.likes??0)),
    [reviews]
  );

  const reelsByCategory = useMemo(()=>{
    const courts:UserReel[]=[],moyens:UserReel[]=[],series:UserReel[]=[];
    userReels.forEach(r=>{
      const c=reelCategory(r.duration);
      if(c==='courts')courts.push(r);
      else if(c==='moyens')moyens.push(r);
      else series.push(r);
    });
    return {courts,moyens,series};
  },[userReels]);

  const displayName = profileData.display_name || user?.username || 'Cinéaste';
  const avatarUri   = profileData.avatar_url   || user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`;
  const roleLabel   = ROLE_LABELS[profileData.role] ?? 'Créateur·rice';

  if (!user) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 0 — Films
  // ─────────────────────────────────────────────────────────────────────────
  const renderFilms = ()=>{
    if (loading) return(
      <View><SkeletonSection accentColor={C.gold}/><SkeletonSection accentColor={G.amber}/><SkeletonSection accentColor={G.cyan}/><View style={{height:80}}/></View>
    );
    return(
      <View>
        <SectionHeader icon="trophy" label="Œuvres favorites" subtitle="Tes œuvres préférées" count={favWorks.length} accentColor="#fff" onViewAll={()=>router.push('/profile/favorites' as any)}/>
        {favWorks.length===0
          ? <EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegarde tes films avec l'étoile"/>
          : <HScrollRow>{favWorks.map((f,i)=><PortraitCard key={`fav-${f.id}`} item={f} rank={i+1}/>)}</HScrollRow>
        }
        <View style={pg.div}/>

        <SectionHeader icon="create-outline" label="Mes critiques" subtitle="Classées par popularité" accentColor="#fff" onViewAll={()=>router.push('/profile/reviews' as any)}/>
        {sortedReviews.length===0
          ? <EmptyState icon="chatbubble-outline" text="Aucune critique publiée"/>
          : <HScrollRow>{sortedReviews.map((r,i)=><CritiqueCard key={r.id} review={r} rank={i+1} onPress={()=>router.push(`/review/${r.id}` as any)}/>)}</HScrollRow>
        }
        <View style={pg.div}/>

        <SectionHeader icon="eye-outline" label="Œuvres visionnées" subtitle="Votre historique" accentColor="#fff" onViewAll={()=>router.push('/profile/seen_films' as any)}/>
        {watchedWorks.length===0
          ? <EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marque des films comme vus"/>
          : <HScrollRow>{watchedWorks.map((f,i)=><PortraitCard key={`seen-${f.id}`} item={f} rank={i+1}/>)}</HScrollRow>
        }
        <View style={pg.div}/>

        <SectionHeader icon="sparkles" label="Recommandés" subtitle="Basé sur vos goûts" accentColor="#fff"/>
        {recommendations.length===0
          ? <EmptyState icon="planet-outline" text="Aucune recommandation" subtext="Regardez plus de films"/>
          : <HScrollRow>{recommendations.map(f=><PortraitCard key={`rec-${f.id}`} item={f}/>)}</HScrollRow>
        }
        <View style={{height:110}}/>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1 — Créations
  // ─────────────────────────────────────────────────────────────────────────
  const renderCreations = ()=>{
    if (loading) return <View><SkeletonSection accentColor={G.primary}/><View style={{height:80}}/></View>;

    if (userReels.length===0) return(
      <View style={{paddingTop:60,paddingHorizontal:H_PADDING}}>
        <EmptyState icon="videocam-outline" text="Aucune création" subtext="Importez vos vidéos depuis l'onglet Créer"/>
        <TouchableOpacity style={pg.importBtn} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <LinearGradient colors={['rgba(255,255,255,0.15)','rgba(255,255,255,0.06)']} style={pg.importGrad}>
            <Ionicons name="add-circle-outline" size={16} color={C.white}/>
            <Text style={pg.importTxt}>Importer une vidéo</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={{height:110}}/>
      </View>
    );

    const allNull = userReels.every(r=>r.duration==null);
    const sections = allNull
      ? [{key:'all', label:'Mes vidéos', icon:'videocam' as const, subtitle:'Importées depuis votre appareil', data:userReels}]
      : [
          {key:'courts',label:'Courts métrages',icon:'videocam' as const,subtitle:'≤ 30 min',  data:reelsByCategory.courts},
          {key:'moyens',label:'Moyens métrages',icon:'tv'       as const,subtitle:'30–90 min', data:reelsByCategory.moyens},
          {key:'series',label:'Mini-séries',    icon:'film'     as const,subtitle:'> 90 min',  data:reelsByCategory.series},
        ].filter(s=>s.data.length>0);

    const pending  = userReels.filter(r=>r.status==='pending').length;
    const approved = userReels.filter(r=>r.status==='approved').length;

    return(
      <View>
        {/* Stats bar */}
        <View style={pg.reelStats}>
          {[
            {v:String(userReels.length), l:'vidéos',      c:C.white  },
            {v:String(approved),         l:'validées',     c:C.success},
            {v:String(pending),          l:'en attente',   c:C.amber  },
          ].map(({v,l,c},i,arr)=>(
            <React.Fragment key={l}>
              <View style={pg.reelStat}>
                <Text style={[pg.reelStatV,{color:c}]}>{v}</Text>
                <Text style={pg.reelStatL}>{l}</Text>
              </View>
              {i<arr.length-1&&<View style={pg.reelStatDiv}/>}
            </React.Fragment>
          ))}
        </View>

        {sections.map((s,si)=>(
          <View key={s.key}>
            <SectionHeader icon={s.icon} label={s.label} subtitle={s.subtitle} accentColor={G.primary}/>
            <HScrollRow paddingBottom={8}>{s.data.map(r=><VideoReelCard key={r.id} reel={r}/>)}</HScrollRow>
            {si<sections.length-1&&<View style={pg.div}/>}
          </View>
        ))}
        <View style={{height:110}}/>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2 — Tags
  // ─────────────────────────────────────────────────────────────────────────
  const renderTags = ()=>{
    if (loading) return <View><SkeletonSection accentColor={G.primary}/><View style={{height:80}}/></View>;

    if (taggedWorks.length===0) return(
      <View style={{paddingTop:60}}>
        <EmptyState icon="pricetag-outline" text="Aucune œuvre taguée"
          subtext={`Demandez à d'autres cinéastes de vous créditer\ndans leurs œuvres sur Universe.`}/>
        <View style={{height:110}}/>
      </View>
    );

    const userLabel = profileData.display_name||profileData.username||user?.username||'';

    // Séparer les œuvres où l'user est réalisateur vs cast
    const asDirector = taggedWorks.filter(w=>w.director&&
      [displayName,profileData.username].some(n=>n&&w.director?.toLowerCase().includes(n.toLowerCase()))
    );
    const asCast = taggedWorks.filter(w=>!asDirector.includes(w));

    return(
      <View>
        {/* Stats */}
        <View style={[pg.reelStats,{marginBottom:0}]}>
          <View style={pg.reelStat}>
            <Text style={pg.reelStatV}>{taggedWorks.length}</Text>
            <Text style={pg.reelStatL}>œuvres</Text>
          </View>
          {asDirector.length>0&&<><View style={pg.reelStatDiv}/><View style={pg.reelStat}>
            <Text style={[pg.reelStatV,{color:C.gold}]}>{asDirector.length}</Text>
            <Text style={pg.reelStatL}>réalisation</Text>
          </View></>}
          {asCast.length>0&&<><View style={pg.reelStatDiv}/><View style={pg.reelStat}>
            <Text style={[pg.reelStatV,{color:C.primary}]}>{asCast.length}</Text>
            <Text style={pg.reelStatL}>casting</Text>
          </View></>}
        </View>

        {asDirector.length>0&&(
          <>
            <SectionHeader icon="film-outline" label="En tant que réalisateur·rice" subtitle="Œuvres que vous avez dirigées" accentColor={C.gold}/>
            <HScrollRow>{asDirector.map(w=><WorkTagCard key={`dir-${w.id}`} work={w} userLabel={userLabel}/>)}</HScrollRow>
            {asCast.length>0&&<View style={pg.div}/>}
          </>
        )}

        {asCast.length>0&&(
          <>
            <SectionHeader icon="people-outline" label="Au générique" subtitle="Œuvres où vous êtes crédité·e" accentColor={G.primary}/>
            <HScrollRow>{asCast.map(w=><WorkTagCard key={`cast-${w.id}`} work={w} userLabel={userLabel}/>)}</HScrollRow>
          </>
        )}
        <View style={{height:110}}/>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const tabs = [
    {icon:'grid-outline' as const,       label:'Films'     },
    {icon:'play-circle-outline' as const,label:'Créations' },
    {icon:'pricetag-outline' as const,   label:'Tags'      },
  ];

  return (
    <View style={pg.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);loadData();}} tintColor={G.primary}/>}
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(13,13,18,0.60)','transparent']} style={pg.topGrad} pointerEvents="none"/>

          <TopNav
            username={displayName}
            onNotif={()=>router.push('/notifications' as any)}
            onSettings={()=>router.push('/settings')}
            onAdmin={()=>router.push('/backoffice/universe-admin' as any)}
          />

          <ProfileHeader
            profile={profileData}
            avatarUri={avatarUri}
            roleLabel={roleLabel}
            filmCount={watchedWorks.length||user.films_seen_count||0}
            critiqueCount={reviews.length}
            reelCount={userReels.length}
            onEdit={()=>router.push('/profile/edit' as any)}
          />
        </SafeAreaView>

        {/* TAB BAR */}
        <View style={pg.tabBar}>
          {tabs.map(({icon,label},idx)=>{
            const active=activeTab===idx;
            const pendingBadge = idx===1 ? userReels.filter(r=>r.status==='pending').length : 0;
            return(
              <TouchableOpacity key={icon} style={pg.tabItem} onPress={()=>setActiveTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active?(icon.replace('-outline','') as any):icon} size={19} color={active?G.primary:'rgba(255,255,255,0.28)'}/>
                <Text style={[pg.tabLabel,active&&pg.tabLabelOn]}>{label}</Text>
                {active&&<View style={pg.tabBar2}/>}
                {pendingBadge>0&&<View style={pg.badge}><Text style={pg.badgeTxt}>{pendingBadge}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab===0&&renderFilms()}
        {activeTab===1&&renderCreations()}
        {activeTab===2&&renderTags()}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:       {flex:1,backgroundColor:G.bg},
  topGrad:    {position:'absolute',top:0,left:0,right:0,height:220},
  div:        {height:StyleSheet.hairlineWidth,backgroundColor:'rgba(255,255,255,0.06)',marginTop:24},
  tabBar:     {flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,0.08)',marginTop:20},
  tabItem:    {flex:1,alignItems:'center',paddingVertical:11,gap:3,position:'relative'},
  tabLabel:   {fontSize:9,fontWeight:'600',color:'rgba(255,255,255,0.28)',letterSpacing:0.5,textTransform:'uppercase'},
  tabLabelOn: {color:G.primary},
  tabBar2:    {position:'absolute',top:0,left:'20%',right:'20%',height:2,backgroundColor:G.primary,borderBottomLeftRadius:2,borderBottomRightRadius:2},
  badge:      {position:'absolute',top:6,right:10,minWidth:16,height:16,borderRadius:8,backgroundColor:C.amber,alignItems:'center',justifyContent:'center',paddingHorizontal:3},
  badgeTxt:   {color:'#03020A',fontSize:8,fontWeight:'900'},
  reelStats:  {flexDirection:'row',paddingHorizontal:H_PADDING,paddingVertical:16,marginBottom:4},
  reelStat:   {flex:1,alignItems:'center',gap:2},
  reelStatV:  {color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.5},
  reelStatL:  {color:'rgba(255,255,255,0.32)',fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  reelStatDiv:{width:1,backgroundColor:'rgba(255,255,255,0.08)',marginHorizontal:8},
  importBtn:  {borderRadius:18,overflow:'hidden',marginTop:20},
  importGrad: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingVertical:14,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,0.18)',borderRadius:18},
  importTxt:  {color:C.white,fontSize:14,fontWeight:'700'},
});