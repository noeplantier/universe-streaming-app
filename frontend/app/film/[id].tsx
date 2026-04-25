// app/film/[id].tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'une œuvre de cinéma indépendant
//  • source=works  → table public.works  (cards depuis search.tsx)
//  • source=films  → table public.films  (cards depuis profile.tsx)
//  • Fallback automatique : works → films → community_posts_enriched
//  UX identique à /reel/[id].tsx — GalaxyBackground × C.navyMid
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, Platform,
  Animated, Easing, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — 60 % navyMid · 30 % blanc · 10 % bleu + or
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:          '#020810',
  navyDeep:    '#060F1E',
  navyMid:     '#0D2240',
  navyLight:   '#163356',
  navyBright:  '#1E4A7A',
  surf:        'rgba(13,34,64,0.60)',
  surfHi:      'rgba(13,34,64,0.85)',
  border:      'rgba(255,255,255,0.07)',
  borderHi:    'rgba(255,255,255,0.15)',
  borderBlue:  'rgba(90,150,230,0.22)',
  white:       '#FFFFFF',
  text:        '#EEF4FF',
  textSec:     '#7A99BE',
  textTert:    '#2E4A68',
  blue:        '#5A96E6',
  blueDim:     'rgba(90,150,230,0.14)',
  blueSoft:    'rgba(90,150,230,0.07)',
  gold:        '#F5C842',
  goldDim:     'rgba(245,200,66,0.12)',
  red:         '#FF3B5C',
  green:       '#2ECC8A',
  greenDim:    'rgba(46,204,138,0.12)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISED WORK — union des deux tables
// ─────────────────────────────────────────────────────────────────────────────
interface NormWork {
  id:          string | number;
  title:       string;
  description: string | null;
  image:       string | null;
  category:    string;
  is_original: boolean;
  likes:       number;
  comments:    number | null;
  duration:    number | null;    // minutes
  year:        string | number | null;
  director:    string | null;
  genre:       string | null;
  rating:      number | null;
  adjective:   string | null;
  cast_list:   string[];
  tags:        string[];
  source:      'works' | 'films' | 'posts';
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID guard
// ─────────────────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID  = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const isNumId = (v: unknown): boolean =>
  (typeof v === 'string' && /^\d+$/.test(v)) || typeof v === 'number';

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────
function fromWorks(r: Record<string, any>): NormWork {
  return {
    id:          r.id,
    title:       r.title        ?? '—',
    description: r.description  ?? r.synopsis ?? null,
    image:       r.image        ?? r.poster_url ?? null,
    category:    r.category     ?? 'Film',
    is_original: !!r.is_original,
    likes:       r.likes        ?? 0,
    comments:    r.comments     ?? null,
    duration:    r.duration     ?? null,
    year:        r.year         ?? null,
    director:    r.director     ?? null,
    genre:       r.genre        ?? null,
    rating:      r.rating       ?? null,
    adjective:   r.adjective    ?? null,
    cast_list:   Array.isArray(r.cast_list) ? r.cast_list : [],
    tags:        Array.isArray(r.tags) ? r.tags : [],
    source:      'works',
  };
}

function fromFilms(r: Record<string, any>): NormWork {
  return {
    id:          r.id,
    title:       r.title        ?? r.name ?? '—',
    description: r.description  ?? r.synopsis ?? r.overview ?? null,
    image:       r.poster_url   ?? r.image ?? r.backdrop_url ?? null,
    category:    r.type         ?? r.category ?? 'Film',
    is_original: !!r.is_original,
    likes:       r.likes_count  ?? r.likes ?? 0,
    comments:    r.comments_count ?? r.comments ?? null,
    duration:    r.duration     ?? r.runtime ?? null,
    year:        r.year         ?? r.release_year ?? null,
    director:    r.director     ?? null,
    genre:       r.genre        ?? null,
    rating:      r.rating       ?? r.score ?? null,
    adjective:   r.adjective    ?? r.tagline ?? null,
    cast_list:   Array.isArray(r.cast_list) ? r.cast_list : [],
    tags:        Array.isArray(r.tags) ? r.tags : [],
    source:      'films',
  };
}

function fromPosts(r: Record<string, any>): NormWork {
  return {
    id:          r.id,
    title:       r.film_title ?? r.work_title ?? r.title ?? '—',
    description: r.body ?? r.content ?? null,
    image:       r.film_poster ?? r.image_url ?? null,
    category:    r.film_genre ?? r.work_genre ?? 'Film',
    is_original: false,
    likes:       r.likes ?? r.likes_count ?? 0,
    comments:    r.comments_count ?? null,
    duration:    null,
    year:        r.film_year ?? r.work_year ?? null,
    director:    r.work_director ?? null,
    genre:       r.film_genre ?? r.work_genre ?? null,
    rating:      r.film_rating ?? r.rating ?? null,
    adjective:   null,
    cast_list:   [],
    tags:        Array.isArray(r.tags) ? r.tags : [],
    source:      'posts',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — essaie works → films → posts dans l'ordre
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWork(
  rawId: string,
  hint: 'works' | 'films' | 'auto',
): Promise<NormWork | null> {
  // ── hint explicite ──────────────────────────────────────────────
  if (hint === 'works') {
    const { data } = await supabase.from('works').select('*').eq('id', rawId).single();
    if (data) return fromWorks(data);
  }
  if (hint === 'films') {
    const { data } = await supabase.from('films').select('*').eq('id', rawId).single();
    if (data) return fromFilms(data);
  }

  // ── auto : essaie works d'abord ─────────────────────────────────
  const { data: w } = await supabase.from('works').select('*').eq('id', rawId).single();
  if (w) return fromWorks(w);

  // ── puis films ──────────────────────────────────────────────────
  const { data: f } = await supabase.from('films').select('*').eq('id', rawId).single();
  if (f) return fromFilms(f);

  // ── puis community_posts_enriched (UUID seulement) ──────────────
  if (isUUID(rawId)) {
    const { data: p } = await supabase
      .from('community_posts_enriched')
      .select('*').eq('id', rawId).single();
    if (p) return fromPosts(p);
  }

  return null;
}

// Œuvres similaires (même genre / catégorie)
async function fetchSimilar(work: NormWork): Promise<NormWork[]> {
  const table = work.source === 'films' ? 'films' : 'works';
  const norm  = work.source === 'films' ? fromFilms : fromWorks;

  const query = supabase
    .from(table)
    .select('*')
    .neq('id', work.id)
    .limit(8);

  if (work.genre) query.eq('genre', work.genre);

  const { data } = await query;
  return (data ?? []).map(norm as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}

function useReveal(ready: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(anim, {
      toValue: 1, duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ready]);
  return anim;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const DetailSkeleton = memo(function DetailSkeleton() {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.52, duration: 950, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.22, duration: 950, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const Blk = ({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) => (
    <Animated.View style={{
      width: w as any, height: h, borderRadius: r,
      backgroundColor: C.navyLight, opacity: op, marginBottom: 12,
    }} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: H * 0.46, backgroundColor: C.navyMid }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 4 }}>
        <Blk w={90}  h={11} />
        <Blk w="72%" h={30} />
        <Blk w="48%" h={16} />
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[80, 80, 80, 80].map((w, i) => <Blk key={i} w={w} h={40} r={12} />)}
        </View>
        <View style={{ height: 8 }} />
        <Blk w="100%" h={54} r={16} />
        <View style={{ height: 8 }} />
        <Blk w="100%" h={14} />
        <Blk w="88%"  h={14} />
        <Blk w="64%"  h={14} />
      </View>
    </View>
  );
});
DetailSkeleton.displayName = 'DetailSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = memo(function StatPill({
  icon, value, label, color, onPress,
}: {
  icon: string; value: string; label?: string;
  color?: string; onPress?: () => void;
}) {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={sp.pill} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon as any} size={16} color={color ?? C.textSec} />
      <View>
        <Text style={[sp.val, color ? { color } : {}]}>{value}</Text>
        {label && <Text style={sp.lbl}>{label}</Text>}
      </View>
    </Wrap>
  );
});
const sp = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.surf, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  val: { color: C.text, fontSize: 13, fontWeight: '700' },
  lbl: { color: C.textTert, fontSize: 10, fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION TITLE
// ─────────────────────────────────────────────────────────────────────────────
const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return (
    <View style={sch.row}>
      <View style={sch.dot} />
      <Text style={sch.txt}>{children}</Text>
    </View>
  );
});
const sch = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 3, height: 18, borderRadius: 2, backgroundColor: C.blue },
  txt: { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────────────────────────────────────
const StarRow = memo(function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={C.gold}
        />
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CAST CHIP
// ─────────────────────────────────────────────────────────────────────────────
const CastChip = memo(function CastChip({ name }: { name: string }) {
  return (
    <View style={cc.chip}>
      <Image
        source={{ uri: `https://i.pravatar.cc/80?u=${encodeURIComponent(name)}` }}
        style={cc.avatar}
      />
      <Text style={cc.name} numberOfLines={1}>{name}</Text>
    </View>
  );
});
const cc = StyleSheet.create({
  chip:   { alignItems: 'center', marginRight: 16, width: 66 },
  avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: C.navyLight, marginBottom: 6 },
  name:   { color: C.textSec, fontSize: 11, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SIMILAR CARD
// ─────────────────────────────────────────────────────────────────────────────
const SimilarCard = memo(function SimilarCard({
  item, onPress,
}: { item: NormWork; onPress: () => void }) {
  const img = item.image ?? `https://picsum.photos/seed/${item.id}/300/450`;
  return (
    <TouchableOpacity style={sc.wrap} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: img }} style={sc.img} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(2,8,16,0.88)']}
        style={StyleSheet.absoluteFillObject}
      />
      {item.is_original && (
        <View style={sc.badge}>
          <Text style={sc.badgeTxt}>ORIGINAL</Text>
        </View>
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
// SOURCE BADGE
// ─────────────────────────────────────────────────────────────────────────────
const SourceBadge = memo(function SourceBadge({ source }: { source: NormWork['source'] }) {
  const labels = { works: 'Catalogue', films: 'Filmothèque', posts: 'Communauté' };
  const colors = { works: C.blue, films: C.gold, posts: C.green };
  return (
    <View style={[sb.wrap, { borderColor: `${colors[source]}44` }]}>
      <View style={[sb.dot, { backgroundColor: colors[source] }]} />
      <Text style={[sb.txt, { color: colors[source] }]}>{labels[source]}</Text>
    </View>
  );
});
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, backgroundColor: 'rgba(0,0,0,0.35)', alignSelf: 'flex-start' },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  txt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR (rang dans la catégorie)
// ─────────────────────────────────────────────────────────────────────────────
const RatingBar = memo(function RatingBar({ rating, max = 5 }: { rating: number; max?: number }) {
  const pct = Math.min(1, rating / max);
  return (
    <View style={rb.track}>
      <View style={[rb.fill, { width: `${pct * 100}%` as any }]} />
    </View>
  );
});
const rb = StyleSheet.create({
  track: { height: 3, backgroundColor: C.navyLight, borderRadius: 2, flex: 1 },
  fill:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.blue, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function FilmDetailScreen() {
  const router    = useRouter();
  const params    = useLocalSearchParams<{ id: string; source?: string }>();
  const rawId     = Array.isArray(params.id)     ? params.id[0]     : params.id     ?? '';
  const sourceHint = Array.isArray(params.source) ? params.source[0] : params.source ?? 'auto';

  const [work,     setWork]     = useState<NormWork | null>(null);
  const [similar,  setSimilar]  = useState<NormWork[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [liked,    setLiked]    = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);

  const heartSc = useRef(new Animated.Value(1)).current;
  const saveSc  = useRef(new Animated.Value(1)).current;
  const reveal  = useReveal(!loading && !error && !!work);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!rawId) { setError(true); setLoading(false); return; }

    setLoading(true); setError(false);
    try {
      const data = await fetchWork(
        rawId,
        (sourceHint === 'works' || sourceHint === 'films') ? sourceHint : 'auto',
      );
      if (!data) throw new Error('not found');
      setWork(data);
      setLocalLikes(data.likes);
      // Fetch similar en arrière-plan (non-bloquant)
      fetchSimilar(data).then(setSimilar).catch(() => {});
    } catch (e) {
      console.error('[FilmDetail] load:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [rawId, sourceHint]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setLiked(false); setExpanded(false); }, [rawId]);

  // ── Like ───────────────────────────────────────────────────────────────────
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(heartSc, { toValue: 1.42, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(heartSc, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [liked, heartSc]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    setSaved(v => !v);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(saveSc, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(saveSc, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [saveSc]);

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!work) return;
    try {
      await Share.share({
        message: `Découvrez "${work.title}"${work.director ? ` de ${work.director}` : ''} sur Universe App !`,
        title: work.title,
      });
    } catch {}
  }, [work]);

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const descShort = useMemo(() => {
    if (!work?.description) return '';
    return work.description.length > 200
      ? work.description.slice(0, 200).trimEnd() + '…'
      : work.description;
  }, [work?.description]);

  const metaStr = useMemo(() => {
    if (!work) return '';
    return [work.director, work.year].filter(Boolean).join(' · ');
  }, [work]);

  const bodyStyle = useMemo(() => ({
    opacity: reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  }), [reveal]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING / ERROR
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <DetailSkeleton />
      </View>
    );
  }

  if (error || !work) {
    return (
      <View style={[s.root, s.center]}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <View style={s.errorIcon}>
          <Ionicons name="film-outline" size={32} color={C.textTert} />
        </View>
        <Text style={s.errorTitle}>Œuvre introuvable</Text>
        <Text style={s.errorSub}>
          Cette œuvre n'existe pas dans notre catalogue ou a été retirée.
        </Text>
        <TouchableOpacity style={s.errorBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={15} color={C.white} />
          <Text style={s.errorBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroUri = work.image ?? `https://picsum.photos/seed/${work.id}/800/600`;
  const categoryColor = work.is_original ? C.blue : C.textSec;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        scrollEventThrottle={16}
      >
        {/* ══ HERO IMAGE ══════════════════════════════════════════════════ */}
        <View style={s.heroWrap}>
          <Image source={{ uri: heroUri }} style={s.heroImg} resizeMode="cover" />

          {/* Dégradés */}
          <LinearGradient
            colors={['rgba(2,8,16,0.58)', 'transparent']}
            locations={[0, 0.32]}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(2,8,16,0.42)', C.bg]}
            locations={[0.38, 0.72, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* ── Retour ── */}
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={21} color={C.white} />
            </BlurView>
          </TouchableOpacity>

          {/* ── Actions haut-droite ── */}
          <View style={s.topRight}>
            <Animated.View style={{ transform: [{ scale: saveSc }] }}>
              <TouchableOpacity style={s.actionCircle} onPress={handleSave} hitSlop={8}>
                <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={s.blurCircle}>
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={saved ? C.gold : C.white}
                  />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={s.actionCircle} onPress={handleShare} hitSlop={8}>
              <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={s.blurCircle}>
                <Ionicons name="share-outline" size={18} color={C.white} />
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* ── Badge catégorie / original ── */}
          {work.is_original && (
            <View style={s.heroBadge}>
              <Ionicons name="star" size={10} color={C.gold} />
              <Text style={s.heroBadgeTxt}>ORIGINAL</Text>
            </View>
          )}

          {/* ── Numéro déco (grand chiffre du rating) ── */}
          {work.rating != null && work.rating > 0 && (
            <View style={s.ratingDeco} pointerEvents="none">
              <Text style={s.ratingDecoTxt}>{Math.round(work.rating * 10) / 10}</Text>
              <Text style={s.ratingDecoLabel}>/ {work.rating <= 5 ? '5' : '10'}</Text>
            </View>
          )}
        </View>

        {/* ══ CORPS ════════════════════════════════════════════════════════ */}
        <Animated.View style={[s.body, bodyStyle]}>

          {/* ── Source badge ── */}
          <SourceBadge source={work.source} />
          <View style={{ height: 12 }} />

          {/* ── Titre + genre ── */}
          <View style={s.titleBlock}>
            {work.genre && (
              <Text style={[s.genreLabel, { color: categoryColor }]}>
                {work.genre.toUpperCase()}
              </Text>
            )}
            <Text style={s.title} numberOfLines={3}>{work.title}</Text>
            {(metaStr || work.adjective) && (
              <Text style={s.adjective} numberOfLines={1}>
                {work.adjective ? work.adjective : metaStr}
              </Text>
            )}
          </View>

          {/* ── Stats pills ── */}
          <View style={s.statsRow}>
            {/* Like interactif */}
            <TouchableOpacity onPress={handleLike} activeOpacity={0.82}>
              <View style={[sp.pill, liked && { borderColor: 'rgba(255,59,92,0.38)', backgroundColor: 'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform: [{ scale: heartSc }] }}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={16}
                    color={liked ? C.red : C.textSec}
                  />
                </Animated.View>
                <View>
                  <Text style={[sp.val, liked && { color: C.red }]}>{fmtLikes(localLikes)}</Text>
                  <Text style={sp.lbl}>J'aime</Text>
                </View>
              </View>
            </TouchableOpacity>

            {work.duration != null && (
              <StatPill
                icon="time-outline"
                value={work.duration >= 60
                  ? `${Math.floor(work.duration / 60)}h${work.duration % 60 > 0 ? `${work.duration % 60}` : ''}`
                  : `${work.duration} min`}
                label="Durée"
              />
            )}
            {work.year != null && (
              <StatPill icon="calendar-outline" value={String(work.year)} label="Année" />
            )}
            {work.rating != null && work.rating > 0 && (
              <StatPill
                icon="star"
                value={`${work.rating}/5`}
                label="Note"
                color={C.gold}
              />
            )}
            {work.comments != null && (
              <StatPill icon="chatbubble-outline" value={String(work.comments)} label="Avis" />
            )}
          </View>

          {/* ── Rating bar (si rating disponible) ── */}
          {work.rating != null && work.rating > 0 && (
            <View style={s.ratingRow}>
              <StarRow rating={work.rating} />
              <RatingBar rating={work.rating} />
              <Text style={s.ratingNum}>{work.rating}</Text>
            </View>
          )}

          {/* ── Tags ── */}
          {work.tags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tagRow}
              style={{ marginBottom: 22 }}
            >
              {work.tags.map(tag => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagTxt}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Bouton regarder ── */}
          <TouchableOpacity style={s.playBtn} activeOpacity={0.88}>
            <LinearGradient
              colors={[C.navyBright, C.navyMid]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.playGrad}
            >
              <View style={s.playIconWrap}>
                <Ionicons name="play" size={18} color={C.white} />
              </View>
              <View>
                <Text style={s.playTxt}>Regarder</Text>
                {work.duration != null && (
                  <Text style={s.playMeta}>
                    {work.duration >= 60
                      ? `${Math.floor(work.duration / 60)}h${work.duration % 60 > 0 ? ` ${work.duration % 60}min` : ''}`
                      : `${work.duration} min`
                    } · HD
                  </Text>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Synopsis / Description ── */}
          {work.description ? (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.synopsis}>
                {expanded ? work.description : descShort}
              </Text>
              {work.description.length > 200 && (
                <TouchableOpacity
                  onPress={() => setExpanded(v => !v)}
                  style={s.expandBtn}
                >
                  <Text style={s.expandTxt}>{expanded ? 'Réduire' : 'Lire la suite'}</Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={C.blue}
                  />
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* ── Réalisateur ── */}
          {work.director ? (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <View style={s.directorCard}>
                <Image
                  source={{ uri: `https://i.pravatar.cc/120?u=${encodeURIComponent(work.director)}` }}
                  style={s.directorAv}
                />
                <View style={s.directorInfo}>
                  <Text style={s.directorName}>{work.director}</Text>
                  {work.genre && <Text style={s.directorSub}>{work.genre}</Text>}
                  {work.year  && <Text style={s.directorYear}>{work.year}</Text>}
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Casting ── */}
          {work.cast_list.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Avec</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {work.cast_list.map(name => <CastChip key={name} name={name} />)}
              </ScrollView>
            </View>
          )}

          {/* ── Œuvres similaires ── */}
          {similar.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Dans le même genre</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similar.map(item => (
                  <SimilarCard
                    key={String(item.id)}
                    item={item}
                    onPress={() =>
                      router.replace({
                        pathname: '/film/[id]',
                        params: { id: String(item.id), source: item.source },
                      })
                    }
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Infos techniques ── */}
          <View style={s.section}>
            <SectionTitle>Informations</SectionTitle>
            <View style={s.infoGrid}>
              {[
                { label: 'Source',     value: { works: 'Catalogue', films: 'Filmothèque', posts: 'Communauté' }[work.source] },
                { label: 'Catégorie',  value: work.category },
                work.genre     && { label: 'Genre',     value: work.genre },
                work.year      && { label: 'Année',     value: String(work.year) },
                work.duration  && { label: 'Durée',     value: `${work.duration} min` },
                work.director  && { label: 'Réalisateur', value: work.director },
              ].filter(Boolean).map((info: any) => (
                <View key={info.label} style={s.infoRow}>
                  <Text style={s.infoLabel}>{info.label}</Text>
                  <Text style={s.infoValue} numberOfLines={1}>{info.value}</Text>
                </View>
              ))}
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

  // ── Hero ──────────────────────────────────────────────────────
  heroWrap: { height: H * 0.46, position: 'relative' },
  heroImg:  { width: '100%', height: '100%' },

  backBtn:      { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, left: 16 },
  actionCircle: {},
  blurCircle:   {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  topRight: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, right: 16,
    gap: 10, alignItems: 'flex-end',
  },

  heroBadge: {
    position: 'absolute', bottom: 18, left: 18,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.goldDim, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,200,66,0.28)',
  },
  heroBadgeTxt: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  ratingDeco:     { position: 'absolute', bottom: 14, right: 18, alignItems: 'flex-end' },
  ratingDecoTxt:  { color: 'rgba(255,255,255,0.07)', fontSize: 68, fontWeight: '900', lineHeight: 68, letterSpacing: -3 },
  ratingDecoLabel:{ color: C.textTert, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: -12 },

  // ── Body ──────────────────────────────────────────────────────
  body: { paddingHorizontal: 20, paddingTop: 22 },

  titleBlock:  { marginBottom: 20 },
  genreLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  title:       { color: C.white, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, marginBottom: 7 },
  adjective:   { color: C.textSec, fontSize: 14, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  ratingNum: { color: C.gold, fontSize: 13, fontWeight: '800', minWidth: 24 },

  tagRow: { gap: 8, paddingVertical: 2 },
  tag:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  tagTxt: { color: C.textSec, fontSize: 12, fontWeight: '600' },

  // ── Play ──────────────────────────────────────────────────────
  playBtn:     { borderRadius: 16, overflow: 'hidden', marginBottom: 26, borderWidth: 1, borderColor: C.borderBlue },
  playGrad:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 20 },
  playIconWrap:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  playTxt:     { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  playMeta:    { color: C.textTert, fontSize: 11, marginTop: 2 },

  // ── Section ───────────────────────────────────────────────────
  section:  { marginBottom: 28 },
  synopsis: { color: C.textSec, fontSize: 14, lineHeight: 23 },

  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandTxt: { color: C.blue, fontSize: 13, fontWeight: '700' },

  directorCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 16 },
  directorAv:   { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: C.navyLight },
  directorInfo: { flex: 1 },
  directorName: { color: C.text, fontSize: 15, fontWeight: '700' },
  directorSub:  { color: C.textSec, fontSize: 12, marginTop: 2 },
  directorYear: { color: C.textTert, fontSize: 11, marginTop: 1 },

  // ── Info grid ────────────────────────────────────────────────
  infoGrid: { backgroundColor: C.surf, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  infoRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.border },
  infoLabel:{ color: C.textTert, fontSize: 12, fontWeight: '600' },
  infoValue:{ color: C.text, fontSize: 12, fontWeight: '700', maxWidth: '60%' },

  // ── Error ─────────────────────────────────────────────────────
  errorIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  errorTitle:   { color: C.textSec, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorSub:     { color: C.textTert, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  errorBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi },
  errorBtnTxt:  { color: C.white, fontWeight: '700', fontSize: 14 },
});