// app/reel/[id].tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'un épisode / reel — fetche depuis Supabase par l'id de route
//  Affiche : lecteur vidéo, infos épisode, série, casting des amis ayant liké
// ─────────────────────────────────────────────────────────────────────────────
import React, {
    useState, useEffect, useRef, useCallback, memo,
    useMemo,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, ScrollView,
    TouchableOpacity, Dimensions, Platform,
    Animated, Easing, FlatList,
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
  
  const { width: W, height: H } = Dimensions.get('window');
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PALETTE
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
    red: '#FF375F',
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // GALAXY BACKGROUND
  // ─────────────────────────────────────────────────────────────────────────────
  const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  
  interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
  interface Met { id: number; sx: number; sy: number; ang: number; len: number; }
  
  const STARS: Pt[] = Array.from({ length: 40 }, (_, i) => ({
    id: i, x: rnd(0, W), y: rnd(0, H), sz: rnd(1, 2.1),
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
  // SOUS-COMPOSANTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Carte épisode dans la liste "Autres épisodes" */
  const EpisodeCard = memo(({ ep, isCurrent, onPress }: { ep: FeedFilm; isCurrent: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[ec.card, isCurrent && ec.cardActive]} activeOpacity={0.8} onPress={onPress}>
      <View style={ec.thumb}>
        <Image source={{ uri: ep.poster_url }} style={ec.img} resizeMode="cover" />
        {isCurrent && (
          <View style={ec.nowBadge}>
            <Ionicons name="play" size={10} color="white" />
          </View>
        )}
      </View>
      <View style={ec.info}>
        <Text style={ec.epNum}>Épisode {ep.episode}</Text>
        <Text style={ec.epTitle} numberOfLines={2}>{ep.episode_title}</Text>
        <Text style={ec.epDur}>{ep.duration}</Text>
      </View>
    </TouchableOpacity>
  ));
  EpisodeCard.displayName = 'EpisodeCard';
  const ec = StyleSheet.create({
    card:       { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass },
    cardActive: { borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.10)' },
    thumb:      { width: 80, height: 60, borderRadius: 10, overflow: 'hidden' },
    img:        { width: '100%', height: '100%' },
    nowBadge:   { position: 'absolute', bottom: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: G.primary, justifyContent: 'center', alignItems: 'center' },
    info:       { flex: 1, justifyContent: 'center', gap: 3 },
    epNum:      { color: G.accent, fontSize: 11, fontWeight: '700' },
    epTitle:    { color: G.sW, fontSize: 13, fontWeight: '600', lineHeight: 18 },
    epDur:      { color: G.textSub, fontSize: 11 },
  });
  
  /** Pile d'avatars des amis ayant liké */
  const LikedByRow = memo(({ friends }: { friends: Friend[] }) => {
    if (!friends.length) return null;
    const shown = friends.slice(0, 4);
    const extra = friends.length - shown.length;
    return (
      <View style={lb.row}>
        <View style={lb.avatars}>
          {shown.map((f, i) => (
            <Image key={f.id} source={{ uri: f.avatar }} style={[lb.av, i > 0 && { marginLeft: -10 }]} />
          ))}
          {extra > 0 && (
            <View style={[lb.av, { marginLeft: -10, backgroundColor: G.glass, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: 'white', fontSize: 8, fontWeight: '700' }}>+{extra}</Text>
            </View>
          )}
        </View>
        <Text style={lb.txt}>
          {shown.map(f => f.name).slice(0,2).join(', ')}
          {friends.length > 2 ? ` et ${friends.length - 2} autres` : ''} ont aimé
        </Text>
      </View>
    );
  });
  LikedByRow.displayName = 'LikedByRow';
  const lb = StyleSheet.create({
    row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    avatars: { flexDirection: 'row' },
    av:      { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'white', overflow: 'hidden' },
    txt:     { color: G.textSub, fontSize: 12, flex: 1 },
  });
  
  /** Skeleton plein-écran */
  const DetailSkeleton = memo(() => {
    const op = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(op, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])).start();
    }, []); // eslint-disable-line
    return (
      <Animated.View style={{ flex: 1, opacity: op }}>
        <View style={{ height: H * 0.45, backgroundColor: G.glass }} />
        <View style={{ padding: 24, gap: 14 }}>
          {[180, 120, '100%', '80%', '60%'].map((w, i) => (
            <View key={i} style={{ height: i === 0 ? 28 : 14, width: w, backgroundColor: G.glass, borderRadius: 8 }} />
          ))}
        </View>
      </Animated.View>
    );
  });
  DetailSkeleton.displayName = 'DetailSkeleton';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ÉCRAN DÉTAIL ÉPISODE
  // ─────────────────────────────────────────────────────────────────────────────
  export default function ReelDetailScreen() {
    const router      = useRouter();
    const { id }      = useLocalSearchParams<{ id: string }>();
  
    const [episode,   setEpisode]   = useState<FeedFilm | null>(null);
    const [seriesEps, setSeriesEps] = useState<FeedFilm[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(false);
    const [liked,     setLiked]     = useState(false);
    const [saved,     setSaved]     = useState(false);
    const [localLikes, setLocalLikes] = useState(0);
  
    const heartScale = useRef(new Animated.Value(1)).current;
  
    // ── Fetch ──────────────────────────────────────────────────────
    const load = useCallback(async () => {
      if (!id) return;
      setLoading(true); setError(false);
      try {
        const ep = await fetchEpisodeById(id);
        if (!ep) throw new Error('not found');
        setEpisode(ep);
        setLocalLikes(ep.likes);
        // Épisodes de la même série en parallèle
        const eps = await fetchEpisodesBySeries(ep.series_id);
        setSeriesEps(eps);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, [id]);
  
    useEffect(() => { load(); }, [load]);
  
    // Reset like quand on change d'épisode
    useEffect(() => { setLiked(false); }, [id]);
  
    // ── Like ───────────────────────────────────────────────────────
    const handleLike = useCallback(() => {
      const next = !liked;
      setLiked(next);
      setLocalLikes(prev => prev + (next ? 1 : -1));
      if (episode) updateEpisodeLikes(episode.id, next ? 1 : -1).catch(console.warn);
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.35, duration: 140, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1,    duration: 140, useNativeDriver: true }),
      ]).start();
    }, [liked, episode, heartScale]);
  
    // ── États ─────────────────────────────────────────────────────
    if (loading) return (
      <View style={s.container}><GalaxyBackground /><DetailSkeleton /></View>
    );
  
    if (error || !episode) return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <GalaxyBackground />
        <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.2)" />
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginTop: 16, fontWeight: '600' }}>Épisode introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtnCenter}>
          <Text style={{ color: G.primary, fontWeight: '700' }}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  
    const otherEps = seriesEps.filter(e => e.id !== episode.id);
  
    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <GalaxyBackground />
  
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
  
          {/* ── HERO / POSTER ── */}
          <View style={s.heroWrap}>
            <Image source={{ uri: episode.poster_url }} style={s.heroImg} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(6,0,16,0)', 'rgba(6,0,16,0.5)', G.bg0]}
              style={s.heroGrad}
            />
  
            {/* Bouton retour */}
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <BlurView intensity={30} tint="dark" style={s.blurCircle}>
                <Ionicons name="chevron-back" size={22} color="white" />
              </BlurView>
            </TouchableOpacity>
  
            {/* Actions top-right */}
            <View style={s.topRight}>
              <TouchableOpacity style={s.backBtn} onPress={() => setSaved(v => !v)}>
                <BlurView intensity={30} tint="dark" style={s.blurCircle}>
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? G.sG : 'white'} />
                </BlurView>
              </TouchableOpacity>
              <TouchableOpacity style={s.backBtn}>
                <BlurView intensity={30} tint="dark" style={s.blurCircle}>
                  <Ionicons name="share-outline" size={20} color="white" />
                </BlurView>
              </TouchableOpacity>
            </View>
  
            {/* Badge série */}
            {episode.verified && (
              <View style={s.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color={G.sG} />
                <Text style={s.verifiedTxt}>Original</Text>
              </View>
            )}
          </View>
  
          {/* ── BODY ── */}
          <View style={s.body}>
  
            {/* Titre série + épisode */}
            <Text style={s.seriesLabel}>{episode.title}</Text>
            <Text style={s.epTitle}>
              Ép. {episode.episode} — {episode.episode_title}
            </Text>
  
            {/* Tags */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
              {episode.tags.map(tag => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagTxt}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
  
            {/* Stats */}
            <View style={s.stats}>
              <TouchableOpacity style={s.statBtn} onPress={handleLike}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? G.red : 'white'} />
                </Animated.View>
                <Text style={s.statTxt}>{localLikes.toLocaleString()}</Text>
              </TouchableOpacity>
              <View style={s.statItem}>
                <Ionicons name="time-outline" size={20} color={G.textSub} />
                <Text style={[s.statTxt, { color: G.textSub }]}>{episode.duration}</Text>
              </View>
              <View style={s.statItem}>
                <Ionicons name="calendar-outline" size={20} color={G.textSub} />
                <Text style={[s.statTxt, { color: G.textSub }]}>{episode.year}</Text>
              </View>
            </View>
  
            {/* Bouton Play principal */}
            <TouchableOpacity style={s.playBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#9B30FF','#C060FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playGrad}>
                <Ionicons name="play" size={22} color="white" />
                <Text style={s.playTxt}>Regarder l'épisode</Text>
              </LinearGradient>
            </TouchableOpacity>
  
            {/* Caption */}
            {episode.caption ? (
              <Text style={s.caption}>{episode.caption}</Text>
            ) : null}
  
            {/* Amis ayant liké */}
            <LikedByRow friends={episode.liked_by_friends} />
  
            {/* Infos réalisateur */}
            {episode.director ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Réalisateur·ice</Text>
                <View style={s.directorRow}>
                  <Image
                    source={{ uri: `https://i.pravatar.cc/80?u=${encodeURIComponent(episode.director)}` }}
                    style={s.directorAv}
                  />
                  <View>
                    <Text style={s.directorName}>{episode.director}</Text>
                    <Text style={s.directorSub}>{episode.series} · {episode.year}</Text>
                  </View>
                </View>
              </View>
            ) : null}
  
            {/* Autres épisodes de la série */}
            {otherEps.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Autres épisodes</Text>
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
  
          </View>
        </ScrollView>
      </View>
    );
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    container:    { flex: 1, backgroundColor: G.bg0 },
    scroll:       { paddingBottom: 100 },
  
    heroWrap:     { height: H * 0.44, position: 'relative' },
    heroImg:      { width: '100%', height: '100%' },
    heroGrad:     { ...StyleSheet.absoluteFillObject, top: '25%' },
  
    backBtn:      { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, left: 16 },
    backBtnCenter:{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: G.primary },
    blurCircle:   { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: G.glassBorder },
    topRight:     { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: 16, gap: 10, alignItems: 'flex-end' },
  
    verifiedBadge:{ position: 'absolute', bottom: 18, left: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,226,112,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,226,112,0.3)' },
    verifiedTxt:  { color: G.sG, fontSize: 11, fontWeight: '700' },
  
    body:         { paddingHorizontal: 20, paddingTop: 22 },
  
    seriesLabel:  { color: G.accent, fontSize: 13, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
    epTitle:      { color: 'white', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 16, lineHeight: 32 },
  
    tag:          { backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginRight: 8 },
    tagTxt:       { color: G.accent, fontSize: 12, fontWeight: '600' },
  
    stats:        { flexDirection: 'row', gap: 20, marginBottom: 20, alignItems: 'center' },
    statBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statTxt:      { color: 'white', fontSize: 14, fontWeight: '600' },
  
    playBtn:      { borderRadius: 16, overflow: 'hidden', marginBottom: 22 },
    playGrad:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    playTxt:      { color: 'white', fontSize: 17, fontWeight: '700' },
  
    caption:      { color: G.textSub, fontSize: 15, lineHeight: 24, fontStyle: 'italic', marginBottom: 22 },
  
    section:      { marginBottom: 28 },
    sectionTitle: { color: 'white', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  
    directorRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, padding: 14, borderRadius: 16 },
    directorAv:   { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: G.accent },
    directorName: { color: 'white', fontSize: 15, fontWeight: '600' },
    directorSub:  { color: G.textSub, fontSize: 12, marginTop: 2 },
  });