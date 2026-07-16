/**
 * app/film/[id].tsx — UNIVERSE
 *
 * ★ getDeviceId() partout — ZERO supabase.auth.* → plus de userId vide
 * ★ handleSave  → écrit dans user_favorites  (visible sur profile)
 * ★ handleWatch → écrit dans user_history    (visible sur profile)
 * ★ Fetch parallèle : work + statut favori en Phase 1
 * ★ UX/UI enrichi : animations fluides, hero immersif, pros, similaires
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, Modal,
  TouchableOpacity, Dimensions, Platform, Animated,
  Easing, Share, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import { getDeviceId }  from '@/services/api'; // ★ UUID device — zero auth
import PendingContent  from '@/components/PendingContent';
import { tryAutoClaimDailyQuest } from '@/contexts/GamificationSystem';

const { width: W, height: H } = Dimensions.get('window');

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#020810', navyMid:'#0D2240', navyLight:'#163356', navyBright:'#1E4A7A',
  surf:'rgba(13,34,64,0.60)', border:'rgba(255,255,255,0.07)',
  borderBlue:'rgba(90,150,230,0.22)', borderHi:'rgba(255,255,255,0.22)',
  white:'#FFFFFF', text:'#EEF4FF', textSec:'#7A99BE', textTert:'#2E4A68',
  blue:'#5A96E6', gold:'#F5C842', goldDim:'rgba(245,200,66,0.12)',
  red:'#FF3B5C', green:'#2ECC8A', faint:'rgba(255,255,255,0.07)',
  muted:'rgba(255,255,255,0.36)', mid:'rgba(255,255,255,0.55)',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null;
  director:string|null; cast_list:string[]|null; created_at:string;
  video_url:string|null;
}
interface CreatorReel {
  id: string; user_id: string; title: string;
  video_url: string | null; thumbnail_url: string | null;
  duration: number | null; likes_count: number | null;
  views_count: number | null; status: string; created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveImage(raw:string|null|undefined, id:number): string {
  if (!raw) return `https://picsum.photos/seed/work_${id}/800/600`;
  if (raw.startsWith('http')) return raw;
  const { data } = supabase.storage.from('community-images').getPublicUrl(raw);
  return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/800/600`;
}
const fmtLikes = (n:number) => n>=1_000_000?`${(n/1_000_000).toFixed(1)} M`:n>=1_000?`${(n/1_000).toFixed(1)} k`:`${n}`;
const fmtDur   = (m:number) => m>=60?`${Math.floor(m/60)}h${m%60>0?` ${m%60}min`:''}`:`${m} min`;

// ─── Fetch ────────────────────────────────────────────────────────────────────
const WORK_COLS = 'id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,cast_list,created_at,video_url';
async function fetchWork(id:string|number): Promise<Work|null> {
  const { data } = await supabase.from('works').select(WORK_COLS).eq('id', id).maybeSingle();
  return data as Work|null;
}
async function fetchSimilarWorks(work:Work): Promise<Work[]> {
  const { data } = await supabase.from('works').select('id,title,image,likes,genre,category,is_original,duration').neq('id',work.id).eq('genre',work.genre).order('likes',{ascending:false}).limit(6);
  return (data ?? []) as Work[];
}
// Search by genre (not title) — genre-based match is reliable and indexed
async function fetchCreatorReels(genre:string): Promise<CreatorReel[]> {
  if (!genre) return [];
  const { data } = await supabase.from('reels')
    .select('id,user_id,title,video_url,thumbnail_url,duration,likes_count,views_count,status,created_at')
    .eq('genre', genre)
    .eq('status', 'approved')
    .order('likes_count', { ascending: false, nullsFirst: false })
    .limit(6);
  return (data ?? []) as CreatorReel[];
}
// Résout un video_url stocké en base → null si absent (pas de fallback mock)
function resolveVideoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(raw);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return null;
}

function grantXP(userId: string, amount: number, _reason: string) {
  if (!userId) return;
  // add_xp RPC supprimé — increment via quest_progress puis fallback profiles
  supabase.from('quest_progress').select('xp').eq('user_id', userId).maybeSingle()
    .then(({ data }) => {
      const cur = (data as any)?.xp ?? 0;
      supabase.from('quest_progress').upsert(
        { user_id: userId, xp: cur + amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ).then(() => {}, () => {
        supabase.from('profiles').update({ contribution_score: cur + amount }).eq('id', userId).then(() => {}, () => {});
      });
    }, () => {
      supabase.from('profiles').select('contribution_score').eq('id', userId).maybeSingle()
        .then(({ data: p }) => {
          const cur = (p as any)?.contribution_score ?? 0;
          supabase.from('profiles').update({ contribution_score: cur + amount }).eq('id', userId).then(() => {}, () => {});
        }, () => {});
    });
}

function getWorkVideoUrl(work: Work): string | null {
  return resolveVideoUrl(work.video_url);
}
// ─── Video player ─────────────────────────────────────────────────────────────
let _useVideoPlayer: any = () => ({ play(){}, pause(){}, muted:false });
let _VideoView: any = () => null;
if (Platform.OS !== 'web') {
  try { const ev=require('expo-video'); _useVideoPlayer=ev.useVideoPlayer; _VideoView=ev.VideoView; } catch {}
}

const VideoModal = memo(function VideoModal({ visible, videoUrl, title, onClose }: { visible:boolean; videoUrl:string|null; title:string; onClose:()=>void }) {
  const isWeb = Platform.OS === 'web';
  const [videoError, setVideoError] = useState(false);
  const player = _useVideoPlayer(visible&&videoUrl?videoUrl:null, (p:any) => { if (!p) return; p.loop=false; p.muted=false; });

  useEffect(() => {
    if (!visible) { setVideoError(false); return; }
    setVideoError(false);
    if (!player || isWeb || !videoUrl) return;
    try { player.play(); } catch {}
    let cleanup: () => void = () => {};
    try {
      const sub = player.addListener('statusChange', ({ status }: any) => {
        if (status === 'error') setVideoError(true);
      });
      cleanup = () => { try { sub?.remove?.(); } catch {} };
    } catch {}
    return cleanup;
  }, [visible, videoUrl, player, isWeb]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'#000' }}>
        <StatusBar style="light"/>
        {isWeb && !!videoUrl && React.createElement('video', { src:videoUrl, autoPlay:true, controls:true, playsInline:true, style:{ width:'100%', height:'100%', objectFit:'contain', background:'#000' } })}
        {!isWeb && !!videoUrl && !videoError && <_VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="contain" nativeControls/>}
        {/* Overlay léger — uniquement si l'URL n'est pas encore arrivée */}
        {!videoUrl && !videoError && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems:'center', justifyContent:'center', backgroundColor:'#000' }]}>
            <ActivityIndicator color="rgba(255,255,255,0.45)" size="small"/>
          </View>
        )}
        {/* Overlay erreur vidéo */}
        {videoError && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems:'center', justifyContent:'center', gap:20, backgroundColor:'#000' }]}>
            <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.4)"/>
            <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:16, fontWeight:'700' }}>Vidéo indisponible</Text>
            <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:13, textAlign:'center', paddingHorizontal:32 }}>La source vidéo est inaccessible pour le moment.</Text>
            <TouchableOpacity onPress={onClose} style={{ marginTop:8, paddingHorizontal:24, paddingVertical:12, borderRadius:22, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' }}>
              <Text style={{ color:'#fff', fontSize:14, fontWeight:'600' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={{ position:'absolute', top:Platform.OS==='ios'?54:20, right:16, zIndex:10 }} onPress={onClose} hitSlop={12}>
          <BlurView intensity={40} tint="dark" style={{ width:42, height:42, borderRadius:21, overflow:'hidden', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' }}>
            <Ionicons name="close" size={22} color="#fff"/>
          </BlurView>
        </TouchableOpacity>
        <View style={{ position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:20, paddingBottom:Platform.OS==='ios'?44:20, paddingTop:16, backgroundColor:'rgba(0,0,0,0.6)' }} pointerEvents="none">
          <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }} numberOfLines={1}>{title}</Text>
        </View>
      </View>
    </Modal>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = memo(function Skeleton() {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => { const l = Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.52,duration:950,useNativeDriver:true}),Animated.timing(op,{toValue:0.22,duration:950,useNativeDriver:true})])); l.start(); return () => l.stop(); }, [op]);
  const B = ({ w, h, r=8 }:{ w:number|`${number}%`; h:number; r?:number }) => <Animated.View style={{ width:w as any, height:h, borderRadius:r, backgroundColor:C.navyLight, opacity:op, marginBottom:12 }}/>;
  return (
    <View style={{ flex:1 }}>
      <View style={{ height:H*0.46, backgroundColor:C.navyMid }}/>
      <View style={{ paddingHorizontal:20, paddingTop:24 }}>
        <B w={90} h={11}/><B w="72%" h={30}/><B w="48%" h={16}/>
        <View style={{ height:10 }}/>
        <View style={{ flexDirection:'row', gap:8 }}>{[80,80,80].map((w,i) => <B key={i} w={w} h={40} r={12}/>)}</View>
        <View style={{ height:8 }}/><B w="100%" h={54} r={16}/>
        <B w="100%" h={14}/><B w="88%" h={14}/><B w="64%" h={14}/>
      </View>
    </View>
  );
});

// ─── Similar Card ─────────────────────────────────────────────────────────────
const SimilarCard = memo(({ item, onPress }:{ item:Work; onPress:()=>void }) => {
  const uri = resolveImage(item.image, item.id);
  return (
    <TouchableOpacity style={sc.wrap} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri }} style={sc.img} resizeMode="cover"/>
      <LinearGradient colors={['transparent','rgba(2,8,16,0.88)']} style={StyleSheet.absoluteFillObject}/>
      {item.is_original && <View style={sc.badge}><Text style={sc.badgeTxt}>ORIGINAL</Text></View>}
      <View style={sc.info}>
        <Text style={sc.title} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="heart" size={9} color={C.gold}/>
          <Text style={sc.likes}>{fmtLikes(item.likes)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const sc = StyleSheet.create({ wrap:{ width:120, height:178, borderRadius:14, overflow:'hidden', marginRight:12, backgroundColor:C.surf }, img:{ width:'100%', height:'100%' }, badge:{ position:'absolute', top:7, left:7, backgroundColor:C.blue, paddingHorizontal:6, paddingVertical:2.5, borderRadius:5 }, badgeTxt:{ color:C.white, fontSize:8, fontWeight:'800', letterSpacing:0.5 }, info:{ position:'absolute', bottom:9, left:9, right:9, gap:3 }, title:{ color:C.white, fontSize:12, fontWeight:'700', lineHeight:15 }, likes:{ color:'rgba(255,255,255,0.55)', fontSize:10 } });

// ─── Creator Reel Card ────────────────────────────────────────────────────────
const CreatorReelCard = memo(function CreatorReelCard({ reel, onPress }:{ reel:CreatorReel; onPress:()=>void }) {
  const thumb = reel.thumbnail_url
    ? (reel.thumbnail_url.startsWith('http') ? reel.thumbnail_url : supabase.storage.from('community-images').getPublicUrl(reel.thumbnail_url).data?.publicUrl ?? `https://picsum.photos/seed/cr_${reel.id}/200/300`)
    : `https://picsum.photos/seed/cr_${reel.id}/200/300`;
  return (
    <TouchableOpacity style={crc.wrap} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri:thumb }} style={crc.img} resizeMode="cover"/>
      <LinearGradient colors={['transparent','rgba(2,8,16,0.92)']} style={StyleSheet.absoluteFillObject}/>
      {reel.status === 'pending' && <View style={crc.pendBadge}><Text style={crc.pendTxt}>TRAITEMENT</Text></View>}
      <View style={crc.info}>
        <Text style={crc.title} numberOfLines={2}>{reel.title}</Text>
        <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
          {(reel.likes_count ?? 0) > 0 && <View style={{ flexDirection:'row', gap:3, alignItems:'center' }}><Ionicons name="heart" size={9} color={C.muted}/><Text style={crc.stat}>{fmtLikes(reel.likes_count!)}</Text></View>}
          {reel.duration != null && <View style={{ flexDirection:'row', gap:3, alignItems:'center' }}><Ionicons name="time-outline" size={9} color={C.muted}/><Text style={crc.stat}>{fmtDur(reel.duration)}</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
});
const crc = StyleSheet.create({ wrap:{ width:112, height:164, borderRadius:12, overflow:'hidden', marginRight:10, backgroundColor:C.surf }, img:{ width:'100%', height:'100%' }, pendBadge:{ position:'absolute', top:6, left:6, backgroundColor:'rgba(245,200,66,0.88)', paddingHorizontal:5, paddingVertical:2, borderRadius:5 }, pendTxt:{ color:'#000', fontSize:7, fontWeight:'900', letterSpacing:0.5 }, info:{ position:'absolute', bottom:8, left:8, right:8, gap:4 }, title:{ color:C.white, fontSize:11, fontWeight:'700', lineHeight:14 }, stat:{ color:C.muted, fontSize:9 } });

// ─── UI atoms ─────────────────────────────────────────────────────────────────
const SectionTitle = memo(({ children }:{ children:string }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:14 }}>
    <View style={{ width:3, height:18, borderRadius:2, backgroundColor:C.blue }}/>
    <Text style={{ color:C.white, fontSize:16, fontWeight:'800', letterSpacing:-0.2 }}>{children}</Text>
  </View>
));
const InfoRow = memo(({ label, value }:{ label:string; value:string }) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:14, paddingVertical:11, borderBottomWidth:0.5, borderBottomColor:C.border }}>
    <Text style={{ color:C.textSec, fontSize:12, fontWeight:'600' }}>{label}</Text>
    <Text style={{ color:C.text, fontSize:12, fontWeight:'700', maxWidth:'60%' }} numberOfLines={1}>{value}</Text>
  </View>
));
const StatPill = memo(({ icon, value, label, color }:{ icon:string; value:string; label?:string; color?:string }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:9 }}>
    <Ionicons name={icon as any} size={16} color={color??C.textSec}/>
    <View>
      <Text style={{ color:color??C.text, fontSize:13, fontWeight:'700' }}>{value}</Text>
      {label && <Text style={{ color:C.textTert, fontSize:10, fontWeight:'600', marginTop:1 }}>{label}</Text>}
    </View>
  </View>
));

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function FilmDetailScreen() {
  const router   = useRouter();
  const { id }   = useLocalSearchParams<{ id:string }>();
  const rawId    = Array.isArray(id) ? id[0] : id ?? '';

  const [work,          setWork]          = useState<Work|null>(null);
  const [similar,       setSimilar]       = useState<Work[]>([]);
  const [creators,      setCreators]      = useState<CreatorReel[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [liked,         setLiked]         = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [expanded,      setExpanded]      = useState(false);
  const [localLikes,    setLocalLikes]    = useState(0);
  const [userId,        setUserId]        = useState('');
  const [videoOpen,     setVideoOpen]     = useState(false);
  const [videoUrl,      setVideoUrl]      = useState<string|null>(null);
  const [pendingOpen,   setPendingOpen]   = useState(false);
  const [creatorReelVideoUrl, setCreatorReelVideoUrl] = useState<string|null>(null);

  const heartSc = useRef(new Animated.Value(1)).current;
  const reveal  = useRef(new Animated.Value(0)).current;

  // ── ★ Init userId — UUID device (zéro supabase.auth.*) ──────────────────
  useEffect(() => { getDeviceId().then(setUserId); }, []);

  // Reveal anim
  useEffect(() => {
    if (!loading && !error && work)
      Animated.timing(reveal, { toValue:1, duration:420, easing:Easing.out(Easing.cubic), useNativeDriver:true }).start();
  }, [loading, error, work, reveal]);

  // ── ★ Fetch parallèle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!rawId) { setError(true); setLoading(false); return; }
    let dead = false;
    setLoading(true); setError(false);

    async function loadAll() {
      try {
        const uid = userId || await getDeviceId();

        // Phase 1 : work + favori en parallèle
        const [workData, favData] = await Promise.all([
          fetchWork(rawId),
          supabase.from('user_favorites').select('id').eq('user_id', uid).eq('work_id', Number(rawId)).maybeSingle(),
        ]);
        if (dead) return;
        if (!workData) { setError(true); setLoading(false); return; }

        setWork(workData);
        setLocalLikes(workData.likes);
        if ((favData as any)?.data) setSaved(true);
        setLoading(false);

        // Phase 2 : similaires + reels créateurs en parallèle (pros supprimés)
        const [simItems, creatorItems] = await Promise.all([
          fetchSimilarWorks(workData),
          fetchCreatorReels(workData.genre ?? ''),
        ]);
        if (dead) return;
        setSimilar(simItems);
        setCreators(creatorItems);

        // Meilleure vidéo parmi les reels créateurs : approuvée en priorité
        const bestReel = creatorItems.find(r => r.video_url && r.status === 'approved')
                      ?? creatorItems.find(r => r.video_url);
        if (bestReel?.video_url) {
          const rv = bestReel.video_url;
          const reelUrl = rv.startsWith('http')
            ? rv
            : supabase.storage.from('community-images').getPublicUrl(rv).data?.publicUrl ?? '';
          if (reelUrl && !dead) setCreatorReelVideoUrl(reelUrl);
        }
      } catch {
        if (!dead) { setError(true); setLoading(false); }
      }
    }
    loadAll();
    return () => { dead = true; };
  }, [rawId, userId]);

  // Reset sur changement d'id
  useEffect(() => { setLiked(false); setExpanded(false); setSaved(false); setVideoUrl(null); setCreatorReelVideoUrl(null); setPendingOpen(false); }, [rawId]);

  // ── ★ handleSave — écrit dans user_favorites ────────────────────────────
  const handleSave = useCallback(async () => {
    const next = !saved;
    setSaved(next);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const uid = userId || await getDeviceId();
      if (!uid || !rawId) return;
      if (next) {
        const { error } = await supabase.from('user_favorites')
          .upsert({ user_id:uid, work_id:Number(rawId) }, { onConflict:'user_id,work_id' });
        if (error) console.warn('[film] save error:', error.message);
        grantXP(uid, 15, 'save_work');
      } else {
        await supabase.from('user_favorites').delete().eq('user_id', uid).eq('work_id', Number(rawId));
      }
    } catch (e) { console.warn('[film] save error', e); }
  }, [saved, userId, rawId]);

  // ── ★ handleWatch — sync pour éviter le flash gris ─────────────────────
  const handleWatch = useCallback(() => {
    // Résout l'URL en avance (sync) — pas d'attente async avant d'ouvrir le modal
    let url = videoUrl;
    if (!url && work) {
      url = getWorkVideoUrl(work) ?? creatorReelVideoUrl ?? null;
    }

    if (!url) {
      setPendingOpen(true);
      if (userId && rawId)
        supabase.from('user_history').upsert(
          { user_id:userId, work_id:Number(rawId), watched_at:new Date().toISOString() },
          { onConflict:'user_id,work_id' },
        ).then(()=>{}, ()=>{});
      return;
    }

    // Les deux mises à jour sont batchées par React 18 → modal ouvre avec URL déjà prête
    if (!videoUrl) setVideoUrl(url);
    setVideoOpen(true);

    // Historique + XP + quêtes en fire-and-forget
    if (userId && rawId) {
      supabase.from('user_history')
        .upsert({ user_id:userId, work_id:Number(rawId), watched_at:new Date().toISOString() }, { onConflict:'user_id,work_id' })
        .then(() => {
          grantXP(userId, 25, 'watch_work');
          tryAutoClaimDailyQuest(userId, 'daily_watch').then(() => {}, () => {});
          tryAutoClaimDailyQuest(userId, 'daily_explore').then(() => {}, () => {});
        }, () => {});
    }
  }, [videoUrl, creatorReelVideoUrl, work, userId, rawId]);

  // Like
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.sequence([
      Animated.spring(heartSc, { toValue:1.42, useNativeDriver:true, tension:300, friction:7 }),
      Animated.spring(heartSc, { toValue:1, useNativeDriver:true, tension:200, friction:8 }),
    ]).start();
    supabase.from('works').update({ likes:localLikes+(next?1:-1) }).eq('id', rawId).then(() => {});
    if (next) grantXP(userId, 10, 'like_work');
  }, [liked, heartSc, localLikes, rawId, userId]);

  const handleShare = useCallback(() => {
    if (!work) return;
    Share.share({ message:`${work.title} — ${work.description??work.genre}`, title:work.title });
  }, [work]);

  const descShort = useMemo(() => {
    if (!work?.description) return '';
    return work.description.length > 220 ? work.description.slice(0,220).trimEnd()+'…' : work.description;
  }, [work?.description]);

  const infoRows = useMemo(() => {
    if (!work) return [];
    return [
      { label:'Catégorie', value:work.category },
      { label:'Genre', value:work.genre },
      { label:'Année', value:String(work.year) },
      work.duration && { label:'Durée', value:fmtDur(work.duration) },
      work.director && { label:'Réalisateur', value:work.director },
      work.comments!=null && { label:'Commentaires', value:String(work.comments) },
    ].filter(Boolean) as { label:string; value:string }[];
  }, [work]);

  const bodyAnim = useMemo(() => ({ opacity:reveal, transform:[{ translateY:reveal.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }] }), [reveal]);

  if (loading) return <View style={s.root}><StatusBar style="light"/><GalaxyBackground/><Skeleton/></View>;
  if (error || !work) return (
    <View style={[s.root, s.center]}><StatusBar style="light"/><GalaxyBackground/>
      <View style={s.errIcon}><Ionicons name="film-outline" size={32} color={C.textTert}/></View>
      <Text style={s.errTitle}>Œuvre introuvable</Text>
      <Text style={s.errSub}>Cette œuvre n'existe pas dans le catalogue.</Text>
      <TouchableOpacity style={s.errBtn} onPress={() => router.back()}><Ionicons name="chevron-back" size={15} color={C.white}/><Text style={s.errBtnTxt}>Retour</Text></TouchableOpacity>
    </View>
  );

  const heroUri = resolveImage(work.image, work.id);

  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <VideoModal visible={videoOpen} videoUrl={videoUrl} title={work.title} onClose={() => { setVideoOpen(false); setVideoUrl(null); }}/>
      <Modal visible={pendingOpen} animationType="fade" onRequestClose={() => setPendingOpen(false)}>
        <View style={{ flex:1 }}>
          <PendingContent message="Vidéo en cours de traitement" subtitle="Ce contenu sera disponible très prochainement"/>
          <TouchableOpacity
            onPress={() => setPendingOpen(false)}
            style={{ position:'absolute', top:56, left:20, width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' }}
          >
            <Ionicons name="close" size={20} color="#fff"/>
          </TouchableOpacity>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* HERO */}
        <View style={s.heroWrap}>
          <Image source={{ uri:heroUri }} style={s.heroImg} resizeMode="cover"/>
          <LinearGradient colors={['rgba(2,8,16,0.55)','transparent']} locations={[0,0.32]} style={StyleSheet.absoluteFillObject} pointerEvents="none"/>
          <LinearGradient colors={['transparent','rgba(2,8,16,0.42)',C.bg]} locations={[0.38,0.72,1]} style={StyleSheet.absoluteFillObject} pointerEvents="none"/>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={s.blurCircle}><Ionicons name="chevron-back" size={21} color={C.white}/></BlurView>
          </TouchableOpacity>
          <View style={s.topRight}>
            <TouchableOpacity style={s.blurCircle} onPress={handleSave}>
              <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name={saved?'bookmark':'bookmark-outline'} size={18} color={C.white}/>
            </TouchableOpacity>
            <TouchableOpacity style={s.blurCircle} onPress={handleShare} hitSlop={8}>
              <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name="share-outline" size={18} color={C.white}/>
            </TouchableOpacity>
          </View>
          {work.is_original && <View style={s.heroBadge}><Ionicons name="star" size={10} color={C.gold}/><Text style={s.heroBadgeTxt}>ORIGINAL</Text></View>}
        </View>

        {/* BODY */}
        <Animated.View style={[s.body, bodyAnim]}>
          <View style={s.catBadge}>
            <View style={[s.catDot, { backgroundColor:work.is_original?C.blue:C.textSec }]}/>
            <Text style={[s.catTxt, { color:work.is_original?C.blue:C.textSec }]}>{work.category.toUpperCase()}</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.genreLabel}>{work.genre.toUpperCase()}</Text>
            <Text style={s.title} numberOfLines={3}>{work.title}</Text>
            <Text style={s.adj}>{work.adjective||(work.director?`De ${work.director}`:'')} · {work.year}</Text>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.82}>
              <View style={[s.likePill, liked&&{ borderColor:'rgba(255,59,92,0.38)', backgroundColor:'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform:[{ scale:heartSc }] }}><Ionicons name={liked?'heart':'heart-outline'} size={16} color={liked?C.red:C.textSec}/></Animated.View>
                <Text style={[s.likePillVal, liked&&{ color:C.red }]}>{fmtLikes(localLikes)}</Text>
              </View>
            </TouchableOpacity>
            {work.duration!=null && <StatPill icon="time-outline" value={fmtDur(work.duration)} label="Durée"/>}
            {work.year!=null && <StatPill icon="calendar-outline" value={String(work.year)} label="Année"/>}
          </View>

          {/* ★ Bouton Regarder — écrit dans user_history */}
          <TouchableOpacity style={s.watchBtn} onPress={handleWatch} activeOpacity={0.88}>
            <LinearGradient colors={[C.navyBright, C.navyMid]} start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={s.watchGrad}>
              <View style={s.watchIcon}><Ionicons name="play" size={18} color={C.white}/></View>
              <View>
                <Text style={s.watchTxt}>Regarder</Text>
                {work.duration!=null && <Text style={s.watchMeta}>{fmtDur(work.duration)} · HD</Text>}
              </View>
           
            </LinearGradient>
          </TouchableOpacity>

          {/* Synopsis */}
          {!!work.description && (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.synopsis}>{expanded ? work.description : descShort}</Text>
              {work.description.length > 220 && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:8 }}>
                  <Text style={{ color:C.blue, fontSize:13, fontWeight:'700' }}>{expanded?'Réduire':'Lire la suite'}</Text>
                  <Ionicons name={expanded?'chevron-up':'chevron-down'} size={13} color={C.blue}/>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Réalisateur */}
          {!!work.director && (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <View style={s.dirCard}>
                <Image source={{ uri:`https://i.pravatar.cc/120?u=${encodeURIComponent(work.director)}` }} style={s.dirAvatar}/>
                <View>
                  <Text style={s.dirName}>{work.director}</Text>
                  <Text style={s.dirMeta}>{work.genre} · {work.year}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Créateurs — reels liés à cette œuvre */}
          {creators.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Créateurs</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight:4 }}>
                {creators.map(r => (
                  <CreatorReelCard key={r.id} reel={r} onPress={() => router.push(`/reel/${r.id}` as any)}/>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Similaires */}
          {similar.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Dans le même genre</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similar.map(item => <SimilarCard key={item.id} item={item} onPress={() => router.replace(`/film/${item.id}` as any)}/>)}
              </ScrollView>
            </View>
          )}

          {/* Infos */}
          <View style={s.section}>
            <SectionTitle>Informations</SectionTitle>
            <View style={{ backgroundColor:C.surf, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:'hidden' }}>
              {infoRows.map(row => <InfoRow key={row.label} label={row.label} value={row.value}/>)}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex:1, backgroundColor:C.bg },
  center:   { justifyContent:'center', alignItems:'center' },
  scroll:   { paddingBottom:110 },
  heroWrap: { height:H*0.46, position:'relative' },
  heroImg:  { width:'100%', height:'100%' },
  backBtn:  { position:'absolute', top:Platform.OS==='ios'?56:22, left:16 },
  topRight: { position:'absolute', top:Platform.OS==='ios'?56:22, right:16, gap:10, alignItems:'flex-end' },
  blurCircle:{ width:40, height:40, borderRadius:20, overflow:'hidden', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  heroBadge:{ position:'absolute', bottom:18, left:18, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:C.goldDim, paddingHorizontal:10, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(245,200,66,0.28)' },
  heroBadgeTxt:{ color:C.gold, fontSize:9, fontWeight:'800', letterSpacing:1 },
  body:     { paddingHorizontal:20, paddingTop:22 },
  catBadge: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:9, paddingVertical:4, borderRadius:8, borderWidth:0.5, borderColor:'rgba(90,150,230,0.3)', backgroundColor:'rgba(0,0,0,0.35)', alignSelf:'flex-start', marginBottom:14 },
  catDot:   { width:5, height:5, borderRadius:3 },
  catTxt:   { fontSize:9, fontWeight:'800', letterSpacing:0.6 },
  titleBlock:{ marginBottom:20 },
  genreLabel:{ color:C.blue, fontSize:10, fontWeight:'800', letterSpacing:1.5, marginBottom:7 },
  title:    { color:C.white, fontSize:27, fontWeight:'800', letterSpacing:-0.6, lineHeight:33, marginBottom:7 },
  adj:      { color:C.textSec, fontSize:14, fontStyle:'italic' },
  statsRow: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 },
  likePill: { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:9 },
  likePillVal:{ color:C.text, fontSize:13, fontWeight:'700' },
  watchBtn: { borderRadius:16, overflow:'hidden', marginBottom:26, borderWidth:1, borderColor:C.borderBlue },
  watchGrad:{ flexDirection:'row', alignItems:'center', gap:14, paddingVertical:15, paddingHorizontal:20 },
  watchIcon:{ width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.12)', justifyContent:'center', alignItems:'center' },
  watchTxt: { color:'white', fontSize:16, fontWeight:'800', letterSpacing:-0.2 },
  watchMeta:{ color:'rgba(255,255,255,0.6)', fontSize:11, marginTop:2 },
  section:  { marginBottom:28 },
  synopsis: { color:C.textSec, fontSize:14, lineHeight:23 },
  dirCard:  { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, padding:14, borderRadius:16 },
  dirAvatar:{ width:50, height:50, borderRadius:25, borderWidth:2, borderColor:C.navyLight },
  dirName:  { color:C.text, fontSize:15, fontWeight:'700' },
  dirMeta:  { color:C.textSec, fontSize:12, marginTop:2 },
  errIcon:  { width:72, height:72, borderRadius:36, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, justifyContent:'center', alignItems:'center', marginBottom:16 },
  errTitle: { color:C.textSec, fontSize:18, fontWeight:'700', marginBottom:8 },
  errSub:   { color:C.textTert, fontSize:13, textAlign:'center', paddingHorizontal:40, lineHeight:20, marginBottom:24 },
  errBtn:   { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:22, paddingVertical:12, borderRadius:14, backgroundColor:C.navyLight, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  errBtnTxt:{ color:C.white, fontWeight:'700', fontSize:14 },
});