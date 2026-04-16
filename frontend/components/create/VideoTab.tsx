import React, {
    useState, useRef, useCallback, useMemo, useEffect, memo,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, KeyboardAvoidingView, Platform, Alert, Dimensions,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { useRouter }      from 'expo-router';
  import * as ImagePicker   from 'expo-image-picker';
  import * as Haptics       from 'expo-haptics';
  
  import { supabase }         from '@/lib/supabase';
  import { uploadReelToSupabase } from '@/utils/uploadReel';
  import { C, MAX_DURATION }  from './tokens';
  import type { Step, ReelMeta } from './types';
  import StepIndicator from './StepIndicator';
  import StepImport    from './StepImport';
  import StepInfos     from './StepInfos';
  import StepPublish   from './StepPublish';
  
  const { width: W } = Dimensions.get('window');
  
  const VideoTab = memo(function VideoTab() {
    const router = useRouter();
  
    // ── Wizard ──────────────────────────────────────────────────────────────
    const [step, setStep]         = useState<Step>(0);
    const prevStepRef             = useRef<Step>(0);
    const slideAnim               = useRef(new Animated.Value(0)).current;
  
    // ── Video ────────────────────────────────────────────────────────────────
    const [videoUri,      setVideoUri]      = useState<string | null>(null);
    const [videoFileName, setVideoFileName] = useState('');
    const [videoDuration, setVideoDuration] = useState(0);
    const [trimStart,     setTrimStart]     = useState(0);
    const [trimEnd,       setTrimEnd]       = useState(0);
  
    // ── Meta ─────────────────────────────────────────────────────────────────
    const [meta, setMeta] = useState<ReelMeta>({
      title: '', genre: '', director: '',
      year: String(new Date().getFullYear()), synopsis: '',
    });
  
    // ── Upload ───────────────────────────────────────────────────────────────
    const [uploading,      setUploading]      = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadMsg,      setUploadMsg]      = useState('');
  
    // ── Step animation ───────────────────────────────────────────────────────
    useEffect(() => {
      const dir = step > prevStepRef.current ? 1 : -1;
      prevStepRef.current = step;
      slideAnim.setValue(dir * W * 0.08);
      Animated.spring(slideAnim, {
        toValue: 0, tension: 180, friction: 22, useNativeDriver: true,
      }).start();
    }, [step, slideAnim]);
  
    // ── Handlers ─────────────────────────────────────────────────────────────
    const patchMeta = useCallback(<K extends keyof ReelMeta>(key: K, val: string) => {
      setMeta(m => ({ ...m, [key]: val }));
    }, []);
  
    const pickVideo = useCallback(async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "Autorisez l'accès à la galerie dans les réglages.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
        videoMaxDuration: 3600,
        allowsEditing: false,
      });
      if (res.canceled || !res.assets[0]) return;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const asset = res.assets[0];
      const dur   = Math.floor(asset.duration ?? 30);
      setVideoUri(asset.uri);
      setVideoFileName(asset.fileName ?? asset.uri.split('/').pop() ?? 'video');
      setVideoDuration(dur);
      setTrimStart(0);
      setTrimEnd(Math.min(dur, MAX_DURATION));
    }, []);
  
    const removeVideo = useCallback(() => {
      setVideoUri(null); setVideoFileName('');
      setVideoDuration(0); setTrimStart(0); setTrimEnd(0);
    }, []);
  
    const handleTrimChange = useCallback((s: number, e: number) => {
      setTrimStart(s); setTrimEnd(e);
    }, []);
  
    const canContinue = useMemo(() => {
      if (step === 0)
        return !!videoUri && (trimEnd - trimStart) > 0 && (trimEnd - trimStart) <= MAX_DURATION;
      if (step === 1)
        return meta.title.trim().length > 0 && meta.genre.length > 0;
      return true;
    }, [step, videoUri, trimStart, trimEnd, meta.title, meta.genre]);
  
    const errorHint = useMemo(() => {
      if (step === 0) {
        if (!videoUri)                              return 'Importez une vidéo pour continuer';
        if ((trimEnd - trimStart) > MAX_DURATION)   return `Réduisez la sélection à ${MAX_DURATION}s max`;
        if ((trimEnd - trimStart) <= 0)             return 'Sélectionnez une durée valide';
      }
      if (step === 1) {
        if (!meta.title.trim()) return 'Renseignez le titre du film';
        if (!meta.genre)        return 'Sélectionnez un genre';
      }
      return '';
    }, [step, videoUri, trimStart, trimEnd, meta.title, meta.genre]);
  
    const goNext = useCallback(() => {
      if (!canContinue) return;
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(s => Math.min(2, s + 1) as Step);
    }, [canContinue]);
  
    const goPrev = useCallback(() => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (step > 0) setStep(s => (s - 1) as Step);
      else router.back();
    }, [step, router]);
  
    const handleUpload = useCallback(async () => {
      if (!videoUri || uploading) return;
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? 'anonymous';
      setUploading(true);
      setUploadProgress(0);
      const result = await uploadReelToSupabase(
        videoUri, meta, userId,
        (pct, msg) => { setUploadProgress(pct); setUploadMsg(msg); },
      );
      setUploading(false);
      if (result) {
        router.replace({ pathname: '/(tabs)/create', params: { newReelId: result.id } });
      } else {
        Alert.alert('Erreur', "L'upload a échoué. Vérifiez votre connexion et réessayez.");
      }
    }, [videoUri, meta, uploading, router]);
  
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <StepIndicator step={step} />
  
        <Animated.ScrollView
          style={{ flex: 1, transform: [{ translateX: slideAnim }] }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <StepImport
              videoUri={videoUri}
              videoFileName={videoFileName}
              videoDuration={videoDuration}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onPick={pickVideo}
              onRemove={removeVideo}
              onTrimChange={handleTrimChange}
            />
          )}
          {step === 1 && <StepInfos meta={meta} onChange={patchMeta} />}
          {step === 2 && (
            <StepPublish
              meta={meta}
              trimStart={trimStart}
              trimEnd={trimEnd}
              uploading={uploading}
              uploadProgress={uploadProgress}
              uploadMsg={uploadMsg}
              onUpload={handleUpload} videoUri={''}          
                />
          )}
          <View style={{ height: 40 }} />
        </Animated.ScrollView>
  
        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerRow}>
            {step > 0 && (
              <TouchableOpacity style={s.footerBack} onPress={goPrev}>
          <Ionicons name="chevron-back" size={18} color={C.textSec} />
          <Text style={s.footerBackTxt}>Retour</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.footerNext, !canContinue && { opacity: 0.45 }, step === 0 && { marginLeft: 'auto' as any }]}
              onPress={goNext}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              <View style={[s.footerNextGrad, { backgroundColor: C.navyMid }]}>
          <Text style={[s.footerNextTxt, !canContinue && { color: C.textTert }]}>
            {step === 0 ? 'Informations' : 'Aperçu'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={canContinue ? 'white' : C.textTert} />
              </View>
            </TouchableOpacity>
          </View>
          {!canContinue && errorHint.length > 0 && (
            <Text style={s.footerHint}>{errorHint}</Text>
          )}
        </View>
        
            </KeyboardAvoidingView>
          );
        });
        
        export default VideoTab;
        
        const s = StyleSheet.create({
          backRow:        { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
          backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
          scroll:         { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
          footer:         { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 16, marginBottom: 90 },
          footerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
          footerBack:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 14 },
          footerBackTxt:  { color: C.textSec, fontSize: 14, fontWeight: '600' },
          footerNext:     { flex: 1, borderRadius: 15, overflow: 'hidden', borderColor: C.textTert, borderWidth: 1 },
          footerNextGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
          footerNextTxt:  { color: 'white', fontSize: 15, fontWeight: '700' },
          footerHint:     { textAlign: 'center', color: C.textTert, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
        });
