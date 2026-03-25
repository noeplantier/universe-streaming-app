// ═══════════════════════════════════════════════════════════════════
//  social.tsx — UNIVERSE  /  Communauté & Débats
//  ─────────────────────────────────────────────────────────────────
//  Galaxy Animation Engine intégral.
//  Tabs filtrés, composition post, commentaires, share.
//  Performance : Animated FlatList + memo + useCallback.
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, Animated, Easing, Dimensions,
  FlatList, RefreshControl, Modal, Pressable, Platform,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { useRouter }       from 'expo-router';
import { StatusBar }       from 'expo-status-bar';

const { width: W, height: H } = Dimensions.get('window');
const EDGE      = 18;
const AVATAR_SZ = 44;

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE GALAXY
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  textSub: '#BCB8C2',
  red: '#FF453A',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎭 RÔLES
// ─────────────────────────────────────────────────────────────────────────────
const ROLES: Record<string, { label: string; color: string; bg: string }> = {
  director: { label: 'PROD',     color: '#FFD60A', bg: 'rgba(255,214,10,0.15)' },
  critic:   { label: 'CRITIQUE', color: '#86EEFF', bg: 'rgba(134,238,255,0.15)' },
  dop:      { label: 'IMAGE',    color: '#CF98FF', bg: 'rgba(207,152,255,0.15)' },
  viewer:   { label: '',         color: 'transparent', bg: 'transparent' },
};

// ─────────────────────────────────────────────────────────────────────────────
// 🍿 DONNÉES MOCK
// ─────────────────────────────────────────────────────────────────────────────
export interface PostData {
  id: string;
  user: { name: string; handle: string; avi: string; role: string };
  content: string;
  time: string;
  likes: number;
  comments: number;
  film?: { title: string; poster: string; year: string; filmId?: string };
  tab?: 'foryou' | 'subs' | 'trending';
}

const ALL_POSTS: PostData[] = [
  {
    id: '1', tab: 'foryou',
    user: { name: 'Nolan R.', handle: 'cinenolan', avi: 'https://i.pravatar.cc/150?u=a042581f4e29026024d', role: 'director' },
    content: 'La photographie dans "The Lighthouse" est une masterclass de contraste. Le ratio 1.19:1 enferme littéralement les personnages dans leur folie. Des avis ? 🎥',
    time: '2h', likes: 1240, comments: 85,
    film: { title: 'The Lighthouse', poster: 'https://image.tmdb.org/t/p/w200/3nk9UoepYmv1G9oP18q6JJCeYMB.jpg', year: '2019', filmId: 'lighthouse' },
  },
  {
    id: '2', tab: 'subs',
    user: { name: 'Sarah K.', handle: 'sarah_cuts', avi: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', role: 'critic' },
    content: 'Je reviens de Cannes. Le cinéma coréen est encore en train de redéfinir les codes du thriller. Incroyable énergie cette année.',
    time: '4h', likes: 856, comments: 42,
  },
  {
    id: '3', tab: 'trending',
    user: { name: 'Marc D.', handle: 'marcdop', avi: 'https://i.pravatar.cc/150?u=a04258114e29026302d', role: 'dop' },
    content: 'Petit thread sur l\'utilisation des lentilles anamorphiques chez Wes Anderson. Chaque film est une étude de symétrie et de couleur 👇',
    time: '5h', likes: 2100, comments: 120,
    film: { title: 'Asteroid City', poster: 'https://image.tmdb.org/t/p/w200/qfgysK1I5s2m86e1hQY6k3qK5q8.jpg', year: '2023', filmId: 'asteroid-city' },
  },
  {
    id: '4', tab: 'foryou',
    user: { name: 'Julie M.', handle: 'julie_viewer', avi: 'https://i.pravatar.cc/150?u=a042581f4e29026502d', role: 'viewer' },
    content: 'Quelqu\'un a vu le dernier film de Céline Sciamma ? J\'ai adoré la narration visuelle, c\'est du grand art.',
    time: '6h', likes: 430, comments: 18,
    film: { title: 'Petite Maman', poster: 'https://picsum.photos/seed/pm/200/300', year: '2021', filmId: 'petite-maman' },
  },
  {
    id: '5', tab: 'trending',
    user: { name: 'Alex P.', handle: 'alexcinephile', avi: 'https://i.pravatar.cc/150?u=a042581f4e29026102d', role: 'viewer' },
    content: 'Thread : les meilleurs films de science-fiction des 20 dernières années. Prêts ? 🚀\n\n1/ Hereditary (2018) — terreur domestique totale\n2/ Annihilation (2018) — le chaos au microscope',
    time: '8h', likes: 980, comments: 60,
    film: { title: 'Ex Machina', poster: 'https://picsum.photos/seed/ex/200/300', year: '2014', filmId: 'ex-machina' },
  },
  {
    id: '6', tab: 'subs',
    user: { name: 'Emma L.', handle: 'emma_cinephile', avi: 'https://i.pravatar.cc/150?u=a042581f4e29026602d', role: 'viewer' },
    content: 'Je viens de découvrir "The Farewell" de Lulu Wang. Un mélange parfait d\'humour et d\'émotion. À voir absolument !',
    time: '10h', likes: 670, comments: 30,
    film: { title: 'The Farewell', poster: 'https://picsum.photos/seed/tf/200/300', year: '2019', filmId: 'the-farewell' },
  },
  {
    id: '7', tab: 'trending',
    user: { name: 'Karim B.', handle: 'karim_dop', avi: 'https://i.pravatar.cc/150?u=kb77', role: 'dop' },
    content: 'Palette de couleurs dans "Parasite" : Bong Joon-ho utilise le vert mousse pour symboliser le sous-sol et ses habitants. Génie chromatique absolu. 🎨',
    time: '12h', likes: 3400, comments: 210,
  },
  {
    id: '8', tab: 'subs',
    user: { name: 'Léa D.', handle: 'lea_films', avi: 'https://i.pravatar.cc/150?u=ld88', role: 'critic' },
    content: 'Cannes 2025 — ma liste des films les plus attendus de la compétition officielle. Le cinéma africain est enfin représenté dignement cette année.',
    time: '14h', likes: 1820, comments: 95,
  },
  {
    id: '9', tab: 'foryou',
    user: { name: 'Tom V.', handle: 'tomv_indie', avi: 'https://i.pravatar.cc/150?u=tv99', role: 'director' },
    content: 'Vient de terminer le montage de mon court. 6 mois de post-production pour 18 minutes. Le cinéma indé c\'est ça aussi 💪',
    time: '1j', likes: 512, comments: 44,
  },
];

const TAB_MAP: Record<string, (p: PostData) => boolean> = {
  'Pour vous':   () => true,
  'Abonnements': (p) => p.tab === 'subs',
  'Tendances':   (p) => p.tab === 'trending',
};

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY ANIMATION ENGINE (Portage Intégral)  ░░░
// ═══════════════════════════════════════════════════════════════════

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface Met { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: Pt[] = Array.from({ length: 50 }, (_, i) => ({
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
    const interval = setInterval(() => {
      if (Math.random() > 0.7)
        setMeteors(m => [...m, {
          id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.4),
          ang: rnd(20, 50), len: rnd(80, 150),
        }]);
    }, 2000);
    return () => clearInterval(interval);
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
//  ░░░  COMPOSANTS UI  ░░░
// ═══════════════════════════════════════════════════════════════════

// ─── Header ───────────────────────────────────────────────────────
const SocialHeader = memo(() => {
  const router = useRouter();
  return (
    <View style={hdr.row}>
      <View>
        <Text style={hdr.title}>Communauté</Text>
        <Text style={hdr.sub}>Le QG du cinéma indé</Text>
      </View>
      <View style={hdr.actions}>
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={20} color="white" />
          <View style={hdr.dot} />
        </TouchableOpacity>
        <TouchableOpacity style={hdr.btn} onPress={() => router.push('/new-post')}>
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
});
SocialHeader.displayName = 'SocialHeader';

const hdr = StyleSheet.create({
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 10, paddingBottom: 16 },
  title:   { fontSize: 28, fontWeight: '800', color: G.sW, letterSpacing: -0.5 },
  sub:     { fontSize: 12, color: G.sB, opacity: 0.6, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  btn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  dot:     { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: G.bg1 },
});

// ─── Barre de composition ─────────────────────────────────────────
const ComposeBar = memo(({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={cb.wrap} onPress={onPress} activeOpacity={0.8}>
    <Image source={{ uri: 'https://i.pravatar.cc/100?u=hugoch' }} style={cb.avi} />
    <View style={cb.box}>
      <Text style={cb.ph}>Partagez votre analyse…</Text>
      <Ionicons name="camera-outline" size={18} color="rgba(237,232,255,0.3)" />
    </View>
  </TouchableOpacity>
));
ComposeBar.displayName = 'ComposeBar';

const cb = StyleSheet.create({
  wrap: { flexDirection: 'row', paddingHorizontal: EDGE, gap: 12, marginBottom: 8, alignItems: 'center' },
  avi:  { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  box:  { flex: 1, height: 44, borderRadius: 22, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between' },
  ph:   { color: 'rgba(237,232,255,0.4)', fontSize: 14 },
});

// ─── Tabs filtres ─────────────────────────────────────────────────
const TABS = ['Pour vous', 'Abonnements', 'Tendances'];

const FilterTabs = memo(({ active, set }: { active: string; set: (a: string) => void }) => (
  <View style={ft.row}>
    {TABS.map(t => {
      const on = active === t;
      return (
        <TouchableOpacity key={t} onPress={() => set(t)} style={ft.pill}>
          <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
          {on && <View style={ft.line} />}
        </TouchableOpacity>
      );
    })}
  </View>
));
FilterTabs.displayName = 'FilterTabs';

const ft = StyleSheet.create({
  row:   { flexDirection: 'row', paddingHorizontal: EDGE, gap: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  pill:  { paddingBottom: 14, alignItems: 'center', position: 'relative' },
  txt:   { color: 'rgba(237,232,255,0.5)', fontSize: 15, fontWeight: '600' },
  txtOn: { color: G.sW, fontWeight: '700' },
  line:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: G.primary, borderRadius: 2 },
});

// ─── Modal Commentaires ───────────────────────────────────────────
const FAKE_COMMENTS = [
  { id: 'c1', user: 'lucie_mv',  text: 'Totalement d\'accord, un chef d\'œuvre !', avi: 'https://i.pravatar.cc/60?img=9' },
  { id: 'c2', user: 'marc.film', text: 'Le ratio 1.19:1 c\'est le grand Robert Eggers en mode maîtrise totale.', avi: 'https://i.pravatar.cc/60?img=12' },
  { id: 'c3', user: 'anaelle_c', text: 'Je préfère quand même "The Witch" pour l\'ambiance.', avi: 'https://i.pravatar.cc/60?img=22' },
];

const CommentsModal = memo(({ visible, onClose, postId }: { visible: boolean; onClose: () => void; postId: string }) => {
  const [text, setText] = useState('');
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cm.backdrop} onPress={onClose} />
      <View style={cm.sheet}>
        <View style={cm.handle} />
        <Text style={cm.title}>Commentaires</Text>
        {FAKE_COMMENTS.map(c => (
          <View key={c.id} style={cm.row}>
            <Image source={{ uri: c.avi }} style={cm.avi} />
            <View style={cm.bubble}>
              <Text style={cm.name}>{c.user}</Text>
              <Text style={cm.ctxt}>{c.text}</Text>
            </View>
          </View>
        ))}
        {/* Input */}
        <View style={cm.inputRow}>
          <Image source={{ uri: 'https://i.pravatar.cc/100?u=hugoch' }} style={cm.avi} />
          <View style={cm.inputBox}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Votre réponse…"
              placeholderTextColor="rgba(237,232,255,0.3)"
              style={cm.input}
            />
            {text.length > 0 && (
              <TouchableOpacity onPress={() => setText('')}>
                <Ionicons name="send" size={18} color={G.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
});
CommentsModal.displayName = 'CommentsModal';

const cm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: H * 0.65, backgroundColor: '#12002A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  title:    { color: 'white', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  row:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  avi:      { width: 36, height: 36, borderRadius: 18 },
  bubble:   { flex: 1, backgroundColor: G.glass, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: G.glassBorder },
  name:     { color: G.sW, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  ctxt:     { color: 'rgba(237,232,255,0.8)', fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: G.glass, borderRadius: 22, paddingHorizontal: 14, height: 42, borderWidth: 1, borderColor: G.glassBorder },
  input:    { flex: 1, color: 'white', fontSize: 14 },
});

// ─── Carte de Post ────────────────────────────────────────────────
const PostCard = memo(({ post }: { post: PostData }) => {
  const router = useRouter();
  const [liked,       setLiked]       = useState(false);
  const [showComments, setShowComments] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const toggleLike = useCallback(() => {
    setLiked(l => !l);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }),
    ]).start();
  }, [scale]);

  const role = ROLES[post.user.role] ?? ROLES.viewer;

  return (
    <View style={pc.root}>
      <CommentsModal visible={showComments} onClose={() => setShowComments(false)} postId={post.id} />

      {/* Header utilisateur */}
      <View style={pc.head}>
        <TouchableOpacity onPress={() => router.push(`/user/${post.user.handle}`)}>
          <Image source={{ uri: post.user.avi }} style={pc.avi} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={pc.name}>{post.user.name}</Text>
            {role.label !== '' && (
              <View style={[pc.badge, { backgroundColor: role.bg }]}>
                <Text style={[pc.badgeTxt, { color: role.color }]}>{role.label}</Text>
              </View>
            )}
            <Text style={pc.handle}>@{post.user.handle} · {post.time}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>

      {/* Contenu textuel */}
      <Text style={pc.content}>{post.content}</Text>

      {/* Film embed */}
      {post.film && (
        <TouchableOpacity
          style={pc.filmEmbed}
          activeOpacity={0.9}
          onPress={() => router.push(`/film/${post.film!.filmId ?? '1'}`)}
        >
          <Image source={{ uri: post.film.poster }} style={pc.filmPoster} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFillObject} />
          <View style={pc.filmInfo}>
            <Text style={pc.filmTitle}>{post.film.title}</Text>
            <Text style={pc.filmMeta}>Film · {post.film.year}</Text>
            <View style={pc.watchBtn}>
              <Ionicons name="play" size={10} color="#000" />
              <Text style={pc.watchTxt}>Voir</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={pc.actions}>
        <TouchableOpacity style={pc.actBtn} onPress={toggleLike}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? G.red : 'rgba(237,232,255,0.5)'} />
          </Animated.View>
          <Text style={[pc.actTxt, liked && { color: G.red }]}>{post.likes + (liked ? 1 : 0)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pc.actBtn} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-outline" size={19} color="rgba(237,232,255,0.5)" />
          <Text style={pc.actTxt}>{post.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pc.actBtn}>
          <Ionicons name="share-social-outline" size={19} color="rgba(237,232,255,0.5)" />
        </TouchableOpacity>

        <TouchableOpacity style={pc.actBtn}>
          <Ionicons name="bookmark-outline" size={19} color="rgba(237,232,255,0.5)" />
        </TouchableOpacity>
      </View>
    </View>
  );
});
PostCard.displayName = 'PostCard';

const pc = StyleSheet.create({
  root:       { padding: EDGE, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  head:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  avi:        { width: AVATAR_SZ, height: AVATAR_SZ, borderRadius: AVATAR_SZ / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  name:       { color: G.sW, fontWeight: '700', fontSize: 15 },
  handle:     { color: 'rgba(237,232,255,0.4)', fontSize: 12 },
  badge:      { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  badgeTxt:   { fontSize: 9, fontWeight: '800' },
  content:    { color: 'rgba(237,232,255,0.9)', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  filmEmbed:  { flexDirection: 'row', height: 88, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  filmPoster: { width: 60, height: '100%', resizeMode: 'cover' },
  filmInfo:   { flex: 1, padding: 12, justifyContent: 'center' },
  filmTitle:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  filmMeta:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2, marginBottom: 8 },
  watchBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: G.sG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start', gap: 3 },
  watchTxt:   { fontSize: 10, fontWeight: '700', color: '#000' },
  actions:    { flexDirection: 'row', gap: 24, marginTop: 4 },
  actBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actTxt:     { color: 'rgba(237,232,255,0.5)', fontSize: 13 },
});

// ─── Séparateur vide ──────────────────────────────────────────────
const EmptyFeed = memo(() => (
  <View style={{ alignItems: 'center', paddingVertical: 60 }}>
    <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.1)" />
    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, marginTop: 14 }}>Aucun post dans cet onglet</Text>
  </View>
));
EmptyFeed.displayName = 'EmptyFeed';

// ═══════════════════════════════════════════════════════════════════
//  ░░░  ÉCRAN PRINCIPAL  ░══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

export default function SocialScreen() {
  const [tab,        setTab]        = useState('Pour vous');
  const [refreshing, setRefreshing] = useState(false);
  const [posts,      setPosts]      = useState<PostData[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Chargement simulé ─────────────────────────────────────────
  const loadPosts = useCallback(() => {
    setTimeout(() => {
      setPosts(ALL_POSTS);
      setRefreshing(false);
    }, 600);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadPosts(); }, [loadPosts]);

  // ── Filtrage par tab ───────────────────────────────────────────
  const filtered = posts.filter(TAB_MAP[tab] ?? (() => true));

  // ── Composant header de liste ─────────────────────────────────
  const ListHeader = useCallback(() => (
    <>
      <ComposeBar onPress={() => setComposeOpen(true)} />
      <FilterTabs active={tab} set={setTab} />
    </>
  ), [tab]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <SocialHeader />

        <Animated.FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={refreshing ? null : <EmptyFeed />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={G.primary}
            />
          }
          removeClippedSubviews
          windowSize={8}
          maxToRenderPerBatch={4}
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg0 },
});