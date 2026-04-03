// ═══════════════════════════════════════════════════════════════════
//  index.tsx — UNIVERSE / Feed Reels (version optimisée)
//  ─────────────────────────────────────────────────────────────────
//  ✦ expo-video stable (SDK 52+) — VideoView + useVideoPlayer
//  ✦ Fix chargement vidéo : source guard + retry + error recovery
//  ✦ Mobile-first responsive : useWindowDimensions + SafeArea insets
//  ✦ Rendu sélectif : vidéo uniquement pour active ± 1 (perf)
//  ✦ Auto-play / pause via useEvent + isActive + screenFocused
//  ✦ Preloading stratégique des voisins (player pool)
//  ✦ Double-tap like avec animation cœur plein écran
//  ✦ Shimmer skeleton pendant le buffering
//  ✦ Haptic feedback sur toutes les actions
//  ✦ useFocusEffect → pause globale à la navigation
//  ✦ Sidebar extrait → <DropdownMenu /> (DropdownMenu.tsx)
//  ✦ Architecture mémoïsée 100% (memo + useCallback + useMemo)
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Animated, Easing, Modal, StatusBar, ActivityIndicator,
  TouchableWithoutFeedback, Platform, useWindowDimensions,
} from 'react-native';
import { LinearGradient }         from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView }               from 'expo-blur';
import { Ionicons }               from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent }               from 'expo';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics               from 'expo-haptics';

// Sidebar extrait
import DropdownMenu, { MENU_ITEMS, type MenuKey } from '../../components/DropDownMenu';

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
  green:   '#22C55E',
} as const;

// ═══════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════

interface Friend {
  id: string;
  name: string;
  avatar: string;
  followed: boolean;
}

interface FeedFilm {
  id: string;
  title: string;
  series: string;
  episode: number;
  episode_title: string;
  poster_url: string;
  video_url?: string;
  caption: string;
  duration: string;
  likes: number;
  liked_by_friends: Friend[];
  tags: string[];
  director: string;
  year: number;
  comment?: string;
  verified?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
//  MOCK DATA
// ═══════════════════════════════════════════════════════════════════

const FRIENDS_POOL: Friend[] = [
  { id: 'f1', name: '@lucie_mv',  avatar: 'https://i.pravatar.cc/60?img=9',  followed: true  },
  { id: 'f2', name: '@marc.film', avatar: 'https://i.pravatar.cc/60?img=12', followed: false },
  { id: 'f3', name: '@anaelle_c', avatar: 'https://i.pravatar.cc/60?img=22', followed: true  },
  { id: 'f4', name: '@hugo_cine', avatar: 'https://i.pravatar.cc/60?img=33', followed: false },
  { id: 'f5', name: '@soph_art',  avatar: 'https://i.pravatar.cc/60?img=47', followed: true  },
];

// Vidéos MP4 directement streamables (CDN Google — pas de redirect)
const MOCK_FEED: FeedFilm[] = [
  {
    id: '1', title: 'Puffers', series: 'Puffers', episode: 1,
    episode_title: 'Reprends là où tu t\'es arrêté',
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    caption: 'oh you are an actor…\nwhat have i seen you in?',
    duration: '9:56', likes: 1324,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[2]],
    tags: ['Thriller', 'Indépendant'], director: 'Sophie Martin', year: 2024,
    comment: 'ça a l\'air super…', verified: true,
  },
  {
    id: '2', title: 'Nuit de Verre', series: 'Nuit de Verre', episode: 1,
    episode_title: 'La première fracture',
    poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    caption: 'parfois l\'obscurité\nest la seule lumière',
    duration: '10:54', likes: 872,
    liked_by_friends: [FRIENDS_POOL[2], FRIENDS_POOL[4]],
    tags: ['Drame', 'Court métrage'], director: 'Karim Belhadj', year: 2024,
    comment: 'cette scène m\'a touché…',
  },
  {
    id: '3', title: 'Horizon Brisé', series: 'Horizon Brisé', episode: 2,
    episode_title: 'Le dernier signal',
    poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    caption: 'jusqu\'où peut-on\naller pour la vérité ?',
    duration: '0:15', likes: 2100,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[3], FRIENDS_POOL[4]],
    tags: ['Sci-Fi', 'ORIGINAL'], director: 'Emma Dupont', year: 2023,
    comment: 'le bro Enzo boit l\'eau des pâtes', verified: true,
  },
  {
    id: '4', title: 'Velours Rouge', series: 'Velours Rouge', episode: 3,
    episode_title: 'Masques',
    poster_url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    caption: 'qui sommes-nous\nsans nos masques ?',
    duration: '0:15', likes: 3400,
    liked_by_friends: [FRIENDS_POOL[1], FRIENDS_POOL[2]],
    tags: ['Romance', 'Festival'], director: 'Isabelle Morin', year: 2024,
    comment: 'romantique et douloureux…',
  },
  {
    id: '5', title: 'Fractures', series: 'Fractures', episode: 1,
    episode_title: 'Avant le tremblement',
    poster_url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    caption: 'dans chaque fissure\nse cache une histoire',
    duration: '14:48', likes: 2750,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[2], FRIENDS_POOL[3]],
    tags: ['Documentaire', 'Indépendant'], director: 'Lucas Moreau', year: 2023,
  },
  {
    id: '6', title: 'Échos du Passé', series: 'Échos du Passé', episode: 4,
    episode_title: 'Les voix oubliées',
    poster_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    caption: 'les souvenirs\nsont des fantômes bienveillants',
    duration: '12:14', likes: 2890,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[3]],
    tags: ['Fantasy', 'Indépendant'], director: 'Sophie Martin', year: 2023,
    comment: 'une aventure onirique incroyable !', verified: true,
  },
  {
    id: '7', title: 'Miroirs Brisés', series: 'Miroirs Brisés', episode: 2,
    episode_title: 'Reflets déformés',
    poster_url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Yosemite.mp4',
    caption: 'parfois le reflet\nest plus vrai que la réalité',
    duration: '2:22', likes: 1980,
    liked_by_friends: [FRIENDS_POOL[1], FRIENDS_POOL[4]],
    tags: ['Thriller', 'Festival'], director: 'Karim Belhadj', year: 2024,
  },
  {
    id: '8', title: 'Sables Mouvants', series: 'Sables Mouvants', episode: 1,
    episode_title: 'Enfouis sous les pas',
    poster_url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    caption: 'parfois il faut s\'enfoncer\npour mieux se relever',
    duration: '1:00', likes: 1650,
    liked_by_friends: [FRIENDS_POOL[2], FRIENDS_POOL[3]],
    tags: ['Thriller', 'ORIGINAL'], director: 'Emma Dupont', year: 2024,
  },
  {
    id: '9', title: 'Lueurs d\'Espoir', series: 'Lueurs d\'Espoir', episode: 3,
    episode_title: 'Au bout du tunnel',
    poster_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    caption: 'même dans les ténèbres\nune lueur peut guider nos pas',
    duration: '0:15', likes: 2200,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[4]],
    tags: ['Drame', 'Indépendant'], director: 'Isabelle Morin', year: 2023,
  },
  {
    id: '10', title: 'Rêves Suspendus', series: 'Rêves Suspendus', episode: 2,
    episode_title: 'Entre deux mondes',
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    caption: 'parfois les rêves\nsont les seuls refuges qui restent',
    duration: '0:15', likes: 3100,
    liked_by_friends: [FRIENDS_POOL[1], FRIENDS_POOL[2], FRIENDS_POOL[3], FRIENDS_POOL[4]],
    tags: ['Fantasy', 'Festival'], director: 'Lucas Moreau', year: 2024,
  },
];

// ═══════════════════════════════════════════════════════════════════
//  SHIMMER SKELETON — animation shimmer CSS-like
// ═══════════════════════════════════════════════════════════════════

interface ShimmerProps { width: number; height: number }

const Shimmer = memo(function Shimmer({ width, height }: ShimmerProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue:         1,
        duration:        1400,
        easing:          Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={{ width, height, backgroundColor: P.surface, overflow: 'hidden' }}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(192,96,255,0.18)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <ActivityIndicator
        style={{ position: 'absolute', top: '50%', alignSelf: 'center', marginTop: -20 }}
        size="large"
        color={P.primL}
      />
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  TOP HEADER
// ═══════════════════════════════════════════════════════════════════

interface TopHeaderProps {
  feedKey:     MenuKey;
  onMenuPress: () => void;
  scrollY:     Animated.Value;
}

const TopHeader = memo(function TopHeader({ feedKey, onMenuPress, scrollY }: TopHeaderProps) {
  const router  = useRouter();
  const item    = useMemo(() => MENU_ITEMS.find(m => m.key === feedKey) ?? MENU_ITEMS[0], [feedKey]);

  // Légère disparition au scroll vers le bas
  const opacity = scrollY.interpolate({
    inputRange:  [0, 80],
    outputRange: [1, 0.4],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[th.container, { opacity }]} pointerEvents="box-none">
      {/* Hamburger + label feed */}
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onMenuPress();
        }}
        style={th.leftBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      >
        <View style={th.hamburger}>
          <View style={[th.hLine, { width: 20 }]} />
          <View style={[th.hLine, { width: 13 }]} />
          <View style={[th.hLine, { width: 20 }]} />
        </View>
        <Text style={th.feedLabel} numberOfLines={1}>{item.label}</Text>
        <Ionicons name="chevron-down" size={13} color={P.t2} style={{ marginTop: 1 }} />
      </TouchableOpacity>

      {/* Amies + avatars */}
      <TouchableOpacity
        style={th.rightGroup}
        activeOpacity={0.7}
        onPress={() => router.push('/social')}
      >
        <Text style={th.amiesLabel}>Amies</Text>
        <View style={th.avatarPile}>
          {FRIENDS_POOL.slice(0, 2).map((f, i) => (
            <Image
              key={f.id}
              source={{ uri: f.avatar }}
              style={[th.avatar, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
            />
          ))}
          <View style={[th.avatar, th.globeCircle, { marginLeft: -10, zIndex: 0 }]}>
            <Text style={{ fontSize: 12 }}>🌍</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const th = StyleSheet.create({
  container:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  leftBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '70%' },
  hamburger:   { gap: 4.5 },
  hLine:       { height: 2.5, borderRadius: 2, backgroundColor: P.t1 },
  feedLabel:   { color: P.t1, fontSize: 18, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1 },
  rightGroup:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amiesLabel:  { color: P.t2, fontSize: 15, fontWeight: '600' },
  avatarPile:  { flexDirection: 'row', alignItems: 'center' },
  avatar:      { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: P.bg },
  globeCircle: { backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center', borderColor: P.bg },
});

// ═══════════════════════════════════════════════════════════════════
//  RIGHT ACTION BAR
// ═══════════════════════════════════════════════════════════════════

interface RightBarProps {
  film:    FeedFilm;
  liked:   boolean;
  muted:   boolean;
  saved:   boolean;
  onLike:  () => void;
  onMute:  () => void;
  onInfo:  () => void;
  onSave:  () => void;
}

const RightBar = memo(function RightBar({
  film, liked, muted, saved, onLike, onMute, onInfo, onSave,
}: RightBarProps) {
  const heartSc  = useRef(new Animated.Value(1)).current;
  const saveSc   = useRef(new Animated.Value(1)).current;

  const triggerAnim = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.42, duration: 100, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 12 }),
    ]).start();
  }, []);

  const pressHeart = useCallback(() => {
    triggerAnim(heartSc);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike();
  }, [onLike, heartSc, triggerAnim]);

  const pressSave = useCallback(() => {
    triggerAnim(saveSc);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave();
  }, [onSave, saveSc, triggerAnim]);

  const likeCount = film.likes + (liked ? 1 : 0);

  return (
    <View style={rb.bar}>
      {/* Mute / Unmute */}
      <TouchableOpacity
        style={rb.iconBtn}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onMute();
        }}
        activeOpacity={0.75}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[rb.iconWrap, muted && rb.iconWrapActive]}>
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={22}
            color={muted ? P.primL : P.t1}
          />
        </View>
      </TouchableOpacity>

      {/* Like */}
      <View style={rb.item}>
        <TouchableOpacity onPress={pressHeart} activeOpacity={0.82} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Animated.View style={{ transform: [{ scale: heartSc }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={34}
              color={liked ? '#EF4444' : 'rgba(240,232,255,0.90)'}
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={rb.count}>{likeCount.toLocaleString('fr-FR')}</Text>
      </View>

      {/* Info / détail */}
      <View style={rb.item}>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onInfo();
          }}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={rb.iconWrap}>
            <Ionicons name="information-circle-outline" size={26} color="rgba(240,232,255,0.90)" />
          </View>
        </TouchableOpacity>
        <Text style={rb.count}>Infos</Text>
      </View>

      {/* Watchlist */}
      <View style={rb.item}>
        <TouchableOpacity onPress={pressSave} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Animated.View style={{ transform: [{ scale: saveSc }] }}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={30}
              color={saved ? P.gold : 'rgba(240,232,255,0.90)'}
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={rb.count}>Sauver</Text>
      </View>

      {/* Share */}
      <View style={rb.item}>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={rb.iconWrap}>
            <Ionicons name="arrow-redo-outline" size={26} color="rgba(240,232,255,0.90)" />
          </View>
        </TouchableOpacity>
        <Text style={rb.count}>Partager</Text>
      </View>
    </View>
  );
});

const rb = StyleSheet.create({
  bar:           { position: 'absolute', right: 14, bottom: 220, alignItems: 'center', gap: 20 },
  iconBtn:       { alignItems: 'center', justifyContent: 'center' },
  iconWrap:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  iconWrapActive:{ backgroundColor: 'rgba(146,64,214,0.28)' },
  item:          { alignItems: 'center', gap: 4 },
  count:         { color: 'rgba(240,232,255,0.82)', fontSize: 11, fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════════
//  BOTTOM EPISODE CARD
// ═══════════════════════════════════════════════════════════════════

interface BottomCardProps {
  film:      FeedFilm;
  progress:  number;
  onFollow:  (fid: string) => void;
  insetBot:  number;
}

const BottomCard = memo(function BottomCard({
  film, progress, onFollow, insetBot,
}: BottomCardProps) {
  const [min, sec] = film.duration.split(':').map(Number);
  const totalSec   = (min || 0) * 60 + (sec || 0);
  const elapsed    = Math.floor(totalSec * Math.min(progress, 1));
  const elMin      = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const elSec      = String(elapsed % 60).padStart(2, '0');
  const clampedPct = Math.min(progress * 100, 100);
  const unfollowed = film.liked_by_friends.find(f => !f.followed);

  return (
    <View style={[bc.wrap, { bottom: insetBot + 88 }]}>
      {/* Caption */}
      <View style={bc.captionBlock}>
        {film.caption.split('\n').map((line, i) => (
          <Text key={i} style={bc.captionLine}>{line}</Text>
        ))}
      </View>

      {/* Info card */}
      <BlurView intensity={40} tint="dark" style={bc.blurCard}>
        <LinearGradient
          colors={['rgba(146,64,214,0.12)', 'rgba(7,0,15,0.10)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={bc.inner}>
          {/* Header row */}
          <View style={bc.topRow}>
            <View style={{ flex: 1 }}>
              <View style={bc.titleRow}>
                <Text style={bc.seriesName} numberOfLines={1}>{film.series}</Text>
                {film.verified && (
                  <Ionicons name="checkmark-circle" size={14} color={P.primL} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={bc.epLabel} numberOfLines={1}>
                Ép. {film.episode} · {film.episode_title}
              </Text>
            </View>

            <View style={bc.tagsRow}>
              {film.tags.slice(0, 2).map(tag => (
                <View key={tag} style={[bc.tag, tag === 'ORIGINAL' && bc.tagOriginal]}>
                  <Text style={[bc.tagTxt, tag === 'ORIGINAL' && bc.tagTxtOriginal]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Director + year */}
          <Text style={bc.directorTxt}>
            {film.director} · {film.year}
          </Text>

          {/* Progress bar interactive */}
          <View style={bc.progressTrack}>
            <View style={[bc.progressFill, { width: `${clampedPct}%` as any }]}>
              <View style={bc.progressGlow} />
            </View>
            <View style={[bc.progressThumb, { left: `${Math.min(clampedPct, 98)}%` as any }]} />
          </View>

          <View style={bc.timesRow}>
            <Text style={bc.timeText}>{elMin}:{elSec}</Text>
            <Text style={[bc.timeText, { color: P.t3 }]}>{film.duration}</Text>
          </View>

          {/* Friends row */}
          <View style={bc.friendsRow}>
            <View style={bc.avatarStack}>
              {film.liked_by_friends.slice(0, 3).map((f, i) => (
                <View key={f.id} style={[bc.friendAvWrap, { marginLeft: i > 0 ? -11 : 0, zIndex: 10 - i }]}>
                  <Image source={{ uri: f.avatar }} style={bc.friendAv} />
                  {f.followed && (
                    <View style={bc.followedDot} />
                  )}
                </View>
              ))}
              {film.liked_by_friends.length > 3 && (
                <View style={[bc.friendAvWrap, bc.extraCount, { marginLeft: -11 }]}>
                  <Text style={bc.extraCountTxt}>+{film.liked_by_friends.length - 3}</Text>
                </View>
              )}
            </View>

            {unfollowed ? (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onFollow(unfollowed.id);
                }}
                style={bc.followBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={13} color={P.primL} />
                <Text style={bc.followTxt}>{unfollowed.name.replace('@', '')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={bc.allFollowedBadge}>
                <Ionicons name="checkmark-circle" size={13} color={P.green} />
                <Text style={[bc.followTxt, { color: P.green }]}>Tous suivis</Text>
              </View>
            )}
          </View>

          {/* Comment */}
          {film.comment && (
            <View style={bc.commentRow}>
              <Ionicons name="chatbubble-outline" size={12} color={P.t3} />
              <Text style={bc.commentTxt} numberOfLines={1}>{film.comment}</Text>
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );
});

const bc = StyleSheet.create({
  wrap:          { position: 'absolute', left: 14, right: 14 },
  captionBlock:  { marginBottom: 12, paddingHorizontal: 4 },
  captionLine:   { color: 'rgba(255,255,255,0.92)', fontSize: 22, fontWeight: '800', lineHeight: 30, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  blurCard:      { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(146,64,214,0.32)' },
  inner:         { padding: 15, gap: 9 },
  topRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleRow:      { flexDirection: 'row', alignItems: 'center' },
  seriesName:    { color: P.t1, fontSize: 15, fontWeight: '900', letterSpacing: 0.1, flexShrink: 1 },
  epLabel:       { color: P.t2, fontSize: 12, marginTop: 2 },
  directorTxt:   { color: P.t3, fontSize: 11, fontWeight: '500' },
  tagsRow:       { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' },
  tag:           { backgroundColor: 'rgba(146,64,214,0.22)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: P.bord },
  tagOriginal:   { backgroundColor: 'rgba(192,96,255,0.22)', borderColor: P.primL },
  tagTxt:        { color: P.t2, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tagTxtOriginal:{ color: P.primL },
  progressTrack: { height: 3.5, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'visible' },
  progressFill:  { height: '100%', backgroundColor: P.primL, borderRadius: 2, position: 'relative', overflow: 'hidden' },
  progressGlow:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.30)' },
  progressThumb: { position: 'absolute', top: -5, marginLeft: -6, width: 13, height: 13, borderRadius: 7, backgroundColor: '#fff', borderWidth: 2.5, borderColor: P.primL, shadowColor: P.primL, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },
  timesRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  timeText:      { color: P.t2, fontSize: 11, fontWeight: '600' },
  friendsRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarStack:   { flexDirection: 'row', alignItems: 'center' },
  friendAvWrap:  { position: 'relative' },
  friendAv:      { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, borderColor: 'rgba(8,0,18,0.9)' },
  followedDot:   { position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: P.green, borderWidth: 1.5, borderColor: 'rgba(8,0,18,0.9)' },
  extraCount:    { width: 36, height: 36, borderRadius: 18, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(8,0,18,0.9)' },
  extraCountTxt: { color: P.t2, fontSize: 10, fontWeight: '800' },
  followBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(146,64,214,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: P.bord },
  allFollowedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.28)' },
  followTxt:     { color: P.t1, fontSize: 12, fontWeight: '700' },
  commentRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  commentTxt:    { color: P.t2, fontSize: 12, fontStyle: 'italic', flex: 1 },
});

// ═══════════════════════════════════════════════════════════════════
//  FEED ITEM — core du reel
//  Fix vidéo :
//    · source guard (empty string → null interprétable)
//    · statusChange initial shape allégée
//    · rendu VideoView conditionnel (near-active seulement)
//    · error state + bouton retry
//    · dimensions depuis props (mobile-first responsive)
// ═══════════════════════════════════════════════════════════════════

interface FeedItemProps {
  film:           FeedFilm;
  isActive:       boolean;
  isNear:         boolean;   // active ± 1 → on instancie le player
  screenFocused:  boolean;
  itemW:          number;
  itemH:          number;
  insetBot:       number;
  onFollowFriend: (fid: string) => void;
}

const FeedItem = memo(function FeedItem({
  film, isActive, isNear, screenFocused, itemW, itemH, insetBot, onFollowFriend,
}: FeedItemProps) {
  const router = useRouter();

  // ── expo-video : instancié seulement si near ──────────────────
  // Source vide → null pour éviter l'erreur « invalid source »
  const videoSource = (film.video_url && film.video_url.length > 0)
    ? film.video_url
    : null;

  const player = useVideoPlayer(isNear ? videoSource : null, (p) => {
    p.loop  = true;
    p.muted = false;
  });

  // ── Events expo-video ─────────────────────────────────────────
  // playingChange — shape : { isPlaying: boolean }
  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  // statusChange — shape : { status, oldStatus?, error? }
  const { status } = useEvent(player, 'statusChange', {
    status:    player.status,
    oldStatus: player.status,
    error:     undefined as (Error | undefined),
  });

  // timeUpdate — shape : { currentTime, bufferedPosition, ... }
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime:           player.currentTime,
    bufferedPosition:      0,
    currentLiveTimestamp:  null,
    currentOffsetFromLive: null,
  });

  // ── State local ────────────────────────────────────────────────
  const [liked,  setLiked]  = useState(false);
  const [muted,  setMuted]  = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [hasErr, setHasErr] = useState(false);

  const isReady   = status === 'readyToPlay';
  const isLoading = isNear && !!videoSource && !isReady && !hasErr;
  const duration  = player.duration ?? 0;
  const progress  = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  // ── Error watch ───────────────────────────────────────────────
  useEffect(() => {
    if (status === 'error') setHasErr(true);
    else if (status === 'readyToPlay') setHasErr(false);
  }, [status]);

  // ── Auto-play / pause ─────────────────────────────────────────
  useEffect(() => {
    if (!isNear || !player) return;
    if (isActive && screenFocused && isReady) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, screenFocused, isReady, isNear, player]);

  // ── Sync mute ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isNear) return;
    player.muted = muted;
  }, [muted, isNear, player]);

  // ── Double-tap ────────────────────────────────────────────────
  const lastTap    = useRef(0);
  const heartAnim  = useRef(new Animated.Value(0)).current;

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double-tap → like
      if (!liked) {
        setLiked(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 15 }),
        Animated.delay(500),
        Animated.timing(heartAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      // Simple-tap → toggle play/pause
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    }
    lastTap.current = now;
  }, [isPlaying, liked, heartAnim, player]);

  const heartScale = heartAnim.interpolate({
    inputRange:  [0, 0.4, 1],
    outputRange: [0, 1.3, 1],
  });
  const heartOpac = heartAnim.interpolate({
    inputRange:  [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  // ── Handlers mémoïsés ─────────────────────────────────────────
  const handleLike = useCallback(() => setLiked(p => !p), []);
  const handleMute = useCallback(() => setMuted(p => !p), []);
  const handleSave = useCallback(() => setSaved(p => !p), []);
  const handleInfo = useCallback(() => router.push(`/film/${film.id}`), [film.id, router]);

  // ── Retry ─────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setHasErr(false);
    player.replace(videoSource ?? '');
    player.play();
  }, [player, videoSource]);

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={{ width: itemW, height: itemH, backgroundColor: '#000' }}>

        {/* ── Poster / fallback ── */}
        <Image
          source={{ uri: film.poster_url }}
          style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
          resizeMode="cover"
        />

        {/* ── Skeleton loader ── */}
        {isLoading && (
          <View style={StyleSheet.absoluteFill}>
            <Shimmer width={itemW} height={itemH} />
          </View>
        )}

        {/* ── VideoView — uniquement si near et source valide ── */}
        {isNear && !!videoSource && !hasErr && (
          <VideoView
            player={player}
            style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
        )}

        {/* ── Erreur + retry ── */}
        {hasErr && (
          <View style={fi.errOverlay}>
            <Ionicons name="warning-outline" size={36} color={P.primL} />
            <Text style={fi.errTxt}>Impossible de charger la vidéo</Text>
            <TouchableOpacity style={fi.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color={P.t1} />
              <Text style={fi.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Gradient overlay cinématique ── */}
        <LinearGradient
          colors={[
            'rgba(7,0,15,0.10)',
            'transparent',
            'rgba(7,0,15,0.28)',
            'rgba(7,0,15,0.88)',
          ]}
          locations={[0, 0.28, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Teinture latérale violette */}
        <LinearGradient
          colors={['rgba(100,20,200,0.32)', 'transparent']}
          start={{ x: 0, y: 0.5 }} end={{ x: 0.40, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Cœur double-tap ── */}
        <Animated.View
          style={[fi.bigHeart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color="#EF4444" />
        </Animated.View>

        {/* ── Icône pause ── */}
        {!isPlaying && isReady && (
          <View style={fi.pauseIcon} pointerEvents="none">
            <BlurView intensity={20} tint="dark" style={fi.pauseBlur}>
              <Ionicons name="pause" size={32} color="rgba(255,255,255,0.90)" />
            </BlurView>
          </View>
        )}

        {/* ── Bouton mute floating en haut à droite ── */}
        <View style={[fi.muteFloating, { top: 56 }]} pointerEvents="box-none">
          {/* handled by RightBar */}
        </View>

        {/* ── Actions droite ── */}
        <RightBar
          film={film}
          liked={liked}
          muted={muted}
          saved={saved}
          onLike={handleLike}
          onMute={handleMute}
          onInfo={handleInfo}
          onSave={handleSave}
        />

        {/* ── Card épisode bas ── */}
        <BottomCard
          film={film}
          progress={progress}
          onFollow={onFollowFriend}
          insetBot={insetBot}
        />
      </View>
    </TouchableWithoutFeedback>
  );
});

const fi = StyleSheet.create({
  errOverlay:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,0,15,0.82)', gap: 14 },
  errTxt:      { color: P.t2, fontSize: 14, textAlign: 'center' },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryTxt:    { color: P.t1, fontSize: 14, fontWeight: '700' },
  bigHeart:    { position: 'absolute', top: '50%', left: '50%', marginTop: -50, marginLeft: -50 },
  pauseIcon:   { position: 'absolute', top: '50%', left: '50%', marginTop: -32, marginLeft: -32 },
  pauseBlur:   { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  muteFloating:{ position: 'absolute', right: 14 },
});

// ═══════════════════════════════════════════════════════════════════
//  GALAXY TAB BAR — responsive inset-aware
// ═══════════════════════════════════════════════════════════════════

interface GalaxyTabBarProps {
  active:   string;
  set:      (v: string) => void;
  insetBot: number;
}

const GalaxyTabBar = memo(function GalaxyTabBar({ active, set, insetBot }: GalaxyTabBarProps) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    return () => glowAnim.stopAnimation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [
    { key: 'accueil', label: 'Accueil', icon: 'home-outline'    as const },
    { key: 'reels',   label: 'Reels',   icon: 'play-circle'     as const },
    { key: 'spark',   label: 'Spark',   icon: 'sparkles-outline' as const },
    { key: 'amies',   label: 'Amies',   icon: 'people-outline'  as const },
    { key: 'profil',  label: 'Profil',  icon: 'person-circle'   as const },
  ] as const;

  return (
    <View style={[tb.wrap, { paddingBottom: Math.max(insetBot, 8) }]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={tb.borderTop}>
        <Animated.View style={[tb.borderGlow, { opacity: glowAnim }]} />
      </View>

      <View style={tb.row}>
        {TABS.map(item => {
          const on = active === item.key;
          const c  = on ? P.primL : 'rgba(240,232,255,0.36)';

          if (item.key === 'profil') return (
            <TouchableOpacity key={item.key} onPress={() => set(item.key)} style={tb.tab} activeOpacity={0.75}>
              <View style={[tb.avBox, on && tb.avBoxOn]}>
                <Image source={{ uri: 'https://i.pravatar.cc/50?img=11' }} style={{ width: '100%', height: '100%', borderRadius: on ? 10 : 13 }} />
              </View>
              <Text style={[tb.label, on && tb.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );

          return (
            <TouchableOpacity key={item.key} onPress={() => set(item.key)} style={tb.tab} activeOpacity={0.75}>
              <View style={[tb.iconBox, on && tb.iconBoxOn]}>
                {on && <Animated.View style={[StyleSheet.absoluteFill, tb.iconGlow, { opacity: glowAnim }]} />}
                <Ionicons name={item.icon} size={24} color={c} />
              </View>
              <Text style={[tb.label, on && tb.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const tb = StyleSheet.create({
  wrap:       { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  borderTop:  { height: 1, position: 'relative', overflow: 'hidden', backgroundColor: 'rgba(146,64,214,0.35)' },
  borderGlow: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: P.primL },
  row:        { flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingHorizontal: 4 },
  tab:        { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  iconBox:    { width: 42, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, position: 'relative', overflow: 'hidden' },
  iconBoxOn:  { backgroundColor: 'rgba(146,64,214,0.20)' },
  iconGlow:   { borderRadius: 11, backgroundColor: 'rgba(192,96,255,0.15)' },
  label:      { fontSize: 10, fontWeight: '600', color: 'rgba(240,232,255,0.36)' },
  labelOn:    { color: P.primL, fontWeight: '800' },
  avBox:      { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', backgroundColor: P.surface },
  avBoxOn:    { borderWidth: 2.5, borderColor: P.primL, borderRadius: 12 },
});

// ═══════════════════════════════════════════════════════════════════
//  MAIN — ReelsScreen
// ═══════════════════════════════════════════════════════════════════

export default function ReelsScreen() {
  const router  = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const insets  = useSafeAreaInsets();

  // ITEM_H = plein écran réel (inclus notch/barre de navigation)
  const ITEM_H = H;

  const [feedFilms,     setFeedFilms]     = useState<FeedFilm[]>(MOCK_FEED);
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [activeTab,     setActiveTab]     = useState('reels');
  const [screenFocused, setScreenFocused] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Pause globale en quittant l'écran ─────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ── Viewability : 70% visible pour déclencher l'item ──────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 });

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  // ── Follow friend ─────────────────────────────────────────────
  const handleFollowFriend = useCallback((fid: string) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeedFilms(prev => prev.map(film => ({
      ...film,
      liked_by_friends: film.liked_by_friends.map(f =>
        f.id === fid ? { ...f, followed: true } : f,
      ),
    })));
  }, []);

  // ── Render item ───────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: FeedFilm; index: number }) => (
    <FeedItem
      film={item}
      isActive={index === activeIndex}
      isNear={Math.abs(index - activeIndex) <= 1}   // ← player pool ± 1
      screenFocused={screenFocused}
      itemW={W}
      itemH={ITEM_H}
      insetBot={insets.bottom}
      onFollowFriend={handleFollowFriend}
    />
  ), [activeIndex, screenFocused, W, ITEM_H, insets.bottom, handleFollowFriend]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_H, offset: ITEM_H * index, index,
  }), [ITEM_H]);

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  return (
    <View style={sc.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Feed plein écran ── */}
      <FlatList
        data={feedFilms}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={getItemLayout}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        removeClippedSubviews
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        updateCellsBatchingPeriod={50}
        overScrollMode="never"
        bounces={false}
      />

      {/* ── Header flottant (SafeArea top) ── */}
      <SafeAreaView edges={['top']} style={sc.headerSafe} pointerEvents="box-none">
        <TopHeader feedKey={feedKey} onMenuPress={() => setMenuOpen(true)} scrollY={scrollY} />
      </SafeAreaView>

      {/* ── Tab bar avec inset bottom ── */}
      <GalaxyTabBar
        active={activeTab}
        set={setActiveTab}
        insetBot={insets.bottom}
      />

      {/* ── Sidebar Modal ── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <DropdownMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onSelect={setFeedKey}
          activeKey={feedKey}
        />
      </Modal>
    </View>
  );
}

const sc = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#000' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});