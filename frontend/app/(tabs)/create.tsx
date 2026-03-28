
import React, {
    useState, useRef, useEffect, useCallback, useMemo, memo,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, Animated, Easing, Dimensions, Platform,
    Modal, Pressable, Image, ActivityIndicator, FlatList,
    KeyboardAvoidingView, Alert,
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
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🌌 PALETTE GALAXY (identique search.tsx)
  // ─────────────────────────────────────────────────────────────────────────────
  const G = {
    bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
    neb0: 'rgba(108,16,195,0.32)', neb1: 'rgba(172,24,160,0.20)',
    sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
    glass: 'rgba(255,255,255,0.056)',
    glassBorder: 'rgba(255,255,255,0.09)',
    primary: '#C060FF',
    pinkBadge: '#E91E63',
    purpleBadge: '#6A1B9A',
    accent: '#A855F7',
    textSub: '#BCB8C2',
    gold: '#FFE270',
    cyan: '#86EEFF',
    danger: '#FF4D6A',
    success: '#1ED760',
  };
  
  const { width: W, height: H } = Dimensions.get('window');
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🌟 GALAXY ANIMATION ENGINE (Portage Intégral depuis search.tsx)
  // ─────────────────────────────────────────────────────────────────────────────
  const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  interface StarPt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
  interface MeteorT { id: number; sx: number; sy: number; ang: number; len: number; }
  
  const STARS: StarPt[] = Array.from({ length: 55 }, (_, i) => ({
    id: i, x: rnd(0, W), y: rnd(0, H * 1.5), sz: rnd(1.0, 2.3),
    col: pick([G.sW, G.sB, G.sP, G.sG]),
    del: rnd(0, 4200), dur: rnd(2000, 5000), mn: 0.25, mx: 0.95,
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
    const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 200] });
    const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 200] });
    return (
      <Animated.View style={{
        position: 'absolute', left: m.sx, top: m.sy,
        opacity: op,
        transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
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
    const [meteors, setMeteors] = useState<MeteorT[]>([]);
    useEffect(() => {
      const i = setInterval(() => {
        if (Math.random() > 0.7)
          setMeteors(prev => [...prev, {
            id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.4),
            ang: rnd(20, 50), len: rnd(80, 150),
          }]);
      }, 2000);
      return () => clearInterval(i);
    }, []);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
        {/* Nebula glows */}
        <View style={nb.neb1} />
        <View style={nb.neb2} />
        {STARS.map(s => <StarDot key={s.id} p={s} />)}
        {meteors.map(m => (
          <ShootingStar key={m.id} m={m}
            onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))} />
        ))}
      </View>
    );
  });
  GalaxyBackground.displayName = 'GalaxyBackground';
  
  const nb = StyleSheet.create({
    neb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: G.neb0, top: -80, right: -80, opacity: 0.5 },
    neb2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: G.neb1, bottom: 200, left: -100, opacity: 0.4 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 📐 TYPES
  // ─────────────────────────────────────────────────────────────────────────────
  type AppMode   = 'video' | 'critique';
  type WizardStep = 0 | 1 | 2 | 3 | 4; // Import → Méta → Sous-titres → Thumbnail → Export
  
  interface SubtitleTrack {
    id: string;
    startMs: number;
    endMs:   number;
    text:    string;
    edited:  boolean;
  }
  
  interface ExportFormat {
    id:       string;
    label:    string;
    codec:    string;
    res:      string;
    bitrate:  string;
    ext:      string;
    icon:     string;
    badge?:   string;
    color:    string;
  }
  
  interface ThumbnailFrame {
    id:   string;
    uri:  string; // simulated
    time: number; // seconds
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 📦 CONSTANTS
  // ─────────────────────────────────────────────────────────────────────────────
  const WIZARD_STEPS = ['Import', 'Métadonnées', 'Sous-titres', 'Thumbnail', 'Export'] as const;
  
  const GENRES_CINEMA = [
    'Drame', 'Thriller', 'Documentaire', 'Expérimental', 'Animation',
    'Horreur', 'Comédie', 'Sci-Fi', 'Néo-Noir', 'Essai visuel',
  ] as const;
  
  const EXPORT_FORMATS: ExportFormat[] = [
    { id: '4k_prores',  label: '4K ProRes 422',  codec: 'ProRes 422 HQ', res: '3840×2160', bitrate: '707 Mb/s', ext: 'mov', icon: 'diamond',      badge: 'FESTIVAL',   color: G.gold },
    { id: '1080_h264',  label: '1080p H.264',    codec: 'H.264 / AAC',  res: '1920×1080', bitrate: '16 Mb/s',  ext: 'mp4', icon: 'film',          badge: 'STANDARD',   color: G.primary },
    { id: '1080_h265',  label: '1080p H.265',    codec: 'HEVC / AAC',   res: '1920×1080', bitrate: '8 Mb/s',   ext: 'mp4', icon: 'cube',          badge: 'COMPACT',    color: G.cyan },
    { id: '720_web',    label: 'Web 720p',       codec: 'VP9 / Opus',   res: '1280×720',  bitrate: '4 Mb/s',   ext: 'webm', icon: 'globe-outline', badge: 'WEB',        color: G.textSub },
  ];
  
  const CRITIQUE_ASPECTS = ['Scénario', 'Photographie', 'Jeu d\'acteur', 'BO / Son', 'Montage'] as const;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🔧 HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  function msToTimecode(ms: number): string {
    const s  = Math.floor(ms / 1000);
    const m  = Math.floor(s / 60);
    const ss = (s % 60).toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ms2= (ms % 1000).toString().padStart(3, '0').slice(0, 2);
    return `${mm}:${ss}.${ms2}`;
  }
  
  function generateFakeSubtitles(durationSec: number): SubtitleTrack[] {
    const lines = [
      'Un plan fixe.', 'La lumière décline lentement.', 'On entend des pas au loin.',
      'Elle s\'arrête. Hésite.', '— Tu crois que ça change quelque chose ?',
      'Le silence répond pour lui.', 'Fondu au noir.', '[ Musique : cordes — pianissimo ]',
      'Extérieur nuit — rue déserte.', 'Un néon clignote, rouge sang.',
      'Il ramasse la lettre. La repose.', '— Rien n\'est perdu.', '— Tout est perdu.',
      'Contre-plongée sur le ciel vide.', 'FIN',
    ];
    const tracks: SubtitleTrack[] = [];
    let cursor = 2000;
    let idx = 0;
    while (cursor < durationSec * 1000 - 3000 && idx < lines.length) {
      const dur = 1800 + Math.random() * 2200;
      tracks.push({
        id: `sub_${idx}`, startMs: cursor, endMs: cursor + dur,
        text: lines[idx], edited: false,
      });
      cursor += dur + 400 + Math.random() * 1200;
      idx++;
    }
    return tracks;
  }
  
  function generateFakeThumbnails(durationSec: number): ThumbnailFrame[] {
    const count = Math.min(8, Math.max(3, Math.floor(durationSec / 12)));
    return Array.from({ length: count }, (_, i) => ({
      id: `frame_${i}`,
      uri: `https://picsum.photos/seed/frame${i + Math.floor(Math.random() * 100)}/320/180`,
      time: Math.floor((durationSec / count) * i) + Math.floor(Math.random() * 5),
    }));
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
          const active  = i === step;
          const done    = i < step;
          return (
            <React.Fragment key={label}>
              <View style={sb.item}>
                <View style={[sb.dot, done && sb.dotDone, active && sb.dotActive]}>
                  {done
                    ? <Ionicons name="checkmark" size={10} color="#fff" />
                    : <Text style={sb.dotNum}>{i + 1}</Text>
                  }
                </View>
                <Text style={[sb.label, (active || done) && sb.labelOn]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              {i < steps.length - 1 && (
                <View style={[sb.line, done && sb.lineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  });
  StepBar.displayName = 'StepBar';
  
  const sb = StyleSheet.create({
    wrap:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 18 },
    item:     { alignItems: 'center', gap: 4, minWidth: 52 },
    dot:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
    dotActive:{ borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.2)' },
    dotDone:  { borderColor: G.success, backgroundColor: G.success },
    dotNum:   { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800' },
    label:    { color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
    labelOn:  { color: 'rgba(255,255,255,0.75)' },
    line:     { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
    lineDone: { backgroundColor: G.success },
  });
  
  /** Glass input */
  const GlassInput = memo(({
    label, value, onChangeText, placeholder, multiline, maxLength, keyboardType, hint,
  }: {
    label: string; value: string; onChangeText: (t: string) => void;
    placeholder?: string; multiline?: boolean; maxLength?: number;
    keyboardType?: any; hint?: string;
  }) => (
    <View style={gi.wrap}>
      <View style={gi.labelRow}>
        <Text style={gi.label}>{label}</Text>
        {maxLength && <Text style={gi.counter}>{value.length}/{maxLength}</Text>}
      </View>
      <BlurView intensity={18} tint="dark" style={[gi.input, multiline && { height: 110, alignItems: 'flex-start' }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.2)"
          style={[gi.txt, multiline && { textAlignVertical: 'top' }]}
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType}
          numberOfLines={multiline ? 5 : 1}
        />
      </BlurView>
      {hint && <Text style={gi.hint}>{hint}</Text>}
    </View>
  ));
  GlassInput.displayName = 'GlassInput';
  
  const gi = StyleSheet.create({
    wrap:     { marginBottom: 16 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
    label:    { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
    counter:  { color: 'rgba(255,255,255,0.25)', fontSize: 10 },
    input:    { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, paddingHorizontal: 15, paddingVertical: 13, overflow: 'hidden' },
    txt:      { color: '#fff', fontSize: 14, lineHeight: 20 },
    hint:     { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 5, fontStyle: 'italic' },
  });
  
  /** Genre chip picker */
  const GenrePicker = memo(({ selected, onSelect }: { selected: string; onSelect: (g: string) => void }) => (
    <View style={gp.wrap}>
      <Text style={gp.label}>GENRE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={gp.scroll}>
        {GENRES_CINEMA.map(g => {
          const on = selected === g;
          return (
            <TouchableOpacity key={g} style={[gp.chip, on && gp.chipOn]} onPress={() => onSelect(g)} activeOpacity={0.75}>
              {on
                ? <LinearGradient colors={['#7B2FBE', '#C060FF']} style={gp.chipGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={gp.txtOn}>{g}</Text>
                  </LinearGradient>
                : <Text style={gp.txt}>{g}</Text>
              }
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  ));
  GenrePicker.displayName = 'GenrePicker';
  
  const gp = StyleSheet.create({
    wrap:    { marginBottom: 16 },
    label:   { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 9 },
    scroll:  { gap: 8, paddingRight: 20 },
    chip:    { borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 9 },
    chipOn:  { borderColor: G.primary, padding: 0 },
    chipGrad:{ paddingHorizontal: 16, paddingVertical: 9 },
    txt:     { color: G.textSub, fontSize: 13, fontWeight: '500' },
    txtOn:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  });
  
  /** Star rating (critique mode) */
  const StarRatingInput = memo(({ aspect, rating, onRate }: { aspect: string; rating: number; onRate: (r: number) => void }) => (
    <View style={sr.row}>
      <Text style={sr.aspect}>{aspect}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <TouchableOpacity key={s} onPress={() => onRate(s)} activeOpacity={0.7}>
            <Ionicons
              name={s <= rating ? 'star' : 'star-outline'}
              size={22}
              color={s <= rating ? G.gold : 'rgba(255,255,255,0.2)'}
            />
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
    label, onPress, disabled, loading, variant = 'primary', icon,
  }: {
    label: string; onPress: () => void; disabled?: boolean;
    loading?: boolean; variant?: 'primary' | 'ghost' | 'danger' | 'gold';
    icon?: string;
  }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
    const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();
  
    const colors: Record<string, [string, string]> = {
      primary: ['#7B2FBE', '#C060FF'],
      gold:    ['#B8860B', '#FFE270'],
      danger:  ['#8B0000', '#FF4D6A'],
      ghost:   ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)'],
    };
  
    return (
      <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}>
        <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} disabled={disabled || loading} activeOpacity={1}>
          <LinearGradient
            colors={colors[variant]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[btn.base, variant === 'ghost' && btn.ghostBorder]}
          >
            {loading
              ? <ActivityIndicator color={variant === 'gold' ? '#000' : '#fff'} size="small" />
              : <>
                  {icon && <Ionicons name={icon as any} size={18} color={variant === 'gold' ? '#000' : '#fff'} style={{ marginRight: 8 }} />}
                  <Text style={[btn.label, variant === 'gold' && { color: '#000' }]}>{label}</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  CTAButton.displayName = 'CTAButton';
  
  const btn = StyleSheet.create({
    base:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 24, borderRadius: 16 },
    ghostBorder: { borderWidth: 1, borderColor: G.glassBorder },
    label:       { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  });
  
  /** Section header */
  const SectionHeader = ({ icon, title, sub }: { icon: string; title: string; sub?: string }) => (
    <View style={sh.wrap}>
      <View style={sh.iconCircle}>
        <Ionicons name={icon as any} size={18} color={G.primary} />
      </View>
      <View>
        <Text style={sh.title}>{title}</Text>
        {sub && <Text style={sh.sub}>{sub}</Text>}
      </View>
    </View>
  );
  
  const sh = StyleSheet.create({
    wrap:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(192,96,255,0.15)', borderWidth: 1, borderColor: 'rgba(192,96,255,0.3)', alignItems: 'center', justifyContent: 'center' },
    title:      { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    sub:        { color: G.textSub, fontSize: 12, marginTop: 1 },
  });
  
  /** Scanline overlay for retro-futuristic texture */
  const ScanlineOverlay = memo(() => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 30 }, (_, i) => (
        <View key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: i * (H / 30), height: 1,
          backgroundColor: 'rgba(192,96,255,0.018)',
        }} />
      ))}
    </View>
  ));
  ScanlineOverlay.displayName = 'ScanlineOverlay';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🎬 STEP PANELS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** STEP 0 — Import vidéo */
  function StepImport({
    videoUri, onPick, onRemove, videoDuration,
  }: {
    videoUri: string | null;
    onPick: () => void;
    onRemove: () => void;
    videoDuration: number;
  }) {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])).start();
    }, []);
  
    return (
      <View style={{ gap: 16 }}>
        <SectionHeader icon="cloud-upload-outline" title="Importer la vidéo" sub="Formats acceptés : MOV · MP4 · MXF · ProRes" />
  
        <TouchableOpacity onPress={videoUri ? undefined : onPick} activeOpacity={videoUri ? 1 : 0.85}>
          <BlurView intensity={12} tint="dark" style={si.dropzone}>
            {videoUri ? (
              <>
                <Video
                  source={{ uri: videoUri }}
                  style={si.videoPreview}
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  shouldPlay={false}
                  isMuted
                />
                <LinearGradient colors={['transparent', 'rgba(6,0,16,0.9)']} style={si.videoOverlay} />
                <View style={si.videoMeta}>
                  <View style={si.videoMetaRow}>
                    <Ionicons name="film-outline" size={14} color={G.primary} />
                    <Text style={si.videoMetaText}>Vidéo chargée</Text>
                    <View style={si.durationChip}>
                      <Text style={si.durationText}>{msToTimecode(videoDuration * 1000)}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={si.removeBtn} onPress={onRemove}>
                  <Ionicons name="close-circle" size={26} color={G.danger} />
                </TouchableOpacity>
                {/* Waveform decoration */}
                <View style={si.waveRow}>
                  {Array.from({ length: 32 }, (_, i) => (
                    <View key={i} style={[si.waveBar, { height: 4 + Math.sin(i * 0.8) * 12 + Math.random() * 6 }]} />
                  ))}
                </View>
              </>
            ) : (
              <Animated.View style={[si.emptyContent, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={['rgba(192,96,255,0.12)', 'rgba(108,16,195,0.2)']} style={si.uploadCircle}>
                  <Ionicons name="film" size={38} color={G.primary} />
                </LinearGradient>
                <Text style={si.uploadTitle}>Déposer ou sélectionner</Text>
                <Text style={si.uploadSub}>Jusqu'à 4K · 10 Go max</Text>
                <View style={si.formatRow}>
                  {['MOV', 'MP4', 'ProRes', 'MXF'].map(f => (
                    <View key={f} style={si.formatTag}>
                      <Text style={si.formatTagText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </BlurView>
        </TouchableOpacity>
  
        {!videoUri && (
          <CTAButton label="Choisir depuis la galerie" onPress={onPick} icon="images-outline" />
        )}
  
        {/* Spec grid */}
        <View style={si.specGrid}>
          {[
            { icon: 'resize', label: 'Résolution', val: 'jusqu\'à 4K UHD' },
            { icon: 'timer-outline', label: 'Durée max', val: '60 minutes' },
            { icon: 'musical-notes', label: 'Audio', val: 'PCM / AAC / MP3' },
            { icon: 'color-wand', label: 'Color space', val: 'Rec.709 / P3' },
          ].map(sp => (
            <BlurView key={sp.label} intensity={10} tint="dark" style={si.specCard}>
              <Ionicons name={sp.icon as any} size={16} color={G.primary} />
              <Text style={si.specLabel}>{sp.label}</Text>
              <Text style={si.specVal}>{sp.val}</Text>
            </BlurView>
          ))}
        </View>
      </View>
    );
  }
  
  const si = StyleSheet.create({
    dropzone:      { height: 240, borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    videoPreview:  { ...StyleSheet.absoluteFillObject as any },
    videoOverlay:  { ...StyleSheet.absoluteFillObject as any },
    videoMeta:     { position: 'absolute', bottom: 36, left: 14 },
    videoMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    videoMetaText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    durationChip:  { backgroundColor: 'rgba(192,96,255,0.3)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: G.primary },
    durationText:  { color: G.primary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
    removeBtn:     { position: 'absolute', top: 10, right: 10 },
    waveRow:       { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', height: 28, paddingHorizontal: 8, gap: 2, opacity: 0.4 },
    waveBar:       { flex: 1, backgroundColor: G.primary, borderRadius: 2 },
    emptyContent:  { alignItems: 'center', gap: 12 },
    uploadCircle:  { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.25)' },
    uploadTitle:   { color: '#fff', fontSize: 15, fontWeight: '700' },
    uploadSub:     { color: G.textSub, fontSize: 12 },
    formatRow:     { flexDirection: 'row', gap: 8 },
    formatTag:     { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: G.glassBorder },
    formatTagText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    specGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    specCard:      { width: (W - 52) / 2, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 14, gap: 5, overflow: 'hidden' },
    specLabel:     { color: G.textSub, fontSize: 10, fontWeight: '600', marginTop: 2 },
    specVal:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  });
  
  /** STEP 1 — Métadonnées */
  function StepMeta({
    title, setTitle, synopsis, setSynopsis,
    director, setDirector, year, setYear,
    genre, setGenre, dirNote, setDirNote,
  }: {
    title: string; setTitle: (v: string) => void;
    synopsis: string; setSynopsis: (v: string) => void;
    director: string; setDirector: (v: string) => void;
    year: string; setYear: (v: string) => void;
    genre: string; setGenre: (v: string) => void;
    dirNote: string; setDirNote: (v: string) => void;
  }) {
    return (
      <View>
        <SectionHeader icon="create-outline" title="Métadonnées du film" sub="Informations affichées aux spectateurs" />
        <GlassInput label="Titre du film" value={title} onChangeText={setTitle} placeholder="Ex : La Chambre Inversée" maxLength={80} />
        <GlassInput label="Synopsis" value={synopsis} onChangeText={setSynopsis} placeholder="En quelques lignes, décrivez votre œuvre…" multiline maxLength={600} />
        <GlassInput label="Réalisateur·rice" value={director} onChangeText={setDirector} placeholder="Prénom Nom" />
        <GlassInput label="Année de production" value={year} onChangeText={setYear} keyboardType="numeric" placeholder={String(new Date().getFullYear())} />
        <GenrePicker selected={genre} onSelect={setGenre} />
        <GlassInput label="Note du réalisateur" value={dirNote} onChangeText={setDirNote} placeholder="Ce que vous voulez que le public retienne…" multiline maxLength={400} hint="Optionnel — sera affiché dans le dossier de presse" />
      </View>
    );
  }
  
  /** STEP 2 — Sous-titres */
  function StepSubtitles({
    subtitles, setSubtitles, analyzing, onAnalyze, videoDuration,
  }: {
    subtitles: SubtitleTrack[]; setSubtitles: React.Dispatch<React.SetStateAction<SubtitleTrack[]>>;
    analyzing: boolean; onAnalyze: () => void; videoDuration: number;
  }) {
    const [editId, setEditId] = useState<string | null>(null);
  
    const updateText = useCallback((id: string, text: string) => {
      setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text, edited: true } : s));
    }, [setSubtitles]);
  
    const deleteTrack = useCallback((id: string) => {
      setSubtitles(prev => prev.filter(s => s.id !== id));
    }, [setSubtitles]);
  
    const addTrack = useCallback(() => {
      const lastEnd = subtitles.length > 0 ? subtitles[subtitles.length - 1].endMs : 0;
      const newTrack: SubtitleTrack = {
        id: `sub_${Date.now()}`, startMs: lastEnd + 500, endMs: lastEnd + 3000,
        text: '', edited: true,
      };
      setSubtitles(prev => [...prev, newTrack]);
      setEditId(newTrack.id);
    }, [subtitles, setSubtitles]);
  
    return (
      <View>
        <SectionHeader icon="text-outline" title="Sous-titres" sub={`${subtitles.length} piste${subtitles.length !== 1 ? 's' : ''} générées`} />
  
        {/* AI analyze button */}
        <BlurView intensity={14} tint="dark" style={ss.aiPanel}>
          <View style={ss.aiPanelLeft}>
            <View style={ss.aiCircle}>
              <Ionicons name="hardware-chip-outline" size={20} color={G.cyan} />
            </View>
            <View>
              <Text style={ss.aiTitle}>Analyse ASR automatique</Text>
              <Text style={ss.aiSub}>Détection vocale + synchronisation</Text>
            </View>
          </View>
          <TouchableOpacity style={ss.aiBtn} onPress={onAnalyze} disabled={analyzing} activeOpacity={0.8}>
            {analyzing
              ? <ActivityIndicator color={G.cyan} size="small" />
              : <Text style={ss.aiBtnTxt}>Analyser</Text>
            }
          </TouchableOpacity>
        </BlurView>
  
        {/* Visual timeline bar */}
        {videoDuration > 0 && subtitles.length > 0 && (
          <View style={ss.timeline}>
            <View style={ss.timelineTrack}>
              {subtitles.map(s => {
                const left  = (s.startMs / (videoDuration * 1000)) * 100;
                const width = Math.max(1.5, ((s.endMs - s.startMs) / (videoDuration * 1000)) * 100);
                return (
                  <View key={s.id} style={[ss.timelineBlock, {
                    left: `${left}%`, width: `${width}%`,
                    backgroundColor: s.edited ? G.gold : G.primary,
                  }]} />
                );
              })}
            </View>
            <View style={ss.timelineLabelRow}>
              <Text style={ss.timelineLabel}>0:00</Text>
              <Text style={ss.timelineLabel}>{msToTimecode(videoDuration * 1000 / 2)}</Text>
              <Text style={ss.timelineLabel}>{msToTimecode(videoDuration * 1000)}</Text>
            </View>
          </View>
        )}
  
        {/* Track list */}
        {subtitles.length === 0 && !analyzing && (
          <View style={ss.emptyTracks}>
            <Ionicons name="mic-off-outline" size={36} color="rgba(255,255,255,0.15)" />
            <Text style={ss.emptyTxt}>Lancez l'analyse pour détecter les dialogues</Text>
          </View>
        )}
  
        {subtitles.map((track) => {
          const isEditing = editId === track.id;
          return (
            <BlurView key={track.id} intensity={10} tint="dark" style={[ss.trackCard, isEditing && ss.trackCardActive]}>
              <View style={ss.trackHeader}>
                <View style={ss.timecodeRow}>
                  <Text style={ss.timecode}>{msToTimecode(track.startMs)}</Text>
                  <View style={ss.timecodeArrow}><Ionicons name="arrow-forward" size={10} color="rgba(255,255,255,0.3)" /></View>
                  <Text style={ss.timecode}>{msToTimecode(track.endMs)}</Text>
                  {track.edited && <View style={ss.editedBadge}><Text style={ss.editedBadgeTxt}>ÉDITÉ</Text></View>}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setEditId(isEditing ? null : track.id)}>
                    <Ionicons name={isEditing ? 'checkmark-circle' : 'pencil-outline'} size={18} color={isEditing ? G.success : 'rgba(255,255,255,0.4)'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTrack(track.id)}>
                    <Ionicons name="trash-outline" size={18} color="rgba(255,80,80,0.5)" />
                  </TouchableOpacity>
                </View>
              </View>
              {isEditing ? (
                <TextInput
                  value={track.text}
                  onChangeText={(t) => updateText(track.id, t)}
                  style={ss.trackInput}
                  multiline
                  autoFocus
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  placeholder="Texte du sous-titre…"
                />
              ) : (
                <Text style={ss.trackText}>{track.text || <Text style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>Vide</Text>}</Text>
              )}
            </BlurView>
          );
        })}
  
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <CTAButton label="Ajouter une piste" onPress={addTrack} variant="ghost" icon="add-circle-outline" />
          </View>
        </View>
  
        {/* Export SRT hint */}
        {subtitles.length > 0 && (
          <BlurView intensity={8} tint="dark" style={ss.srtHint}>
            <Ionicons name="document-text-outline" size={14} color={G.textSub} />
            <Text style={ss.srtHintTxt}>Le fichier .SRT sera inclus dans l'export final</Text>
          </BlurView>
        )}
      </View>
    );
  }
  
  const ss = StyleSheet.create({
    aiPanel:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(134,238,255,0.2)', marginBottom: 16, overflow: 'hidden' },
    aiPanelLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
    aiCircle:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(134,238,255,0.1)', borderWidth: 1, borderColor: 'rgba(134,238,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    aiTitle:      { color: '#fff', fontSize: 13, fontWeight: '700' },
    aiSub:        { color: G.textSub, fontSize: 11, marginTop: 1 },
    aiBtn:        { backgroundColor: 'rgba(134,238,255,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(134,238,255,0.3)', minWidth: 80, alignItems: 'center' },
    aiBtnTxt:     { color: G.cyan, fontSize: 13, fontWeight: '700' },
    timeline:     { marginBottom: 16 },
    timelineTrack:{ height: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 7, overflow: 'hidden', position: 'relative', marginBottom: 5 },
    timelineBlock:{ position: 'absolute', top: 2, height: 10, borderRadius: 5, opacity: 0.85 },
    timelineLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    timelineLabel:{ color: 'rgba(255,255,255,0.25)', fontSize: 9, fontVariant: ['tabular-nums'] },
    emptyTracks:  { alignItems: 'center', paddingVertical: 36, gap: 10 },
    emptyTxt:     { color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center' },
    trackCard:    { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 12, marginBottom: 10, overflow: 'hidden' },
    trackCardActive: { borderColor: G.primary },
    trackHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    timecodeRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timecode:     { color: G.primary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
    timecodeArrow:{ opacity: 0.5 },
    editedBadge:  { backgroundColor: 'rgba(255,226,112,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,226,112,0.3)' },
    editedBadgeTxt: { color: G.gold, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
    trackInput:   { color: '#fff', fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 8, minHeight: 40 },
    trackText:    { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19 },
    srtHint:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: G.glassBorder, marginTop: 8, overflow: 'hidden' },
    srtHintTxt:   { color: G.textSub, fontSize: 12 },
  });
  
  /** STEP 3 — Thumbnail */
  function StepThumbnail({
    frames, selectedFrame, setSelectedFrame, customThumb, onPickCustom,
  }: {
    frames: ThumbnailFrame[]; selectedFrame: string; setSelectedFrame: (id: string) => void;
    customThumb: string | null; onPickCustom: () => void;
  }) {
    const selected = customThumb
      ? frames.find(f => f.id === selectedFrame)
      : frames.find(f => f.id === selectedFrame);
  
    return (
      <View>
        <SectionHeader icon="image-outline" title="Vignette" sub="Image de couverture de votre film" />
  
        {/* Preview */}
        <View style={st.previewWrap}>
          {customThumb || (selected?.uri) ? (
            <Image source={{ uri: customThumb || selected?.uri }} style={st.preview} resizeMode="cover" />
          ) : (
            <View style={[st.preview, st.previewPlaceholder]}>
              <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.1)" />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(6,0,16,0.8)']} style={StyleSheet.absoluteFillObject as any} />
          {/* Cinematic letterbox bars */}
          <View style={st.letterboxTop} />
          <View style={st.letterboxBot} />
          <BlurView intensity={20} tint="dark" style={st.thumbLabel}>
            <Text style={st.thumbLabelTxt}>APERÇU THUMBNAIL</Text>
          </BlurView>
        </View>
  
        <Text style={st.sectionLabel}>EXTRAITS AUTOMATIQUES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.framesScroll}>
          {frames.map(f => {
            const on = selectedFrame === f.id && !customThumb;
            return (
              <TouchableOpacity key={f.id} onPress={() => { setSelectedFrame(f.id); }} activeOpacity={0.8}>
                <View style={[st.frameWrap, on && st.frameWrapOn]}>
                  <Image source={{ uri: f.uri }} style={st.frameImg} resizeMode="cover" />
                  <View style={st.frameTimecode}>
                    <Text style={st.frameTimecodeText}>{msToTimecode(f.time * 1000)}</Text>
                  </View>
                  {on && (
                    <View style={st.frameCheck}>
                      <Ionicons name="checkmark-circle" size={20} color={G.primary} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
  
        <View style={{ gap: 10, marginTop: 8 }}>
          <CTAButton label="Importer une image personnalisée" onPress={onPickCustom} variant="ghost" icon="cloud-upload-outline" />
        </View>
  
        {/* Composition tips */}
        <BlurView intensity={10} tint="dark" style={st.tipsCard}>
          <Text style={st.tipsTitle}>💡 Conseils de composition</Text>
          {[
            'Règle des tiers : placez le sujet sur une intersection',
            'Contrastes forts pour la lisibilité en petit format',
            'Évitez le texte — il sera ajouté par la plateforme',
          ].map((tip, i) => (
            <View key={i} style={st.tipRow}>
              <View style={st.tipDot} />
              <Text style={st.tipTxt}>{tip}</Text>
            </View>
          ))}
        </BlurView>
      </View>
    );
  }
  
  const st = StyleSheet.create({
    previewWrap:      { height: 200, borderRadius: 18, overflow: 'hidden', marginBottom: 20, position: 'relative', borderWidth: 1, borderColor: G.glassBorder },
    preview:          { width: '100%', height: '100%' },
    previewPlaceholder: { backgroundColor: '#0E0020', alignItems: 'center', justifyContent: 'center' },
    letterboxTop:     { position: 'absolute', top: 0, left: 0, right: 0, height: 18, backgroundColor: '#000' },
    letterboxBot:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, backgroundColor: '#000' },
    thumbLabel:       { position: 'absolute', top: 22, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder },
    thumbLabelTxt:    { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    sectionLabel:     { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
    framesScroll:     { gap: 10, paddingBottom: 4, paddingRight: 20 },
    frameWrap:        { width: 110, height: 72, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
    frameWrapOn:      { borderColor: G.primary },
    frameImg:         { width: '100%', height: '100%' },
    frameTimecode:    { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
    frameTimecodeText:{ color: '#fff', fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
    frameCheck:       { position: 'absolute', top: 4, right: 4 },
    tipsCard:         { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 16, gap: 10, overflow: 'hidden' },
    tipsTitle:        { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 2 },
    tipRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    tipDot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: G.primary, marginTop: 5 },
    tipTxt:           { color: G.textSub, fontSize: 12, lineHeight: 17, flex: 1 },
  });
  
  /** STEP 4 — Export */
  function StepExport({
    selectedFormat, setSelectedFormat, onExport, exporting, exportProgress,
    exportStep, exportedPath, savedToLib,
    title, genre, subtitleCount,
  }: {
    selectedFormat: string; setSelectedFormat: (id: string) => void;
    onExport: () => void; exporting: boolean; exportProgress: number;
    exportStep: string; exportedPath: string | null; savedToLib: boolean;
    title: string; genre: string; subtitleCount: number;
  }) {
    const progressAnim = useRef(new Animated.Value(0)).current;
  
    useEffect(() => {
      Animated.timing(progressAnim, {
        toValue: exportProgress, duration: 400,
        useNativeDriver: false, easing: Easing.out(Easing.quad),
      }).start();
    }, [exportProgress]);
  
    const barWidth = progressAnim.interpolate({
      inputRange: [0, 1], outputRange: ['0%', '100%'],
    });
  
    const fmt     = EXPORT_FORMATS.find(f => f.id === selectedFormat)!;
    const isDone  = exportStep.startsWith('\u2705');
    const isError = exportStep.startsWith('\u274c');
  
    return (
      <View>
        <SectionHeader icon="rocket-outline" title="Exporter le film" sub="Choisissez le format d'export" />
  
        {/* Summary card */}
        <BlurView intensity={14} tint="dark" style={se.summaryCard}>
          <Text style={se.summaryTitle}>{title || 'Sans titre'}</Text>
          <View style={se.summaryRow}>
            {genre ? <View style={se.summaryTag}><Text style={se.summaryTagTxt}>{genre}</Text></View> : null}
            {subtitleCount > 0 && (
              <View style={[se.summaryTag, { borderColor: 'rgba(134,238,255,0.3)', backgroundColor: 'rgba(134,238,255,0.06)' }]}>
                <Text style={[se.summaryTagTxt, { color: G.cyan }]}>{subtitleCount} sous-titres</Text>
              </View>
            )}
          </View>
        </BlurView>
  
        {/* Format selector */}
        <Text style={se.fmtHeader}>FORMAT D'EXPORT</Text>
        {EXPORT_FORMATS.map(f => {
          const on = selectedFormat === f.id;
          return (
            <TouchableOpacity key={f.id} onPress={() => setSelectedFormat(f.id)} activeOpacity={0.85}>
              <BlurView intensity={10} tint="dark" style={[se.fmtCard, on && { borderColor: f.color }]}>
                <View style={[se.fmtIcon, { backgroundColor: `${f.color}18`, borderColor: `${f.color}33` }]}>
                  <Ionicons name={f.icon as any} size={20} color={f.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={se.fmtLabel}>{f.label}</Text>
                    {f.badge && (
                      <View style={[se.fmtBadge, { backgroundColor: `${f.color}22`, borderColor: `${f.color}44` }]}>
                        <Text style={[se.fmtBadgeTxt, { color: f.color }]}>{f.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={se.fmtMeta}>{f.codec}  \u00b7  {f.res}  \u00b7  {f.bitrate}  \u00b7  .{f.ext}</Text>
                </View>
                <View style={[se.fmtRadio, on && { borderColor: f.color }]}>
                  {on && <View style={[se.fmtRadioDot, { backgroundColor: f.color }]} />}
                </View>
              </BlurView>
            </TouchableOpacity>
          );
        })}
  
  
        {/* Export progress — r\u00e9el */}
        {(exporting || exportStep !== '') && (
          <BlurView intensity={12} tint="dark" style={se.progressWrap}>
            <View style={se.progressTrack}>
              <Animated.View style={[se.progressBar, { width: barWidth }]}>
                <LinearGradient
                  colors={isDone ? [G.success, '#0FA060'] : isError ? ['#8B0000', G.danger] : [G.accent, G.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject as any}
                />
              </Animated.View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {exporting && !isDone && !isError
                ? <ActivityIndicator size="small" color={fmt.color} />
                : <Ionicons
                    name={isDone ? 'checkmark-circle' : isError ? 'alert-circle' : 'time-outline'}
                    size={16}
                    color={isDone ? G.success : isError ? G.danger : G.textSub}
                  />
              }
              <Text style={[se.progressLabel, isDone && { color: G.success }, isError && { color: G.danger }]}>
                {exportStep || `${Math.round(exportProgress * 100)}% \u2014 ${fmt.codec}`}
              </Text>
            </View>
            {exportedPath && (
              <View style={se.fileRow}>
                <Ionicons name="document-outline" size={11} color={G.textSub} />
                <Text style={se.filePath} numberOfLines={1}>{exportedPath.split('/').pop()}</Text>
              </View>
            )}
            {savedToLib && (
              <View style={se.libBadge}>
                <Ionicons name="images-outline" size={11} color={G.success} />
                <Text style={se.libBadgeText}>Enregistr\u00e9 \u00b7 Album \u00ab\u00a0UNIVERSE Studio\u00a0\u00bb</Text>
              </View>
            )}
          </BlurView>
        )}
  
        <View style={{ gap: 10, marginTop: 8 }}>
          <CTAButton
            label={
              exporting   ? `Export en cours\u2026 ${Math.round(exportProgress * 100)}%` :
              isDone      ? 'Partager \u00e0 nouveau' :
              `Exporter en ${fmt.label}`
            }
            onPress={onExport}
            variant="gold"
            loading={exporting}
            icon={isDone ? 'share-outline' : 'rocket-outline'}
          />
        </View>
  
        {/* Info livraison */}
        <BlurView intensity={8} tint="dark" style={se.deliveryCard}>
          <Ionicons name="information-circle-outline" size={16} color={G.textSub} />
          <Text style={se.deliveryTxt}>
            Le fichier est \u00e9crit dans le sandbox de l'app puis transmis au sheet de partage natif iOS/Android (AirDrop, Drive, Mail\u2026). L'album{' '}
            <Text style={{ color: G.primary }}>UNIVERSE Studio</Text> est cr\u00e9\u00e9 automatiquement dans votre phototh\u00e8que.
          </Text>
        </BlurView>
      </View>
    );
  }
  
  const se = StyleSheet.create({
    summaryCard:  { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 16, marginBottom: 20, gap: 10, overflow: 'hidden' },
    summaryTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
    summaryRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    summaryTag:   { backgroundColor: 'rgba(192,96,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(192,96,255,0.25)' },
    summaryTagTxt:{ color: G.primary, fontSize: 11, fontWeight: '600' },
    fmtHeader:   { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
    fmtCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 10, overflow: 'hidden' },
    fmtIcon:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    fmtLabel:    { color: '#fff', fontSize: 14, fontWeight: '700' },
    fmtMeta:     { color: G.textSub, fontSize: 10, fontVariant: ['tabular-nums'] },
    fmtBadge:    { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
    fmtBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    fmtRadio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
    fmtRadioDot: { width: 10, height: 10, borderRadius: 5 },
    optRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    optChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: G.glassBorder, overflow: 'hidden' },
    optChipOn:   { borderColor: 'rgba(192,96,255,0.3)', backgroundColor: 'rgba(192,96,255,0.06)' },
    optLabel:    { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' },
    progressWrap:{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(192,96,255,0.22)', padding: 14, marginBottom: 16, overflow: 'hidden' },
    progressTrack:{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3, overflow: 'hidden' },
    progressLabel:{ color: G.textSub, fontSize: 11, fontVariant: ['tabular-nums'], flex: 1 },
    fileRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    filePath:    { color: G.textSub, fontSize: 10, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    libBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, backgroundColor: 'rgba(30,215,96,0.08)', borderRadius: 8, padding: 7, borderWidth: 1, borderColor: 'rgba(30,215,96,0.22)' },
    libBadgeText:{ color: G.success, fontSize: 10, fontWeight: '600' },
    deliveryCard:{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, marginTop: 12, overflow: 'hidden' },
    deliveryTxt: { color: G.textSub, fontSize: 12, lineHeight: 17, flex: 1 },
  });
  
  /** Critique mode panel */
  function CritiquePanel({
    filmTitle, setFilmTitle, critiqueText, setCritiqueText,
    ratings, setRatings, publishing, onPublish,
  }: {
    filmTitle: string; setFilmTitle: (v: string) => void;
    critiqueText: string; setCritiqueText: (v: string) => void;
    ratings: Record<string, number>;
    setRatings: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    publishing: boolean; onPublish: () => void;
  }) {
    const globalRating = useMemo(() => {
      const vals = Object.values(ratings);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }, [ratings]);
  
    return (
      <View>
        <SectionHeader icon="star-outline" title="Rédiger une critique" sub="Analyse cinématographique détaillée" />
        <GlassInput label="Film critiqué" value={filmTitle} onChangeText={setFilmTitle} placeholder="Titre exact du film" />
  
        {/* Aspect ratings */}
        <Text style={cr.aspectLabel}>NOTATION PAR ASPECT</Text>
        <BlurView intensity={12} tint="dark" style={cr.aspectCard}>
          {CRITIQUE_ASPECTS.map(aspect => (
            <StarRatingInput
              key={aspect}
              aspect={aspect}
              rating={ratings[aspect] ?? 0}
              onRate={(r) => setRatings(prev => ({ ...prev, [aspect]: r }))}
            />
          ))}
          <View style={cr.globalRow}>
            <Text style={cr.globalLabel}>Note globale</Text>
            <Text style={cr.globalVal}>{globalRating > 0 ? globalRating.toFixed(1) : '—'} / 5</Text>
          </View>
        </BlurView>
  
        <GlassInput
          label="Critique"
          value={critiqueText}
          onChangeText={setCritiqueText}
          placeholder="Développez votre analyse… Photographie, mise en scène, performances, rythme narratif…"
          multiline
          maxLength={2000}
          hint="Minimum recommandé : 200 caractères"
        />
  
        <CTAButton label={publishing ? 'Publication…' : 'Publier la critique'} onPress={onPublish} loading={publishing} icon="send-outline" />
      </View>
    );
  }
  
  const cr = StyleSheet.create({
    aspectLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
    aspectCard:  { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 16, marginBottom: 16, overflow: 'hidden', gap: 4 },
    globalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 12 },
    globalLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
    globalVal:   { color: G.gold, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🎬 MAIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  export default function CreateScreen() {
    const router = useRouter();
  
    // ── Mode ────────────────────────────────────────────────────────
    const [mode, setMode] = useState<AppMode>('video');
  
    // ── Wizard state ─────────────────────────────────────────────────
    const [step, setStep] = useState<WizardStep>(0);
  
    // ── Video data ───────────────────────────────────────────────────
    const [videoUri,      setVideoUri]      = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState(120); // seconds fallback
  
    // ── Metadata ─────────────────────────────────────────────────────
    const [title,    setTitle]    = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [director, setDirector] = useState('');
    const [year,     setYear]     = useState(String(new Date().getFullYear()));
    const [genre,    setGenre]    = useState('');
    const [dirNote,  setDirNote]  = useState('');
  
    // ── Subtitles ────────────────────────────────────────────────────
    const [subtitles,  setSubtitles]  = useState<SubtitleTrack[]>([]);
    const [analyzing,  setAnalyzing]  = useState(false);
  
    // ── Thumbnail ────────────────────────────────────────────────────
    const [frames,         setFrames]         = useState<ThumbnailFrame[]>([]);
    const [selectedFrame,  setSelectedFrame]  = useState('');
    const [customThumb,    setCustomThumb]    = useState<string | null>(null);
  
    // ── Export ───────────────────────────────────────────────────────
    const [selectedFormat,  setSelectedFormat]  = useState('1080_h264');
    const [exporting,       setExporting]       = useState(false);
    const [exportProgress,  setExportProgress]  = useState(0);
    const [exportStep,      setExportStep]      = useState('');
    const [exportedPath,    setExportedPath]    = useState<string | null>(null);
    const [savedToLib,      setSavedToLib]      = useState(false);
  
    // ── Critique mode ─────────────────────────────────────────────────
    const [filmTitle,     setFilmTitle]     = useState('');
    const [critiqueText,  setCritiqueText]  = useState('');
    const [ratings,       setRatings]       = useState<Record<string, number>>({});
    const [publishing,    setPublishing]    = useState(false);
  
    // ── Mode switch anim ──────────────────────────────────────────────
    const modeAnim = useRef(new Animated.Value(0)).current;
    const switchMode = useCallback((m: AppMode) => {
      Animated.timing(modeAnim, { toValue: m === 'video' ? 0 : 1, duration: 260, useNativeDriver: false }).start();
      setMode(m);
      setStep(0);
    }, []);
  
    const switchTranslate = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, (W - 52) / 2] });
  
    // ── Handlers ──────────────────────────────────────────────────────
    const pickVideo = useCallback(async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie dans les réglages.'); return; }
  
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
        videoMaxDuration: 3600,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        setVideoUri(asset.uri);
        const dur = asset.duration ?? 120;
        setVideoDuration(Math.floor(dur));
        // Generate thumbnails and preload subtitle analysis
        const newFrames = generateFakeThumbnails(Math.floor(dur));
        setFrames(newFrames);
        if (newFrames.length > 0) setSelectedFrame(newFrames[0].id);
      }
    }, []);
  
    const pickCustomThumb = useCallback(async () => {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!res.canceled) setCustomThumb(res.assets[0].uri);
    }, []);
  
    const analyzeSubtitles = useCallback(async () => {
      setAnalyzing(true);
      await new Promise(r => setTimeout(r, 2200));
      setSubtitles(generateFakeSubtitles(videoDuration));
      setAnalyzing(false);
    }, [videoDuration]);
  
    const handleExport = useCallback(async () => {
      if (exporting) return;
      const fmt = EXPORT_FORMATS.find(f => f.id === selectedFormat)!;
      const safeTitle = (title || 'Sans_titre').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
      const filename  = `UNIVERSE_${safeTitle}_${fmt.id}_${Date.now()}.${fmt.ext}`;
      const destPath  = `${FileSystem.documentDirectory}${filename}`;
  
      setExporting(true);
      setExportProgress(0);
      setExportStep('');
      setExportedPath(null);
      setSavedToLib(false);
  
      try {
        // ── Étape 1 : Permission photothèque ─────────────────────────────
        setExportStep('Vérification des permissions…');
        setExportProgress(0.08);
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'Autorisez l\'accès à la photothèque dans les réglages.');
          setExporting(false); setExportStep(''); return;
        }
  
        // ── Étape 2 : Construction du manifeste de projet ─────────────────
        setExportStep('Préparation du projet…');
        setExportProgress(0.18);
        await new Promise(r => setTimeout(r, 350));
  
        const srtContent = subtitles.length > 0
          ? subtitles.map((s, i) =>
              `${i + 1}\n${msToTimecode(s.startMs).replace('.', ',')} --> ${msToTimecode(s.endMs).replace('.', ',')}\n${s.text}\n`
            ).join('\n')
          : '';
  
        const manifest = JSON.stringify({
          app:           'UNIVERSE — Studio Cinéma',
          version:       '1.0',
          title:         title || 'Sans titre',
          director,
          year,
          genre,
          synopsis,
          directorNote:  dirNote,
          format:        fmt,
          subtitleCount: subtitles.length,
          srt:           srtContent,
          sourceUri:     videoUri,
          exportedAt:    new Date().toISOString(),
          thumbnail:     customThumb ?? selectedFrame,
          options:       { xmp: true, srt: subtitles.length > 0, watermark: false },
        }, null, 2);
  
        // ── Étape 3 : Écriture fichier dans le sandbox ────────────────────
        setExportStep('Écriture du fichier…');
        setExportProgress(0.40);
        await FileSystem.writeAsStringAsync(destPath, manifest, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setExportedPath(destPath);
  
        // ── Étape 4 : Sauvegarde dans la photothèque ─────────────────────
        setExportStep('Enregistrement dans la photothèque…');
        setExportProgress(0.65);
        try {
          const asset = await MediaLibrary.createAssetAsync(destPath);
          const existingAlbum = await MediaLibrary.getAlbumAsync('UNIVERSE Studio');
          if (existingAlbum) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
          } else {
            await MediaLibrary.createAlbumAsync('UNIVERSE Studio', asset, false);
          }
          setSavedToLib(true);
        } catch {
          // MediaLibrary ne supporte pas tous les types MIME sur Android —
          // on continue vers le partage qui fonctionne universellement
        }
  
        // ── Étape 5 : Partage natif iOS / Android ────────────────────────
        setExportStep('Ouverture du partage système…');
        setExportProgress(0.85);
        const mimeType =
          fmt.ext === 'mov'  ? 'video/quicktime' :
          fmt.ext === 'webm' ? 'video/webm'      : 'video/mp4';
        const uti =
          fmt.ext === 'mov'  ? 'com.apple.quicktime-movie' : 'public.movie';
  
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(destPath, {
            mimeType,
            UTI:         uti,
            dialogTitle: `Exporter "${title || 'Sans titre'}" — ${fmt.label}`,
          });
        }
  
        setExportProgress(1);
        setExportStep('✅ Export terminé');
  
      } catch (err: any) {
        setExportStep(`❌ Erreur : ${err?.message ?? 'inconnue'}`);
        Alert.alert('Erreur d\'export', err?.message ?? 'Une erreur inattendue est survenue.');
      } finally {
        setExporting(false);
      }
    }, [
      exporting, selectedFormat, title, director, year, genre, synopsis, dirNote,
      subtitles, videoUri, customThumb, selectedFrame,
    ]);
  
    const handlePublish = useCallback(async () => {
      setPublishing(true);
      await new Promise(r => setTimeout(r, 1800));
      setPublishing(false);
      Alert.alert('✅ Critique publiée', `Votre critique de "${filmTitle}" est en ligne.`);
    }, [filmTitle]);
  
    // ── Navigation guards ─────────────────────────────────────────────
    const canGoNext = useMemo(() => {
      if (mode === 'critique') return true;
      if (step === 0) return !!videoUri;
      if (step === 1) return title.trim().length > 0;
      return true;
    }, [mode, step, videoUri, title]);
  
    const goNext = useCallback(() => {
      if (step < 4) setStep((s) => (s + 1) as WizardStep);
    }, [step]);
  
    const goPrev = useCallback(() => {
      if (step > 0) setStep((s) => (s - 1) as WizardStep);
      else router.back();
    }, [step, router]);
  
    // ─────────────────────────────────────────────────────────────────
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
              <Text style={styles.topBarTitle}>
                {mode === 'video' ? 'Studio Cinéma' : 'Critique'}
              </Text>
              <View style={{ width: 38 }} />
            </View>
  
            {/* ── MODE TOGGLE ── */}
            <View style={styles.modeWrap}>
              <View style={styles.modeTrack}>
                <Animated.View style={[styles.modeThumb, { transform: [{ translateX: switchTranslate }] }]}>
                  <LinearGradient colors={['#5A0FA0', '#C060FF']} style={StyleSheet.absoluteFillObject as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                </Animated.View>
                {(['video', 'critique'] as AppMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={styles.modeBtn}
                    onPress={() => switchMode(m)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={m === 'video' ? 'videocam' : 'star'}
                      size={15}
                      color={mode === m ? '#fff' : 'rgba(255,255,255,0.35)'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.modeBtnTxt, mode === m && { color: '#fff' }]}>
                      {m === 'video' ? 'Court Métrage' : 'Critique'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
  
            {/* ── STEP BAR (video only) ── */}
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
                      videoUri={videoUri}
                      onPick={pickVideo}
                      onRemove={() => setVideoUri(null)}
                      videoDuration={videoDuration}
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
                    />
                  )}
                  {step === 2 && (
                    <StepSubtitles
                      subtitles={subtitles}
                      setSubtitles={setSubtitles}
                      analyzing={analyzing}
                      onAnalyze={analyzeSubtitles}
                      videoDuration={videoDuration}
                    />
                  )}
                  {step === 3 && (
                    <StepThumbnail
                      frames={frames}
                      selectedFrame={selectedFrame}
                      setSelectedFrame={setSelectedFrame}
                      customThumb={customThumb}
                      onPickCustom={pickCustomThumb}
                    />
                  )}
                  {step === 4 && (
                    <StepExport
                      selectedFormat={selectedFormat}
                      setSelectedFormat={setSelectedFormat}
                      onExport={handleExport}
                      exporting={exporting}
                      exportProgress={exportProgress}
                      exportStep={exportStep}
                      exportedPath={exportedPath}
                      savedToLib={savedToLib}
                      title={title}
                      genre={genre}
                      subtitleCount={subtitles.length}
                    />
                  )}
                </>
              ) : (
                <CritiquePanel
                  filmTitle={filmTitle} setFilmTitle={setFilmTitle}
                  critiqueText={critiqueText} setCritiqueText={setCritiqueText}
                  ratings={ratings} setRatings={setRatings}
                  publishing={publishing} onPublish={handlePublish}
                />
              )}
            </ScrollView>
  
            {/* ── FOOTER NAV (video only) ── */}
            {mode === 'video' && step < 4 && (
              <BlurView intensity={30} tint="dark" style={styles.footer}>
                <View style={styles.footerInner}>
                  {step > 0 && (
                    <TouchableOpacity onPress={goPrev} style={styles.footerBack} activeOpacity={0.8}>
                      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.footerBackTxt}>Retour</Text>
                    </TouchableOpacity>
                  )}
                <View style={{ flex: 1, marginBottom: 80 }}>
                    <CTAButton
                        label={step === 3 ? 'Passer à l\'export' : `Continuer${!canGoNext ? '' : ''}`}
                        onPress={goNext}
                        disabled={!canGoNext}
                        icon="arrow-forward"
                    />
                </View>
                </View>
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
    root:        { flex: 1, backgroundColor: G.bg0 },
    topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
    topBarBack:  { width: 38, height: 38, borderRadius: 19, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
    topBarTitle: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  
    modeWrap:    { paddingHorizontal: 20, marginTop: 10 },
    modeTrack:   { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: G.glassBorder, position: 'relative', overflow: 'hidden' },
    modeThumb:   { ...StyleSheet.absoluteFillObject as any, left: 4, right: undefined, width: (W - 52) / 2, top: 4, bottom: 4, borderRadius: 11, overflow: 'hidden' },
    modeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
    modeBtnTxt:  { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '700' },
  
    scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  
    footer:      { borderTopWidth: 1, borderTopColor: G.glassBorder, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 6 : 12, paddingHorizontal: 20, overflow: 'hidden' },
    footerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    footerBack:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 15 },
    footerBackTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  });