
import React, {
  useState, useRef, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { BlurView }       from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useRouter }      from 'expo-router';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system';
import * as Haptics       from 'expo-haptics';

// Studio components
import { GalaxyBackground }  from '@/components/studio/GalaxyBackground';
import { ScanlineOverlay, StepBar, CTAButton }  from '@/components/studio/UIKit';
import { StepImport }        from '@/components/studio/StepImport';
import  StepMeta           from '@/components/studio/StepMeta';
import  StepSubtitles      from '@/components/studio/StepSubtitles';
import  StepThumbnail      from '@/components/studio/StepThumbnail';
import { StepExport, runExport } from '@/components/studio/StepExport';
import  CritiquePanel      from '@/components/studio/CritiquePanel';

import {
  G, EXPORT_FORMATS, DEFAULT_EDIT_PARAMS,
  generateFakeSubtitles, generateFakeThumbnails,
  type AppMode, type WizardStep, type VideoEditParams,
  type SubtitleTrack, type ThumbnailFrame, type CastMember, type ExportedFile,
} from '../../components/studio/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const router = useRouter();

  // ── Mode / Step ─────────────────────────────────────────────────
  const [mode, setMode] = useState<AppMode>('video');
  const [step, setStep] = useState<WizardStep>(0);

  // ── Video ───────────────────────────────────────────────────────
  const [videoUri,       setVideoUri]       = useState<string | null>(null);
  const [processedUri,   setProcessedUri]   = useState<string | null>(null);  // after FFmpeg
  const [videoDuration,  setVideoDuration]  = useState(120);
  const [videoFileSize,  setVideoFileSize]  = useState(0);
  const [videoFileName,  setVideoFileName]  = useState('');
  const [editParams,     setEditParams]     = useState<VideoEditParams>(DEFAULT_EDIT_PARAMS);

  // ── Metadata ────────────────────────────────────────────────────
  const [title,        setTitle]        = useState('');
  const [synopsis,     setSynopsis]     = useState('');
  const [director,     setDirector]     = useState('');
  const [year,         setYear]         = useState(String(new Date().getFullYear()));
  const [genre,        setGenre]        = useState('');
  const [dirNote,      setDirNote]      = useState('');
  const [language,     setLanguage]     = useState('Français');
  const [dop,          setDop]          = useState('');
  const [composer,     setComposer]     = useState('');
  const [production,   setProduction]   = useState('');
  const [cast,         setCast]         = useState<CastMember[]>([]);
  const [festival,     setFestival]     = useState('');
  const [colorSpace,   setColorSpace]   = useState('Rec.709');
  const [aspectRatio,  setAspectRatio]  = useState('16:9');
  const [isan,         setIsan]         = useState('');
  const [runtime,      setRuntime]      = useState('');

  // ── Subtitles ───────────────────────────────────────────────────
  const [subtitles,  setSubtitles]  = useState<SubtitleTrack[]>([]);
  const [analyzing,  setAnalyzing]  = useState(false);

  // ── Thumbnail ───────────────────────────────────────────────────
  const [frames,        setFrames]        = useState<ThumbnailFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState('');
  const [customThumb,   setCustomThumb]   = useState<string | null>(null);
  const [thumbRatio,    setThumbRatio]    = useState('16:9');

  // ── Export state ────────────────────────────────────────────────
  const [selectedFormat, setSelectedFormat] = useState('1080_h264');
  const [exporting,      setExporting]      = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep,     setExportStep]     = useState('');
  const [exportedFiles,  setExportedFiles]  = useState<ExportedFile[]>([]);
  const [savedToLib,     setSavedToLib]     = useState(false);
  const [embedSrt,       setEmbedSrt]       = useState(true);
  const [embedXmp,       setEmbedXmp]       = useState(true);
  const [watermark,      setWatermark]      = useState(false);

  // ── Critique ────────────────────────────────────────────────────
  const [filmTitle,      setFilmTitle]      = useState('');
  const [critiqueText,   setCritiqueText]   = useState('');
  const [ratings,        setRatings]        = useState<Record<string, number>>({});
  const [publishing,     setPublishing]     = useState(false);
  const [recommendation, setRecommendation] = useState('');
  const [spoiler,        setSpoiler]        = useState(false);

  // ── Mode switch animation ────────────────────────────────────────
  const modeAnim    = useRef(new Animated.Value(0)).current;
  const THUMB_W     = useMemo(() => (require('react-native').Dimensions.get('window').width - 52) / 2, []);

  const switchMode = useCallback((m: AppMode) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(modeAnim, { toValue: m === 'video' ? 0 : 1, useNativeDriver: true, tension: 200, friction: 22 }).start();
    setMode(m);
    setStep(0);
  }, [modeAnim]);

  const switchTranslate = modeAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, THUMB_W],
  });

  // ── Video pick ────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie dans les réglages.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1, videoMaxDuration: 3600, allowsEditing: false,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setVideoUri(asset.uri);
    setProcessedUri(null);
    const dur = Math.floor(asset.duration ?? 120);
    setVideoDuration(dur);
    setVideoFileName(asset.fileName ?? asset.uri.split('/').pop() ?? '');
    setEditParams({ ...DEFAULT_EDIT_PARAMS, trimEnd: dur });

    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      setVideoFileSize((info as any).size ?? 0);
    } catch { setVideoFileSize(0); }

    const newFrames = generateFakeThumbnails(dur);
    setFrames(newFrames);
    if (newFrames.length > 0) setSelectedFrame(newFrames[0].id);

    if (!runtime) {
      const m = Math.floor(dur / 60);
      const s = dur % 60;
      setRuntime(s > 0 ? `${m} min ${s} s` : `${m} min`);
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

  // ── Export ────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (exporting || !videoUri) return;
    const effectiveUri = processedUri ?? videoUri;  // use FFmpeg output if available
    const fmt = EXPORT_FORMATS.find(f => f.id === selectedFormat) ?? EXPORT_FORMATS[2];

    setExporting(true);
    setExportProgress(0);
    setExportStep('');
    setExportedFiles([]);
    setSavedToLib(false);

    const result = await runExport({
      videoUri:       effectiveUri,
      editParams,
      selectedFormat: fmt,
      meta: { title, director, year, genre, synopsis, dirNote, runtime, language, dop, composer, production, cast, festival, colorSpace, aspectRatio, isan },
      subtitles,
      embedSrt,
      embedXmp,
      watermark,
      onProgress: (pct, msg) => {
        setExportProgress(typeof pct === 'function' ? (prev => pct(prev)) as any : pct);
        setExportStep(msg);
      },
      onFile:       f => setExportedFiles(prev => [...prev, f]),
      onSavedToLib: v => setSavedToLib(v),
    });

    if (!result.success && result.error) {
      Alert.alert('Erreur d\'export', result.error);
    }
    setExporting(false);
  }, [
    exporting, videoUri, processedUri, selectedFormat, editParams,
    title, director, year, genre, synopsis, dirNote, runtime, language,
    dop, composer, production, cast, festival, colorSpace, aspectRatio, isan,
    subtitles, embedSrt, embedXmp, watermark,
  ]);

  // ── Critique publish ──────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    setPublishing(true);
    await new Promise(r => setTimeout(r, 1800));
    Alert.alert('Critique publiée !', `Votre critique de "${filmTitle}" a été partagée à votre réseau.`);
    setPublishing(false);
  }, [filmTitle]);

  // ── Navigation ────────────────────────────────────────────────
  const goPrev = useCallback(() => {
    if (step > 0) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(prev => (prev - 1) as WizardStep);
    } else {
      router.back();
    }
  }, [step, router]);

  const goNext = useCallback(() => {
    if (step < 4) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(prev => (prev + 1) as WizardStep);
    }
  }, [step]);

  const canGoNext = useMemo(() => {
    if (step === 0) return !!videoUri;
    if (step === 1) return !!title;
    return true;
  }, [step, videoUri, title]);

  // ── Export format object ──────────────────────────────────────
  const selectedFormatObj = useMemo(
    () => EXPORT_FORMATS.find(f => f.id === selectedFormat) ?? EXPORT_FORMATS[2],
    [selectedFormat],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <ScanlineOverlay />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >

          {/* ── Top bar ── */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={goPrev} style={styles.topBarBack} activeOpacity={0.7}>
              <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.topBarTitle}>
                {mode === 'video' ? 'Studio Cinéma' : 'Critique'}
              </Text>
              {mode === 'video' && videoUri && (
                <Text style={styles.topBarSub} numberOfLines={1}>
                  {title || videoFileName || 'Sans titre'}
                </Text>
              )}
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* ── Mode toggle ── */}
          <View style={styles.modeWrap}>
            <View style={styles.modeTrack}>
              <Animated.View style={[styles.modeThumb, { width: THUMB_W, transform: [{ translateX: switchTranslate }] }]}>
                <LinearGradient
                  colors={['#5A0FA0', '#C060FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              {(['video', 'critique'] as AppMode[]).map(m => (
                <TouchableOpacity key={m} style={styles.modeBtn} onPress={() => switchMode(m)} activeOpacity={0.85}>
                  <Ionicons
                    name={m === 'video' ? 'videocam' : 'star'}
                    size={15}
                    color={mode === m ? '#fff' : 'rgba(255,255,255,0.3)'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.modeBtnTxt, mode === m && { color: '#fff', fontWeight: '800' }]}>
                    {m === 'video' ? 'Court Métrage' : 'Critique'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Step bar ── */}
          {mode === 'video' && <StepBar step={step} mode={mode} />}

          {/* ── Content ── */}
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
                    onRemove={() => {
                      setVideoUri(null); setProcessedUri(null);
                      setVideoFileName(''); setVideoFileSize(0);
                      setEditParams(DEFAULT_EDIT_PARAMS);
                    }}
                    videoDuration={videoDuration}
                    videoFileSize={videoFileSize}
                    videoFileName={videoFileName}
                    editParams={editParams}
                    onEditChange={setEditParams}
                    onProcessed={uri => { setProcessedUri(uri); }}
                    selectedFormat={selectedFormatObj}
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
                    thumbRatio={thumbRatio}
                    setThumbRatio={setThumbRatio}
                  />
                )}
                {step === 4 && (
                  <StepExport
                    selectedFormat={selectedFormat}
                    setSelectedFormat={setSelectedFormat}
                    exporting={exporting}
                    exportProgress={exportProgress}
                    exportStep={exportStep}
                    exportedFiles={exportedFiles}
                    savedToLib={savedToLib}
                    embedSrt={embedSrt} setEmbedSrt={setEmbedSrt}
                    embedXmp={embedXmp} setEmbedXmp={setEmbedXmp}
                    watermark={watermark} setWatermark={setWatermark}
                    subtitles={subtitles}
                    videoUri={processedUri ?? videoUri}
                    editParams={editParams}
                    meta={{ title, director, year, genre, synopsis, dirNote, runtime, language, dop, composer, production, cast, festival, colorSpace, aspectRatio, isan }}
                    onExport={handleExport}
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

          {/* ── Footer navigation ── */}
          {mode === 'video' && step < 4 && (
            <BlurView intensity={0} tint="dark" style={styles.footer}>
              <View style={styles.footerInner}>
                {step > 0 && (
                  <TouchableOpacity onPress={goPrev} style={styles.footerBack} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.footerBackTxt}>Retour</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                  <CTAButton
                    label={
                      step === 0 ? 'Métadonnées →' :
                      step === 1 ? 'Sous-titres →' :
                      step === 2 ? 'Thumbnail →'   :
                      'Exporter →'
                    }
                    onPress={goNext}
                    disabled={!canGoNext}
                    icon={canGoNext ? undefined : 'lock-closed-outline'}
                  />
                </View>
              </View>
              {!canGoNext && (
                <Text style={styles.footerHint}>
                  {step === 0 ? 'Importez une vidéo pour continuer' : 'Renseignez le titre du film'}
                </Text>
              )}
            </BlurView>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: G.bg0 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  topBarBack:    { width: 38, height: 38, borderRadius: 19, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  topBarTitle:   { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  topBarSub:     { color: G.textSub, fontSize: 11, marginTop: 1 },
  modeWrap:      { paddingHorizontal: 20, marginTop: 8, marginBottom: 2 },
  modeTrack:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: G.glassBorder, position: 'relative', overflow: 'hidden' },
  modeThumb:     { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 11, overflow: 'hidden' },
  modeBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  modeBtnTxt:    { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  footer:        { borderTopWidth: 1, borderTopColor: G.glassBorder, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 14, overflow: 'hidden' },
  footerInner:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 80 },
  footerBack:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 15 },
  footerBackTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
  footerHint:    { textAlign: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
});