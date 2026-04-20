// app/reel/[id].tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'un épisode — fetche depuis Supabase via l'id de route
//  Règle 60/30/10 : 60 % C.navyMid · 30 % blanc/texte · 10 % accent bleu+or
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, Platform,
  Animated, Share, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  fetchEpisodeById, fetchEpisodesBySeries,
  updateEpisodeLikes,
  type FeedFilm, type Friend,
} from '@/lib/supabaseReels';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — 60 % navyMid · 30 % blanc · 10 % bleu + or
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // ── 60 % dominant ─────────────────────────────────────────────
  bg:         '#020810',             // fond racine
  navyDeep:   '#060F1E',             // navy très sombre
  navyMid:    '#0D2240',             // couleur principale (60 %)
  navyLight:  '#163356',             // surface légèrement plus claire
  navyBright: '#1E4A7A',             // navy interactif

  surf:       'rgba(13,34,64,0.60)', // navyMid translucide
  surfHi:     'rgba(13,34,64,0.85)',
  border:     'rgba(255,255,255,0.07)',
  borderHi:   'rgba(255,255,255,0.14)',
  borderBlue: 'rgba(90,150,230,0.20)',

  // ── 30 % blanc / texte ────────────────────────────────────────
  white:      '#FFFFFF',
  text:       '#EEF4FF',             // blanc bleuté — titre
  textSec:    '#7A99BE',             // bleu-gris — métadonnées
  textTert:   '#2E4A68',             // placeholder / désactivé

  // ── 10 % accents ──────────────────────────────────────────────
  blue:       '#5A96E6',             // accent bleu (ex-teal)
  blueDim:    'rgba(90,150,230,0.14)',
  gold:       '#F5C842',             // or — étoiles / badge "Original"
  goldDim:    'rgba(245,200,66,0.12)',
  red:        '#FF3B5C',             // cœur liké
  green:      '#2ECC8A',             // badge "En cours"
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRE — durée lisible
// ─────────────────────────────────────────────────────────────────────────────
function fmtLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON — shimmer pulsé
// ─────────────────────────────────────────────────────────────────────────────
const DetailSkeleton = memo(function DetailSkeleton() {
  const op = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.55, duration: 950, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.25, duration: 950, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const Block = ({ w, h, radius = 8 }: { w: number | string; h: number; radius?: number }) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: radius, backgroundColor: C.navyLight, opacity: op, marginBottom: 12 }} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: H * 0.44, backgroundColor: C.navyMid }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 4 }}>
        <Block w={80}  h={11} />
        <Block w="75%" h={28} />
        <Block w="55%" h={18} />
        <View style={{ height: 8 }} />
        <Block w="100%" h={14} />
        <Block w="90%"  h={14} />
        <Block w="65%"  h={14} />
        <View style={{ height: 8 }} />
        <Block w="100%" h={52} radius={14} />
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR — position de l'épisode dans la série
// ─────────────────────────────────────────────────────────────────────────────
const SeriesProgress = memo(function SeriesProgress({
  current, total,
}: { current: number; total: number }) {
  if (total <= 1) return null;
  const pct = Math.min(1, (current - 1) / Math.max(1, total - 1));
  return (
    <View style={sp.wrap}>
      <Text style={sp.label}>Épisode {current} sur {total}</Text>
      <View style={sp.track}>
        <Animated.View style={[sp.fill, { width: `${pct * 100}%` }]} />
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              sp.dot,
              { left: `${(i / Math.max(1, total - 1)) * 100}%` as any },
              i < current && sp.dotDone,
              i === current - 1 && sp.dotCurr,
            ]}
          />
        ))}
      </View>
    </View>
  );
});
const sp = StyleSheet.create({
  wrap:     { marginBottom: 22 },
  label:    { color: C.textTert, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  track:    { height: 3, backgroundColor: C.navyLight, borderRadius: 2, position: 'relative', justifyContent: 'center' },
  fill:     { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.blue, borderRadius: 2 },
  dot:      { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: C.navyMid, borderWidth: 1.5, borderColor: C.textTert, top: -2, marginLeft: -3.5 },
  dotDone:  { backgroundColor: C.blue, borderColor: C.blue },
  dotCurr:  { backgroundColor: C.white, borderColor: C.blue, width: 9, height: 9, top: -3, marginLeft: -4.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL — icône + valeur + label optionnel
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = memo(function StatPill({
  icon, value, label, color, onPress,
}: {
  icon: string; value: string; label?: string;
  color?: string; onPress?: () => void;
}) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={stp.pill} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon as any} size={17} color={color ?? C.textSec} />
      <View>
        <Text style={[stp.val, color ? { color } : {}]}>{value}</Text>
        {label && <Text style={stp.lbl}>{label}</Text>}
      </View>
    </Wrap>
  );
});
const stp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  val:  { color: C.text, fontSize: 13, fontWeight: '700' },
  lbl:  { color: C.textTert, fontSize: 10, fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// CARD ÉPISODE — liste de la série
// ─────────────────────────────────────────────────────────────────────────────
const EpisodeCard = memo(function EpisodeCard({
  ep, isCurrent, onPress,
}: { ep: FeedFilm; isCurrent: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[ec.card, isCurrent && ec.cardActive]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={ec.thumb}>
        <Image source={{ uri: ep.poster_url }} style={ec.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.75)']}
          style={StyleSheet.absoluteFillObject}
        />
        {isCurrent ? (
          <View style={ec.playingBadge}>
            <Ionicons name="radio-button-on" size={11} color={C.blue} />
          </View>
        ) : (
          <View style={ec.playIcon}>
            <Ionicons name="play" size={12} color={C.white} />
          </View>
        )}
      </View>

      {/* Infos */}
      <View style={ec.info}>
        <Text style={ec.epNum}>Ép. {ep.episode}</Text>
        <Text style={ec.epTitle} numberOfLines={2}>{ep.episode_title}</Text>
        <View style={ec.epMeta}>
          <Ionicons name="time-outline" size={10} color={C.textTert} />
          <Text style={ec.epDur}>{ep.duration}</Text>
        </View>
      </View>

      {/* Chevron */}
      {!isCurrent && (
        <Ionicons name="chevron-forward" size={16} color={C.textTert} style={{ alignSelf: 'center' }} />
      )}
    </TouchableOpacity>
  );
});
const ec = StyleSheet.create({
  card:         { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surf },
  cardActive:   { borderColor: C.borderBlue, backgroundColor: C.blueDim },
  thumb:        { width: 82, height: 58, borderRadius: 10, overflow: 'hidden' },
  img:          { width: '100%', height: '100%' },
  playingBadge: { position: 'absolute', bottom: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: C.navyMid, justifyContent: 'center', alignItems: 'center' },
  playIcon:     { position: 'absolute', bottom: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  info:         { flex: 1, justifyContent: 'center', gap: 3 },
  epNum:        { color: C.blue, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  epTitle:      { color: C.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  epMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  epDur:        { color: C.textTert, fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LIKED-BY ROW — pile d'avatars amis
// ─────────────────────────────────────────────────────────────────────────────
const LikedByRow = memo(function LikedByRow({ friends }: { friends: Friend[] }) {
  if (!friends.length) return null;
  const shown = friends.slice(0, 5);
  const extra = friends.length - shown.length;

  return (
    <View style={lb.wrap}>
      <View style={lb.avatars}>
        {shown.map((f, i) => (
          <Image
            key={f.id}
            source={{ uri: f.avatar }}
            style={[lb.av, i > 0 && { marginLeft: -9 }]}
          />
        ))}
        {extra > 0 && (
          <View style={[lb.av, lb.extra, { marginLeft: -9 }]}>
            <Text style={lb.extraTxt}>+{extra}</Text>
          </View>
        )}
      </View>
      <Text style={lb.txt} numberOfLines={2}>
        <Text style={{ color: C.text, fontWeight: '700' }}>
          {shown.slice(0, 2).map(f => f.name).join(' & ')}
        </Text>
        {friends.length > 2 ? ` et ${friends.length - 2} autre${friends.length > 3 ? 's' : ''} ami${friends.length > 3 ? 's' : ''}` : ''} ont aimé cet épisode
      </Text>
    </View>
  );
});
const lb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 12, borderRadius: 14, marginBottom: 20 },
  avatars:  { flexDirection: 'row' },
  av:       { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.navyMid, overflow: 'hidden' },
  extra:    { backgroundColor: C.navyLight, justifyContent: 'center', alignItems: 'center' },
  extraTxt: { color: C.textSec, fontSize: 8, fontWeight: '800' },
  txt:      { color: C.textSec, fontSize: 12, flex: 1, lineHeight: 17 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return (
    <View style={sch.row}>
      <View style={sch.dot} />
      <Text style={sch.txt}>{children}</Text>
    </View>
  );
});
const sch = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 3, height: 18, borderRadius: 2, backgroundColor: C.blue },
  txt: { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT REVEAL — animation d'entrée en stagger
// ─────────────────────────────────────────────────────────────────────────────
function useReveal(ready: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(anim, {
      toValue: 1, duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ready]);
  return anim;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN DÉTAIL ÉPISODE
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [episode,    setEpisode]    = useState<FeedFilm | null>(null);
  const [seriesEps,  setSeriesEps]  = useState<FeedFilm[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [liked,      setLiked]      = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [expanded,   setExpanded]   = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;
  const saveScale  = useRef(new Animated.Value(1)).current;
  const reveal     = useReveal(!loading && !error && !!episode);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(false);
    try {
      const ep = await fetchEpisodeById(id);
      if (!ep) throw new Error('not found');
      setEpisode(ep);
      setLocalLikes(ep.likes);
      const eps = await fetchEpisodesBySeries(ep.series_id);
      setSeriesEps(eps);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setLiked(false); setExpanded(false); }, [id]);

  // ── Like ─────────────────────────────────────────────────────────────────
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
    if (episode) updateEpisodeLikes(episode.id, next ? 1 : -1).catch(console.warn);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(heartScale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [liked, episode, heartScale]);

  // ── Sauvegarde ───────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    setSaved(v => !v);
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(saveScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [saveScale]);

  // ── Partage ──────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!episode) return;
    try {
      await Share.share({
        message: `Découvrez "${episode.episode_title}" de ${episode.series} sur Universe App !`,
        title: episode.episode_title,
      });
    } catch (e) { console.warn('[share]', e); }
  }, [episode]);

  // ── Dérivés stables ──────────────────────────────────────────────────────
  const otherEps = useMemo(
    () => seriesEps.filter(e => e.id !== id),
    [seriesEps, id],
  );
  const episodeIndex = useMemo(
    () => seriesEps.findIndex(e => e.id === id),
    [seriesEps, id],
  );
  const captionShort = useMemo(() => {
    if (!episode?.caption) return '';
    return episode.caption.length > 180
      ? episode.caption.slice(0, 180).trimEnd() + '…'
      : episode.caption;
  }, [episode?.caption]);

  // ── Styles animés partagés ───────────────────────────────────────────────
  const bodyStyle = useMemo(() => ({
    opacity:   reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  }), [reveal]);

  // ─────────────────────────────────────────────────────────────────────────
  // ÉTATS VIDES
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <DetailSkeleton />
    </View>
  );

  if (error || !episode) return (
    <View style={[s.root, s.center]}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <View style={s.errorIcon}>
        <Ionicons name="film-outline" size={32} color={C.textTert} />
      </View>
      <Text style={s.errorTitle}>Épisode introuvable</Text>
      <Text style={s.errorSub}>Cet épisode n'existe pas ou a été retiré du catalogue.</Text>
      <TouchableOpacity style={s.errorBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={15} color={C.white} />
        <Text style={s.errorBtnTxt}>Retour au fil</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        scrollEventThrottle={16}
      >

        {/* ══════════════════════════════════════════════════════════
            HERO — poster cinématique
        ══════════════════════════════════════════════════════════ */}
        <View style={s.heroWrap}>
          <Image source={{ uri: episode.poster_url }} style={s.heroImg} resizeMode="cover" />

          {/* Dégradé bas — fondu vers le fond navy */}
          <LinearGradient
            colors={['transparent', 'rgba(2,8,16,0.45)', C.bg]}
            locations={[0.35, 0.72, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Dégradé haut — sécurité lisibilité boutons */}
          <LinearGradient
            colors={['rgba(2,8,16,0.55)', 'transparent']}
            locations={[0, 0.30]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* ── Bouton retour ── */}
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <BlurView intensity={28} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={21} color={C.white} />
            </BlurView>
          </TouchableOpacity>

          {/* ── Actions top-right ── */}
          <View style={s.topRight}>
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <TouchableOpacity style={s.actionCircle} onPress={handleSave} hitSlop={8}>
                <BlurView intensity={28} tint="dark" style={s.blurCircle}>
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={saved ? C.gold : C.white}
                  />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={s.actionCircle} onPress={handleShare} hitSlop={8}>
              <BlurView intensity={28} tint="dark" style={s.blurCircle}>
                <Ionicons name="share-outline" size={18} color={C.white} />
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* ── Badge "Original" ── */}
          {episode.verified && (
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={11} color={C.gold} />
              <Text style={s.verifiedTxt}>ORIGINAL</Text>
            </View>
          )}

          {/* ── Numéro épisode en surimpression bas-droite ── */}
          <View style={s.epNumBadge}>
            <Text style={s.epNumTxt}>
              {String(episode.episode ?? 1).padStart(2, '0')}
            </Text>
            <Text style={s.epNumLabel}>ép.</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════════
            CORPS — contenu animé avec reveal
        ══════════════════════════════════════════════════════════ */}
        <Animated.View style={[s.body, bodyStyle]}>

          {/* ── TITRE + SÉRIE ── */}
          <View style={s.titleBlock}>
            <Text style={s.seriesLabel} numberOfLines={1}>{episode.series?.toUpperCase()}</Text>
            <Text style={s.epTitle} numberOfLines={3}>
              {episode.episode_title}
            </Text>
            {episode.director ? (
              <Text style={s.directorInline}>
                <Text style={{ color: C.textTert }}>par </Text>
                {episode.director}
              </Text>
            ) : null}
          </View>

          {/* ── PROGRESSION DANS LA SÉRIE ── */}
          {seriesEps.length > 1 && (
            <SeriesProgress
              current={episodeIndex + 1}
              total={seriesEps.length}
            />
          )}

          {/* ── STATS PILLS ── */}
          <View style={s.statsRow}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.80}>
              <View style={[stp.pill, liked && { borderColor: 'rgba(255,59,92,0.35)', backgroundColor: 'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={17}
                    color={liked ? C.red : C.textSec}
                  />
                </Animated.View>
                <View>
                  <Text style={[stp.val, liked && { color: C.red }]}>{fmtLikes(localLikes)}</Text>
                  <Text style={stp.lbl}>J'aime</Text>
                </View>
              </View>
            </TouchableOpacity>

            <StatPill icon="time-outline"     value={episode.duration ?? '—'} label="Durée"  />
            <StatPill icon="calendar-outline" value={episode.year ?? '—'}     label="Année"  />
            {episode.rating != null && episode.rating > 0 && (
              <StatPill
                icon="star"
                value={`${episode.rating}/5`}
                label="Note"
                color={C.gold}
              />
            )}
          </View>

          {/* ── BOUTON PLAY ── */}
          <TouchableOpacity style={s.playBtn} activeOpacity={0.88}>
            <LinearGradient
              colors={[C.navyBright, C.navyMid]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.playGrad}
            >
              <View style={s.playIconWrap}>
                <Ionicons name="play" size={18} color={C.white} />
              </View>
              <View>
                <Text style={s.playTxt}>Regarder l'épisode</Text>
                <Text style={s.playMeta}>{episode.duration} · HD</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── TAGS ── */}
          {episode.tags?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tagRow}
              style={{ marginBottom: 22 }}
            >
              {episode.tags.map(tag => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagTxt}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── SYNOPSIS ── */}
          {episode.caption ? (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.caption}>
                {expanded ? episode.caption : captionShort}
              </Text>
              {(episode.caption.length > 180) && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={s.expandBtn}>
                  <Text style={s.expandTxt}>
                    {expanded ? 'Réduire' : 'Lire la suite'}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={C.blue}
                  />
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* ── AMIS AYANT LIKÉ ── */}
          {episode.liked_by_friends?.length > 0 && (
            <LikedByRow friends={episode.liked_by_friends} />
          )}

          {/* ── RÉALISATEUR ── */}
          {episode.director ? (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <View style={s.directorCard}>
                <Image
                  source={{ uri: `https://i.pravatar.cc/120?u=${encodeURIComponent(episode.director)}` }}
                  style={s.directorAv}
                />
                <View style={s.directorInfo}>
                  <Text style={s.directorName}>{episode.director}</Text>
                  <Text style={s.directorSub}>{episode.series}</Text>
                  <Text style={s.directorYear}>{episode.year}</Text>
                </View>
                <TouchableOpacity style={s.directorBtn}>
                  <Text style={s.directorBtnTxt}>Voir</Text>
                  <Ionicons name="chevron-forward" size={12} color={C.blue} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* ── AUTRES ÉPISODES ── */}
          {otherEps.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Autres épisodes</SectionTitle>
              {otherEps.map(ep => (
                <EpisodeCard
                  key={ep.id}
                  ep={ep}
                  isCurrent={ep.id === id}
                  onPress={() => router.replace(`/reel/${ep.id}`)}
                />
              ))}
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 110 },

  // ── Hero ──────────────────────────────────────────────────────
  heroWrap:     { height: H * 0.44, position: 'relative' },
  heroImg:      { width: '100%', height: '100%' },

  backBtn:      { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, left: 16 },
  actionCircle: {},
  blurCircle:   {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  topRight:     {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, right: 16,
    gap: 10, alignItems: 'flex-end',
  },

  verifiedBadge: {
    position: 'absolute', bottom: 18, left: 18,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.goldDim, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,200,66,0.28)',
  },
  verifiedTxt: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  epNumBadge:  {
    position: 'absolute', bottom: 14, right: 18, alignItems: 'flex-end',
  },
  epNumTxt:    { color: 'rgba(255,255,255,0.08)', fontSize: 72, fontWeight: '900', lineHeight: 72, letterSpacing: -4 },
  epNumLabel:  { color: C.textTert, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: -14 },

  // ── Body ──────────────────────────────────────────────────────
  body:        { paddingHorizontal: 20, paddingTop: 24 },

  // ── Titre ─────────────────────────────────────────────────────
  titleBlock:  { marginBottom: 20 },
  seriesLabel: { color: C.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  epTitle:     { color: C.white, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, marginBottom: 7 },
  directorInline: { color: C.textSec, fontSize: 13, fontWeight: '600' },

  // ── Stats ─────────────────────────────────────────────────────
  statsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },

  // ── Play ──────────────────────────────────────────────────────
  playBtn:     { borderRadius: 16, overflow: 'hidden', marginBottom: 22, borderWidth: 1, borderColor: C.borderBlue },
  playGrad:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 },
  playIconWrap:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  playTxt:     { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  playMeta:    { color: C.textTert, fontSize: 11, marginTop: 2 },

  // ── Tags ──────────────────────────────────────────────────────
  tagRow:      { gap: 8, paddingVertical: 2 },
  tag:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  tagTxt:      { color: C.textSec, fontSize: 12, fontWeight: '600' },

  // ── Section ───────────────────────────────────────────────────
  section:     { marginBottom: 28 },

  // ── Synopsis ──────────────────────────────────────────────────
  caption:     { color: C.textSec, fontSize: 14, lineHeight: 23 },
  expandBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandTxt:   { color: C.blue, fontSize: 13, fontWeight: '700' },

  // ── Réalisateur ───────────────────────────────────────────────
  directorCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 16 },
  directorAv:    { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.navyLight },
  directorInfo:  { flex: 1 },
  directorName:  { color: C.text, fontSize: 15, fontWeight: '700' },
  directorSub:   { color: C.textSec, fontSize: 12, marginTop: 1 },
  directorYear:  { color: C.textTert, fontSize: 11, marginTop: 1 },
  directorBtn:   { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: C.navyLight },
  directorBtnTxt:{ color: C.blue, fontSize: 12, fontWeight: '700' },

  // ── Erreur ────────────────────────────────────────────────────
  errorIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  errorTitle:   { color: C.textSec, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorSub:     { color: C.textTert, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  errorBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi },
  errorBtnTxt:  { color: C.white, fontWeight: '700', fontSize: 14 },
});