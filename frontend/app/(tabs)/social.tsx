// ─────────────────────────────────────────────────────────────────────────────
// app/social.tsx  —  Écran Communauté
//
// Orchestrateur fin :
//   · SocialProvider fournit le state global (likes, saves, follows, posts…)
//   · FlatList Animated avec pull-to-refresh simulé
//   · Header "Communauté" + ComposeModal + FilterTabs + StoryRail
//   · PostCard mémoïsé par id (pas de re-render inutile)
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useCallback, useRef, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Animated, RefreshControl,
  TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useRouter }     from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Components sociaux
import { SocialProvider, useSocial } from '@/components/social/SocialContext';
import GalaxyBackground              from '@/components/social/GalaxyBackground';
import StoryRail                     from '@/components/social/StoryRail';
import PostCard                      from '@/components/social/PostCard';
import ComposeModal                  from '@/components/social/ComposeModal';

import { G, FEED_TABS, TAB_FILTER } from '@/components/social/types';
import type { FeedTab, PostData }   from '@/components/social/types';

const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

const SocialHeader = React.memo(function SocialHeader({
  onCompose,
}: { onCompose: () => void }) {
  const router = useRouter();
  return (
    <View style={hdr.row}>
      <View>
        <Text style={hdr.title}>Communauté</Text>
        <Text style={hdr.sub}>Le QG du cinéma indépendant</Text>
      </View>
      <View style={hdr.actions}>
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={20} color="white" />
          <View style={hdr.dot} />
        </TouchableOpacity>
        <TouchableOpacity style={[hdr.btn, hdr.composeBtn]} onPress={onCompose} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const hdr = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 10, paddingBottom: 16 },
  title:      { fontSize: 28, fontWeight: '800', color: G.sW, letterSpacing: -0.5 },
  sub:        { fontSize: 12, color: G.sB, opacity: 0.55, marginTop: 2 },
  actions:    { flexDirection: 'row', gap: 10 },
  btn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  composeBtn: { backgroundColor: G.primaryDim, borderColor: 'rgba(192,96,255,0.35)' },
  dot:        { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: G.bg1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Barre compose (tappable → ouvre ComposeModal)
// ─────────────────────────────────────────────────────────────────────────────

const ComposeBar = React.memo(function ComposeBar({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={cb.wrap} onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s' }} style={cb.avi} />
      <View style={cb.box}>
        <Text style={cb.ph}>Partagez votre analyse, votre critique…</Text>
        <Ionicons name="film-outline" size={18} color="rgba(237,232,255,0.28)" />
      </View>
    </TouchableOpacity>
  );
});

const cb = StyleSheet.create({
  wrap: { flexDirection: 'row', paddingHorizontal: EDGE, gap: 12, marginBottom: 10, alignItems: 'center' },
  avi:  { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: 'rgba(192,96,255,0.4)' },
  box:  { flex: 1, height: 46, borderRadius: 23, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between' },
  ph:   { color: 'rgba(237,232,255,0.35)', fontSize: 14 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabs de filtre
// ─────────────────────────────────────────────────────────────────────────────

const FilterTabs = React.memo(function FilterTabs({
  active, set,
}: { active: FeedTab; set: (t: FeedTab) => void }) {
  return (
    <View style={ft.row}>
      {FEED_TABS.map(t => {
        const on = active === t;
        return (
          <TouchableOpacity key={t} onPress={() => set(t)} style={ft.pill} activeOpacity={0.8}>
            <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
            {on && (
              <LinearGradient
                colors={[G.primary, '#86EEFF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={ft.line}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const ft = StyleSheet.create({
  row:   { flexDirection: 'row', paddingHorizontal: EDGE, gap: 24, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  pill:  { paddingBottom: 14, alignItems: 'center', position: 'relative' },
  txt:   { color: 'rgba(237,232,255,0.45)', fontSize: 15, fontWeight: '600' },
  txtOn: { color: G.sW, fontWeight: '800' },
  line:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// État vide
// ─────────────────────────────────────────────────────────────────────────────

const EmptyFeed = React.memo(function EmptyFeed() {
  return (
    <View style={ef.wrap}>
      <Ionicons name="film-outline" size={52} color="rgba(255,255,255,0.08)" />
      <Text style={ef.txt}>Aucune publication dans cet onglet</Text>
    </View>
  );
});

const ef = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 70, gap: 14 },
  txt:  { color: 'rgba(255,255,255,0.25)', fontSize: 15 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Corps du feed (consomme le context → doit être DANS SocialProvider)
// ─────────────────────────────────────────────────────────────────────────────

function FeedBody() {
  const { posts } = useSocial();

  const [tab,         setTab]         = useState<FeedTab>('Pour vous');
  const [refreshing,  setRefreshing]  = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Filtrage
  const filtered = useMemo(
    () => posts.filter(TAB_FILTER[tab] ?? (() => true)),
    [posts, tab],
  );

  // Pull-to-refresh simulé
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  // Header du FlatList (mémoïsé par tab pour éviter remount au scroll)
  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)} />
      <StoryRail />
      <View style={{ height: 10 }} />
      <ComposeBar onPress={() => setComposeOpen(true)} />
      <FilterTabs active={tab} set={setTab} />
    </>
  ), [tab]);

  const renderItem = useCallback(
    ({ item }: { item: PostData }) => <PostCard key={item.id} post={item} />,
    [],
  );

  const keyExtractor = useCallback((item: PostData) => item.id, []);

  return (
    <>
      <ComposeModal visible={composeOpen} onClose={() => setComposeOpen(false)} />

      <Animated.FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={sc.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={refreshing ? null : <EmptyFeed />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={G.primary}
            colors={[G.primary]}
          />
        }
        removeClippedSubviews
        windowSize={6}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={60}
        initialNumToRender={5}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal — enveloppe le tout dans SocialProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function SocialScreen() {
  return (
    <SocialProvider>
      <View style={sc.root}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <FeedBody />
        </SafeAreaView>
      </View>
    </SocialProvider>
  );
}

const sc = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg0 },
  listContent: { paddingBottom: 110 },
});