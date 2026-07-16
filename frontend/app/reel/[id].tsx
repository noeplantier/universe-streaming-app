// ─────────────────────────────────────────────────────────────────────────────
//  app/reel/[id].tsx — UNIVERSE · Détail d'un Reel
//  ★ Fetch depuis public.reels (pas episodes_full)
//  ★ getDeviceId() — ZERO supabase.auth.*
//  ★ VideoModal expo-video (identique film/[id].tsx)
//  ★ like/save écrits en DB avec user_id
//  ★ Créateur depuis public.profiles
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, Modal,
  TouchableOpacity, Dimensions, Platform,
  Animated, Share, Easing, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import { getDeviceId }  from '@/services/api';

// Haptics web-safe
let _Haptics: any = null;
if (Platform.OS !== 'web') {
  try { _Haptics = require('expo-haptics'); } catch {}
}

const { height: H } = Dimensions.get('window');

function grantXP(userId: string | null, amount: number, _reason: string) {
  if (!userId) return;
  supabase.from('quest_progress').select('xp').eq('user_id', userId).maybeSingle()
    .then(({ data }) => {
      const cur = (data as any)?.xp ?? 0;
      supabase.from('quest_progress').upsert(
        { user_id: userId, xp: cur + amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ).then(() => {}, () => {
        supabase.from('profiles').update({ contribution_score: cur + amount }).eq('id', userId).then(() => {}, () => {});
      });
    }, () => {});
}

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg:         '#020810',
  navyMid:    '#0D2240',
  navyLight:  '#163356',
  navyBright: '#1E4A7A',
  surf:       'rgba(13,34,64,0.60)',
  border:     'rgba(255,255,255,0.07)',
  borderHi:   'rgba(255,255,255,0.22)',
  borderBlue: 'rgba(90,150,230,0.22)',
  white:      '#FFFFFF',
  text:       '#EEF4FF',
  textSec:    '#7A99BE',
  textTert:   '#2E4A68',
  blue:       '#5A96E6',
  gold:       '#F5C842',
  red:        '#FF3B5C',
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────
interface ReelData {
  id:           string;
  user_id:      string;
  video_url:    string | null;
  thumbnail_url: string | null;
  title:        string | null;
  genre:        string | null;
  director:     string | null;
  year:         string | null;
  synopsis:     string | null;
  duration:     number | null;
  likes_count:  number;
  views_count:  number;
  status:       string;
  created_at:   string;
}

interface CreatorProfile {
  id:           string;
  display_name: string | null;
  username:     string | null;
  avatar_url:   string | null;
  role:         string | null;
  specialties:  string[] | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtLikes = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)} k`
  : String(n);

function resolveThumb(reel: ReelData): string {
  if (reel.thumbnail_url?.startsWith('http')) return reel.thumbnail_url;
  return `https://picsum.photos/seed/${reel.id}/720/1280`;
}

function resolveReelVideoUrl(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const url = raw.trim();
  if (url.startsWith('http')) return url;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(url);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return '';
}

// ─── Fetch ─────────────────────────────────────────────────────────────────
async function fetchReel(id: string): Promise<ReelData | null> {
  const { data } = await supabase
    .from('reels')
    .select('id,user_id,video_url,thumbnail_url,title,genre,director,year,synopsis,duration,likes_count,views_count,status,created_at')
    .eq('id', id)
    .maybeSingle();
  return data as ReelData | null;
}

async function fetchSimilarReels(genre: string, excludeId: string): Promise<ReelData[]> {
  const { data } = await supabase
    .from('reels')
    .select('id,user_id,thumbnail_url,title,genre,duration,likes_count,views_count,status,created_at')
    .eq('genre', genre)
    .neq('id', excludeId)
    .order('likes_count', { ascending: false })
    .limit(8);
  return (data ?? []) as ReelData[];
}

// ─── expo-video (lazy, web-safe) ──────────────────────────────────────────
let _useVideoPlayer: any = () => ({ play() {}, pause() {}, muted: false });
let _VideoView: any = () => null;
if (Platform.OS !== 'web') {
  try {
    const ev = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView = ev.VideoView;
  } catch {}
}

// ─── VideoModal (identique à film/[id].tsx) ────────────────────────────────
const VideoModal = memo(function VideoModal({
  visible, videoUrl, title, onClose,
}: { visible: boolean; videoUrl: string | null; title: string; onClose: () => void }) {
  const isWeb = Platform.OS === 'web';
  const [videoError, setVideoError] = useState(false);
  const player = _useVideoPlayer(visible && videoUrl ? videoUrl : null, (p: any) => {
    if (!p) return; p.loop = false; p.muted = false;
  });

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
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" />
        {isWeb && !!videoUrl && React.createElement('video', {
          src: videoUrl, autoPlay: true, controls: true, playsInline: true,
          style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' },
        })}
        {!isWeb && !!videoUrl && !videoError && (
          <_VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="contain" nativeControls />
        )}
        {!videoUrl && !videoError && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }]}>
            <ActivityIndicator color="rgba(255,255,255,0.45)" size="small" />
          </View>
        )}
        {videoError && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: '#000' }]}>
            <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.4)" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '700' }}>Vidéo indisponible</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
              La source vidéo est inaccessible pour le moment.
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={{ position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: 16, zIndex: 10 }}
          onPress={onClose} hitSlop={12}
        >
          <BlurView intensity={40} tint="dark" style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Ionicons name="close" size={22} color="#fff" />
          </BlurView>
        </TouchableOpacity>
        <View
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 20, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.6)' }}
          pointerEvents="none"
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        </View>
      </View>
    </Modal>
  );
});

// ─── Skeleton ──────────────────────────────────────────────────────────────
const DetailSkeleton = memo(function DetailSkeleton() {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.52, duration: 950, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.22, duration: 950, useNativeDriver: true }),
    ]));
    l.start(); return () => l.stop();
  }, [op]);
  const B = ({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: C.navyLight, opacity: op, marginBottom: 12 }} />
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: H * 0.44, backgroundColor: C.navyMid }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <B w={80} h={11} /><B w="75%" h={28} /><B w="55%" h={18} />
        <View style={{ height: 8 }} />
        <B w="100%" h={52} r={14} />
      </View>
    </View>
  );
});

// ─── SectionTitle ──────────────────────────────────────────────────────────
const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionDot} />
      <Text style={s.sectionTxt}>{children}</Text>
    </View>
  );
});

// ─── StatPill (identique film/[id].tsx) ────────────────────────────────────
const StatPill = memo(function StatPill({ icon, value, label, color }: { icon: string; value: string; label?: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
      <Ionicons name={icon as any} size={16} color={color ?? C.textSec} />
      <View>
        <Text style={{ color: color ?? C.text, fontSize: 13, fontWeight: '700' }}>{value}</Text>
        {label && <Text style={{ color: C.textTert, fontSize: 10, fontWeight: '600', marginTop: 1 }}>{label}</Text>}
      </View>
    </View>
  );
});

// ─── InfoRow (identique film/[id].tsx) ─────────────────────────────────────
const InfoRow = memo(function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
      <Text style={{ color: C.textSec, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', maxWidth: '60%' }} numberOfLines={1}>{value}</Text>
    </View>
  );
});

// ─── SimilarReelCard ───────────────────────────────────────────────────────
const SimilarReelCard = memo(function SimilarReelCard({
  item, onPress,
}: { item: ReelData; onPress: () => void }) {
  return (
    <TouchableOpacity style={sc.wrap} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: resolveThumb(item) }} style={sc.img} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(2,8,16,0.88)']} style={StyleSheet.absoluteFillObject} />
      <View style={sc.info}>
        <Text style={sc.title} numberOfLines={2}>{item.title || 'Sans titre'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="heart" size={9} color={C.gold} />
          <Text style={sc.likes}>{fmtLikes(item.likes_count ?? 0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const sc = StyleSheet.create({
  wrap:  { width: 120, height: 178, borderRadius: 14, overflow: 'hidden', marginRight: 12, backgroundColor: C.surf },
  img:   { width: '100%', height: '100%' },
  info:  { position: 'absolute', bottom: 9, left: 9, right: 9, gap: 3 },
  title: { color: C.white, fontSize: 12, fontWeight: '700', lineHeight: 15 },
  likes: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
});

// ─── Écran principal ───────────────────────────────────────────────────────
export default function ReelDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [reel,       setReel]       = useState<ReelData | null>(null);
  const [creator,    setCreator]    = useState<CreatorProfile | null>(null);
  const [similar,    setSimilar]    = useState<ReelData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [liked,      setLiked]      = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [expanded,   setExpanded]   = useState(false);
  const [videoOpen,  setVideoOpen]  = useState(false);
  const [videoUrl,   setVideoUrl]   = useState<string | null>(null);

  const heartSc = useRef(new Animated.Value(1)).current;
  const saveSc  = useRef(new Animated.Value(1)).current;
  const reveal  = useRef(new Animated.Value(0)).current;

  // ── Init userId ──────────────────────────────────────────────────────────
  useEffect(() => { getDeviceId().then(setUserId, () => {}); }, []);

  // ── Reveal animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !error && reel)
      Animated.timing(reveal, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [loading, error, reel]);

  // ── Main fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setError(true); setLoading(false); return; }
    let dead = false;
    setLoading(true); setError(false); setReel(null); setCreator(null); setSimilar([]);
    setLiked(false); setSaved(false);

    async function loadAll() {
      try {
        const uid = userId ?? (await getDeviceId());

        // Phase 1 : reel + état like/save en parallèle
        const [reelData, likedR, savedR] = await Promise.all([
          fetchReel(id),
          uid ? supabase.from('user_liked_reels').select('reel_id').eq('user_id', uid).eq('reel_id', id).maybeSingle() : Promise.resolve({ data: null }),
          uid ? supabase.from('user_saved_reels').select('reel_id').eq('user_id', uid).eq('reel_id', id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        if (dead) return;
        if (!reelData) { setError(true); setLoading(false); return; }

        setReel(reelData);
        setLocalLikes(reelData.likes_count ?? 0);
        setLiked(!!(likedR as any)?.data);
        setSaved(!!(savedR as any)?.data);
        setLoading(false);

        // Phase 2 : créateur + similaires
        const [creatorR, simData] = await Promise.all([
          reelData.user_id
            ? supabase.from('profiles').select('id,display_name,username,avatar_url,role,specialties').eq('id', reelData.user_id).maybeSingle()
            : Promise.resolve({ data: null }),
          reelData.genre ? fetchSimilarReels(reelData.genre, id) : Promise.resolve([]),
        ]);

        if (dead) return;
        setCreator((creatorR as any)?.data as CreatorProfile | null);
        setSimilar(simData);
      } catch {
        if (!dead) { setError(true); setLoading(false); }
      }
    }

    loadAll();
    return () => { dead = true; };
  }, [id, userId]);

  // ── handleLike ───────────────────────────────────────────────────────────
  const handleLike = useCallback(async () => {
    if (!reel) return;
    const next = !liked;
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
    _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Medium).catch(() => {});
    Animated.sequence([
      Animated.spring(heartSc, { toValue: 1.45, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(heartSc, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    try {
      const uid = userId ?? (await getDeviceId());
      if (!uid) return;
      if (next) {
        await supabase.from('user_liked_reels')
          .upsert({ user_id: uid, reel_id: reel.id }, { onConflict: 'user_id,reel_id' });
        grantXP(uid, 10, 'like_reel');
      } else {
        await supabase.from('user_liked_reels').delete().eq('user_id', uid).eq('reel_id', reel.id);
      }
      supabase.from('reels').update({ likes_count: localLikes + (next ? 1 : -1) }).eq('id', reel.id).then(() => {}, () => {});
    } catch {
      setLiked(!next);
      setLocalLikes(prev => prev + (next ? -1 : 1));
    }
  }, [liked, reel, userId, localLikes, heartSc]);

  // ── handleSave ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!reel) return;
    const next = !saved;
    setSaved(next);
    _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(() => {});
    Animated.sequence([
      Animated.spring(saveSc, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(saveSc, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    try {
      const uid = userId ?? (await getDeviceId());
      if (!uid) return;
      if (next) {
        await supabase.from('user_saved_reels')
          .upsert({ user_id: uid, reel_id: reel.id }, { onConflict: 'user_id,reel_id' });
        grantXP(uid, 15, 'save_reel');
      } else {
        await supabase.from('user_saved_reels').delete().eq('user_id', uid).eq('reel_id', reel.id);
      }
    } catch {
      setSaved(!next);
    }
  }, [saved, reel, userId, saveSc]);

  // ── handleWatch ──────────────────────────────────────────────────────────
  const handleWatch = useCallback(() => {
    const url = reel ? resolveReelVideoUrl(reel.video_url) : '';
    setVideoUrl(url || null);
    setVideoOpen(true);
    grantXP(userId, 25, 'watch_reel');
  }, [reel, userId]);

  // ── handleShare ──────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!reel) return;
    try {
      await Share.share({
        message: `Découvrez "${reel.title || 'cette création'}" sur Universe App !`,
        title: reel.title || 'Reel',
      });
    } catch {}
  }, [reel]);

  const synopsisShort = useMemo(() => {
    if (!reel?.synopsis) return '';
    return reel.synopsis.length > 220 ? reel.synopsis.slice(0, 220).trimEnd() + '…' : reel.synopsis;
  }, [reel?.synopsis]);

  const bodyAnim = useMemo(() => ({
    opacity:   reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  }), [reveal]);

  // ── États vides ──────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.root}><StatusBar style="light" /><GalaxyBackground /><DetailSkeleton /></View>
  );

  if (error || !reel) return (
    <View style={[s.root, s.center]}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <View style={s.errIcon}><Ionicons name="film-outline" size={32} color={C.textTert} /></View>
      <Text style={s.errTitle}>Vidéo introuvable</Text>
      <Text style={s.errSub}>Ce reel n'existe pas ou a été retiré.</Text>
      <TouchableOpacity style={s.errBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={15} color={C.white} />
        <Text style={s.errBtnTxt}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <VideoModal
        visible={videoOpen}
        videoUrl={videoUrl}
        title={reel.title ?? 'Reel'}
        onClose={() => setVideoOpen(false)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} scrollEventThrottle={16}>

        {/* HERO */}
        <View style={s.heroWrap}>
          <Image source={{ uri: resolveThumb(reel) }} style={s.heroImg} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(2,8,16,0.45)', C.bg]} locations={[0.35, 0.72, 1]} style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(2,8,16,0.55)', 'transparent']} locations={[0, 0.30]} style={StyleSheet.absoluteFillObject} />

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <BlurView intensity={28} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={21} color={C.white} />
            </BlurView>
          </TouchableOpacity>

          <View style={s.topRight}>
            <Animated.View style={{ transform: [{ scale: saveSc }] }}>
              <TouchableOpacity onPress={handleSave} hitSlop={8}>
                <BlurView intensity={28} tint="dark" style={s.blurCircle}>
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={C.white} />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity onPress={handleShare} hitSlop={8}>
              <BlurView intensity={28} tint="dark" style={s.blurCircle}>
                <Ionicons name="share-outline" size={18} color={C.white} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* CORPS */}
        <Animated.View style={[s.body, bodyAnim]}>

          {/* Badge catégorie — identique film/[id].tsx */}
          {reel.genre && (
            <View style={s.catBadge}>
              <View style={s.catDot} />
              <Text style={s.catTxt}>{'REEL · COURT-MÉTRAGE'}</Text>
            </View>
          )}

          <View style={s.titleBlock}>
            {reel.genre && <Text style={s.genreLabel}>{reel.genre.toUpperCase()}</Text>}
            <Text style={s.reelTitle} numberOfLines={3}>{reel.title || 'Sans titre'}</Text>
            {(reel.director || reel.year) && (
              <Text style={s.adj}>
                {reel.director ? `De ${reel.director}` : ''}
                {reel.director && reel.year ? ' · ' : ''}
                {reel.year ?? ''}
              </Text>
            )}
          </View>

          {/* STATS — identique film/[id].tsx */}
          <View style={s.statsRow}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.82}>
              <View style={[s.likePill, liked && { borderColor: 'rgba(255,59,92,0.38)', backgroundColor: 'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform: [{ scale: heartSc }] }}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? C.red : C.textSec} />
                </Animated.View>
                <Text style={[s.likePillVal, liked && { color: C.red }]}>{fmtLikes(localLikes)}</Text>
              </View>
            </TouchableOpacity>
            <StatPill icon="play-circle-outline" value={fmtLikes(reel.views_count ?? 0)} label="Vues" />
            {reel.duration != null && <StatPill icon="time-outline" value={`${reel.duration} min`} label="Durée" />}
            {reel.year != null && <StatPill icon="calendar-outline" value={reel.year} label="Année" />}
          </View>

          {/* PLAY */}
          <TouchableOpacity style={s.playBtn} onPress={handleWatch} activeOpacity={0.88}>
            <LinearGradient colors={[C.navyBright, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playGrad}>
              <View style={s.playIconWrap}><Ionicons name="play" size={18} color={C.white} /></View>
              <View>
                <Text style={s.playTxt}>Lancer la vidéo</Text>
                <Text style={s.playMeta}>{reel.video_url ? 'Prêt à visionner' : 'Vidéo indisponible'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* GENRE */}
          {reel.genre && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
              <View style={s.tag}><Text style={s.tagTxt}>{reel.genre}</Text></View>
            </ScrollView>
          )}

          {/* SYNOPSIS */}
          {reel.synopsis && (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.caption}>{expanded ? reel.synopsis : synopsisShort}</Text>
              {reel.synopsis.length > 220 && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={s.expandBtn}>
                  <Text style={s.expandTxt}>{expanded ? 'Réduire' : 'Lire la suite'}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={C.blue} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* CRÉATEUR */}
          {creator && (
            <View style={s.section}>
              <SectionTitle>Créateur·ice</SectionTitle>
              <View style={s.creatorCard}>
                {creator.avatar_url ? (
                  <Image source={{ uri: creator.avatar_url }} style={s.creatorAv} resizeMode="cover" />
                ) : (
                  <View style={[s.creatorAv, s.creatorAvFb]}>
                    <Text style={s.creatorInit}>
                      {(creator.display_name || creator.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={s.creatorInfo}>
                  <Text style={s.creatorName}>{creator.display_name || creator.username || 'Créateur'}</Text>
                  <Text style={s.creatorSub}>{creator.role || 'Cinéaste'}</Text>
                  {creator.specialties?.length ? (
                    <Text style={s.creatorSpec} numberOfLines={1}>
                      {creator.specialties.slice(0, 3).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {/* SIMILAIRES */}
          {similar.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Dans le même genre</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similar.map(sr => (
                  <SimilarReelCard
                    key={sr.id}
                    item={sr}
                    onPress={() => router.push({ pathname: '/reel/[id]', params: { id: sr.id } } as any)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* INFORMATIONS — identique film/[id].tsx */}
          <View style={s.section}>
            <SectionTitle>Informations</SectionTitle>
            <View style={{ backgroundColor: C.surf, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              {reel.genre    && <InfoRow label="Genre"       value={reel.genre} />}
              {reel.year     && <InfoRow label="Année"       value={reel.year} />}
              {reel.duration != null && <InfoRow label="Durée"  value={`${reel.duration} min`} />}
              {reel.director && <InfoRow label="Réalisateur" value={reel.director} />}
              <InfoRow label="Statut" value={reel.status === 'approved' ? 'Approuvé' : reel.status === 'pending' ? 'En attente' : 'Refusé'} />
              <InfoRow label="Vues"   value={fmtLikes(reel.views_count ?? 0)} />
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  center:     { justifyContent: 'center', alignItems: 'center' },
  scroll:     { paddingBottom: 110 },

  heroWrap:   { height: H * 0.46, position: 'relative' },
  heroImg:    { width: '100%', height: '100%' },
  backBtn:    { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, left: 16 },
  blurCircle: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  topRight:   { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, right: 16, gap: 10, alignItems: 'flex-end' },

  body:       { paddingHorizontal: 20, paddingTop: 22 },
  catBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(90,150,230,0.3)', backgroundColor: 'rgba(0,0,0,0.35)', alignSelf: 'flex-start', marginBottom: 14 },
  catDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue },
  catTxt:     { color: C.blue, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  titleBlock: { marginBottom: 20 },
  genreLabel: { color: C.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  reelTitle:  { color: C.white, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, marginBottom: 7 },
  adj:        { color: C.textSec, fontSize: 14, fontStyle: 'italic' },

  statsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  likePill:   { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  likePillVal: { color: C.text, fontSize: 13, fontWeight: '700' },
  playBtn:      { borderRadius: 16, overflow: 'hidden', marginBottom: 26, borderWidth: 1, borderColor: C.borderBlue },
  playGrad:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 },
  playIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  playTxt:      { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  playMeta:     { color: C.textTert, fontSize: 11, marginTop: 2 },

  tag:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  tagTxt: { color: C.textSec, fontSize: 12, fontWeight: '600' },

  section:    { marginBottom: 28 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionDot: { width: 3, height: 18, borderRadius: 2, backgroundColor: C.blue },
  sectionTxt: { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  caption:    { color: C.textSec, fontSize: 14, lineHeight: 23 },
  expandBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandTxt:  { color: C.blue, fontSize: 13, fontWeight: '700' },

  creatorCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 16 },
  creatorAv:   { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.navyLight },
  creatorAvFb: { backgroundColor: 'rgba(90,130,210,0.30)', alignItems: 'center', justifyContent: 'center' },
  creatorInit: { color: C.white, fontSize: 18, fontWeight: '700' },
  creatorInfo: { flex: 1 },
  creatorName: { color: C.text, fontSize: 15, fontWeight: '700' },
  creatorSub:  { color: C.textSec, fontSize: 12, marginTop: 1 },
  creatorSpec: { color: C.textTert, fontSize: 11, marginTop: 3 },

  errIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  errTitle:  { color: C.textSec, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errSub:    { color: C.textTert, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  errBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi },
  errBtnTxt: { color: C.white, fontWeight: '700', fontSize: 14 },
});
