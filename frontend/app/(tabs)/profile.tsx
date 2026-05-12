/**
 * app/profile.tsx
 *
 * ── CORRECTIF PRINCIPAL ──────────────────────────────────────────────────────
 *  SYMPTÔME : PortraitCards invisibles (données présentes en console)
 *  CAUSE    : pc.card et pc.img manquaient dans StyleSheet.create(pc)
 *             → View/Image sans dimensions → rendu vide
 *  FIX      : ajout de pc.card (width/height/borderRadius/overflow) et pc.img
 *
 * ── NOUVEAU : CritiqueCard avec fond Galaxy + logo Universe ─────────────────
 *  Composant ProfileCritiqueCard inline avec :
 *    • LinearGradient navy-to-deep (remplace fond uni)
 *    • Image logouniverse2.png en watermark (opacity 0.12)
 *    • Étoiles de notation + titre film + extrait critique
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';

import { useAuth }           from '../../contexts/AuthContext';
import { seenAPI }           from '../../services/api';
import GalaxyBackground      from '../../components/social/GalaxyBackground';
import { ImageWithFallback } from '../../components/profile/ImageWithFallback';
import { ReelCard, SeenCard } from '../../components/profile/Card';
import {
  EmptyState, HScrollRow,
  SectionHeader, StatColumn,
} from '../../components/profile/Section';
import {
  CARD_GAP, CARD_H, CARD_W, G,
  HEADER_SCROLL_DISTANCE, H_PADDING,
  NUM_ITEM_W, NUM_OVERLAP, NUM_W,
} from '../../components/profile/theme';
import {
  DEFAULT_REVIEWS, DEFAULT_SEEN,
  OWN_EPISODES_LONG, OWN_EPISODES_MID, OWN_REELS,
  type FilmItem, type ReviewItem,
} from '../../components/profile/data';
import { resolveWorkIdByTitleYear, supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Logo Universe (watermark sur les CritiqueCards)
// ─────────────────────────────────────────────────────────────────────────────
const LOGO = require('@/assets/images/logouniverse2.png');

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
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
}

type GridTab = 0 | 1 | 2;

const TAB_ICONS: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'grid-outline',          label: 'Films'  },
  { icon: 'play-circle-outline',   label: 'Créas'  },
  { icon: 'person-circle-outline', label: 'Tags'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (module-level stables)
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(id: number, image: string | null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/400/600`;
  } catch {
    return `https://picsum.photos/seed/work_${id}/400/600`;
  }
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 8 }: { w: number; h: number; r?: number }) {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue:0.50, duration:850, useNativeDriver:true }),
      Animated.timing(op, { toValue:0.22, duration:850, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View style={{ width:w, height:h, borderRadius:r, backgroundColor:'rgba(255,255,255,0.09)', opacity:op }} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON SECTION
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonSection = memo(function SkeletonSection({ accentColor = G.primary }: { accentColor?: string }) {
  return (
    <View>
      <View style={sk.header}>
        <View style={[sk.iconBox, { backgroundColor:`${accentColor}14` }]} />
        <View style={sk.titleBar} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft:H_PADDING, paddingRight:H_PADDING, gap:CARD_GAP }}>
        {[0,1,2,3].map(i => (
          <View key={i} style={{ flexDirection:'row', alignItems:'flex-end', width:NUM_ITEM_W }}>
            <View style={sk.numCol}><View style={sk.ghostNum} /></View>
            <View style={[sk.ghostCard, { marginLeft:-NUM_OVERLAP }]}>
              <Shimmer w={CARD_W} h={CARD_H} r={12} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const sk = StyleSheet.create({
  header:    { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:H_PADDING, paddingTop:22, paddingBottom:12 },
  iconBox:   { width:26, height:26, borderRadius:9 },
  titleBar:  { height:12, width:120, borderRadius:6, backgroundColor:'rgba(255,255,255,0.06)' },
  numCol:    { width:NUM_W, height:CARD_H, justifyContent:'flex-start', paddingTop:6 },
  ghostNum:  { height:68, width:38, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:6, alignSelf:'flex-end' },
  ghostCard: { borderRadius:13, overflow:'hidden' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ PORTRAIT CARD — CORRECTIF pc.card + pc.img
// ─────────────────────────────────────────────────────────────────────────────
const PORT_W = CARD_W;   // dimensions issues du thème
const PORT_H = CARD_H;

const PortraitCard = memo(function PortraitCard({
  item, rank, noMargin,
}: { item: Work; rank?: number; noMargin?: boolean }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);
  const rankColor =
    rank === 1 ? G.gold :
    rank === 2 ? '#C0C0C0' :
    rank === 3 ? '#CD7F32' :
    'rgba(255,255,255,0.40)';

  return (
    <TouchableOpacity
      style={{ marginRight: noMargin ? 0 : 12 }}
      onPress={() => router.push(`/film/${item.id}` as any)}
      activeOpacity={0.88}
    >
      {/* ★ FIX : pc.card maintenant défini avec width + height + overflow */}
      <View style={pc.card}>
        {/* ★ FIX : pc.img maintenant défini, resizeMode en prop */}
        <Image source={{ uri }} style={pc.img} resizeMode="cover" />

        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.86)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x:0, y:0.38 }}
          end={{ x:0, y:1 }}
        />

        {/* Badge catégorie */}
        <View style={[pc.badge, { backgroundColor: item.is_original ? '#1E4A7A' : '#0D2240' }]}>
          <Text style={pc.badgeTxt}>
            {item.is_original ? 'ORIG' : (item.category ?? '').slice(0,4).toUpperCase()}
          </Text>
        </View>

        {/* Numéro de rang */}
        {rank != null && (
          <Text style={[pc.rankNum, { color: rankColor }]}>{rank}</Text>
        )}

        {/* Titre + likes */}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
            <Ionicons name="heart" size={9} color={G.gold} />
            <Text style={pc.stat}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ★ StyleSheet COMPLET — pc.card et pc.img maintenant présents
const pc = StyleSheet.create({
  // ★ AJOUTÉS (manquaient — cause des cartes invisibles)
  card:    {
    width:        PORT_W,
    height:       PORT_H,
    borderRadius: 13,
    overflow:     'hidden',
    backgroundColor: '#0D2240',
  },
  img:     {
    width:    '100%' as any,
    height:   '100%' as any,
  },
  // Existants
  badge:   { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5, borderRadius:4 },
  badgeTxt:{ color:'#FFFFFF', fontSize:7, fontWeight:'800', letterSpacing:0.3 },
  rankNum: { position:'absolute', bottom:30, right:5, fontSize:52, fontWeight:'900', lineHeight:52, letterSpacing:-4, opacity:0.9 },
  meta:    { position:'absolute', bottom:8, left:8, right:8, gap:2 },
  title:   { color:'#FFFFFF', fontSize:11, fontWeight:'700', lineHeight:14 },
  stat:    { color:'rgba(255,255,255,0.6)', fontSize:9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ PROFILE CRITIQUE CARD — fond Galaxy + logo Universe
// ─────────────────────────────────────────────────────────────────────────────
const CRITIQUE_W = 220;
const CRITIQUE_H = 148;

const ProfileCritiqueCard = memo(function ProfileCritiqueCard({
  review, rank, onPress,
}: { review: ReviewItem; rank: number; onPress: () => void }) {
  const stars = Math.round(review.rating ?? 0);

  return (
    <TouchableOpacity
      style={{ marginRight:12 }}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={cc.card}>

        {/* ── Fond gradient galaxy ──────────────────────────────────── */}
        <LinearGradient
          colors={['#0D0822', '#0A1628', '#060C1A']}
          style={StyleSheet.absoluteFillObject}
          start={{ x:0, y:0 }}
          end={{ x:1, y:1 }}
        />

        {/* Étoiles décoratives de fond */}
        {STAR_POSITIONS.map((s, i) => (
          <View key={i} style={[cc.star, { top:s.top, left:s.left, opacity:s.op, width:s.r, height:s.r, borderRadius:s.r/2 }]} />
        ))}

        {/* Logo Universe watermark */}
        <Image
          source={LOGO}
          style={cc.logo}
          resizeMode="contain"
        />

        {/* Numéro de rang */}
        <View style={cc.rankBadge}>
          <Text style={cc.rankTxt}>#{rank}</Text>
        </View>

        {/* Contenu */}
        <View style={cc.body}>
          {/* Titre du film */}
          <Text style={cc.filmTitle} numberOfLines={1}>
            {review.film?.title ?? '—'}
          </Text>

          {/* Étoiles */}
          <View style={cc.stars}>
            {[1,2,3,4,5].map(s => (
              <Ionicons
                key={s}
                name={s <= stars ? 'star' : 'star-outline'}
                size={10}
                color={G.gold}
              />
            ))}
          </View>

          {/* Extrait de critique */}
          <Text style={cc.excerpt} numberOfLines={3}>
            {review.content || 'Aucun contenu'}
          </Text>
        </View>

        {/* Bordure subtile */}
        <View style={cc.border} pointerEvents="none" />
      </View>
    </TouchableOpacity>
  );
});

// Positions fixes des étoiles décoratives (calculées une fois, stables)
const STAR_POSITIONS = [
  { top:8,  left:18,  op:0.55, r:1.8 },
  { top:14, left:88,  op:0.35, r:1.2 },
  { top:22, left:155, op:0.60, r:2.0 },
  { top:38, left:42,  op:0.28, r:1.0 },
  { top:48, left:190, op:0.45, r:1.5 },
  { top:58, left:72,  op:0.50, r:1.6 },
  { top:70, left:130, op:0.32, r:1.0 },
  { top:80, left:8,   op:0.40, r:1.4 },
  { top:92, left:200, op:0.55, r:1.8 },
  { top:18, left:120, op:0.42, r:1.3 },
  { top:62, left:168, op:0.30, r:1.0 },
];

const cc = StyleSheet.create({
  card:      {
    width:CRITIQUE_W, height:CRITIQUE_H,
    borderRadius:16, overflow:'hidden',
    position:'relative',
  },
  star:      { position:'absolute', backgroundColor:'#FFFFFF' },
  logo:      {
    position:'absolute', right:8, bottom:8,
    width:52, height:52, opacity:0.10,
  },
  rankBadge: {
    position:'absolute', top:10, left:10,
    paddingHorizontal:7, paddingVertical:3,
    borderRadius:8, backgroundColor:'rgba(124,94,252,0.28)',
    borderWidth:1, borderColor:'rgba(124,94,252,0.45)',
  },
  rankTxt:   { color:'#A78BFA', fontSize:9, fontWeight:'800' },
  body:      { position:'absolute', bottom:0, left:0, right:0, padding:12, gap:4 },
  filmTitle: { color:'#FFFFFF', fontSize:13, fontWeight:'800', letterSpacing:-0.2 },
  stars:     { flexDirection:'row', gap:2 },
  excerpt:   { color:'rgba(255,255,255,0.48)', fontSize:10, lineHeight:14 },
  border:    {
    ...StyleSheet.absoluteFillObject,
    borderRadius:16, borderWidth:1,
    borderColor:'rgba(124,94,252,0.20)',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const scrollY = useRef(new Animated.Value(0)).current;

  const [activeTab,       setActiveTab]       = useState<GridTab>(0);
  const [reviews,         setReviews]         = useState<ReviewItem[]>([]);
  const [seenFilms,       setSeenFilms]       = useState<FilmItem[]>([]);
  const [favWorks,        setFavWorks]        = useState<Work[]>([]);
  const [watchedWorks,    setWatchedWorks]    = useState<Work[]>([]);
  const [recommendations, setRecommendations] = useState<Work[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);

  // ── Fetch favoris / historique / recommandations ───────────────────────────
  useEffect(() => {
    async function fetchWorksData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.id) return;
        const uid = authUser.id;

        const [favRes, watchRes] = await Promise.all([
          supabase.from('user_favorites').select('works(*)').eq('user_id', uid),
          supabase.from('user_history').select('works(*)').eq('user_id', uid),
        ]);

        const favorites = (favRes.data?.map((d: any) => d.works).filter(Boolean) ?? []) as Work[];
        const watched   = (watchRes.data?.map((d: any) => d.works).filter(Boolean) ?? []) as Work[];

        setFavWorks(favorites);
        setWatchedWorks(watched);

        const combined = [...favorites, ...watched];
        if (!combined.length) return;

        const genres     = [...new Set(combined.map(w => w.genre))];
        const excludeIds = combined.map(w => w.id);

        const { data: recData } = await supabase
          .from('works')
          .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director')
          .in('genre', genres)
          .order('likes', { ascending: false })
          .limit(15);

        setRecommendations(
          ((recData ?? []) as Work[]).filter(w => !excludeIds.includes(w.id))
        );
      } catch (e) {
        console.error('[profile] works fetch:', e);
      }
    }
    fetchWorksData();
  }, [user?.id]);

  // ── Fetch critiques ────────────────────────────────────────────────────────
  const loadReviews = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) { setReviews([]); return; }

      const { data, error } = await supabase
        .from('critiques')
        .select('id,user_id,reel_id,film_title,title,content,rating,likes_count,created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (error) { setReviews([]); return; }

      setReviews(
        (data ?? []).map((c: any) => {
          const filmTitle = String(c.film_title ?? c.title ?? '—');
          return {
            id:      String(c.id),
            filmId:  String(c.reel_id ?? c.id),
            content: String(c.content ?? ''),
            rating:  c.rating == null ? 0 : Number(c.rating),
            likes:   c.likes_count ?? 0,
            date:    c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
            film: {
              id:        String(c.reel_id ?? c.id),
              title:     filmTitle,
              posterUrl: `https://picsum.photos/seed/crit_${c.id}/400/600`,
              genre:     '—',
              type:      'film' as const,
            },
          } satisfies ReviewItem;
        })
      );
    } catch (e) {
      console.error('[profile] reviews:', e);
      setReviews([]);
    }
  }, []);

  // ── Fetch vus ─────────────────────────────────────────────────────────────
  const loadSeen = useCallback(async (uid: string) => {
    const seen = await seenAPI.getByUser(uid).catch(() => null);
    setSeenFilms(seen?.length ? seen : DEFAULT_SEEN);
  }, []);

  // ── Chargement global ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([loadReviews(), loadSeen(user.id)]);
    } catch {
      setReviews(DEFAULT_REVIEWS);
      setSeenFilms(DEFAULT_SEEN);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, loadReviews, loadSeen]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goFilm = useCallback(async (filmOrId: any) => {
    if (typeof filmOrId === 'number' || (typeof filmOrId === 'string' && /^\d+$/.test(filmOrId))) {
      router.push(`/film/${Number(filmOrId)}` as any);
      return;
    }
    const film = filmOrId as Partial<FilmItem> | undefined;
    if (!film?.title) return;
    const workId = await resolveWorkIdByTitleYear({
      title: String(film.title),
      year:  typeof film.year === 'number' ? film.year : undefined,
      type:  (film as any).type === 'série' ? 'série' : 'film',
    });
    if (workId) router.push(`/film/${workId}` as any);
  }, [router]);

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const sortedReviews = useMemo(
    () => [...reviews].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)),
    [reviews]
  );
  const headerOpacity = useMemo(
    () => scrollY.interpolate({ inputRange:[0, HEADER_SCROLL_DISTANCE], outputRange:[0,1], extrapolate:'clamp' }),
    [scrollY]
  );
  const fmt = useCallback((n: number) => fmtNumber(n), []);

  if (!user) return null;

  // ── TAB 0 — Films ─────────────────────────────────────────────────────────
  function renderMainContent() {
    if (loading) {
      return (
        <View>
          <SkeletonSection accentColor={G.gold}  />
          <SkeletonSection accentColor={G.amber} />
          <SkeletonSection accentColor={G.cyan}  />
          <View style={{ height:80 }} />
        </View>
      );
    }

    return (
      <View>
        {/* ── Favoris ── */}
        <SectionHeader
          icon="trophy" label="Films favoris" subtitle="Tes œuvres préférées"
          count={favWorks.length} accentColor={G.gold}
          onViewAll={() => router.push('/profile/favorites' as any)}
        />
        {favWorks.length === 0 ? (
          <EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegarde tes films avec l'étoile" />
        ) : (
          <HScrollRow>
            {favWorks.map((film, idx) => (
              <PortraitCard key={`fav-${film.id}`} item={film} rank={idx + 1} />
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── Critiques — fond Galaxy + logo ── */}
        <SectionHeader
          icon="pencil" label="Critiques" subtitle="Classées par popularité"
          accentColor={G.amber}
          onViewAll={() => router.push('/profile/reviews' as any)}
        />
        {sortedReviews.length === 0 ? (
          <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />
        ) : (
          <HScrollRow>
            {sortedReviews.map((rev, idx) => (
              <ProfileCritiqueCard
                key={rev.id}
                review={rev}
                rank={idx + 1}
                onPress={() => router.push(`/review/${rev.id}` as any)}
              />
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── Visionnés ── */}
        <SectionHeader
          icon="eye" label="Films & Séries visionnés" subtitle="Votre historique de visionnage"
          accentColor={G.cyan}
          onViewAll={() => router.push('/profile/seen_films' as any)}
        />
        {watchedWorks.length === 0 ? (
          <EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marque des films comme vus" />
        ) : (
          <HScrollRow>
            {watchedWorks.map((film, idx) => (
              <PortraitCard key={`seen-${film.id}`} item={film} rank={idx + 1} />
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── Recommandations ── */}
        <SectionHeader
          icon="sparkles" label="Recommandés pour vous" subtitle="Basé sur vos goûts"
          accentColor="#fff"
        />
        {recommendations.length === 0 ? (
          <EmptyState icon="planet-outline" text="Aucune recommandation" subtext="Regardez plus de films pour améliorer l'algorithme" />
        ) : (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal:16, gap:12 }}
          >
            {recommendations.map(film => (
              <PortraitCard key={`rec-${film.id}`} item={film} />
            ))}
          </ScrollView>
        )}

        <View style={{ height:110 }} />
      </View>
    );
  }

  // ── TAB 1 — Créations ─────────────────────────────────────────────────────
  function renderReelsContent() {
    const sections = [
      { label:'Courts métrages', subtitle:'Sélection festival', icon:'videocam' as const, data:OWN_REELS,         route:'/profile/reels',          itemRoute:'/reel/'    },
      { label:'Moyens métrages', subtitle:'Sélection festival', icon:'tv'       as const, data:OWN_EPISODES_MID,  route:'/profile/episodes-mid',   itemRoute:'/episode/' },
      { label:'Mini-séries',     subtitle:'Sélection festival', icon:'film'     as const, data:OWN_EPISODES_LONG, route:'/profile/episodes-long',  itemRoute:'/episode/' },
    ];
    return (
      <View>
        {sections.map((s, si) => (
          <View key={s.label}>
            <SectionHeader
              icon={s.icon} label={`Mes ${s.label.toLowerCase()}`}
              subtitle={s.subtitle} accentColor={G.primary}
              onViewAll={() => router.push(s.route as any)}
            />
            <HScrollRow paddingBottom={8}>
              {s.data.map(item => (
                <ReelCard
                  key={item.id} reel={item} rank={0}
                  onPress={() => router.push(`${s.itemRoute}${item.id}` as any)}
                />
              ))}
            </HScrollRow>
            {si < sections.length - 1 && <View style={pg.divider} />}
          </View>
        ))}
        <View style={{ height:110 }} />
      </View>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={pg.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={G.primary}
          />
        }
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient
            colors={['rgba(13,13,18,0.55)', 'transparent']}
            style={pg.topGradient}
            pointerEvents="none"
          />

          {/* TOP NAV */}
          <View style={pg.topNav}>
            <View style={pg.topNavLeft}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.5)" />
              <Text style={pg.topNavUser}>{user.username}</Text>
              <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.4)" />
            </View>
            <View style={pg.topNavRight}>
              <TouchableOpacity style={pg.navIconBtn} onPress={() => router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={21} color="rgba(255,255,255,0.85)" />
                <View style={pg.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity style={pg.navIconBtn} testID="profile-settings-btn" onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={21} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <TouchableOpacity style={pg.navIconBtn} onPress={() => router.push('/universe-admin' as any)}>
                <Ionicons name="eye-outline" size={21} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* AVATAR + STATS */}
          <View style={pg.avatarRow}>
            <View style={pg.avatarWrap}>
              <ImageWithFallback
                uri={user.avatar_url ?? `https://i.pravatar.cc/150?u=${user.id}`}
                style={pg.avatar}
                fallbackColors={[G.surface, G.bg]}
              />
              <View style={pg.avatarRing} pointerEvents="none" />
            </View>
            <View style={pg.statsRow}>
              <StatColumn value={`${user.films_seen_count ?? seenFilms.length}`} label="films" />
              <View style={pg.statDivider} />
              <StatColumn value={fmt(user.followers_count ?? 0)} label="critiques" />
              <View style={pg.statDivider} />
              <StatColumn value={fmt(user.following_count ?? 0)} label="festivals" />
            </View>
          </View>

          {/* BIO */}
          <View style={pg.bioRow}>
            <BlurView intensity={20} tint="dark" style={pg.rolePill}>
              <Text style={pg.rolePillTxt}>
                {user.role === 'critic' ? '✍️ Critique' : user.role === 'creator' ? '⭐ Créateur·rice' : '🎬 Réalisateur·rice'}
              </Text>
            </BlurView>
            {(user as any).is_industry_contact && (
              <BlurView intensity={20} tint="dark" style={pg.rolePill}>
                <Text style={pg.rolePillTxt}>📧 Contactable</Text>
              </BlurView>
            )}
            <Pressable style={pg.editBtn} onPress={() => router.push('/profile/edit' as any)}>
              <Text style={pg.editBtnTxt}>Modifier</Text>
            </Pressable>
          </View>

          <View style={pg.glowSep} />
        </SafeAreaView>

        {/* TAB BAR */}
        <View style={pg.tabBar}>
          {TAB_ICONS.map(({ icon, label }, idx) => {
            const active = activeTab === idx;
            return (
              <TouchableOpacity
                key={icon} style={pg.tabItem}
                onPress={() => setActiveTab(idx as GridTab)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={active ? (icon.replace('-outline','') as any) : icon}
                  size={20}
                  color={active ? G.primary : 'rgba(255,255,255,0.28)'}
                />
                <Text style={[pg.tabLabel, active && pg.tabLabelActive]}>{label}</Text>
                {active && <View style={[pg.tabIndicator, { backgroundColor:G.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 0 && renderMainContent()}
        {activeTab === 1 && renderReelsContent()}
        {activeTab === 2 && (
          <EmptyState icon="pricetag-outline" text="Aucun tag" subtext="Les films où vous êtes tagué apparaissent ici" />
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:         { flex:1, backgroundColor:G.bg },
  topGradient:  { position:'absolute', top:0, left:0, right:0, height:200 },
  topNav:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:H_PADDING, paddingVertical:10 },
  topNavLeft:   { flexDirection:'row', alignItems:'center', gap:5 },
  topNavRight:  { flexDirection:'row', alignItems:'center', gap:4 },
  topNavUser:   { fontSize:17, fontWeight:'800', color:G.text, letterSpacing:-0.2 },
  navIconBtn:   { padding:6, position:'relative' },
  notifDot:     { position:'absolute', top:5, right:5, width:7, height:7, borderRadius:3.5, backgroundColor:G.primary, borderWidth:1.5, borderColor:G.bg },
  avatarRow:    { flexDirection:'row', alignItems:'center', paddingHorizontal:H_PADDING, marginTop:6, gap:16 },
  avatarWrap:   { position:'relative' },
  avatar:       { width:84, height:84, borderRadius:42 },
  avatarRing:   { position:'absolute', top:-2, left:-2, right:-2, bottom:-2, borderRadius:44, borderWidth:2, borderColor:'rgba(191,95,255,0.4)' },
  statsRow:     { flex:1, flexDirection:'row', justifyContent:'space-around', alignItems:'center' },
  statDivider:  { width:1, height:28, backgroundColor:'rgba(255,255,255,0.07)' },
  bioRow:       { paddingHorizontal:H_PADDING, marginTop:12, flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  rolePill:     { borderRadius:20, paddingHorizontal:9, paddingVertical:3.5, overflow:'hidden', borderWidth:1, borderColor:'rgba(191,95,255,0.30)' },
  rolePillTxt:  { color:'rgba(255,255,255,0.88)', fontSize:10, fontWeight:'700' },
  editBtn:      { marginLeft:'auto', paddingHorizontal:14, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.15)', backgroundColor:'rgba(255,255,255,0.06)' },
  editBtnTxt:   { color:'rgba(255,255,255,0.75)', fontSize:11, fontWeight:'600' },
  glowSep:      { height:1, marginTop:16, backgroundColor:'rgba(191,95,255,0.14)' },
  divider:      { height:1, backgroundColor:'rgba(255,255,255,0.04)', marginTop:20 },
  tabBar:       { flexDirection:'row', borderTopWidth:0.5, borderBottomWidth:0.5, borderColor:'rgba(255,255,255,0.07)', marginTop:4 },
  tabItem:      { flex:1, alignItems:'center', paddingVertical:10, gap:3, position:'relative' },
  tabLabel:     { fontSize:9, fontWeight:'600', color:'rgba(255,255,255,0.28)', letterSpacing:0.5, textTransform:'uppercase' },
  tabLabelActive:{ color:G.primary },
  tabIndicator: { position:'absolute', top:0, left:'20%', right:'20%', height:2, borderBottomLeftRadius:2, borderBottomRightRadius:2 },
});