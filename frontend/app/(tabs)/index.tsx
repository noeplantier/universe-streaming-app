// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, StyleSheet, FlatList, Animated, Modal, Platform,
} from 'react-native';
import { StatusBar }                        from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }  from 'react-native-safe-area-context';
import { useWindowDimensions }              from 'react-native';
import { useRouter, useFocusEffect }        from 'expo-router';
import * as Haptics                         from 'expo-haptics';

// Composants reels
import FeedItem  from '@/components/reels/FeedItem';
import TopHeader from '@/components/reels/TopHeader';

// Data & types
import { MOCK_FEED }       from '@/components/reels/mockData';
import type { FeedFilm }   from '@/components/reels/types';

// Sidebar
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';

// Supabase (optionnel — fallback sur MOCK si erreur)
let supabase: any = null;
try { supabase = require('../../lib/supabase').supabase; } catch { /* pas configuré */ }

// ─────────────────────────────────────────────────────────────────────────────

export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ITEM_H = H;   // plein écran réel, notch inclus

  // ── État global ───────────────────────────────────────────────────────────
  const [feedFilms,     setFeedFilms]     = useState<FeedFilm[]>(MOCK_FEED);
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');

  const scrollY = useRef(new Animated.Value(0)).current;

  // ── activeIndex ref — toujours synchrone (évite closure stale) ───────────
  // C'est le fix essentiel : renderItem lit activeIndexRef.current
  // au moment du rendu, pas une closure capturée à la création de renderItem.
  const activeIndexRef = useRef(0);

  // ── Chargement Supabase + fallback MOCK ──────────────────────────────────
  useEffect(() => {
    async function loadFeed() {
      if (!supabase) return;        
      try {
        const { data, error } = await supabase
          .from('films')
          .select('*')
          .limit(20);
        if (error) throw error;
        if (data && data.length > 0) {
          // Mapper les colonnes Supabase vers FeedFilm si nécessaire
          // Pour l'instant on garde le MOCK et on log juste
          console.log('✅ Supabase films:', data.length);
        }
      } catch (err) {
        console.warn('⚠️ Supabase fallback MOCK:', err);
      }
    }
    loadFeed();
  }, []);

  // ── Pause globale quand on quitte l'onglet ────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ── Viewability — 60 % visible → item actif ──────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  }, []);

  // ── Follow friend ─────────────────────────────────────────────────────────
  const handleFollowFriend = useCallback((fid: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setFeedFilms(prev =>
      prev.map(film => ({
        ...film,
        liked_by_friends: film.liked_by_friends.map(f =>
          f.id === fid ? { ...f, followed: true } : f,
        ),
      })),
    );
  }, []);

  // ── Render item — isNear transmis pour le pool de players ─────────────────
  // ⚠️  On lit activeIndex depuis le state (pas le ref) pour déclencher
  //     le re-render quand il change — mais on le passe en prop directement.
  const renderItem = useCallback(
    ({ item, index }: { item: FeedFilm; index: number }) => (
      <FeedItem
        film={item}
        isActive={index === activeIndex}
        isNear={Math.abs(index - activeIndex) <= 1}
        screenFocused={screenFocused}
        itemW={W}
        itemH={ITEM_H}
        insetBot={insets.bottom}
        onFollowFriend={handleFollowFriend}
      />
    ),
    [activeIndex, screenFocused, W, ITEM_H, insets.bottom, handleFollowFriend],
  );

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_H, offset: ITEM_H * index, index,
  }), [ITEM_H]);

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" translucent />

      {/* ── Feed plein écran ────────────────────────────────────────────── */}
      <FlatList
        data={feedFilms}
        keyExtractor={keyExtractor}
        renderItem={renderItem}

        // ── Snap TikTok ─────────────────────────────────────────────────
        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"

        // ── Viewability ─────────────────────────────────────────────────
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged}

        // ── Layout ──────────────────────────────────────────────────────
        getItemLayout={getItemLayout}

        // ── Scroll → header opacity ─────────────────────────────────────
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}

        // ── Perf ────────────────────────────────────────────────────────
        // windowSize=5 : items -2/-1/0/+1/+2 restent montés
        // → transitions de scroll sans flash du poster
        windowSize={5}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        initialNumToRender={2}
        removeClippedSubviews={Platform.OS === 'android'} // iOS = false pour éviter bug VideoView
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {/* ── Header flottant (safe area top) ─────────────────────────────── */}
      <SafeAreaView edges={['top']} style={s.headerSafe} pointerEvents="box-none">
        <TopHeader
          feedKey={feedKey}
          onMenuPress={() => setMenuOpen(true)}
          scrollY={scrollY}
        />
      </SafeAreaView>

      {/* ── Sidebar modal ───────────────────────────────────────────────── */}
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

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#000' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});