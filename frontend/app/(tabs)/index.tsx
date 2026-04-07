// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/reels/index.tsx  —  Page Réels Cinéma Indépendant
//
// Affiche les micro-formats (≤ 15s) uploadés via create.tsx
// Scroll vertical plein écran, style Reels / TikTok
// Données depuis Supabase table "reels"
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useRef, useCallback, useEffect, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, Image, ActivityIndicator,
  Share, Platform, RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import GalaxyBackground from '@/components/social/GalaxyBackground';
import { supabase }     from '@/lib/supabase';

const { width: W, height: H } = Dimensions.get('window');

const viewabilityConfig = {
  itemVisiblePercentThreshold: 50,
};

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg0:       '#07000F',
  surf:      'rgba(255,255,255,0.055)',
  surfHi:    'rgba(255,255,255,0.09)',
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(255,255,255,0.18)',
  borderAcc: 'rgba(155,109,202,0.35)',
  text:      '#F3EDFF',
  textSec:   '#9B94AA',
  textTert:  '#584F66',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.14)',
  violet:    '#9B6DCA',
  violetSoft:'rgba(155,109,202,0.12)',
  violetMid: 'rgba(155,109,202,0.25)',
  green:     '#30D158',
  red:       '#FF3B5C',
  teal:      '#5AC8FA',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Reel {
  id:          string;
  user_id:     string;
  video_url:   string;
  title:       string;
  genre:       string;
  director:    string;
  year:        string;
  synopsis:    string;
  duration:    number;
  likes_count: number;
  views_count: number;
  created_at:  string;
  // champs joints éventuels
  author_name?:  string;
  author_avatar?:string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA  (utilisé si Supabase vide ou en développement)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_REELS: Reel[] = Array.from({ length: 8 }, (_, i) => ({
  id:          `mock-${i}`,
  user_id:     'mock-user',
  video_url:   '',
  title:       ['Les Silences du Lac', 'Éclats de Lumière', 'La Dernière Marée', 'Novembre Intérieur', 'Corps et Ombre', 'Territoire', 'L\'Éveil', 'Solstice'][i] ?? `Film ${i + 1}`,
  genre:       ['Drame', 'Expérimental', 'Documentaire', 'Thriller', 'Court métrage', 'Biopic', 'Animation', 'Sci-Fi'][i] ?? 'Drame',
  director:    ['Clara Morin', 'Théo Berger', 'Amina Diallo', 'Paul Lebreton', 'Soo-Jin Park', 'Marco Vitale', 'Léa Fontaine', 'Sam Dupont'][i] ?? 'Réalisateur',
  year:        String(2023 + (i % 2)),
  synopsis:    'Un film d\'une profondeur rare, où chaque plan raconte plus qu\'il ne montre.',
  duration:    Math.floor(8 + Math.random() * 7),
  likes_count: Math.floor(120 + Math.random() * 3000),
  views_count: Math.floor(500 + Math.random() * 12000),
  created_at:  new Date(Date.now() - i * 86400000).toISOString(),
  author_name:  ['Clara M.', 'Théo B.', 'Amina D.', 'Paul L.', 'Soo-Jin P.', 'Marco V.', 'Léa F.', 'Sam D.'][i],
  author_avatar:`https://i.pravatar.cc/100?u=reel${i}`,
}));

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE FETCH
// ─────────────────────────────────────────────────────────────────────────────
async function fetchReels(): Promise<Reel[]> {
  try {
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error || !data || data.length === 0) return MOCK_REELS;
    return data as Reel[];
  } catch {
    return MOCK_REELS;
  }
}

async function dbToggleReelLike(reelId: string, userId: string, wasLiked: boolean) {
  if (wasLiked) {
    await supabase.from('reel_likes').delete().match({ reel_id: reelId, user_id: userId });
  } else {
    await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: userId });
  }
}

async function dbIncrementViews(reelId: string) {
  await supabase.rpc('increment_reel_views', { reel_id: reelId });
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL CARD  (plein écran, style Stories/Reels)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_USER_ID = 'mock-user-id';

const ReelCard = memo(function ReelCard({
  reel, isVisible, onLike, liked,
}: {
  reel:      Reel;
  isVisible: boolean;
  onLike:    (id: string) => void;
  liked:     boolean;
}) {
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const likeScale  = useRef(new Animated.Value(1)).current;
  const fadeIn     = useRef(new Animated.Value(0)).current;

  // Fade in à l'apparition
  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      fadeIn.setValue(0);
    }
  }, [isVisible]);

  const handleLike = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(likeScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onLike(reel.id);
  }, [reel.id, onLike]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Découvrez "${reel.title}" de ${reel.director} sur notre app — ${reel.genre} #CinémaIndépendant`,
      });
    } catch (e) { console.error(e); }
  }, [reel]);

  const likeCount  = String(reel.likes_count + (liked ? 1 : 0));
  const viewCount  = reel.views_count > 999
    ? `${(reel.views_count / 1000).toFixed(1)}k`
    : String(reel.views_count);
  const durationFmt = `${reel.duration}s`;
  const authorName  = reel.author_name ?? 'Anonyme';
  const avatarSrc   = { uri: reel.author_avatar ?? `https://i.pravatar.cc/100?u=${reel.id}` };

  // Image de fond (thumbnail fakée depuis picsum)
  const thumbSrc = reel.video_url
    ? { uri: reel.video_url }
    : { uri: `https://picsum.photos/seed/${reel.id}/600/900` };

  return (
    <View style={rc.root}>

      {/* ── FOND : thumbnail / vidéo ── */}
      <Image source={thumbSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Dégradés */}
      <LinearGradient
        colors={['rgba(7,0,15,0.7)', 'transparent', 'transparent', 'rgba(7,0,15,0.95)']}
        locations={[0, 0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Overlay de lecture (icône play central) */}
      {!reel.video_url && (
        <View style={rc.playOverlay}>
          <View style={rc.playCircle}>
            <Ionicons name="play" size={32} color="white" />
          </View>
          <Text style={rc.playLabel}>Micro-format · {durationFmt}</Text>
        </View>
      )}

      {/* ── CONTENU GAUCHE (titre, info) ── */}
      <Animated.View style={[rc.infoWrap, { opacity: fadeIn, paddingBottom: insets.bottom + 80 }]}>

        {/* Auteur */}
        <TouchableOpacity style={rc.author} activeOpacity={0.85}>
          <Image source={avatarSrc} style={rc.avatar} />
          <View>
            <Text style={rc.authorName}>{authorName}</Text>
            <Text style={rc.authorSub}>Cinéaste indépendant</Text>
          </View>
        </TouchableOpacity>

        {/* Tags */}
        <View style={rc.tagRow}>
          <View style={rc.genreTag}>
            <Text style={rc.genreTagTxt}>{reel.genre}</Text>
          </View>
          <View style={rc.durTag}>
            <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.7)" />
            <Text style={rc.durTagTxt}>{durationFmt}</Text>
          </View>
          <View style={rc.hashTag}>
            <Text style={rc.hashTagTxt}>#CinémaIndépendant</Text>
          </View>
        </View>

        {/* Titre + director */}
        <Text style={rc.title}>{reel.title}</Text>
        <Text style={rc.director}>
          {reel.director}{reel.year ? ` · ${reel.year}` : ''}
        </Text>
        {reel.synopsis.length > 0 && (
          <Text style={rc.synopsis} numberOfLines={2}>{reel.synopsis}</Text>
        )}

        {/* Bouton "Voir le film" */}
        <TouchableOpacity
          style={rc.filmBtn}
          onPress={() => router.push(`/film/${reel.id}`)}
          activeOpacity={0.85}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="film-outline" size={14} color="white" />
          <Text style={rc.filmBtnTxt}>Voir le film</Text>
          <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── ACTIONS DROITE ── */}
      <Animated.View style={[rc.actions, { opacity: fadeIn, paddingBottom: insets.bottom + 80 }]}>

        {/* Like */}
        <View style={rc.actionItem}>
          <TouchableOpacity style={rc.actionBtn} onPress={handleLike} activeOpacity={0.75}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? C.red : 'white'} />
            </Animated.View>
          </TouchableOpacity>
          <Text style={rc.actionLabel}>{likeCount}</Text>
        </View>

        {/* Vues */}
        <View style={rc.actionItem}>
          <View style={rc.actionBtn}>
            <Ionicons name="eye-outline" size={26} color="white" />
          </View>
          <Text style={rc.actionLabel}>{viewCount}</Text>
        </View>

        {/* Share */}
        <View style={rc.actionItem}>
          <TouchableOpacity style={rc.actionBtn} onPress={handleShare} activeOpacity={0.75}>
            <Ionicons name="share-outline" size={26} color="white" />
          </TouchableOpacity>
          <Text style={rc.actionLabel}>Partager</Text>
        </View>

        {/* Info */}
        <View style={rc.actionItem}>
          <TouchableOpacity style={rc.actionBtn} onPress={() => router.push(`/film/${reel.id}`)} activeOpacity={0.75}>
            <Ionicons name="information-circle-outline" size={26} color="white" />
          </TouchableOpacity>
          <Text style={rc.actionLabel}>Infos</Text>
        </View>

      </Animated.View>

    </View>
  );
});

const rc = StyleSheet.create({
  root:        { width: W, height: H, backgroundColor: C.bg0 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle:  { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  playLabel:   { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 },

  infoWrap:    { position: 'absolute', bottom: 0, left: 0, right: 80, padding: 20, gap: 8 },
  author:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  avatar:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  authorName:  { color: 'white', fontSize: 14, fontWeight: '700' },
  authorSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 10 },

  tagRow:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  genreTag:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: C.violetMid, borderWidth: 1, borderColor: C.borderAcc },
  genreTagTxt: { color: '#D4B8F5', fontSize: 10, fontWeight: '700' },
  durTag:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  durTagTxt:   { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' },
  hashTag:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(90,200,250,0.12)' },
  hashTagTxt:  { color: C.teal, fontSize: 10, fontWeight: '600' },

  title:       { color: 'white', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 26 },
  director:    { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  synopsis:    { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 17, fontStyle: 'italic' },

  filmBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 9, marginTop: 4 },
  filmBtnTxt:  { color: 'white', fontSize: 13, fontWeight: '700' },

  actions:     { position: 'absolute', bottom: 0, right: 0, width: 72, alignItems: 'center', gap: 4, padding: 12 },
  actionItem:  { alignItems: 'center', gap: 4, marginBottom: 8 },
  actionBtn:   { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HEADER OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const ReelsHeader = memo(function ReelsHeader({ onUpload }: { onUpload: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[rh.wrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={rh.inner}>
        <Text style={rh.title}>Réels</Text>
        <Text style={rh.sub}>#CinémaIndépendant</Text>
      </View>
      <View style={rh.actions}>
        <TouchableOpacity style={rh.btn} onPress={onUpload}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const rh = StyleSheet.create({
  wrap:   { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  inner:  {},
  title:  { color: 'white', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  sub:    { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
  actions:{ flexDirection: 'row', gap: 10 },
  btn:    { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTRE GENRES  (barre horizontale en haut)
// ─────────────────────────────────────────────────────────────────────────────
const ALL_GENRES = ['Tous', 'Drame', 'Thriller', 'Documentaire', 'Expérimental', 'Animation', 'Court métrage', 'Biopic', 'Sci-Fi'];

const GenreFilter = memo(function GenreFilter({
  active, onChange,
}: { active: string; onChange: (g: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[gf.wrap, { top: insets.top + 68 }]} pointerEvents="box-none">
      <View pointerEvents="auto">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={gf.row}>
          {ALL_GENRES.map(g => {
            const on = active === g;
            return (
              <TouchableOpacity key={g} style={[gf.pill, on && gf.pillOn]} onPress={() => onChange(g)}>
                {on && <View style={gf.pillBg} />}
                <Text style={[gf.pillTxt, on && gf.pillTxtOn]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});



const gf = StyleSheet.create({
  wrap:      { position: 'absolute', left: 0, right: 0, zIndex: 9 },
  row:       { paddingHorizontal: 16, gap: 8 },
  pill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(7,0,15,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  pillOn:    { borderColor: 'rgba(155,109,202,0.5)' },
  pillBg:    { ...StyleSheet.absoluteFillObject, backgroundColor: C.violetMid },
  pillTxt:   { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  pillTxtOn: { color: '#D4B8F5', fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyReels = memo(function EmptyReels({ onUpload }: { onUpload: () => void }) {
  return (
    <View style={es.wrap}>
      <GalaxyBackground />
      <View style={es.content}>
        <View style={es.iconWrap}>
          <LinearGradient colors={[C.violet, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={es.iconBg}>
            <Ionicons name="film-outline" size={34} color="white" />
          </LinearGradient>
        </View>
        <Text style={es.title}>Aucun Réel pour l'instant</Text>
        <Text style={es.sub}>Soyez le premier à partager un micro-format de cinéma indépendant.</Text>
        <TouchableOpacity style={es.btn} onPress={onUpload} activeOpacity={0.85}>
          <LinearGradient colors={[C.violet, '#7B6DB0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={es.btnGrad}>
            <Ionicons name="add" size={18} color="white" />
            <Text style={es.btnTxt}>Publier un Réel</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const es = StyleSheet.create({
  wrap:    { width: W, height: H, backgroundColor: C.bg0 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  iconWrap:{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', marginBottom: 8 },
  iconBg:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:   { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub:     { color: C.textTert, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn:     { borderRadius: 22, overflow: 'hidden', marginTop: 8 },
  btnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  btnTxt:  { color: 'white', fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ newReelId?: string }>();
  const [reels,      setReels]      = useState<Reel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [liked,      setLiked]      = useState<Record<string, boolean>>({});
  const [activeGenre,setActiveGenre]= useState('Tous');
  const flatListRef = useRef<FlatList>(null);

    // ── Memory Function ─────────────────────────────────────────────────────────────────

  const onViewableItemsChanged = useRef(({ viewableItems, changed }: any) => {
    // Votre logique ici
    console.log(viewableItems);
  }).current;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const data = await fetchReels();
    setReels(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Scroll vers le nouveau reel si venant de create.tsx
  useEffect(() => {
    if (params.newReelId && reels.length > 0) {
      const idx = reels.findIndex(r => r.id === params.newReelId);
      if (idx >= 0) {
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: idx, animated: true }), 400);
      }
    }
  }, [params.newReelId, reels]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Filtre genre ──────────────────────────────────────────────────────────
  const filteredReels = useMemo(() => {
    if (activeGenre === 'Tous') return reels;
    return reels.filter(r => r.genre === activeGenre);
  }, [reels, activeGenre]);

  // ── Like optimiste ────────────────────────────────────────────────────────
  const toggleLike = useCallback(async (id: string) => {
    const was = !!liked[id];
    setLiked(p => ({ ...p, [id]: !was }));
    try { await dbToggleReelLike(id, MOCK_USER_ID, was); }
    catch { setLiked(p => ({ ...p, [id]: was })); }
  }, [liked]);

  // ── Détection reel visible ────────────────────────────────────────────────
  const onViewableChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems[0] != null) {
      const idx = viewableItems[0].index ?? 0;
      setActiveIdx(idx);
      // Incrémenter les vues
      const reel = filteredReels[idx];
      if (reel) dbIncrementViews(reel.id).catch(() => {});
    }
  }, [filteredReels]);

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: Reel; index: number }) => (
    <ReelCard
      reel={item}
      isVisible={index === activeIdx}
      onLike={toggleLike}
      liked={!!liked[item.id]}
    />
  ), [activeIdx, toggleLike, liked]);

  const keyExtractor = useCallback((item: Reel) => item.id, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: H, offset: H * index, index,
  }), []);

  const onUpload = useCallback(() => router.push('/create'), [router]);

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center' }}>
        <GalaxyBackground />
        <ActivityIndicator size="large" color={C.violet} />
        <Text style={{ color: C.textSec, marginTop: 16, fontSize: 14 }}>Chargement des Réels…</Text>
      </View>
    );
  }

  if (filteredReels.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <EmptyReels onUpload={onUpload} />
        <ReelsHeader onUpload={onUpload} />
        <GenreFilter active={activeGenre} onChange={setActiveGenre} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <StatusBar style="light" />

      {/* FlatList plein écran vertical snap */}
      <FlatList
        ref={flatListRef}
        data={filteredReels}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={H}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        removeClippedSubviews
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.violet} />
        }
      />

      {/* Overlays fixes */}
      <ReelsHeader onUpload={onUpload} />
      <GenreFilter active={activeGenre} onChange={setActiveGenre} />

      {/* Indicateur de position */}
      <View style={pi.wrap} pointerEvents="none">
        {filteredReels.slice(0, 8).map((_, i) => (
          <View key={i} style={[pi.dot, i === (activeIdx % Math.min(filteredReels.length, 8)) && pi.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const pi = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, top: '50%', gap: 4, transform: [{ translateY: -40 }], zIndex: 5 },
  dot:  { width: 3, height: 16, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotOn:{ height: 22, backgroundColor: 'rgba(255,255,255,0.8)' },
});