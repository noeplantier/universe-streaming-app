// app/profile.tsx

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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { seenAPI } from '../../services/api';
import GalaxyBackground from '../../components/social/GalaxyBackground';
import { ImageWithFallback } from '../../components/profile/ImageWithFallback';

import {
  CritiqueCard,
  ReelCard,
  SeenCard,
} from '../../components/profile/Card';

import {
  EmptyState,
  HScrollRow,
  SectionHeader,
  StatColumn,
} from '../../components/profile/Section';

import {
  CARD_GAP,
  CARD_H,
  CARD_W,
  G,
  HEADER_SCROLL_DISTANCE,
  H_PADDING,
  NUM_ITEM_W,
  NUM_OVERLAP,
  NUM_W,
} from '../../components/profile/theme';

import {
  DEFAULT_REVIEWS,
  DEFAULT_SEEN,
  OWN_EPISODES_LONG,
  OWN_EPISODES_MID,
  OWN_REELS,
  poster,
  type FilmItem,
  type ReviewItem,
} from '../../components/profile/data';

import {
  resolveWorkIdByTitleYear,
  supabase,
} from '@/lib/supabase';

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
}

type GridTab = 0 | 1 | 2;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TAB_ICONS: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  {
    icon: 'grid-outline',
    label: 'Films',
  },
  {
    icon: 'play-circle-outline',
    label: 'Créas',
  },
  {
    icon: 'person-circle-outline',
    label: 'Tags',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER & STYLE PORTRAIT CARD
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

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────

const StarRatingRow = memo(
  ({ rating }: { rating: number }) => (
    <View
      style={{
        flexDirection: 'row',
        gap: 1.5,
      }}
    >
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={
            s <= rating
              ? 'star'
              : 'star-outline'
          }
          size={9}
          color={G.gold}
        />
      ))}
    </View>
  ),
);

StarRatingRow.displayName = 'StarRatingRow';

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonSection = memo(
  ({
    accentColor = G.primary,
  }: {
    accentColor?: string;
  }) => (
    <View>
      <View style={sk.header}>
        <View
          style={[
            sk.iconBox,
            {
              backgroundColor: `${accentColor}14`,
            },
          ]}
        />

        <View style={sk.titleBar} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingLeft: H_PADDING,
          paddingRight: H_PADDING,
          gap: CARD_GAP,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              width: NUM_ITEM_W,
            }}
          >
            <View style={sk.numCol}>
              <View style={sk.ghostNum} />
            </View>

            <View
              style={[
                sk.ghostCard,
                {
                  marginLeft: -NUM_OVERLAP,
                },
              ]}
            >
              <ImageWithFallback
                uri=""
                style={{ flex: 1 }}
                fallbackColors={[
                  G.surface,
                  G.bg,
                ]}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  ),
);

SkeletonSection.displayName =
  'SkeletonSection';

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────

const pc = StyleSheet.create({
  badge:   { position: 'absolute', top: 7, left: 7, paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 4 },
  badgeTxt:{ color: '#FFFFFF', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
  rankNum: { position: 'absolute', bottom: 30, right: 5, fontSize: 52, fontWeight: '900', lineHeight: 52, letterSpacing: -4, opacity: 0.9 },
  meta:    { position: 'absolute', bottom: 8, left: 8, right: 8, gap: 2 },
  title:   { color: '#FFFFFF', fontSize: 11, fontWeight: '700', lineHeight: 14 },
  stat:    { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
});

const PortraitCard = memo(
  ({
    item,
    rank,
    noMargin
  }: {
    item: Work;
    rank?: number;
    noMargin?: boolean;
  }) => {
    const router = useRouter();

    const uri = useMemo(
      () => resolveImage(item.id, item.image),
      [item.id, item.image],
    );

    const rankColor =
      rank === 1 ? G.gold : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.42)';

      return (
        <TouchableOpacity style={{ marginRight: noMargin ? 0 : 12 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
          <View style={pc.card}>
            {/* Affiche l'image avec le composant standard */}
            <Image 
              source={{ uri }} 
              style={pc.img as any} 
              resizeMode="cover" 
            />
            <LinearGradient 
              colors={['transparent','rgba(2,8,16,0.82)']} 
              style={StyleSheet.absoluteFillObject} 
              start={{ x: 0, y: 0.4 }} 
              end={{ x: 0, y: 1 }} 
            />
          
          <View style={[pc.badge, { backgroundColor: item.is_original ? '#1E4A7A' : '#0D2240' }]}>
            <Text style={pc.badgeTxt}>
              {item.is_original ? 'ORIG' : (item.category ?? '').slice(0,4).toUpperCase()}
            </Text>
          </View>
          
          {rank != null && (
            <Text style={[pc.rankNum, { color: rankColor }]}>
              {rank}
            </Text>
          )}

          {/* Méta de la carte : Titre et Likes (ajouté depuis search.tsx) */}
          <View style={pc.meta}>
            <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="heart" size={9} color={G.gold} />
              <Text style={pc.stat}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
            </View>
          </View>

        </View>
      </TouchableOpacity>
    );
  },
);

PortraitCard.displayName = 'PortraitCard';

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();

  const { user } = useAuth();

  const scrollY = useRef(
    new Animated.Value(0),
  ).current;

  const [activeTab, setActiveTab] =
    useState<GridTab>(0);

  const [reviews, setReviews] =
    useState<ReviewItem[]>([]);

  const [seenFilms, setSeenFilms] =
    useState<FilmItem[]>([]);

  const [favWorks, setFavWorks] =
    useState<Work[]>([]);

  const [watchedWorks, setWatchedWorks] =
    useState<Work[]>([]);

  const [
    recommendations,
    setRecommendations,
  ] = useState<Work[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // FETCH FAVORITES / WATCHED / RECOMMENDATIONS
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchWorksData() {
      try {
        // 1. Récupérer le VRAI UUID de l'utilisateur authentifié
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser?.id) {
          console.log("Aucun utilisateur authentifié");
          return;
        }

        const exactUserId = authUser.id; // C'est un vrai UUID valide

        // 2. Fetch Favoris avec exactUserId
        const { data: favData } = await supabase
          .from('user_favorites')
          .select('works(*)')
          .eq('user_id', exactUserId);
        const favorites = (favData?.map((d: any) => d.works).filter(Boolean) || []) as Work[];
        setFavWorks(favorites);

        // 3. Fetch Visionnés avec exactUserId
        const { data: watchedData, error } = await supabase
          .from('user_history')
          .select('works(*)')
          .eq('user_id', exactUserId);
          
        if (error) console.error("Erreur history:", error);
          
        const watched = (watchedData?.map((d: any) => d.works).filter(Boolean) || []) as Work[];
        setWatchedWorks(watched);

        const combined = [
          ...favorites,
          ...watched,
        ];

        if (combined.length > 0) {
          const genres = [
            ...new Set(
              combined.map(
                (w) => w.genre,
              ),
            ),
          ];

          const excludeIds =
            combined.map((w) => w.id);

          const {
            data: recData,
          } = await supabase
            .from('works')
            .select(`
              id,
              title,
              category,
              genre,
              year,
              likes,
              comments,
              image,
              is_original,
              adjective,
              duration,
              description,
              director
            `)
            .in('genre', genres)
            .order('likes', {
              ascending: false,
            })
            .limit(10);

          let recs =
            (recData || []) as Work[];

          recs = recs.filter(
            (w) =>
              !excludeIds.includes(w.id),
          );

          setRecommendations(recs);
        }
      } catch (error) {
        console.error(
          'Erreur fetching works:',
          error,
        );
      }
    }

    fetchWorksData();
  }, [user]);

  // ───────────────────────────────────────────────────────────────────────────
  // ANIMATIONS
  // ───────────────────────────────────────────────────────────────────────────

  const headerOpacity =
    scrollY.interpolate({
      inputRange: [
        0,
        HEADER_SCROLL_DISTANCE,
      ],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

  // ───────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ───────────────────────────────────────────────────────────────────────────

  const goFilm = useCallback(
    async (filmOrId: any) => {
      if (
        typeof filmOrId ===
          'number' ||
        (typeof filmOrId ===
          'string' &&
          /^\d+$/.test(filmOrId))
      ) {
        router.push(
          `/film/${Number(
            filmOrId,
          )}` as any,
        );

        return;
      }

      const film =
        filmOrId as
          | Partial<FilmItem>
          | undefined;

      if (!film?.title) {
        return;
      }

      const workId =
        await resolveWorkIdByTitleYear(
          {
            title: String(film.title),
            year:
              typeof film.year ===
              'number'
                ? film.year
                : undefined,
            type:
              (film as any).type ===
              'série'
                ? 'série'
                : 'film',
          },
        );

      if (workId) {
        router.push(
          `/film/${workId}` as any,
        );
      }
    },
    [router],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // LOAD REVIEWS (CRITIQUES)
  // ───────────────────────────────────────────────────────────────────────────

  const loadReviews = useCallback(
    async () => {
      try {
        // 1. Récupérer le vrai UUID de l'utilisateur authentifié
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser?.id) {
          setReviews([]);
          return;
        }

        // 2. Fetcher la table 'critiques' avec cet user_id
        const { data, error } = await supabase
          .from('critiques')
          .select(`id, user_id, reel_id, film_title, title, content, rating, created_at`)
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Erreur chargement critiques:", error);
          setReviews([]);
          return;
        }

        // 3. Mapper ces données via votre interface ReviewItem existante
        const normalized: ReviewItem[] = (data ?? []).map((c: any) => {
          const filmTitle = String(c.film_title ?? c.title ?? '—');
          return {
            id: String(c.id),
            filmId: String(c.reel_id ?? c.id),
            content: String(c.content ?? ''),
            rating: c.rating == null ? 0 : Number(c.rating),
            likes: 0, // Optionnel : ajoutez une colonne likes si elle existe
            date: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
            film: {
              id: String(c.reel_id ?? c.id),
              title: filmTitle,
              // Utilise votre helper existant pour générer une affiche temporaire
              posterUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(filmTitle)}&background=random&size=200`,
              genre: '—',
              type: 'film',
            },
          };
        });

        setReviews(normalized);
      } catch (err) {
        console.error("Erreur inattendue dans loadReviews:", err);
        setReviews([]);
      }
    },
    [],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // LOAD SEEN
  // ───────────────────────────────────────────────────────────────────────────

  const loadSeen = useCallback(
    async (uid: string) => {
      const seen =
        await seenAPI
          .getByUser(uid)
          .catch(() => null);

      setSeenFilms(
        seen?.length
          ? seen
          : DEFAULT_SEEN,
      );
    },
    [],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // LOAD DATA
  // ───────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(
    async () => {
      if (!user) {
        return;
      }

      setLoading(true);

      try {
        await Promise.all([
          loadReviews(user.id),
          loadSeen(user.id),
        ]);
      } catch {
        setReviews(DEFAULT_REVIEWS);
        setSeenFilms(DEFAULT_SEEN);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      user,
      loadReviews,
      loadSeen,
    ],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ───────────────────────────────────────────────────────────────────────────
  // DERIVED
  // ───────────────────────────────────────────────────────────────────────────

  const sortedReviews = useMemo(
    () =>
      [...reviews].sort(
        (a, b) =>
          (b.likes ?? 0) -
          (a.likes ?? 0),
      ),
    [reviews],
  );

  const sortedSeen = useMemo(
    () =>
      [...seenFilms].sort(
        (a, b) =>
          b.rating -
            a.rating ||
          a.title.localeCompare(
            b.title,
          ),
      ),
    [seenFilms],
  );

  const fmt = useCallback(
    (n: number) => {
      if (n >= 1_000_000) {
        return `${(
          n / 1_000_000
        ).toFixed(1)}M`;
      }

      if (n >= 1_000) {
        return `${(
          n / 1_000
        ).toFixed(
          n >= 10_000 ? 0 : 1,
        )}K`;
      }

      return `${n}`;
    },
    [],
  );

  if (!user) {
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 0
  // ───────────────────────────────────────────────────────────────────────────

  function renderMainContent() {
    if (loading) {
      return (
        <View>
          <SkeletonSection
            accentColor={G.gold}
          />

          <SkeletonSection
            accentColor={G.amber}
          />

          <SkeletonSection
            accentColor={G.cyan}
          />

          <View
            style={{
              height: 80,
            }}
          />
        </View>
      );
    }

    return (
      <View>

   {/* ── SECTION 1 — Favoris ── */}
   <SectionHeader
          icon="trophy"
          label="Films favoris"
          subtitle="Tes œuvres préférées"
          count={favWorks.length}
          accentColor={G.gold}
          onViewAll={() => router.push('/profile/favorites' as any)}
        />

        {favWorks.length === 0 ? (
          <EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegarde tes films avec l'étoile" />
        ) : (
          <HScrollRow>
            {favWorks.map((film, idx) => (
              <SeenCard
                key={`fav-${film.id}`}
                film={film}
                rank={idx + 1}
                onPress={() => router.push(`/film/${film.id}` as any)}
              />
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* CRITIQUES */}

        <SectionHeader
          icon="pencil"
          label="Critiques"
          subtitle="Classées par popularité"
          accentColor={G.amber}
          onViewAll={() =>
            router.push(
              '/profile/reviews' as any,
            )
          }
        />

        {sortedReviews.length ===
        0 ? (
          <EmptyState
            icon="chatbubble-outline"
            text="Aucune critique publiée"
          />
        ) : (
          <HScrollRow>
            {sortedReviews.map(
              (rev, idx) => (
                <CritiqueCard
                  key={rev.id}
                  review={rev}
                  rank={idx + 1}
                  onPress={() =>
                    router.push(
                      `/review/${rev.id}` as any,
                    )
                  }
                />
              ),
            )}
          </HScrollRow>
        )}

        <View style={pg.divider} />

       {/* VUS */}

       <SectionHeader
          icon="eye"
          label="Films & Séries visionnés"
          subtitle="Votre historique de visionnage"
          accentColor={G.cyan}
          onViewAll={() =>
            router.push(
              '/profile/seen_films' as any,
            )
          }
        />

        {watchedWorks.length ===
        0 ? (
          <EmptyState
            icon="film-outline"
            text="Aucun visionnage"
            subtext="Marque des films comme vus"
          />
        ) : (
          <HScrollRow>
            {watchedWorks.map(
              (film, idx) => (
                <SeenCard
                  key={film.id}
                  film={{
                    id: String(film.id),
                    title: film.title,
                    posterUrl: resolveImage(film.id, film.image),
                    genre: film.genre,
                    type: film.category === 'série' ? 'série' : 'film',
                    rating: 0,
                  }}
                  rank={idx + 1}
                  onPress={() =>
                    goFilm(film as any)
                  }
                />
              ),
            )}
          </HScrollRow>
        )}

        <View style={pg.divider} />

           {/* RECOMMANDATIONS */}
           <SectionHeader
          icon="sparkles"
          label="Recommandés pour vous"
          subtitle="Basé sur vos goûts"
          accentColor="#fff"
        />

        {recommendations.length === 0 ? (
          <EmptyState
            icon="planet-outline"
            text="Aucune recommandation"
            subtext="Regarde plus de films pour améliorer l'algorithme"
          />
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }} // Conserve la marge de l'écran, mais pas entre les cartes
            style={{ paddingBottom: 8 }}
          >
            {recommendations.map((film) => (
              <PortraitCard
                key={`rec-${film.id}`}
                item={film}
                 
              />
            ))}
          </ScrollView>
        )}


        <View
          style={{
            height: 110,
          }}
        />
      </View>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1
  // ───────────────────────────────────────────────────────────────────────────

  function renderReelsContent() {
    const sections = [
      {
        label:
          'Courts métrages',
        subtitle:
          'Sélection festival',
        icon: 'videocam' as const,
        data: OWN_REELS,
        route:
          '/profile/reels',
        itemRoute: '/reel/',
      },
      {
        label:
          'Moyens métrages',
        subtitle:
          'Sélection festival',
        icon: 'tv' as const,
        data: OWN_EPISODES_MID,
        route:
          '/profile/episodes-mid',
        itemRoute:
          '/episode/',
      },
      {
        label:
          'Mini-séries',
        subtitle:
          'Sélection festival',
        icon: 'film' as const,
        data: OWN_EPISODES_LONG,
        route:
          '/profile/episodes-long',
        itemRoute:
          '/episode/',
      },
    ];

    return (
      <View>
        {sections.map(
          (s, si) => (
            <View key={s.label}>
              <SectionHeader
                icon={s.icon}
                label={`Mes ${s.label.toLowerCase()}`}
                subtitle={
                  s.subtitle
                }
                accentColor={
                  G.primary
                }
                onViewAll={() =>
                  router.push(
                    s.route as any,
                  )
                }
              />

              <HScrollRow
                paddingBottom={8}
              >
                {s.data.map(
                  (item) => (
                    <ReelCard
                      key={item.id}
                      reel={item}
                      onPress={() => router.push(
                        `${s.itemRoute}${item.id}` as any
                      )} rank={0}                    />
                  ),
                )}
              </HScrollRow>

              {si <
                sections.length -
                  1 && (
                <View
                  style={
                    pg.divider
                  }
                />
              )}
            </View>
          ),
        )}

        <View
          style={{
            height: 110,
          }}
        />
      </View>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <View style={pg.root}>
      <StatusBar style="light" />

      <GalaxyBackground />

      <Animated.ScrollView
        showsVerticalScrollIndicator={
          false
        }
        onScroll={Animated.event(
          [
            {
              nativeEvent: {
                contentOffset: {
                  y: scrollY,
                },
              },
            },
          ],
          {
            useNativeDriver: true,
          },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() => {
              setRefreshing(
                true,
              );

              loadData();
            }}
            tintColor={
              G.primary
            }
          />
        }
      >
        <SafeAreaView
          edges={['top']}
        >
          <LinearGradient
            colors={[
              'rgba(13,13,18,0.55)',
              'transparent',
            ]}
            style={
              pg.topGradient
            }
            pointerEvents="none"
          />

          {/* TOP NAV */}

          <View style={pg.topNav}>
            <View
              style={
                pg.topNavLeft
              }
            >
              <Ionicons
                name="lock-closed"
                size={11}
                color="rgba(255,255,255,0.5)"
              />

              <Text
                style={
                  pg.topNavUser
                }
              >
                {
                  user.username
                }
              </Text>

              <Ionicons
                name="chevron-down"
                size={11}
                color="rgba(255,255,255,0.4)"
              />
            </View>

            <View
              style={
                pg.topNavRight
              }
            >
              <TouchableOpacity
                style={
                  pg.navIconBtn
                }
                onPress={() =>
                  router.push(
                    '/notifications' as any,
                  )
                }
              >
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color="rgba(255,255,255,0.85)"
                />

                <View
                  style={
                    pg.notifDot
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                testID="profile-settings-btn"
                style={
                  pg.navIconBtn
                }
                onPress={() =>
                  router.push(
                    '/settings',
                  )
                }
              >
                <Ionicons
                  name="settings-outline"
                  size={21}
                  color="rgba(255,255,255,0.85)"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  pg.navIconBtn
                }
                onPress={() =>
                  router.push(
                    '/backoffice/universe-admin' as any,
                  )
                }
              >
                <Ionicons
                  name="eye-outline"
                  size={21}
                  color="rgba(255,255,255,0.85)"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* AVATAR */}

          <View style={pg.avatarRow}>
            <View
              style={
                pg.avatarWrap
              }
            >
              <ImageWithFallback
                uri={
                  user.avatar_url ??
                  `https://i.pravatar.cc/150?u=${user.id}`
                }
                style={
                  pg.avatar
                }
                fallbackColors={[
                  G.surface,
                  G.bg,
                ]}
              />

              <View
                style={
                  pg.avatarRing
                }
                pointerEvents="none"
              />
            </View>

            <View
              style={
                pg.statsRow
              }
            >
              <StatColumn
                value={`${
                  user.films_seen_count ??
                  seenFilms.length
                }`}
                label="films"
              />

              <View
                style={
                  pg.statDivider
                }
              />

              <StatColumn
                value={fmt(
                  user.followers_count ??
                    2840,
                )}
                label="critiques"
              />

              <View
                style={
                  pg.statDivider
                }
              />

              <StatColumn
                value={fmt(
                  user.following_count ??
                    318,
                )}
                label="festivals"
              />
            </View>
          </View>

          {/* BIO */}

          <View style={pg.bioRow}>
            <BlurView
              intensity={20}
              tint="dark"
              style={
                pg.rolePill
              }
            >
              <Text
                style={
                  pg.rolePillTxt
                }
              >
                {user.role ===
                'critic'
                  ? '✍️ Critique'
                  : user.role ===
                    'creator'
                  ? '⭐ Créateur·rice'
                  : '🎬 Réalisateur·rice'}
              </Text>
            </BlurView>

            {(user as any)
              .is_industry_contact && (
              <BlurView
                intensity={20}
                tint="dark"
                style={
                  pg.rolePill
                }
              >
                <Text
                  style={
                    pg.rolePillTxt
                  }
                >
                  📧 Contactable
                </Text>
              </BlurView>
            )}

            <Pressable
              style={
                pg.editBtn
              }
              onPress={() =>
                router.push(
                  '/profile/edit' as any,
                )
              }
            >
              <Text
                style={
                  pg.editBtnTxt
                }
              >
                Modifier
              </Text>
            </Pressable>
          </View>

          <View style={pg.glowSep} />
        </SafeAreaView>

        {/* TAB BAR */}

        <View style={pg.tabBar}>
          {TAB_ICONS.map(
            (
              {
                icon,
                label,
              },
              idx,
            ) => {
              const active =
                activeTab ===
                idx;

              return (
                <TouchableOpacity
                  key={icon}
                  style={
                    pg.tabItem
                  }
                  onPress={() =>
                    setActiveTab(
                      idx as GridTab,
                    )
                  }
                  activeOpacity={
                    0.75
                  }
                >
                  <Ionicons
                    name={
                      active
                        ? (icon.replace(
                            '-outline',
                            '',
                          ) as any)
                        : icon
                    }
                    size={20}
                    color={
                      active
                        ? G.primary
                        : 'rgba(255,255,255,0.28)'
                    }
                  />

                  <Text
                    style={[
                      pg.tabLabel,
                      active &&
                        pg.tabLabelActive,
                    ]}
                  >
                    {label}
                  </Text>

                  {active && (
                    <View
                      style={[
                        pg.tabIndicator,
                        {
                          backgroundColor:
                            G.primary,
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            },
          )}
        </View>

        {/* CONTENT */}

        {activeTab === 0 &&
          renderMainContent()}

        {activeTab === 1 &&
          renderReelsContent()}

        {activeTab === 2 && (
          <EmptyState
            icon="pricetag-outline"
            text="Aucun tag"
            subtext="Les films où vous êtes tagué apparaissent ici"
          />
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal:
      H_PADDING,
    paddingTop: 22,
    paddingBottom: 12,
  },

  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },

  titleBar: {
    height: 12,
    width: 120,
    borderRadius: 6,
    backgroundColor:
      'rgba(255,255,255,0.06)',
  },

  numCol: {
    width: NUM_W,
    height: CARD_H,
    justifyContent:
      'flex-start',
    paddingTop: 6,
  },

  ghostNum: {
    height: 68,
    width: 38,
    backgroundColor:
      'rgba(255,255,255,0.04)',
    borderRadius: 6,
    alignSelf: 'flex-end',
  },

  ghostCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 13,
    backgroundColor:
      G.surface,
    overflow: 'hidden',
  },
});


const pg = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: G.bg,
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },

  topNav: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    paddingHorizontal:
      H_PADDING,
    paddingVertical: 10,
  },

  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  topNavUser: {
    fontSize: 17,
    fontWeight: '800',
    color: G.text,
  },

  navIconBtn: {
    padding: 6,
    position: 'relative',
  },

  notifDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor:
      G.primary,
    borderWidth: 1.5,
    borderColor: G.bg,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal:
      H_PADDING,
    marginTop: 6,
    gap: 16,
  },

  avatarWrap: {
    position: 'relative',
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },

  avatarRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 44,
    borderWidth: 2,
    borderColor:
      'rgba(191,95,255,0.4)',
  },

  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent:
      'space-around',
    alignItems: 'center',
  },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor:
      'rgba(255,255,255,0.07)',
  },

  bioRow: {
    paddingHorizontal:
      H_PADDING,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  rolePill: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor:
      'rgba(191,95,255,0.30)',
  },

  rolePillTxt: {
    color:
      'rgba(255,255,255,0.88)',
    fontSize: 10,
    fontWeight: '700',
  },

  editBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.15)',
    backgroundColor:
      'rgba(255,255,255,0.06)',
  },

  editBtnTxt: {
    color:
      'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },

  glowSep: {
    height: 1,
    marginTop: 16,
    backgroundColor:
      'rgba(191,95,255,0.14)',
  },

  divider: {
    height: 1,
    backgroundColor:
      'rgba(255,255,255,0.04)',
    marginTop: 20,
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor:
      'rgba(255,255,255,0.07)',
    marginTop: 4,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
    position: 'relative',
  },

  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color:
      'rgba(255,255,255,0.28)',
    letterSpacing: 0.5,
    textTransform:
      'uppercase',
  },

  tabLabelActive: {
    color: G.primary,
  },

  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});