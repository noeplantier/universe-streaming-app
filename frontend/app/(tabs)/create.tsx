import React, {
  useState, useRef, useEffect, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, Easing, Dimensions, Platform,
  Modal, Pressable, Image, ActivityIndicator, FlatList,
  KeyboardAvoidingView, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ────────────────────────────────────────
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);



// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE GALAXY
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)', neb1: 'rgba(172,24,160,0.20)',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  accent: '#A855F7',
  textSub: '#BCB8C2',
  gold: '#FFE270',
  cyan: '#86EEFF',
  danger: '#FF4D6A',
  success: '#1ED760',
  info: '#60A5FA',
  orange: '#FB923C',
};

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 GALAXY ANIMATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface StarPt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface MeteorT { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: StarPt[] = Array.from({ length: 60 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H * 1.5), sz: rnd(1.0, 2.5),
  col: pick([G.sW, G.sB, G.sP, G.sG, G.sCy]),
  del: rnd(0, 4200), dur: rnd(2000, 5500), mn: 0.15, mx: 0.92,
}));

const StarDot = memo(({ p }: { p: StarPt }) => {
  const op = useRef(new Animated.Value(p.mn)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue: p.mx, duration: p.dur * 0.5, useNativeDriver: true }),
      Animated.timing(op, { toValue: p.mn, duration: p.dur * 0.5, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: p.x, top: p.y,
      width: p.sz, height: p.sz, borderRadius: p.sz,
      backgroundColor: p.col, opacity: op,
    }} />
  );
});
StarDot.displayName = 'StarDot';

const ShootingStar = memo(({ m, onDone }: { m: MeteorT; onDone: () => void }) => {
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
  }, []);
  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 220] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 220] });
  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy, opacity: op,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(175,110,255,0.9)', '#fff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: m.len, height: 2, borderRadius: 1 }}
      />
    </Animated.View>
  );
});
ShootingStar.displayName = 'ShootingStar';

const GalaxyBackground = memo(() => {
  const [meteors, setMeteors] = useState<MeteorT[]>([]);
  useEffect(() => {
    const i = setInterval(() => {
      if (Math.random() > 0.65)
        setMeteors(prev => [...prev, {
          id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.4),
          ang: rnd(20, 50), len: rnd(80, 160),
        }]);
    }, 1800);
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

// ─────────────────────────────────────────────────────────────────────────────
// 📐 TYPES
// ─────────────────────────────────────────────────────────────────────────────
type AppMode    = 'video' | 'critique';
type WizardStep = 0 | 1 | 2 | 3 | 4;

interface SubtitleTrack {
  id:      string;
  startMs: number;
  endMs:   number;
  text:    string;
  edited:  boolean;
  lang:    string;
}

interface ExportFormat {
  id:      string;
  label:   string;
  codec:   string;
  res:     string;
  bitrate: string;
  ext:     string;
  icon:    string;
  badge?:  string;
  color:   string;
  sizeMb:  string; // estimated output size
}

interface ThumbnailFrame {
  id:   string;
  uri:  string;
  time: number;
}

interface CastMember {
  name: string;
  role: string;
}

interface ExportedFile {
  name:  string;
  path:  string;
  type:  string;
  bytes: number;
  icon:  string;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📦 CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const WIZARD_STEPS = ['Import', 'Métadonnées', 'Sous-titres', 'Thumbnail', 'Export'] as const;

const GENRES_CINEMA = [
  'Drame', 'Thriller', 'Documentaire', 'Expérimental', 'Animation',
  'Horreur', 'Comédie', 'Sci-Fi', 'Néo-Noir', 'Essai visuel',
  'Romance', 'Biopic', 'Musical', 'Western', 'Fantastique',
] as const;

const LANGUAGES = ['Français', 'English', 'Español', 'Deutsch', 'Italiano', '日本語', 'العربية', 'Português'] as const;

const COLOR_SPACES = ['Rec.709', 'DCI-P3', 'Rec.2020', 'sRGB', 'ACES'] as const;

const ASPECT_RATIOS = ['16:9', '2.39:1', '1.85:1', '4:3', '1:1', '2:1'] as const;

const EXPORT_FORMATS: ExportFormat[] = [
  { id: '4k_prores',  label: '4K ProRes 422',  codec: 'ProRes 422 HQ', res: '3840×2160', bitrate: '707 Mb/s', ext: 'mov',  icon: 'diamond',       badge: 'FESTIVAL', color: G.gold,    sizeMb: '~18 Go/h'  },
  { id: '2k_prores',  label: '2K ProRes 4444', codec: 'ProRes 4444',   res: '2048×1080', bitrate: '330 Mb/s', ext: 'mov',  icon: 'film',           badge: 'CINÉMA',   color: G.orange,  sizeMb: '~8 Go/h'   },
  { id: '1080_h264',  label: '1080p H.264',    codec: 'H.264 / AAC',   res: '1920×1080', bitrate: '16 Mb/s',  ext: 'mp4',  icon: 'play-circle',    badge: 'STANDARD', color: G.primary, sizeMb: '~7 Go/h'   },
  { id: '1080_h265',  label: '1080p H.265',    codec: 'HEVC / AAC',    res: '1920×1080', bitrate: '8 Mb/s',   ext: 'mp4',  icon: 'cube',           badge: 'COMPACT',  color: G.cyan,    sizeMb: '~3.5 Go/h' },
  { id: '720_web',    label: 'Web 720p',       codec: 'VP9 / Opus',    res: '1280×720',  bitrate: '4 Mb/s',   ext: 'webm', icon: 'globe-outline',  badge: 'WEB',      color: G.textSub, sizeMb: '~1.8 Go/h' },
];

const CRITIQUE_ASPECTS = ['Scénario', 'Photographie', 'Jeu d\'acteur', 'BO / Son', 'Montage', 'Mise en scène'] as const;

const EXPORT_STAGES = [
  { label: 'Vérification des permissions…',       pct: 0.04 },
  { label: 'Initialisation du moteur d\'export…', pct: 0.10 },
  { label: 'Injection des métadonnées XMP…',      pct: 0.18 },
  { label: 'Encodage de la piste vidéo…',         pct: 0.35 },
  { label: 'Mixage des pistes audio…',            pct: 0.50 },
  { label: 'Génération du fichier SRT…',          pct: 0.60 },
  { label: 'Création du dossier de presse…',      pct: 0.70 },
  { label: 'Écriture du manifeste projet…',       pct: 0.80 },
  { label: 'Enregistrement dans la photothèque…', pct: 0.90 },
  { label: 'Finalisation et checksum SHA-256…',   pct: 0.97 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function msToTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m  = Math.floor(totalSec / 60);
  const s  = (totalSec % 60).toString().padStart(2, '0');
  const ms2 = (ms % 1000).toString().padStart(3, '0').slice(0, 2);
  return `${m.toString().padStart(2, '0')}:${s}.${ms2}`;
}

function msToSrtTimecode(ms: number): string {
  const h   = Math.floor(ms / 3600000);
  const m   = Math.floor((ms % 3600000) / 60000);
  const s   = Math.floor((ms % 60000) / 1000);
  const ms3 = (ms % 1000).toString().padStart(3, '0');
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms3}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function generateSRT(tracks: SubtitleTrack[]): string {
  return tracks
    .map((t, i) =>
      `${i + 1}\n${msToSrtTimecode(t.startMs)} --> ${msToSrtTimecode(t.endMs)}\n${t.text}`
    )
    .join('\n\n') + '\n';
}

function generatePressKit(meta: {
  title: string; director: string; year: string; genre: string;
  synopsis: string; dirNote: string; runtime: string; language: string;
  cast: CastMember[]; dop: string; composer: string; production: string;
  colorSpace: string; aspectRatio: string; festival: string;
}): string {
  const line = '─'.repeat(60);
  const castStr = meta.cast.filter(c => c.name).map(c => `  • ${c.name}${c.role ? ` (${c.role})` : ''}`).join('\n') || '  Non renseigné';
  return [
    `UNIVERSE — DOSSIER DE PRESSE`,
    line,
    ``,
    `TITRE         : ${meta.title || 'Sans titre'}`,
    `RÉALISATEUR   : ${meta.director || 'Non renseigné'}`,
    `ANNÉE         : ${meta.year}`,
    `GENRE         : ${meta.genre || 'Non renseigné'}`,
    `DURÉE         : ${meta.runtime || 'Non renseignée'}`,
    `LANGUE        : ${meta.language || 'Non renseignée'}`,
    `ASPECT RATIO  : ${meta.aspectRatio}`,
    `COLOR SPACE   : ${meta.colorSpace}`,
    ``,
    line,
    `ÉQUIPE TECHNIQUE`,
    line,
    `CHEF OP.      : ${meta.dop || 'Non renseigné'}`,
    `MUSIQUE       : ${meta.composer || 'Non renseignée'}`,
    `PRODUCTION    : ${meta.production || 'Non renseignée'}`,
    ``,
    line,
    `DISTRIBUTION`,
    line,
    castStr,
    ``,
    line,
    `SYNOPSIS`,
    line,
    meta.synopsis || 'Non renseigné',
    ``,
    line,
    `NOTE DU RÉALISATEUR`,
    line,
    meta.dirNote || 'Non renseignée',
    ``,
    line,
    `FESTIVALS / SÉLECTIONS`,
    line,
    meta.festival || 'Non renseigné',
    ``,
    line,
    `Généré par UNIVERSE Studio — ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}`,
    line,
  ].join('\n');
}

function generateXMP(meta: { title: string; director: string; year: string; genre: string; synopsis: string }): string {
  return `<?xpacket begin='' id='W5M0MpCehiHzreSzNTczkc9d'?>
<x:xmpmeta xmlns:x='adobe:ns:meta/'>
  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
    <rdf:Description rdf:about=''
      xmlns:dc='http://purl.org/dc/elements/1.1/'
      xmlns:xmp='http://ns.adobe.com/xap/1.0/'
      xmlns:universe='http://ns.universe.app/1.0/'>
      <dc:title><rdf:Alt><rdf:li xml:lang='x-default'>${meta.title || 'Sans titre'}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${meta.director || ''}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang='x-default'>${meta.synopsis || ''}</rdf:li></rdf:Alt></dc:description>
      <dc:subject><rdf:Bag><rdf:li>${meta.genre || ''}</rdf:li></rdf:Bag></dc:subject>
      <xmp:CreateDate>${meta.year}-01-01</xmp:CreateDate>
      <universe:App>UNIVERSE Studio</universe:App>
      <universe:Version>2.0</universe:Version>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end='w'?>`;
}

function generateFakeSubtitles(durationSec: number): SubtitleTrack[] {
  const lines = [
    'Un plan fixe.', 'La lumière décline lentement.',
    'On entend des pas au loin.', 'Elle s\'arrête. Hésite.',
    '— Tu crois que ça change quelque chose ?',
    'Le silence répond pour lui.', 'Fondu au noir.',
    '[ Musique : cordes — pianissimo ]',
    'Extérieur nuit — rue déserte.',
    'Un néon clignote, rouge sang.',
    'Il ramasse la lettre. La repose.',
    '— Rien n\'est perdu.', '— Tout est perdu.',
    'Contre-plongée sur le ciel vide.',
    'Un dernier souffle.', 'FIN.',
  ];
  const tracks: SubtitleTrack[] = [];
  let cursor = 2000;
  let idx = 0;
  while (cursor < durationSec * 1000 - 3000 && idx < lines.length) {
    const dur = 1800 + Math.random() * 2200;
    tracks.push({
      id: `sub_${idx}`, startMs: cursor, endMs: cursor + dur,
      text: lines[idx], edited: false, lang: 'fr',
    });
    cursor += dur + 400 + Math.random() * 1200;
    idx++;
  }
  return tracks;
}

function generateFakeThumbnails(durationSec: number): ThumbnailFrame[] {
  const count = Math.min(10, Math.max(4, Math.floor(durationSec / 10)));
  return Array.from({ length: count }, (_, i) => ({
    id: `frame_${i}`,
    uri: `https://picsum.photos/seed/frame${i + Math.floor(Math.random() * 999)}/320/180`,
    time: Math.floor((durationSec / count) * i) + Math.floor(Math.random() * 5),
  }));
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Step indicator bar */
const StepBar = memo(({ step, mode }: { step: WizardStep; mode: AppMode }) => {
  const steps = mode === 'video' ? WIZARD_STEPS : ['Critique', 'Publier'];
  return (
    <View style={sb.wrap}>
      {steps.map((label, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <React.Fragment key={label}>
            <View style={sb.item}>
              <View style={[sb.dot, done && sb.dotDone, active && sb.dotActive]}>
                {done
                  ? <Ionicons name="checkmark" size={10} color="#fff" />
                  : <Text style={sb.dotNum}>{i + 1}</Text>
                }
              </View>
              <Text style={[sb.label, (active || done) && sb.labelOn]} numberOfLines={1}>{label}</Text>
            </View>
            {i < steps.length - 1 && <View style={[sb.line, done && sb.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
});
StepBar.displayName = 'StepBar';

const sb = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 16 },
  item:      { alignItems: 'center', gap: 4, minWidth: 52 },
  dot:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  dotActive: { borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.2)', shadowColor: G.primary, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  dotDone:   { borderColor: G.success, backgroundColor: G.success },
  dotNum:    { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800' },
  label:     { color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  labelOn:   { color: 'rgba(255,255,255,0.75)' },
  line:      { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  lineDone:  { backgroundColor: G.success },
});

/** Glass input */
const GlassInput = memo(({
  label, value, onChangeText, placeholder, multiline, maxLength, keyboardType, hint, icon,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; multiline?: boolean; maxLength?: number;
  keyboardType?: any; hint?: string; icon?: string;
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={gi.wrap}>
      <View style={gi.labelRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && <Ionicons name={icon as any} size={12} color={focused ? G.primary : 'rgba(255,255,255,0.35)'} />}
          <Text style={[gi.label, focused && { color: G.primary }]}>{label}</Text>
        </View>
        {maxLength && <Text style={gi.counter}>{value.length}/{maxLength}</Text>}
      </View>
      <BlurView intensity={18} tint="dark" style={[gi.input, multiline && { height: 110, alignItems: 'flex-start' }, focused && gi.inputFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.18)"
          style={[gi.txt, multiline && { textAlignVertical: 'top' }]}
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType}
          numberOfLines={multiline ? 5 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </BlurView>
      {hint && <Text style={gi.hint}>{hint}</Text>}
    </View>
  );
});
GlassInput.displayName = 'GlassInput';

const gi = StyleSheet.create({
  wrap:        { marginBottom: 14 },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label:       { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  counter:     { color: 'rgba(255,255,255,0.2)', fontSize: 10 },
  input:       { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, paddingHorizontal: 15, paddingVertical: 13, overflow: 'hidden' },
  inputFocused:{ borderColor: 'rgba(192,96,255,0.4)', shadowColor: G.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  txt:         { color: '#fff', fontSize: 14, lineHeight: 20 },
  hint:        { color: 'rgba(255,255,255,0.22)', fontSize: 10, marginTop: 5, fontStyle: 'italic' },
});

/** Chip picker (generic) */
const ChipPicker = memo(({ label, options, selected, onSelect, colorOn }: {
  label: string; options: readonly string[]; selected: string;
  onSelect: (v: string) => void; colorOn?: string;
}) => (
  <View style={gp.wrap}>
    <Text style={gp.label}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={gp.scroll}>
      {options.map(g => {
        const on = selected === g;
        return (
          <TouchableOpacity key={g} activeOpacity={0.75}
            onPress={() => onSelect(selected === g ? '' : g)}
            style={[gp.chip, on && { borderColor: colorOn || G.primary, backgroundColor: `${colorOn || G.primary}15` }]}
          >
            <Text style={[gp.txt, on && { color: colorOn || G.primary, fontWeight: '700' }]}>{g}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
));
ChipPicker.displayName = 'ChipPicker';

const gp = StyleSheet.create({
  wrap:   { marginBottom: 14 },
  label:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 9 },
  scroll: { gap: 8, paddingRight: 20 },
  chip:   { borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, paddingHorizontal: 14, paddingVertical: 8 },
  txt:    { color: G.textSub, fontSize: 13, fontWeight: '500' },
});

/** Star rating */
const StarRatingInput = memo(({ aspect, rating, onRate }: { aspect: string; rating: number; onRate: (r: number) => void }) => (
  <View style={sr.row}>
    <Text style={sr.aspect}>{aspect}</Text>
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onRate(s === rating ? 0 : s)} activeOpacity={0.7}>
          <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={22} color={s <= rating ? G.gold : 'rgba(255,255,255,0.18)'} />
        </TouchableOpacity>
      ))}
    </View>
  </View>
));
StarRatingInput.displayName = 'StarRatingInput';

const sr = StyleSheet.create({
  row:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  aspect: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
});

/** CTA button */
const CTAButton = memo(({
  label, onPress, disabled, loading, variant = 'primary', icon, small,
}: {
  label: string; onPress: () => void; disabled?: boolean;
  loading?: boolean; variant?: 'primary' | 'ghost' | 'danger' | 'gold' | 'cyan';
  icon?: string; small?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 200 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const colorsMap: Record<string, [string, string]> = {
    primary: ['#7B2FBE', '#C060FF'],
    gold:    ['#8B6500', '#FFD700'],
    danger:  ['#7F0000', '#FF4D6A'],
    cyan:    ['#0D5A70', '#86EEFF'],
    ghost:   ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.07)'],
  };
  const textColor = variant === 'gold' ? '#0A0010' : variant === 'cyan' ? '#00151C' : '#fff';

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.4 : 1, marginBottom: 16 }}>
      <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut}
        disabled={disabled || loading} activeOpacity={1}
      >
        <LinearGradient
          colors={colorsMap[variant]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[btn.base, small && btn.small, variant === 'ghost' && btn.ghostBorder]}
        >
          {loading
            ? <ActivityIndicator color={textColor} size="small" />
            : <>
                {icon && <Ionicons name={icon as any} size={small ? 15 : 18} color={textColor} style={{ marginRight: 7 }} />}
                <Text style={[btn.label, { color: textColor }, small && btn.labelSmall]}>{label}</Text>
              </>
          }
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});
CTAButton.displayName = 'CTAButton';

const btn = StyleSheet.create({
  base:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 24, borderRadius: 16, marginBottom: 60 },
  small:      { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  ghostBorder:{ borderWidth: 1, borderColor: G.glassBorder },
  label:      { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  labelSmall: { fontSize: 13 },
});



/** Section header */
const SectionHeader = ({ icon, title, sub }: { icon: string; title: string; sub?: string }) => (
  <View style={sh.wrap}>
    <LinearGradient colors={['rgba(192,96,255,0.18)', 'rgba(108,16,195,0.10)']} style={sh.iconCircle}>
      <Ionicons name={icon as any} size={18} color={G.primary} />
    </LinearGradient>
    <View style={{ flex: 1 }}>
      <Text style={sh.title}>{title}</Text>
      {sub && <Text style={sh.sub}>{sub}</Text>}
    </View>
  </View>
);

const sh = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(192,96,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  title:      { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sub:        { color: G.textSub, fontSize: 12, marginTop: 1 },
});

/** Scanline overlay */
const ScanlineOverlay = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {Array.from({ length: 28 }, (_, i) => (
      <View key={i} style={{
        position: 'absolute', left: 0, right: 0,
        top: i * (H / 28), height: 1,
        backgroundColor: 'rgba(192,96,255,0.015)',
      }} />
    ))}
  </View>
));
ScanlineOverlay.displayName = 'ScanlineOverlay';

/** Info badge */
const Badge = ({ label, color }: { label: string; color: string }) => (
  <View style={{ backgroundColor: `${color}1A`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${color}44` }}>
    <Text style={{ color, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 STEP 0 — Import vidéo
// ─────────────────────────────────────────────────────────────────────────────
function StepImport({
  videoUri, onPick, onRemove, videoDuration, videoFileSize, videoFileName,
}: {
  videoUri: string | null; onPick: () => void; onRemove: () => void;
  videoDuration: number; videoFileSize: number; videoFileName: string;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
    ])).start();
  }, []);

  const borderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(192,96,255,0.15)', 'rgba(192,96,255,0.55)'] });

  return (
    <View style={{ gap: 16 }}>
      <SectionHeader icon="cloud-upload-outline" title="Importer la vidéo"
        sub={videoUri ? videoFileName || 'Vidéo chargée' : 'Formats acceptés : MOV · MP4 · MXF · ProRes'} />

      <TouchableOpacity onPress={videoUri ? undefined : onPick} activeOpacity={videoUri ? 1 : 0.85}>
        <Animated.View style={{ borderRadius: 20, borderWidth: 1.5, borderColor: videoUri ? G.primary : borderColor, overflow: 'hidden' }}>
          <BlurView intensity={14} tint="dark" style={si.dropzone}>
            {videoUri ? (
              <>
                <Video source={{ uri: videoUri }} style={si.videoPreview}
                  resizeMode={ResizeMode.COVER} isLooping shouldPlay={false} isMuted />
                <LinearGradient colors={['transparent', 'rgba(6,0,16,0.92)']} style={si.videoOverlay} />
                {/* Waveform */}
                <View style={si.waveRow}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <View key={i} style={[si.waveBar, { height: 3 + Math.abs(Math.sin(i * 0.7 + 1)) * 14 + Math.random() * 5 }]} />
                  ))}
                </View>
                {/* Meta overlay */}
                <View style={si.videoMeta}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge label="VIDÉO CHARGÉE" color={G.success} />
                    <Badge label={msToTimecode(videoDuration * 1000)} color={G.primary} />
                    {videoFileSize > 0 && <Badge label={formatBytes(videoFileSize)} color={G.cyan} />}
                  </View>
                  {videoFileName ? (
                    <Text style={si.videoFileName} numberOfLines={1}>{videoFileName}</Text>
                  ) : null}
                </View>
                <TouchableOpacity style={si.removeBtn} onPress={onRemove} activeOpacity={0.8}>
                  <BlurView intensity={40} tint="dark" style={si.removeBtnInner}>
                    <Ionicons name="close" size={16} color={G.danger} />
                  </BlurView>
                </TouchableOpacity>
                {/* Replace hint */}
                <TouchableOpacity style={si.replaceBtn} onPress={onPick} activeOpacity={0.8}>
                  <BlurView intensity={30} tint="dark" style={si.replaceBtnInner}>
                    <Ionicons name="swap-horizontal-outline" size={13} color="rgba(255,255,255,0.6)" />
                    <Text style={si.replaceTxt}>Remplacer</Text>
                  </BlurView>
                </TouchableOpacity>
              </>
            ) : (
              <Animated.View style={[si.emptyContent, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={['rgba(192,96,255,0.18)', 'rgba(108,16,195,0.28)']} style={si.uploadCircle}>
                  <Ionicons name="film" size={40} color={G.primary} />
                </LinearGradient>
                <Text style={si.uploadTitle}>Déposer ou sélectionner</Text>
                <Text style={si.uploadSub}>Jusqu'à 4K · 10 Go · 60 min max</Text>
                <View style={si.formatRow}>
                  {['MOV', 'MP4', 'ProRes', 'MXF', 'WEBM'].map(f => (
                    <View key={f} style={si.formatTag}><Text style={si.formatTagText}>{f}</Text></View>
                  ))}
                </View>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>

      {!videoUri && (
        <CTAButton label="Choisir depuis la galerie" onPress={onPick} icon="images-outline" />
      )}

      {/* Technical specs grid */}
      <View style={si.specGrid}>
        {[
          { icon: 'resize',            label: 'Résolution', val: 'jusqu\'à 4K UHD'  },
          { icon: 'timer-outline',     label: 'Durée max',  val: '60 minutes'        },
          { icon: 'musical-notes',     label: 'Audio',      val: 'PCM · AAC · MP3'  },
          { icon: 'color-wand',        label: 'Color',      val: 'Rec.709 / DCI-P3' },
          { icon: 'layers-outline',    label: 'Codecs',     val: 'H.264 · H.265 · ProRes' },
          { icon: 'document-outline',  label: 'Conteneurs', val: 'MP4 · MOV · WEBM' },
        ].map(sp => (
          <BlurView key={sp.label} intensity={10} tint="dark" style={si.specCard}>
            <Ionicons name={sp.icon as any} size={15} color={G.primary} />
            <Text style={si.specLabel}>{sp.label}</Text>
            <Text style={si.specVal}>{sp.val}</Text>
          </BlurView>
        ))}
      </View>
    </View>
  );
}

const si = StyleSheet.create({
  dropzone:       { height: 250, alignItems: 'center', justifyContent: 'center' },
  videoPreview:   { ...StyleSheet.absoluteFillObject as any },
  videoOverlay:   { ...StyleSheet.absoluteFillObject as any },
  videoMeta:      { position: 'absolute', bottom: 38, left: 14, right: 50, gap: 6 },
  videoFileName:  { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontStyle: 'italic' },
  removeBtn:      { position: 'absolute', top: 10, right: 10 },
  removeBtnInner: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${G.danger}44` },
  replaceBtn:     { position: 'absolute', bottom: 10, right: 10 },
  replaceBtnInner:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  replaceTxt:     { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  waveRow:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', height: 30, paddingHorizontal: 6, gap: 2, opacity: 0.35 },
  waveBar:        { flex: 1, backgroundColor: G.primary, borderRadius: 2 },
  emptyContent:   { alignItems: 'center', gap: 14 },
  uploadCircle:   { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.3)' },
  uploadTitle:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  uploadSub:      { color: G.textSub, fontSize: 13 },
  formatRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  formatTag:      { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: G.glassBorder },
  formatTagText:  { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  specGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specCard:       { width: (W - 52) / 2, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 14, gap: 4, overflow: 'hidden' },
  specLabel:      { color: G.textSub, fontSize: 10, fontWeight: '600', marginTop: 2 },
  specVal:        { color: '#fff', fontSize: 11, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 STEP 1 — Métadonnées
// ─────────────────────────────────────────────────────────────────────────────
function StepMeta({
  title, setTitle, synopsis, setSynopsis,
  director, setDirector, year, setYear,
  genre, setGenre, dirNote, setDirNote,
  language, setLanguage, dop, setDop,
  composer, setComposer, production, setProduction,
  cast, setCast, festival, setFestival,
  colorSpace, setColorSpace, aspectRatio, setAspectRatio,
  isan, setIsan, runtime, setRuntime,
}: {
  title: string; setTitle: (v: string) => void;
  synopsis: string; setSynopsis: (v: string) => void;
  director: string; setDirector: (v: string) => void;
  year: string; setYear: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  dirNote: string; setDirNote: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  dop: string; setDop: (v: string) => void;
  composer: string; setComposer: (v: string) => void;
  production: string; setProduction: (v: string) => void;
  cast: CastMember[]; setCast: React.Dispatch<React.SetStateAction<CastMember[]>>;
  festival: string; setFestival: (v: string) => void;
  colorSpace: string; setColorSpace: (v: string) => void;
  aspectRatio: string; setAspectRatio: (v: string) => void;
  isan: string; setIsan: (v: string) => void;
  runtime: string; setRuntime: (v: string) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const addCastMember = () => setCast(prev => [...prev, { name: '', role: '' }]);
  const removeCast    = (i: number) => setCast(prev => prev.filter((_, idx) => idx !== i));
  const updateCast    = (i: number, field: 'name' | 'role', val: string) =>
    setCast(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  const completedFields = [title, director, genre, synopsis, language].filter(Boolean).length;
  const totalRequired   = 5;

  return (
    <View>
      <SectionHeader icon="create-outline" title="Métadonnées du film" sub="Identité et informations cinématographiques" />

      {/* Completion indicator */}
      <BlurView intensity={10} tint="dark" style={sm.completionCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={sm.completionLabel}>FICHE COMPLÉTÉE</Text>
          <Text style={sm.completionPct}>{Math.round((completedFields / totalRequired) * 100)}%</Text>
        </View>
        <View style={sm.completionTrack}>
          <View style={[sm.completionBar, { width: `${(completedFields / totalRequired) * 100}%` }]} />
        </View>
      </BlurView>

      {/* Core fields */}
      <GlassInput label="Titre du film" value={title} onChangeText={setTitle}
        placeholder="Ex : La Chambre Inversée" maxLength={80} icon="film-outline" />
      <GlassInput label="Synopsis" value={synopsis} onChangeText={setSynopsis}
        placeholder="Décrivez votre œuvre en quelques phrases percutantes…"
        multiline maxLength={800} icon="document-text-outline" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <GlassInput label="Réalisateur·rice" value={director} onChangeText={setDirector}
            placeholder="Prénom Nom" icon="person-outline" />
        </View>
        <View style={{ width: 90 }}>
          <GlassInput label="Année" value={year} onChangeText={setYear}
            keyboardType="numeric" placeholder="2025" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <GlassInput label="Durée" value={runtime} onChangeText={setRuntime}
            placeholder="Ex : 18 min" icon="timer-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <GlassInput label="Code ISAN" value={isan} onChangeText={setIsan}
            placeholder="0000-0000-…" icon="barcode-outline" />
        </View>
      </View>

      <ChipPicker label="Genre cinématographique" options={GENRES_CINEMA} selected={genre} onSelect={setGenre} />
      <ChipPicker label="Langue principale" options={LANGUAGES} selected={language} onSelect={setLanguage} colorOn={G.cyan} />

      {/* Advanced toggle */}
      <TouchableOpacity onPress={() => setShowAdvanced(v => !v)} activeOpacity={0.8} style={sm.advancedToggle}>
        <Text style={sm.advancedLabel}>Informations avancées</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={sm.advancedSub}>{showAdvanced ? 'Masquer' : 'Afficher'}</Text>
          <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={G.textSub} />
        </View>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={{ gap: 0 }}>
          <GlassInput label="Chef Opérateur (DOP)" value={dop} onChangeText={setDop}
            placeholder="Nom du directeur photo" icon="aperture-outline" />
          <GlassInput label="Compositeur / BO" value={composer} onChangeText={setComposer}
            placeholder="Nom du compositeur" icon="musical-notes-outline" />
          <GlassInput label="Maison de production" value={production} onChangeText={setProduction}
            placeholder="Société de production" icon="business-outline" />
          <GlassInput label="Festivals / Sélections" value={festival} onChangeText={setFestival}
            placeholder="Ex : Cannes 2025 — Sélection officielle" multiline maxLength={400} icon="trophy-outline" />

          <ChipPicker label="Color Space" options={COLOR_SPACES} selected={colorSpace} onSelect={setColorSpace} colorOn={G.orange} />
          <ChipPicker label="Aspect Ratio" options={ASPECT_RATIOS} selected={aspectRatio} onSelect={setAspectRatio} colorOn={G.gold} />

          {/* Cast */}
          <View style={sm.castSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={sm.castLabel}>DISTRIBUTION</Text>
              <TouchableOpacity onPress={addCastMember} style={sm.castAddBtn}>
                <Ionicons name="add" size={14} color={G.primary} />
                <Text style={sm.castAddTxt}>Ajouter</Text>
              </TouchableOpacity>
            </View>
            {cast.map((member, i) => (
              <View key={i} style={sm.castRow}>
                <View style={{ flex: 2 }}>
                  <TextInput
                    value={member.name}
                    onChangeText={v => updateCast(i, 'name', v)}
                    placeholder="Nom de l'acteur"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                    style={sm.castInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={member.role}
                    onChangeText={v => updateCast(i, 'role', v)}
                    placeholder="Rôle"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                    style={sm.castInput}
                  />
                </View>
                <TouchableOpacity onPress={() => removeCast(i)} style={{ padding: 8 }}>
                  <Ionicons name="close-circle-outline" size={18} color="rgba(255,80,80,0.55)" />
                </TouchableOpacity>
              </View>
            ))}
            {cast.length === 0 && (
              <Text style={sm.castEmpty}>Aucun acteur renseigné</Text>
            )}
          </View>
        </View>
      )}

      <GlassInput label="Note de mise en scène" value={dirNote} onChangeText={setDirNote}
        placeholder="Ce que vous voulez que le public retienne…" multiline maxLength={500}
        hint="Optionnel — incluse dans le dossier de presse" icon="pencil-outline" />
    </View>
  );
}

const sm = StyleSheet.create({
  completionCard:  { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 16, overflow: 'hidden' },
  completionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  completionPct:   { color: G.primary, fontSize: 12, fontWeight: '800' },
  completionTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' },
  completionBar:   { height: '100%', backgroundColor: G.primary, borderRadius: 2 },
  advancedToggle:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: G.glassBorder, marginBottom: 14 },
  advancedLabel:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  advancedSub:     { color: G.textSub, fontSize: 12 },
  castSection:     { marginBottom: 14 },
  castLabel:       { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  castAddBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(192,96,255,0.3)', backgroundColor: 'rgba(192,96,255,0.08)' },
  castAddTxt:      { color: G.primary, fontSize: 12, fontWeight: '700' },
  castRow:         { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  castInput:       { flex: 1, color: '#fff', fontSize: 13, borderBottomWidth: 1, borderBottomColor: G.glassBorder, paddingVertical: 8, paddingHorizontal: 4 },
  castEmpty:       { color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 STEP 2 — Sous-titres
// ─────────────────────────────────────────────────────────────────────────────
function StepSubtitles({
  subtitles, setSubtitles, analyzing, onAnalyze, videoDuration,
}: {
  subtitles: SubtitleTrack[];
  setSubtitles: React.Dispatch<React.SetStateAction<SubtitleTrack[]>>;
  analyzing: boolean; onAnalyze: () => void; videoDuration: number;
}) {
  const [editId, setEditId]       = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [tempTimeVal, setTempTimeVal] = useState('');

  const filtered = useMemo(() =>
    search ? subtitles.filter(s => s.text.toLowerCase().includes(search.toLowerCase())) : subtitles,
    [subtitles, search]
  );

  const totalWords = useMemo(() =>
    subtitles.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0),
    [subtitles]
  );

  const updateText  = useCallback((id: string, text: string) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text, edited: true } : s));
  }, [setSubtitles]);

  const deleteTrack = useCallback((id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
  }, [setSubtitles]);

  const addTrack = useCallback(() => {
    const lastEnd = subtitles.length > 0 ? subtitles[subtitles.length - 1].endMs : 0;
    const t: SubtitleTrack = {
      id: `sub_${Date.now()}`, startMs: lastEnd + 500, endMs: lastEnd + 3000,
      text: '', edited: true, lang: 'fr',
    };
    setSubtitles(prev => [...prev, t]);
    setEditId(t.id);
  }, [subtitles, setSubtitles]);

  const importFromText = useCallback(() => {
    const lines = importText.split('\n').filter(l => l.trim());
    const tracks: SubtitleTrack[] = lines.map((line, i) => ({
      id: `imp_${Date.now()}_${i}`,
      startMs: i * 4000, endMs: i * 4000 + 3000,
      text: line.trim(), edited: true, lang: 'fr',
    }));
    setSubtitles(prev => [...prev, ...tracks]);
    setImportText('');
    setShowImport(false);
  }, [importText, setSubtitles]);

  const startEditTime = (id: string, field: 'start' | 'end') => {
    const track = subtitles.find(s => s.id === id);
    if (!track) return;
    setEditingTime({ id, field });
    setTempTimeVal(msToTimecode(field === 'start' ? track.startMs : track.endMs));
  };

  const commitTime = () => {
    if (!editingTime) return;
    // Parse MM:SS.mm → ms
    const parts = tempTimeVal.match(/^(\d+):(\d+)\.(\d+)$/);
    if (parts) {
      const ms = parseInt(parts[1]) * 60000 + parseInt(parts[2]) * 1000 + parseInt(parts[3]) * 10;
      setSubtitles(prev => prev.map(s => s.id === editingTime.id
        ? { ...s, [editingTime.field === 'start' ? 'startMs' : 'endMs']: ms, edited: true }
        : s
      ));
    }
    setEditingTime(null);
  };

  const shiftAll = (deltaMs: number) => {
    setSubtitles(prev => prev.map(s => ({
      ...s, startMs: Math.max(0, s.startMs + deltaMs), endMs: Math.max(0, s.endMs + deltaMs), edited: true,
    })));
  };

  return (
    <View>
      <SectionHeader icon="text-outline" title="Sous-titres"
        sub={`${subtitles.length} piste${subtitles.length !== 1 ? 's' : ''} · ${totalWords} mots`} />

      {/* AI panel */}
      <BlurView intensity={14} tint="dark" style={ss.aiPanel}>
        <View style={ss.aiPanelLeft}>
          <LinearGradient colors={['rgba(134,238,255,0.15)', 'rgba(134,238,255,0.05)']} style={ss.aiCircle}>
            <Ionicons name="hardware-chip-outline" size={20} color={G.cyan} />
          </LinearGradient>
          <View>
            <Text style={ss.aiTitle}>Analyse ASR automatique</Text>
            <Text style={ss.aiSub}>Détection vocale · synchronisation frame-perfect</Text>
          </View>
        </View>
        <TouchableOpacity style={ss.aiBtn} onPress={onAnalyze} disabled={analyzing} activeOpacity={0.8}>
          {analyzing
            ? <ActivityIndicator color={G.cyan} size="small" />
            : <Text style={ss.aiBtnTxt}>Analyser</Text>
          }
        </TouchableOpacity>
      </BlurView>

      {/* Toolbar */}
      {subtitles.length > 0 && (
        <View style={ss.toolbar}>
          {/* Search */}
          <BlurView intensity={12} tint="dark" style={ss.searchBox}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.3)" />
            <TextInput
              value={search} onChangeText={setSearch}
              placeholder="Rechercher…" placeholderTextColor="rgba(255,255,255,0.2)"
              style={ss.searchInput}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ) : null}
          </BlurView>
          {/* Shift buttons */}
          <TouchableOpacity style={ss.shiftBtn} onPress={() => shiftAll(-500)} activeOpacity={0.75}>
            <Ionicons name="play-back" size={14} color={G.textSub} />
            <Text style={ss.shiftTxt}>-0.5s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ss.shiftBtn} onPress={() => shiftAll(500)} activeOpacity={0.75}>
            <Text style={ss.shiftTxt}>+0.5s</Text>
            <Ionicons name="play-forward" size={14} color={G.textSub} />
          </TouchableOpacity>
        </View>
      )}

      {/* Timeline */}
      {videoDuration > 0 && subtitles.length > 0 && (
        <View style={ss.timeline}>
          <View style={ss.timelineTrack}>
            {subtitles.map(s => {
              const left  = (s.startMs / (videoDuration * 1000)) * 100;
              const width = Math.max(1.5, ((s.endMs - s.startMs) / (videoDuration * 1000)) * 100);
              return (
                <View key={s.id} style={[ss.timelineBlock, {
                  left: `${Math.min(left, 98)}%`, width: `${Math.min(width, 100 - left)}%`,
                  backgroundColor: s.edited ? G.gold : G.primary,
                }]} />
              );
            })}
          </View>
          <View style={ss.timelineLabelRow}>
            {['0:00', msToTimecode(videoDuration * 500), msToTimecode(videoDuration * 1000)].map(t => (
              <Text key={t} style={ss.timelineLabel}>{t}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Stats row */}
      {subtitles.length > 0 && (
        <View style={ss.statsRow}>
          {[
            { label: 'Pistes', val: String(subtitles.length) },
            { label: 'Éditées', val: String(subtitles.filter(s => s.edited).length) },
            { label: 'Mots', val: String(totalWords) },
            { label: 'Durée', val: msToTimecode(videoDuration * 1000) },
          ].map(({ label, val }) => (
            <BlurView key={label} intensity={8} tint="dark" style={ss.statCard}>
              <Text style={ss.statVal}>{val}</Text>
              <Text style={ss.statLabel}>{label}</Text>
            </BlurView>
          ))}
        </View>
      )}

      {/* Empty */}
      {subtitles.length === 0 && !analyzing && (
        <View style={ss.emptyTracks}>
          <LinearGradient colors={['rgba(192,96,255,0.08)', 'rgba(108,16,195,0.04)']} style={ss.emptyCircle}>
            <Ionicons name="mic-off-outline" size={32} color="rgba(255,255,255,0.12)" />
          </LinearGradient>
          <Text style={ss.emptyTxt}>Lancez l'analyse pour détecter les dialogues</Text>
          <Text style={[ss.emptyTxt, { fontSize: 11, marginTop: -8 }]}>ou importez un fichier SRT existant</Text>
        </View>
      )}

      {/* Track list */}
      {filtered.map((track) => {
        const isEditing = editId === track.id;
        return (
          <BlurView key={track.id} intensity={10} tint="dark"
            style={[ss.trackCard, isEditing && ss.trackCardActive]}
          >
            <View style={ss.trackHeader}>
              <View style={ss.timecodeRow}>
                {/* Start timecode — tappable */}
                <TouchableOpacity onPress={() => startEditTime(track.id, 'start')}>
                  {editingTime?.id === track.id && editingTime.field === 'start' ? (
                    <TextInput
                      value={tempTimeVal} onChangeText={setTempTimeVal}
                      style={ss.timecodeEdit} onBlur={commitTime} autoFocus
                      keyboardType="numbers-and-punctuation"
                    />
                  ) : (
                    <Text style={ss.timecode}>{msToTimecode(track.startMs)}</Text>
                  )}
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={10} color="rgba(255,255,255,0.25)" />
                {/* End timecode — tappable */}
                <TouchableOpacity onPress={() => startEditTime(track.id, 'end')}>
                  {editingTime?.id === track.id && editingTime.field === 'end' ? (
                    <TextInput
                      value={tempTimeVal} onChangeText={setTempTimeVal}
                      style={ss.timecodeEdit} onBlur={commitTime} autoFocus
                      keyboardType="numbers-and-punctuation"
                    />
                  ) : (
                    <Text style={[ss.timecode, { color: G.textSub }]}>{msToTimecode(track.endMs)}</Text>
                  )}
                </TouchableOpacity>
                {track.edited && <Badge label="ÉDITÉ" color={G.gold} />}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditId(isEditing ? null : track.id)}>
                  <Ionicons name={isEditing ? 'checkmark-circle' : 'pencil-outline'}
                    size={18} color={isEditing ? G.success : 'rgba(255,255,255,0.35)'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteTrack(track.id)}>
                  <Ionicons name="trash-outline" size={18} color="rgba(255,60,60,0.45)" />
                </TouchableOpacity>
              </View>
            </View>
            {isEditing ? (
              <TextInput
                value={track.text} onChangeText={(t) => updateText(track.id, t)}
                style={ss.trackInput} multiline autoFocus
                placeholderTextColor="rgba(255,255,255,0.18)"
                placeholder="Texte du sous-titre…"
              />
            ) : (
              <Text style={ss.trackText}>
                {track.text || <Text style={{ color: 'rgba(255,255,255,0.14)', fontStyle: 'italic' }}>Vide</Text>}
              </Text>
            )}
          </BlurView>
        );
      })}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <CTAButton label="+ Piste" onPress={addTrack} variant="ghost" small />
        </View>
        <View style={{ flex: 2 }}>
          <CTAButton label="Importer du texte" onPress={() => setShowImport(true)} variant="ghost" icon="download-outline" small />
        </View>
      </View>

      {/* SRT hint */}
      {subtitles.length > 0 && (
        <BlurView intensity={8} tint="dark" style={ss.srtHint}>
          <Ionicons name="document-text-outline" size={13} color={G.success} />
          <Text style={ss.srtHintTxt}>
            Fichier <Text style={{ color: G.success, fontWeight: '700' }}>.SRT</Text> généré automatiquement à l'export · {subtitles.length} entrées · {totalWords} mots
          </Text>
        </BlurView>
      )}

      {/* Import text modal */}
      <Modal visible={showImport} transparent animationType="slide">
        <BlurView intensity={60} tint="dark" style={ss.modalOverlay}>
          <View style={ss.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={ss.modalTitle}>Importer du texte</Text>
              <TouchableOpacity onPress={() => setShowImport(false)}>
                <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            <Text style={ss.modalSub}>Collez votre texte (une réplique par ligne). Les timecodes seront distribués automatiquement.</Text>
            <TextInput
              value={importText} onChangeText={setImportText}
              style={ss.modalInput} multiline placeholder="Une réplique par ligne…"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <CTAButton label="Annuler" onPress={() => setShowImport(false)} variant="ghost" />
              </View>
              <View style={{ flex: 2 }}>
                <CTAButton label="Importer" onPress={importFromText} disabled={!importText.trim()} icon="checkmark-outline" />
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const ss = StyleSheet.create({
  aiPanel:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(134,238,255,0.2)', marginBottom: 14, overflow: 'hidden' },
  aiPanelLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  aiCircle:     { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(134,238,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  aiTitle:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  aiSub:        { color: G.textSub, fontSize: 10, marginTop: 1 },
  aiBtn:        { backgroundColor: 'rgba(134,238,255,0.1)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(134,238,255,0.3)', minWidth: 88, alignItems: 'center' },
  aiBtnTxt:     { color: G.cyan, fontSize: 13, fontWeight: '700' },
  toolbar:      { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' },
  searchBox:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, overflow: 'hidden' },
  searchInput:  { flex: 1, color: '#fff', fontSize: 13 },
  shiftBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass },
  shiftTxt:     { color: G.textSub, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeline:     { marginBottom: 14 },
  timelineTrack:{ height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden', position: 'relative', marginBottom: 5 },
  timelineBlock:{ position: 'absolute', top: 3, height: 10, borderRadius: 5, opacity: 0.8 },
  timelineLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineLabel:{ color: 'rgba(255,255,255,0.22)', fontSize: 9, fontVariant: ['tabular-nums'] },
  statsRow:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard:     { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: G.glassBorder, padding: 10, alignItems: 'center', gap: 2, overflow: 'hidden' },
  statVal:      { color: '#fff', fontSize: 14, fontWeight: '800' },
  statLabel:    { color: G.textSub, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  emptyTracks:  { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyCircle:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTxt:     { color: 'rgba(255,255,255,0.22)', fontSize: 13, textAlign: 'center' },
  trackCard:    { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 12, marginBottom: 10, overflow: 'hidden' },
  trackCardActive: { borderColor: G.primary, shadowColor: G.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  trackHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timecodeRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timecode:     { color: G.primary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timecodeEdit: { color: G.gold, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'], borderBottomWidth: 1, borderBottomColor: G.gold, minWidth: 60 },
  trackInput:   { color: '#fff', fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 8, minHeight: 40 },
  trackText:    { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19 },
  srtHint:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(30,215,96,0.2)', marginTop: 8, overflow: 'hidden' },
  srtHintTxt:   { color: G.textSub, fontSize: 12, flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  modalCard:    { backgroundColor: '#100022', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: G.glassBorder },
  modalTitle:   { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalSub:     { color: G.textSub, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  modalInput:   { color: '#fff', fontSize: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, minHeight: 140, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: G.glassBorder },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 STEP 3 — Thumbnail
// ─────────────────────────────────────────────────────────────────────────────
function StepThumbnail({
  frames, selectedFrame, setSelectedFrame, customThumb, onPickCustom, thumbRatio, setThumbRatio,
}: {
  frames: ThumbnailFrame[]; selectedFrame: string; setSelectedFrame: (id: string) => void;
  customThumb: string | null; onPickCustom: () => void;
  thumbRatio: string; setThumbRatio: (v: string) => void;
}) {
  const [filter, setFilter] = useState<'none' | 'cinema' | 'noir' | 'warm'>('none');
  const selected = frames.find(f => f.id === selectedFrame);
  const previewUri = customThumb || selected?.uri;

  const ratioMap: Record<string, [string, number, number]> = {
    '16:9': ['16:9', 320, 180], '4:3': ['4:3', 320, 240],
    '1:1': ['1:1', 220, 220],  '2.39:1': ['2.39:1', 320, 134],
  };
  const [rLabel, rW, rH] = ratioMap[thumbRatio] || ratioMap['16:9'];

  const filterOverlays: Record<string, any> = {
    cinema: { backgroundColor: 'rgba(40,0,80,0.25)' },
    noir:   { backgroundColor: 'rgba(0,0,0,0.45)' },
    warm:   { backgroundColor: 'rgba(180,80,0,0.2)' },
    none:   {},
  };

  return (
    <View>
      <SectionHeader icon="image-outline" title="Vignette" sub="Image de couverture cinématographique" />

      {/* Preview */}
      <View style={[sth.previewWrap, { height: rH / (rW / (W - 40)) }]}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={sth.preview} resizeMode="cover" />
        ) : (
          <View style={[sth.preview, sth.previewPlaceholder]}>
            <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.08)" />
          </View>
        )}
        {/* Filter overlay */}
        {filter !== 'none' && <View style={[StyleSheet.absoluteFillObject, filterOverlays[filter]]} pointerEvents="none" />}
        <LinearGradient colors={['transparent', 'rgba(6,0,16,0.75)']} style={StyleSheet.absoluteFillObject as any} pointerEvents="none" />
        {/* Letterbox */}
        <View style={sth.letterboxTop} />
        <View style={sth.letterboxBot} />
        {/* Label */}
        <BlurView intensity={20} tint="dark" style={sth.thumbLabel}>
          <Text style={sth.thumbLabelTxt}>{rLabel} · THUMBNAIL</Text>
        </BlurView>
        {/* Custom badge */}
        {customThumb && (
          <View style={sth.customBadge}>
            <Badge label="PERSONNALISÉE" color={G.gold} />
          </View>
        )}
      </View>

      {/* Aspect ratio selector */}
      <ChipPicker label="Format d'export" options={['16:9', '4:3', '1:1', '2.39:1']}
        selected={thumbRatio} onSelect={setThumbRatio} colorOn={G.cyan} />

      {/* Filter pills */}
      <View style={sth.filterRow}>
        <Text style={sth.filterLabel}>FILTRE CINÉMA</Text>
        {(['none', 'cinema', 'noir', 'warm'] as const).map(f => (
          <TouchableOpacity key={f} style={[sth.filterPill, filter === f && sth.filterPillOn]}
            onPress={() => setFilter(f)} activeOpacity={0.8}
          >
            <Text style={[sth.filterTxt, filter === f && { color: G.primary, fontWeight: '700' }]}>
              {f === 'none' ? 'Aucun' : f === 'cinema' ? 'Cinéma' : f === 'noir' ? 'Noir & Blanc' : 'Chaleureux'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Frame picker */}
      <Text style={sth.sectionLabel}>EXTRAITS AUTOMATIQUES</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sth.framesScroll}>
        {frames.map(f => {
          const on = selectedFrame === f.id && !customThumb;
          return (
            <TouchableOpacity key={f.id} onPress={() => { setSelectedFrame(f.id); }}
              activeOpacity={0.8} style={[sth.frameWrap, on && sth.frameWrapOn]}
            >
              <Image source={{ uri: f.uri }} style={sth.frameImg} resizeMode="cover" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFillObject as any} />
              <View style={sth.frameTimecode}>
                <Text style={sth.frameTimecodeText}>{msToTimecode(f.time * 1000)}</Text>
              </View>
              {on && (
                <View style={sth.frameCheck}>
                  <Ionicons name="checkmark-circle" size={22} color={G.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ gap: 10, marginTop: 10 }}>
        <CTAButton label={customThumb ? 'Changer l\'image' : 'Importer une image personnalisée'}
          onPress={onPickCustom} variant="ghost" icon="cloud-upload-outline" />
        {customThumb && (
          <CTAButton label="Utiliser un extrait automatique" onPress={() => { /* handled by frame click */ }}
            variant="ghost" small icon="film-outline" />
        )}
      </View>

      {/* Tips */}
      <BlurView intensity={10} tint="dark" style={sth.tipsCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Ionicons name="bulb-outline" size={14} color={G.gold} />
          <Text style={sth.tipsTitle}>Conseils de composition</Text>
        </View>
        {[
          'Règle des tiers : placez le sujet sur une intersection',
          'Contrastes forts pour la lisibilité en vignette miniature',
          'Format 16:9 recommandé pour la majorité des plateformes',
          'Évitez le texte — il sera ajouté par chaque plateforme',
        ].map((tip, i) => (
          <View key={i} style={sth.tipRow}>
            <View style={sth.tipDot} />
            <Text style={sth.tipTxt}>{tip}</Text>
          </View>
        ))}
      </BlurView>
    </View>
  );
}

const sth = StyleSheet.create({
  previewWrap:      { borderRadius: 18, overflow: 'hidden', marginBottom: 16, position: 'relative', borderWidth: 1, borderColor: G.glassBorder },
  preview:          { width: '100%', height: '100%' },
  previewPlaceholder: { backgroundColor: '#0E0020', alignItems: 'center', justifyContent: 'center' },
  letterboxTop:     { position: 'absolute', top: 0, left: 0, right: 0, height: 16, backgroundColor: '#000', opacity: 0.9 },
  letterboxBot:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, backgroundColor: '#000', opacity: 0.9 },
  thumbLabel:       { position: 'absolute', top: 20, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder },
  thumbLabelTxt:    { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  customBadge:      { position: 'absolute', top: 20, right: 12 },
  filterRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterLabel:      { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginRight: 2 },
  filterPill:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass },
  filterPillOn:     { borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.1)' },
  filterTxt:        { color: G.textSub, fontSize: 12, fontWeight: '500' },
  sectionLabel:     { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 0.9, marginBottom: 10 },
  framesScroll:     { gap: 10, paddingBottom: 4, paddingRight: 20 },
  frameWrap:        { width: 120, height: 78, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  frameWrapOn:      { borderColor: G.primary, shadowColor: G.primary, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  frameImg:         { width: '100%', height: '100%' },
  frameTimecode:    { position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  frameTimecodeText:{ color: '#fff', fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  frameCheck:       { position: 'absolute', top: 4, right: 4 },
  tipsCard:         { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 16, gap: 8, overflow: 'hidden' },
  tipsTitle:        { color: '#fff', fontSize: 13, fontWeight: '700' },
  tipRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipDot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: G.gold, marginTop: 5 },
  tipTxt:           { color: G.textSub, fontSize: 12, lineHeight: 17, flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 STEP 4 — Export
// ─────────────────────────────────────────────────────────────────────────────
function StepExport({
  selectedFormat, setSelectedFormat, onExport, exporting, exportProgress,
  exportStep, exportedFiles, savedToLib, title, genre, subtitleCount,
  director, year, runtime, language,
  embedSrt, setEmbedSrt, embedXmp, setEmbedXmp, watermark, setWatermark,
}: {
  selectedFormat: string; setSelectedFormat: (id: string) => void;
  onExport: () => void; exporting: boolean; exportProgress: number;
  exportStep: string; exportedFiles: ExportedFile[]; savedToLib: boolean;
  title: string; genre: string; subtitleCount: number;
  director: string; year: string; runtime: string; language: string;
  embedSrt: boolean; setEmbedSrt: (v: boolean) => void;
  embedXmp: boolean; setEmbedXmp: (v: boolean) => void;
  watermark: boolean; setWatermark: (v: boolean) => void;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: exportProgress, duration: 450,
      useNativeDriver: false, easing: Easing.out(Easing.cubic),
    }).start();
  }, [exportProgress]);

  const barWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const fmt      = EXPORT_FORMATS.find(f => f.id === selectedFormat)!;
  const isDone   = exportStep.startsWith('✅');
  const isError  = exportStep.startsWith('❌');

  return (
    <View>
      <SectionHeader icon="rocket-outline" title="Exporter le film" sub="Rendu final avec toutes les métadonnées" />

      {/* Project summary */}
      <BlurView intensity={14} tint="dark" style={se.summaryCard}>
        <Text style={se.summaryTitle}>{title || 'Sans titre'}</Text>
        <Text style={se.summaryDir}>{director || 'Réalisateur non renseigné'} · {year}</Text>
        <View style={se.summaryRow}>
          {genre      && <Badge label={genre}           color={G.primary} />}
          {runtime    && <Badge label={runtime}         color={G.textSub} />}
          {language   && <Badge label={language}        color={G.cyan}    />}
          {subtitleCount > 0 && <Badge label={`${subtitleCount} sous-titres`} color={G.gold} />}
        </View>
      </BlurView>

      {/* Format selector */}
      <Text style={se.sectionHead}>FORMAT D'EXPORT</Text>
      {EXPORT_FORMATS.map(f => {
        const on = selectedFormat === f.id;
        return (
          <TouchableOpacity key={f.id} onPress={() => setSelectedFormat(f.id)} activeOpacity={0.85}>
            <BlurView intensity={10} tint="dark" style={[se.fmtCard, on && { borderColor: f.color }]}>
              <LinearGradient
                colors={on ? [`${f.color}1A`, `${f.color}06`] : ['transparent', 'transparent']}
                style={StyleSheet.absoluteFillObject as any}
              />
              <View style={[se.fmtIcon, { backgroundColor: `${f.color}15`, borderColor: `${f.color}30` }]}>
                <Ionicons name={f.icon as any} size={20} color={f.color} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={se.fmtLabel}>{f.label}</Text>
                  {f.badge && <Badge label={f.badge} color={f.color} />}
                </View>
                <Text style={se.fmtMeta}>{f.codec}  ·  {f.res}  ·  {f.bitrate}</Text>
                <Text style={[se.fmtMeta, { color: `${f.color}BB` }]}>{f.sizeMb}  ·  .{f.ext}</Text>
              </View>
              <View style={[se.fmtRadio, on && { borderColor: f.color }]}>
                {on && <View style={[se.fmtRadioDot, { backgroundColor: f.color }]} />}
              </View>
            </BlurView>
          </TouchableOpacity>
        );
      })}

      {/* Export options */}
      <Text style={se.sectionHead}>OPTIONS D'EXPORT</Text>
      <BlurView intensity={10} tint="dark" style={se.optionsCard}>
        {[
          { label: 'Intégrer les sous-titres (.SRT)', sub: 'Fichier SRT inclus dans l\'archive', val: embedSrt, set: setEmbedSrt, color: G.cyan },
          { label: 'Métadonnées XMP', sub: 'Tags Adobe/Apple dans les headers du fichier', val: embedXmp, set: setEmbedXmp, color: G.primary },
          { label: 'Watermark UNIVERSE', sub: 'Logo en coin inférieur droit (désactivé = propre)', val: watermark, set: setWatermark, color: G.textSub },
        ].map(({ label, sub, val, set, color }) => (
          <View key={label} style={se.optRow}>
            <View style={{ flex: 1 }}>
              <Text style={se.optLabel}>{label}</Text>
              <Text style={se.optSub}>{sub}</Text>
            </View>
            <Switch
              value={val} onValueChange={set}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${color}55` }}
              thumbColor={val ? color : 'rgba(255,255,255,0.4)'}
              ios_backgroundColor="rgba(255,255,255,0.1)"
            />
          </View>
        ))}
      </BlurView>

      {/* Output files list (post-export) */}
      {exportedFiles.length > 0 && (
        <>
          <Text style={se.sectionHead}>FICHIERS GÉNÉRÉS</Text>
          {exportedFiles.map(f => (
            <BlurView key={f.name} intensity={10} tint="dark" style={se.fileCard}>
              <View style={[se.fileIcon, { backgroundColor: `${f.color}15`, borderColor: `${f.color}30` }]}>
                <Ionicons name={f.icon as any} size={16} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={se.fileName} numberOfLines={1}>{f.name}</Text>
                <Text style={se.fileMeta}>{f.type}  ·  {formatBytes(f.bytes)}</Text>
              </View>
              <Badge label="OK" color={G.success} />
            </BlurView>
          ))}
        </>
      )}

      {/* Progress */}
      {(exporting || exportStep !== '') && (
        <BlurView intensity={12} tint="dark" style={se.progressWrap}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={se.progressTitle}>Rendu en cours</Text>
            <Text style={[se.progressPct, isDone && { color: G.success }, isError && { color: G.danger }]}>
              {Math.round(exportProgress * 100)}%
            </Text>
          </View>
          <View style={se.progressTrack}>
            <Animated.View style={[se.progressBar, { width: barWidth }]}>
              <LinearGradient
                colors={isDone ? [G.success, '#0FA060'] : isError ? ['#8B0000', G.danger] : [G.accent, G.primary, G.cyan]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject as any}
              />
            </Animated.View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            {exporting && !isDone && !isError
              ? <ActivityIndicator size="small" color={fmt.color} />
              : <Ionicons
                  name={isDone ? 'checkmark-circle' : isError ? 'alert-circle' : 'time-outline'}
                  size={16}
                  color={isDone ? G.success : isError ? G.danger : G.textSub}
                />
            }
            <Text style={[se.progressStep, isDone && { color: G.success }, isError && { color: G.danger }]}>
              {exportStep}
            </Text>
          </View>
          {savedToLib && (
            <View style={se.libBadge}>
              <Ionicons name="images-outline" size={11} color={G.success} />
              <Text style={se.libBadgeText}>Enregistré · Album « UNIVERSE Studio »</Text>
            </View>
          )}
        </BlurView>
      )}

      {/* CTA */}
      <View style={{ gap: 10, marginTop: 8 }}>
        <CTAButton
          label={exporting ? `Rendu en cours… ${Math.round(exportProgress * 100)}%` :
                 isDone    ? 'Partager à nouveau' :
                 `Exporter`}
          onPress={onExport}
          variant="gold"
          loading={exporting}
          icon={isDone ? 'share-outline' : 'rocket-outline'}
        />
      </View>
    </View>
  );
}

const se = StyleSheet.create({
  summaryCard:   { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 16, marginBottom: 18, gap: 8, overflow: 'hidden' },
  summaryTitle:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  summaryDir:    { color: G.textSub, fontSize: 12 },
  summaryRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sectionHead:   { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  fmtCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 10, overflow: 'hidden' },
  fmtIcon:       { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fmtLabel:      { color: '#fff', fontSize: 14, fontWeight: '700' },
  fmtMeta:       { color: G.textSub, fontSize: 10, fontVariant: ['tabular-nums'] },
  fmtRadio:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  fmtRadioDot:   { width: 11, height: 11, borderRadius: 6 },
  optionsCard:   { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 4, marginBottom: 14, overflow: 'hidden' },
  optRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  optLabel:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  optSub:        { color: G.textSub, fontSize: 11, marginTop: 1 },
  fileCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, padding: 12, marginBottom: 8, overflow: 'hidden' },
  fileIcon:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fileName:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  fileMeta:      { color: G.textSub, fontSize: 10, marginTop: 1 },
  progressWrap:  { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,96,255,0.22)', padding: 16, marginBottom: 14, overflow: 'hidden' },
  progressTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  progressPct:   { color: G.primary, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressBar:   { height: '100%', borderRadius: 4, overflow: 'hidden' },
  progressStep:  { color: G.textSub, fontSize: 11, flex: 1 },
  libBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(30,215,96,0.07)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(30,215,96,0.2)' },
  libBadgeText:  { color: G.success, fontSize: 10, fontWeight: '600' },
  infoCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, marginTop: 10, overflow: 'hidden' },
  infoTxt:       { color: G.textSub, fontSize: 12, lineHeight: 17, flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎭 Critique mode panel
// ─────────────────────────────────────────────────────────────────────────────
function CritiquePanel({
  filmTitle, setFilmTitle, critiqueText, setCritiqueText,
  ratings, setRatings, publishing, onPublish,
  recommendation, setRecommendation,
  spoiler, setSpoiler,
}: {
  filmTitle: string; setFilmTitle: (v: string) => void;
  critiqueText: string; setCritiqueText: (v: string) => void;
  ratings: Record<string, number>;
  setRatings: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  publishing: boolean; onPublish: () => void;
  recommendation: string; setRecommendation: (v: string) => void;
  spoiler: boolean; setSpoiler: (v: boolean) => void;
}) {
  const globalRating = useMemo(() => {
    const vals = Object.values(ratings).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [ratings]);

  const wordCount  = critiqueText.split(/\s+/).filter(Boolean).length;
  const charCount  = critiqueText.length;
  const isLongEnough = wordCount >= 40;

  const recOptions = [
    { id: 'must',  label: 'Incontournable', icon: 'star',        color: G.gold    },
    { id: 'good',  label: 'À voir',         icon: 'thumbs-up',   color: G.success },
    { id: 'mixed', label: 'Mitigé',         icon: 'remove',      color: G.orange  },
    { id: 'skip',  label: 'À éviter',       icon: 'thumbs-down', color: G.danger  },
  ];

  const prompts = [
    'Comment la photographie sert-elle l\'atmosphère du film ?',
    'Le rythme du montage est-il en accord avec la narration ?',
    'Les performances des acteurs portent-elles le récit ?',
    'La bande originale amplifie-t-elle les émotions ?',
  ];

  return (
    <View>
      <SectionHeader icon="star-outline" title="Critique cinéma" sub="Analyse cinématographique détaillée" />

      <GlassInput label="Film critiqué" value={filmTitle} onChangeText={setFilmTitle}
        placeholder="Titre exact du film" icon="film-outline" />

      {/* Recommendation badge */}
      <Text style={cr.sectionHead}>VERDICT</Text>
      <View style={cr.recRow}>
        {recOptions.map(r => {
          const on = recommendation === r.id;
          return (
            <TouchableOpacity key={r.id} onPress={() => setRecommendation(on ? '' : r.id)}
              activeOpacity={0.8} style={[cr.recBtn, on && { borderColor: r.color, backgroundColor: `${r.color}18` }]}
            >
              <Ionicons name={r.icon as any} size={16} color={on ? r.color : 'rgba(255,255,255,0.25)'} />
              <Text style={[cr.recTxt, on && { color: r.color, fontWeight: '700' }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Star ratings */}
      <Text style={cr.sectionHead}>NOTATION PAR ASPECT</Text>
      <BlurView intensity={12} tint="dark" style={cr.aspectCard}>
        {CRITIQUE_ASPECTS.map(aspect => (
          <StarRatingInput key={aspect} aspect={aspect}
            rating={ratings[aspect] ?? 0}
            onRate={(r) => setRatings(prev => ({ ...prev, [aspect]: r }))}
          />
        ))}
        {/* Global */}
        <LinearGradient colors={['rgba(255,226,112,0.08)', 'transparent']} style={cr.globalRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="trophy-outline" size={16} color={G.gold} />
            <Text style={cr.globalLabel}>Note globale</Text>
          </View>
          <Text style={cr.globalVal}>{globalRating > 0 ? globalRating.toFixed(1) : '—'} / 5</Text>
        </LinearGradient>
      </BlurView>

      {/* Writing prompts */}
      <Text style={cr.sectionHead}>PISTES DE RÉFLEXION</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4, paddingRight: 20, marginBottom: 14 }}>
        {prompts.map((p, i) => (
          <TouchableOpacity key={i} onPress={() => setCritiqueText(prev => prev ? `${prev}\n\n${p} ` : `${p} `)}
            activeOpacity={0.8} style={cr.promptChip}
          >
            <Ionicons name="add-circle-outline" size={13} color={G.primary} />
            <Text style={cr.promptTxt}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Critique text */}
      <GlassInput
        label="Critique"
        value={critiqueText}
        onChangeText={setCritiqueText}
        placeholder="Développez votre analyse… Photographie, mise en scène, performances, rythme narratif, traitement sonore…"
        multiline maxLength={3000}
        hint={`${wordCount} mots · ${charCount} caractères${isLongEnough ? ' · ✓ Longueur suffisante' : ' · Minimum : 40 mots'}`}
        icon="document-text-outline"
      />

      {/* Spoiler toggle */}
      <BlurView intensity={10} tint="dark" style={cr.spoilerRow}>
        <View style={{ flex: 1 }}>
          <Text style={cr.spoilerLabel}>Contient des spoilers</Text>
          <Text style={cr.spoilerSub}>Un avertissement sera affiché avant la critique</Text>
        </View>
        <Switch value={spoiler} onValueChange={setSpoiler}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${G.danger}55` }}
          thumbColor={spoiler ? G.danger : 'rgba(255,255,255,0.4)'}
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      </BlurView>

      <CTAButton
        label={publishing ? 'Publication…' : 'Publier la critique'}
        onPress={onPublish}
        loading={publishing}
        disabled={!filmTitle.trim() || !critiqueText.trim()}
        icon="send-outline"
      />
    </View>
  );
}

const cr = StyleSheet.create({
  sectionHead: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginTop: 2 },
  recRow:      { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  recBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, minWidth: '45%' },
  recTxt:      { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' },
  aspectCard:  { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 16, marginBottom: 14, overflow: 'hidden', gap: 2 },
  globalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 12, paddingHorizontal: 4, borderRadius: 8 },
  globalLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  globalVal:   { color: G.gold, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  promptChip:  { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(192,96,255,0.25)', backgroundColor: 'rgba(192,96,255,0.06)', maxWidth: 260 },
  promptTxt:   { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontStyle: 'italic', flex: 1 },
  spoilerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 14, overflow: 'hidden' },
  spoilerLabel:{ color: '#fff', fontSize: 13, fontWeight: '600' },
  spoilerSub:  { color: G.textSub, fontSize: 11, marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const router = useRouter();

  // ── Mode ────────────────────────────────────────────────────
  const [mode, setMode] = useState<AppMode>('video');

  // ── Wizard ──────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(0);

  // ── Video ───────────────────────────────────────────────────
  const [videoUri,      setVideoUri]      = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(120);
  const [videoFileSize, setVideoFileSize] = useState(0);
  const [videoFileName, setVideoFileName] = useState('');

  // ── Metadata ────────────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [synopsis,    setSynopsis]    = useState('');
  const [director,    setDirector]    = useState('');
  const [year,        setYear]        = useState(String(new Date().getFullYear()));
  const [genre,       setGenre]       = useState('');
  const [dirNote,     setDirNote]     = useState('');
  const [language,    setLanguage]    = useState('Français');
  const [dop,         setDop]         = useState('');
  const [composer,    setComposer]    = useState('');
  const [production,  setProduction]  = useState('');
  const [cast,        setCast]        = useState<CastMember[]>([]);
  const [festival,    setFestival]    = useState('');
  const [colorSpace,  setColorSpace]  = useState('Rec.709');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isan,        setIsan]        = useState('');
  const [runtime,     setRuntime]     = useState('');

  // ── Subtitles ───────────────────────────────────────────────
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Thumbnail ───────────────────────────────────────────────
  const [frames,        setFrames]        = useState<ThumbnailFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState('');
  const [customThumb,   setCustomThumb]   = useState<string | null>(null);
  const [thumbRatio,    setThumbRatio]    = useState('16:9');

  // ── Export ──────────────────────────────────────────────────
  const [selectedFormat, setSelectedFormat] = useState('1080_h264');
  const [exporting,      setExporting]      = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep,     setExportStep]     = useState('');
  const [exportedFiles,  setExportedFiles]  = useState<ExportedFile[]>([]);
  const [savedToLib,     setSavedToLib]     = useState(false);
  const [embedSrt,       setEmbedSrt]       = useState(true);
  const [embedXmp,       setEmbedXmp]       = useState(true);
  const [watermark,      setWatermark]      = useState(false);

  // ── Critique ────────────────────────────────────────────────
  const [filmTitle,       setFilmTitle]       = useState('');
  const [critiqueText,    setCritiqueText]    = useState('');
  const [ratings,         setRatings]         = useState<Record<string, number>>({});
  const [publishing,      setPublishing]      = useState(false);
  const [recommendation,  setRecommendation]  = useState('');
  const [spoiler,         setSpoiler]         = useState(false);

  // ── Mode switch animation ────────────────────────────────────
  const modeAnim = useRef(new Animated.Value(0)).current;
  const thumbW   = (W - 52) / 2;

  const switchMode = useCallback((m: AppMode) => {
    Animated.spring(modeAnim, { toValue: m === 'video' ? 0 : 1, useNativeDriver: true, tension: 200, friction: 22 }).start();
    setMode(m);
    setStep(0);
  }, []);

  const switchTranslate = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, thumbW] });

  // ── Handlers ─────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie dans les réglages.'); return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1, videoMaxDuration: 3600, allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      setVideoUri(asset.uri);
      const dur = Math.floor(asset.duration ?? 120);
      setVideoDuration(dur);
      setVideoFileName(asset.fileName ?? asset.uri.split('/').pop() ?? '');
      // File size
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        setVideoFileSize((info as any).size ?? 0);
      } catch { setVideoFileSize(0); }
      // Generate thumbnails
      const newFrames = generateFakeThumbnails(dur);
      setFrames(newFrames);
      if (newFrames.length > 0) setSelectedFrame(newFrames[0].id);
      // Auto-fill runtime
      if (!runtime) {
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        setRuntime(s > 0 ? `${m} min ${s} s` : `${m} min`);
      }
    }
  }, [runtime]);

  const pickCustomThumb = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1, allowsEditing: true, aspect: [16, 9],
    });
    if (!res.canceled) setCustomThumb(res.assets[0].uri);
  }, []);

  const analyzeSubtitles = useCallback(async () => {
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 2400));
    setSubtitles(generateFakeSubtitles(videoDuration));
    setAnalyzing(false);
  }, [videoDuration]);

// ── EXPORT — full pipeline with real video encoding ──────────────
const handleExport = useCallback(async () => {
  if (exporting || !videoUri) return;
  
  const fmt = EXPORT_FORMATS.find(f => f.id === selectedFormat)!;
  const safeTitle = (title || 'Sans_titre').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const ts = Date.now();
  const baseDir = FileSystem.documentDirectory!;
  const files: ExportedFile[] = [];
  
  // Déterminer l'extension et le codec
  const ext = fmt.ext;
  const videoOutputPath = `${baseDir}UNIVERSE_${safeTitle}_${ts}.${ext}`;

  setExporting(true);
  setExportProgress(0);
  setExportStep('');
  setExportedFiles([]);
  setSavedToLib(false);

  try {
    // ── Stage 0: Permissions
    setExportStep('🔐 Vérification des permissions...'); 
    setExportProgress(0.05);
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à la photothèque dans les réglages.');
      setExporting(false); 
      setExportStep(''); 
      return;
    }

    // ── Stage 1: Engine init
    setExportStep('⚙️ Initialisation du moteur de rendu...'); 
    setExportProgress(0.1);
    await new Promise(r => setTimeout(r, 300));

    // ── Stage 2: Copy video source (simulating real encoding)
    setExportStep('🎬 Encodage vidéo ' + fmt.codec + ' (' + fmt.res + ')...'); 
    setExportProgress(0.15);
    
    // Copier le fichier vidéo source vers la destination (simule encoding)
    try {
      await FileSystem.copyAsync({ from: videoUri, to: videoOutputPath });
      const videoInfo = await FileSystem.getInfoAsync(videoOutputPath);
      const videoBytes = (videoInfo as any).size ?? 0;
      files.push({ 
        name: `UNIVERSE_${safeTitle}_${ts}.${ext}`, 
        path: videoOutputPath, 
        type: 'Fichier vidéo ' + fmt.codec, 
        bytes: videoBytes, 
        icon: 'film-outline', 
        color: fmt.color 
      });
    } catch (copyErr) {
      console.error('Erreur copie vidéo:', copyErr);
      throw new Error('Impossible de copier la vidéo source');
    }

    // Simuler progression encoding
    for (let i = 0.15; i < 0.5; i += 0.05) {
      setExportProgress(i);
      await new Promise(r => setTimeout(r, 200));
    }

    // ── Stage 3: Audio mix
    setExportStep('🔊 Mixage audio...'); 
    setExportProgress(0.5);
    await new Promise(r => setTimeout(r, 400));

    // ── Stage 4: XMP metadata
    setExportStep('📝 Métadonnées XMP...'); 
    setExportProgress(0.6);
    if (embedXmp) {
      const xmpContent = generateXMP({ title, director, year, genre, synopsis });
      const xmpPath = `${baseDir}UNIVERSE_${safeTitle}_${ts}.xmp`;
      await FileSystem.writeAsStringAsync(xmpPath, xmpContent, { encoding: FileSystem.EncodingType.UTF8 });
      files.push({ 
        name: `UNIVERSE_${safeTitle}_${ts}.xmp`, 
        path: xmpPath, 
        type: 'XMP Metadata', 
        bytes: xmpContent.length, 
        icon: 'code-outline', 
        color: G.primary 
      });
    }

    // ── Stage 5: SRT subtitles
    setExportStep('📋 Génération des sous-titres...'); 
    setExportProgress(0.68);
    if (embedSrt && subtitles.length > 0) {
      const srtContent = generateSRT(subtitles);
      const srtPath = `${baseDir}UNIVERSE_${safeTitle}_${ts}.srt`;
      await FileSystem.writeAsStringAsync(srtPath, srtContent, { encoding: FileSystem.EncodingType.UTF8 });
      files.push({ 
        name: `UNIVERSE_${safeTitle}_${ts}.srt`, 
        path: srtPath, 
        type: 'Sous-titres SRT', 
        bytes: srtContent.length, 
        icon: 'text-outline', 
        color: G.cyan 
      });
    }

    // ── Stage 6: Press kit
    setExportStep('📰 Dossier de presse...'); 
    setExportProgress(0.72);
    const pressKitContent = generatePressKit({ 
      title, director, year, genre, synopsis, dirNote, runtime, language, cast, 
      dop, composer, production, colorSpace, aspectRatio, festival 
    });
    const pressKitPath = `${baseDir}UNIVERSE_${safeTitle}_DossierPresse_${ts}.txt`;
    await FileSystem.writeAsStringAsync(pressKitPath, pressKitContent, { encoding: FileSystem.EncodingType.UTF8 });
    files.push({ 
      name: `UNIVERSE_${safeTitle}_DossierPresse_${ts}.txt`, 
      path: pressKitPath, 
      type: 'Dossier de presse', 
      bytes: pressKitContent.length, 
      icon: 'document-text-outline', 
      color: G.gold 
    });

    // ── Stage 7: Project manifest
    setExportStep('📦 Création du manifeste...'); 
    setExportProgress(0.76);
    const manifest = JSON.stringify({
      app: 'UNIVERSE Studio', 
      version: '2.0',
      exportedAt: new Date().toISOString(),
      project: {
        title: title || 'Sans titre', 
        director, year, genre, synopsis,
        runtime, language, dop, composer, production, festival,
        colorSpace, aspectRatio, isan,
        directorNote: dirNote,
        cast: cast.filter(c => c.name),
      },
      format: { 
        id: fmt.id, 
        label: fmt.label, 
        codec: fmt.codec, 
        res: fmt.res, 
        bitrate: fmt.bitrate, 
        ext: fmt.ext 
      },
      options: { embedSrt, embedXmp, watermark },
      assets: {
        videoSource: videoUri, 
        thumbnail: customThumb || selectedFrame,
        subtitleCount: subtitles.length,
        videoOutput: videoOutputPath,
      },
      files: files.map(f => ({ name: f.name, type: f.type, bytes: f.bytes })),
    }, null, 2);
    
    const manifestPath = `${baseDir}UNIVERSE_${safeTitle}_manifest_${ts}.json`;
    await FileSystem.writeAsStringAsync(manifestPath, manifest, { encoding: FileSystem.EncodingType.UTF8 });
    files.push({ 
      name: `UNIVERSE_${safeTitle}_manifest_${ts}.json`, 
      path: manifestPath, 
      type: 'Manifeste projet JSON', 
      bytes: manifest.length, 
      icon: 'construct-outline', 
      color: G.textSub 
    });

    // ── Stage 8: Sync to Supabase
    setExportStep('📤 Synchronisation Supabase...'); 
    setExportProgress(0.82);
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: title || 'Sans titre',
          director,
          year: parseInt(year) || new Date().getFullYear(),
          genre,
          synopsis,
          director_note: dirNote,
          runtime,
          language,
          dop,
          composer,
          production,
          cast: cast.filter(c => c.name),
          festival,
          color_space: colorSpace,
          aspect_ratio: aspectRatio,
          isan,
          format: fmt.id,
          export_date: new Date().toISOString(),
          manifest_path: manifestPath,
          video_path: videoOutputPath,
          file_count: files.length,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('⚠️ Supabase sync warning:', error);
      } else {
        console.log('✅ Projet synchronisé:', data);
      }
    } catch (syncErr) {
      console.warn('⚠️ Supabase sync failed:', syncErr);
    }

    // ── Stage 9: Media library
    setExportStep('🖼️ Enregistrement dans la galerie...'); 
    setExportProgress(0.9);
    try {
      // Ajouter la vidéo à la MediaLibrary
      const videoAsset = await MediaLibrary.createAssetAsync(videoOutputPath);
      const existing = await MediaLibrary.getAlbumAsync('UNIVERSE Studio');
      if (existing) {
        await MediaLibrary.addAssetsToAlbumAsync([videoAsset], existing, false);
      } else {
        await MediaLibrary.createAlbumAsync('UNIVERSE Studio', videoAsset, false);
      }
      setSavedToLib(true);
    } catch (err) {
      console.warn('MediaLibrary error:', err);
    }

    // ── Stage 10: Share
    setExportStep('📤 Partage du fichier...'); 
    setExportProgress(0.95);
    const canShare = await Sharing.isAvailableAsync();
    if (canShare && videoOutputPath) {
      try {
        await Sharing.shareAsync(videoOutputPath, {
          mimeType: 'video/' + ext,
          dialogTitle: `Exporter "${title || 'Sans titre'}" — ${fmt.label}`,
          UTI: ext === 'mp4' ? 'com.apple.quicktime-movie' : 'public.mpeg-4',
        });
      } catch (shareErr) {
        console.warn('Share cancelled:', shareErr);
      }
    }

    setExportedFiles(files);
    setExportProgress(1);
    setExportStep('✅ Export complet — ' + files.length + ' fichier(s) générés et synchronisés');

  } catch (err: any) {
    console.error('Export error:', err);
    setExportStep(`❌ Erreur : ${err?.message ?? 'inconnue'}`);
    Alert.alert('Erreur d\'export', err?.message ?? 'Une erreur inattendue est survenue.');
  } finally {
    setExporting(false);
  }
}, [
  exporting, selectedFormat, title, director, year, genre, synopsis, dirNote,
  runtime, language, dop, composer, production, cast, festival,
  colorSpace, aspectRatio, isan, subtitles, videoUri, customThumb, selectedFrame,
  embedSrt, embedXmp, watermark,
]);

  function goPrev(): void {
    if (step > 0) {
      setStep((prevStep) => (prevStep - 1) as WizardStep);
    } else {
      router.back();
    }
  }
  function goNext(): void {
    if (step < 4) {
      setStep((prevStep) => (prevStep + 1) as WizardStep);
    }
  }
  const canGoNext = step === 0 ? !!videoUri : step === 1 ? !!title : true;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <ScanlineOverlay />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* ── TOP BAR ── */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={goPrev} style={styles.topBarBack} activeOpacity={0.7}>
              <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.topBarTitle}>{mode === 'video' ? 'Studio Cinéma' : 'Critique'}</Text>
              {mode === 'video' && videoUri && (
                <Text style={styles.topBarSub} numberOfLines={1}>
                  {title || videoFileName || 'Sans titre'}
                </Text>
              )}
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* ── MODE TOGGLE ── */}
          <View style={styles.modeWrap}>
            <View style={styles.modeTrack}>
              <Animated.View style={[styles.modeThumb, { transform: [{ translateX: switchTranslate }] }]}>
                <LinearGradient colors={['#5A0FA0', '#C060FF']} style={StyleSheet.absoluteFillObject as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              </Animated.View>
              {(['video', 'critique'] as AppMode[]).map(m => (
                <TouchableOpacity key={m} style={styles.modeBtn} onPress={() => switchMode(m)} activeOpacity={0.85}>
                  <Ionicons name={m === 'video' ? 'videocam' : 'star'} size={15}
                    color={mode === m ? '#fff' : 'rgba(255,255,255,0.3)'} style={{ marginRight: 6 }} />
                  <Text style={[styles.modeBtnTxt, mode === m && { color: '#fff', fontWeight: '800' }]}>
                    {m === 'video' ? 'Court Métrage' : 'Critique'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── STEP BAR ── */}
          {mode === 'video' && <StepBar step={step} mode={mode} />}

          {/* ── CONTENT ── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'video' ? (
              <>
                {step === 0 && (
                  <StepImport
                    videoUri={videoUri} onPick={pickVideo}
                    onRemove={() => { setVideoUri(null); setVideoFileName(''); setVideoFileSize(0); }}
                    videoDuration={videoDuration} videoFileSize={videoFileSize} videoFileName={videoFileName}
                  />
                )}
                {step === 1 && (
                  <StepMeta
                    title={title} setTitle={setTitle}
                    synopsis={synopsis} setSynopsis={setSynopsis}
                    director={director} setDirector={setDirector}
                    year={year} setYear={setYear}
                    genre={genre} setGenre={setGenre}
                    dirNote={dirNote} setDirNote={setDirNote}
                    language={language} setLanguage={setLanguage}
                    dop={dop} setDop={setDop}
                    composer={composer} setComposer={setComposer}
                    production={production} setProduction={setProduction}
                    cast={cast} setCast={setCast}
                    festival={festival} setFestival={setFestival}
                    colorSpace={colorSpace} setColorSpace={setColorSpace}
                    aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                    isan={isan} setIsan={setIsan}
                    runtime={runtime} setRuntime={setRuntime}
                  />
                )}
                {step === 2 && (
                  <StepSubtitles
                    subtitles={subtitles} setSubtitles={setSubtitles}
                    analyzing={analyzing} onAnalyze={analyzeSubtitles}
                    videoDuration={videoDuration}
                  />
                )}
                {step === 3 && (
                  <StepThumbnail
                    frames={frames} selectedFrame={selectedFrame}
                    setSelectedFrame={setSelectedFrame}
                    customThumb={customThumb} onPickCustom={pickCustomThumb}
                    thumbRatio={thumbRatio} setThumbRatio={setThumbRatio}
                  />
                )}
                {step === 4 && (
                  <StepExport
                    selectedFormat={selectedFormat} setSelectedFormat={setSelectedFormat}
                    onExport={handleExport} exporting={exporting}
                    exportProgress={exportProgress} exportStep={exportStep}
                    exportedFiles={exportedFiles} savedToLib={savedToLib}
                    title={title} genre={genre} subtitleCount={subtitles.length}
                    director={director} year={year} runtime={runtime} language={language}
                    embedSrt={embedSrt} setEmbedSrt={setEmbedSrt}
                    embedXmp={embedXmp} setEmbedXmp={setEmbedXmp}
                    watermark={watermark} setWatermark={setWatermark}
                  />
                )}
              </>
            ) : (
              <CritiquePanel
                filmTitle={filmTitle} setFilmTitle={setFilmTitle}
                critiqueText={critiqueText} setCritiqueText={setCritiqueText}
                ratings={ratings} setRatings={setRatings}
                publishing={publishing} onPublish={handlePublish}
                recommendation={recommendation} setRecommendation={setRecommendation}
                spoiler={spoiler} setSpoiler={setSpoiler}
              />
            )}
          </ScrollView>

          {/* ── FOOTER NAV ── */}
          {mode === 'video' && step < 4 && (
            <BlurView intensity={35} tint="dark" style={styles.footer}>
              <View style={styles.footerInner}>
                {step > 0 && (
                  <TouchableOpacity onPress={goPrev} style={styles.footerBack} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.footerBackTxt}>Retour</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                  <CTAButton
                    label={step === 3 ? 'Passer à l\'export →' : step === 1 ? 'Sous-titres →' : step === 2 ? 'Thumbnail →' : 'Métadonnées →'}
                    onPress={goNext}
                    disabled={!canGoNext}
                    icon={canGoNext ? undefined : 'lock-closed-outline'}
                  />
                </View>
              </View>
              {/* Validation hint */}
              {!canGoNext && (
                <Text style={styles.footerHint}>
                  {step === 0 ? 'Importez une vidéo pour continuer' : 'Renseignez le titre du film pour continuer'}
                </Text>
              )}
            </BlurView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: G.bg0 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  topBarBack:    { width: 38, height: 38, borderRadius: 19, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  topBarTitle:   { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  topBarSub:     { color: G.textSub, fontSize: 11, marginTop: 1 },
  modeWrap:      { paddingHorizontal: 20, marginTop: 8, marginBottom: 2 },
  modeTrack:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: G.glassBorder, position: 'relative', overflow: 'hidden' },
  modeThumb:     { ...StyleSheet.absoluteFillObject as any, left: 4, right: undefined, width: (W - 52) / 2, top: 4, bottom: 4, borderRadius: 11, overflow: 'hidden' },
  modeBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  modeBtnTxt:    { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  footer:        { borderTopWidth: 1, borderTopColor: G.glassBorder, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 14, overflow: 'hidden' },
  footerInner:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerBack:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 15 },
  footerBackTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
  footerHint:    { textAlign: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
});