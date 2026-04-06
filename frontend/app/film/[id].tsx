// app/film/[id].tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'un film — fetche depuis Supabase par l'id de route
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, Platform,
  Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchWorkById, type Work } from '@/lib/supabase';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE (identique)
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  pinkBadge: '#E91E63',
  purpleBadge: '#6A1B9A',
  accent: '#A855F7',
  textSub: '#BCB8C2',
};

// ─────────────────────────────────────────────────────────────────────────────
// GALAXY BG (identique — extrait dans lib/GalaxyBackground.tsx si tu veux)
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface Met { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: Pt[] = Array.from({ length: 40 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H), sz: rnd(1.0, 2.1),
  col: pick([G.sW, G.sB, G.sP, G.sG]),
  del: rnd(0, 4000), dur: rnd(2000, 5000), mn: 0.2, mx: 0.85,
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
  return <Animated.View style={{ position: 'absolute', left: p.x, top: p.y, width: p.sz, height: p.sz, borderRadius: p.sz, backgroundColor: p.col, opacity: op }} />;
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
    <Animated.View style={{ position: 'absolute', left: m.sx, top: m.sy, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }] }}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(175,110,255,0.8)', '#fff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: m.len, height: 2, borderRadius: 1 }} />
    </Animated.View>
  );
});
ShootingStar.displayName = 'ShootingStar';

const GalaxyBackground = memo(() => {
  const [meteors, setMeteors] = useState<Met[]>([]);
  useEffect(() => {
    const i = setInterval(() => {
      if (Math.random() > 0.7)
        setMeteors(m => [...m, { id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.4), ang: rnd(20, 50), len: rnd(80, 150) }]);
    }, 2500);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => <ShootingStar key={m.id} m={m} onDone={() => setMeteors(p => p.filter(x => x.id !== m.id))} />)}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS LOCAUX
// ─────────────────────────────────────────────────────────────────────────────

/** Puce de cast */
const CastChip = memo(({ name }: { name: string }) => (
  <View style={cast.chip}>
    <Image source={{ uri: `https://i.pravatar.cc/80?u=${encodeURIComponent(name)}` }} style={cast.avatar} />
    <Text style={cast.name} numberOfLines={1}>{name}</Text>
  </View>
));
CastChip.displayName = 'CastChip';
const cast = StyleSheet.create({
  chip:   { alignItems: 'center', marginRight: 16, width: 64 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: G.accent, marginBottom: 6 },
  name:   { color: G.textSub, fontSize: 11, textAlign: 'center' },
});

/** Stat pill */
const StatPill = memo(({ icon, value, color }: { icon: string; value: string; color?: string }) => (
  <View style={sp.pill}>
    <Ionicons name={icon as any} size={15} color={color ?? G.accent} />
    <Text style={[sp.val, color ? { color } : {}]}>{value}</Text>
  </View>
));
StatPill.displayName = 'StatPill';
const sp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  val:  { color: 'white', fontSize: 13, fontWeight: '600' },
});

/** Skeleton plein écran */
const FilmSkeleton = memo(() => {
  const op = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.3, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{ flex: 1, opacity: op }}>
      <View style={{ height: H * 0.52, backgroundColor: G.glass }} />
      <View style={{ padding: 24, gap: 14 }}>
        {[200, 120, '100%', '80%'].map((w, i) => (
          <View key={i} style={{ height: i === 0 ? 32 : 14, width: w, backgroundColor: G.glass, borderRadius: 8 }} />
        ))}
      </View>
    </Animated.View>
  );
});
FilmSkeleton.displayName = 'FilmSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN DÉTAIL
// ─────────────────────────────────────────────────────────────────────────────
export default function FilmDetailScreen() {
  const router        = useRouter();
  const { id }        = useLocalSearchParams<{ id: string }>();

  const [work,   setWork]   = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [liked,   setLiked]   = useState(false);
  const [saved,   setSaved]   = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;

  // ── Fetch ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchWorkById(id);
      if (!data) throw new Error('not found');
      setWork(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Like animation ─────────────────────────────────────────────
  const handleLike = useCallback(() => {
    setLiked(v => !v);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  // ── États de chargement / erreur ───────────────────────────────
  if (loading) return (
    <View style={s.container}>
      <GalaxyBackground />
      <FilmSkeleton />
    </View>
  );

  if (error || !work) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <GalaxyBackground />
      <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.2)" />
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginTop: 16, fontWeight: '600' }}>Œuvre introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtnCenter}>
        <Text style={{ color: G.primary, fontWeight: '700' }}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const imageUri = work.image ?? `https://picsum.photos/seed/${work.id}/400/600`;
  const badgeColor = work.is_original ? G.purpleBadge : G.pinkBadge;
  const likesTotal = work.likes + (liked ? 1 : 0);

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── HERO IMAGE ── */}
        <View style={s.heroWrap}>
          <Image source={{ uri: imageUri }} style={s.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(6,0,16,0)', 'rgba(6,0,16,0.6)', G.bg0]}
            style={s.heroGradient}
          />

          {/* Bouton retour */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={s.backBlur}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </BlurView>
          </TouchableOpacity>

          {/* Actions haut-droite */}
          <View style={s.topActions}>
            <TouchableOpacity style={s.actionBtn} onPress={() => setSaved(v => !v)}>
              <BlurView intensity={30} tint="dark" style={s.actionBlur}>
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? G.sG : 'white'} />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn}>
              <BlurView intensity={30} tint="dark" style={s.actionBlur}>
                <Ionicons name="share-outline" size={20} color="white" />
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Badge catégorie */}
          <View style={[s.heroBadge, { backgroundColor: badgeColor }]}>
            <Text style={s.heroBadgeText}>{work.category.toUpperCase()}</Text>
          </View>
        </View>

        {/* ── CONTENU ── */}
        <View style={s.body}>

          {/* Titre + adjective */}
          <Text style={s.title}>{work.title}</Text>
          <Text style={s.adjective}>{work.adjective}</Text>

          {/* Stats pills */}
          <View style={s.pills}>
            <StatPill icon="heart"        value={likesTotal.toLocaleString()} color={G.accent} />
            {work.comments != null && (
              <StatPill icon="chatbubble"  value={String(work.comments)} />
            )}
            <StatPill icon="time-outline" value={`${work.duration} min`}      color={G.textSub} />
            <StatPill icon="calendar-outline" value={String(work.year)}       color={G.textSub} />
          </View>

          {/* Genres */}
          <View style={s.tags}>
            {[work.genre, work.category].map(tag => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* ── PLAY + LIKE ── */}
          <View style={s.cta}>
            <TouchableOpacity style={s.playBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#9B30FF', '#C060FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playGrad}>
                <Ionicons name="play" size={22} color="white" />
                <Text style={s.playText}>Regarder</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.likeBtn} onPress={handleLike}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? '#E91E63' : 'white'} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* ── SYNOPSIS ── */}
          {work.description ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Synopsis</Text>
              <Text style={s.description}>{work.description}</Text>
            </View>
          ) : null}

          {/* ── RÉALISATEUR ── */}
          {work.director ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Réalisateur·ice</Text>
              <View style={s.directorRow}>
                <Image
                  source={{ uri: `https://i.pravatar.cc/80?u=${encodeURIComponent(work.director)}` }}
                  style={s.directorAvatar}
                />
                <Text style={s.directorName}>{work.director}</Text>
              </View>
            </View>
          ) : null}

          {/* ── CASTING ── */}
          {work.cast_list && work.cast_list.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Avec</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {work.cast_list.map(name => <CastChip key={name} name={name} />)}
              </ScrollView>
            </View>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: G.bg0 },
  scroll:        { paddingBottom: 100 },

  // Hero
  heroWrap:      { height: H * 0.52, position: 'relative' },
  heroImage:     { width: '100%', height: '100%' },
  heroGradient:  { ...StyleSheet.absoluteFillObject, top: '30%' },
  heroBadge:     { position: 'absolute', bottom: 22, left: 22, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  heroBadgeText: { color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  // Nav buttons
  backBtn:       { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, left: 16 },
  backBlur:      { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: G.glassBorder },
  backBtnCenter: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: G.primary },
  topActions:    { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: 16, gap: 10, flexDirection: 'column' },
  actionBtn:     {},
  actionBlur:    { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: G.glassBorder },

  // Body
  body:          { paddingHorizontal: 22, paddingTop: 20 },
  title:         { color: 'white', fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginBottom: 4 },
  adjective:     { color: G.textSub, fontSize: 14, fontStyle: 'italic', marginBottom: 18 },

  // Pills
  pills:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },

  // Tags
  tags:          { flexDirection: 'row', gap: 8, marginBottom: 24 },
  tag:           { backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  tagText:       { color: G.accent, fontSize: 12, fontWeight: '600' },

  // CTA
  cta:           { flexDirection: 'row', gap: 12, marginBottom: 30, alignItems: 'center' },
  playBtn:       { flex: 1, borderRadius: 16, overflow: 'hidden' },
  playGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  playText:      { color: 'white', fontSize: 17, fontWeight: '700' },
  likeBtn:       { width: 54, height: 54, borderRadius: 27, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, justifyContent: 'center', alignItems: 'center' },

  // Sections
  section:       { marginBottom: 28 },
  sectionTitle:  { color: 'white', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  description:   { color: G.textSub, fontSize: 14, lineHeight: 22 },

  // Réalisateur
  directorRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  directorAvatar:{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: G.accent },
  directorName:  { color: 'white', fontSize: 15, fontWeight: '600' },
});