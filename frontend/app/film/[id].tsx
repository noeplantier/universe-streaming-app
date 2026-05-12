/**
 * app/film/[id].tsx — FilmDetailScreen v3.0
 *
 * ✦ Source unique : public.works (schéma exact)
 * ✦ Toutes les colonnes affichées (title, category, genre, year, likes,
 *   comments, image, is_original, adjective, duration, description,
 *   director, cast_list)
 * ✦ Like optimiste synchro Supabase
 * ✦ Modal vidéo : joue une vidéo aléatoire depuis la table "reels"
 *   au clic sur "Regarder" (fallback sur une URL publique si aucun reel)
 * ✦ Œuvres similaires (même genre, même table)
 * ✦ Animations reveal + parallax hero
 */

import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, Modal,
  TouchableOpacity, Dimensions, Platform,
  Animated, Easing, Share, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:         '#020810',
  navyMid:    '#0D2240',
  navyLight:  '#163356',
  navyBright: '#1E4A7A',
  surf:       'rgba(13,34,64,0.60)',
  border:     'rgba(255,255,255,0.07)',
  borderBlue: 'rgba(90,150,230,0.22)',
  white:      '#FFFFFF',
  text:       '#EEF4FF',
  textSec:    '#7A99BE',
  textTert:   '#2E4A68',
  blue:       '#5A96E6',
  gold:       '#F5C842',
  goldDim:    'rgba(245,200,66,0.12)',
  red:        '#FF3B5C',
  green:      '#2ECC8A',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE — miroir public.works
// ─────────────────────────────────────────────────────────────────────────────
interface Work {
  id:          number;
  title:       string;
  category:    string;
  genre:       string;
  year:        number;
  likes:       number;
  comments:    number | null;
  image:       string | null;
  is_original: boolean;
  adjective:   string | null;
  duration:    number | null;
  description: string | null;
  director:    string | null;
  cast_list:   string[] | null;
  created_at:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(raw: string | null | undefined, id: number): string {
  if (!raw) return `https://picsum.photos/seed/work_${id}/800/600`;
  if (raw.startsWith('http')) return raw;
  const { data } = supabase.storage.from('community-images').getPublicUrl(raw);
  return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/800/600`;
}

function fmtLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}

function fmtDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${min} min`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWork(id: string | number): Promise<Work | null> {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Work;
}

async function fetchSimilarWorks(work: Work): Promise<Work[]> {
  const { data } = await supabase
    .from('works')
    .select('id, title, image, likes, genre, category, is_original, duration')
    .neq('id', work.id)
    .eq('genre', work.genre)
    .order('likes', { ascending: false })
    .limit(12);
  return (data ?? []) as Work[];
}

/** Récupère une URL vidéo aléatoire depuis la table reels */
async function fetchRandomVideoUrl(): Promise<string> {
  const FALLBACK = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  try {
    const { data } = await supabase
      .from('reels')
      .select('video_url')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!data?.length) return FALLBACK;
    const idx = Math.floor(Math.random() * data.length);
    return data[idx].video_url ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// expo-video conditionnel
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: any = (src: any, cb: any) => ({
  play(){}, pause(){}, muted: false,
});
let _VideoView: any = () => null;

if (Platform.OS !== 'web') {
  try {
    const ev = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO MODAL
// ─────────────────────────────────────────────────────────────────────────────
interface VideoModalProps {
  visible:  boolean;
  videoUrl: string | null;
  title:    string;
  onClose:  () => void;
}

const VideoModal = memo(function VideoModal({ visible, videoUrl, title, onClose }: VideoModalProps) {
  const isWeb = Platform.OS === 'web';

  const player = _useVideoPlayer(visible && videoUrl ? videoUrl : null, (p: any) => {
    if (!p) return;
    p.loop  = false;
    p.muted = false;
  });

  useEffect(() => {
    if (!player || isWeb) return;
    if (visible && videoUrl) {
      try { player.play(); } catch {}
    } else {
      try { player.pause(); } catch {}
    }
  }, [visible, videoUrl, player, isWeb]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={vm.root}>
        <StatusBar style="light" />

        {/* Lecteur web */}
        {isWeb && !!videoUrl && (
          React.createElement('video', {
            src: videoUrl,
            autoPlay: true,
            controls: true,
            playsInline: true,
            style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' },
          })
        )}

        {/* Lecteur natif */}
        {!isWeb && !!videoUrl && (
          <_VideoView
            player={player}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            nativeControls
          />
        )}

        {/* Indicateur de chargement */}
        {!videoUrl && (
          <View style={vm.loadWrap}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={vm.loadTxt}>Chargement de la vidéo…</Text>
          </View>
        )}

        {/* Bouton fermer */}
        <TouchableOpacity style={vm.closeBtn} onPress={onClose} hitSlop={12}>
          <BlurView intensity={40} tint="dark" style={vm.closeBlur}>
            <Ionicons name="close" size={22} color="#fff" />
          </BlurView>
        </TouchableOpacity>

        {/* Titre en bas */}
        <View style={vm.titleBar} pointerEvents="none">
          <Text style={vm.titleTxt} numberOfLines={1}>{title}</Text>
        </View>
      </View>
    </Modal>
  );
});

const vm = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000' },
  loadWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  closeBtn:{ position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: 16, zIndex: 10 },
  closeBlur:{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  titleBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 20, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  titleTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const Skeleton = memo(function Skeleton() {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.52, duration: 950, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.22, duration: 950, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);

  const B = ({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: C.navyLight, opacity: op, marginBottom: 12 }} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: H * 0.46, backgroundColor: C.navyMid }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <B w={90}   h={11} /><B w="72%" h={30} /><B w="48%" h={16} />
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[80, 80, 80].map((w, i) => <B key={i} w={w} h={40} r={12} />)}
        </View>
        <View style={{ height: 8 }} />
        <B w="100%" h={54} r={16} /><B w="100%" h={14} /><B w="88%" h={14} /><B w="64%" h={14} />
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SIMILAR CARD
// ─────────────────────────────────────────────────────────────────────────────
const SimilarCard = memo(function SimilarCard({
  item, onPress,
}: { item: Work; onPress: () => void }) {
  const imgUri = resolveImage(item.image, item.id);
  return (
    <TouchableOpacity style={sc.wrap} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: imgUri }} style={sc.img} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(2,8,16,0.88)']} style={StyleSheet.absoluteFillObject} />
      {item.is_original && (
        <View style={sc.badge}><Text style={sc.badgeTxt}>ORIGINAL</Text></View>
      )}
      <View style={sc.info}>
        <Text style={sc.title} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="heart" size={9} color={C.gold} />
          <Text style={sc.likes}>{fmtLikes(item.likes)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const sc = StyleSheet.create({
  wrap:     { width: 120, height: 178, borderRadius: 14, overflow: 'hidden', marginRight: 12, backgroundColor: C.surf },
  img:      { width: '100%', height: '100%' },
  badge:    { position: 'absolute', top: 7, left: 7, backgroundColor: C.blue, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 5 },
  badgeTxt: { color: C.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  info:     { position: 'absolute', bottom: 9, left: 9, right: 9, gap: 3 },
  title:    { color: C.white, fontSize: 12, fontWeight: '700', lineHeight: 15 },
  likes:    { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION TITLE
// ─────────────────────────────────────────────────────────────────────────────
const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: C.blue }} />
      <Text style={{ color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>{children}</Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CAST CHIP
// ─────────────────────────────────────────────────────────────────────────────
const CastChip = memo(function CastChip({ name }: { name: string }) {
  const uri = `https://i.pravatar.cc/80?u=${encodeURIComponent(name)}`;
  return (
    <View style={{ alignItems: 'center', marginRight: 16, width: 66 }}>
      <Image source={{ uri }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: C.navyLight, marginBottom: 6 }} />
      <Text style={{ color: C.textSec, fontSize: 11, textAlign: 'center' }} numberOfLines={1}>{name}</Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INFO ROW
// ─────────────────────────────────────────────────────────────────────────────
const InfoRow = memo(function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
      <Text style={{ color: C.textSec, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', maxWidth: '60%' }} numberOfLines={1}>{value}</Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = memo(function StatPill({
  icon, value, label, color,
}: { icon: string; value: string; label?: string; color?: string }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function FilmDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rawId  = Array.isArray(id) ? id[0] : id ?? '';

  const [work,       setWork]       = useState<Work | null>(null);
  const [similar,    setSimilar]    = useState<Work[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [liked,      setLiked]      = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [localLikes, setLocalLikes] = useState(0);

  // Vidéo modal
  const [videoOpen,   setVideoOpen]   = useState(false);
  const [videoUrl,    setVideoUrl]    = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const heartSc = useRef(new Animated.Value(1)).current;
  const saveSc  = useRef(new Animated.Value(1)).current;

  // Reveal animation
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading && !error && work) {
      Animated.timing(reveal, {
        toValue: 1, duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [loading, error, work, reveal]);

  // Fetch
  useEffect(() => {
    if (!rawId) { setError(true); setLoading(false); return; }
    let dead = false;
    setLoading(true); setError(false);
    fetchWork(rawId).then(data => {
      if (dead) return;
      if (!data) { setError(true); setLoading(false); return; }
      setWork(data);
      setLocalLikes(data.likes);
      setLoading(false);
      fetchSimilarWorks(data)
        .then(items => { if (!dead) setSimilar(items); })
        .catch(() => {});
    }).catch(() => {
      if (!dead) { setError(true); setLoading(false); }
    });
    return () => { dead = true; };
  }, [rawId]);

  useEffect(() => { setLiked(false); setExpanded(false); setSaved(false); setVideoUrl(null); }, [rawId]);

  // Like optimiste + sync DB
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(heartSc, { toValue: 1.42, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(heartSc, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    // Sync Supabase
    supabase.from('works')
      .update({ likes: localLikes + (next ? 1 : -1) })
      .eq('id', rawId)
      .then(() => {});
  }, [liked, heartSc, localLikes, rawId]);

  const handleSave = useCallback(() => {
    setSaved(v => !v);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(saveSc, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(saveSc, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [saveSc]);

  const handleShare = useCallback(async () => {
    if (!work) return;
    try {
      await Share.share({
        message: `Découvrez "${work.title}"${work.director ? ` de ${work.director}` : ''} · ${work.genre} · ${work.year}`,
        title: work.title,
      });
    } catch {}
  }, [work]);

  // ★ Regarder — ouvre la modal + charge une vidéo aléatoire
  const handleWatch = useCallback(async () => {
    setVideoOpen(true);
    setVideoUrl(null);
    setVideoLoading(true);
    const url = await fetchRandomVideoUrl();
    setVideoUrl(url);
    setVideoLoading(false);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      if (userId && rawId) {
        // Upsert pour éviter les doublons (si l'utilisateur regarde plusieurs fois)
        await supabase.from('user_history').upsert(
          { user_id: userId, work_id: Number(rawId), watched_at: new Date().toISOString() },
          { onConflict: 'user_id, work_id' }
        );
      }
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de l'historique:", err);
    }
  }, [rawId]);

  

  // Dérivés
  const descShort = useMemo(() => {
    if (!work?.description) return '';
    return work.description.length > 220
      ? work.description.slice(0, 220).trimEnd() + '…'
      : work.description;
  }, [work?.description]);

  const infoRows = useMemo(() => {
    if (!work) return [];
    return [
      { label: 'Catégorie',    value: work.category },
      { label: 'Genre',        value: work.genre },
      { label: 'Année',        value: String(work.year) },
      work.duration && { label: 'Durée',       value: fmtDuration(work.duration) },
      work.director && { label: 'Réalisateur', value: work.director },
      work.comments != null && { label: 'Commentaires', value: String(work.comments) },
    ].filter(Boolean) as { label: string; value: string }[];
  }, [work]);

  const bodyAnim = useMemo(() => ({
    opacity: reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  }), [reveal]);

  // ── LOADING / ERROR ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <Skeleton />
      </View>
    );
  }

  if (error || !work) {
    return (
      <View style={[s.root, s.center]}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <View style={s.errIcon}><Ionicons name="film-outline" size={32} color={C.textTert} /></View>
        <Text style={s.errTitle}>Œuvre introuvable</Text>
        <Text style={s.errSub}>Cette œuvre n'existe pas dans le catalogue.</Text>
        <TouchableOpacity style={s.errBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={15} color={C.white} />
          <Text style={s.errBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroUri = resolveImage(work.image, work.id);

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Modal vidéo */}
      <VideoModal
        visible={videoOpen}
        videoUrl={videoUrl}
        title={work.title}
        onClose={() => { setVideoOpen(false); setVideoUrl(null); }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ══ HERO ════════════════════════════════════════════════════════ */}
        <View style={s.heroWrap}>
          <Image source={{ uri: heroUri }} style={s.heroImg} resizeMode="cover" />

          <LinearGradient
            colors={['rgba(2,8,16,0.55)', 'transparent']}
            locations={[0, 0.32]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(2,8,16,0.42)', C.bg]}
            locations={[0.38, 0.72, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Retour */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={21} color={C.white} />
            </BlurView>
          </TouchableOpacity>

          {/* Haut droite */}
          <View style={s.topRight}>
            <Animated.View style={{ transform: [{ scale: saveSc }] }}>
              <TouchableOpacity style={s.blurCircle} onPress={handleSave} hitSlop={8}>
                <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? C.gold : C.white} />
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={s.blurCircle} onPress={handleShare} hitSlop={8}>
              <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="share-outline" size={18} color={C.white} />
            </TouchableOpacity>
          </View>

          {/* Badge Original */}
          {work.is_original && (
            <View style={s.heroBadge}>
              <Ionicons name="star" size={10} color={C.gold} />
              <Text style={s.heroBadgeTxt}>ORIGINAL</Text>
            </View>
          )}
        </View>

        {/* ══ BODY ════════════════════════════════════════════════════════ */}
        <Animated.View style={[s.body, bodyAnim]}>

          {/* Badge catégorie */}
          <View style={s.catBadge}>
            <View style={[s.catDot, { backgroundColor: work.is_original ? C.blue : C.textSec }]} />
            <Text style={[s.catTxt, { color: work.is_original ? C.blue : C.textSec }]}>
              {work.category.toUpperCase()}
            </Text>
          </View>

          {/* Titre */}
          <View style={s.titleBlock}>
            <Text style={s.genreLabel}>{work.genre.toUpperCase()}</Text>
            <Text style={s.title} numberOfLines={3}>{work.title}</Text>
            {work.adjective
              ? <Text style={s.adj}>{work.adjective}</Text>
              : <Text style={s.adj}>{work.director ? `De ${work.director}` : ''} · {work.year}</Text>
            }
          </View>

          {/* Pills stats */}
          <View style={s.statsRow}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.82}>
              <View style={[s.likePill, liked && { borderColor: 'rgba(255,59,92,0.38)', backgroundColor: 'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform: [{ scale: heartSc }] }}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? C.red : C.textSec} />
                </Animated.View>
                <Text style={[s.likePillVal, liked && { color: C.red }]}>{fmtLikes(localLikes)}</Text>
              </View>
            </TouchableOpacity>

            {work.duration != null && (
              <StatPill icon="time-outline" value={fmtDuration(work.duration)} label="Durée" />
            )}
            {work.year != null && (
              <StatPill icon="calendar-outline" value={String(work.year)} label="Année" />
            )}
            {work.comments != null && (
              <StatPill icon="chatbubble-outline" value={String(work.comments)} label="Avis" />
            )}
          </View>

          {/* ★ BOUTON REGARDER → ouvre la modal vidéo ★ */}
          <TouchableOpacity style={s.watchBtn} onPress={handleWatch} activeOpacity={0.88}>
            <LinearGradient
              colors={[C.navyBright, C.navyMid]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.watchGrad}
            >
              <View style={s.watchIcon}>
                <Ionicons name="play" size={18} color={C.white} />
              </View>
              <View>
                <Text style={s.watchTxt}>Regarder</Text>
                {work.duration != null && (
                  <Text style={s.watchMeta}>{fmtDuration(work.duration)} · HD</Text>
                )}
              </View>
              {videoLoading && (
                <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" style={{ marginLeft: 'auto' as any }} />
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Synopsis */}
          {!!work.description && (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.synopsis}>{expanded ? work.description : descShort}</Text>
              {work.description.length > 220 && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Text style={{ color: C.blue, fontSize: 13, fontWeight: '700' }}>{expanded ? 'Réduire' : 'Lire la suite'}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={C.blue} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Réalisateur */}
          {!!work.director && (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <View style={s.dirCard}>
                <Image source={{ uri: `https://i.pravatar.cc/120?u=${encodeURIComponent(work.director)}` }} style={s.dirAvatar} />
                <View>
                  <Text style={s.dirName}>{work.director}</Text>
                  <Text style={s.dirMeta}>{work.genre} · {work.year}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Casting */}
          {(work.cast_list?.length ?? 0) > 0 && (
            <View style={s.section}>
              <SectionTitle>Avec</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {work.cast_list!.map(name => <CastChip key={name} name={name} />)}
              </ScrollView>
            </View>
          )}

          {/* Similaires */}
          {similar.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Dans le même genre</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similar.map(item => (
                  <SimilarCard
                    key={item.id}
                    item={item}
                    onPress={() => router.replace(`/film/${item.id}` as any)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Infos techniques */}
          <View style={s.section}>
            <SectionTitle>Informations</SectionTitle>
            <View style={{ backgroundColor: C.surf, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              {infoRows.map(row => <InfoRow key={row.label} label={row.label} value={row.value} />)}
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 110 },

  heroWrap: { height: H * 0.46, position: 'relative' },
  heroImg:  { width: '100%', height: '100%' },

  backBtn:    { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, left: 16 },
  topRight:   { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, right: 16, gap: 10, alignItems: 'flex-end' },
  blurCircle: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroBadge:  { position: 'absolute', bottom: 18, left: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,200,66,0.28)' },
  heroBadgeTxt:{ color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  body: { paddingHorizontal: 20, paddingTop: 22 },

  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(90,150,230,0.3)', backgroundColor: 'rgba(0,0,0,0.35)', alignSelf: 'flex-start', marginBottom: 14 },
  catDot:   { width: 5, height: 5, borderRadius: 3 },
  catTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  titleBlock: { marginBottom: 20 },
  genreLabel: { color: C.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  title:      { color: C.white, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, marginBottom: 7 },
  adj:        { color: C.textSec, fontSize: 14, fontStyle: 'italic' },

  statsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  likePill:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  likePillVal:{ color: C.text, fontSize: 13, fontWeight: '700' },

  watchBtn:   { borderRadius: 16, overflow: 'hidden', marginBottom: 26, borderWidth: 1, borderColor: C.borderBlue },
  watchGrad:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 20 },
  watchIcon:  { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  watchTxt:   { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  watchMeta:  { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },

  section: { marginBottom: 28 },
  synopsis:{ color: C.textSec, fontSize: 14, lineHeight: 23 },

  dirCard:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 16 },
  dirAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: C.navyLight },
  dirName:   { color: C.text, fontSize: 15, fontWeight: '700' },
  dirMeta:   { color: C.textSec, fontSize: 12, marginTop: 2 },

  errIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  errTitle: { color: C.textSec, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errSub:   { color: C.textTert, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  errBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  errBtnTxt:{ color: C.white, fontWeight: '700', fontSize: 14 },
});