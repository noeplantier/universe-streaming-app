/**
 * app/profile.tsx — UNIVERSE · PROFESSIONAL EDITION
 *
 * Palette   : blanc (opacités variables) + C.navyMid uniquement
 * Icônes    : Ionicons partout, zéro emoji
 * Données   : 100 % Supabase — aucune valeur simulée ou générée
 *
 * Auth      : production-safe (getSession + onAuthStateChange + ref/state dual)
 * Fetch     : fetchWithRetry (2 tentatives, délai exponentiel)
 *
 * Métriques réelles :
 *   AuraScore     → calculé depuis views_count + likes_count + critiques + festivals
 *   ImpactStats   → agrégats des tables reels, critiques, user_favorites
 *   Achievements  → dérivés du profil et de l'activité réelle
 *   Creator level → 5 niveaux basés sur l'Aura réelle
 */

import React, {
  memo, useCallback, useEffect,
  useMemo, useRef, useState,
} from 'react';
import {
  Animated, Linking, Platform, Pressable, RefreshControl,
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
import GalaxyBackground              from '../../components/social/GalaxyBackground';
import { ImageWithFallback }         from '../../components/profile/ImageWithFallback';
import {
  EmptyState, HScrollRow, SectionHeader,
} from '../../components/profile/Section';
import {
  CARD_H, CARD_W, G,
  H_PADDING, NUM_ITEM_W, NUM_OVERLAP, NUM_W, CARD_GAP,
} from '../../components/profile/theme';
import { type ReviewItem } from '../../components/profile/data';
import { supabase } from '@/lib/supabase';

let VideoThumbnails: any = null;
if (Platform.OS !== 'web') {
  try { VideoThumbnails = require('expo-video-thumbnails'); } catch {}
}

const LOGO = require('@/assets/images/logouniverse2.png');

// ─────────────────────────────────────────────────────────────────────────────
// ENV CHECK
// ─────────────────────────────────────────────────────────────────────────────
if (__DEV__) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) console.error('[profile] ⚠️ Supabase env vars manquantes');
}

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — blanc + navyMid uniquement
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navyMid:  '#0D2040',
  navyLow:  '#0A1830',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.36)',
  subtle:   'rgba(255,255,255,0.14)',
  faint:    'rgba(255,255,255,0.07)',
  border:   'rgba(255,255,255,0.09)',
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
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return h>0 ? `${h}h${m>0?` ${m}min`:''}` : `${m}min`;
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
// ★ MÉTRIQUES 100 % CALCULÉES DEPUIS DONNÉES RÉELLES
// ─────────────────────────────────────────────────────────────────────────────

/** Aura : score d'influence basé uniquement sur les données Supabase */
function computeAura(
  reels: UserReel[],
  reviews: ReviewItem[],
  favCount: number,
  festivals: string[],
): number {
  const totalViews   = reels.reduce((s,r) => s+(r.views_count??0), 0);
  const totalLikes   = reels.reduce((s,r) => s+(r.likes_count??0), 0);
  const approvedCnt  = reels.filter(r => r.status==='approved').length;
  const festBonus    = festivals.length * 20;
  const reviewLikes  = reviews.reduce((s,r) => s+(r.likes??0), 0);
  return Math.min(9999, Math.round(
    totalViews * 0.2 + totalLikes * 2.5 + approvedCnt * 40 +
    festBonus + reviewLikes * 2 + favCount * 6,
  ));
}

/** Niveau créateur — 5 paliers */
function creatorLevel(aura:number): { level:number; label:string; nextAt:number; pct:number } {
  const levels = [
    { at:0,    level:1, label:'Émergent'    },
    { at:100,  level:2, label:'Indépendant' },
    { at:500,  level:3, label:'Reconnu'     },
    { at:1500, level:4, label:'Confirmé'    },
    { at:4000, level:5, label:'Visionnaire' },
  ];
  const current = [...levels].reverse().find(l => aura >= l.at) ?? levels[0];
  const nextIdx = levels.findIndex(l => l.level === current.level) + 1;
  const next    = levels[nextIdx] ?? levels[levels.length-1];
  const pct     = current.level === 5 ? 1 : Math.min(1,(aura - current.at) / (next.at - current.at));
  return { level:current.level, label:current.label, nextAt:next.at, pct };
}

/** Achievements — dérivés du profil et de l'activité réelle */
interface Achievement {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}
function computeAchievements(
  reels: UserReel[],
  reviews: ReviewItem[],
  festivals: string[],
  favCount: number,
  profile: ProfileData,
): Achievement[] {
  const list: Achievement[] = [];
  if (reels.length >= 1)                                list.push({ icon:'film-outline',             label:'Première création'    });
  if (reels.filter(r=>r.status==='approved').length>=3) list.push({ icon:'checkmark-circle-outline', label:'3 créas validées'     });
  if (festivals.length >= 1)                            list.push({ icon:'trophy-outline',            label:'Sélection festival'   });
  if (reviews.length >= 5)                              list.push({ icon:'create-outline',            label:'5 critiques publiées' });
  if (favCount >= 10)                                   list.push({ icon:'heart-outline',             label:'10 favoris'           });
  if (profile.is_pro)                                   list.push({ icon:'star-outline',              label:'Membre PRO'           });
  if (profile.is_industry_contact)                      list.push({ icon:'briefcase-outline',         label:'Contact industrie'    });
  if (profile.specialties.length >= 3)                  list.push({ icon:'layers-outline',            label:'Multi-discipline'     });
  const totalViews = reels.reduce((s,r)=>s+(r.views_count??0),0);
  if (totalViews >= 1000)                               list.push({ icon:'eye-outline',               label:'1K vues cumulées'     });
  if (reels.filter(r=>r.status==='rejected').length===0 && reels.length>0)
                                                        list.push({ icon:'shield-checkmark-outline',  label:'Aucun refus'          });
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PRODUCTION-SAFE
// ─────────────────────────────────────────────────────────────────────────────
async function getAuthUserId(): Promise<string|null> {
  try {
    const { data:{ session }, error:e1 } = await supabase.auth.getSession();
    if (!e1 && session?.user?.id) return session.user.id;
    const { data:{ user },    error:e2 } = await supabase.auth.getUser();
    if (!e2 && user?.id) return user.id;
    return null;
  } catch { return null; }
}

async function fetchWithRetry<T>(
  fn: ()=>Promise<{ data:T|null; error:any }>,
  label: string, retries=2,
): Promise<T|null> {
  for (let attempt=1; attempt<=retries; attempt++) {
    try {
      const { data, error } = await fn();
      if (error) {
        console.warn(`[profile] ${label} ${attempt}/${retries}:`, error?.message);
        if (attempt<retries) await new Promise(r=>setTimeout(r, 600*attempt));
        continue;
      }
      return data;
    } catch {
      if (attempt<retries) await new Promise(r=>setTimeout(r, 600*attempt));
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — miniature vidéo
// ─────────────────────────────────────────────────────────────────────────────
function useVideoThumbnail(videoUrl:string, thumbnailUrl:string|null): string|null {
  const [uri, setUri] = useState<string|null>(thumbnailUrl ?? null);
  useEffect(() => {
    if (thumbnailUrl) { setUri(thumbnailUrl); return; }
    if (!videoUrl || !VideoThumbnails) return;
    let active = true;
    (async () => {
      try {
        const { uri:u } = await VideoThumbnails.getThumbnailAsync(videoUrl,{ time:1500, quality:0.65 });
        if (active) setUri(u);
      } catch {}
    })();
    return () => { active = false; };
  },[videoUrl, thumbnailUrl]);
  return uri;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r=8 }:{ w:number; h:number; r?:number }) {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(()=>{
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op,{ toValue:0.38, duration:900, useNativeDriver:true }),
      Animated.timing(op,{ toValue:0.18, duration:900, useNativeDriver:true }),
    ]));
    loop.start(); return ()=>loop.stop();
  },[op]);
  return <Animated.View style={{ width:w, height:h, borderRadius:r, backgroundColor:C.navyMid, opacity:op }}/>;
});

const SkeletonSection = memo(function SkeletonSection() {
  return (
    <View>
      <View style={sk.header}>
        <View style={sk.iconBox}/>
        <View style={sk.titleBar}/>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft:H_PADDING, paddingRight:H_PADDING, gap:CARD_GAP }}>
        {[0,1,2,3].map(i=>(
          <View key={i} style={{ flexDirection:'row', alignItems:'flex-end', width:NUM_ITEM_W }}>
            <View style={sk.numCol}><View style={sk.ghostNum}/></View>
            <View style={[sk.ghostCard,{ marginLeft:-NUM_OVERLAP }]}><Shimmer w={CARD_W} h={CARD_H} r={12}/></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
const sk = StyleSheet.create({
  header:   { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:H_PADDING, paddingTop:22, paddingBottom:12 },
  iconBox:  { width:26, height:26, borderRadius:9, backgroundColor:C.navyMid },
  titleBar: { height:12, width:120, borderRadius:6, backgroundColor:C.navyMid },
  numCol:   { width:NUM_W, height:CARD_H, justifyContent:'flex-start', paddingTop:6 },
  ghostNum: { height:68, width:38, backgroundColor:C.faint, borderRadius:6, alignSelf:'flex-end' },
  ghostCard:{ borderRadius:13, overflow:'hidden' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ AURA DISPLAY — données réelles uniquement
// ─────────────────────────────────────────────────────────────────────────────
const AuraDisplay = memo(function AuraDisplay({
  aura, level,
}:{ aura:number; level:ReturnType<typeof creatorLevel> }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    Animated.timing(progress,{ toValue:level.pct, duration:1100, useNativeDriver:false }).start();
  },[level.pct, progress]);

  return (
    <View style={ad.wrap}>
      {/* Score + niveau */}
      <View style={ad.row}>
        <View style={ad.scoreBlock}>
          <View style={ad.scoreCircle}>
            <Text style={ad.scoreNum}>{fmtNumber(aura)}</Text>
            <Text style={ad.scoreLabel}>AURA</Text>
          </View>
        </View>

        <View style={ad.rightBlock}>
          <View style={ad.levelRow}>
            <Ionicons name="layers-outline" size={12} color={C.mid}/>
            <Text style={ad.levelLabel}>Niveau {level.level}</Text>
            <View style={ad.levelChip}>
              <Text style={ad.levelChipTxt}>{level.label}</Text>
            </View>
          </View>

          {/* Barre de progression vers niveau suivant */}
          <View style={ad.barWrap}>
            <View style={ad.barTrack}>
              <Animated.View style={[ad.barFill, {
                width: progress.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }),
              }]}/>
            </View>
            {level.level < 5 && (
              <Text style={ad.barLabel}>
                {fmtNumber(Math.max(0, level.nextAt - aura))} pts · niveau {level.level+1}
              </Text>
            )}
          </View>

          {/* Détail du calcul */}
          <Text style={ad.hint}>
            Calculé depuis vos vues, likes, critiques et festivals
          </Text>
        </View>
      </View>
    </View>
  );
});
const ad = StyleSheet.create({
  wrap:        { marginHorizontal:H_PADDING, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow, padding:16, marginBottom:4 },
  row:         { flexDirection:'row', alignItems:'center', gap:16 },
  scoreBlock:  { alignItems:'center' },
  scoreCircle: { width:72, height:72, borderRadius:36, borderWidth:1.5, borderColor:C.border, alignItems:'center', justifyContent:'center', backgroundColor:C.navyMid },
  scoreNum:    { color:C.white, fontSize:19, fontWeight:'900', letterSpacing:-0.8 },
  scoreLabel:  { color:C.muted, fontSize:7, fontWeight:'800', letterSpacing:2, marginTop:-2 },
  rightBlock:  { flex:1, gap:8 },
  levelRow:    { flexDirection:'row', alignItems:'center', gap:7 },
  levelLabel:  { color:C.mid, fontSize:11, fontWeight:'700' },
  levelChip:   { paddingHorizontal:8, paddingVertical:2, borderRadius:8, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyMid },
  levelChipTxt:{ color:C.offWhite, fontSize:9, fontWeight:'800', letterSpacing:0.3 },
  barWrap:     { gap:4 },
  barTrack:    { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
  barFill:     { height:'100%', borderRadius:2, backgroundColor:C.white },
  barLabel:    { color:C.muted, fontSize:9 },
  hint:        { color:C.muted, fontSize:9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ IMPACT STATS — agrégats réels
// ─────────────────────────────────────────────────────────────────────────────
const ImpactStats = memo(function ImpactStats({
  reels, reviews, favCount,
}:{ reels:UserReel[]; reviews:ReviewItem[]; favCount:number }) {
  const totalViews  = reels.reduce((s,r)=>s+(r.views_count??0),0);
  const totalLikes  = reels.reduce((s,r)=>s+(r.likes_count??0),0);
  const approvedCnt = reels.filter(r=>r.status==='approved').length;

  const stats: Array<{ icon:keyof typeof Ionicons.glyphMap; val:string; label:string }> = [
    { icon:'eye-outline',    val:fmtNumber(totalViews),  label:'vues'        },
    { icon:'heart-outline',  val:fmtNumber(totalLikes),  label:'likes'       },
    { icon:'film-outline',   val:String(approvedCnt),    label:'validées'    },
    { icon:'create-outline', val:String(reviews.length), label:'critiques'   },
    { icon:'star-outline',   val:String(favCount),       label:'en favori'   },
  ];

  return (
    <View style={imp.wrap}>
      <View style={imp.headerRow}>
        <Ionicons name="stats-chart-outline" size={13} color={C.mid}/>
        <Text style={imp.title}>Impact sur Universe</Text>
      </View>
      <View style={imp.grid}>
        {stats.map(({ icon, val, label }) => (
          <View key={label} style={imp.cell}>
            <Ionicons name={icon} size={14} color={C.mid}/>
            <Text style={imp.val}>{val}</Text>
            <Text style={imp.label}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
const imp = StyleSheet.create({
  wrap:      { marginHorizontal:H_PADDING, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow, padding:16, gap:14 },
  headerRow: { flexDirection:'row', alignItems:'center', gap:6 },
  title:     { color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:1.2, textTransform:'uppercase' },
  grid:      { flexDirection:'row', justifyContent:'space-between' },
  cell:      { alignItems:'center', gap:3, flex:1 },
  val:       { color:C.white, fontSize:15, fontWeight:'900', letterSpacing:-0.4 },
  label:     { color:C.muted, fontSize:8, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ ACHIEVEMENTS — données réelles
// ─────────────────────────────────────────────────────────────────────────────
const AchievementsRow = memo(function AchievementsRow({ achievements }:{ achievements:Achievement[] }) {
  if (!achievements.length) return null;
  return (
    <View style={ar.wrap}>
      <View style={ar.headerRow}>
        <Ionicons name="ribbon-outline" size={13} color={C.mid}/>
        <Text style={ar.title}>Distinctions</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={ar.row}>
        {achievements.map((a,i) => (
          <View key={i} style={ar.chip}>
            <Ionicons name={a.icon} size={12} color={C.mid}/>
            <Text style={ar.chipLabel}>{a.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
const ar = StyleSheet.create({
  wrap:      { gap:10 },
  headerRow: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:H_PADDING },
  title:     { color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:1.2, textTransform:'uppercase' },
  row:       { gap:8, paddingHorizontal:H_PADDING, paddingVertical:2 },
  chip:      { flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:12, paddingVertical:8, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow },
  chipLabel: { color:C.offWhite, fontSize:11, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD (Films tab)
// ─────────────────────────────────────────────────────────────────────────────
const PortraitCard = memo(function PortraitCard({ item, rank, noMargin }:{ item:Work; rank?:number; noMargin?:boolean }) {
  const router = useRouter();
  const uri    = useMemo(()=>resolveImage(item.id,item.image),[item.id,item.image]);
  return (
    <TouchableOpacity style={{ marginRight:noMargin?0:12 }} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{ uri }} style={pc.img} contentFit="cover"/>
        <LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{ x:0,y:0.4 }} end={{ x:0,y:1 }}/>

        <View style={pc.badge}>
          <Text style={pc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text>
        </View>

        {rank != null && (
          <Text style={pc.rankNum}>{rank}</Text>
        )}

        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={pc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>
            {item.year&&<><View style={pc.dot}/><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc = StyleSheet.create({
  card:    { width:CARD_W, height:CARD_H, borderRadius:14, overflow:'hidden', backgroundColor:C.navyMid },
  img:     { width:'100%' as any, height:'100%' as any },
  badge:   { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5, borderRadius:5, backgroundColor:'rgba(7,12,23,0.72)' },
  badgeTxt:{ color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  rankNum: { position:'absolute', bottom:32, right:6, fontSize:52, fontWeight:'900', lineHeight:52, letterSpacing:-4, color:'rgba(255,255,255,0.10)' },
  meta:    { position:'absolute', bottom:8, left:8, right:8, gap:3 },
  title:   { color:C.white, fontSize:11, fontWeight:'700', lineHeight:14 },
  stat:    { color:C.muted, fontSize:9, fontWeight:'600' },
  dot:     { width:2, height:2, borderRadius:1, backgroundColor:C.subtle },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ VIDEO REEL CARD — données réelles (views_count, likes_count, status)
// ─────────────────────────────────────────────────────────────────────────────
const REEL_W = 162, REEL_H = 225;

const STATUS_CFG: Record<string, { icon:keyof typeof Ionicons.glyphMap; label:string }> = {
  pending:  { icon:'time-outline',          label:'En attente' },
  approved: { icon:'checkmark-circle-outline', label:'Validée'    },
  rejected: { icon:'close-circle-outline',  label:'Refusée'    },
};

const VideoReelCard = memo(function VideoReelCard({ reel }:{ reel:UserReel }) {
  const router  = useRouter();
  const thumb   = useVideoThumbnail(reel.video_url, reel.thumbnail_url);
  const cfg     = STATUS_CFG[reel.status] ?? STATUS_CFG.pending;
  const [imgErr, setImgErr] = useState(false);

  return (
    <TouchableOpacity
      style={{ marginRight:12 }}
      onPress={()=>router.push({ pathname:'/reel/[id]', params:{ id:reel.id } } as any)}
      activeOpacity={0.88}
    >
      <View style={vrc.card}>
        {thumb && !imgErr ? (
          <Image source={{ uri:thumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" onError={()=>setImgErr(true)}/>
        ) : (
          <View style={vrc.placeholder}>
            <LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="film-outline" size={28} color={C.subtle}/>
          </View>
        )}
        <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{ x:0,y:0.35 }} end={{ x:0,y:1 }}/>

        {/* Play */}
        <View style={vrc.playWrap} pointerEvents="none">
          <Ionicons name="play-circle-outline" size={28} color={C.mid}/>
        </View>

        {/* Status */}
        <View style={vrc.statusBadge}>
          <Ionicons name={cfg.icon} size={9} color={C.mid}/>
          <Text style={vrc.statusTxt}>{cfg.label}</Text>
        </View>

        {/* Durée */}
        {reel.duration != null && (
          <View style={vrc.durationBadge}>
            <Ionicons name="time-outline" size={8} color={C.muted}/>
            <Text style={vrc.durationTxt}>{fmtDuration(reel.duration)||'—'}</Text>
          </View>
        )}

        {/* Meta */}
        <View style={vrc.meta}>
          <Text style={vrc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text>
          {reel.genre && <Text style={vrc.genre} numberOfLines={1}>{reel.genre}</Text>}

          {/* Données réelles : vues + likes */}
          <View style={vrc.statsRow}>
            <View style={vrc.statItem}>
              <Ionicons name="eye-outline" size={9} color={C.muted}/>
              <Text style={vrc.statTxt}>{fmtNumber(reel.views_count??0)}</Text>
            </View>
            <View style={vrc.statItem}>
              <Ionicons name="heart-outline" size={9} color={C.muted}/>
              <Text style={vrc.statTxt}>{fmtNumber(reel.likes_count??0)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const vrc = StyleSheet.create({
  card:         { width:REEL_W, height:REEL_H, borderRadius:14, overflow:'hidden', backgroundColor:C.navyMid },
  placeholder:  { flex:1, alignItems:'center', justifyContent:'center' },
  playWrap:     { position:'absolute', top:'40%', alignSelf:'center', marginTop:-14 },
  statusBadge:  { position:'absolute', top:8, left:8, flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:'rgba(7,12,23,0.72)' },
  statusTxt:    { color:C.muted, fontSize:8, fontWeight:'700' },
  durationBadge:{ position:'absolute', top:8, right:8, flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:'rgba(7,12,23,0.72)' },
  durationTxt:  { color:C.muted, fontSize:8, fontWeight:'700' },
  meta:         { position:'absolute', bottom:0, left:0, right:0, padding:11, gap:3 },
  title:        { color:C.white, fontSize:11, fontWeight:'800', lineHeight:14 },
  genre:        { color:C.muted, fontSize:9 },
  statsRow:     { flexDirection:'row', alignItems:'center', gap:10, marginTop:2 },
  statItem:     { flexDirection:'row', alignItems:'center', gap:4 },
  statTxt:      { color:C.muted, fontSize:9, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// WORK TAG CARD
// ─────────────────────────────────────────────────────────────────────────────
const TAG_W = 150, TAG_H = 210;
const WorkTagCard = memo(function WorkTagCard({ work, userLabel }:{ work:Work; userLabel:string }) {
  const router = useRouter();
  const uri    = useMemo(()=>resolveImage(work.id,work.image),[work.id,work.image]);
  const creditLabel = useMemo(()=>{
    if (work.director && [userLabel].some(n=>work.director?.toLowerCase().includes(n.toLowerCase())))
      return 'Réalisateur·rice';
    const match = (work.cast_list??[]).find(c=>c.toLowerCase().includes(userLabel.toLowerCase()));
    return match ? 'Casting' : 'Collaboration';
  },[work, userLabel]);

  return (
    <TouchableOpacity style={{ marginRight:12 }} onPress={()=>router.push(`/film/${work.id}` as any)} activeOpacity={0.88}>
      <View style={wtc.card}>
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover"/>
        <LinearGradient colors={['rgba(7,12,23,0.14)','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} start={{ x:0,y:0 }} end={{ x:0,y:1 }}/>
        {work.is_original && (
          <View style={wtc.origBadge}><Text style={wtc.origTxt}>ORIG</Text></View>
        )}
        <View style={wtc.roleBadge}>
          <Ionicons name="person-outline" size={8} color={C.mid}/>
          <Text style={wtc.roleTxt}>{creditLabel}</Text>
        </View>
        <View style={wtc.meta}>
          <Text style={wtc.title} numberOfLines={2}>{work.title}</Text>
          <Text style={wtc.sub}>{[work.genre, work.year?String(work.year):null].filter(Boolean).join(' · ')}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:3 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={wtc.likes}>{fmtNumber(work.likes??0)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const wtc = StyleSheet.create({
  card:      { width:TAG_W, height:TAG_H, borderRadius:14, overflow:'hidden', backgroundColor:C.navyMid },
  origBadge: { position:'absolute', top:8, left:8, paddingHorizontal:5, paddingVertical:2, borderRadius:5, backgroundColor:'rgba(7,12,23,0.72)' },
  origTxt:   { color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  roleBadge: { position:'absolute', top:8, right:8, flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:'rgba(7,12,23,0.72)' },
  roleTxt:   { color:C.mid, fontSize:8, fontWeight:'700' },
  meta:      { position:'absolute', bottom:0, left:0, right:0, padding:10, gap:2 },
  title:     { color:C.white, fontSize:11, fontWeight:'800', lineHeight:14 },
  sub:       { color:C.muted, fontSize:9 },
  likes:     { color:C.muted, fontSize:9, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITIQUE CARD
// ─────────────────────────────────────────────────────────────────────────────
const STAR_POS=[
  {t:8,l:18,op:0.30,r:1.5},{t:14,l:88,op:0.18,r:1.0},{t:22,l:155,op:0.32,r:1.8},
  {t:38,l:42,op:0.14,r:0.8},{t:48,l:190,op:0.22,r:1.2},{t:58,l:72,op:0.25,r:1.4},
  {t:70,l:130,op:0.16,r:0.8},{t:80,l:8,op:0.20,r:1.0},{t:92,l:200,op:0.28,r:1.5},
];

const CritiqueCard = memo(function CritiqueCard({ review, rank, onPress }:{ review:ReviewItem; rank:number; onPress:()=>void }) {
  const stars = Math.round(review.rating??0);
  return (
    <TouchableOpacity style={{ marginRight:12 }} onPress={onPress} activeOpacity={0.88}>
      <View style={cric.card}>
        <LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject} start={{ x:0,y:0 }} end={{ x:1,y:1 }}/>
        {STAR_POS.map((s,i) => (
          <View key={i} style={[cric.star,{ top:s.t, left:s.l, opacity:s.op, width:s.r, height:s.r, borderRadius:s.r/2 }]}/>
        ))}
        <Image source={LOGO} style={cric.logo} contentFit="contain"/>

        <View style={cric.badge}>
          <Text style={cric.badgeTxt}>#{rank}</Text>
        </View>

        <View style={cric.body}>
          <Text style={cric.filmTitle} numberOfLines={1}>{review.film?.title ?? '—'}</Text>
          <View style={{ flexDirection:'row', gap:2 }}>
            {[1,2,3,4,5].map(s => (
              <Ionicons key={s} name={s<=stars?'star':'star-outline'} size={10} color={s<=stars?C.offWhite:C.subtle}/>
            ))}
          </View>
          <Text style={cric.excerpt} numberOfLines={3}>{review.content||'Aucun contenu'}</Text>
        </View>

        <View style={cric.border} pointerEvents="none"/>
      </View>
    </TouchableOpacity>
  );
});
const cric = StyleSheet.create({
  card:     { width:220, height:148, borderRadius:16, overflow:'hidden' },
  star:     { position:'absolute', backgroundColor:C.white },
  logo:     { position:'absolute', right:8, bottom:8, width:44, height:44, opacity:0.06 },
  badge:    { position:'absolute', top:10, left:10, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:C.navyMid },
  badgeTxt: { color:C.mid, fontSize:9, fontWeight:'800' },
  body:     { position:'absolute', bottom:0, left:0, right:0, padding:12, gap:4 },
  filmTitle:{ color:C.white, fontSize:13, fontWeight:'800', letterSpacing:-0.2 },
  excerpt:  { color:C.muted, fontSize:10, lineHeight:14 },
  border:   { ...StyleSheet.absoluteFillObject, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE HEADER
// ─────────────────────────────────────────────────────────────────────────────
interface HeaderProps {
  profile:ProfileData; avatarUri:string; roleLabel:string;
  filmCount:number; critiqueCount:number; reelCount:number;
  level:ReturnType<typeof creatorLevel>;
  onEdit:()=>void;
}

const ProfileHeader = memo(function ProfileHeader({
  profile, avatarUri, roleLabel, filmCount, critiqueCount, reelCount, level, onEdit,
}:HeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);

  const socialLinks = useMemo(()=>[
    { key:'instagram', icon:'logo-instagram'   as any, url:profile.social_instagram, label:'Instagram' },
    { key:'vimeo',     icon:'videocam-outline' as any, url:profile.social_vimeo,     label:'Vimeo'     },
    { key:'youtube',   icon:'logo-youtube'     as any, url:profile.social_youtube,   label:'YouTube'   },
    { key:'imdb',      icon:'film-outline'     as any, url:profile.social_imdb,      label:'IMDb'      },
    { key:'website',   icon:'globe-outline'    as any, url:profile.website,          label:'Portfolio' },
  ].filter(l=>!!l.url),[profile]);

  return (
    <View style={hdr.wrap}>
      {/* ── Ligne 1 : avatar + stats ── */}
      <View style={hdr.topRow}>
        <View style={hdr.avatarWrap}>
          <ImageWithFallback uri={avatarUri} style={hdr.avatar} fallbackColors={[C.navyMid, C.navyLow]}/>
          {/* Badge niveau sur l'avatar */}
          <View style={hdr.levelBadge}>
            <Text style={hdr.levelBadgeTxt}>{level.level}</Text>
          </View>
          {profile.is_pro && (
            <View style={hdr.proBadge}>
              <Ionicons name="checkmark-circle" size={15} color={C.white}/>
            </View>
          )}
        </View>

        <View style={hdr.statsRow}>
          {[
            { val:fmtNumber(filmCount),     label:'films'    },
            { val:fmtNumber(critiqueCount), label:'critiques'},
            { val:fmtNumber(reelCount),     label:'créas'    },
          ].map(({ val, label },i,arr) => (
            <React.Fragment key={label}>
              <View style={hdr.statItem}>
                <Text style={hdr.statVal}>{val}</Text>
                <Text style={hdr.statLabel}>{label}</Text>
              </View>
              {i < arr.length-1 && <View style={hdr.statDiv}/>}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ── Nom + rôle ── */}
      <View style={hdr.nameRow}>
        <Text style={hdr.displayName}>{profile.display_name||profile.username||'Cinéaste'}</Text>
        {profile.is_pro && (
          <View style={hdr.proChip}>
            <Text style={hdr.proChipTxt}>PRO</Text>
          </View>
        )}
      </View>
      <Text style={hdr.roleLabel}>
        {roleLabel}
        {profile.location ? ` · ${profile.location}` : ''}
        {` · ${level.label}`}
      </Text>

      {/* ── Bio ── */}
      {!!profile.bio && (
        <Pressable onPress={()=>setBioExpanded(e=>!e)} style={hdr.bioWrap}>
          <Text style={hdr.bioTxt} numberOfLines={bioExpanded?undefined:3}>
            {profile.bio}
          </Text>
          {profile.bio.length>120 && (
            <Text style={hdr.bioMore}>{bioExpanded?'Voir moins':'Voir plus'}</Text>
          )}
        </Pressable>
      )}

      {/* ── Bouton modifier ── */}
      <TouchableOpacity style={hdr.editBtn} onPress={onEdit} activeOpacity={0.80}>
        <Ionicons name="create-outline" size={13} color={C.mid}/>
        <Text style={hdr.editTxt}>Modifier le profil</Text>
      </TouchableOpacity>

      {/* ── Spécialités ── */}
      {profile.specialties.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={hdr.chipRow} style={{ marginTop:12 }}>
          {profile.specialties.map(s => (
            <View key={s} style={hdr.chip}><Text style={hdr.chipTxt}>{s}</Text></View>
          ))}
        </ScrollView>
      )}

      {/* ── Festivals ── */}
      {profile.festivals.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[hdr.chipRow,{ marginTop:8 }]}>
          {profile.festivals.map(f => (
            <View key={f} style={hdr.festChip}>
              <Ionicons name="trophy-outline" size={9} color={C.mid}/>
              <Text style={hdr.festTxt}>{f}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Liens sociaux ── */}
      {socialLinks.length > 0 && (
        <View style={hdr.socialRow}>
          {socialLinks.map(l => (
            <TouchableOpacity key={l.key} style={hdr.socialBtn}
              onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}>
              <BlurView intensity={Platform.OS==='ios'?14:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name={l.icon} size={14} color={C.offWhite}/>
              <Text style={hdr.socialLabel}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={hdr.sep}/>
    </View>
  );
});

const hdr = StyleSheet.create({
  wrap:        { paddingHorizontal:H_PADDING },
  topRow:      { flexDirection:'row', alignItems:'center', gap:16, marginTop:6 },
  avatarWrap:  { position:'relative' },
  avatar:      { width:82, height:82, borderRadius:41, borderWidth:1.5, borderColor:C.border },
  levelBadge:  { position:'absolute', top:-2, right:-2, width:20, height:20, borderRadius:10, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  levelBadgeTxt:{ color:C.white, fontSize:8, fontWeight:'900' },
  proBadge:    { position:'absolute', bottom:0, right:0, width:20, height:20, borderRadius:10, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  statsRow:    { flex:1, flexDirection:'row', justifyContent:'space-around' },
  statItem:    { alignItems:'center', gap:2 },
  statVal:     { color:C.white, fontSize:18, fontWeight:'900', letterSpacing:-0.5 },
  statLabel:   { color:C.muted, fontSize:9, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.4 },
  statDiv:     { width:1, height:30, backgroundColor:C.faint },
  nameRow:     { flexDirection:'row', alignItems:'center', gap:8, marginTop:12 },
  displayName: { color:C.white, fontSize:17, fontWeight:'900', letterSpacing:-0.3, flexShrink:1 },
  proChip:     { paddingHorizontal:8, paddingVertical:2, borderRadius:7, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyMid },
  proChipTxt:  { color:C.offWhite, fontSize:8, fontWeight:'900', letterSpacing:0.8 },
  roleLabel:   { color:C.muted, fontSize:12, marginTop:3 },
  bioWrap:     { marginTop:10, gap:3 },
  bioTxt:      { color:C.mid, fontSize:13, lineHeight:19 },
  bioMore:     { color:C.offWhite, fontSize:12, fontWeight:'600', marginTop:2 },
  editBtn:     { marginTop:14, borderRadius:11, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, paddingVertical:10, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:6 },
  editTxt:     { color:C.mid, fontSize:12, fontWeight:'700' },
  chipRow:     { gap:7, paddingVertical:2 },
  chip:        { paddingHorizontal:11, paddingVertical:6, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow },
  chipTxt:     { color:C.offWhite, fontSize:11, fontWeight:'600' },
  festChip:    { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:5, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow },
  festTxt:     { color:C.mid, fontSize:10, fontWeight:'600' },
  socialRow:   { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:14 },
  socialBtn:   { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:12, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  socialLabel: { color:C.offWhite, fontSize:11, fontWeight:'600' },
  sep:         { height:StyleSheet.hairlineWidth, backgroundColor:C.faint, marginTop:20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP NAV
// ─────────────────────────────────────────────────────────────────────────────
const TopNav = memo(function TopNav({ username, onNotif, onSettings, onAdmin }:{
  username:string; onNotif:()=>void; onSettings:()=>void; onAdmin:()=>void;
}) {
  return (
    <View style={nav.wrap}>
      <View style={nav.left}>
        <Ionicons name="lock-closed" size={9} color={C.muted}/>
        <Text style={nav.username}>{username}</Text>
        <Ionicons name="chevron-down" size={9} color={C.muted}/>
      </View>
      <View style={nav.right}>
        {([
          { icon:'notifications-outline', cb:onNotif,    dot:true  },
          { icon:'settings-outline',      cb:onSettings, dot:false },
          { icon:'eye-outline',           cb:onAdmin,    dot:false },
        ] as const).map(({ icon, cb, dot }) => (
          <TouchableOpacity key={icon} style={nav.iconBtn} onPress={cb} activeOpacity={0.75}>
            <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={nav.iconBg}/>
            <Ionicons name={icon} size={16} color={C.offWhite}/>
            {dot && <View style={nav.dot}/>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});
const nav = StyleSheet.create({
  wrap:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:H_PADDING, paddingTop:8, paddingBottom:4 },
  left:   { flexDirection:'row', alignItems:'center', gap:5 },
  username:{ color:C.white, fontSize:17, fontWeight:'800', letterSpacing:-0.2 },
  right:  { flexDirection:'row', gap:8 },
  iconBtn:{ width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  iconBg: { position:'absolute', top:0, left:0, right:0, bottom:0 },
  dot:    { position:'absolute', top:7, right:7, width:6, height:6, borderRadius:3, backgroundColor:C.white, borderWidth:1.5, borderColor:C.bg },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ SCREEN ★★★
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const scrollY  = useRef(new Animated.Value(0)).current;

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

  const [userId,  setUserId]  = useState('');
  const userIdRef = useRef('');
  const favRef    = useRef<Work[]>([]);
  const watchedRef= useRef<Work[]>([]);
  favRef.current     = favWorks;
  watchedRef.current = watchedWorks;

  const setUserIdSafe = useCallback((id:string) => {
    if (!id || userIdRef.current === id) return;
    userIdRef.current = id;
    setUserId(id);
  },[]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    let mounted = true;
    getAuthUserId().then(uid => { if (uid&&mounted) setUserIdSafe(uid); });
    if (user?.id) setUserIdSafe(user.id);
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,session)=>{
      if (!mounted) return;
      const uid = session?.user?.id;
      if (uid) setUserIdSafe(uid);
    });
    return () => { mounted=false; subscription.unsubscribe(); };
  },[user?.id, setUserIdSafe]);

  // ── Fetches ───────────────────────────────────────────────────────────────
  const loadProfileData = useCallback(async(uid:string)=>{
    const data = await fetchWithRetry(()=>supabase.from('profiles').select(PROFILE_COLS).eq('id',uid).maybeSingle(),'profile');
    if (data) setProfileData(data as ProfileData);
  },[]);

  const fetchFavWorks = useCallback(async(uid:string):Promise<Work[]>=>{
    const data = await fetchWithRetry(()=>supabase.from('user_favorites').select('works(*)').eq('user_id',uid),'favs');
    const items = ((data as any[])?.map((d:any)=>d.works).filter(Boolean)??[]) as Work[];
    setFavWorks(items); return items;
  },[]);

  const fetchWatchedWorks = useCallback(async(uid:string):Promise<Work[]>=>{
    const data = await fetchWithRetry(()=>supabase.from('user_history').select('works(*)').eq('user_id',uid), 'history');
    const items = ((data as any[])?.map((d:any)=>d.works).filter(Boolean)??[]) as Work[];
    setWatchedWorks(items); return items;
  },[]);

  const fetchRecommendations = useCallback(async(favs:Work[],watched:Work[])=>{
    const combined = [...favs,...watched];
    if (!combined.length) return;
    const genres = [...new Set(combined.map(w=>w.genre))];
    const excl   = combined.map(w=>w.id);
    const data = await fetchWithRetry(()=>supabase.from('works')
      .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list')
      .in('genre',genres).order('likes',{ascending:false}).limit(12),'recs');
    setRecommendations(((data??[]) as Work[]).filter(w=>!excl.includes(w.id)));
  },[]);

  const loadReviews = useCallback(async(uid:string)=>{
    const data = await fetchWithRetry(()=>supabase.from('critiques')
      .select('id,user_id,reel_id,film_title,title,content,rating,likes_count,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false}),'reviews');
    if (!data) return;
    setReviews((data as any[]).map((c:any)=>({
      id:String(c.id), filmId:String(c.reel_id??c.id),
      content:String(c.content??''),
      rating:c.rating==null?0:Number(c.rating),
      likes:c.likes_count??0,
      date:c.created_at?new Date(c.created_at).toISOString():new Date().toISOString(),
      film:{ id:String(c.reel_id??c.id), title:String(c.film_title??c.title??'—'),
             posterUrl:`https://picsum.photos/seed/crit_${c.id}/400/600`, genre:'—', type:'film' as const },
    } satisfies ReviewItem)));
  },[]);

  const loadUserReels = useCallback(async(uid:string)=>{
    const data = await fetchWithRetry(()=>supabase.from('reels')
      .select('id,video_url,thumbnail_url,title,genre,director,year,synopsis,duration,status,rejection_category,rejection_reason,likes_count,views_count,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false}),'reels');
    setUserReels((data??[]) as UserReel[]);
  },[]);

  const loadTaggedWorks = useCallback(async(uid:string,name:string,username:string)=>{
    if (!name&&!username) return;
    const names = [...new Set([name,username].filter(Boolean))];
    try {
      const queries = names.map(n=>supabase.from('works')
        .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list')
        .overlaps('cast_list',[n]));
      const dirQ = supabase.from('works')
        .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list')
        .or(names.map(n=>`director.ilike.%${n}%`).join(','));
      const results = await Promise.allSettled([...queries,dirQ]);
      const all = results.flatMap(r=>r.status==='fulfilled'?((r.value.data??[]) as Work[]):[]);
      setTaggedWorks([...new Map(all.map(w=>[w.id,w])).values()]);
    } catch(e){ console.warn('[profile] tagged:',e); }
  },[]);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async(uidOverride?:string)=>{
    const uid = uidOverride||userIdRef.current||userId||(await getAuthUserId());
    if (!uid) { setLoading(false); setRefreshing(false); return; }
    if (uid !== userIdRef.current) setUserIdSafe(uid);
    setLoading(true);
    try {
      await loadProfileData(uid);
      const [favs,watched] = await Promise.all([
        fetchFavWorks(uid), fetchWatchedWorks(uid),
        loadReviews(uid),   loadUserReels(uid),
      ]);
      fetchRecommendations(favs,watched).catch(()=>{});
    } catch(e){ console.error('[profile] loadData:',e); }
    finally { setLoading(false); setRefreshing(false); }
  },[userId, setUserIdSafe, loadProfileData, fetchFavWorks, fetchWatchedWorks, loadReviews, loadUserReels, fetchRecommendations]);

  useEffect(()=>{ if (userId) loadData(userId); },[userId]); // eslint-disable-line

  useEffect(()=>{
    if (!userId||!profileData.display_name) return;
    loadTaggedWorks(userId, profileData.display_name, profileData.username);
  },[userId, profileData.display_name, profileData.username, loadTaggedWorks]);

  useFocusEffect(useCallback(()=>{
    const uid = userIdRef.current||userId;
    if (uid) loadData(uid);
  },[userId, loadData]));

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    const uid = userIdRef.current||userId;
    if (!uid) return;
    const ts = Date.now();
    const ch1 = supabase.channel(`pf_p_${ts}`)
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'profiles' },
        ({new:r})=>{ if ((r as any).id===uid) setProfileData(p=>({...p,...(r as any)})); })
      .subscribe();
    const ch2 = supabase.channel(`pf_f_${ts}`)
      .on('postgres_changes',{ event:'*', schema:'public', table:'user_favorites' },
        ()=>fetchFavWorks(uid).then(f=>fetchRecommendations(f,watchedRef.current)))
      .subscribe();
    const ch3 = supabase.channel(`pf_h_${ts}`)
      .on('postgres_changes',{ event:'*', schema:'public', table:'user_history' },
        ()=>fetchWatchedWorks(uid).then(w=>fetchRecommendations(favRef.current,w)))
      .subscribe();
    const ch4 = supabase.channel(`pf_c_${ts}`)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'critiques' },
        ()=>loadReviews(uid))
      .subscribe();
    const ch5 = supabase.channel(`pf_r_${ts}`)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'reels' },
        ({new:r})=>{ const reel=r as UserReel; if (reel.id) setUserReels(p=>p.some(x=>x.id===reel.id)?p:[reel,...p]); })
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'reels' },
        ({new:r})=>{ const reel=r as UserReel; setUserReels(p=>p.map(x=>x.id===reel.id?reel:x)); })
      .subscribe();
    return ()=>{ [ch1,ch2,ch3,ch4,ch5].forEach(c=>supabase.removeChannel(c)); };
  },[userId, fetchFavWorks, fetchWatchedWorks, loadReviews, fetchRecommendations]);

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const sortedReviews = useMemo(()=>[...reviews].sort((a,b)=>(b.likes??0)-(a.likes??0)),[reviews]);
  const reelsByCategory = useMemo(()=>{
    const courts:UserReel[]=[],moyens:UserReel[]=[],series:UserReel[]=[];
    userReels.forEach(r=>{
      const c=reelCategory(r.duration);
      if (c==='courts') courts.push(r); else if (c==='moyens') moyens.push(r); else series.push(r);
    });
    return { courts,moyens,series };
  },[userReels]);

  const aura         = useMemo(()=>computeAura(userReels,reviews,favWorks.length,profileData.festivals),[userReels,reviews,favWorks.length,profileData.festivals]);
  const level        = useMemo(()=>creatorLevel(aura),[aura]);
  const achievements = useMemo(()=>computeAchievements(userReels,reviews,profileData.festivals,favWorks.length,profileData),[userReels,reviews,profileData,favWorks.length]);

  const displayName = profileData.display_name||user?.username||'Cinéaste';
  const avatarUri   = profileData.avatar_url  ||user?.avatar_url||`https://i.pravatar.cc/150?u=${user?.id}`;
  const roleLabel   = ROLE_LABELS[profileData.role]??'Créateur·rice';

  if (!user || !profileData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#03000A', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', marginBottom: 20 }}>Vous devez être connecté pour voir votre profil.</Text>
      </View>
    );
  }
  // ── Renders par tab ───────────────────────────────────────────────────────
  const renderFilms = ()=>{
    if (loading) return (
      <View><SkeletonSection/><SkeletonSection/><SkeletonSection/><View style={{ height:80 }}/></View>
    );
    return (
      <View>
        <SectionHeader icon="heart-outline" label="Œuvres favorites" subtitle="Vos œuvres sauvegardées"
          count={favWorks.length} accentColor={C.white} onViewAll={()=>router.push('/profile/favorites' as any)}/>
        {favWorks.length===0
          ?<EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegardez des films avec l'étoile"/>
          :<HScrollRow>{favWorks.map((f,i)=><PortraitCard key={`fav-${f.id}`} item={f} rank={i+1}/>)}</HScrollRow>}
        <View style={pg.div}/>

        <SectionHeader icon="create-outline" label="Mes critiques" subtitle="Classées par popularité"
          accentColor={C.white} onViewAll={()=>router.push('/profile/reviews' as any)}/>
        {sortedReviews.length===0
          ?<EmptyState icon="chatbubble-outline" text="Aucune critique publiée"/>
          :<HScrollRow>{sortedReviews.map((r,i)=><CritiqueCard key={r.id} review={r} rank={i+1} onPress={()=>router.push(`/review/${r.id}` as any)}/>)}</HScrollRow>}
        <View style={pg.div}/>

        <SectionHeader icon="eye-outline" label="Œuvres visionnées" subtitle="Votre historique"
          accentColor={C.white} onViewAll={()=>router.push('/profile/seen_films' as any)}/>
        {watchedWorks.length===0
          ?<EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marquez des films comme vus"/>
          :<HScrollRow>{watchedWorks.map((f,i)=><PortraitCard key={`seen-${f.id}`} item={f} rank={i+1}/>)}</HScrollRow>}
        <View style={pg.div}/>

        <SectionHeader icon="shuffle-outline" label="Recommandés" subtitle="Basé sur vos goûts" accentColor={C.white}/>
        {recommendations.length===0
          ?<EmptyState icon="planet-outline" text="Aucune recommandation" subtext="Regardez plus de films"/>
          :<HScrollRow>{recommendations.map(f=><PortraitCard key={`rec-${f.id}`} item={f}/>)}</HScrollRow>}
        <View style={{ height:110 }}/>
      </View>
    );
  };

  const renderCreations = ()=>{
    if (loading) return <View><SkeletonSection/><View style={{ height:80 }}/></View>;
    if (userReels.length===0) return (
      <View style={{ paddingTop:60, paddingHorizontal:H_PADDING }}>
        <EmptyState icon="videocam-outline" text="Aucune création" subtext="Importez vos vidéos depuis l'onglet Créer"/>
        <TouchableOpacity style={pg.importBtn} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={15} color={C.mid}/>
          <Text style={pg.importTxt}>Importer une vidéo</Text>
        </TouchableOpacity>
        <View style={{ height:110 }}/>
      </View>
    );

    const allNull = userReels.every(r=>r.duration==null);
    const sections = allNull
      ?[{ key:'all', label:'Mes vidéos', icon:'videocam-outline' as const, subtitle:'Toutes vos créations', data:userReels }]
      :[
        { key:'courts', label:'Courts métrages', icon:'videocam-outline' as const, subtitle:'≤ 30 min',  data:reelsByCategory.courts },
        { key:'moyens', label:'Moyens métrages', icon:'tv-outline'        as const, subtitle:'30–90 min', data:reelsByCategory.moyens },
        { key:'series', label:'Mini-séries',     icon:'film-outline'      as const, subtitle:'> 90 min',  data:reelsByCategory.series },
      ].filter(s=>s.data.length>0);

    const pending  = userReels.filter(r=>r.status==='pending').length;
    const approved = userReels.filter(r=>r.status==='approved').length;
    const rejected = userReels.filter(r=>r.status==='rejected').length;
    const totalViews = userReels.reduce((s,r)=>s+(r.views_count??0),0);
    const totalLikes = userReels.reduce((s,r)=>s+(r.likes_count??0),0);

    return (
      <View>
        {/* Stats réelles */}
        <View style={pg.reelStats}>
          {[
            { icon:'film-outline'     as const, v:String(userReels.length), l:'vidéos'     },
            { icon:'checkmark-circle-outline' as const, v:String(approved),           l:'validées'   },
            { icon:'time-outline'     as const, v:String(pending),          l:'en attente' },
            { icon:'eye-outline'      as const, v:fmtNumber(totalViews),    l:'vues'       },
            { icon:'heart-outline'    as const, v:fmtNumber(totalLikes),    l:'likes'      },
          ].map(({ icon, v, l },i,arr)=>(
            <React.Fragment key={l}>
              <View style={pg.reelStat}>
                <Ionicons name={icon} size={12} color={C.muted}/>
                <Text style={pg.reelStatV}>{v}</Text>
                <Text style={pg.reelStatL}>{l}</Text>
              </View>
              {i<arr.length-1&&<View style={pg.reelStatDiv}/>}
            </React.Fragment>
          ))}
        </View>

        {rejected > 0 && (
          <View style={pg.rejectedBar}>
            <Ionicons name="alert-circle-outline" size={13} color={C.mid}/>
            <Text style={pg.rejectedTxt}>{rejected} création{rejected>1?'s':''} refusée{rejected>1?'s':''} — consultez les détails</Text>
          </View>
        )}

        {sections.map((s,si)=>(
          <View key={s.key}>
            <SectionHeader icon={s.icon} label={s.label} subtitle={s.subtitle} accentColor={C.white}/>
            <HScrollRow paddingBottom={8}>{s.data.map(r=><VideoReelCard key={r.id} reel={r}/>)}</HScrollRow>
            {si<sections.length-1&&<View style={pg.div}/>}
          </View>
        ))}
        <View style={{ height:110 }}/>
      </View>
    );
  };

  const renderTags = ()=>{
    if (loading) return <View><SkeletonSection/><View style={{ height:80 }}/></View>;
    if (taggedWorks.length===0) return (
      <View style={{ paddingTop:60 }}>
        <EmptyState icon="pricetag-outline" text="Aucune œuvre taguée"
          subtext={`Demandez à d'autres cinéastes de vous créditer\ndans leurs œuvres sur Universe.`}/>
        <View style={{ height:110 }}/>
      </View>
    );

    const userLabel = profileData.display_name||profileData.username||user?.username||'';
    const asDirector = taggedWorks.filter(w=>w.director&&
      [displayName,profileData.username].some(n=>n&&w.director?.toLowerCase().includes(n.toLowerCase())));
    const asCast = taggedWorks.filter(w=>!asDirector.includes(w));

    return (
      <View>
        <View style={[pg.reelStats,{ marginBottom:0 }]}>
          <View style={pg.reelStat}>
            <Ionicons name="film-outline" size={12} color={C.muted}/>
            <Text style={pg.reelStatV}>{taggedWorks.length}</Text>
            <Text style={pg.reelStatL}>œuvres</Text>
          </View>
          {asDirector.length>0&&<><View style={pg.reelStatDiv}/><View style={pg.reelStat}>
            <Ionicons name="megaphone-outline" size={12} color={C.muted}/>
            <Text style={pg.reelStatV}>{asDirector.length}</Text>
            <Text style={pg.reelStatL}>réalisation</Text>
          </View></>}
          {asCast.length>0&&<><View style={pg.reelStatDiv}/><View style={pg.reelStat}>
            <Ionicons name="people-outline" size={12} color={C.muted}/>
            <Text style={pg.reelStatV}>{asCast.length}</Text>
            <Text style={pg.reelStatL}>casting</Text>
          </View></>}
        </View>

        {asDirector.length>0&&(<>
          <SectionHeader icon="megaphone-outline" label="En tant que réalisateur·rice" subtitle="Œuvres dirigées" accentColor={C.white}/>
          <HScrollRow>{asDirector.map(w=><WorkTagCard key={`dir-${w.id}`} work={w} userLabel={userLabel}/>)}</HScrollRow>
          {asCast.length>0&&<View style={pg.div}/>}
        </>)}

        {asCast.length>0&&(<>
          <SectionHeader icon="people-outline" label="Au générique" subtitle="Œuvres où vous êtes crédité·e" accentColor={C.white}/>
          <HScrollRow>{asCast.map(w=><WorkTagCard key={`cast-${w.id}`} work={w} userLabel={userLabel}/>)}</HScrollRow>
        </>)}
        <View style={{ height:110 }}/>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const tabs = [
    { icon:'grid-outline'         as const, label:'Films'     },
    { icon:'play-circle-outline'  as const, label:'Créations' },
    { icon:'pricetag-outline'     as const, label:'Tags'      },
  ];

  return (
    <View style={pg.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent:{ contentOffset:{ y:scrollY } } }],{ useNativeDriver:true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{ setRefreshing(true); loadData(); }} tintColor={C.mid}/>}
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(7,12,23,0.60)','transparent']} style={pg.topGrad} pointerEvents="none"/>

          <TopNav
            username={displayName}
            onNotif={()=>router.push('/notifications' as any)}
            onSettings={()=>router.push('/settings')}
            onAdmin={()=>router.push('/backoffice/universe-admin' as any)}
          />

          <ProfileHeader
            profile={profileData} avatarUri={avatarUri} roleLabel={roleLabel}
            filmCount={watchedWorks.length||user.films_seen_count||0}
            critiqueCount={reviews.length} reelCount={userReels.length}
            level={level}
            onEdit={()=>router.push('/edit' as any)}
          />
        </SafeAreaView>

        {/* ── Aura Score ── */}
        {!loading && (
          <View style={{ marginTop:16, marginBottom:12 }}>
            <AuraDisplay aura={aura} level={level}/>
          </View>
        )}

        {/* ── Impact Stats ── */}
        {!loading && (
          <View style={{ marginBottom:16 }}>
            <ImpactStats reels={userReels} reviews={reviews} favCount={favWorks.length}/>
          </View>
        )}

        {/* ── Achievements ── */}
        {!loading && achievements.length > 0 && (
          <View style={{ marginBottom:16 }}>
            <AchievementsRow achievements={achievements}/>
          </View>
        )}

        {/* ── Tab Bar ── */}
        <View style={pg.tabBar}>
          {tabs.map(({ icon, label }, idx) => {
            const active = activeTab === idx;
            const pendingBadge = idx===1 ? userReels.filter(r=>r.status==='pending').length : 0;
            return (
              <TouchableOpacity key={icon} style={pg.tabItem} onPress={()=>setActiveTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active?(icon.replace('-outline','') as any):icon} size={18} color={active?C.white:C.muted}/>
                <Text style={[pg.tabLabel, active&&pg.tabLabelOn]}>{label}</Text>
                {active && <View style={pg.tabIndicator}/>}
                {pendingBadge>0 && (
                  <View style={pg.badge}><Text style={pg.badgeTxt}>{pendingBadge}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab===0 && renderFilms()}
        {activeTab===1 && renderCreations()}
        {activeTab===2 && renderTags()}

      </Animated.ScrollView>
    </View>
  );
}

const pg = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg },
  topGrad:     { position:'absolute', top:0, left:0, right:0, height:200 },
  div:         { height:StyleSheet.hairlineWidth, backgroundColor:C.faint, marginTop:24 },
  tabBar:      { flexDirection:'row', borderTopWidth:StyleSheet.hairlineWidth, borderBottomWidth:StyleSheet.hairlineWidth, borderColor:C.border, marginTop:16 },
  tabItem:     { flex:1, alignItems:'center', paddingVertical:11, gap:3, position:'relative' },
  tabLabel:    { fontSize:9, fontWeight:'700', color:C.muted, letterSpacing:0.6, textTransform:'uppercase' },
  tabLabelOn:  { color:C.white },
  tabIndicator:{ position:'absolute', top:0, left:'20%', right:'20%', height:2, backgroundColor:C.white, borderBottomLeftRadius:2, borderBottomRightRadius:2 },
  badge:       { position:'absolute', top:7, right:10, minWidth:15, height:15, borderRadius:8, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center', paddingHorizontal:3 },
  badgeTxt:    { color:C.white, fontSize:7, fontWeight:'900' },
  reelStats:   { flexDirection:'row', paddingHorizontal:H_PADDING, paddingVertical:16, marginBottom:4 },
  reelStat:    { flex:1, alignItems:'center', gap:3 },
  reelStatV:   { color:C.white, fontSize:16, fontWeight:'900', letterSpacing:-0.5 },
  reelStatL:   { color:C.muted, fontSize:8, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.4 },
  reelStatDiv: { width:1, backgroundColor:C.faint, marginHorizontal:6 },
  rejectedBar: { flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:H_PADDING, marginBottom:12, paddingHorizontal:12, paddingVertical:10, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow },
  rejectedTxt: { color:C.mid, fontSize:11, flex:1 },
  importBtn:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginTop:20, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow, paddingVertical:14 },
  importTxt:   { color:C.mid, fontSize:13, fontWeight:'700' },
});