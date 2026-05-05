/**
 * components/search/HeroBanner.tsx
 *
 * Carrousel Hero auto-play :
 *  - Fetch TOUTES les œuvres de public.works (sans limit)
 *  - Auto-scroll toutes les 4s, pause sur drag manuel
 *  - Dots de pagination cappés à 10 pour lisibilité
 *  - Crossfade image au chargement
 */

import React, {
    memo, useCallback, useEffect, useMemo, useRef, useState,
  } from 'react';
  import {
    View, Text, StyleSheet, Animated, TouchableOpacity,
    Dimensions, FlatList, ListRenderItemInfo,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { useRouter }      from 'expo-router';
  
  import {
    type FilmRow, T, DIMS,
    resolveFilmImage, fetchAllWorks,
  } from './shared';
  
  const { width: W, height: H } = Dimensions.get('window');
  const HERO_H    = H * 0.50;
  const AUTO_MS   = 4000;
  const MAX_DOTS  = 10;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SKELETON
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
  // HERO SLIDE
  // ─────────────────────────────────────────────────────────────────────────────
  const HeroSlide = memo(function HeroSlide({
    item, onPress,
  }: { item: FilmRow; onPress: () => void }) {
    const fadeImg = useRef(new Animated.Value(0)).current;
  
    const onLoad  = useCallback(() =>
      Animated.timing(fadeImg, { toValue: 1, duration: 380, useNativeDriver: true }).start(),
    [fadeImg]);
    const onError = useCallback(() =>
      Animated.timing(fadeImg, { toValue: 0.55, duration: 200, useNativeDriver: true }).start(),
    [fadeImg]);
  
    return (
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={s.slide}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.navyMid }]} />
  
        <Animated.Image
          source={{ uri: resolveFilmImage(item) }}
          style={[StyleSheet.absoluteFillObject, { opacity: fadeImg }]}
          resizeMode="cover"
          onLoad={onLoad}
          onError={onError}
        />
  
        <LinearGradient
          colors={['rgba(10,10,15,0.58)', 'transparent']}
          style={s.topGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.72)', T.bg]}
          style={s.botGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
  
        <View style={s.content} pointerEvents="box-none">
          <View style={[s.badge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
            <Text style={s.badgeTxt}>
              {item.is_original ? '★ ORIGINAL' : item.category.toUpperCase()}
            </Text>
          </View>
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          {item.adjective
            ? <Text style={s.adj} numberOfLines={1}>{item.adjective}</Text>
            : item.genre
              ? <Text style={s.adj} numberOfLines={1}>{item.genre} · {item.year}</Text>
              : null
          }
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
  // HERO BANNER
  // ─────────────────────────────────────────────────────────────────────────────
  export const HeroBanner = memo(function HeroBanner() {
    const router = useRouter();
  
    const [films,    setFilms]    = useState<FilmRow[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [hasError, setHasError] = useState(false);
  
    const scrollX  = useRef(new Animated.Value(0)).current;
    const flatRef  = useRef<FlatList<FilmRow>>(null);
    const timerRef = useRef<ReturnType<typeof setInterval>>();
    const isPaused = useRef(false);
    const curIdx   = useRef(0);
  
    // Fetch ALL works
    useEffect(() => {
      let dead = false;
      fetchAllWorks()
        .then(d => { if (!dead) { setFilms(d); setLoading(false); } })
        .catch(() => { if (!dead) { setHasError(true); setLoading(false); } });
      return () => { dead = true; };
    }, []);
  
    const scrollTo = useCallback((idx: number, animated = true) => {
      if (!films.length) return;
      const next = ((idx % films.length) + films.length) % films.length;
      flatRef.current?.scrollToIndex({ index: next, animated });
      curIdx.current = next;
    }, [films.length]);
  
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
  
    const onScroll = useMemo(
      () => Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false },
      ),
      [scrollX],
    );
    const onScrollBeginDrag   = useCallback(() => { isPaused.current = true; }, []);
    const onMomentumScrollEnd = useCallback((e: any) => {
      curIdx.current   = Math.round(e.nativeEvent.contentOffset.x / W);
      isPaused.current = false;
      startTimer();
    }, [startTimer]);
  
    const renderItem = useCallback(({ item }: ListRenderItemInfo<FilmRow>) => (
      <HeroSlide item={item} onPress={() => router.push(`/film/${item.id}` as any)} />
    ), [router]);
  
    const getItemLayout = useCallback((_: any, i: number) => ({
      length: W, offset: W * i, index: i,
    }), []);
    const keyExtractor = useCallback((item: FilmRow) => String(item.id), []);
  
    if (loading || hasError || films.length === 0) return <HeroSkeleton />;
  
    const dotsCount = Math.min(films.length, MAX_DOTS);
  
    return (
      <View style={s.wrap}>
        <FlatList<FilmRow>
          ref={flatRef}
          data={films}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews={false}
          bounces={false}
        />
  
        {films.length > 1 && (
          <View style={s.dots}>
            {Array.from({ length: dotsCount }).map((_, i) => {
              const op = scrollX.interpolate({
                inputRange: [(i - 1) * W, i * W, (i + 1) * W],
                outputRange: [0.35, 1, 0.35], extrapolate: 'clamp',
              });
              const w = scrollX.interpolate({
                inputRange: [(i - 1) * W, i * W, (i + 1) * W],
                outputRange: [6, 20, 6], extrapolate: 'clamp',
              });
              return (
                <TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={8}>
                  <Animated.View style={[s.dot, { opacity: op, width: w }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  });
  
  const s = StyleSheet.create({
    wrap:    { height: HERO_H, width: W, overflow: 'hidden' },
    slide:   { width: W, height: HERO_H },
    topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
    botGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' as any },
    content: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 52, gap: 8 },
    badge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, marginBottom: 2 },
    badgeTxt: { color: T.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    title:    { color: T.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, lineHeight: 35 },
    adj:      { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic' },
    actions:  { flexDirection: 'row', gap: 12, marginTop: 6 },
    playBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: T.white, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
    playTxt:  { color: T.navyMid, fontSize: 15, fontWeight: '700' },
    infoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    infoTxt:  { color: T.white, fontSize: 15, fontWeight: '600' },
    dots:     { position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
    dot:      { height: 5, borderRadius: 3, backgroundColor: T.blue },
    // Skeleton
    skContent: { position: 'absolute', bottom: 0, left: 22, right: 22, paddingBottom: 52, gap: 10 },
    skBadge:   { width: 72,           height: 22, borderRadius: 7,  backgroundColor: 'rgba(255,255,255,0.10)' },
    skTitle:   { width: '78%' as any, height: 32, borderRadius: 8,  backgroundColor: 'rgba(255,255,255,0.10)' },
    skAdj:     { width: '52%' as any, height: 16, borderRadius: 6,  backgroundColor: 'rgba(255,255,255,0.07)' },
    skActions: { width: '65%' as any, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 6 },
  });