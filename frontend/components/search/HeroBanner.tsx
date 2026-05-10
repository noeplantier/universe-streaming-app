/**
 * components/search/HeroBanner.tsx — v3.0
 *
 * ── POURQUOI "affichage partiel" ─────────────────────────────────────────────
 *
 *   Supabase PostgREST applique une limite par défaut de 1 000 lignes par
 *   requête. Même sans `.limit()`, au-delà de 1 000 œuvres la réponse est
 *   tronquée silencieusement.
 *
 * ── FIX : pagination par batch ───────────────────────────────────────────────
 *
 *   `fetchAllWorksBatched()` enchaîne des `.range(from, from+BATCH-1)` jusqu'à
 *   ce que la réponse soit vide ou incomplète → toutes les lignes sont chargées.
 *
 *   Colonnes sélectionnées = uniquement celles affichées dans le banner :
 *     id, title, category, genre, year, likes, image, is_original, adjective
 *   → charge utile minimale (évite de transférer description, cast_list, etc.)
 *
 * ── OPTIMISATIONS SUPPLÉMENTAIRES ────────────────────────────────────────────
 *   • getItemLayout O(1) → pas de mesure dynamique même sur 10 000 items
 *   • windowSize=5, initialNumToRender=2, maxToRenderPerBatch=3
 *   • removeClippedSubviews=false → aucun flash noir
 *   • Image crossfade au chargement + fallback picsum déterministe
 *   • Auto-scroll avec guard isPaused + correction d'index après drag
 *   • Dots cappés à MAX_DOTS=12 pour lisibilité
 */

import React, {
    memo, useCallback, useEffect, useMemo, useRef, useState,
  } from 'react';
  import {
    View, Text, StyleSheet, Animated, TouchableOpacity,
    Dimensions, FlatList, type ListRenderItemInfo,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { useRouter }      from 'expo-router';
  
  import { supabase } from '@/lib/supabase';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DIMENSIONS & CONSTANTES
  // ─────────────────────────────────────────────────────────────────────────────
  const { width: W, height: H } = Dimensions.get('window');
  const HERO_H   = H * 0.50;
  const AUTO_MS  = 4_000;   // rotation auto (ms)
  const BATCH    = 1_000;   // lignes par requête Supabase
  const MAX_DOTS = 12;      // max indicateurs visibles
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DESIGN TOKENS (inline pour éviter une dépendance sur shared.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const T = {
    bg:         '#0A0A0F',
    navyMid:    '#0D2240',
    navyBright: '#1E4A7A',
    blue:       '#5A96E6',
    white:      '#FFFFFF',
  } as const;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TYPE — colonnes strictement nécessaires pour le banner
  // (évite de sélectionner description, cast_list, etc.)
  // ─────────────────────────────────────────────────────────────────────────────
  interface BannerFilm {
    id:          number;
    title:       string;
    category:    string;
    genre:       string;
    year:        number;
    likes:       number;
    image:       string | null;
    is_original: boolean;
    adjective:   string | null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // IMAGE — résolution Supabase Storage ou URL directe
  // ─────────────────────────────────────────────────────────────────────────────
  function resolveImage(film: BannerFilm): string {
    const { image, id } = film;
    if (!image) return `https://picsum.photos/seed/work_${id}/800/600`;
    if (image.startsWith('http')) return image;
    const { data } = supabase.storage
      .from('community-images')
      .getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/800/600`;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH — pagination par batch pour contourner la limite PostgREST (1 000 rows)
  //
  //   Supabase PostgREST tronque silencieusement les résultats à sa limite
  //   de page (défaut : 1 000 lignes). Cette fonction enchaîne des requêtes
  //   `.range()` jusqu'à ce que la dernière page soit incomplète ou vide.
  // ─────────────────────────────────────────────────────────────────────────────
  async function fetchAllWorksBatched(): Promise<BannerFilm[]> {
    const results: BannerFilm[] = [];
    let from = 0;
  
    // Colonnes strictement nécessaires → charge utile minimale
    const COLS = 'id, title, category, genre, year, likes, image, is_original, adjective';
  
    while (true) {
      const { data, error } = await supabase
        .from('works')
        .select(COLS)
        .order('likes', { ascending: false })
        .range(from, from + BATCH - 1);
  
      if (error) {
        console.error('[HeroBanner] fetchAllWorksBatched:', error.message);
        break;
      }
  
      if (!data?.length) break;                    // plus de données
  
      results.push(...(data as BannerFilm[]));
      if (data.length < BATCH) break;              // dernière page incomplète → terminé
      from += BATCH;                               // page suivante
    }
  
    return results;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SKELETON — shimmer pendant le chargement
  // ─────────────────────────────────────────────────────────────────────────────
  const HeroSkeleton = memo(function HeroSkeleton() {
    const op = useRef(new Animated.Value(0.25)).current;
  
    useEffect(() => {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(op, { toValue: 0.5,  duration: 850, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.25, duration: 850, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }, [op]);
  
    return (
      <Animated.View style={[s.wrap, { backgroundColor: T.navyMid, opacity: op }]}>
        <View style={s.skContent}>
          <View style={s.skBadge} />
          <View style={s.skTitle} />
          <View style={s.skAdj} />
          <View style={s.skActions} />
        </View>
      </Animated.View>
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HERO SLIDE — slide individuelle du carousel
  // ─────────────────────────────────────────────────────────────────────────────
  const HeroSlide = memo(function HeroSlide({
    item, onPress,
  }: { item: BannerFilm; onPress: () => void }) {
    const fade = useRef(new Animated.Value(0)).current;
  
    const onLoad  = useCallback(() =>
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start(),
    [fade]);
    const onError = useCallback(() =>
      Animated.timing(fade, { toValue: 0.6, duration: 200, useNativeDriver: true }).start(),
    [fade]);
  
    const imgUri = useMemo(() => resolveImage(item), [item.image, item.id]);
  
    return (
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={s.slide}>
  
        {/* Fond visible pendant le chargement */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.navyMid }]} />
  
        {/* Image principale — crossfade à l'arrivée */}
        <Animated.Image
          source={{ uri: imgUri }}
          style={[StyleSheet.absoluteFillObject, { opacity: fade }]}
          resizeMode="cover"
          onLoad={onLoad}
          onError={onError}
        />
  
        {/* Gradients de lisibilité */}
        <LinearGradient
          colors={['rgba(10,10,15,0.58)', 'transparent']}
          style={s.topGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.75)', T.bg]}
          style={s.botGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
  
        {/* Contenu textuel + CTA */}
        <View style={s.content} pointerEvents="box-none">
  
          {/* Badge catégorie */}
          <View style={[s.badge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
            <Text style={s.badgeTxt}>
              {item.is_original ? '★ ORIGINAL' : item.category.toUpperCase()}
            </Text>
          </View>
  
          {/* Titre */}
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
  
          {/* Sous-titre : adjective > genre · year */}
          {item.adjective
            ? <Text style={s.adj} numberOfLines={1}>{item.adjective}</Text>
            : <Text style={s.adj} numberOfLines={1}>{item.genre} · {item.year}</Text>
          }
  
          {/* Boutons */}
          <View style={s.actions}>
            <TouchableOpacity style={s.playBtn} onPress={onPress} activeOpacity={0.85}>
              <Ionicons name="play" size={16} color={T.navyMid} />
              <Text style={s.playTxt}>Regarder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.infoBtn} onPress={onPress} activeOpacity={0.80}>
              <Ionicons name="information-circle-outline" size={16} color={T.white} />
              <Text style={s.infoTxt}>Infos</Text>
            </TouchableOpacity>
          </View>
  
        </View>
      </TouchableOpacity>
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HERO BANNER — composant principal exporté
  // ─────────────────────────────────────────────────────────────────────────────
  export const HeroBanner = memo(function HeroBanner() {
    const router = useRouter();
  
    const [films,   setFilms]   = useState<BannerFilm[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(false);
  
    // Refs scroll / timer — jamais de re-render pour eux
    const scrollX  = useRef(new Animated.Value(0)).current;
    const flatRef  = useRef<FlatList<BannerFilm>>(null);
    const timerRef = useRef<ReturnType<typeof setInterval>>();
    const isPaused = useRef(false);
    const curIdx   = useRef(0);
    const lenRef   = useRef(0);   // miroir stable de films.length pour les callbacks
  
    // ── Fetch — pagination par batch ──────────────────────────────────────────
    useEffect(() => {
      let dead = false;
      setLoading(true); setError(false);
  
      fetchAllWorksBatched()
        .then(data => {
          if (dead) return;
          lenRef.current = data.length;
          setFilms(data);
          setLoading(false);
        })
        .catch(() => {
          if (!dead) { setError(true); setLoading(false); }
        });
  
      return () => { dead = true; };
    }, []);
  
    // ── Scroll programmatique ──────────────────────────────────────────────────
    const scrollTo = useCallback((idx: number, animated = true) => {
      const len = lenRef.current;
      if (len === 0) return;
      const next = ((idx % len) + len) % len;   // wrap circulaire
      flatRef.current?.scrollToIndex({ index: next, animated });
      curIdx.current = next;
    }, []);
  
    // ── Timer auto-rotation ────────────────────────────────────────────────────
    const startTimer = useCallback(() => {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!isPaused.current) scrollTo(curIdx.current + 1);
      }, AUTO_MS);
    }, [scrollTo]);
  
    useEffect(() => {
      if (films.length < 2) return;
      startTimer();
      return () => clearInterval(timerRef.current);
    }, [films.length, startTimer]);
  
    // ── Handlers FlatList ──────────────────────────────────────────────────────
    const onScroll = useMemo(
      () => Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false },   // false car interpolation width (non-natif)
      ),
      [scrollX],
    );
  
    const onScrollBeginDrag   = useCallback(() => { isPaused.current = true; }, []);
    const onMomentumScrollEnd = useCallback((e: any) => {
      curIdx.current   = Math.round(e.nativeEvent.contentOffset.x / W);
      isPaused.current = false;
      startTimer();   // relance le timer depuis le nouvel index
    }, [startTimer]);
  
    // ── Render items ───────────────────────────────────────────────────────────
    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<BannerFilm>) => (
        <HeroSlide item={item} onPress={() => router.push(`/film/${item.id}` as any)} />
      ),
      [router],
    );
  
    // O(1) — indispensable pour grandes listes horizontales
    const getItemLayout = useCallback(
      (_: any, index: number) => ({ length: W, offset: W * index, index }),
      [],
    );
  
    const keyExtractor = useCallback((item: BannerFilm) => String(item.id), []);
  
    // Sécurité scrollToIndex sur items pas encore rendus
    const onScrollToIndexFailed = useCallback(
      ({ index }: { index: number }) => {
        flatRef.current?.scrollToOffset({ offset: index * W, animated: false });
      },
      [],
    );
  
    // ── États vides / erreur ────────────────────────────────────────────────────
    if (loading || error || films.length === 0) return <HeroSkeleton />;
  
    // Dots : on en affiche au max MAX_DOTS (lisibilité)
    // Si plus d'items, ils défilent quand même tous dans le carousel
    const dotsCount = Math.min(films.length, MAX_DOTS);
  
    // ── RENDER ─────────────────────────────────────────────────────────────────
    return (
      <View style={s.wrap}>
        <FlatList<BannerFilm>
          ref={flatRef}
          data={films}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
  
          // Scroll horizontal paginé
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          bounces={false}
  
          // Layout O(1) — essentiel sur de grandes listes
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={onScrollToIndexFailed}
  
          // Handlers scroll
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
  
          // Perf : fenêtre de rendu réduite au nécessaire
          // windowSize=5 = slide active ± 2 de chaque côté pré-rendues
          windowSize={5}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={50}
  
          // CRITIQUE : false évite les flashs noirs sur Android
          removeClippedSubviews={false}
        />
  
        {/* Dots de pagination — MAX_DOTS max */}
        {films.length > 1 && (
          <View style={s.dots}>
            {Array.from({ length: dotsCount }).map((_, i) => {
              const op = scrollX.interpolate({
                inputRange:  [(i - 1) * W, i * W, (i + 1) * W],
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              });
              const w = scrollX.interpolate({
                inputRange:  [(i - 1) * W, i * W, (i + 1) * W],
                outputRange: [6, 20, 6],
                extrapolate: 'clamp',
              });
              return (
                <TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={10}>
                  <Animated.View style={[s.dot, { opacity: op, width: w }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
  
        {/* Compteur discret (utile pour debug / UX) */}
        {films.length > MAX_DOTS && (
          <View style={s.counter} pointerEvents="none">
            <Text style={s.counterTxt}>{films.length} œuvres</Text>
          </View>
        )}
      </View>
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    // Conteneur
    wrap:  { height: HERO_H, width: W, overflow: 'hidden' },
    slide: { width: W, height: HERO_H },
  
    // Gradients
    topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
    botGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' as any },
  
    // Contenu textuel
    content: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 22, paddingBottom: 52, gap: 8,
    },
    badge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, marginBottom: 2 },
    badgeTxt: { color: T.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    title:    { color: T.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, lineHeight: 35 },
    adj:      { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic' },
  
    // Boutons
    actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
    playBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: T.white, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22,
    },
    playTxt: { color: T.navyMid, fontSize: 15, fontWeight: '700' },
    infoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    },
    infoTxt: { color: T.white, fontSize: 15, fontWeight: '600' },
  
    // Dots
    dots: {
      position: 'absolute', bottom: 18, left: 0, right: 0,
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5,
    },
    dot: { height: 5, borderRadius: 3, backgroundColor: T.blue },
  
    // Compteur (affiché si > MAX_DOTS œuvres)
    counter: {
      position: 'absolute', bottom: 22, right: 18,
    },
    counterTxt: {
      color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600',
    },
  
    // Skeleton
    skContent: {
      position: 'absolute', bottom: 0, left: 22, right: 22, paddingBottom: 52, gap: 10,
    },
    skBadge:   { width: 72,           height: 22, borderRadius: 7,  backgroundColor: 'rgba(255,255,255,0.10)' },
    skTitle:   { width: '78%' as any, height: 32, borderRadius: 8,  backgroundColor: 'rgba(255,255,255,0.10)' },
    skAdj:     { width: '52%' as any, height: 16, borderRadius: 6,  backgroundColor: 'rgba(255,255,255,0.07)' },
    skActions: { width: '65%' as any, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 6 },
  });
