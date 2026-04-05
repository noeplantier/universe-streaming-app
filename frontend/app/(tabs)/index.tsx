import React, {
  useState, useRef, useCallback,
} from 'react';
import {
  View, StyleSheet, FlatList, Animated, Modal, Platform,
} from 'react-native';
import { StatusBar }                           from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useWindowDimensions }                 from 'react-native';
import { useRouter, useFocusEffect }           from 'expo-router';
import * as Haptics                            from 'expo-haptics';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';


// Composants reels
import FeedItem      from '@/components/reels/FeedItem';
import TopHeader     from '@/components/reels/TopHeader';

// Data & types
import { MOCK_FEED }   from '@/components/reels/mockData';
import type { FeedFilm } from '@/components/reels/types';

// Sidebar
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';

// ─────────────────────────────────────────────────────────────────────────────

export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const ITEM_H  = H;   // plein écran réel (notch inclus)

  // ── État global ───────────────────────────────────────────────────────────
  const [feedFilms,     setFeedFilms]     = useState<FeedFilm[]>(MOCK_FEED);
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [activeTab,     setActiveTab]     = useState('reels');

  const scrollY = useRef(new Animated.Value(0)).current;


    // ── TEST SUPABASE ────────────────────────────────────────────────────────
    useEffect(() => {
      // ── TEST SUPABASE FRONTEND ──────────────────────────────────────────────
      async function testSupabase() {
        console.log('⏳ Test Supabase depuis le frontend (Feed)...');
        try {
          // Remplacez 'films' par 'films' ou 'profiles' selon votre schéma
          const { data, error } = await supabase.from('films').select('*').limit(1);
          if (error) {
            console.error('❌ Erreur Supabase front:', error.message);
          } else {
            console.log('✅ Succès Supabase front ! Données:', data);
          }
        } catch (err) {
          console.error('❌ Exception Supabase front:', err);
        }
      }

      testSupabase(); // Appel du test
      const loadData = async () => {
        // Simule un chargement de données
        await new Promise(resolve => setTimeout(resolve, 1000));
        setFeedFilms(MOCK_FEED); // Charge les données mock après le délai
      };
    }, []);


  // ── Pause globale quand on quitte l'onglet ────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ── Viewability config ────────────────────────────────────────────────────
  // 70 % visible → item considéré actif
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 });

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setActiveIndex(idx);
    }
  }, []);

  // ── Follow friend (propagé dans tout le feed) ─────────────────────────────
  const handleFollowFriend = useCallback((fid: string) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeedFilms(prev =>
      prev.map(film => ({
        ...film,
        liked_by_friends: film.liked_by_friends.map(f =>
          f.id === fid ? { ...f, followed: true } : f,
        ),
      })),
    );
  }, []);

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: FeedFilm; index: number }) => (
    <FeedItem
      film={item}
      isActive={index === activeIndex}
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" translucent />

      {/* ── Feed plein écran ────────────────────────────────────────────── */}
      <FlatList
        data={feedFilms}
        keyExtractor={keyExtractor}
        renderItem={renderItem}

        // ─ Pagination snap ─
        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"

        // ─ Viewability ─
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged}

        // ─ Layout ─
        getItemLayout={getItemLayout}

        // ─ Scroll → header opacity ─
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}

        // ─ Perf : windowSize=3 → seuls ±1 items sont montés en mémoire
        //   Chaque FeedItem crée son propre VideoPlayer → pool naturel de 3 max ─
        windowSize={3}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={60}
        initialNumToRender={1}
        removeClippedSubviews
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}

        // ─ Désactive le scroll horizontal accidentel ─
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