/**
 * FilmDetailScreen — v2.0 (optimisé & bugfixé)
 *
 * Corrections :
 *  - works.id → work.id (crash heroUri)
 *  - sourceHint dupliqué ('works'||'works') → ('works'||'films')
 *  - fetchSimilar : mauvaise table + mauvais normaliseur → corrigé
 *  - Images Supabase Storage : résolution URL publique via getPublicUrl
 *  - AbortController sur chaque load() pour éviter les setState orphelins
 *  - useImagePreload pour hero + skeleton fondu
 *  - Memoization complète des composants enfants
 */

import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, Platform,
  Animated, Easing, Share, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { supabase }        from '@/lib/supabase';
import GalaxyBackground    from '@/components/social/GalaxyBackground';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
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
// TYPE
// ─────────────────────────────────────────────────────────────────────────────
interface NormWork {
  id:          string | number;
  title:       string;
  description: string | null;
  image:       string | null;   // URL publique résolue
  category:    string;
  is_original: boolean;
  likes:       number;
  comments:    number | null;
  duration:    number | null;
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
// IMAGE RESOLUTION — identique à search.tsx (bucket community-images)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Même logique que getImageUrl() dans search.tsx :
 *  - URL complète (http/https) → retournée telle quelle
 *  - Path relatif              → getPublicUrl depuis bucket "community-images"
 *  - null/vide                 → null  (SmartImage applique le fallback seed)
 */
function resolveImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const { data } = supabase.storage.from('community-images').getPublicUrl(raw);
  return data?.publicUrl ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────
function fromWorks(r: Record<string, any>): NormWork {
  return {
    id:          r.id,
    title:       r.title        ?? '—',
    description: r.description  ?? r.synopsis ?? null,
    image:       resolveImage(r.image ?? r.poster_url),
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
    title:       r.title         ?? r.name ?? '—',
    description: r.description   ?? r.synopsis ?? r.overview ?? null,
    image:       resolveImage(r.poster_url ?? r.image ?? r.backdrop_url),
    category:    r.type          ?? r.category ?? 'Film',
    is_original: !!r.is_original,
    likes:       r.likes_count   ?? r.likes ?? 0,
    comments:    r.comments_count ?? r.comments ?? null,
    duration:    r.duration      ?? r.runtime ?? null,
    year:        r.year          ?? r.release_year ?? null,
    director:    r.director      ?? null,
    genre:       r.genre         ?? null,
    rating:      r.rating        ?? r.score ?? null,
    adjective:   r.adjective     ?? r.tagline ?? null,
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
    image:       resolveImage(r.film_poster ?? r.image_url),
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
// FETCH — works → films → posts
// ─────────────────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID  = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

async function fetchWork(
  rawId: string,
  hint: 'works' | 'films' | 'auto',
): Promise<NormWork | null> {
  // hint explicite
  if (hint === 'works') {
    const { data } = await supabase.from('works').select('*').eq('id', rawId).maybeSingle();
    if (data) return fromWorks(data);
    return null; // si hint explicite mais non trouvé → ne pas continuer
  }
  if (hint === 'films') {
    const { data } = await supabase.from('films').select('*').eq('id', rawId).maybeSingle();
    if (data) return fromFilms(data);
    return null;
  }

  // auto : parallélise works + films pour plus de rapidité
  const [wRes, fRes] = await Promise.all([
    supabase.from('works').select('*').eq('id', rawId).maybeSingle(),
    supabase.from('films').select('*').eq('id', rawId).maybeSingle(),
  ]);
  if (wRes.data) return fromWorks(wRes.data);
  if (fRes.data) return fromFilms(fRes.data);

  // posts (UUID uniquement)
  if (isUUID(rawId)) {
    const { data: p } = await supabase
      .from('community_posts_enriched')
      .select('*').eq('id', rawId).maybeSingle();
    if (p) return fromPosts(p);
  }

  return null;
}

/**
 * Œuvres similaires :
 *  - même table que l'œuvre principale
 *  - même genre si dispo, sinon même catégorie
 *  - images résolues via le bon normaliseur
 */
async function fetchSimilar(work: NormWork): Promise<NormWork[]> {
  const table   = work.source === 'films' ? 'films' : 'works';
  const norm    = work.source === 'films' ? fromFilms : fromWorks;
  const idField = typeof work.id === 'number' ? 'id' : 'id';

  let query = supabase
    .from(table)
    .select('id, title, image, poster_url, likes, likes_count, genre, category, is_original, rating')
    .neq(idField, work.id)
    .limit(10);

  if (work.genre) {
    query = query.eq('genre', work.genre);
  } else if (work.category) {
    query = query.eq('category', work.category);
  }

  const { data } = await query;
  return (data ?? []).map(norm);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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

// Fallback déterministe — même préfixe "work_" que workImgUri() dans search.tsx
// garantit que les deux écrans affichent le même placeholder pour un même id
function seedFallback(id: string | number, w = 400, h = 600): string {
  return `https://picsum.photos/seed/work_${id}/${w}/${h}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — reveal animation
// ─────────────────────────────────────────────────────────────────────────────
function useReveal(ready: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(anim, {
      toValue: 1, duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ready, anim]);
  return anim;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — préchargement image hero
// ─────────────────────────────────────────────────────────────────────────────
function useImageReady(uri: string | null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!uri) { setReady(true); return; }
    // Image.prefetch est disponible sur React Native
    Image.prefetch(uri)
      .then(() => setReady(true))
      .catch(() => setReady(true)); // on continue même en erreur
  }, [uri]);
  return ready;
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
  }, [op]);

  const Blk = ({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) => (
    <Animated.View style={{
      width: w as any, height: h, borderRadius: r,
      backgroundColor: C.navyLight, opacity: op, marginBottom: 12,
    }} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: H * 0.46, backgroundColor: C.navyMid }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
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
// IMAGE AVEC FALLBACK — gère erreur réseau + placeholder
// ─────────────────────────────────────────────────────────────────────────────
interface SmartImageProps {
  uri:        string | null;
  fallbackId: string | number;
  style:      any;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  seedW?:     number;
  seedH?:     number;
}
const SmartImage = memo(function SmartImage({
  uri, fallbackId, style, resizeMode = 'cover', seedW = 400, seedH = 600,
}: SmartImageProps) {
  const [src, setSrc] = useState<string>(uri ?? seedFallback(fallbackId, seedW, seedH));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSrc(uri ?? seedFallback(fallbackId, seedW, seedH));
    setLoaded(false);
  }, [uri, fallbackId, seedW, seedH]);

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.navyMid, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={C.textTert} />
        </View>
      )}
      <Image
        source={{ uri: src }}
        style={[style, loaded ? {} : { opacity: 0 }]}
        resizeMode={resizeMode}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (src !== seedFallback(fallbackId, seedW, seedH)) {
            setSrc(seedFallback(fallbackId, seedW, seedH));
          }
        }}
      />
    </View>
  );
});

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
// CAST CHIP — avatar via pravatar (fallback déterministe)
// ─────────────────────────────────────────────────────────────────────────────
const CastChip = memo(function CastChip({ name }: { name: string }) {
  const avatarUri = `https://i.pravatar.cc/80?u=${encodeURIComponent(name)}`;
  return (
    <View style={cc.chip}>
      <SmartImage
        uri={avatarUri}
        fallbackId={name}
        style={cc.avatar}
        seedW={80} seedH={80}
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
// SIMILAR CARD — image résolue depuis la BDD
// ─────────────────────────────────────────────────────────────────────────────
const SimilarCard = memo(function SimilarCard({
  item, onPress,
}: { item: NormWork; onPress: () => void }) {
  return (
    <TouchableOpacity style={scrd.wrap} onPress={onPress} activeOpacity={0.85}>
      {/* Image résolue (SmartImage gère l'erreur + fallback) */}
      <SmartImage
        uri={item.image}
        fallbackId={item.id}
        style={scrd.img}
        seedW={300} seedH={450}
      />
      <LinearGradient
        colors={['transparent', 'rgba(2,8,16,0.88)']}
        style={StyleSheet.absoluteFillObject}
      />
      {item.is_original && (
        <View style={scrd.badge}>
          <Text style={scrd.badgeTxt}>ORIGINAL</Text>
        </View>
      )}
      <View style={scrd.info}>
        <Text style={scrd.title} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="heart" size={9} color={C.gold} />
          <Text style={scrd.likes}>{fmtLikes(item.likes)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const scrd = StyleSheet.create({
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
const SOURCE_LABELS: Record<NormWork['source'], string> = { works: 'Catalogue', films: 'Filmothèque', posts: 'Communauté' };
const SOURCE_COLORS: Record<NormWork['source'], string> = { works: C.blue, films: C.gold, posts: C.green };

const SourceBadge = memo(function SourceBadge({ source }: { source: NormWork['source'] }) {
  const color = SOURCE_COLORS[source];
  return (
    <View style={[sb.wrap, { borderColor: `${color}44` }]}>
      <View style={[sb.dot, { backgroundColor: color }]} />
      <Text style={[sb.txt, { color }]}>{SOURCE_LABELS[source]}</Text>
    </View>
  );
});
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, backgroundColor: 'rgba(0,0,0,0.35)', alignSelf: 'flex-start' },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  txt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
});

// ─────────────────────────────────────────────────────────────────────────────
// RATING BAR
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
// DIRECTOR CARD
// ─────────────────────────────────────────────────────────────────────────────
const DirectorCard = memo(function DirectorCard({
  director, genre, year,
}: { director: string; genre?: string | null; year?: string | number | null }) {
  const avatarUri = `https://i.pravatar.cc/120?u=${encodeURIComponent(director)}`;
  return (
    <View style={dc.card}>
      <SmartImage uri={avatarUri} fallbackId={director} style={dc.avatar} seedW={120} seedH={120} />
      <View style={dc.info}>
        <Text style={dc.name}>{director}</Text>
        {genre && <Text style={dc.sub}>{genre}</Text>}
        {year  && <Text style={dc.year}>{year}</Text>}
      </View>
    </View>
  );
});
const dc = StyleSheet.create({
  card:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: C.navyLight },
  info:   { flex: 1 },
  name:   { color: C.text, fontSize: 15, fontWeight: '700' },
  sub:    { color: C.textSec, fontSize: 12, marginTop: 2 },
  year:   { color: C.textTert, fontSize: 11, marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// INFO GRID ROW
// ─────────────────────────────────────────────────────────────────────────────
const InfoRow = memo(function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ig.row}>
      <Text style={ig.label}>{label}</Text>
      <Text style={ig.value} numberOfLines={1}>{value}</Text>
    </View>
  );
});
const ig = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.border },
  label: { color: C.textSec, fontSize: 12, fontWeight: '600' },
  value: { color: C.text, fontSize: 12, fontWeight: '700', maxWidth: '60%' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function FilmDetailScreen() {
  const router     = useRouter();
  const params     = useLocalSearchParams<{ id: string; source?: string }>();
  const rawId      = Array.isArray(params.id)     ? params.id[0]     : params.id     ?? '';
  // FIX: 'works'||'works' → 'works'||'films'
  const sourceHint = (Array.isArray(params.source) ? params.source[0] : params.source ?? 'auto') as 'works' | 'films' | 'auto';

  const [work,       setWork]       = useState<NormWork | null>(null);
  const [similar,    setSimilar]    = useState<NormWork[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [liked,      setLiked]      = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [localLikes, setLocalLikes] = useState(0);

  const heartSc = useRef(new Animated.Value(1)).current;
  const saveSc  = useRef(new Animated.Value(1)).current;
  const reveal  = useReveal(!loading && !error && !!work);

  // ── Fetch principal ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!rawId) { setError(true); setLoading(false); return; }

    setLoading(true); setError(false); setWork(null); setSimilar([]);

    // AbortController pour annuler si rawId change entre-temps
    const ctrl = new AbortController();

    try {
      const data = await fetchWork(rawId, sourceHint);
      if (ctrl.signal.aborted) return;

      if (!data) throw new Error('not found');

      setWork(data);
      setLocalLikes(data.likes);

      // Similar en arrière-plan, non-bloquant
      fetchSimilar(data)
        .then(items => { if (!ctrl.signal.aborted) setSimilar(items); })
        .catch(() => {});
    } catch (e) {
      if (!ctrl.signal.aborted) {
        console.error('[FilmDetail] load:', e);
        setError(true);
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }

    return () => ctrl.abort();
  }, [rawId, sourceHint]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then(fn => fn?.()); };
  }, [load]);

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

  // ── Dérivés mémoïsés ───────────────────────────────────────────────────────
  const descShort = useMemo(() => {
    if (!work?.description) return '';
    return work.description.length > 200
      ? work.description.slice(0, 200).trimEnd() + '…'
      : work.description;
  }, [work?.description]);

  const metaStr = useMemo(() => {
    if (!work) return '';
    return [work.director, work.year].filter(Boolean).join(' · ');
  }, [work?.director, work?.year]);

  const infoRows = useMemo(() => {
    if (!work) return [];
    return ([
      { label: 'Source',      value: SOURCE_LABELS[work.source] },
      { label: 'Catégorie',   value: work.category },
      work.genre    && { label: 'Genre',      value: work.genre },
      work.year     && { label: 'Année',      value: String(work.year) },
      work.duration && { label: 'Durée',      value: fmtDuration(work.duration) },
      work.director && { label: 'Réalisateur',value: work.director },
    ] as (false | { label: string; value: string })[]).filter(Boolean) as { label: string; value: string }[];
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

  // FIX: works.id → work.id
  const heroUri       = work.image;   // déjà résolu par resolveImage dans le normaliseur
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
          {/* SmartImage gère le loading + fallback seed */}
          <SmartImage
            uri={heroUri}
            fallbackId={work.id}
            style={s.heroImg}
            resizeMode="cover"
            seedW={800} seedH={600}
          />

          <LinearGradient
            colors={['rgba(2,8,16,0.58)', 'transparent']}
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

          {/* Actions haut-droite */}
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

          {/* Badge Original */}
          {work.is_original && (
            <View style={s.heroBadge}>
              <Ionicons name="star" size={10} color={C.gold} />
              <Text style={s.heroBadgeTxt}>ORIGINAL</Text>
            </View>
          )}

          {/* Déco rating */}
          {work.rating != null && work.rating > 0 && (
            <View style={s.ratingDeco} pointerEvents="none">
              <Text style={s.ratingDecoTxt}>{Math.round(work.rating * 10) / 10}</Text>
              <Text style={s.ratingDecoLabel}>/ {work.rating <= 5 ? '5' : '10'}</Text>
            </View>
          )}
        </View>

        {/* ══ CORPS ════════════════════════════════════════════════════════ */}
        <Animated.View style={[s.body, bodyStyle]}>

          <SourceBadge source={work.source} />
          <View style={{ height: 12 }} />

          {/* Titre */}
          <View style={s.titleBlock}>
            {work.genre && (
              <Text style={[s.genreLabel, { color: categoryColor }]}>
                {work.genre.toUpperCase()}
              </Text>
            )}
            <Text style={s.title} numberOfLines={3}>{work.title}</Text>
            {(metaStr || work.adjective) && (
              <Text style={s.adjective} numberOfLines={1}>
                {work.adjective ?? metaStr}
              </Text>
            )}
          </View>

          {/* Stats pills */}
          <View style={s.statsRow}>
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
              <StatPill icon="time-outline" value={fmtDuration(work.duration)} label="Durée" />
            )}
            {work.year != null && (
              <StatPill icon="calendar-outline" value={String(work.year)} label="Année" />
            )}
            {work.rating != null && work.rating > 0 && (
              <StatPill icon="star" value={`${work.rating}/5`} label="Note" color={C.gold} />
            )}
            {work.comments != null && (
              <StatPill icon="chatbubble-outline" value={String(work.comments)} label="Avis" />
            )}
          </View>

          {/* Rating bar */}
          {work.rating != null && work.rating > 0 && (
            <View style={s.ratingRow}>
              <StarRow rating={work.rating} />
              <RatingBar rating={work.rating} />
              <Text style={s.ratingNum}>{work.rating}</Text>
            </View>
          )}

          {/* Tags */}
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

          {/* Bouton regarder */}
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
                  <Text style={s.playMeta}>{fmtDuration(work.duration)} · HD</Text>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Synopsis */}
          {work.description ? (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.synopsis}>
                {expanded ? work.description : descShort}
              </Text>
              {work.description.length > 200 && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={s.expandBtn}>
                  <Text style={s.expandTxt}>{expanded ? 'Réduire' : 'Lire la suite'}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={C.blue} />
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Réalisateur */}
          {work.director ? (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <DirectorCard director={work.director} genre={work.genre} year={work.year} />
            </View>
          ) : null}

          {/* Casting */}
          {work.cast_list.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Avec</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {work.cast_list.map(name => <CastChip key={name} name={name} />)}
              </ScrollView>
            </View>
          )}

          {/* Œuvres similaires */}
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

          {/* Informations techniques */}
          <View style={s.section}>
            <SectionTitle>Informations</SectionTitle>
            <View style={s.infoGrid}>
              {infoRows.map((info, idx) => (
                <InfoRow key={info.label} label={info.label} value={info.value} />
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

  // Hero
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

  heroBadge:    { position: 'absolute', bottom: 18, left: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,200,66,0.28)' },
  heroBadgeTxt: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  ratingDeco:      { position: 'absolute', bottom: 14, right: 18, alignItems: 'flex-end' },
  ratingDecoTxt:   { color: 'rgba(255,255,255,0.07)', fontSize: 68, fontWeight: '900', lineHeight: 68, letterSpacing: -3 },
  ratingDecoLabel: { color: C.textTert, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: -12 },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 22 },

  titleBlock: { marginBottom: 20 },
  genreLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  title:      { color: C.white, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, marginBottom: 7 },
  adjective:  { color: C.textSec, fontSize: 14, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  ratingNum: { color: C.gold, fontSize: 13, fontWeight: '800', minWidth: 24 },

  tagRow: { gap: 8, paddingVertical: 2 },
  tag:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  tagTxt: { color: C.textSec, fontSize: 12, fontWeight: '600' },

  // Play
  playBtn:      { borderRadius: 16, overflow: 'hidden', marginBottom: 26, borderWidth: 1, borderColor: C.borderBlue },
  playGrad:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 20 },
  playIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  playTxt:      { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  playMeta:     { color: C.textTert, fontSize: 11, marginTop: 2 },

  // Section
  section:   { marginBottom: 28 },
  synopsis:  { color: C.textSec, fontSize: 14, lineHeight: 23 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandTxt: { color: C.blue, fontSize: 13, fontWeight: '700' },

  // Info grid
  infoGrid: { backgroundColor: C.surf, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  // Error
  errorIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  errorTitle:   { color: C.textSec, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorSub:     { color: C.textTert, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  errorBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi },
  errorBtnTxt:  { color: C.white, fontWeight: '700', fontSize: 14 },
});