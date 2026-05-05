/**
 * app/(tabs)/search.tsx
 *
 * Écran principal "Découvrir" — slim, délègue tout aux composants.
 * Adapter les imports @/components/search/* selon votre arborescence.
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Platform, Animated,
} from 'react-native';
import { StatusBar }      from 'expo-status-bar';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import {
  type Work, type SortOption, type DurationBand,
  fetchTrending, fetchWorks,
} from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

import { HeroBanner }       from '@/components/search/HeroBanner';
import { TrendingCarousel } from '@/components/search/TrendingCarousel';
import { RowSection, SearchOverlay } from '@/components/search/RowSection';
import { T } from '@/components/search/shared';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// CTA BANNER
// ─────────────────────────────────────────────────────────────────────────────
const CtaBanner = memo(function CtaBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={ms.banner} activeOpacity={0.85} onPress={onPress}>
      <BlurView intensity={25} tint="dark" style={ms.bannerBlur}>
        <View style={ms.bannerLeft}>
          <View style={ms.bannerIcon}>
            <Ionicons name="flame" size={18} color={T.gold} />
          </View>
          <View>
            <Text style={ms.bannerTitle}>Populaires cette semaine</Text>
            <Text style={ms.bannerSub}>Voir tout le classement</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={T.blue} />
      </BlurView>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();

  const [search,     setSearch]     = useState('');
  const [genre,      setGenre]      = useState('Tous');
  const [sortBy,     setSortBy]     = useState<SortOption>('Popularité');
  const [duration,   setDuration]   = useState<DurationBand>('Toutes');
  const [year,       setYear]       = useState('Toutes');
  const [searchOpen, setSearchOpen] = useState(false);
  const [works,      setWorks]      = useState<Work[]>([]);
  const [trending,   setTrending]   = useState<Work[]>([]);
  const [popular,    setPopular]    = useState<Work[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  // Debounce 350ms
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debRef.current);
  }, [search]);

  const loadWorks = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const data = await fetchWorks({ tab: 'Catégories', search: debouncedSearch, genre, sortBy, duration, year });
      setWorks(data);
    } catch { setError(true); }
    finally  { setLoading(false); }
  }, [debouncedSearch, genre, sortBy, duration, year]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  useEffect(() => {
    let dead = false;
    fetchTrending(12).then(data => {
      if (dead) return;
      setTrending(data);
      setPopular([...data].sort((a, b) => b.likes - a.likes));
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const activeFilterCount = useMemo(() => [
    genre !== 'Tous', sortBy !== 'Popularité', duration !== 'Toutes', year !== 'Toutes',
  ].filter(Boolean).length, [genre, sortBy, duration, year]);

  const resetFilters = useCallback(() => {
    setGenre('Tous'); setSortBy('Popularité'); setDuration('Toutes'); setYear('Toutes');
  }, []);

  const courtMetrage = useMemo(() => works.filter(w => (w.duration ?? 0) < 60),                              [works]);
  const moyenMetrage = useMemo(() => works.filter(w => (w.duration ?? 0) >= 60 && (w.duration ?? 0) <= 100), [works]);
  const longMetrage  = useMemo(() => works.filter(w => (w.duration ?? 0) > 100),                             [works]);

  const isFiltered = !!(debouncedSearch.trim()) || activeFilterCount > 0;
  const scrollY    = useRef(new Animated.Value(0)).current;

  return (
    <View style={ms.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Titre sticky */}
      <Animated.View
        style={[ms.stickyHeader, {
          opacity: scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0], extrapolate: 'clamp' }),
        }]}
        pointerEvents="none"
      >
        <View style={ms.stickyInner}>
          <Text style={ms.stickyTitle}>UNIVERSE</Text>
        </View>
      </Animated.View>

      {/* Boutons */}
      <View style={ms.topRight} pointerEvents="box-none">
        <TouchableOpacity style={ms.iconBtn} onPress={() => setSearchOpen(true)}>
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="search" size={22} color={T.white} />
        </TouchableOpacity>
      </View>
      <View style={ms.giftPos} pointerEvents="box-none">
        <TouchableOpacity style={ms.iconBtn} onPress={() => router.push('/cadeau' as any)}>
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="gift" size={22} color={T.white} />
        </TouchableOpacity>
      </View>

      <SearchOverlay
        visible={searchOpen} onClose={() => setSearchOpen(false)}
        search={search} setSearch={setSearch}
        works={works} loading={loading} error={error} onRetry={loadWorks}
        activeFilterCount={activeFilterCount} onResetFilters={resetFilters}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ms.scroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Hero — TOUTES les œuvres de public.works */}
        <HeroBanner />

        {isFiltered ? (
          <RowSection
            title={debouncedSearch.trim() ? `"${debouncedSearch}"` : 'Résultats'}
            subtitle={!loading && !error ? `${works.length} œuvre${works.length > 1 ? 's' : ''}` : undefined}
            items={works} loading={loading} variant="portrait"
          />
        ) : (
          <>
            <TrendingCarousel items={trending} loading={trending.length === 0} />
            <RowSection
              title="Les plus populaires" subtitle="Tous les temps"
              items={popular} loading={popular.length === 0}
              variant="portrait" showRank
              onSeeAll={() => router.push('/popular' as any)}
            />
            {(courtMetrage.length > 0 || loading) && (
              <RowSection title="Courts métrages" subtitle="Moins de 60 min" items={courtMetrage} loading={loading} variant="landscape" />
            )}
            {(moyenMetrage.length > 0 || loading) && (
              <RowSection title="Moyens métrages" subtitle="60 – 100 min" items={moyenMetrage} loading={loading} variant="landscape" />
            )}
            {(longMetrage.length > 0 || loading) && (
              <RowSection title="Longs métrages" subtitle="Plus de 100 min" items={longMetrage} loading={loading} variant="landscape" />
            )}
            <CtaBanner onPress={() => router.push('/popular' as any)} />
          </>
        )}
        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

const ms = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg },
  scroll:      { paddingBottom: 120 },
  stickyHeader:{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, height: Platform.OS === 'ios' ? 90 : 60 },
  stickyInner: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 10, marginTop: Platform.OS === 'ios' ? 44 : 0 },
  stickyTitle: { color: T.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  topRight:    { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 14, right: 18,  zIndex: 100 },
  giftPos:     { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 14, right: 66, zIndex: 100 },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.surfBorder },
  banner:      { marginHorizontal: 20, marginBottom: 20, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.surfBorder },
  bannerBlur:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bannerIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: T.goldDim, justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { color: T.text, fontSize: 15, fontWeight: '700' },
  bannerSub:   { color: T.textSec, fontSize: 12, marginTop: 2 },
});