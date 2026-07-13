// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'un Reel — fetche depuis Supabase via l'id de route
//  Adapté au schéma public.reels
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
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

// Assurez-vous d'adapter ces imports dans votre fichier `lib/supabaseReels`
import { fetchEpisodeById, updateEpisodeLikes } from '@/lib/supabaseReels';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import { supabase } from '@/lib/supabase';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES (Basé sur public.reels)
// ─────────────────────────────────────────────────────────────────────────────
export interface ReelData {
  id: string;
  user_id: string;
  video_url: string;
  title: string | null;
  genre: string | null;
  director: string | null;
  year: string | null;
  synopsis: string | null;
  duration: number | null;
  likes_count: number;
  views_count: number;
  status: string;
  thumbnail_url?: string; // Fallback visuel car video_url ne s'affiche pas dans <Image>
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:         '#020810',
  navyDeep:   '#060F1E',
  navyMid:    '#0D2240',
  navyLight:  '#163356',
  navyBright: '#1E4A7A',
  surf:       'rgba(13,34,64,0.60)',
  surfHi:     'rgba(13,34,64,0.85)',
  border:     'rgba(255,255,255,0.07)',
  borderHi:   'rgba(255,255,255,0.14)',
  borderBlue: 'rgba(90,150,230,0.20)',
  white:      '#FFFFFF',
  text:       '#EEF4FF',
  textSec:    '#7A99BE',
  textTert:   '#2E4A68',
  blue:       '#5A96E6',
  blueDim:    'rgba(90,150,230,0.14)',
  gold:       '#F5C842',
  goldDim:    'rgba(245,200,66,0.12)',
  red:        '#FF3B5C',
} as const;

function fmtLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS PURS (Memoisés)
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
        <Block w="100%" h={52} radius={14} />
      </View>
    </View>
  );
});

const StatPill = memo(function StatPill({ icon, value, label, color }: { icon: string; value: string; label?: string; color?: string; }) {
  return (
    <View style={s.statPill} activeOpacity={0.75}>
      <Ionicons name={icon as any} size={17} color={color ?? C.textSec} />
      <View>
        <Text style={[s.statVal, color ? { color } : {}]}>{value}</Text>
        {label && <Text style={s.statLbl}>{label}</Text>}
      </View>
    </View>
  );
});

const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionDot} />
      <Text style={s.sectionTxt}>{children}</Text>
    </View>
  );
});

function useReveal(ready: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(anim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [ready]);
  return anim;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [reel, setReel] = useState<ReelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;
  const saveScale  = useRef(new Animated.Value(1)).current;
  const reveal     = useReveal(!loading && !error && !!reel);

  // ── Fetch ──
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(false);
    try {
      // API d'adaptation : fetchEpisodeById doit maintenant retourner un ReelData
      const r = await fetchEpisodeById(id) as any as ReelData;
      if (!r) throw new Error('not found');
      setReel(r);
      setLocalLikes(r.likes_count || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ──
  const handleLike = useCallback(async () => {
    if (!reel?.id) return;
  
    const next = !liked;
  
    // Optimistic UI
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
  
    try {
      if (next) {
        const { error } = await supabase
          .from('user_liked_reels')
          .upsert({ reel_id: reel.id }, { onConflict: 'user_id,reel_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_liked_reels')
          .delete()
          .eq('reel_id', reel.id);
        if (error) throw error;
      }
  
      // compteur global éventuel
      updateEpisodeLikes(reel.id, next ? 1 : -1).catch(console.warn);
    } catch (e) {
      // rollback UI en cas d'erreur
      setLiked(!next);
      setLocalLikes(prev => prev + (next ? -1 : 1));
      console.warn('handleLike DB error:', e);
    }
  
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [liked, reel?.id, heartScale]);

  const handleSave = useCallback(() => {
    setSaved(v => !v);
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(saveScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, [saveScale]);

  const handleShare = useCallback(async () => {
    if (!reel) return;
    try {
      await Share.share({
        message: `Découvrez "${reel.title || 'cette création'}" sur Universe App !`,
        title: reel.title || 'Vidéo',
      });
    } catch (e) { console.warn('[share]', e); }
  }, [reel]);

  // ── Calculs dérivés ──
  const synopsisShort = useMemo(() => {
    if (!reel?.synopsis) return '';
    return reel.synopsis.length > 180 ? reel.synopsis.slice(0, 180).trimEnd() + '…' : reel.synopsis;
  }, [reel?.synopsis]);

  const bodyStyle = useMemo(() => ({
    opacity:   reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  }), [reveal]);

  // ── États vides ──
  if (loading) return (
    <View style={s.root}><StatusBar style="light" /><GalaxyBackground /><DetailSkeleton /></View>
  );

  if (error || !reel) return (
    <View style={[s.root, s.center]}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <View style={s.errorIcon}><Ionicons name="film-outline" size={32} color={C.textTert} /></View>
      <Text style={s.errorTitle}>Vidéo introuvable</Text>
      <Text style={s.errorSub}>Ce reel n'existe pas ou a été retiré.</Text>
      <TouchableOpacity style={s.errorBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={15} color={C.white} />
        <Text style={s.errorBtnTxt}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  // Fallback miniature
  const coverImage = reel.thumbnail_url || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1459&auto=format&fit=crop';

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} scrollEventThrottle={16}>
        
        {/* HERO */}
        <View style={s.heroWrap}>
          <Image source={{ uri: coverImage }} style={s.heroImg} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(2,8,16,0.45)', C.bg]} locations={[0.35, 0.72, 1]} style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(2,8,16,0.55)', 'transparent']} locations={[0, 0.30]} style={StyleSheet.absoluteFillObject} />

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <BlurView intensity={28} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={21} color={C.white} />
            </BlurView>
          </TouchableOpacity>

          <View style={s.topRight}>
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <TouchableOpacity onPress={handleSave} hitSlop={8}>
                <BlurView intensity={28} tint="dark" style={s.blurCircle}>
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? C.gold : C.white} />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity onPress={handleShare} hitSlop={8}>
              <BlurView intensity={28} tint="dark" style={s.blurCircle}>
                <Ionicons name="share-outline" size={18} color={C.white} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* CORPS */}
        <Animated.View style={[s.body, bodyStyle]}>
          
          <View style={s.titleBlock}>
            <Text style={s.epTitle} numberOfLines={3}>{reel.title || 'Vidéo sans titre'}</Text>
            {reel.director && (
              <Text style={s.directorInline}>
                <Text style={{ color: C.textTert }}>Réalisé par </Text>{reel.director}
              </Text>
            )}
          </View>

          {/* STATS */}
          <View style={s.statsRow}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.80}>
              <View style={[s.statPill, liked && { borderColor: 'rgba(255,59,92,0.35)', backgroundColor: 'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? C.red : C.textSec} />
                </Animated.View>
                <View>
                  <Text style={[s.statVal, liked && { color: C.red }]}>{fmtLikes(localLikes)}</Text>
                  <Text style={s.statLbl}>J'aime</Text>
                </View>
              </View>
            </TouchableOpacity>
            <StatPill icon="play-circle-outline" value={fmtLikes(reel.views_count || 0)} label="Vues" />
            <StatPill icon="time-outline" value={`${reel.duration || '—'} min`} label="Durée" />
            <StatPill icon="calendar-outline" value={reel.year || '—'} label="Année" />
          </View>

          {/* PLAY BOUTON */}
          <TouchableOpacity style={s.playBtn} activeOpacity={0.88}>
            <LinearGradient colors={[C.navyBright, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playGrad}>
              <View style={s.playIconWrap}><Ionicons name="play" size={18} color={C.white} /></View>
              <View>
                <Text style={s.playTxt}>Lancer la vidéo</Text>
                <Text style={s.playMeta}>{reel.video_url ? 'Prêt à visionner' : 'Lien indisponible'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* GENRE TAG */}
          {reel.genre && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
              <View style={s.tag}><Text style={s.tagTxt}>{reel.genre}</Text></View>
            </ScrollView>
          )}

          {/* SYNOPSIS */}
          {reel.synopsis && (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.caption}>{expanded ? reel.synopsis : synopsisShort}</Text>
              {(reel.synopsis.length > 180) && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={s.expandBtn}>
                  <Text style={s.expandTxt}>{expanded ? 'Réduire' : 'Lire la suite'}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={C.blue} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* DIRECTOR CARD */}
          {reel.director && (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <View style={s.directorCard}>
                <Image source={{ uri: `https://i.pravatar.cc/120?u=${encodeURIComponent(reel.director)}` }} style={s.directorAv} />
                <View style={s.directorInfo}>
                  <Text style={s.directorName}>{reel.director}</Text>
                  <Text style={s.directorSub}>Créateur</Text>
                </View>
              </View>
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
  root:         { flex: 1, backgroundColor: C.bg },
  center:       { justifyContent: 'center', alignItems: 'center' },
  scroll:       { paddingBottom: 110 },

  heroWrap:     { height: H * 0.44, position: 'relative' },
  heroImg:      { width: '100%', height: '100%' },
  backBtn:      { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, left: 16 },
  blurCircle:   { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  topRight:     { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 22, right: 16, gap: 10, alignItems: 'flex-end' },

  body:         { paddingHorizontal: 20, paddingTop: 24 },
  titleBlock:   { marginBottom: 24 },
  epTitle:      { color: C.white, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, marginBottom: 7 },
  directorInline: { color: C.textSec, fontSize: 13, fontWeight: '600' },

  statsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statPill:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  statVal:      { color: C.text, fontSize: 13, fontWeight: '700' },
  statLbl:      { color: C.textTert, fontSize: 10, fontWeight: '600', marginTop: 1 },

  playBtn:      { borderRadius: 16, overflow: 'hidden', marginBottom: 22, borderWidth: 1, borderColor: C.borderBlue },
  playGrad:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 },
  playIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  playTxt:      { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  playMeta:     { color: C.textTert, fontSize: 11, marginTop: 2 },

  tag:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  tagTxt:       { color: C.textSec, fontSize: 12, fontWeight: '600' },

  section:      { marginBottom: 28 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionDot:   { width: 3, height: 18, borderRadius: 2, backgroundColor: C.blue },
  sectionTxt:   { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  caption:      { color: C.textSec, fontSize: 14, lineHeight: 23 },
  expandBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandTxt:    { color: C.blue, fontSize: 13, fontWeight: '700' },

  directorCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 16 },
  directorAv:   { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.navyLight },
  directorInfo: { flex: 1 },
  directorName: { color: C.text, fontSize: 15, fontWeight: '700' },
  directorSub:  { color: C.textSec, fontSize: 12, marginTop: 1 },

  errorIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  errorTitle:   { color: C.textSec, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorSub:     { color: C.textTert, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  errorBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderHi },
  errorBtnTxt:  { color: C.white, fontWeight: '700', fontSize: 14 },
});