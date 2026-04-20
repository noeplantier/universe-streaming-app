// app/review/[id].tsx
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  Dimensions, Platform, Animated, Easing, Share, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { C }              from '@/components/create/tokens';
import { DEFAULT_REVIEWS } from '../../components/profile/data';

const { width: W, height: H } = Dimensions.get('window');

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const T = {
  bg:      C.navyMid,
  surf:    'rgba(255,255,255,0.04)',
  surfHi:  'rgba(255,255,255,0.07)',
  border:  'rgba(255,255,255,0.07)',
  borderHi:'rgba(255,255,255,0.12)',
  text:    '#FFFFFF',
  textSec: 'rgba(255,255,255,0.50)',
  textTert:'rgba(255,255,255,0.25)',
  gold:    '#FFD700',
  pink:    '#E91E63',
} as const;

// ─── GALAXY BACKGROUND ───────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const STAR_COLS = ['#F3EDFF', '#B2CCFF', '#FFE270', 'rgba(255,255,255,0.6)'];
interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number }
interface Met { id: number; sx: number; sy: number; ang: number; len: number }

const STARS: Pt[] = Array.from({ length: 40 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H), sz: rnd(1, 2.1),
  col: pick(STAR_COLS), del: rnd(0, 4000), dur: rnd(2000, 5000),
}));

const StarDot = memo(({ p }: { p: Pt }) => {
  const op = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue: 0.85, duration: p.dur * 0.5, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.2,  duration: p.dur * 0.5, useNativeDriver: true }),
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
      <LinearGradient colors={['transparent', 'rgba(255,255,255,0.2)', '#fff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: m.len, height: 1.5, borderRadius: 1 }} />
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
      <LinearGradient colors={[C.navyMid, C.navyMid]} style={StyleSheet.absoluteFill} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => <ShootingStar key={m.id} m={m} onDone={() => setMeteors(p => p.filter(x => x.id !== m.id))} />)}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ─── SKELETON ────────────────────────────────────────────────────────────────
const ReviewSkeleton = memo(() => {
  const op = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.3, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{ flex: 1, opacity: op, paddingHorizontal: 20, paddingTop: 120, gap: 14 }}>
      {[80, 200, 100].map((h, i) => <View key={i} style={{ height: h, borderRadius: 16, backgroundColor: T.surf }} />)}
    </Animated.View>
  );
});
ReviewSkeleton.displayName = 'ReviewSkeleton';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function readingTime(text: string): string {
  const mins = Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));
  return `${mins} min`;
}

function getRelativeTime(date: Date): string {
  const d = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Hier';
  if (d < 7)   return `Il y a ${d} jours`;
  if (d < 30)  return `Il y a ${Math.floor(d / 7)} sem.`;
  if (d < 365) return `Il y a ${Math.floor(d / 30)} mois`;
  return `Il y a ${Math.floor(d / 365)} an${Math.floor(d / 365) > 1 ? 's' : ''}`;
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginBottom: 20 }} />;

const SectionLabel = memo(({ label }: { label: string }) => (
  <Text style={sl.txt}>{label.toUpperCase()}</Text>
));
SectionLabel.displayName = 'SectionLabel';
const sl = StyleSheet.create({
  txt: { color: T.textTert, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
});

// ─── FILM CARD ────────────────────────────────────────────────────────────────
const FilmCard = memo(({ film, onPress }: { film: any; onPress: () => void }) => (
  <TouchableOpacity style={fc.card} onPress={onPress} activeOpacity={0.8}>
    <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFillObject} />
    <View style={fc.info}>
      <Text style={fc.genre}>{film.genre}</Text>
      <Text style={fc.title} numberOfLines={1}>{film.title}</Text>
      <View style={fc.row}>
        <Text style={fc.cta}>Voir le film</Text>
        <Ionicons name="arrow-forward" size={12} color={T.textSec} />
      </View>
    </View>
  </TouchableOpacity>
));
FilmCard.displayName = 'FilmCard';
const fc = StyleSheet.create({
  card:  { height: 140, borderRadius: 18, overflow: 'hidden', marginBottom: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  info:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  genre: { color: T.textTert, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  title: { color: T.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cta:   { color: T.textSec, fontSize: 11, fontWeight: '600' },
});

// ─── AUTHOR ROW ───────────────────────────────────────────────────────────────
const AuthorRow = memo(({ user }: { user: any }) => (
  <View style={ar.row}>
    <Image source={{ uri: user?.avatar_url || 'https://i.pravatar.cc/100?img=13' }} style={ar.avatar} />
    <View style={{ flex: 1 }}>
      <Text style={ar.name}>{user?.username || 'Utilisateur inconnu'}</Text>
      <Text style={ar.sub}>Critique Cinéma</Text>
    </View>
    <View style={ar.badge}>
      <Ionicons name="ribbon-outline" size={12} color={T.textSec} />
      <Text style={ar.badgeTxt}>Critique</Text>
    </View>
  </View>
));
AuthorRow.displayName = 'AuthorRow';
const ar = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar:   { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: T.borderHi },
  name:     { color: T.text, fontSize: 14, fontWeight: '700' },
  sub:      { color: T.textTert, fontSize: 11, marginTop: 1 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, backgroundColor: T.surf },
  badgeTxt: { color: T.textSec, fontSize: 10, fontWeight: '600' },
});

// ─── RATING — discret, étoiles jaunes ────────────────────────────────────────
const RATING_LABELS = ['', 'Décevant', 'Passable', 'Bien', 'Excellent', "Chef-d'œuvre"];

const RatingRow = memo(({ rating }: { rating: number }) => {
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: rating / 5, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [rating]); // eslint-disable-line
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={rr.wrap}>
      <View style={rr.top}>
        <View style={rr.stars}>
          {[1, 2, 3, 4, 5].map(i => (
            <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={18} color={i <= rating ? T.gold : T.textTert} />
          ))}
        </View>
        <Text style={rr.label}>{RATING_LABELS[rating] ?? ''}</Text>
      </View>
      <View style={rr.track}>
        <Animated.View style={[rr.fill, { width: barWidth }]} />
      </View>
      <Text style={rr.fraction}>{rating} / 5</Text>
    </View>
  );
});
RatingRow.displayName = 'RatingRow';
const rr = StyleSheet.create({
  wrap:     { marginBottom: 20 },
  top:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stars:    { flexDirection: 'row', gap: 4 },
  label:    { color: T.textTert, fontSize: 11, fontWeight: '600' },
  track:    { height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden', marginBottom: 5 },
  fill:     { height: '100%', backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 1 },
  fraction: { color: T.textTert, fontSize: 10, textAlign: 'right' },
});

// ─── QUOTE WIDGET ────────────────────────────────────────────────────────────
const QuoteWidget = memo(({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const MAX  = 280;
  const long = content.length > MAX;
  const text = long && !expanded ? content.slice(0, MAX) + '…' : content;
  return (
    <View style={qw.wrap}>
      <View style={qw.bar} />
      <View style={qw.inner}>
        <Text style={qw.text}>{text}</Text>
        {long && (
          <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ marginTop: 10 }}>
            <Text style={qw.more}>{expanded ? 'Réduire ↑' : 'Lire la suite ↓'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
QuoteWidget.displayName = 'QuoteWidget';
const qw = StyleSheet.create({
  wrap:  { flexDirection: 'row', marginBottom: 20, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, backgroundColor: T.surf },
  bar:   { width: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  inner: { flex: 1, padding: 16 },
  text:  { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 24, fontStyle: 'italic' },
  more:  { color: T.textSec, fontSize: 12, fontWeight: '600' },
});

// ─── DATE BADGE ──────────────────────────────────────────────────────────────
const DateBadge = memo(({ dateStr }: { dateStr: string }) => {
  const date    = new Date(dateStr);
  const isValid = !isNaN(date.getTime());
  const day     = isValid ? date.getDate() : '—';
  const month   = isValid ? date.toLocaleString('fr-FR', { month: 'short' }).toUpperCase() : '—';
  return (
    <View style={dbd.row}>
      <View style={dbd.cal}>
        <View style={dbd.calTop}><Text style={dbd.calMonth}>{month}</Text></View>
        <View style={dbd.calBody}><Text style={dbd.calDay}>{day}</Text></View>
      </View>
      <View>
        <Text style={dbd.full}>{isValid ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</Text>
        {isValid && <Text style={dbd.rel}>{getRelativeTime(date)}</Text>}
      </View>
    </View>
  );
});
DateBadge.displayName = 'DateBadge';
const dbd = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cal:      { width: 42, height: 42, borderRadius: 9, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  calTop:   { backgroundColor: T.surfHi, paddingVertical: 3, alignItems: 'center' },
  calMonth: { color: T.textTert, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  calBody:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surf },
  calDay:   { color: T.text, fontSize: 15, fontWeight: '800' },
  full:     { color: T.text, fontSize: 13, fontWeight: '600' },
  rel:      { color: T.textTert, fontSize: 11, marginTop: 2 },
});

// ─── STAT PILLS ──────────────────────────────────────────────────────────────
const StatPill = memo(({ icon, value, label }: { icon: string; value: string; label: string }) => (
  <View style={stp.pill}>
    <Ionicons name={icon as any} size={13} color={T.textTert} />
    <Text style={stp.val}>{value}</Text>
    <Text style={stp.lbl}>{label}</Text>
  </View>
));
StatPill.displayName = 'StatPill';
const stp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  val:  { color: T.text, fontSize: 12, fontWeight: '700' },
  lbl:  { color: T.textTert, fontSize: 11 },
});

// ─── LIKE BUTTON ─────────────────────────────────────────────────────────────
const LikeButton = memo(({ initialCount }: { initialCount: number }) => {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const scale             = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    setLiked(v => !v);
    setCount(c => liked ? c - 1 : c + 1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
  }, [liked, scale]);

  return (
    <TouchableOpacity onPress={handlePress} style={lkb.btn} activeOpacity={0.75}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? T.pink : T.textSec} />
      </Animated.View>
      <Text style={[lkb.count, liked && { color: T.pink }]}>{count.toLocaleString()}</Text>
      <Text style={lkb.lbl}>{liked ? 'Aimé' : "J'aime"}</Text>
    </TouchableOpacity>
  );
});
LikeButton.displayName = 'LikeButton';
const lkb = StyleSheet.create({
  btn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, paddingVertical: 13, borderRadius: 14 },
  count: { color: T.text, fontSize: 14, fontWeight: '700' },
  lbl:   { color: T.textTert, fontSize: 11 },
});

// ─── SHARE BUTTON ────────────────────────────────────────────────────────────
const ShareButton = memo(({ title, content }: { title: string; content: string }) => {
  const onPress = useCallback(async () => {
    try { await Share.share({ message: `🎬 Critique de "${title}"\n\n${content.slice(0, 200)}…` }); } catch {}
  }, [title, content]);
  return (
    <TouchableOpacity onPress={onPress} style={shb.btn} activeOpacity={0.75}>
      <Ionicons name="share-outline" size={18} color={T.textSec} />
      <Text style={shb.txt}>Partager</Text>
    </TouchableOpacity>
  );
});
ShareButton.displayName = 'ShareButton';
const shb = StyleSheet.create({
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, paddingVertical: 13, borderRadius: 14 },
  txt: { color: T.text, fontSize: 14, fontWeight: '600' },
});

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ReviewDetailScreen() {
  const router        = useRouter();
  const { id }        = useLocalSearchParams<{ id: string }>();
  const [review,  setReview]  = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const fetchReview = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(false);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isUUID) {
      const mock = DEFAULT_REVIEWS.find(r => r.id === id);
      if (mock) {
        setReview({ id: mock.id, content: mock.content, rating: mock.rating, likes_count: mock.likes, created_at: mock.date, user: { username: 'Critique Cinéma', avatar_url: `https://i.pravatar.cc/150?u=${mock.id}` }, film: { id: mock.film.id, title: mock.film.title, poster_url: mock.film.posterUrl, genre: mock.film.genre || '—' } });
      } else { setError(true); }
      setLoading(false);
      return;
    }

    try {
      const { data, error: e } = await supabase.from('critiques').select('*').eq('id', id).single();
      if (e) throw e;
      let userData = null;
      if (data?.user_id) {
        const { data: p } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', data.user_id).maybeSingle();
        userData = p;
      }
      const filmTitle = data.film_title || data.title || 'Film inconnu';
      setReview({ ...data, user: userData, film: { id: data.reel_id || data.id, title: filmTitle, poster_url: `https://picsum.photos/seed/${encodeURIComponent(filmTitle)}/800/500`, genre: '—' } });
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  if (loading) return <View style={s.root}><GalaxyBackground /><ReviewSkeleton /></View>;

  if (error || !review) return (
    <View style={[s.root, s.center]}>
      <GalaxyBackground />
      <Ionicons name="alert-circle-outline" size={48} color={T.textTert} />
      <Text style={s.errorTxt}>Critique introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.backCta}>
        <Text style={{ color: T.text, fontWeight: '700', fontSize: 13 }}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* NAV */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.navBtn}>
            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Critique</Text>
          <View style={s.navBtn}>
            <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="bookmark-outline" size={17} color={T.textSec} />
          </View>
        </View>

        <View style={s.body}>

          {review.film && <FilmCard film={review.film} onPress={() => router.push(`/film/${review.film.id}`)} />}

          <SectionLabel label="Auteur" />
          <AuthorRow user={review.user} />
          <Divider />

          <SectionLabel label="Note" />
          <RatingRow rating={review.rating ?? 0} />
          <Divider />

          <View style={s.pills}>
            <StatPill icon="heart-outline" value={String(review.likes_count ?? 0)} label="J'aimes" />
            <StatPill icon="book-outline"  value={readingTime(review.content || '')} label="Lecture" />
            <StatPill icon="eye-outline"   value="—" label="Vues" />
          </View>
          <Divider />

          <SectionLabel label="La critique" />
          <QuoteWidget content={review.content || 'Aucun contenu disponible.'} />

          <SectionLabel label="Publiée le" />
          <DateBadge dateStr={review.created_at ?? ''} />
          <Divider />

          <View style={s.actions}>
            <LikeButton initialCount={review.likes_count ?? 0} />
            <ShareButton title={review.film?.title ?? 'ce film'} content={review.content ?? ''} />
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.navyMid },
  center:      { justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingBottom: 100 },
  errorTxt:    { color: T.textSec, fontSize: 15, marginTop: 12, fontWeight: '600' },
  backCta:     { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, backgroundColor: T.surf },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 58 : 32, paddingBottom: 18 },
  navBtn:      { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  headerTitle: { color: T.text, fontSize: 16, fontWeight: '700' },
  body:        { paddingHorizontal: 20 },
  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  actions:     { flexDirection: 'row', gap: 10, marginTop: 4 },
});