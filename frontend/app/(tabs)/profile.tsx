// app/profile.tsx
// ═══════════════════════════════════════════════════════════════════
//  UNIVERSE — Profil  /  Galaxy System
//  ─────────────────────────────────────────────────────────────────
//  Moteur Galaxy porté depuis social.tsx (intégral).
//  Tabs Favoris/Sauvegardes opérationnels, stats réelles,
//  navigation film, édition profil, follow/message.
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useMemo,
  useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, Animated, Easing,
  Platform, Modal, Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE GALAXY (identique social.tsx & search.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  accent: '#A855F7',
  textSub: '#BCB8C2',
  pinkBadge: '#E91E63',
  purpleBadge: '#6A1B9A',
};

// ─────────────────────────────────────────────────────────────────────────────
// 📦 DONNÉES MOCK
// ─────────────────────────────────────────────────────────────────────────────
const USER = {
  name: 'Hugo C.',
  handle: 'hugoch',
  role: 'Acteur · Réalisateur',
  bio: 'Passionné de cinéma indé. Anamorphique forever. 🎬',
  avatar: 'https://i.pravatar.cc/150?u=hugoch',
  followers: 1240,
  following: 318,
};

const FAVORITES = [
  { id: '1', title: 'BOOTS',     likes: 288, views: '1,6k', img: 'https://picsum.photos/seed/b1/300/400', genre: 'Thriller', year: 2023 },
  { id: '2', title: 'ADVERTISE', likes: 378, views: '1,6k', img: 'https://picsum.photos/seed/b2/300/400', genre: 'Drame',   year: 2024 },
  { id: '3', title: 'DNX',       likes: 31,  views: '800',  img: 'https://picsum.photos/seed/b3/300/400', genre: 'Action',  year: 2022 },
  { id: '4', title: 'VOIDSCAPE', likes: 514, views: '2,1k', img: 'https://picsum.photos/seed/b4/300/400', genre: 'Sci-Fi',  year: 2023 },
];

const SAVED = [
  { id: 's1', title: 'The Lighthouse', likes: 892, views: '4k',   img: 'https://picsum.photos/seed/s1/300/400', genre: 'Drame',   year: 2019 },
  { id: 's2', title: 'Hereditary',     likes: 673, views: '3,2k', img: 'https://picsum.photos/seed/s2/300/400', genre: 'Horreur', year: 2018 },
  { id: 's3', title: 'Midsommar',      likes: 740, views: '3,5k', img: 'https://picsum.photos/seed/s3/300/400', genre: 'Drame',   year: 2019 },
];

const COMEDY = [
  { id: 'c1', title: 'Slapstick',   img: 'https://picsum.photos/seed/c1/300/400', year: 2021 },
  { id: 'c2', title: 'La Coupole',  img: 'https://picsum.photos/seed/c2/300/400', year: 2022 },
  { id: 'c3', title: 'Douce Nuit',  img: 'https://picsum.photos/seed/c3/300/400', year: 2023 },
];

const REVIEWS = [
  {
    id: 'r1', film: 'The Lighthouse',
    text: 'Une masterclass visuelle. Le ratio 1.19:1 enferme littéralement les personnages dans leur folie.',
    rating: 5, date: '12 mars 2025',
    img: 'https://picsum.photos/seed/s1/300/400',
  },
  {
    id: 'r2', film: 'Hereditary',
    text: 'La mise en scène de Aster est terrifiante de précision. Chaque plan transpire l\'angoisse.',
    rating: 4, date: '3 fév. 2025',
    img: 'https://picsum.photos/seed/s2/300/400',
  },
];

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY ANIMATION ENGINE (Portage Intégral)  ░░░
// ═══════════════════════════════════════════════════════════════════

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface Met { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: Pt[] = Array.from({ length: 55 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H * 1.5), sz: rnd(1.0, 2.3),
  col: pick([G.sW, G.sB, G.sP, G.sG]),
  del: rnd(0, 4200), dur: rnd(2000, 5000), mn: 0.25, mx: 0.95,
}));

const StarDot = memo(({ p }: { p: Pt }) => {
  const op = useRef(new Animated.Value(p.mn)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue: p.mx, duration: p.dur * 0.5, useNativeDriver: true }),
      Animated.timing(op, { toValue: p.mn, duration: p.dur * 0.5, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{
      position: 'absolute', left: p.x, top: p.y,
      width: p.sz, height: p.sz, borderRadius: p.sz,
      backgroundColor: p.col, opacity: op,
    }} />
  );
});
StarDot.displayName = 'StarDot';

const ShootingStar = memo(({ m, onDone }: { m: Met; onDone: () => void }) => {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      ]),
      Animated.timing(prog, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(onDone);
  }, []); // eslint-disable-line
  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 200] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 200] });
  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy,
      opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(175,110,255,0.8)', '#fff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: m.len, height: 2, borderRadius: 1 }}
      />
    </Animated.View>
  );
});
ShootingStar.displayName = 'ShootingStar';

const GalaxyBackground = memo(() => {
  const [meteors, setMeteors] = useState<Met[]>([]);
  useEffect(() => {
    const i = setInterval(() => {
      if (Math.random() > 0.7)
        setMeteors(m => [...m, {
          id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.4),
          ang: rnd(20, 50), len: rnd(80, 150),
        }]);
    }, 2000);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar key={m.id} m={m}
          onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))} />
      ))}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ═══════════════════════════════════════════════════════════════════
//  ░░░  COMPOSANTS  ░══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

// ─── Stat Card ────────────────────────────────────────────────────
const StatCard = memo(({ count, label, onPress }: { count: string; label: string; onPress?: () => void }) => (
  <TouchableOpacity style={st.box} onPress={onPress} disabled={!onPress}>
    <Text style={st.count}>{count}</Text>
    <Text style={st.label}>{label}</Text>
  </TouchableOpacity>
));
StatCard.displayName = 'StatCard';

const st = StyleSheet.create({
  box:   { alignItems: 'center', paddingHorizontal: 12 },
  count: { color: 'white', fontSize: 20, fontWeight: '800' },
  label: { color: G.textSub, fontSize: 12, marginTop: 3 },
});

// ─── Carte Film Horizontale ────────────────────────────────────────
type FilmItem = { id: string; title?: string; likes?: number; views?: string; img: string; genre?: string; year?: number };

const MovieCard = memo(({ item, showStats = true }: { item: FilmItem; showStats?: boolean }) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={mc.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/film/${item.id}`)}
    >
      <Image source={{ uri: item.img }} style={mc.img} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={mc.overlay} />
      {item.genre && (
        <View style={mc.genreBadge}>
          <Text style={mc.genreTxt}>{item.genre}</Text>
        </View>
      )}
      <View style={mc.content}>
        {item.title && <Text style={mc.title} numberOfLines={1}>{item.title}</Text>}
        {showStats && item.likes != null && (
          <View style={mc.stats}>
            <View style={mc.stat}>
              <Ionicons name="heart" size={11} color="white" />
              <Text style={mc.statTxt}>{item.likes}</Text>
            </View>
            <View style={mc.stat}>
              <Ionicons name="stats-chart" size={11} color="white" />
              <Text style={mc.statTxt}>{item.views}</Text>
            </View>
          </View>
        )}
        {item.year && !showStats && (
          <Text style={mc.year}>{item.year}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});
MovieCard.displayName = 'MovieCard';

const mc = StyleSheet.create({
  card:      { width: 145, height: 200, marginRight: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder },
  img:       { width: '100%', height: '100%', resizeMode: 'cover' },
  overlay:   { ...StyleSheet.absoluteFillObject },
  genreBadge:{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(168,85,247,0.7)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  genreTxt:  { color: 'white', fontSize: 9, fontWeight: '700' },
  content:   { position: 'absolute', bottom: 10, left: 10, right: 6 },
  title:     { color: 'white', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  stats:     { flexDirection: 'row', gap: 8 },
  stat:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTxt:   { color: 'white', fontSize: 11, fontWeight: '500' },
  year:      { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
});

// ─── Carte Critique ───────────────────────────────────────────────
const ReviewCard = memo(({ review }: { review: typeof REVIEWS[0] }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={rc.card} onPress={() => router.push(`/film/${review.id}`)}>
      <Image source={{ uri: review.img }} style={rc.poster} />
      <View style={rc.body}>
        <View style={rc.top}>
          <Text style={rc.film}>{review.film}</Text>
          <View style={rc.stars}>
            {Array.from({ length: 5 }, (_, i) => (
              <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={12} color={G.sG} />
            ))}
          </View>
        </View>
        <Text style={rc.text} numberOfLines={3}>{review.text}</Text>
        <Text style={rc.date}>{review.date}</Text>
      </View>
    </TouchableOpacity>
  );
});
ReviewCard.displayName = 'ReviewCard';

const rc = StyleSheet.create({
  card:   { flexDirection: 'row', backgroundColor: G.glass, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder, marginHorizontal: 20, marginBottom: 12 },
  poster: { width: 64, height: 96, resizeMode: 'cover' },
  body:   { flex: 1, padding: 12, justifyContent: 'space-between' },
  top:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  film:   { color: 'white', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  stars:  { flexDirection: 'row', gap: 2 },
  text:   { color: 'rgba(237,232,255,0.7)', fontSize: 12, lineHeight: 18, flex: 1 },
  date:   { color: G.textSub, fontSize: 10, marginTop: 6 },
});

// ─── Modal Followers / Following ──────────────────────────────────
const FAKE_USERS = Array.from({ length: 8 }, (_, i) => ({
  id: String(i), name: `Cinéphile ${i + 1}`, handle: `user${i + 1}`, avi: `https://i.pravatar.cc/100?u=u${i}`,
  role: ['Réalisateur', 'Critique', 'DOP', 'Acteur'][i % 4],
}));

const FollowModal = memo(({ visible, title, onClose }: { visible: boolean; title: string; onClose: () => void }) => {
  const router = useRouter();
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={fm.backdrop} onPress={onClose} />
      <View style={fm.sheet}>
        <View style={fm.handle} />
        <Text style={fm.title}>{title}</Text>
        <ScrollView>
          {FAKE_USERS.map(u => (
            <View key={u.id} style={fm.row}>
              <Image source={{ uri: u.avi }} style={fm.avi} />
              <View style={{ flex: 1 }}>
                <Text style={fm.name}>{u.name}</Text>
                <Text style={fm.sub}>@{u.handle} · {u.role}</Text>
              </View>
              <TouchableOpacity style={fm.btn} onPress={() => router.push(`/user/${u.id}`)}>
                <Text style={fm.btnTxt}>Voir</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
});
FollowModal.displayName = 'FollowModal';

const fm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: H * 0.7, backgroundColor: '#140830', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  title:    { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: G.glassBorder },
  avi:      { width: 42, height: 42, borderRadius: 21 },
  name:     { color: 'white', fontWeight: '600', fontSize: 14 },
  sub:      { color: G.textSub, fontSize: 12 },
  btn:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder },
  btnTxt:   { color: 'white', fontSize: 12, fontWeight: '600' },
});

// ─── Section header ───────────────────────────────────────────────
const SectionHeader = memo(({ title, onPress }: { title: string; onPress?: () => void }) => (
  <View style={sh.row}>
    <Text style={sh.title}>{title}</Text>
    {onPress && (
      <TouchableOpacity onPress={onPress} style={sh.btn}>
        <Text style={sh.see}>Voir tout</Text>
        <Ionicons name="chevron-forward" size={14} color={G.textSub} />
      </TouchableOpacity>
    )}
  </View>
));
SectionHeader.displayName = 'SectionHeader';

const sh = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 14 },
  title: { color: 'white', fontSize: 18, fontWeight: '800' },
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  see:   { color: G.textSub, fontSize: 13 },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  ÉCRAN PRINCIPAL  ░══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

const PROFILE_TABS = ['Favoris', 'Sauvegardes', 'Critiques'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

export default function ProfileScreen() {
  const router = useRouter();

  const [activeTab,      setActiveTab]      = useState<ProfileTab>('Favoris');
  const [followModal,    setFollowModal]    = useState<'followers' | 'following' | null>(null);
  const [isFollowing,    setIsFollowing]    = useState(false);
  const followScale = useRef(new Animated.Value(1)).current;

  const toggleFollow = useCallback(() => {
    setIsFollowing(f => !f);
    Animated.sequence([
      Animated.spring(followScale, { toValue: 0.93, useNativeDriver: true, speed: 60 }),
      Animated.spring(followScale, { toValue: 1, useNativeDriver: true, speed: 60 }),
    ]).start();
  }, [followScale]);

  // ── Contenu selon l'onglet actif ──────────────────────────────
  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'Favoris':
        return (
          <>
            {/* Favoris horizontal */}
            <SectionHeader title="Mes favoris" onPress={() => router.push('/favorites')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll} contentContainerStyle={{ paddingRight: 22 }}>
              {FAVORITES.map(item => <MovieCard key={item.id} item={item} />)}
            </ScrollView>

            {/* Comédie horizontal */}
            <SectionHeader title="Comédie" onPress={() => router.push('/genre/comedy')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll} contentContainerStyle={{ paddingRight: 22 }}>
              {COMEDY.map(item => <MovieCard key={item.id} item={item} showStats={false} />)}
            </ScrollView>
          </>
        );

      case 'Sauvegardes':
        return (
          <>
            <SectionHeader title="Pour voir plus tard" onPress={() => router.push('/saved')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll} contentContainerStyle={{ paddingRight: 22 }}>
              {SAVED.map(item => <MovieCard key={item.id} item={item} />)}
            </ScrollView>
            {/* Stats sauvegardes */}
            <View style={s.savedInfo}>
              <LinearGradient colors={['rgba(192,96,255,0.12)', 'rgba(108,16,195,0.08)']} style={s.savedBanner}>
                <Ionicons name="bookmark" size={20} color={G.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.savedBannerTxt}>{SAVED.length} œuvres sauvegardées</Text>
                  <Text style={s.savedBannerSub}>Durée estimée : ~{SAVED.length * 95} min</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/saved')}>
                  <Ionicons name="chevron-forward" size={18} color={G.primary} />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </>
        );

      case 'Critiques':
        return (
          <>
            <SectionHeader title="Mes critiques" onPress={() => router.push('/reviews')} />
            {REVIEWS.map(r => <ReviewCard key={r.id} review={r} />)}
            {/* Bouton nouvelle critique */}
            <TouchableOpacity style={s.newReviewBtn} onPress={() => router.push('/new-review')}>
              <Ionicons name="add-circle-outline" size={18} color={G.primary} />
              <Text style={s.newReviewTxt}>Rédiger une critique</Text>
            </TouchableOpacity>
          </>
        );
    }
  }, [activeTab, router]);

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Modals */}
      <FollowModal
        visible={followModal === 'followers'}
        title={`${USER.followers} abonnés`}
        onClose={() => setFollowModal(null)}
      />
      <FollowModal
        visible={followModal === 'following'}
        title={`${USER.following} abonnements`}
        onClose={() => setFollowModal(null)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── HEADER TOP ── */}
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={s.settingsBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* ── AVATAR + INFOS ── */}
        <View style={s.profileSection}>
          <View style={s.avatarWrap}>
            <Image source={{ uri: USER.avatar }} style={s.avatar} />
            <View style={s.onlineDot} />
          </View>
          <View style={s.nameBlock}>
            <Text style={s.username}>@{USER.handle}</Text>
            <Text style={s.role}>{USER.role}</Text>
            <Text style={s.bio}>{USER.bio}</Text>
          </View>
        </View>

        {/* ── BOUTONS ACTION ── */}
        <View style={s.actionRow}>
          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: followScale }] }]}>
            <TouchableOpacity
              style={[s.followBtn, isFollowing && s.followingBtn]}
              onPress={toggleFollow}
              activeOpacity={0.85}
            >
              {isFollowing
                ? <><Ionicons name="checkmark" size={15} color="white" /><Text style={s.followBtnTxt}>Abonné</Text></>
                : <Text style={s.followBtnTxt}>S'abonner</Text>
              }
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={s.msgBtn} onPress={() => router.push(`/messages/${USER.handle}`)}>
            <BlurView intensity={20} tint="dark" style={s.iconBlur}>
              <Ionicons name="mail-outline" size={20} color="white" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity style={s.msgBtn} onPress={() => router.push('/edit-profile')}>
            <BlurView intensity={20} tint="dark" style={s.iconBlur}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color="white" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* ── STATS BAR ── */}
        <View style={s.statsBarContainer}>
          <BlurView intensity={15} tint="dark" style={s.statsBar}>
            <StatCard count={String(FAVORITES.length)} label="Favoris" onPress={() => setActiveTab('Favoris')} />
            <View style={s.vDivider} />
            <StatCard count={String(REVIEWS.length)} label="Critiques" onPress={() => setActiveTab('Critiques')} />
            <View style={s.vDivider} />
            <StatCard count={USER.followers >= 1000 ? `${(USER.followers / 1000).toFixed(1)}k` : String(USER.followers)} label="Abonnés" onPress={() => setFollowModal('followers')} />
            <View style={s.vDivider} />
            <StatCard count={String(USER.following)} label="Abonnements" onPress={() => setFollowModal('following')} />
          </BlurView>
        </View>

        {/* ── TABS ── */}
        <View style={s.tabsRow}>
          {PROFILE_TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity key={tab} style={s.tabBtn} onPress={() => setActiveTab(tab)}>
                <Text style={[s.tabTxt, active && s.tabTxtOn]}>{tab}</Text>
                {active && <View style={s.tabLine} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── CONTENU ONGLET ── */}
        {tabContent}

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  🎨 STYLES
// ═══════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: G.bg0 },
  scrollContent:     { paddingBottom: 120 },

  // Header top
  headerTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: Platform.OS === 'ios' ? 54 : 20, marginBottom: 10 },
  backBtn:           { width: 38, height: 38, borderRadius: 12, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, justifyContent: 'center', alignItems: 'center' },
  settingsBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, justifyContent: 'center', alignItems: 'center' },

  // Profil
  profileSection:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, marginBottom: 20, gap: 16 },
  avatarWrap:        { position: 'relative' },
  avatar:            { width: 76, height: 76, borderRadius: 38, borderWidth: 2.5, borderColor: G.accent },
  onlineDot:         { position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: '#30D158', borderWidth: 2, borderColor: G.bg0 },
  nameBlock:         { flex: 1, paddingTop: 4 },
  username:          { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  role:              { color: G.primary, fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 6 },
  bio:               { color: 'rgba(237,232,255,0.65)', fontSize: 13, lineHeight: 18 },

  // Actions
  actionRow:         { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginBottom: 22 },
  followBtn:         { flex: 1, height: 42, borderRadius: 14, backgroundColor: G.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  followingBtn:      { backgroundColor: 'rgba(192,96,255,0.2)', borderWidth: 1, borderColor: G.primary },
  followBtnTxt:      { color: 'white', fontSize: 14, fontWeight: '700' },
  msgBtn:            { width: 42, height: 42, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder },
  iconBlur:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },

  // Stats bar
  statsBarContainer: { paddingHorizontal: 22, marginBottom: 28 },
  statsBar:          { flexDirection: 'row', paddingVertical: 14, borderRadius: 18, borderWidth: 1, borderColor: G.glassBorder, justifyContent: 'space-around', overflow: 'hidden' },
  vDivider:          { width: 1, backgroundColor: G.glassBorder, alignSelf: 'stretch', marginVertical: 4 },

  // Tabs
  tabsRow:           { flexDirection: 'row', paddingHorizontal: 22, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  tabBtn:            { marginRight: 28, paddingBottom: 12, position: 'relative' },
  tabTxt:            { color: 'rgba(237,232,255,0.4)', fontSize: 15, fontWeight: '600' },
  tabTxtOn:          { color: G.sW, fontWeight: '700' },
  tabLine:           { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: G.primary, borderRadius: 2 },

  // Contenu
  hScroll:           { paddingLeft: 22, marginBottom: 28 },

  // Sauvegardes banner
  savedInfo:         { paddingHorizontal: 22, marginBottom: 20 },
  savedBanner:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,96,255,0.25)' },
  savedBannerTxt:    { color: 'white', fontSize: 14, fontWeight: '700' },
  savedBannerSub:    { color: G.textSub, fontSize: 12, marginTop: 2 },

  // Nouvelle critique
  newReviewBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 22, marginTop: 8, height: 48, borderRadius: 16, borderWidth: 1, borderColor: G.primary, borderStyle: 'dashed' },
  newReviewTxt:      { color: G.primary, fontSize: 14, fontWeight: '600' },
});