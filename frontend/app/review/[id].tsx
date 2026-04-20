// app/review/[id].tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'une critique — GalaxyBackground + widgets dynamiques
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, Platform,
  Animated, Easing, Share, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { DEFAULT_REVIEWS } from '../../components/profile/data';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010',
  bg1: '#0A001E',
  bg2: '#070014',

  sW: '#F3EDFF',
  sB: '#B2CCFF',
  sG: '#FFE270',
  sP: '#0e2240', // remplacé

  primary: '#0e2240',   // 🔥 couleur dominante
  accent: '#0e2240',    // 🔥 harmonisé
  pink: '#E91E63',      // ❌ PAS TOUCHÉ (likes)
  gold: '#FFD700',      // ❌ PAS TOUCHÉ

  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  glassMid: 'rgba(255,255,255,0.12)',
  textSub: '#BCB8C2',

  navyMid: '#0e2240', // harmonisation
};

// ─────────────────────────────────────────────────────────────────────────────
// 🌠 GALAXY BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number }
interface Met { id: number; sx: number; sy: number; ang: number; len: number }

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
       colors={['transparent', 'rgba(14,34,64,0.4)', '#fff']}
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
    }, 2500);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar
          key={m.id} m={m}
          onDone={() => setMeteors(p => p.filter(x => x.id !== m.id))}
        />
      ))}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// 💀 SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const ReviewSkeleton = memo(() => {
  const op = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.65, duration: 900, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.3,  duration: 900, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{ flex: 1, opacity: op, paddingHorizontal: 22, paddingTop: 120, gap: 16 }}>
      <View style={{ height: 80, borderRadius: 16, backgroundColor: G.glass }} />
      <View style={{ height: 200, borderRadius: 20, backgroundColor: G.glass }} />
      <View style={{ height: 100, borderRadius: 16, backgroundColor: G.glass }} />
    </Animated.View>
  );
});
ReviewSkeleton.displayName = 'ReviewSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ STAR RATING ANIMÉ
// ─────────────────────────────────────────────────────────────────────────────
const AnimatedStar = memo(({ filled, index }: { filled: boolean; index: number }) => {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      delay: index * 80,
      useNativeDriver: true,
      tension: 120,
      friction: 6,
    }).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons
        name={filled ? 'star' : 'star-outline'}
        size={22}
        color={filled ? G.gold : 'rgba(255,215,0,0.25)'}
      />
    </Animated.View>
  );
});
AnimatedStar.displayName = 'AnimatedStar';

// ─────────────────────────────────────────────────────────────────────────────
// 📊 STAT PILL
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = memo(({ icon, value, color, label }: {
  icon: string; value: string; color?: string; label?: string;
}) => (
  <View style={sp.pill}>
    <Ionicons name={icon as any} size={15} color={color ?? G.textSub} />
    <View>
      <Text style={[sp.val, color ? { color } : {}]}>{value}</Text>
      {label ? <Text style={sp.label}>{label}</Text> : null}
    </View>
  </View>
));
StatPill.displayName = 'StatPill';
const sp = StyleSheet.create({
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  val:   { color: 'white', fontSize: 13, fontWeight: '700' },
  label: { color: G.textSub, fontSize: 10, fontWeight: '500', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 💬 BLOC QUOTE WIDGET
// ─────────────────────────────────────────────────────────────────────────────
const QuoteWidget = memo(({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const MAX_CHARS = 280;
  const isLong = content.length > MAX_CHARS;
  const displayText = isLong && !expanded ? content.slice(0, MAX_CHARS) + '…' : content;

  return (
    <View style={qw.wrap}>
      <LinearGradient
        colors={['rgba(192,96,255,0.12)', 'rgba(168,85,247,0.05)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Barre décorative gauche */}
      <View style={qw.bar} />
      <View style={qw.inner}>
        <Ionicons name="chatbubble-ellipses" size={18} color={G.primary} style={{ marginBottom: 10 }} />
        <Text style={qw.text}>{displayText}</Text>
        {isLong && (
          <TouchableOpacity onPress={() => setExpanded(v => !v)} style={qw.readMore}>
            <Text style={qw.readMoreText}>{expanded ? 'Réduire ↑' : 'Lire la suite ↓'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
QuoteWidget.displayName = 'QuoteWidget';
const qw = StyleSheet.create({
  wrap:       { marginBottom: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.2)', flexDirection: 'row' },
  bar:        { width: 4, backgroundColor: G.primary, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  inner:      { flex: 1, padding: 18 },
  text:       { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 26, fontStyle: 'italic' },
  readMore:   { marginTop: 12, alignSelf: 'flex-start' },
  readMoreText:{ color: G.primary, fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ❤️ LIKE BUTTON ANIMÉ
// ─────────────────────────────────────────────────────────────────────────────
const LikeButton = memo(({ initialCount }: { initialCount: number }) => {
  const [liked, setLiked]   = useState(false);
  const [count, setCount]   = useState(initialCount);
  const scale               = useRef(new Animated.Value(1)).current;
  const burst               = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setCount(c => next ? c + 1 : c - 1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,   useNativeDriver: true, tension: 200 }),
    ]).start();
    Animated.sequence([
      Animated.timing(burst, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [liked, scale, burst]);

  const burstOpacity = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
  const burstScale   = burst.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] });

  return (
    <TouchableOpacity onPress={handlePress} style={lb.btn} activeOpacity={0.8}>
      {/* Burst cercle */}
      <Animated.View style={[lb.burst, { opacity: burstOpacity, transform: [{ scale: burstScale }] }]} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? G.pink : 'rgba(255,255,255,0.6)'} />
      </Animated.View>
      <Text style={[lb.count, liked && { color: G.pink }]}>{count.toLocaleString()}</Text>
      <Text style={lb.label}>{liked ? 'Aimé !' : "J'aime"}</Text>
    </TouchableOpacity>
  );
});
LikeButton.displayName = 'LikeButton';
const lb = StyleSheet.create({
  btn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, paddingVertical: 14, borderRadius: 18, overflow: 'visible', position: 'relative' },
  burst: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(233,30,99,0.2)' },
  count: { color: 'white', fontSize: 16, fontWeight: '700' },
  label: { color: G.textSub, fontSize: 12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📅 DATE BADGE WIDGET
// ─────────────────────────────────────────────────────────────────────────────
const DateBadge = memo(({ dateStr }: { dateStr: string }) => {
  const date    = new Date(dateStr);
  const isValid = !isNaN(date.getTime());
  const day     = isValid ? date.getDate() : '—';
  const month   = isValid ? date.toLocaleString('fr-FR', { month: 'short' }).toUpperCase() : '—';
  const year    = isValid ? date.getFullYear() : '—';
  const rel     = isValid ? getRelativeTime(date) : '';

  return (
    <View style={db.wrap}>
      <View style={db.calendar}>
        <View style={db.calTop}><Text style={db.calMonth}>{month}</Text></View>
        <View style={db.calBody}><Text style={db.calDay}>{day}</Text></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={db.full}>{isValid ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</Text>
        {rel ? <Text style={db.rel}>{rel}</Text> : null}
      </View>
    </View>
  );
});
DateBadge.displayName = 'DateBadge';
const db = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, padding: 14, borderRadius: 16, marginBottom: 12 },
  calendar:{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder },
  calTop:  { backgroundColor: G.primary, paddingVertical: 3, alignItems: 'center' },
  calMonth:{ color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  calBody: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: G.navyMid },
  calDay:  { color: 'white', fontSize: 17, fontWeight: '800' },
  full:    { color: 'white', fontSize: 14, fontWeight: '600' },
  rel:     { color: G.textSub, fontSize: 12, marginTop: 2 },
});

function getRelativeTime(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7)  return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return `Il y a ${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📖 READING TIME
// ─────────────────────────────────────────────────────────────────────────────
function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return `${mins} min`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 FILM CARD CLIQUABLE
// ─────────────────────────────────────────────────────────────────────────────
const FilmCard = memo(({ film, onPress }: { film: any; onPress: () => void }) => (
  <TouchableOpacity style={fc.card} onPress={onPress} activeOpacity={0.85}>
    <Image source={{ uri: film.poster_url }} style={fc.poster} />
    <LinearGradient colors={['transparent', 'rgba(6,0,16,0.9)']} style={fc.gradient} />
    <View style={fc.info}>
      <Text style={fc.genre}>{film.genre}</Text>
      <Text style={fc.title} numberOfLines={2}>{film.title}</Text>
      <View style={fc.arrow}>
        <Text style={fc.arrowText}>Voir le film</Text>
        <Ionicons name="arrow-forward" size={13} color={G.primary} />
      </View>
    </View>
  </TouchableOpacity>
));
FilmCard.displayName = 'FilmCard';
const fc = StyleSheet.create({
  card:     { height: 160, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: G.glassBorder, position: 'relative', flexDirection: 'row', alignItems: 'flex-end' },
  poster:   { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  gradient: { ...StyleSheet.absoluteFillObject },
  info:     { padding: 16, flex: 1 },
  genre:    { color: G.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  title:    { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  arrow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  arrowText:{ color: G.primary, fontSize: 12, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 👤 AUTEUR CARD
// ─────────────────────────────────────────────────────────────────────────────
const AuthorCard = memo(({ user }: { user: any }) => (
  <View style={ac.card}>
    <Image source={{ uri: user?.avatar_url || 'https://i.pravatar.cc/100?img=13' }} style={ac.avatar} />
    <View style={{ flex: 1 }}>
      <Text style={ac.name}>{user?.username || 'Utilisateur inconnu'}</Text>
      <Text style={ac.sub}>Critique Cinéma</Text>
    </View>
    <View style={ac.badge}>
      <Ionicons name="ribbon" size={14} color={G.gold} />
      <Text style={ac.badgeText}>Critique</Text>
    </View>
  </View>
));
AuthorCard.displayName = 'AuthorCard';
const ac = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, padding: 14, borderRadius: 18, marginBottom: 20 },
  avatar:    { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: G.primary },
  name:      { color: 'white', fontSize: 15, fontWeight: '700' },
  sub:       { color: G.textSub, fontSize: 12, marginTop: 2 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)' },
  badgeText: { color: G.gold, fontSize: 11, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 RATING GAUGE WIDGET
// ─────────────────────────────────────────────────────────────────────────────
const RatingGauge = memo(({ rating }: { rating: number }) => {
  const animVal = useRef(new Animated.Value(0)).current;
  const pct     = (rating / 5) * 100;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: pct, duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]); // eslint-disable-line

  const width = animVal.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const ratingLabel = useMemo(() => {
    if (rating >= 5) return { text: 'Chef-d\'œuvre',   color: G.gold };
    if (rating >= 4) return { text: 'Excellent',       color: G.sP };
    if (rating >= 3) return { text: 'Bien',            color: G.primary };
    if (rating >= 2) return { text: 'Passable',        color: G.textSub };
    return              { text: 'Décevant',            color: '#FF6B6B' };
  }, [rating]);

  return (
    <View style={rg.wrap}>
      <View style={rg.top}>
        <View style={rg.starsRow}>
          {[1, 2, 3, 4, 5].map(i => <AnimatedStar key={i} filled={i <= rating} index={i - 1} />)}
        </View>
        <View style={[rg.labelBadge, { borderColor: ratingLabel.color + '50', backgroundColor: ratingLabel.color + '18' }]}>
          <Text style={[rg.labelText, { color: ratingLabel.color }]}>{ratingLabel.text}</Text>
        </View>
      </View>
      {/* Barre de progression */}
      <View style={rg.track}>
        <Animated.View style={[rg.fill, { width }]}>
          <LinearGradient colors={[G.accent, G.primary, G.sP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <Text style={rg.fraction}>{rating} / 5</Text>
    </View>
  );
});
RatingGauge.displayName = 'RatingGauge';
const rg = StyleSheet.create({
  wrap:       { backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, padding: 18, borderRadius: 18, marginBottom: 20 },
  top:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  starsRow:   { flexDirection: 'row', gap: 5 },
  labelBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  labelText:  { fontSize: 12, fontWeight: '800' },
  track:      { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  fill:       { height: '100%', borderRadius: 4, overflow: 'hidden' },
  fraction:   { color: G.textSub, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📤 SHARE BUTTON
// ─────────────────────────────────────────────────────────────────────────────
const ShareButton = memo(({ title, content }: { title: string; content: string }) => {
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `🎬 Critique de "${title}"\n\n${content.slice(0, 200)}…`,
        title: `Critique : ${title}`,
      });
    } catch (e) {
      // silently ignore
    }
  }, [title, content]);

  return (
    <TouchableOpacity style={sb.btn} onPress={handleShare} activeOpacity={0.8}>
      <Ionicons name="share-social-outline" size={20} color="white" />
      <Text style={sb.text}>Partager</Text>
    </TouchableOpacity>
  );
});
ShareButton.displayName = 'ShareButton';
const sb = StyleSheet.create({
  btn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, paddingVertical: 14, borderRadius: 18 },
  text: { color: 'white', fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📰 SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = memo(({ icon, title }: { icon: string; title: string }) => (
  <View style={sh.row}>
    <Ionicons name={icon as any} size={16} color={G.primary} />
    <Text style={sh.title}>{title}</Text>
  </View>
));
SectionHeader.displayName = 'SectionHeader';
const sh = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { color: 'white', fontSize: 17, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReviewDetailScreen() {
  const router        = useRouter();
  const { id }        = useLocalSearchParams<{ id: string }>();

  const [review,  setReview]  = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchReview = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Mock data
    if (!isUUID) {
      const mock = DEFAULT_REVIEWS.find(r => r.id === id);
      if (mock) {
        setReview({
          id:          mock.id,
          content:     mock.content,
          rating:      mock.rating,
          likes_count: mock.likes,
          created_at:  mock.date,
          user:        { username: 'Critique Cinéma', avatar_url: `https://i.pravatar.cc/150?u=${mock.id}` },
          film:        { id: mock.film.id, title: mock.film.title, poster_url: mock.film.posterUrl, genre: mock.film.genre || '—' },
        });
        setLoading(false);
        return;
      }
      setError(true);
      setLoading(false);
      return;
    }

    // Supabase
    try {
      const { data: reviewData, error: reviewErr } = await supabase
        .from('critiques').select('*').eq('id', id).single();
      if (reviewErr) throw reviewErr;

      let userData: any = null;
      if (reviewData?.user_id) {
        const { data: profile } = await supabase
          .from('profiles').select('id, username, avatar_url').eq('id', reviewData.user_id).maybeSingle();
        userData = profile;
      }

      const filmTitle = reviewData.film_title || reviewData.title || 'Film inconnu';
      setReview({
        ...reviewData,
        user: userData,
        film: {
          id: reviewData.reel_id || reviewData.id,
          title: filmTitle,
          poster_url: `https://picsum.photos/seed/${encodeURIComponent(filmTitle)}/800/500`,
          genre: '—',
        },
      });
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  // ── États ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.container}>
      <GalaxyBackground />
      <ReviewSkeleton />
    </View>
  );

  if (error || !review) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <GalaxyBackground />
      <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.2)" />
      <Text style={s.errorText}>Critique introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtnCenter}>
        <Text style={{ color: G.primary, fontWeight: '700' }}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const readTime = readingTime(review.content || '');

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── HEADER NAV ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </BlurView>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Critique</Text>
          <BlurView intensity={20} tint="dark" style={[s.blurCircle, { borderColor: G.glassBorder }]}>
            <Ionicons name="bookmark-outline" size={18} color="white" />
          </BlurView>
        </View>

        <View style={s.body}>

          {/* ── FILM CARD ── */}
          {review.film && (
            <FilmCard
              film={review.film}
              onPress={() => router.push(`/film/${review.film.id}`)}
            />
          )}

          {/* ── AUTEUR ── */}
          <SectionHeader icon="person-circle-outline" title="Auteur" />
          <AuthorCard user={review.user} />

          {/* ── NOTE / RATING ── */}
          <SectionHeader icon="star-outline" title="Note" />
          <RatingGauge rating={review.rating ?? 0} />

          {/* ── STATS PILLS ── */}
          <View style={s.pills}>
            <StatPill icon="heart"        value={String(review.likes_count ?? 0)} color={G.pink}     label="J'aimes" />
            <StatPill icon="book-outline" value={readTime}                         color={G.sB}      label="Lecture" />
            <StatPill icon="eye-outline"  value="—"                                color={G.textSub} label="Vues" />
          </View>

          {/* ── CRITIQUE (QUOTE WIDGET) ── */}
          <SectionHeader icon="chatbubble-ellipses-outline" title="La critique" />
          <QuoteWidget content={review.content || 'Aucun contenu disponible.'} />

          {/* ── DATE ── */}
          <SectionHeader icon="calendar-outline" title="Publiée le" />
          <DateBadge dateStr={review.created_at ?? ''} />

          {/* ── ACTIONS ── */}
          <View style={s.actions}>
            <LikeButton initialCount={review.likes_count ?? 0} />
            <ShareButton title={review.film?.title ?? 'ce film'} content={review.content ?? ''} />
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES GLOBAUX
// ═══════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: G.bg0 },
  scroll:       { paddingBottom: 120 },

  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 20,
  },
  backBtn:      {},
  blurCircle:   {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: G.glassBorder,
  },
  headerTitle:  { color: 'white', fontSize: 18, fontWeight: '700' },
  backBtnCenter:{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: G.primary },
  errorText:    { color: 'rgba(255,255,255,0.4)', fontSize: 16, marginTop: 16, fontWeight: '600' },

  body:         { paddingHorizontal: 20, paddingTop: 4 },
  pills:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  actions:      { flexDirection: 'row', gap: 12, marginTop: 8 },
});