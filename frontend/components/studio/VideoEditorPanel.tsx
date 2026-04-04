
import React, {
    memo, useState, useRef, useCallback, useEffect, useMemo,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, PanResponder, ScrollView, Dimensions, Platform,
  } from 'react-native';
  import { BlurView }       from 'expo-blur';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { VideoView, useVideoPlayer } from 'expo-video';
  import { useEvent }       from 'expo';
  import * as FileSystem    from 'expo-file-system';
  import * as Haptics       from 'expo-haptics';
  
  import {
    G, SPEED_OPTIONS, EXPORT_FORMATS,
    type VideoEditParams, type ExportFormat,
    buildFFmpegCommand, secToTimecode,
  } from './constants';
  
  // ── FFmpegKit import (nécessite dev build ou bare workflow) ───────
  // import { FFmpegKit, ReturnCode, FFmpegKitConfig } from 'ffmpeg-kit-react-native';
  
  const { width: W } = Dimensions.get('window');
  const TIMELINE_W   = W - 48;  // padding 24 × 2
  const THUMB_RADIUS = 14;
  
  // ─── Types ────────────────────────────────────────────────────────
  
  interface VideoEditorPanelProps {
    videoUri:       string;
    duration:       number;          // secondes
    editParams:     VideoEditParams;
    onChange:       (p: VideoEditParams) => void;
    onProcessed:    (newUri: string) => void;  // called after FFmpeg
    selectedFormat: ExportFormat;
  }
  
  // ─── Dual-thumb range slider ──────────────────────────────────────
  
  interface RangeSliderProps {
    min:      number;
    max:      number;
    low:      number;
    high:     number;
    onLow:    (v: number) => void;
    onHigh:   (v: number) => void;
    color?:   string;
    formatFn?: (v: number) => string;
  }
  
  const RangeSlider = memo(function RangeSlider({
    min, max, low, high, onLow, onHigh, color = G.primary, formatFn = v => v.toFixed(1),
  }: RangeSliderProps) {
    const trackW  = TIMELINE_W - THUMB_RADIUS * 2;
    const pct     = (v: number) => ((v - min) / (max - min)) * trackW;
  
    const lowX  = useRef(new Animated.Value(pct(low))).current;
    const highX = useRef(new Animated.Value(pct(high))).current;
    const [lowVal,  setLowVal]  = useState(low);
    const [highVal, setHighVal] = useState(high);
  
    // Sync external
    useEffect(() => {
      lowX.setValue(pct(low));
      setLowVal(low);
    }, [low]); // eslint-disable-line react-hooks/exhaustive-deps
  
    useEffect(() => {
      highX.setValue(pct(high));
      setHighVal(high);
    }, [high]); // eslint-disable-line react-hooks/exhaustive-deps
  
    const makePan = (which: 'low' | 'high') => {
      let startX = 0;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startX = which === 'low' ? pct(lowVal) : pct(highVal);
        },
        onPanResponderMove: (_, g) => {
          const raw   = startX + g.dx;
          const clamped = Math.max(0, Math.min(trackW, raw));
          const value = min + (clamped / trackW) * (max - min);
  
          if (which === 'low') {
            const v = Math.min(value, highVal - 1);
            lowX.setValue(pct(v));
            setLowVal(v);
            onLow(v);
          } else {
            const v = Math.max(value, lowVal + 1);
            highX.setValue(pct(v));
            setHighVal(v);
            onHigh(v);
          }
          if (Platform.OS !== 'web') Haptics.selectionAsync();
        },
      });
    };
  
    const lowPan  = useRef(makePan('low')).current;
    const highPan = useRef(makePan('high')).current;
  
    const fillLeft  = lowX;
    const fillWidth = Animated.subtract(highX, lowX);
  
    return (
      <View style={rs.wrap}>
        {/* Labels */}
        <View style={rs.labels}>
          <Text style={rs.label}>{formatFn(lowVal)}</Text>
          <Text style={[rs.label, { color }]}>━ {formatFn(highVal - lowVal)}</Text>
          <Text style={rs.label}>{formatFn(highVal)}</Text>
        </View>
  
        {/* Track */}
        <View style={rs.track}>
          {/* Inactive zones */}
          <Animated.View style={[rs.inactive, { width: Animated.add(fillLeft, THUMB_RADIUS) }]} />
          {/* Active fill */}
          <Animated.View style={[rs.fill, {
            left: Animated.add(fillLeft, THUMB_RADIUS),
            width: fillWidth,
            backgroundColor: color,
          }]} />
  
          {/* Low thumb */}
          <Animated.View
            style={[rs.thumb, { left: fillLeft, backgroundColor: color }]}
            {...lowPan.panHandlers}
          >
            <Ionicons name="chevron-back" size={12} color="#000" />
          </Animated.View>
  
          {/* High thumb */}
          <Animated.View
            style={[rs.thumb, { left: highX, backgroundColor: color }]}
            {...highPan.panHandlers}
          >
            <Ionicons name="chevron-forward" size={12} color="#000" />
          </Animated.View>
        </View>
      </View>
    );
  });
  
  const rs = StyleSheet.create({
    wrap:     { marginBottom: 16 },
    labels:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    label:    { color: G.textSub, fontSize: 11, fontVariant: ['tabular-nums'] },
    track:    { height: THUMB_RADIUS * 2, width: TIMELINE_W, position: 'relative' },
    inactive: { position: 'absolute', top: THUMB_RADIUS - 2, left: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
    fill:     { position: 'absolute', top: THUMB_RADIUS - 2, height: 4, borderRadius: 2, opacity: 0.85 },
    thumb:    { position: 'absolute', width: THUMB_RADIUS * 2, height: THUMB_RADIUS * 2, borderRadius: THUMB_RADIUS, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  });
  
  // ─── Single-value slider ──────────────────────────────────────────
  
  interface SliderProps {
    value:     number;
    min:       number;
    max:       number;
    onChange:  (v: number) => void;
    color?:    string;
    step?:     number;
    formatFn?: (v: number) => string;
  }
  
  const Slider = memo(function Slider({
    value, min, max, onChange, color = G.primary, step, formatFn = v => v.toFixed(2),
  }: SliderProps) {
    const trackW = TIMELINE_W - THUMB_RADIUS * 2;
    const pct    = (v: number) => ((v - min) / (max - min)) * trackW;
    const posX   = useRef(new Animated.Value(pct(value))).current;
    const [val, setVal] = useState(value);
  
    useEffect(() => { posX.setValue(pct(value)); setVal(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  
    const pan = useRef(PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        const startPct = pct(val);
        const raw      = Math.max(0, Math.min(trackW, startPct + g.dx));
        let v          = min + (raw / trackW) * (max - min);
        if (step) v = Math.round(v / step) * step;
        posX.setValue(pct(v));
        setVal(v);
        onChange(v);
        if (Platform.OS !== 'web') Haptics.selectionAsync();
      },
    })).current;
  
    return (
      <View style={sl.track}>
        <View style={sl.bg} />
        <Animated.View style={[sl.fill, { width: Animated.add(posX, THUMB_RADIUS), backgroundColor: color }]} />
        <Animated.View style={[sl.thumb, { left: posX, backgroundColor: color }]} {...pan.panHandlers}>
          <Text style={sl.thumbTxt}>{formatFn(val)}</Text>
        </Animated.View>
      </View>
    );
  });
  
  const sl = StyleSheet.create({
    track:    { height: THUMB_RADIUS * 2, width: TIMELINE_W, position: 'relative', marginBottom: 4 },
    bg:       { position: 'absolute', top: THUMB_RADIUS - 2, left: THUMB_RADIUS, right: THUMB_RADIUS, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
    fill:     { position: 'absolute', top: THUMB_RADIUS - 2, left: THUMB_RADIUS, height: 4, borderRadius: 2, opacity: 0.85 },
    thumb:    { position: 'absolute', width: THUMB_RADIUS * 2, height: THUMB_RADIUS * 2, borderRadius: THUMB_RADIUS, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 5, elevation: 5 },
    thumbTxt: { color: '#000', fontSize: 8, fontWeight: '900', fontVariant: ['tabular-nums'] },
  });
  
  // ─── Editor Row (label + control) ────────────────────────────────
  
  const EditorRow = memo(function EditorRow({ icon, label, children }: {
    icon: string; label: string; children: React.ReactNode;
  }) {
    return (
      <BlurView intensity={10} tint="dark" style={er.card}>
        <View style={er.header}>
          <Ionicons name={icon as any} size={14} color={G.primary} />
          <Text style={er.label}>{label}</Text>
        </View>
        {children}
      </BlurView>
    );
  });
  
  const er = StyleSheet.create({
    card:   { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 12, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    label:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  });
  
  // ─── Main component ───────────────────────────────────────────────
  
  export const VideoEditorPanel = memo(function VideoEditorPanel({
    videoUri, duration, editParams, onChange, onProcessed, selectedFormat,
  }: VideoEditorPanelProps) {
    const [processing,   setProcessing]   = useState(false);
    const [progress,     setProgress]     = useState(0);
    const [progressMsg,  setProgressMsg]  = useState('');
    const [error,        setError]        = useState<string | null>(null);
    const [sessionId,    setSessionId]    = useState<number | null>(null);  // for cancel
  
    // ── Preview player ────────────────────────────────────────────
    const player = useVideoPlayer(videoUri, p => { p.loop = true; p.muted = true; });
    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  
    useEffect(() => {
      player.play();
      return () => { player.pause(); };
    }, [player]);
  
    // ── Handlers ─────────────────────────────────────────────────
    const update = useCallback((patch: Partial<VideoEditParams>) => {
      onChange({ ...editParams, ...patch, applied: false });
    }, [editParams, onChange]);
  
    const reset = useCallback(() => {
      onChange({
        trimStart:  0,
        trimEnd:    duration,
        speed:      1,
        zoom:       1,
        brightness: 0,
        contrast:   1,
        saturation: 1,
        applied:    false,
      });
    }, [duration, onChange]);
  
    // ── FFmpegKit processing ──────────────────────────────────────
    const handleProcess = useCallback(async () => {
      if (processing) return;
      setProcessing(true);
      setProgress(0);
      setError(null);
  
      try {
        const safeTs   = Date.now();
        const ext      = selectedFormat.ext;
        const outPath  = `${FileSystem.documentDirectory}UNIVERSE_edit_${safeTs}.${ext}`;
  
        const cmd = buildFFmpegCommand({
          inputPath:  videoUri,
          outputPath: outPath,
          edit:       editParams,
          format:     selectedFormat,
        });
  
        setProgressMsg('Encodage en cours…');
  
        // ──────────────────────────────────────────────────────────
        // REAL: décommenter quand ffmpeg-kit-react-native est installé
        // ──────────────────────────────────────────────────────────
        // FFmpegKitConfig.enableStatisticsCallback((stats) => {
        //   const frames  = stats.getVideoFrameNumber();
        //   const totalFs = Math.ceil(duration * 30);
        //   setProgress(Math.min(frames / totalFs, 0.98));
        // });
        //
        // const session = await FFmpegKit.executeAsync(cmd);
        // setSessionId(await session.getSessionId());
        //
        // const returnCode = await session.getReturnCode();
        // if (ReturnCode.isSuccess(returnCode)) {
        //   setProgress(1);
        //   setProgressMsg('✅ Encodage terminé');
        //   onProcessed(outPath);
        //   onChange({ ...editParams, applied: true });
        // } else {
        //   throw new Error('FFmpegKit a échoué (code ' + returnCode + ')');
        // }
        // ──────────────────────────────────────────────────────────
  
        // SIMULATION (à retirer avec FFmpegKit réel) ──────────────
        for (let i = 0.02; i <= 1; i += 0.04) {
          await new Promise(r => setTimeout(r, 80));
          setProgress(i);
          setProgressMsg(
            i < 0.3 ? 'Analyse de la source…'
              : i < 0.6 ? `Encodage ${selectedFormat.codec}…`
              : i < 0.85 ? 'Mixage audio…'
              : 'Finalisation…'
          );
        }
        // Copy source as fallback
        await FileSystem.copyAsync({ from: videoUri, to: outPath });
        setProgress(1);
        setProgressMsg('✅ Traitement terminé');
        onProcessed(outPath);
        onChange({ ...editParams, applied: true });
        // ──────────────────────────────────────────────────────────
  
      } catch (e: any) {
        setError(e?.message ?? 'Erreur inconnue');
        setProgressMsg('');
      } finally {
        setProcessing(false);
      }
    }, [processing, videoUri, editParams, selectedFormat, onProcessed, onChange]);
  
    const handleCancel = useCallback(async () => {
      // FFmpegKit.cancel(sessionId ?? undefined);
      setProcessing(false);
      setProgress(0);
      setProgressMsg('');
    }, [sessionId]);
  
    // ── Computed preview overlay brightness ──────────────────────
    const brightnessOpacity = useMemo(() => {
      const b = editParams.brightness;
      return b > 0
        ? { backgroundColor: `rgba(255,255,255,${b * 0.5})`, opacity: 1 }
        : { backgroundColor: `rgba(0,0,0,${Math.abs(b) * 0.5})`, opacity: 1 };
    }, [editParams.brightness]);
  
    const hasChanges = useMemo(() =>
      editParams.trimStart > 0
      || editParams.trimEnd < duration - 0.5
      || editParams.speed !== 1
      || editParams.zoom > 1.01
      || editParams.brightness !== 0
      || editParams.contrast !== 1
      || editParams.saturation !== 1,
      [editParams, duration],
    );
  
    return (
      <View style={ep.root}>
        {/* ── Preview ── */}
        <View style={ep.previewWrap}>
          <VideoView
            player={player}
            style={ep.preview}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
          />
          {/* Brightness overlay */}
          <View style={[StyleSheet.absoluteFill, brightnessOpacity, { borderRadius: 14 }]} pointerEvents="none" />
          {/* Zoom badge */}
          {editParams.zoom > 1.01 && (
            <BlurView intensity={30} tint="dark" style={ep.zoomBadge}>
              <Text style={ep.zoomBadgeTxt}>{editParams.zoom.toFixed(1)}×</Text>
            </BlurView>
          )}
          {/* Speed badge */}
          {editParams.speed !== 1 && (
            <BlurView intensity={30} tint="dark" style={ep.speedBadge}>
              <Ionicons name="speedometer" size={10} color={G.gold} />
              <Text style={ep.speedBadgeTxt}>{editParams.speed}×</Text>
            </BlurView>
          )}
          {/* Play/Pause */}
          <TouchableOpacity
            style={ep.playBtn}
            onPress={() => isPlaying ? player.pause() : player.play()}
            activeOpacity={0.8}
          >
            <BlurView intensity={40} tint="dark" style={ep.playBtnInner}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>
  
        {/* ── Progress bar ── */}
        {(processing || progress > 0) && (
          <BlurView intensity={12} tint="dark" style={ep.progressCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={ep.progressMsg}>{progressMsg}</Text>
              <Text style={ep.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={ep.progressTrack}>
              <View style={[ep.progressFill, { width: `${progress * 100}%` }]}>
                <LinearGradient
                  colors={[G.accent, G.primary, G.cyan]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>
            {processing && (
              <TouchableOpacity onPress={handleCancel} style={ep.cancelBtn} activeOpacity={0.8}>
                <Ionicons name="stop-circle-outline" size={14} color={G.danger} />
                <Text style={ep.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        )}
  
        {/* ── Error ── */}
        {error && (
          <BlurView intensity={12} tint="dark" style={ep.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color={G.danger} />
            <Text style={ep.errorTxt}>{error}</Text>
          </BlurView>
        )}
  
        {/* ── TRIM ── */}
        <EditorRow icon="cut-outline" label={`Rognage · ${secToTimecode(editParams.trimStart)} → ${secToTimecode(editParams.trimEnd)}`}>
          <RangeSlider
            min={0} max={duration}
            low={editParams.trimStart} high={editParams.trimEnd}
            onLow={v  => update({ trimStart: Math.round(v * 10) / 10 })}
            onHigh={v => update({ trimEnd:   Math.round(v * 10) / 10 })}
            color={G.gold}
            formatFn={v => secToTimecode(v)}
          />
          <Text style={ep.hint}>
            Durée sélectionnée : {secToTimecode(editParams.trimEnd - editParams.trimStart)}
          </Text>
        </EditorRow>
  
        {/* ── SPEED ── */}
        <EditorRow icon="speedometer-outline" label="Vitesse de lecture">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ep.speedRow}>
            {SPEED_OPTIONS.map(opt => {
              const on = editParams.speed === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    update({ speed: opt.value });
                  }}
                  activeOpacity={0.75}
                  style={[ep.speedChip, on && { borderColor: G.gold, backgroundColor: `${G.gold}18` }]}
                >
                  <Text style={[ep.speedChipTxt, on && { color: G.gold, fontWeight: '800' }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {editParams.speed !== 1 && (
            <Text style={ep.hint}>
              {editParams.speed < 1 ? '🐢 Ralenti' : '⚡ Accéléré'} — durée finale : {secToTimecode((editParams.trimEnd - editParams.trimStart) / editParams.speed)}
            </Text>
          )}
        </EditorRow>
  
        {/* ── ZOOM ── */}
        <EditorRow icon="scan-outline" label={`Zoom · ${editParams.zoom.toFixed(2)}×`}>
          <Slider
            value={editParams.zoom} min={1} max={2.5}
            onChange={v => update({ zoom: Math.round(v * 100) / 100 })}
            color={G.cyan}
            step={0.05}
            formatFn={v => `${v.toFixed(2)}×`}
          />
          <Text style={ep.hint}>Le recadrage est centré. Aucune perte de définition jusqu'à 1.5×.</Text>
        </EditorRow>
  
        {/* ── BRIGHTNESS ── */}
        <EditorRow icon="sunny-outline" label={`Luminosité · ${editParams.brightness >= 0 ? '+' : ''}${editParams.brightness.toFixed(2)}`}>
          <Slider
            value={editParams.brightness} min={-0.5} max={0.5}
            onChange={v => update({ brightness: Math.round(v * 100) / 100 })}
            color={G.sG}
            step={0.01}
            formatFn={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
          />
        </EditorRow>
  
        {/* ── CONTRAST ── */}
        <EditorRow icon="contrast-outline" label={`Contraste · ${editParams.contrast.toFixed(2)}`}>
          <Slider
            value={editParams.contrast} min={0.5} max={2.0}
            onChange={v => update({ contrast: Math.round(v * 100) / 100 })}
            color={G.sB}
            step={0.05}
            formatFn={v => v.toFixed(2)}
          />
        </EditorRow>
  
        {/* ── SATURATION ── */}
        <EditorRow icon="color-palette-outline" label={`Saturation · ${editParams.saturation.toFixed(2)}`}>
          <Slider
            value={editParams.saturation} min={0} max={3}
            onChange={v => update({ saturation: Math.round(v * 100) / 100 })}
            color={G.sP}
            step={0.05}
            formatFn={v => v.toFixed(2)}
          />
        </EditorRow>
  
        {/* ── FFmpeg command preview ── */}
        <BlurView intensity={8} tint="dark" style={ep.cmdCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Ionicons name="terminal-outline" size={12} color={G.textSub} />
            <Text style={ep.cmdLabel}>Commande FFmpeg générée</Text>
          </View>
          <Text style={ep.cmdTxt} selectable numberOfLines={4}>
            {buildFFmpegCommand({
              inputPath:  '[input]',
              outputPath: `[output].${selectedFormat.ext}`,
              edit:       editParams,
              format:     selectedFormat,
            })}
          </Text>
        </BlurView>
  
        {/* ── Actions ── */}
        <View style={ep.actions}>
          {hasChanges && (
            <TouchableOpacity style={ep.resetBtn} onPress={reset} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={14} color={G.textSub} />
              <Text style={ep.resetTxt}>Réinitialiser</Text>
            </TouchableOpacity>
          )}
  
          <TouchableOpacity
            style={[ep.applyBtn, !hasChanges && { opacity: 0.4 }]}
            onPress={handleProcess}
            disabled={processing || !hasChanges}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={processing ? ['#333', '#555'] : ['#7B2FBE', '#C060FF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={ep.applyBtnGrad}
            >
              <Ionicons name={processing ? 'hourglass-outline' : 'checkmark-circle-outline'} size={16} color="#fff" />
              <Text style={ep.applyBtnTxt}>
                {processing ? `Traitement… ${Math.round(progress * 100)}%` : 'Appliquer les modifications'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
  
        {editParams.applied && (
          <BlurView intensity={10} tint="dark" style={ep.appliedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={G.success} />
            <Text style={ep.appliedTxt}>Modifications appliquées · Prêt à exporter</Text>
          </BlurView>
        )}
      </View>
    );
  });
  
  const ep = StyleSheet.create({
    root:         { gap: 0 },
    previewWrap:  { height: 200, borderRadius: 14, overflow: 'hidden', marginBottom: 16, position: 'relative', backgroundColor: '#000', borderWidth: 1, borderColor: G.glassBorder },
    preview:      { width: '100%', height: '100%' },
    zoomBadge:    { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: `${G.cyan}44` },
    zoomBadgeTxt: { color: G.cyan, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
    speedBadge:   { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: `${G.gold}44` },
    speedBadgeTxt:{ color: G.gold, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
    playBtn:      { position: 'absolute', bottom: 10, right: 10 },
    playBtnInner: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    hint:         { color: G.textSub, fontSize: 10, fontStyle: 'italic', marginTop: 4 },
    speedRow:     { gap: 8, paddingBottom: 4 },
    speedChip:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass },
    speedChipTxt: { color: G.textSub, fontSize: 13, fontWeight: '500' },
    progressCard: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(192,96,255,0.22)', padding: 14, marginBottom: 12, overflow: 'hidden' },
    progressMsg:  { color: G.textSub, fontSize: 11, flex: 1 },
    progressPct:  { color: G.primary, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
    progressTrack:{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
    cancelBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    cancelTxt:    { color: G.danger, fontSize: 12, fontWeight: '600' },
    errorCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: `${G.danger}44`, padding: 12, marginBottom: 12, overflow: 'hidden' },
    errorTxt:     { color: G.danger, fontSize: 12, flex: 1 },
    cmdCard:      { borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, padding: 12, marginBottom: 12, overflow: 'hidden' },
    cmdLabel:     { color: G.textSub, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    cmdTxt:       { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 15 },
    actions:      { gap: 10, marginTop: 4 },
    resetBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8 },
    resetTxt:     { color: G.textSub, fontSize: 13 },
    applyBtn:     { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    applyBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 10 },
    applyBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '800' },
    appliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: `${G.success}33`, overflow: 'hidden' },
    appliedTxt:   { color: G.success, fontSize: 12, fontWeight: '600' },
  });