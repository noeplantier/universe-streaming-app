// app/(tabs)/social.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Réseau social cinéma indépendant
//  Tabs : Pour vous · Tendances · Pros (répertoire + contact)
//  Sub-components : PostCard · ComposeModal · ProDirectory · ContactProModal
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useCallback, useRef, useMemo, useEffect, memo,
} from 'react';
import {
  View, Text, StyleSheet, Animated, FlatList,
  RefreshControl, TouchableOpacity, ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';

import { supabase }        from '@/lib/supabase';
import GalaxyBackground    from '@/components/social/GalaxyBackground';
import PostCard            from '@/components/social/PostCard';
import ComposeModal        from '@/components/social/ComposeModal';
import ProDirectory        from '@/components/social/ProDirectory';
import { InteractionProvider } from '@/components/social/InteractionContext';
import { usePostsFeed }    from '@/hooks/usePostsFeed';
import { C, FEED_TABS, EDGE, FeedTab, Post } from '../../components/social/SocialTokens';

// Re-export type fix
export type { FeedTab };

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING (read-only, used in ComposeBar preview)
// ─────────────────────────────────────────────────────────────────────────────
const StarRating = memo(function StarRating({
  value, size = 24, onChange,
}: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1,2,3,4,5].map(s => (
        <TouchableOpacity
          key={s}
          onPress={() => onChange?.(s)}
          disabled={!onChange}
          hitSlop={6 as any}
        >
          <Ionicons
            name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={value >= s || value >= s - 0.5 ? C.gold : C.textSec}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SocialHeader = memo(function SocialHeader({ onCompose }: { onCompose: () => void }) {
  const router = useRouter();
  return (
    <View style={hdr.row}>
      <View>
        <Text style={hdr.eyebrow}>UNIVERSE · CINÉMA</Text>
        <Text style={hdr.title}>Communauté</Text>
      </View>
      <View style={hdr.actions}>
        <TouchableOpacity
          style={hdr.btn}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={19} color={C.textSec} />
          <View style={hdr.dot} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[hdr.btn, hdr.composeBtn]}
          onPress={onCompose}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const hdr = StyleSheet.create({
  row:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:EDGE, paddingTop:10, paddingBottom:14 },
  eyebrow:    { fontSize:9, fontWeight:'700', color:C.textTert, letterSpacing:1.5, marginBottom:2 },
  title:      { fontSize:26, fontWeight:'800', color:C.text, letterSpacing:-0.5 },
  actions:    { flexDirection:'row', gap:8 },
  btn:        { width:38, height:38, borderRadius:19, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center', position:'relative' },
  composeBtn: { borderColor:C.navyBright },
  dot:        { position:'absolute', top:8, right:8, width:7, height:7, borderRadius:4, backgroundColor:C.red, borderWidth:1.5, borderColor:C.bg0 },
});

// // ─────────────────────────────────────────────────────────────────────────────
// // COMPOSE BAR
// // ─────────────────────────────────────────────────────────────────────────────
// const ComposeBar = memo(function ComposeBar({ onPress }: { onPress: () => void }) {
//   return (
//     <TouchableOpacity style={cbar.wrap} onPress={onPress} activeOpacity={0.85}>
//       <View style={cbar.leftAccent} />
//       <View style={cbar.body}>
//         <Text style={cbar.title}>Partagez votre critique</Text>
//         <Text style={cbar.sub}>Analyse · Coup de cœur · Réflexion · Déception</Text>
//         <View style={cbar.pills}>
//           {(['film-outline','star-outline','image-outline'] as const).map((icon, i) => (
//             <View key={icon} style={cbar.pill}>
//               <Ionicons name={icon} size={10} color={C.textSec} />
//               <Text style={cbar.pillTxt}>{['Œuvre','Note','Visuel'][i]}</Text>
//             </View>
//           ))}
//         </View>
//       </View>
//       <View style={cbar.addWrap}>
//         <Ionicons name="add-circle" size={28} color={C.blue} />
//       </View>
//     </TouchableOpacity>
//   );
// });

const cbar = StyleSheet.create({
  wrap:     { marginHorizontal:EDGE, marginBottom:14, borderRadius:18, borderWidth:1, borderColor:C.border, flexDirection:'row', alignItems:'center', padding:14, gap:12, backgroundColor:C.surf, overflow:'hidden' },
  leftAccent:{ width:3, height:'100%', position:'absolute', left:0, top:0, backgroundColor:C.blue, borderTopRightRadius:2, borderBottomRightRadius:2 },
  body:     { flex:1, gap:3 },
  title:    { color:C.text, fontSize:13, fontWeight:'700' },
  sub:      { color:C.textSec, fontSize:10 },
  pills:    { flexDirection:'row', gap:6, marginTop:5 },
  pill:     { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border },
  pillTxt:  { fontSize:10, fontWeight:'600', color:C.textSec },
  addWrap:  {},
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────
const FilterTabs = memo(function FilterTabs({
  active, set,
}: { active: FeedTab; set: (t: FeedTab) => void }) {
  return (
    <View style={ft.row}>
      {FEED_TABS.map(t => {
        const on = active === t;
        const isPro = t === 'Pros';
        return (
          <TouchableOpacity
            key={t}
            onPress={() => set(t)}
            style={ft.pill}
            activeOpacity={0.8}
          >
            <View style={ft.labelWrap}>
              {isPro && (
                <View style={ft.proBadge}>
                  <Ionicons name="briefcase-outline" size={9} color={C.gold} />
                </View>
              )}
              <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
            </View>
            {on && <View style={[ft.line, isPro && { backgroundColor: C.gold }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const ft = StyleSheet.create({
  row:      { flexDirection:'row', paddingHorizontal:EDGE, gap:22, marginBottom:10, borderBottomWidth:1, borderBottomColor:C.border },
  pill:     { paddingBottom:13, alignItems:'center', position:'relative' },
  labelWrap:{ flexDirection:'row', alignItems:'center', gap:5 },
  proBadge: { width:16, height:16, borderRadius:8, backgroundColor:C.goldDim, alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:C.goldEdge },
  txt:      { color:C.textSec, fontSize:14, fontWeight:'600' },
  txtOn:    { color:C.text, fontWeight:'800' },
  line:     { position:'absolute', bottom:0, left:0, right:0, height:2, borderRadius:1, backgroundColor:C.blue },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY FEED
// ─────────────────────────────────────────────────────────────────────────────
const EmptyFeed = memo(function EmptyFeed({ onCompose }: { onCompose: () => void }) {
  return (
    <View style={ef.wrap}>
      <View style={ef.iconWrap}>
        <Ionicons name="film-outline" size={36} color={C.textTert} />
      </View>
      <Text style={ef.title}>Aucune critique ici</Text>
      <Text style={ef.sub}>
        Soyez le premier à partager votre avis sur un film indépendant.
      </Text>
      <TouchableOpacity style={ef.cta} onPress={onCompose} activeOpacity={0.85}>
        <LinearGradient
          colors={[C.navyBright, C.navyLight]}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
          style={ef.ctaGrad}
        >
          <Ionicons name="create-outline" size={16} color={C.white} />
          <Text style={ef.ctaTxt}>Écrire une critique</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

const ef = StyleSheet.create({
  wrap:    { alignItems:'center', paddingVertical:80, paddingHorizontal:40, gap:12 },
  iconWrap:{ width:72, height:72, borderRadius:36, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, justifyContent:'center', alignItems:'center', marginBottom:4 },
  title:   { color:C.textSec, fontSize:17, fontWeight:'700' },
  sub:     { color:C.textTert, fontSize:13, textAlign:'center', lineHeight:20 },
  cta:     { borderRadius:22, overflow:'hidden', marginTop:8 },
  ctaGrad: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:13 },
  ctaTxt:  { color:C.white, fontSize:14, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEED ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────
const FeedError = memo(function FeedError({
  message, onRetry,
}: { message: string; onRetry: () => void }) {
  return (
    <View style={fe.wrap}>
      <View style={fe.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={30} color={C.textTert} />
      </View>
      <Text style={fe.msg}>{message}</Text>
      <TouchableOpacity style={fe.btn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={fe.btnTxt}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
});

const fe = StyleSheet.create({
  wrap:    { alignItems:'center', paddingVertical:60, gap:12 },
  iconWrap:{ width:56, height:56, borderRadius:28, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  msg:     { color:C.red, fontSize:13, textAlign:'center', paddingHorizontal:40, lineHeight:19 },
  btn:     { paddingHorizontal:22, paddingVertical:10, borderRadius:14, backgroundColor:C.navyLight, borderWidth:1, borderColor:C.borderHi },
  btnTxt:  { color:C.white, fontWeight:'700', fontSize:14 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEED LOADING
// ─────────────────────────────────────────────────────────────────────────────
const FeedLoading = memo(function FeedLoading() {
  return (
    <View style={{ alignItems:'center', paddingVertical:60, gap:14 }}>
      <ActivityIndicator color={C.blue} size="large" />
      <Text style={{ color:C.textSec, fontSize:13 }}>Chargement des critiques…</Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TENDANCES BANNER — top 3 posts mis en avant
// ─────────────────────────────────────────────────────────────────────────────
const TrendingBanner = memo(function TrendingBanner({ posts }: { posts: Post[] }) {
  const router = useRouter();
  if (posts.length === 0) return null;
  const top = posts[0];
  return (
    <TouchableOpacity
      style={tb.wrap}
      onPress={() => router.push(`/film/${top.id}` as any)}
      activeOpacity={0.88}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 14 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={tb.inner}>
        <View style={tb.badge}>
          <Ionicons name="flame" size={10} color={C.gold} />
          <Text style={tb.badgeTxt}>TENDANCE #1</Text>
        </View>
        <Text style={tb.title} numberOfLines={1}>{top.work_title || 'Œuvre inconnue'}</Text>
        <Text style={tb.meta} numberOfLines={1}>{[top.work_director, top.work_year].filter(Boolean).join(' · ')}</Text>
        <View style={tb.stats}>
          <Ionicons name="heart" size={12} color={C.red} />
          <Text style={tb.statTxt}>{top.likes.toLocaleString('fr-FR')}</Text>
          <Text style={tb.dot}>·</Text>
          <Ionicons name="share-outline" size={12} color={C.textTert} />
          <Text style={tb.statTxt}>{top.shares}</Text>
        </View>
      </View>
      <Ionicons name="arrow-forward-circle" size={26} color={C.blue} style={{ opacity: 0.7 }} />
    </TouchableOpacity>
  );
});

const tb = StyleSheet.create({
  wrap:    { marginHorizontal:EDGE, marginBottom:16, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:C.borderBlue, backgroundColor:C.surf, flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13, gap:12 },
  inner:   { flex:1, gap:4 },
  badge:   { flexDirection:'row', alignItems:'center', gap:4, alignSelf:'flex-start', backgroundColor:C.goldDim, paddingHorizontal:8, paddingVertical:3, borderRadius:8, borderWidth:0.5, borderColor:C.goldEdge, marginBottom:2 },
  badgeTxt:{ color:C.gold, fontSize:9, fontWeight:'800', letterSpacing:0.6 },
  title:   { color:C.text, fontSize:15, fontWeight:'800' },
  meta:    { color:C.textTert, fontSize:11 },
  stats:   { flexDirection:'row', alignItems:'center', gap:5, marginTop:2 },
  statTxt: { color:C.textSec, fontSize:11, fontWeight:'600' },
  dot:     { color:C.textTert, fontSize:11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const [activeTab,   setActiveTab]   = useState<FeedTab>('Pour vous');
  const [composeOpen, setComposeOpen] = useState(false);
  const [userId,      setUserId]      = useState('anonymous');
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // getSession first — works synchronously from localStorage on web/Netlify
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
      else supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) setUserId(user.id);
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.id) setUserId(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Feed ──────────────────────────────────────────────────────────────────
  const { posts, loading, error, refresh, toggleLike } = usePostsFeed(activeTab);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  // ── Sorted posts for Tendances ────────────────────────────────────────────
  const trendingPosts = useMemo(() => {
    if (activeTab !== 'Tendances') return posts;
    return [...posts].sort((a, b) => (b.likes + b.shares * 2) - (a.likes + a.shares * 2));
  }, [posts, activeTab]);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderItem  = useCallback(({ item }: { item: Post }) => (
    <PostCard post={item} userId={userId} />
  ), [userId]);
  const keyExtractor = useCallback((item: Post) => item.id, []);

  // ── List header — memoised per tab+userId ─────────────────────────────────
  const ListHeader = useMemo(() => (
    <>
      <SocialHeader onCompose={() => setComposeOpen(true)} />
      {activeTab !== 'Pros' && (
        <>
          {/* <ComposeBar onPress={() => setComposeOpen(true)} /> */}
          {activeTab === 'Tendances' && trendingPosts.length > 0 && (
            <TrendingBanner posts={trendingPosts} />
          )}
          <FilterTabs active={activeTab} set={setActiveTab} />
        </>
      )}
      {activeTab === 'Pros' && (
        <FilterTabs active={activeTab} set={setActiveTab} />
      )}
    </>
  ), [activeTab, trendingPosts]);

  // ── List empty ────────────────────────────────────────────────────────────
  const ListEmpty = useMemo(() => {
    if (activeTab === 'Pros') return null; // ProDirectory handles its own empty
    if (loading) return <FeedLoading />;
    if (error)   return <FeedError message={error} onRetry={refresh} />;
    return <EmptyFeed onCompose={() => setComposeOpen(true)} />;
  }, [activeTab, loading, error, refresh]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <InteractionProvider onToggleLike={toggleLike}>
      <View style={s.root}>
        <StatusBar style="light" />
        <GalaxyBackground />

        <SafeAreaView style={s.safe} edges={['top']}>
          {/* Compose modal */}
          <ComposeModal
            visible={composeOpen}
            onClose={() => setComposeOpen(false)}
            onPublished={refresh}
            userId={userId}
          />

          {/* ── Pros tab — full replacement layout ── */}
          {activeTab === 'Pros' ? (
            <View style={{ flex: 1 }}>
              {/* Reuse header + tabs */}
              <SocialHeader onCompose={() => setComposeOpen(true)} />
              <FilterTabs active={activeTab} set={setActiveTab} />
              <ProDirectory />
            </View>
          ) : (
            /* ── Feed tabs ── */
            <FlatList
              data={activeTab === 'Tendances' ? trendingPosts : posts}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={ListHeader}
              ListEmptyComponent={ListEmpty}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={C.blue}
                  colors={[C.blue]}
                />
              }
              // Performance
              removeClippedSubviews
              windowSize={7}
              maxToRenderPerBatch={4}
              updateCellsBatchingPeriod={50}
              initialNumToRender={5}
              getItemLayout={(_, index) => ({
                length: 340, offset: 340 * index, index,
              })}
            />
          )}
        </SafeAreaView>
      </View>
    </InteractionProvider>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  safe:        { flex: 1 },
  listContent: { paddingBottom: 120 },
});