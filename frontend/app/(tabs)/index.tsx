// app/(tabs)/index.tsx
// UNIVERSE — Indie Cinema Feed · Full CDN Supabase · Auto-play · v3.0

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, TouchableWithoutFeedback,
  FlatList, Animated, Easing, Dimensions, Platform, ActivityIndicator,
  StatusBar as RNStatusBar, Alert, Pressable, ScrollView,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createClient } from '@supabase/supabase-js';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 SUPABASE CLIENT — CDN-optimised
// ─────────────────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: { persistSession: true },
    global: { headers: { 'x-app': 'universe-cinema' } },
  }
);

/** Returns the CDN public URL for a storage object */
const getCdnUrl = (bucket: string, path?: string | null): string | null => {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path, {
    transform: undefined, // use raw CDN path — no transform overhead for video
  });
  return data?.publicUrl ?? null;
};

/** Increment view count without blocking UI */
const incrementViews = async (filmId: string) => {
  try {
    await supabase.rpc('increment_film_views', { film_id: filmId });
  } catch { /* non-blocking */ }
};

/** Toggle like — optimistic, syncs in background */
const toggleLike = async (filmId: string, liked: boolean): Promise<boolean> => {
  try {
    if (liked) {
      await supabase.from('film_likes').delete().match({ film_id: filmId });
    } else {
      await supabase.from('film_likes').insert({ film_id: filmId });
    }
    return !liked;
  } catch { return liked; }
};

// ─────────────────────────────────────────────────────────────────────────────
// 📐 TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Film {
  id:          string;
  title:       string;
  director:    string;
  genre:       string;
  synopsis:    string;
  year:        number;
  runtime:     string;
  poster_url:  string | null;
  video_path:  string | null;
  likes_count: number;
  views_count: number;
  is_featured: boolean;
  aspect_ratio: string;
  language:    string;
  director_avatar?: string | null;
}

interface Friend {
  id:          string;
  username:    string;
  avatar_url:  string | null;
  has_story:   boolean;
  is_online:   boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎭 FALLBACK DATA — shown while Supabase loads
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_FILMS: Film[] = [
  {
    id: '1', title: 'La Chambre Inversée', director: 'Élise Moreau',
    genre: 'Néo-Noir', synopsis: 'Dans une ville qui dort, une femme cherche ce qu\'elle a laissé derrière elle. Plan fixe. Silence. Puis la lumière décline.',
    year: 2024, runtime: '18 min',
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900&q=85',
    video_path: 'films/bunny.mp4',
    likes_count: 2841, views_count: 18432, is_featured: true,
    aspect_ratio: '2.39:1', language: 'Français', director_avatar: 'https://i.pravatar.cc/150?img=5',
  },
  {
    id: '2', title: 'Éclats de verre', director: 'Karim Benhadi',
    genre: 'Drame', synopsis: 'Un père et son fils traversent le désert. Chaque kilomètre est une phrase qu\'ils n\'ont pas su se dire.',
    year: 2024, runtime: '24 min',
    poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=900&q=85',
    video_path: 'films/elephant.mp4',
    likes_count: 1204, views_count: 9870, is_featured: false,
    aspect_ratio: '16:9', language: 'Arabe / FR', director_avatar: 'https://i.pravatar.cc/150?img=12',
  },
  {
    id: '3', title: 'Sintel', director: 'Colin Levy',
    genre: 'Animation', synopsis: 'Une guerrière solitaire part à la recherche d\'un jeune dragon qu\'elle a élevé. Un voyage épique aux confins du monde.',
    year: 2023, runtime: '14 min',
    poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=900&q=85',
    video_path: 'films/sintel.mp4',
    likes_count: 5612, views_count: 34201, is_featured: true,
    aspect_ratio: '16:9', language: 'English', director_avatar: 'https://i.pravatar.cc/150?img=33',
  },
  {
    id: '4', title: 'Brume de mer', director: 'Jade Tanaka',
    genre: 'Documentaire', synopsis: 'Sur les côtes bretonnes, des pêcheurs perpétuent un geste millénaire. Le brouillard comme personnage principal.',
    year: 2024, runtime: '31 min',
    poster_url: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=900&q=85',
    video_path: 'films/bunny.mp4',
    likes_count: 873, views_count: 4210, is_featured: false,
    aspect_ratio: '4:3', language: 'Français', director_avatar: 'https://i.pravatar.cc/150?img=47',
  },
  {
    id: '5', title: 'Phosphore', director: 'Naomi Stein',
    genre: 'Expérimental', synopsis: 'Un essai visuel sur la mémoire et la lumière. Images d\'archives, son abstrait, montage non-linéaire.',
    year: 2025, runtime: '9 min',
    poster_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=85',
    video_path: 'films/sintel.mp4',
    likes_count: 3190, views_count: 21050, is_featured: true,
    aspect_ratio: '1:1', language: 'Sans dialogue', director_avatar: 'https://i.pravatar.cc/150?img=22',
  },
];

const FALLBACK_FRIENDS: Friend[] = [
  { id: 'f1', username: 'élise.m',  avatar_url: 'https://i.pravatar.cc/150?img=5',  has_story: true,  is_online: true  },
  { id: 'f2', username: 'karim_b', avatar_url: 'https://i.pravatar.cc/150?img=12', has_story: true,  is_online: false },
  { id: 'f3', username: 'jade.t',  avatar_url: 'https://i.pravatar.cc/150?img=47', has_story: false, is_online: true  },
  { id: 'f4', username: 'naomi_s', avatar_url: 'https://i.pravatar.cc/150?img=22', has_story: true,  is_online: false },
  { id: 'f5', username: 'leo.r',   avatar_url: 'https://i.pravatar.cc/150?img=67', has_story: false, is_online: true  },
  { id: 'f6', username: 'sara.v',  avatar_url: 'https://i.pravatar.cc/150?img=44', has_story: true,  is_online: false },
  { id: 'f7', username: 'armin.h', avatar_url: 'https://i.pravatar.cc/150?img=59', has_story: false, is_online: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg:          '#060010',
  primary:     '#C060FF',
  gold:        '#FFE270',
  cyan:        '#86EEFF',
  danger:      '#FF4D6A',
  success:     '#1ED760',
  textSub:     '#BCB8C2',
  glass:       'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.10)',
  overlay:     'rgba(6,0,16,0.55)',
};

const GENRE_COLORS: Record<string, string> = {
  'Néo-Noir': '#CF98FF', 'Drame': '#86EEFF', 'Animation': '#FFE270',
  'Documentaire': '#1ED760', 'Expérimental': '#FF9F43', 'Thriller': '#FF4D6A',
  'Horreur': '#FF6B9D', 'Comédie': '#54D7A2', 'Sci-Fi': '#86EEFF',
};

const getGenreColor = (genre: string) => GENRE_COLORS[genre] ?? G.primary;

// ─────────────────────────────────────────────────────────────────────────────
// 📏 DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🔢 FORMAT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

// ─────────────────────────────────────────────────────────────────────────────
// 💫 HEART BURST ANIMATION (double-tap like)
// ─────────────────────────────────────────────────────────────────────────────
const HeartBurst = memo(({ visible, x, y }: { visible: boolean; x: number; y: number }) => {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0); opacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, tension: 160, friction: 8 }),
        Animated.timing(scale, { toValue: 1.0, duration: 100, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[hb.wrap, { left: x - 55, top: y - 55, opacity, transform: [{ scale }] }]} pointerEvents="none">
      <Ionicons name="heart" size={110} color="#FF4D6A" style={hb.shadow} />
    </Animated.View>
  );
});
HeartBurst.displayName = 'HeartBurst';

const hb = StyleSheet.create({
  wrap:   { position: 'absolute', zIndex: 99, alignItems: 'center', justifyContent: 'center' },
  shadow: { textShadowColor: 'rgba(255,77,106,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔔 ACTION BUTTON (right rail)
// ─────────────────────────────────────────────────────────────────────────────
interface ActionBtnProps {
  icon:    string;
  iconAlt?: string;
  label?:  string;
  count?:  number;
  color?:  string;
  active?: boolean;
  onPress: () => void;
  pulse?:  boolean;
}

const ActionBtn = memo(({
  icon, iconAlt, label, count, color = '#fff', active = false, onPress, pulse,
}: ActionBtnProps) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const pulsAnim = useRef(new Animated.Value(1)).current;

  const tap = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.80, useNativeDriver: true, tension: 300 }),
      Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, tension: 200 }),
      Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, tension: 150 }),
    ]).start();
    onPress();
  };

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulsAnim, { toValue: 1.12, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(pulsAnim, { toValue: 1.00, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const displayIcon = (active && iconAlt) ? iconAlt : icon;

  return (
    <TouchableOpacity onPress={tap} activeOpacity={1} style={ab.btn}>
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, pulsAnim) }] }}>
        <BlurView intensity={active ? 0 : 18} tint="dark" style={[ab.iconWrap, active && { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
          <Ionicons name={displayIcon as any} size={26} color={active ? color : 'rgba(255,255,255,0.9)'} />
        </BlurView>
      </Animated.View>
      {(label || count !== undefined) && (
        <Text style={[ab.label, active && { color, fontWeight: '800' }]}>
          {count !== undefined ? fmtCount(count) : label}
        </Text>
      )}
    </TouchableOpacity>
  );
});
ActionBtn.displayName = 'ActionBtn';

const ab = StyleSheet.create({
  btn:      { alignItems: 'center', gap: 5, marginBottom: 6 },
  iconWrap: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label:    { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 👥 FRIENDS BAR — horizontal story ring avatars
// ─────────────────────────────────────────────────────────────────────────────
const FriendsBar = memo(({ friends, onPress }: { friends: Friend[]; onPress: (f: Friend) => void }) => {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true, easing: Easing.out(Easing.back(1.2)) }).start();
  }, []);

  return (
    <Animated.View style={[fb.container, { opacity: enterAnim, transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fb.scroll}>
        {/* Add story button */}
        <TouchableOpacity style={fb.addBtn} activeOpacity={0.8}>
          <LinearGradient colors={['rgba(192,96,255,0.25)', 'rgba(108,16,195,0.15)']} style={fb.addGrad}>
            <Ionicons name="add" size={22} color={G.primary} />
          </LinearGradient>
          <Text style={fb.label} numberOfLines={1}>Ma story</Text>
        </TouchableOpacity>

        {friends.map(f => (
          <TouchableOpacity key={f.id} onPress={() => onPress(f)} activeOpacity={0.85} style={fb.item}>
            {/* Story ring */}
            {f.has_story ? (
              <LinearGradient
                colors={['#C060FF', '#86EEFF', '#FFE270']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={fb.ring}
              >
                <View style={fb.ringInner}>
                  <Image source={{ uri: f.avatar_url ?? '' }} style={fb.avatar} />
                </View>
              </LinearGradient>
            ) : (
              <View style={[fb.ring, fb.ringInactive]}>
                <View style={fb.ringInner}>
                  <Image source={{ uri: f.avatar_url ?? '' }} style={fb.avatar} />
                </View>
              </View>
            )}
            {/* Online dot */}
            {f.is_online && <View style={fb.onlineDot} />}
            <Text style={fb.label} numberOfLines={1}>{f.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
FriendsBar.displayName = 'FriendsBar';

const fb = StyleSheet.create({
  container:   { paddingTop: 10, paddingBottom: 6 },
  scroll:      { paddingHorizontal: 14, gap: 14 },
  item:        { alignItems: 'center', gap: 5, position: 'relative', width: 58 },
  ring:        { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  ringInner:   { width: 52, height: 52, borderRadius: 26, backgroundColor: '#060010', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#060010' },
  ringInactive:{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0 },
  avatar:      { width: 48, height: 48, borderRadius: 24 },
  onlineDot:   { position: 'absolute', bottom: 20, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: G.success, borderWidth: 2, borderColor: '#060010' },
  label:       { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600', width: 58, textAlign: 'center' },
  addBtn:      { alignItems: 'center', gap: 5, width: 58 },
  addGrad:     { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.4)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📊 PROGRESS BAR — real video playback progress
// ─────────────────────────────────────────────────────────────────────────────
const VideoProgress = memo(({ player }: { player: ReturnType<typeof useVideoPlayer> }) => {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      try {
        const { currentTime, duration } = player;
        if (duration && duration > 0) setProgress(currentTime / duration);
      } catch { /* ignore */ }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [player]);

  return (
    <View style={vp.track} pointerEvents="none">
      <Animated.View style={[vp.bar, { width: `${Math.min(progress * 100, 100)}%` }]}>
        <LinearGradient colors={[G.primary, G.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject as any} />
      </Animated.View>
      {/* Playhead knob */}
      <View style={[vp.knob, { left: `${Math.min(progress * 100, 99)}%` }]} />
    </View>
  );
});
VideoProgress.displayName = 'VideoProgress';

const vp = StyleSheet.create({
  track: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  bar:   { height: '100%', overflow: 'hidden' },
  knob:  { position: 'absolute', top: -4, width: 11, height: 11, borderRadius: 6, backgroundColor: '#fff', marginLeft: -5, shadowColor: G.primary, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 FEED ITEM — main card
// ─────────────────────────────────────────────────────────────────────────────
interface FeedItemProps {
  item:       Film;
  isActive:   boolean;
  isNear:     boolean;
  isNext:     boolean;
  height:     number;
  onComment:  (film: Film) => void;
  onShare:    (film: Film) => void;
  onDirector: (film: Film) => void;
}

const FeedItem = memo(({
  item, isActive, isNear, isNext, height, onComment, onShare, onDirector,
}: FeedItemProps) => {
  // ── Video player ────────────────────────────────────────────
  const videoUrl  = useMemo(() => getCdnUrl('videos', item.video_path), [item.video_path]);
  const player    = useVideoPlayer(null, p => { p.loop = true; p.muted = true; });

  // ── State ───────────────────────────────────────────────────
  const [hasError,   setHasError]   = useState(false);
  const [isBuffering, setBuffering] = useState(false);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isMuted,    setIsMuted]    = useState(true);
  const [liked,      setLiked]      = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes_count);
  const [saved,      setSaved]      = useState(false);
  const [showSynopsis, setShowSynopsis] = useState(false);
  const [heartPos,   setHeartPos]   = useState<{ x: number; y: number; v: boolean }>({ x: 0, y: 0, v: false });

  // ── Refs ────────────────────────────────────────────────────
  const lastTap     = useRef(0);
  const viewedRef   = useRef(false);
  const pausedByUser = useRef(false);

  // ── Load & preload logic ─────────────────────────────────────
  useEffect(() => {
    if (!videoUrl) return;
    if (!isNear && !isNext) return;

    setHasError(false);
    try {
      player.replace({ uri: videoUrl });
      player.loop   = true;
      player.muted  = true;
    } catch { setHasError(true); }
  }, [videoUrl, isNear, isNext]);

  // ── Play / pause based on active state ──────────────────────
  useEffect(() => {
    if (!isNear || !videoUrl) return;

    if (isActive && !pausedByUser.current) {
      try {
        player.play();
        setIsPlaying(true);
      } catch { /* expo-video may not be ready */ }
      // Increment view once per activation
      if (!viewedRef.current) {
        viewedRef.current = true;
        incrementViews(item.id);
      }
    } else {
      try {
        player.pause();
        setIsPlaying(false);
      } catch { }
    }
  }, [isActive, isNear, videoUrl, item.id]);

  // ── Player status listener ───────────────────────────────────
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error')   { setHasError(true); setBuffering(false); }
      if (status === 'loading') setBuffering(true);
      if (status === 'readyToPlay') setBuffering(false);
    });
    return () => sub.remove();
  }, [player]);

  // ── Reset view tracker when not active ──────────────────────
  useEffect(() => {
    if (!isActive) { viewedRef.current = false; pausedByUser.current = false; }
  }, [isActive]);

  // ── TAP: pause/resume + unmute ───────────────────────────────
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      // Double tap → like
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;

    setTimeout(() => {
      if (now !== lastTap.current) return; // was a double tap
      // Single tap = toggle pause / unmute audio
      if (isMuted) {
        player.muted = false;
        setIsMuted(false);
        return;
      }
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        pausedByUser.current = true;
      } else {
        player.play();
        setIsPlaying(true);
        pausedByUser.current = false;
      }
    }, 280);
  }, [isMuted, isPlaying, player]);

  // ── DOUBLE TAP: heart like ───────────────────────────────────
  const handleDoubleTap = useCallback((evt: any) => {
    const { locationX, locationY } = evt.nativeEvent;
    setHeartPos({ x: locationX, y: locationY, v: true });
    setTimeout(() => setHeartPos(p => ({ ...p, v: false })), 900);

    if (!liked) {
      setLiked(true);
      setLikesCount(c => c + 1);
      toggleLike(item.id, false);
    }
  }, [liked, item.id]);

  // ── LIKE button ──────────────────────────────────────────────
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLikesCount(c => next ? c + 1 : Math.max(0, c - 1));
    toggleLike(item.id, liked);
  }, [liked, item.id]);

  // ── SAVE ─────────────────────────────────────────────────────
  const handleSave = useCallback(() => setSaved(s => !s), []);

  // ── MUTE toggle ──────────────────────────────────────────────
  const handleMute = useCallback(() => {
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  }, [isMuted, player]);

  // ── Retry on error ───────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setHasError(false);
    if (videoUrl) {
      try { player.replace({ uri: videoUrl }); player.play(); } catch { }
    }
  }, [videoUrl, player]);

  const genreColor = getGenreColor(item.genre);

  return (
    <View style={{ height, backgroundColor: '#000' }}>

      {/* ── POSTER — always visible as bg ── */}
      {item.poster_url && (
        <Image source={{ uri: item.poster_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      {/* ── VIDEO — mounted when near/next ── */}
      {(isNear || isNext) && videoUrl && !hasError && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      )}

      {/* ── ERROR OVERLAY ── */}
      {hasError && (
        <TouchableOpacity onPress={handleRetry} style={fi.errorOverlay} activeOpacity={0.8}>
          <BlurView intensity={50} tint="dark" style={fi.errorCard}>
            <Ionicons name="refresh-circle-outline" size={42} color="rgba(255,255,255,0.7)" />
            <Text style={fi.errorTxt}>Tap pour relancer</Text>
          </BlurView>
        </TouchableOpacity>
      )}

      {/* ── BUFFERING SPINNER ── */}
      {isBuffering && !hasError && isActive && (
        <View style={fi.bufferWrap} pointerEvents="none">
          <BlurView intensity={30} tint="dark" style={fi.bufferCard}>
            <ActivityIndicator color={G.primary} size="large" />
          </BlurView>
        </View>
      )}

      {/* ── GRADIENT OVERLAYS ── */}
      <LinearGradient
        colors={['rgba(6,0,16,0.85)', 'transparent', 'transparent', 'rgba(6,0,16,0.95)']}
        locations={[0, 0.18, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── DOUBLE-TAP ZONE ── */}
      <TouchableWithoutFeedback
        onPress={handleTap}
        onLongPress={undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleTap}
          onLongPress={() => setShowSynopsis(s => !s)}
          delayLongPress={600}
          android_ripple={null}
        >
          <View style={StyleSheet.absoluteFill} />
        </Pressable>
      </TouchableWithoutFeedback>

      {/* Separate double-tap detection overlay */}
      <TouchableWithoutFeedback
        onPress={(e) => {
          const now = Date.now();
          if (now - lastTap.current < 280) {
            handleDoubleTap(e);
          } else {
            lastTap.current = now;
          }
        }}
      >
        <View style={fi.doubleTapZone} />
      </TouchableWithoutFeedback>

      {/* ── HEART BURST ── */}
      <HeartBurst visible={heartPos.v} x={heartPos.x} y={heartPos.y} />

      {/* ── PAUSE ICON ── */}
      {!isPlaying && isActive && !hasError && !isBuffering && (
        <View style={fi.pauseIcon} pointerEvents="none">
          <BlurView intensity={35} tint="dark" style={fi.pauseIconInner}>
            <Ionicons name="play" size={36} color="rgba(255,255,255,0.9)" />
          </BlurView>
        </View>
      )}

      {/* ── LEFT RAIL — film info ── */}
      <View style={fi.leftRail} pointerEvents="box-none">
        {/* Featured badge */}
        {item.is_featured && (
          <BlurView intensity={25} tint="dark" style={fi.featuredBadge}>
            <Ionicons name="star" size={10} color={G.gold} />
            <Text style={fi.featuredTxt}>SÉLECTION</Text>
          </BlurView>
        )}

        {/* Title */}
        <Text style={fi.title} numberOfLines={2}>{item.title}</Text>

        {/* Director row */}
        <TouchableOpacity onPress={() => onDirector(item)} style={fi.directorRow} activeOpacity={0.8}>
          {item.director_avatar && (
            <Image source={{ uri: item.director_avatar }} style={fi.dirAvatar} />
          )}
          <Text style={fi.directorName}>{item.director}</Text>
          <View style={[fi.genrePill, { backgroundColor: `${genreColor}20`, borderColor: `${genreColor}55` }]}>
            <Text style={[fi.genreTxt, { color: genreColor }]}>{item.genre}</Text>
          </View>
        </TouchableOpacity>

        {/* Meta row */}
        <View style={fi.metaRow}>
          <Text style={fi.metaTxt}>{item.year}</Text>
          <View style={fi.metaDot} />
          <Text style={fi.metaTxt}>{item.runtime}</Text>
          <View style={fi.metaDot} />
          <Text style={fi.metaTxt}>{item.language}</Text>
        </View>

        {/* Synopsis — toggleable */}
        <TouchableOpacity onPress={() => setShowSynopsis(s => !s)} activeOpacity={0.8}>
          <Text style={fi.synopsis} numberOfLines={showSynopsis ? 0 : 2}>
            {item.synopsis}
          </Text>
          {!showSynopsis && (
            <Text style={fi.synopsisMore}>Voir plus</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── RIGHT RAIL — actions ── */}
      <View style={fi.rightRail} pointerEvents="box-none">
        {/* Director avatar */}
        <TouchableOpacity onPress={() => onDirector(item)} style={fi.authorBtn} activeOpacity={0.9}>
          <LinearGradient colors={[G.primary, G.cyan]} style={fi.authorRing}>
            {item.director_avatar ? (
              <Image source={{ uri: item.director_avatar }} style={fi.authorAvatar} />
            ) : (
              <Ionicons name="person" size={22} color="#fff" />
            )}
          </LinearGradient>
          <View style={fi.followDot}>
            <Ionicons name="add" size={10} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Like */}
        <ActionBtn
          icon="heart-outline" iconAlt="heart"
          count={likesCount}
          color={G.danger} active={liked}
          onPress={handleLike}
        />

        {/* Comment */}
        <ActionBtn
          icon="chatbubble-outline"
          label="Critique"
          color={G.cyan}
          onPress={() => onComment(item)}
        />

        {/* Save */}
        <ActionBtn
          icon="bookmark-outline" iconAlt="bookmark"
          label={saved ? 'Sauvé' : 'Sauver'}
          color={G.gold} active={saved}
          onPress={handleSave}
        />

        {/* Share */}
        <ActionBtn
          icon="share-social-outline"
          label="Partager"
          onPress={() => onShare(item)}
        />

        {/* Mute */}
        <ActionBtn
          icon="volume-mute-outline" iconAlt="volume-high-outline"
          active={!isMuted}
          color={G.primary}
          onPress={handleMute}
        />

        {/* Views */}
        <View style={fi.viewsRow}>
          <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.45)" />
          <Text style={fi.viewsTxt}>{fmtCount(item.views_count)}</Text>
        </View>
      </View>

      {/* ── PROGRESS BAR ── */}
      {(isNear || isNext) && !hasError && (
        <VideoProgress player={player} />
      )}

    </View>
  );
});
FeedItem.displayName = 'FeedItem';

const fi = StyleSheet.create({
  errorOverlay: { ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center' },
  errorCard:    { alignItems: 'center', gap: 10, padding: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  errorTxt:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  bufferWrap:   { ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center' },
  bufferCard:   { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pauseIcon:    { position: 'absolute', top: '50%', left: '50%', marginTop: -36, marginLeft: -36 },
  pauseIconInner:{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  doubleTapZone:{ ...StyleSheet.absoluteFillObject as any },

  // Left rail
  leftRail:     { position: 'absolute', bottom: 28, left: 16, right: 80, gap: 7 },
  featuredBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,226,112,0.35)', alignSelf: 'flex-start', marginBottom: 2 },
  featuredTxt:  { color: G.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title:        { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  directorRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dirAvatar:    { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(192,96,255,0.5)' },
  directorName: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  genrePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  genreTxt:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaTxt:      { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  metaDot:      { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  synopsis:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 },
  synopsisMore: { color: G.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Right rail
  rightRail:    { position: 'absolute', bottom: 36, right: 12, alignItems: 'center', gap: 12 },
  authorBtn:    { position: 'relative', marginBottom: 4 },
  authorRing:   { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', padding: 2 },
  authorAvatar: { width: 48, height: 48, borderRadius: 24 },
  followDot:    { position: 'absolute', bottom: -4, left: '50%', marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: G.primary, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  viewsRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsTxt:     { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontVariant: ['tabular-nums'] },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📱 HEADER — top bar with logo + hamburger
// ─────────────────────────────────────────────────────────────────────────────
const Header = memo(({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) => {
  const enterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enterAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[hd.wrap, { opacity: enterAnim }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill as any} />
      <View style={hd.inner}>


  

        {/* Actions */}
        <View style={hd.actions}>
     
          <TouchableOpacity onPress={onMenu} style={hd.iconBtn} activeOpacity={0.8}>
            <Ionicons name="menu" size={23} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

        </View>
      </View>

      
    </Animated.View>



  );
});
Header.displayName = 'Header';

const hd = StyleSheet.create({
  wrap:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  inner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  logo:        { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoGrad:    { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoText:    { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2.5 },
  tabs:        { flexDirection: 'row', alignItems: 'center', gap: 20 },
  tab:         { position: 'relative', paddingBottom: 2 },
  tabActive:   {},
  tabTxt:      { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tabTxtActive:{ color: '#fff', fontWeight: '800' },
  tabUnderline:{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: G.primary, borderRadius: 1 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📋 DROPDOWN MENU — left sidebar
// ─────────────────────────────────────────────────────────────────────────────
const DropDownMenu = memo(({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const router    = useRouter();
  const slideAnim = useRef(new Animated.Value(-SW)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 22 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SW, duration: 230, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const navigate = (path: string) => { onClose(); setTimeout(() => router.push(path as any), 260); };

  const menuItems = [
    { icon: 'home-outline',        label: 'Accueil',          path: '/(tabs)/'           },
    { icon: 'film-outline',        label: 'Mon Studio',       path: '/(tabs)/create'     },
    { icon: 'compass-outline',     label: 'Découvrir',        path: '/(tabs)/search'     },
    { icon: 'bookmark-outline',    label: 'Mes sauvegardes',  path: '/(tabs)/saved'      },
    { icon: 'notifications-outline', label: 'Notifications',  path: '/(tabs)/notifs'     },
    { icon: 'person-outline',      label: 'Mon profil',       path: '/(tabs)/profile'    },
    { icon: 'settings-outline',    label: 'Paramètres',       path: '/settings'          },
  ];

  const quickActions = [
    { icon: 'add-circle-outline',  label: 'Nouveau film',     path: '/(tabs)/create'     },
    { icon: 'star-outline',        label: 'Rédiger critique', path: '/(tabs)/create'     },
  ];

  return (
    <View style={dm.overlay} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[dm.backdrop, { opacity: fadeAnim }]} pointerEvents="auto">
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>


      {/* Panel */}
      <Animated.View style={[dm.panel, { transform: [{ translateX: slideAnim }] }]} pointerEvents="auto">
        {/* Blur bg */}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill as any} />
        <LinearGradient
          colors={['rgba(108,16,195,0.18)', 'rgba(6,0,16,0.95)']}
          style={StyleSheet.absoluteFill as any}
        />

        {/* Content */}
        <SafeAreaView style={dm.safe}>
          {/* Profile preview */}
          <View style={dm.profileWrap}>
            <LinearGradient colors={[G.primary, G.cyan]} style={dm.profileRing}>
              <Image source={{ uri: 'https://i.pravatar.cc/150?img=30' }} style={dm.profileAvatar} />
            </LinearGradient>
            <View>
              <Text style={dm.profileName}>Mon univers</Text>
              <Text style={dm.profileSub}>@universe_user</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={dm.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Quick actions */}
          <Text style={dm.sectionLabel}>CRÉER</Text>
          <View style={dm.quickRow}>
            {quickActions.map(a => (
              <TouchableOpacity key={a.path + a.label} onPress={() => navigate(a.path)}
                style={dm.quickBtn} activeOpacity={0.8}
              >
                <LinearGradient colors={['rgba(192,96,255,0.2)', 'rgba(108,16,195,0.12)']} style={dm.quickGrad}>
                  <Ionicons name={a.icon as any} size={20} color={G.primary} />
                  <Text style={dm.quickLabel}>{a.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nav items */}
          <Text style={dm.sectionLabel}>NAVIGATION</Text>
          {menuItems.map(item => (
            <TouchableOpacity key={item.path + item.label} onPress={() => navigate(item.path)}
              style={dm.navItem} activeOpacity={0.75}
            >
              <View style={dm.navIcon}>
                <Ionicons name={item.icon as any} size={19} color={G.primary} />
              </View>
              <Text style={dm.navLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          ))}

          {/* Stats bar */}
          <BlurView intensity={15} tint="dark" style={dm.statsCard}>
            {[
              { label: 'Films vus',   val: '47'  },
              { label: 'Critiques',   val: '12'  },
              { label: 'Abonnements', val: '8'   },
            ].map(({ label, val }) => (
              <View key={label} style={dm.stat}>
                <Text style={dm.statVal}>{val}</Text>
                <Text style={dm.statLabel}>{label}</Text>
              </View>
            ))}
          </BlurView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
});
DropDownMenu.displayName = 'DropDownMenu';

const dm = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject as any, zIndex: 100 },
  backdrop:     { ...StyleSheet.absoluteFillObject as any, backgroundColor: 'rgba(0,0,0,0.65)' },
  panel:        { position: 'absolute', top: 0, left: 0, bottom: 0, width: SW * 0.78, overflow: 'hidden', borderRightWidth: 1, borderRightColor: 'rgba(192,96,255,0.15)' },
  safe:         { flex: 1, paddingHorizontal: 20, paddingTop: 10, gap: 0 },
  profileWrap:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  profileRing:  { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', padding: 2 },
  profileAvatar:{ width: 50, height: 50, borderRadius: 25 },
  profileName:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  profileSub:   { color: G.textSub, fontSize: 12, marginTop: 1 },
  closeBtn:     { marginLeft: 'auto' as any, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10, marginTop: 4 },
  quickRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickBtn:     { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.22)' },
  quickGrad:    { padding: 14, alignItems: 'center', gap: 8 },
  quickLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  navItem:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  navIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(192,96,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  navLabel:     { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  statsCard:    { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, flexDirection: 'row', overflow: 'hidden' },
  stat:         { flex: 1, alignItems: 'center', gap: 3 },
  statVal:      { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel:    { color: G.textSub, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 💬 COMMENT SHEET — quick critique overlay
// ─────────────────────────────────────────────────────────────────────────────
const CommentSheet = memo(({ film, visible, onClose }: { film: Film | null; visible: boolean; onClose: () => void }) => {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const [text, setText] = useState('');

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600, useNativeDriver: true,
      tension: 180, friction: 22,
    }).start();
  }, [visible]);

  if (!film && !visible) return null;

  return (
    <Animated.View style={[cs.sheet, { transform: [{ translateY: slideAnim }] }]} pointerEvents={visible ? 'auto' : 'none'}>
      <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill as any} />
      <LinearGradient colors={['rgba(108,16,195,0.12)', 'rgba(6,0,16,0.98)']} style={StyleSheet.absoluteFill as any} />

      <View style={cs.inner}>
        {/* Handle */}
        <View style={cs.handle} />

        {/* Header */}
        <View style={cs.header}>
          <View>
            <Text style={cs.title}>Laisser une critique</Text>
            {film && <Text style={cs.sub}>{film.title}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={cs.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={26} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* Stars */}
        <View style={cs.starsRow}>
          {[1, 2, 3, 4, 5].map(s => (
            <TouchableOpacity key={s} activeOpacity={0.7}>
              <Ionicons name="star-outline" size={32} color="rgba(255,226,112,0.3)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Input */}
        <BlurView intensity={15} tint="dark" style={cs.inputWrap}>
          <Text style={cs.inputLabel}>Votre critique</Text>
          <View style={cs.textArea}>
            <Text style={cs.placeholder}>Photographie, montage, mise en scène…</Text>
          </View>
        </BlurView>

        {/* Submit */}
        <TouchableOpacity style={cs.submitBtn} activeOpacity={0.85}>
          <LinearGradient colors={['#7B2FBE', '#C060FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cs.submitGrad}>
            <Ionicons name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={cs.submitTxt}>Publier la critique</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
CommentSheet.displayName = 'CommentSheet';

const cs = StyleSheet.create({
  sheet:     { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 80, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(192,96,255,0.2)' },
  inner:     { padding: 22, gap: 16 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 4 },
  header:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:     { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub:       { color: G.textSub, fontSize: 12, marginTop: 2 },
  closeBtn:  {},
  starsRow:  { flexDirection: 'row', gap: 12, justifyContent: 'center', paddingVertical: 4 },
  inputWrap: { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, overflow: 'hidden', padding: 14 },
  inputLabel:{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  textArea:  { minHeight: 80 },
  placeholder:{ color: 'rgba(255,255,255,0.18)', fontSize: 14, fontStyle: 'italic' },
  submitBtn: { borderRadius: 16, overflow: 'hidden' },
  submitGrad:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 VIEWABILITY CONFIG — fire when 85% visible, prevent flicker
// ─────────────────────────────────────────────────────────────────────────────
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 85,
  minimumViewTime: 120,
};

// ─────────────────────────────────────────────────────────────────────────────
// 📱 MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();

  // ── State ────────────────────────────────────────────────────
  const [films,       setFilms]       = useState<Film[]>(FALLBACK_FILMS);
  const [friends,     setFriends]     = useState<Friend[]>(FALLBACK_FRIENDS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [commentFilm, setCommentFilm] = useState<Film | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showFriends, setShowFriends] = useState(true);
  const [page,        setPage]        = useState(0);
  const [hasMore,     setHasMore]     = useState(true);

  const flatRef   = useRef<FlatList>(null);
  const PAGE_SIZE = 10;

  // ── Header height (status bar + header) ────────────────────
  const HEADER_H    = insets.top + 54;
  const FRIENDS_H   = showFriends ? 90 : 0;
  const SCROLL_SNAP = height; // full screen per item

  // ── Fetch films from Supabase ────────────────────────────────
  const fetchFilms = useCallback(async (pageNum = 0, append = false) => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select(`
          id, title, director, genre, synopsis, year, runtime,
          poster_url, video_path, likes_count, views_count,
          is_featured, aspect_ratio, language, director_avatar
        `)
        .order('is_featured', { ascending: false })
        .order('views_count', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) { setHasMore(false); return; }
      if (data.length < PAGE_SIZE)    setHasMore(false);

      setFilms(prev => append ? [...prev, ...data] : data);
    } catch {
      // Keep fallback data — no crash
      console.warn('[UNIVERSE] Supabase fetch failed — using fallback');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch friends ────────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('friends')
        .select('id, username, avatar_url, has_story, is_online')
        .order('has_story', { ascending: false })
        .limit(15);
      if (data && data.length > 0) setFriends(data);
    } catch { /* keep fallback */ }
  }, []);

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => {
    fetchFilms(0, false);
    fetchFriends();
  }, []);

  // ── Pull to refresh ──────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    fetchFilms(0, false);
  }, [fetchFilms]);

  // ── Load more (infinite scroll) ──────────────────────────────
  const onEndReached = useCallback(() => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFilms(nextPage, true);
  }, [hasMore, loading, page, fetchFilms]);

  // ── Viewability callback ─────────────────────────────────────
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setActiveIndex(idx);
      // Auto-hide friends bar after first swipe
      if (idx > 0) setShowFriends(false);
    }
  }).current;

  // ── getItemLayout for performance (fixed height) ─────────────
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCROLL_SNAP, offset: SCROLL_SNAP * index, index,
  }), [SCROLL_SNAP]);

  // ── Render item ──────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: Film; index: number }) => (
    <FeedItem
      item={item}
      isActive={index === activeIndex}
      isNear={Math.abs(index - activeIndex) <= 1}
      isNext={index === activeIndex + 1}
      height={SCROLL_SNAP}
      onComment={(f) => setCommentFilm(f)}
      onShare={(f) => Alert.alert('Partager', `"${f.title}" par ${f.director}`)}
      onDirector={(f) => Alert.alert(f.director, `Réalisateur de "${f.title}"`)}
    />
  ), [activeIndex, SCROLL_SNAP]);

  // ── Footer loader ────────────────────────────────────────────
  const ListFooter = useMemo(() => (
    hasMore ? (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color={G.primary} />
      </View>
    ) : null
  ), [hasMore]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── DROPDOWN MENU ── */}
      <DropDownMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />


      {/* ── FRIENDS BAR — absolutely on top of the feed ── */}
      {showFriends && (
        <View style={[styles.friendsWrap, { top: HEADER_H }]}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill as any} />
          <LinearGradient
            colors={['rgba(6,0,16,0.9)', 'rgba(6,0,16,0.0)']}
            style={StyleSheet.absoluteFill as any}
            pointerEvents="none"
          />
          <FriendsBar
            friends={friends}
            onPress={(f) => Alert.alert(f.username, f.has_story ? 'Story disponible' : 'Pas de story')}
          />
        </View>
      )}

      {/* ── FEED ── */}
      <FlatList
        ref={flatRef}
        data={films}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={SCROLL_SNAP}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={ListFooter}
        refreshing={refreshing}
        onRefresh={onRefresh}
        // Disable bounce on Android to prevent stutter
        overScrollMode="never"
        bounces={Platform.OS === 'ios'}
      />

      {/* ── HEADER — fixed on top ── */}
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <Header
          onMenu={() => setMenuOpen(true)}
          onSearch={() => router.push('/(tabs)/search' as any)}
        />
      </View>

      {/* ── INDEX DOTS — right edge ── */}
      {films.length > 1 && (
        <View style={styles.dotsWrap} pointerEvents="none">
          {films.slice(0, Math.min(films.length, 8)).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === Math.min(activeIndex, 7) && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── LOADING INITIAL ── */}
      {loading && films.length === 0 && (
        <View style={styles.loadingOverlay}>
          <LinearGradient colors={['#060010', '#0A001E']} style={StyleSheet.absoluteFill as any} />
          <ActivityIndicator size="large" color={G.primary} />
          <Text style={styles.loadingTxt}>Chargement du cinéma…</Text>
        </View>
      )}

      {/* ── COMMENT SHEET ── */}
      <CommentSheet
        film={commentFilm}
        visible={commentFilm !== null}
        onClose={() => setCommentFilm(null)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#000' },
  headerWrap:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  friendsWrap:   { position: 'absolute', left: 0, right: 0, zIndex: 40, overflow: 'hidden' },
  dotsWrap:      { position: 'absolute', right: 6, top: '50%', transform: [{ translateY: -50 }], gap: 5, alignItems: 'center' },
  dot:           { width: 3, height: 18, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive:     { backgroundColor: G.primary, height: 28, shadowColor: G.primary, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  loadingOverlay:{ ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 200 },
  loadingTxt:    { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
});