/**
 * app/profile.tsx — UNIVERSE · NO-AUTH EDITION
 *
 * Aucune authentification requise.
 * Les données personnelles (profil, reels, critiques, favoris) sont statiques.
 * Les œuvres "Recommandées" sont fetchées depuis la table publique `works`.
 *
 * Optimisations déploiement :
 *  – Zéro import auth (useAuth, supabase.auth…)
 *  – select('*') + PromiseLike<> pour éviter les erreurs TS PostgrestBuilder
 *  – memo / useMemo / useCallback sur tous les composants et calculs coûteux
 *  – Pas de realtime (inutile sans userId)
 *  – Tree-shaking : seuls les imports réellement utilisés
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Linking, Platform, Pressable,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Image }                     from 'expo-image';
import { LinearGradient }            from 'expo-linear-gradient';
import { BlurView }                  from 'expo-blur';
import { Ionicons }                  from '@expo/vector-icons';
import { useRouter }                 from 'expo-router';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { StatusBar }                 from 'expo-status-bar';

import GalaxyBackground              from '../../components/social/GalaxyBackground';
import { ImageWithFallback }         from '../../components/profile/ImageWithFallback';
import {
  EmptyState, HScrollRow, SectionHeader,
} from '../../components/profile/Section';
import {
  CARD_H, CARD_W, G,
  H_PADDING, NUM_ITEM_W, NUM_OVERLAP, NUM_W, CARD_GAP,
} from '../../components/profile/theme';
import { type ReviewItem }           from '../../components/profile/data';
import { supabase }                  from '@/lib/supabase';

let VideoThumbnails: any = null;
if (Platform.OS !== 'web') {
  try { VideoThumbnails = require('expo-video-thumbnails'); } catch {}
}

const LOGO = require('@/assets/images/logouniverse2.png');

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
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
  borderHi: 'rgba(255,255,255,0.22)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Work {
  id: number;
  title: string;
  category: string;
  genre: string;
  year: number;
  likes: number;
  comments: number | null;
  image: string | null;
  is_original: boolean;
  adjective: string | null;
  duration: number | null;
  description: string | null;
  director: string | null;
  cast_list: string[] | null;
}

interface UserReel {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string | null;
  genre: string | null;
  duration: number | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_category: string | null;
  likes_count: number;
  views_count: number;
  created_at: string;
}

interface ProfileData {
  display_name: string;
  username: string;
  bio: string;
  role: string;
  location: string;
  avatar_url: string;
  website: string;
  is_pro: boolean;
  is_industry_contact: boolean;
  specialties: string[];
  festivals: string[];
  open_to: string[];
  social_instagram: string;
  social_vimeo: string;
  social_youtube: string;
  social_imdb: string;
}

type GridTab = 0 | 1 | 2;

// ─────────────────────────────────────────────────────────────────────────────
// DONNÉES STATIQUES — remplacez par de vraies données ou un fetch auth
// ─────────────────────────────────────────────────────────────────────────────
const STATIC_PROFILE: ProfileData = {
  display_name:        'Hugo Chassaing',
  username:            'hugochassaing',
  bio:                 'Réalisateur de courts métrages. Passionné par le cinéma indépendant, les récits humains et les images qui persistent. Basé à Paris.',
  role:                'director',
  location:            'Paris, France',
  avatar_url:          '',
  website:             'https://hugochassaing.com',
  is_pro:              true,
  is_industry_contact: true,
  specialties:         ['Réalisation', 'Scénario', 'Photographie'],
  festivals:           ['Cannes Courts Métrages 2023', 'Clermont-Ferrand 2024'],
  open_to:             ['Collaborations', 'Co-production', 'Résidences'],
  social_instagram:    'https://instagram.com/hugochassaing',
  social_vimeo:        'https://vimeo.com/hugochassaing',
  social_youtube:      '',
  social_imdb:         '',
};

const STATIC_REELS: UserReel[] = [
  {
    id: 'reel-1', video_url: '', thumbnail_url: null,
    title: 'Ligne de fuite', genre: 'Drame',
    duration: 1440, status: 'approved',
    rejection_category: null, likes_count: 312, views_count: 2840,
    created_at: new Date(Date.now() - 86400 * 30 * 1000).toISOString(),
  },
  {
    id: 'reel-2', video_url: '', thumbnail_url: null,
    title: 'Corps étrangers', genre: 'Expérimental',
    duration: 720, status: 'approved',
    rejection_category: null, likes_count: 187, views_count: 1203,
    created_at: new Date(Date.now() - 86400 * 60 * 1000).toISOString(),
  },
  {
    id: 'reel-3', video_url: '', thumbnail_url: null,
    title: 'Nuit blanche', genre: 'Court métrage',
    duration: 2100, status: 'pending',
    rejection_category: null, likes_count: 0, views_count: 0,
    created_at: new Date(Date.now() - 86400 * 2 * 1000).toISOString(),
  },
];

const STATIC_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1', filmId: '1',
    content: 'Une mise en scène d\'une précision chirurgicale. Chaque plan raconte une histoire parallèle à celle des personnages. La lumière naturelle utilisée ici devient un acteur à part entière.',
    rating: 5, likes: 48,
    date: new Date(Date.now() - 86400 * 10 * 1000).toISOString(),
    film: { id: '1', title: 'Passage', posterUrl: 'https://picsum.photos/seed/film1/400/600', genre: 'Drame', type: 'film' },
  },
  {
    id: 'rev-2', filmId: '2',
    content: 'Le montage crée une tension narrative rare dans le cinéma indépendant contemporain. Quelques longueurs en second acte, mais la résolution compense amplement.',
    rating: 4, likes: 31,
    date: new Date(Date.now() - 86400 * 20 * 1000).toISOString(),
    film: { id: '2', title: 'L\'Arpenteur', posterUrl: 'https://picsum.photos/seed/film2/400/600', genre: 'Thriller', type: 'film' },
  },
  {
    id: 'rev-3', filmId: '3',
    content: 'Fassbinder s\'invite dans ce premier long-métrage sans jamais l\'écraser. Une voix singulière qui mérite d\'être suivie.',
    rating: 4, likes: 22,
    date: new Date(Date.now() - 86400 * 35 * 1000).toISOString(),
    film: { id: '3', title: 'Chambre noire', posterUrl: 'https://picsum.photos/seed/film3/400/600', genre: 'Drame', type: 'film' },
  },
];

// Œuvres favorites statiques (affichées dans l'onglet Films)
const STATIC_FAV_IDS = [1, 2, 3, 4, 5];   // IDs dans la table works
const STATIC_SEEN_IDS = [6, 7, 8, 9, 10]; // IDs dans la table works

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(id: number, image: string | null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/400/600`;
  } catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${n}`;
}

function fmtDuration(sec: number | null): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

function reelCategory(dur: number | null): 'courts' | 'moyens' | 'series' {
  if (!dur || dur <= 1800) return 'courts';
  if (dur <= 5400)          return 'moyens';
  return 'series';
}

function mapWork(row: any): Work {
  return {
    id: Number(row?.id) || 0,
    title: row?.title ?? '', category: row?.category ?? '',
    genre: row?.genre ?? '', year: Number(row?.year) || 0,
    likes: Number(row?.likes) || 0, comments: row?.comments ?? null,
    image: row?.image ?? null, is_original: row?.is_original ?? false,
    adjective: row?.adjective ?? null,
    duration: row?.duration != null ? Number(row.duration) : null,
    description: row?.description ?? null, director: row?.director ?? null,
    cast_list: Array.isArray(row?.cast_list) ? row.cast_list : null,
  };
}

const ROLE_LABELS: Record<string, string> = {
  director: 'Réalisateur·rice', producer: 'Producteur·rice',
  writer:   'Scénariste',       actor:    'Acteur·rice',
  dp:       'Dir. photo',       editor:   'Monteur·euse',
  critic:   'Critique',         creator:  'Créateur·rice',
  other:    'Cinéaste',
};

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHME — calculs sur données statiques
// ─────────────────────────────────────────────────────────────────────────────
function computeAura(
  reels: UserReel[], reviews: ReviewItem[],
  favCount: number, festivals: string[],
): number {
  const totalViews  = reels.reduce((s, r) => s + (r.views_count ?? 0), 0);
  const totalLikes  = reels.reduce((s, r) => s + (r.likes_count ?? 0), 0);
  const approved    = reels.filter(r => r.status === 'approved').length;
  const festBonus   = festivals.length * 20;
  const reviewLikes = reviews.reduce((s, r) => s + (r.likes ?? 0), 0);
  return Math.min(9999, Math.round(
    totalViews * 0.2 + totalLikes * 2.5 + approved * 40 +
    festBonus + reviewLikes * 2 + favCount * 6,
  ));
}

function creatorLevel(aura: number) {
  const levels = [
    { at: 0,    level: 1, label: 'Émergent'    },
    { at: 100,  level: 2, label: 'Indépendant' },
    { at: 500,  level: 3, label: 'Reconnu'     },
    { at: 1500, level: 4, label: 'Confirmé'    },
    { at: 4000, level: 5, label: 'Visionnaire' },
  ];
  const cur   = [...levels].reverse().find(l => aura >= l.at) ?? levels[0];
  const nxtI  = levels.findIndex(l => l.level === cur.level) + 1;
  const nxt   = levels[nxtI] ?? levels[levels.length - 1];
  const pct   = cur.level === 5 ? 1 : Math.min(1, (aura - cur.at) / (nxt.at - cur.at));
  return { level: cur.level, label: cur.label, nextAt: nxt.at, pct };
}

interface Achievement { icon: keyof typeof Ionicons.glyphMap; label: string }

function computeAchievements(
  reels: UserReel[], reviews: ReviewItem[],
  profile: ProfileData, favCount: number,
): Achievement[] {
  const list: Achievement[] = [];
  if (reels.length >= 1)
    list.push({ icon: 'film-outline',             label: 'Première création'    });
  if (reels.filter(r => r.status === 'approved').length >= 2)
    list.push({ icon: 'checkmark-circle-outline', label: '2 créas validées'     });
  if (profile.festivals.length >= 1)
    list.push({ icon: 'trophy-outline',            label: 'Sélection festival'   });
  if (reviews.length >= 3)
    list.push({ icon: 'create-outline',            label: '3 critiques publiées' });
  if (favCount >= 5)
    list.push({ icon: 'heart-outline',             label: '5 favoris'            });
  if (profile.is_pro)
    list.push({ icon: 'star-outline',              label: 'Membre PRO'           });
  if (profile.is_industry_contact)
    list.push({ icon: 'briefcase-outline',         label: 'Contact industrie'    });
  if (profile.specialties.length >= 3)
    list.push({ icon: 'layers-outline',            label: 'Multi-discipline'     });
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH PUBLIC — works table (lecture anonyme, pas d'auth requise)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWorksById(ids: number[]): Promise<Work[]> {
  if (!ids.length) return [];
  try {
    const { data, error } = await (supabase
      .from('works').select('*').in('id', ids) as any);
    if (error) throw error;
    return ((data ?? []) as any[]).map(mapWork);
  } catch (e) {
    if (__DEV__) console.warn('[profile] fetchWorksById:', e);
    return [];
  }
}

async function fetchRecommended(excludeIds: number[]): Promise<Work[]> {
  try {
    const { data, error } = await (supabase
      .from('works').select('*')
      .order('likes', { ascending: false })
      .limit(10) as any);
    if (error) throw error;
    return ((data ?? []) as any[])
      .map(mapWork)
      .filter(w => !excludeIds.includes(w.id));
  } catch (e) {
    if (__DEV__) console.warn('[profile] fetchRecommended:', e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 8 }: { w: number; h: number; r?: number }) {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.38, duration: 900, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.18, duration: 900, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [op]);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: C.navyMid, opacity: op }}/>;
});

const SkeletonSection = memo(function SkeletonSection() {
  return (
    <View>
      <View style={sk.header}>
        <View style={sk.iconBox}/>
        <View style={sk.titleBar}/>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: H_PADDING, gap: CARD_GAP }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', width: NUM_ITEM_W }}>
            <View style={sk.numCol}><View style={sk.ghostNum}/></View>
            <View style={[sk.ghostCard, { marginLeft: -NUM_OVERLAP }]}>
              <Shimmer w={CARD_W} h={CARD_H} r={12}/>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const sk = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: H_PADDING, paddingTop: 22, paddingBottom: 12 },
  iconBox:  { width: 26, height: 26, borderRadius: 9, backgroundColor: C.navyMid },
  titleBar: { height: 12, width: 120, borderRadius: 6, backgroundColor: C.navyMid },
  numCol:   { width: NUM_W, height: CARD_H, justifyContent: 'flex-start', paddingTop: 6 },
  ghostNum: { height: 68, width: 38, backgroundColor: C.faint, borderRadius: 6, alignSelf: 'flex-end' },
  ghostCard:{ borderRadius: 13, overflow: 'hidden' },
});

// ─────────────────────────────────────────────────────────────────────────────
// AURA DISPLAY
// ─────────────────────────────────────────────────────────────────────────────
const AuraDisplay = memo(function AuraDisplay({
  aura, level,
}: { aura: number; level: ReturnType<typeof creatorLevel> }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: level.pct, duration: 1100, useNativeDriver: false }).start();
  }, [level.pct, progress]);

  return (
    <View style={ad.wrap}>
      <View style={ad.row}>
        <View style={ad.scoreCircle}>
          <Text style={ad.scoreNum}>{fmtNumber(aura)}</Text>
          <Text style={ad.scoreLabel}>AURA</Text>
        </View>
        <View style={ad.right}>
          <View style={ad.levelRow}>
            <Ionicons name="layers-outline" size={12} color={C.mid}/>
            <Text style={ad.levelTxt}>Niveau {level.level}</Text>
            <View style={ad.levelChip}>
              <Text style={ad.levelChipTxt}>{level.label}</Text>
            </View>
          </View>
          <View style={ad.barTrack}>
            <Animated.View style={[ad.barFill, {
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]}/>
          </View>
          {level.level < 5 && (
            <Text style={ad.hint}>
              {fmtNumber(Math.max(0, level.nextAt - aura))} pts avant niveau {level.level + 1}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});

const ad = StyleSheet.create({
  wrap:        { marginHorizontal: H_PADDING, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow, padding: 16, marginBottom: 4 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navyMid },
  scoreNum:    { color: C.white, fontSize: 19, fontWeight: '900', letterSpacing: -0.8 },
  scoreLabel:  { color: C.muted, fontSize: 7, fontWeight: '800', letterSpacing: 2, marginTop: -2 },
  right:       { flex: 1, gap: 8 },
  levelRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  levelTxt:    { color: C.mid, fontSize: 11, fontWeight: '700' },
  levelChip:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyMid },
  levelChipTxt:{ color: C.offWhite, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  barTrack:    { height: 3, borderRadius: 2, backgroundColor: C.faint, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 2, backgroundColor: C.white },
  hint:        { color: C.muted, fontSize: 9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPACT STATS
// ─────────────────────────────────────────────────────────────────────────────
const ImpactStats = memo(function ImpactStats({
  reels, reviews, favCount,
}: { reels: UserReel[]; reviews: ReviewItem[]; favCount: number }) {
  const totalViews  = useMemo(() => reels.reduce((s, r) => s + r.views_count, 0), [reels]);
  const totalLikes  = useMemo(() => reels.reduce((s, r) => s + r.likes_count, 0), [reels]);
  const approvedCnt = useMemo(() => reels.filter(r => r.status === 'approved').length, [reels]);

  const stats = useMemo<Array<{ icon: keyof typeof Ionicons.glyphMap; val: string; label: string }>>(() => [
    { icon: 'eye-outline',    val: fmtNumber(totalViews),  label: 'vues'      },
    { icon: 'heart-outline',  val: fmtNumber(totalLikes),  label: 'likes'     },
    { icon: 'film-outline',   val: String(approvedCnt),    label: 'validées'  },
    { icon: 'create-outline', val: String(reviews.length), label: 'critiques' },
    { icon: 'star-outline',   val: String(favCount),       label: 'favoris'   },
  ], [totalViews, totalLikes, approvedCnt, reviews.length, favCount]);

  return (
    <View style={imp.wrap}>
      <View style={imp.header}>
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
  wrap:  { marginHorizontal: H_PADDING, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow, padding: 16, gap: 14 },
  header:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  grid:  { flexDirection: 'row', justifyContent: 'space-between' },
  cell:  { alignItems: 'center', gap: 3, flex: 1 },
  val:   { color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: -0.4 },
  label: { color: C.muted, fontSize: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────────────────────
const AchievementsRow = memo(function AchievementsRow({ achievements }: { achievements: Achievement[] }) {
  if (!achievements.length) return null;
  return (
    <View style={ar.wrap}>
      <View style={ar.header}>
        <Ionicons name="ribbon-outline" size={13} color={C.mid}/>
        <Text style={ar.title}>Distinctions</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={ar.row}>
        {achievements.map((a, i) => (
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
  wrap:     { gap: 10 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: H_PADDING },
  title:    { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  row:      { gap: 8, paddingHorizontal: H_PADDING, paddingVertical: 2 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow },
  chipLabel:{ color: C.offWhite, fontSize: 11, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────
const PortraitCard = memo(function PortraitCard({ item, rank }: { item: Work; rank?: number }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={{ marginRight: 12 }}
      onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{ uri }} style={pc.img} contentFit="cover"/>
        <LinearGradient colors={['transparent', 'rgba(7,12,23,0.92)']}
          style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }}/>
        <View style={pc.badge}>
          <Text style={pc.badgeTxt}>
            {item.is_original ? 'ORIG' : (item.category ?? '').slice(0, 4).toUpperCase()}
          </Text>
        </View>
        {rank != null && <Text style={pc.rankNum}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={pc.stat}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
            {item.year > 0 && <><View style={pc.dot}/><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const pc = StyleSheet.create({
  card:    { width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', backgroundColor: C.navyMid },
  img:     { width: '100%' as any, height: '100%' as any },
  badge:   { position: 'absolute', top: 7, left: 7, paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 5, backgroundColor: 'rgba(7,12,23,0.72)' },
  badgeTxt:{ color: C.mid, fontSize: 7, fontWeight: '800', letterSpacing: 0.4 },
  rankNum: { position: 'absolute', bottom: 32, right: 6, fontSize: 52, fontWeight: '900', lineHeight: 52, letterSpacing: -4, color: 'rgba(255,255,255,0.10)' },
  meta:    { position: 'absolute', bottom: 8, left: 8, right: 8, gap: 3 },
  title:   { color: C.white, fontSize: 11, fontWeight: '700', lineHeight: 14 },
  stat:    { color: C.muted, fontSize: 9, fontWeight: '600' },
  dot:     { width: 2, height: 2, borderRadius: 1, backgroundColor: C.subtle },
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO REEL CARD
// ─────────────────────────────────────────────────────────────────────────────
const REEL_W = 162, REEL_H = 225;

const STATUS_CFG: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  pending:  { icon: 'time-outline',             label: 'En attente' },
  approved: { icon: 'checkmark-circle-outline', label: 'Validée'    },
  rejected: { icon: 'close-circle-outline',     label: 'Refusée'    },
};

function useVideoThumbnail(videoUrl: string, thumbnailUrl: string | null): string | null {
  const [uri, setUri] = useState<string | null>(thumbnailUrl ?? null);
  useEffect(() => {
    if (thumbnailUrl || !videoUrl || !VideoThumbnails) return;
    let active = true;
    VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1500, quality: 0.65 })
      .then(({ uri: u }: { uri: string }) => { if (active) setUri(u); })
      .catch(() => {});
    return () => { active = false; };
  }, [videoUrl, thumbnailUrl]);
  return uri;
}

const VideoReelCard = memo(function VideoReelCard({ reel }: { reel: UserReel }) {
  const router = useRouter();
  const thumb  = useVideoThumbnail(reel.video_url, reel.thumbnail_url);
  const cfg    = STATUS_CFG[reel.status] ?? STATUS_CFG.pending;
  const [imgErr, setImgErr] = useState(false);

  return (
    <TouchableOpacity style={{ marginRight: 12 }}
      onPress={() => router.push({ pathname: '/reel/[id]', params: { id: reel.id } } as any)}
      activeOpacity={0.88}>
      <View style={vrc.card}>
        {thumb && !imgErr ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject}
            contentFit="cover" onError={() => setImgErr(true)}/>
        ) : (
          <View style={vrc.placeholder}>
            <LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject}/>
            <Ionicons name="film-outline" size={28} color={C.subtle}/>
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(7,12,23,0.96)']}
          style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }}/>
        <View style={vrc.playWrap} pointerEvents="none">
          <Ionicons name="play-circle-outline" size={28} color={C.mid}/>
        </View>
        <View style={vrc.statusBadge}>
          <Ionicons name={cfg.icon} size={9} color={C.mid}/>
          <Text style={vrc.statusTxt}>{cfg.label}</Text>
        </View>
        {reel.duration != null && (
          <View style={vrc.durBadge}>
            <Ionicons name="time-outline" size={8} color={C.muted}/>
            <Text style={vrc.durTxt}>{fmtDuration(reel.duration) || '—'}</Text>
          </View>
        )}
        <View style={vrc.meta}>
          <Text style={vrc.title} numberOfLines={2}>{reel.title || 'Sans titre'}</Text>
          {reel.genre && <Text style={vrc.genre}>{reel.genre}</Text>}
          <View style={vrc.stats}>
            <View style={vrc.stat}>
              <Ionicons name="eye-outline" size={9} color={C.muted}/>
              <Text style={vrc.statTxt}>{fmtNumber(reel.views_count)}</Text>
            </View>
            <View style={vrc.stat}>
              <Ionicons name="heart-outline" size={9} color={C.muted}/>
              <Text style={vrc.statTxt}>{fmtNumber(reel.likes_count)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const vrc = StyleSheet.create({
  card:       { width: REEL_W, height: REEL_H, borderRadius: 14, overflow: 'hidden', backgroundColor: C.navyMid },
  placeholder:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  playWrap:   { position: 'absolute', top: '40%', alignSelf: 'center', marginTop: -14 },
  statusBadge:{ position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(7,12,23,0.72)' },
  statusTxt:  { color: C.muted, fontSize: 8, fontWeight: '700' },
  durBadge:   { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(7,12,23,0.72)' },
  durTxt:     { color: C.muted, fontSize: 8, fontWeight: '700' },
  meta:       { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 11, gap: 3 },
  title:      { color: C.white, fontSize: 11, fontWeight: '800', lineHeight: 14 },
  genre:      { color: C.muted, fontSize: 9 },
  stats:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  stat:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt:    { color: C.muted, fontSize: 9, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITIQUE CARD
// ─────────────────────────────────────────────────────────────────────────────
const STAR_POS = [
  { t: 8,  l: 18,  op: 0.30, r: 1.5 }, { t: 14, l: 88,  op: 0.18, r: 1.0 },
  { t: 22, l: 155, op: 0.32, r: 1.8 }, { t: 38, l: 42,  op: 0.14, r: 0.8 },
  { t: 48, l: 190, op: 0.22, r: 1.2 }, { t: 58, l: 72,  op: 0.25, r: 1.4 },
  { t: 70, l: 130, op: 0.16, r: 0.8 }, { t: 80, l: 8,   op: 0.20, r: 1.0 },
  { t: 92, l: 200, op: 0.28, r: 1.5 },
];

const CritiqueCard = memo(function CritiqueCard({
  review, rank, onPress,
}: { review: ReviewItem; rank: number; onPress: () => void }) {
  const stars = Math.round(review.rating ?? 0);
  return (
    <TouchableOpacity style={{ marginRight: 12 }} onPress={onPress} activeOpacity={0.88}>
      <View style={cc.card}>
        <LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}/>
        {STAR_POS.map((s, i) => (
          <View key={i} style={[cc.star, { top: s.t, left: s.l, opacity: s.op, width: s.r, height: s.r, borderRadius: s.r / 2 }]}/>
        ))}
        <Image source={LOGO} style={cc.logo} contentFit="contain"/>
        <View style={cc.badge}><Text style={cc.badgeTxt}>#{rank}</Text></View>
        <View style={cc.body}>
          <Text style={cc.filmTitle} numberOfLines={1}>{review.film?.title ?? '—'}</Text>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <Ionicons key={s} name={s <= stars ? 'star' : 'star-outline'} size={10}
                color={s <= stars ? C.offWhite : C.subtle}/>
            ))}
          </View>
          <Text style={cc.excerpt} numberOfLines={3}>{review.content || 'Aucun contenu'}</Text>
        </View>
        <View style={cc.border} pointerEvents="none"/>
      </View>
    </TouchableOpacity>
  );
});

const cc = StyleSheet.create({
  card:     { width: 220, height: 148, borderRadius: 16, overflow: 'hidden' },
  star:     { position: 'absolute', backgroundColor: C.white },
  logo:     { position: 'absolute', right: 8, bottom: 8, width: 44, height: 44, opacity: 0.06 },
  badge:    { position: 'absolute', top: 10, left: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: C.navyMid },
  badgeTxt: { color: C.mid, fontSize: 9, fontWeight: '800' },
  body:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, gap: 4 },
  filmTitle:{ color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  excerpt:  { color: C.muted, fontSize: 10, lineHeight: 14 },
  border:   { ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE HEADER
// ─────────────────────────────────────────────────────────────────────────────
const ProfileHeader = memo(function ProfileHeader({
  profile, filmCount, critiqueCount, reelCount, level, onEdit,
}: {
  profile: ProfileData; filmCount: number; critiqueCount: number;
  reelCount: number; level: ReturnType<typeof creatorLevel>; onEdit: () => void;
}) {
  const [bioExpanded, setBioExpanded] = useState(false);

  const socialLinks = useMemo(() => [
    { key: 'instagram', icon: 'logo-instagram'   as any, url: profile.social_instagram, label: 'Instagram' },
    { key: 'vimeo',     icon: 'videocam-outline' as any, url: profile.social_vimeo,     label: 'Vimeo'     },
    { key: 'youtube',   icon: 'logo-youtube'     as any, url: profile.social_youtube,   label: 'YouTube'   },
    { key: 'imdb',      icon: 'film-outline'     as any, url: profile.social_imdb,      label: 'IMDb'      },
    { key: 'website',   icon: 'globe-outline'    as any, url: profile.website,          label: 'Portfolio' },
  ].filter(l => !!l.url), [profile]);

  const avatarUri = profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.username}`;

  return (
    <View style={hdr.wrap}>
      <View style={hdr.topRow}>
        <View style={hdr.avatarWrap}>
          <ImageWithFallback uri={avatarUri} style={hdr.avatar} fallbackColors={[C.navyMid, C.navyLow]}/>
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
            { val: fmtNumber(filmCount),     label: 'films'     },
            { val: fmtNumber(critiqueCount), label: 'critiques' },
            { val: fmtNumber(reelCount),     label: 'créas'     },
          ].map(({ val, label }, i, arr) => (
            <React.Fragment key={label}>
              <View style={hdr.statItem}>
                <Text style={hdr.statVal}>{val}</Text>
                <Text style={hdr.statLabel}>{label}</Text>
              </View>
              {i < arr.length - 1 && <View style={hdr.statDiv}/>}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={hdr.nameRow}>
        <Text style={hdr.displayName}>{profile.display_name || profile.username || 'Cinéaste'}</Text>
        {profile.is_pro && <View style={hdr.proChip}><Text style={hdr.proChipTxt}>PRO</Text></View>}
      </View>

      <Text style={hdr.roleLabel}>
        {ROLE_LABELS[profile.role] ?? 'Créateur·rice'}
        {profile.location ? ` · ${profile.location}` : ''}
        {` · ${level.label}`}
      </Text>

      {!!profile.bio && (
        <Pressable onPress={() => setBioExpanded(e => !e)} style={hdr.bioWrap}>
          <Text style={hdr.bioTxt} numberOfLines={bioExpanded ? undefined : 3}>{profile.bio}</Text>
          {profile.bio.length > 120 && (
            <Text style={hdr.bioMore}>{bioExpanded ? 'Voir moins' : 'Voir plus'}</Text>
          )}
        </Pressable>
      )}

      <TouchableOpacity style={hdr.editBtn} onPress={onEdit} activeOpacity={0.80}>
        <Ionicons name="create-outline" size={13} color={C.mid}/>
        <Text style={hdr.editTxt}>Modifier le profil</Text>
      </TouchableOpacity>

      {profile.specialties.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={hdr.chipRow} style={{ marginTop: 12 }}>
          {profile.specialties.map(s => (
            <View key={s} style={hdr.chip}><Text style={hdr.chipTxt}>{s}</Text></View>
          ))}
        </ScrollView>
      )}

      {profile.festivals.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[hdr.chipRow, { marginTop: 8 }]}>
          {profile.festivals.map(f => (
            <View key={f} style={hdr.festChip}>
              <Ionicons name="trophy-outline" size={9} color={C.mid}/>
              <Text style={hdr.festTxt}>{f}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {socialLinks.length > 0 && (
        <View style={hdr.socialRow}>
          {socialLinks.map(l => (
            <TouchableOpacity key={l.key} style={hdr.socialBtn}
              onPress={() => Linking.openURL(l.url!).catch(() => {})} activeOpacity={0.78}>
              <BlurView intensity={Platform.OS === 'ios' ? 14 : 8} tint="dark" style={StyleSheet.absoluteFillObject}/>
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
  wrap:         { paddingHorizontal: H_PADDING },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  avatarWrap:   { position: 'relative' },
  avatar:       { width: 82, height: 82, borderRadius: 41, borderWidth: 1.5, borderColor: C.border },
  levelBadge:   { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.navyMid, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  levelBadgeTxt:{ color: C.white, fontSize: 8, fontWeight: '900' },
  proBadge:     { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: C.navyMid, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  statsRow:     { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem:     { alignItems: 'center', gap: 2 },
  statVal:      { color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:    { color: C.muted, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDiv:      { width: 1, height: 30, backgroundColor: C.faint },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  displayName:  { color: C.white, fontSize: 17, fontWeight: '900', letterSpacing: -0.3, flexShrink: 1 },
  proChip:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyMid },
  proChipTxt:   { color: C.offWhite, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  roleLabel:    { color: C.muted, fontSize: 12, marginTop: 3 },
  bioWrap:      { marginTop: 10, gap: 3 },
  bioTxt:       { color: C.mid, fontSize: 13, lineHeight: 19 },
  bioMore:      { color: C.offWhite, fontSize: 12, fontWeight: '600', marginTop: 2 },
  editBtn:      { marginTop: 14, borderRadius: 11, backgroundColor: C.navyLow, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  editTxt:      { color: C.mid, fontSize: 12, fontWeight: '700' },
  chipRow:      { gap: 7, paddingVertical: 2 },
  chip:         { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow },
  chipTxt:      { color: C.offWhite, fontSize: 11, fontWeight: '600' },
  festChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.navyLow },
  festTxt:      { color: C.mid, fontSize: 10, fontWeight: '600' },
  socialRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  socialBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  socialLabel:  { color: C.offWhite, fontSize: 11, fontWeight: '600' },
  sep:          { height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginTop: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP NAV
// ─────────────────────────────────────────────────────────────────────────────
const TopNav = memo(function TopNav({ name }: { name: string }) {
  const router = useRouter();
  return (
    <View style={nav.wrap}>
      <View style={nav.left}>
        <Ionicons name="person-circle-outline" size={14} color={C.muted}/>
        <Text style={nav.username}>{name}</Text>
      </View>
      <View style={nav.right}>
        <TouchableOpacity style={nav.iconBtn}
          onPress={() => router.push('/notifications' as any)} activeOpacity={0.75}>
          <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={nav.iconBg}/>
          <Ionicons name="notifications-outline" size={16} color={C.offWhite}/>
        </TouchableOpacity>
        <TouchableOpacity style={nav.iconBtn}
          onPress={() => router.push('/settings')} activeOpacity={0.75}>
          <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={nav.iconBg}/>
          <Ionicons name="settings-outline" size={16} color={C.offWhite}/>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const nav = StyleSheet.create({
  wrap:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: H_PADDING, paddingTop: 8, paddingBottom: 4 },
  left:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  username:{ color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  right:  { flexDirection: 'row', gap: 8 },
  iconBtn:{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  iconBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ SCREEN ★★★
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();

  // ── Données statiques ────────────────────────────────────────────────────
  const profile  = STATIC_PROFILE;
  const reels    = STATIC_REELS;
  const reviews  = useMemo(
    () => [...STATIC_REVIEWS].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)),
    [],
  );

  // ── Données fetchées sans auth (table works, lecture publique) ──────────
  const [favWorks,   setFavWorks]   = useState<Work[]>([]);
  const [watchedWorks,setWatched]   = useState<Work[]>([]);
  const [recommended, setRecommended] = useState<Work[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<GridTab>(0);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    Promise.all([
      fetchWorksById(STATIC_FAV_IDS),
      fetchWorksById(STATIC_SEEN_IDS),
      fetchRecommended([...STATIC_FAV_IDS, ...STATIC_SEEN_IDS]),
    ]).then(([favs, seen, recs]) => {
      if (dead) return;
      setFavWorks(favs);
      setWatched(seen);
      setRecommended(recs);
      setLoading(false);
    }).catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, []);

  // ── Algorithme ───────────────────────────────────────────────────────────
  const aura    = useMemo(() =>
    computeAura(reels, reviews, favWorks.length, profile.festivals),
    [reels, reviews, favWorks.length, profile.festivals],
  );
  const level   = useMemo(() => creatorLevel(aura), [aura]);
  const achieves = useMemo(() =>
    computeAchievements(reels, reviews, profile, favWorks.length),
    [reels, reviews, profile, favWorks.length],
  );

  const reelsByCategory = useMemo(() => {
    const courts: UserReel[] = [], moyens: UserReel[] = [], series: UserReel[] = [];
    reels.forEach(r => {
      const c = reelCategory(r.duration);
      if (c === 'courts') courts.push(r);
      else if (c === 'moyens') moyens.push(r);
      else series.push(r);
    });
    return { courts, moyens, series };
  }, [reels]);

  // ── Renders par tab ──────────────────────────────────────────────────────
  const renderFilms = useCallback(() => {
    if (loading) return (
      <View><SkeletonSection/><SkeletonSection/><SkeletonSection/></View>
    );
    return (
      <View>
        <SectionHeader icon="heart-outline" label="Œuvres favorites"
          subtitle="Vos œuvres sauvegardées" count={favWorks.length} accentColor={C.white}
          onViewAll={() => router.push('/profile/favorites' as any)}/>
        {favWorks.length === 0
          ? <EmptyState icon="heart-outline" text="Aucun favori"/>
          : <HScrollRow>{favWorks.map((f, i) => <PortraitCard key={f.id} item={f} rank={i + 1}/>)}</HScrollRow>}
        <View style={pg.div}/>

        <SectionHeader icon="create-outline" label="Mes critiques"
          subtitle="Classées par popularité" accentColor={C.white}
          onViewAll={() => router.push('/profile/reviews' as any)}/>
        {reviews.length === 0
          ? <EmptyState icon="chatbubble-outline" text="Aucune critique publiée"/>
          : <HScrollRow>{reviews.map((r, i) => (
              <CritiqueCard key={r.id} review={r} rank={i + 1}
                onPress={() => router.push(`/review/${r.id}` as any)}/>
            ))}</HScrollRow>}
        <View style={pg.div}/>

        <SectionHeader icon="eye-outline" label="Œuvres visionnées"
          subtitle="Votre historique" accentColor={C.white}
          onViewAll={() => router.push('/profile/seen_films' as any)}/>
        {watchedWorks.length === 0
          ? <EmptyState icon="film-outline" text="Aucun visionnage"/>
          : <HScrollRow>{watchedWorks.map((f, i) => <PortraitCard key={f.id} item={f} rank={i + 1}/>)}</HScrollRow>}
        <View style={pg.div}/>

        <SectionHeader icon="shuffle-outline" label="Recommandés"
          subtitle="Basé sur vos goûts" accentColor={C.white}/>
        {recommended.length === 0
          ? <EmptyState icon="planet-outline" text="Aucune recommandation"/>
          : <HScrollRow>{recommended.map(f => <PortraitCard key={f.id} item={f}/>)}</HScrollRow>}
        <View style={{ height: 110 }}/>
      </View>
    );
  }, [loading, favWorks, reviews, watchedWorks, recommended, router]);

  const renderCreations = useCallback(() => {
    if (loading) return <View><SkeletonSection/><View style={{ height: 80 }}/></View>;

    const approved = reels.filter(r => r.status === 'approved').length;
    const pending  = reels.filter(r => r.status === 'pending').length;
    const totalV   = reels.reduce((s, r) => s + r.views_count, 0);
    const totalL   = reels.reduce((s, r) => s + r.likes_count, 0);
    const allNull  = reels.every(r => r.duration == null);

    const sections = allNull
      ? [{ key: 'all', label: 'Mes vidéos', icon: 'videocam-outline' as const, subtitle: 'Toutes vos créations', data: reels }]
      : [
          { key: 'courts', label: 'Courts métrages', icon: 'videocam-outline' as const, subtitle: '≤ 30 min',  data: reelsByCategory.courts },
          { key: 'moyens', label: 'Moyens métrages', icon: 'tv-outline'        as const, subtitle: '30–90 min', data: reelsByCategory.moyens },
          { key: 'series', label: 'Mini-séries',     icon: 'film-outline'      as const, subtitle: '> 90 min',  data: reelsByCategory.series },
        ].filter(s => s.data.length > 0);

    return (
      <View>
        <View style={pg.reelStats}>
          {[
            { icon: 'film-outline'             as const, v: String(reels.length), l: 'vidéos'     },
            { icon: 'checkmark-circle-outline' as const, v: String(approved),     l: 'validées'   },
            { icon: 'time-outline'             as const, v: String(pending),      l: 'en attente' },
            { icon: 'eye-outline'              as const, v: fmtNumber(totalV),    l: 'vues'       },
            { icon: 'heart-outline'            as const, v: fmtNumber(totalL),    l: 'likes'      },
          ].map(({ icon, v, l }, i, arr) => (
            <React.Fragment key={l}>
              <View style={pg.reelStat}>
                <Ionicons name={icon} size={12} color={C.muted}/>
                <Text style={pg.reelStatV}>{v}</Text>
                <Text style={pg.reelStatL}>{l}</Text>
              </View>
              {i < arr.length - 1 && <View style={pg.reelStatDiv}/>}
            </React.Fragment>
          ))}
        </View>

        {sections.map((s, si) => (
          <View key={s.key}>
            <SectionHeader icon={s.icon} label={s.label} subtitle={s.subtitle} accentColor={C.white}/>
            <HScrollRow paddingBottom={8}>{s.data.map(r => <VideoReelCard key={r.id} reel={r}/>)}</HScrollRow>
            {si < sections.length - 1 && <View style={pg.div}/>}
          </View>
        ))}
        <View style={{ height: 110 }}/>
      </View>
    );
  }, [loading, reels, reelsByCategory]);

  const renderTags = useCallback(() => (
    <View style={{ paddingTop: 60 }}>
      <EmptyState icon="pricetag-outline" text="Disponible après connexion"
        subtext="Les œuvres où vous êtes crédité·e apparaîtront ici une fois authentifié·e."/>
      <View style={{ height: 110 }}/>
    </View>
  ), []);

  const tabs = [
    { icon: 'grid-outline'        as const, label: 'Films'     },
    { icon: 'play-circle-outline' as const, label: 'Créations' },
    { icon: 'pricetag-outline'    as const, label: 'Tags'      },
  ];

  return (
    <View style={pg.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <Animated.ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(7,12,23,0.60)', 'transparent']}
            style={pg.topGrad} pointerEvents="none"/>
          <TopNav name={profile.display_name || 'Profil'}/>
          <ProfileHeader
            profile={profile}
            filmCount={watchedWorks.length}
            critiqueCount={reviews.length}
            reelCount={reels.length}
            level={level}
            onEdit={() => router.push('/edit' as any)}
          />
        </SafeAreaView>

        {/* Aura */}
        <View style={{ marginTop: 16, marginBottom: 12 }}>
          <AuraDisplay aura={aura} level={level}/>
        </View>

        {/* Impact */}
        <View style={{ marginBottom: 16 }}>
          <ImpactStats reels={reels} reviews={reviews} favCount={favWorks.length}/>
        </View>

        {/* Achievements */}
        {achieves.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <AchievementsRow achievements={achieves}/>
          </View>
        )}

        {/* Tab bar */}
        <View style={pg.tabBar}>
          {tabs.map(({ icon, label }, idx) => {
            const active = activeTab === idx;
            return (
              <TouchableOpacity key={icon} style={pg.tabItem}
                onPress={() => setActiveTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons
                  name={active ? (icon.replace('-outline', '') as any) : icon}
                  size={18} color={active ? C.white : C.muted}
                />
                <Text style={[pg.tabLabel, active && pg.tabLabelOn]}>{label}</Text>
                {active && <View style={pg.tabIndicator}/>}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 0 && renderFilms()}
        {activeTab === 1 && renderCreations()}
        {activeTab === 2 && renderTags()}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  topGrad:     { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  div:         { height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginTop: 24 },
  tabBar:      { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: 16 },
  tabItem:     { flex: 1, alignItems: 'center', paddingVertical: 11, gap: 3, position: 'relative' },
  tabLabel:    { fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  tabLabelOn:  { color: C.white },
  tabIndicator:{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: C.white, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  reelStats:   { flexDirection: 'row', paddingHorizontal: H_PADDING, paddingVertical: 16, marginBottom: 4 },
  reelStat:    { flex: 1, alignItems: 'center', gap: 3 },
  reelStatV:   { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  reelStatL:   { color: C.muted, fontSize: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  reelStatDiv: { width: 1, backgroundColor: C.faint, marginHorizontal: 6 },
});