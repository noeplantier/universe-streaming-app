import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Pressable,
  KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { C, TONES, GENRES_LIST, ASPECTS, MIN_BODY } from './SocialTokens';
import { dbPublishPost } from '@/hooks/usePostsFeed';
import type { Tone } from './SocialTypes';

const STEPS = ['film','critique','media','preview'] as const;
type CStep = typeof STEPS[number];
const STEP_LBL: Record<CStep, string> = {
  film:"L'Œuvre", critique:'Votre Critique', media:'Illustration', preview:'Aperçu final',
};
const STEP_ICON: Record<CStep, string> = {
  film:'film-outline', critique:'create-outline', media:'image-outline', preview:'eye-outline',
};

interface ComposeState {
  workTitle: string; workYear: string; workDirector: string; workGenre: string;
  rating: number; tone: Tone | null; body: string; tags: string[];
  imageUri: string; imageUrl: string; imageValid: boolean;
}
const INIT: ComposeState = {
  workTitle:'', workYear:'', workDirector:'', workGenre:'',
  rating:0, tone:null, body:'', tags:[],
  imageUri:'', imageUrl:'', imageValid:false,
};

async function uploadImage(localUri: string): Promise<string | null> {
  try {
    const isBlob = localUri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (localUri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg','jpeg','png','webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const name   = `post_${Date.now()}.${ext}`;
    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await (await fetch(localUri)).arrayBuffer();
    } else {
      payload = decode(await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' }));
    }
    const { data, error } = await supabase.storage
      .from('community-images').upload(`posts/${name}`, payload, { contentType: mime, upsert: false });
    if (error) throw error;
    return supabase.storage.from('community-images').getPublicUrl(data.path).data.publicUrl;
  } catch (e) { console.error('[uploadImage]', e); return null; }
}

const StarRating = memo(({ value, onChange, size = 24 }: {
  value: number; onChange?: (v: number) => void; size?: number;
}) => (
  <View style={{ flexDirection: 'row', gap: 3 }}>
    {[1,2,3,4,5].map(s => (
      <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange} hitSlop={6 as any}>
        <Ionicons
          name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
          size={size} color={value >= s || value >= s - 0.5 ? C.gold : C.text}
        />
      </TouchableOpacity>
    ))}
  </View>
));

export default function ComposeModal({
  visible, onClose, onPublished, userId,
}: { visible: boolean; onClose: () => void; onPublished?: () => void; userId: string }) {
  const [step,       setStep]       = useState<CStep>('film');
  const [form,       setForm]       = useState<ComposeState>(INIT);
  const [publishing, setPublishing] = useState(false);
  const [imgLoading, setImgLoad]    = useState(false);
  const [errors,     setErrors]     = useState<Partial<Record<CStep, string>>>({});
  const slideAnim = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (visible) {
      setStep('film'); setForm(INIT); setErrors({});
      Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 800, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const patch  = useCallback(<K extends keyof ComposeState>(k: K, v: ComposeState[K]) =>
    setForm(f => ({ ...f, [k]: v })), []);
  const setErr = (s: CStep, msg: string) => setErrors(e => ({ ...e, [s]: msg }));
  const clrErr = (s: CStep) => setErrors(e => ({ ...e, [s]: '' }));

  const validate = useCallback((s: CStep): string | null => {
    if (s === 'film') {
      if (!form.workTitle.trim()) return "Titre obligatoire.";
      if (!form.workGenre)        return 'Sélectionnez un genre.';
      if (form.rating === 0)      return 'Attribuez au moins une étoile.';
    }
    if (s === 'critique') {
      if (!form.tone)                         return 'Choisissez un ton.';
      if (form.body.trim().length < MIN_BODY) return `Minimum ${MIN_BODY} car. (actuel: ${form.body.trim().length}).`;
    }
    return null;
  }, [form]);

  const goNext = useCallback(() => {
    const err = validate(step);
    if (err) { setErr(step, err); return; }
    clrErr(step);
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  }, [step, validate]);

  const goBack = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }, [step]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', "Autorisez la galerie dans les réglages."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true, aspect: [16,9],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    patch('imageUri', uri); patch('imageValid', false); patch('imageUrl', '');
    setImgLoad(true); clrErr('media');
    const url = await uploadImage(uri);
    setImgLoad(false);
    if (!url) { setErr('media', "Upload échoué. Réessayez."); return; }
    patch('imageUrl', url); patch('imageValid', true);
  }, [patch]);

  const publish = useCallback(async () => {
    if (!form.imageValid) { Alert.alert('Image manquante', 'Une image est obligatoire.'); return; }
    if (!form.tone)       { Alert.alert('Ton manquant', 'Choisissez un ton.'); return; }
    setPublishing(true);
    const id = await dbPublishPost({
      work_title: form.workTitle.trim(), work_year: form.workYear.trim(),
      work_director: form.workDirector.trim(), work_genre: form.workGenre,
      rating: form.rating, body: form.body.trim(),
      image_url: form.imageUrl, image_valid: true,
      tags: form.tags, tone: form.tone,
    });
    setPublishing(false);
    if (id) { onPublished?.(); onClose(); }
    else Alert.alert('Erreur', 'Publication échouée. Réessayez.');
  }, [form, onPublished, onClose]);

  const stepIdx  = STEPS.indexOf(step);
  const bodyLen  = form.body.trim().length;
  const bodyPct  = Math.min(100, (bodyLen / MIN_BODY) * 100);
  const toneInfo = TONES.find(t => t.key === form.tone);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={s.tint} pointerEvents="none" />
            <View style={s.inner}>
              <View style={s.handle} />

              {/* Header */}
              <View style={s.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Nouvelle Critique</Text>
                  <Text style={s.sub}>Cinéma indépendant · Critique argumentée</Text>
                </View>
                <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={15} color={C.textSec} />
                </TouchableOpacity>
              </View>

              {/* Stepper */}
              <View style={s.stepRow}>
                {STEPS.map((st, i) => {
                  const done = i < stepIdx, curr = i === stepIdx;
                  return (
                    <View key={st} style={s.stepItem}>
                      <View style={[s.stepCircle, done && s.stepDone, curr && s.stepCurr]}>
                        {done
                          ? <Ionicons name="checkmark" size={11} color={C.white} />
                          : <Ionicons name={STEP_ICON[st] as any} size={11} color={curr ? C.white : C.textSec} />
                        }
                      </View>
                      <Text style={[s.stepLbl, curr && { color: C.text }, done && { color: C.textSec }]}>
                        {STEP_LBL[st]}
                      </Text>
                      {i < STEPS.length - 1 && <View style={[s.stepLine, done && { backgroundColor: C.navyBright }]} />}
                    </View>
                  );
                })}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.scroll}>

                {/* ── FILM ── */}
                {step === 'film' && (
                  <View style={s.stepWrap}>
                    <Text style={s.sectionHead}>Identifiez l'œuvre</Text>
                    <Text style={s.hint}>Seules les œuvres de cinéma indépendant sont acceptées.</Text>
                    <Field label="TITRE *">
                      <TextInput style={s.input} placeholderTextColor={C.textTert}
                        placeholder="Ex : Portrait de la jeune fille en feu"
                        value={form.workTitle} onChangeText={v => { patch('workTitle', v); clrErr('film'); }} />
                    </Field>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                      <Field label="RÉALISATEUR" style={{ flex: 1 }}>
                        <TextInput style={s.input} placeholder="Nom" placeholderTextColor={C.textTert}
                          value={form.workDirector} onChangeText={v => patch('workDirector', v)} />
                      </Field>
                      <Field label="ANNÉE" style={{ width: 86 }}>
                        <TextInput style={s.input} placeholder="2024" placeholderTextColor={C.textTert}
                          value={form.workYear} onChangeText={v => patch('workYear', v)}
                          keyboardType="numeric" maxLength={4} />
                      </Field>
                    </View>
                    <Field label="GENRE *">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {GENRES_LIST.map(g => {
                          const on = form.workGenre === g;
                          return (
                            <TouchableOpacity key={g}
                              style={[s.chip, on && s.chipOn]}
                              onPress={() => { patch('workGenre', g); clrErr('film'); }}>
                              <Text style={[s.chipTxt, on && { color: C.white }]}>{g}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </Field>
                    <Field label="NOTE *">
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <StarRating value={form.rating} onChange={v => { patch('rating', v); clrErr('film'); }} />
                        <View style={s.ratingBadge}>
                          <Text style={s.ratingTxt}>{form.rating > 0 ? `${form.rating}/5` : '--'}</Text>
                        </View>
                      </View>
                    </Field>
                    {errors.film ? <Text style={s.err}>{errors.film}</Text> : null}
                  </View>
                )}

                {/* ── CRITIQUE ── */}
                {step === 'critique' && (
                  <View style={s.stepWrap}>
                    <Text style={s.sectionHead}>Votre critique</Text>
                    <Text style={s.hint}>Minimum {MIN_BODY} caractères. Argumentez et nuancez.</Text>
                    <Field label="TON *">
                      {[TONES.slice(0,4), TONES.slice(4)].map((row, ri) => (
                        <View key={ri} style={[s.toneGrid, ri > 0 && { marginTop: 10 }]}>
                          {row.map(t => {
                            const on = form.tone === t.key;
                            return (
                              <TouchableOpacity key={t.key}
                                style={[s.toneCard, on && { borderColor: t.color, backgroundColor: `${t.color}16` }]}
                                onPress={() => { patch('tone', t.key); clrErr('critique'); }}>
                                <View style={[s.toneIcon, on && { backgroundColor: `${t.color}22` }]}>
                                  <Ionicons name={t.icon as any} size={20} color={on ? t.color : C.textSec} />
                                </View>
                                <Text style={[s.toneLbl, on && { color: t.color }]}>{t.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </Field>
                    <Field label="CRITIQUE *">
                      <TextInput style={s.textarea} multiline textAlignVertical="top"
                        placeholder="Analysez la mise en scène, le jeu des acteurs, la narration…"
                        placeholderTextColor={C.textTert}
                        value={form.body} onChangeText={v => { patch('body', v); clrErr('critique'); }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <View style={s.charBg}>
                          <View style={[s.charFill, { width: `${bodyPct}%` as any, backgroundColor: bodyLen >= MIN_BODY ? C.green : C.blue }]} />
                        </View>
                        <Text style={[s.charCount, bodyLen >= MIN_BODY && { color: C.green }]}>{bodyLen}/{MIN_BODY}</Text>
                      </View>
                    </Field>
                    <Field label="ASPECTS ABORDÉS (optionnel)">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {ASPECTS.map(tag => {
                          const on = form.tags.includes(tag);
                          return (
                            <TouchableOpacity key={tag}
                              style={[s.chip, on && { borderColor: C.gold, backgroundColor: C.goldDim }]}
                              onPress={() => patch('tags', on ? form.tags.filter(t => t !== tag) : [...form.tags, tag])}>
                              <Text style={[s.chipTxt, on && { color: C.gold }]}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </Field>
                    {errors.critique ? <Text style={s.err}>{errors.critique}</Text> : null}
                  </View>
                )}

                {/* ── MEDIA ── */}
                {step === 'media' && (
                  <View style={s.stepWrap}>
                    <Text style={s.sectionHead}>Illustration</Text>
                    <Text style={s.hint}>Une image de l'œuvre est requise avant publication.</Text>
                    {form.imageUri ? (
                      <View style={s.imgWrap}>
                        <Image source={{ uri: form.imageUri }} style={s.imgPreview} resizeMode="cover" />
                        <LinearGradient colors={['transparent','rgba(2,8,16,0.80)']} style={StyleSheet.absoluteFillObject} />
                        {form.imageValid && !imgLoading && (
                          <View style={s.validBadge}>
                            <Ionicons name="checkmark-circle" size={13} color={C.green} />
                            <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>Image prête</Text>
                          </View>
                        )}
                        {imgLoading && (
                          <View style={s.imgLoader}>
                            <ActivityIndicator color={C.blue} />
                            <Text style={{ color: C.textSec, fontSize: 13, marginTop: 6 }}>Upload…</Text>
                          </View>
                        )}
                        {!imgLoading && (
                          <TouchableOpacity style={s.changeBtn} onPress={pickImage}>
                            <Ionicons name="refresh-outline" size={12} color={C.textSec} />
                            <Text style={{ color: C.textSec, fontSize: 11 }}>Changer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity style={s.pickBtn} onPress={pickImage} disabled={imgLoading}>
                        <View style={s.pickIcon}><Ionicons name="image-outline" size={36} color={C.blue} /></View>
                        <Text style={s.pickTitle}>Sélectionner depuis la galerie</Text>
                        <Text style={s.pickSub}>JPEG · PNG · Format 16:9 recommandé</Text>
                      </TouchableOpacity>
                    )}
                    {errors.media ? <Text style={s.err}>{errors.media}</Text> : null}
                  </View>
                )}

                {/* ── PREVIEW ── */}
                {step === 'preview' && (
                  <View style={s.stepWrap}>
                    <Text style={s.sectionHead}>Aperçu final</Text>
                    <View style={s.previewCard}>
                      {form.imageUrl
                        ? <Image source={{ uri: form.imageUrl }} style={s.previewImg} resizeMode="cover" />
                        : <View style={[s.previewImg, { backgroundColor: C.navyMid }]} />
                      }
                      <LinearGradient colors={['transparent','rgba(2,8,16,0.94)']} style={StyleSheet.absoluteFillObject} />
                      <View style={s.previewOverlay}>
                        {toneInfo && (
                          <View style={[s.tonePill, { backgroundColor: `${toneInfo.color}20`, borderColor: `${toneInfo.color}40` }]}>
                            <Ionicons name={toneInfo.icon as any} size={9} color={toneInfo.color} />
                            <Text style={[s.tonePillTxt, { color: toneInfo.color }]}>{toneInfo.label.toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={s.previewTitle} numberOfLines={2}>{form.workTitle}</Text>
                        <Text style={s.previewMeta}>{[form.workDirector, form.workYear, form.workGenre].filter(Boolean).join(' · ')}</Text>
                        <StarRating value={form.rating} size={13} />
                      </View>
                    </View>
                    <View style={s.previewBody}>
                      <Text style={{ color: C.textSec, fontSize: 14, lineHeight: 22 }} numberOfLines={5}>{form.body}</Text>
                    </View>
                    {form.tags.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                        {form.tags.map(tag => <Text key={tag} style={{ color: C.gold, fontSize: 11, fontWeight: '600' }}>#{tag}</Text>)}
                      </View>
                    )}
                    <View style={s.checklist}>
                      {[
                        { ok: form.workTitle.trim().length > 0, txt: 'Œuvre identifiée' },
                        { ok: form.rating > 0,   txt: 'Note attribuée' },
                        { ok: form.tone !== null, txt: 'Ton défini' },
                        { ok: bodyLen >= MIN_BODY, txt: `Critique ≥ ${MIN_BODY} car.` },
                        { ok: form.imageValid,    txt: 'Image uploadée' },
                      ].map(item => (
                        <View key={item.txt} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                          <Ionicons name={item.ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={item.ok ? C.green : C.textTert} />
                          <Text style={{ color: item.ok ? C.textSec : C.textTert, fontSize: 13 }}>{item.txt}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Footer */}
              <View style={s.footer}>
                {stepIdx > 0 && (
                  <TouchableOpacity style={s.backBtn} onPress={goBack}>
                    <Ionicons name="chevron-back" size={15} color={C.textSec} />
                    <Text style={{ color: C.textSec, fontSize: 14, fontWeight: '600' }}>Retour</Text>
                  </TouchableOpacity>
                )}
                {step !== 'preview' ? (
                  <TouchableOpacity style={[s.nextBtn, stepIdx === 0 && { marginLeft: 'auto' as any }]} onPress={goNext}>
                    <LinearGradient colors={[C.navyBright, C.navyLight]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={s.btnGrad}>
                      <Text style={s.btnTxt}>Continuer</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[s.nextBtn, publishing && { opacity: 0.55 }]} onPress={publish} disabled={publishing}>
                    <LinearGradient colors={[C.blue, C.navyMid]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={s.btnGrad}>
                      {publishing
                        ? <ActivityIndicator color={C.white} size="small" />
                        : <><Ionicons name="send" size={14} color={C.white} /><Text style={s.btnTxt}>Publier</Text></>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ marginBottom: 20 }, style]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,8,16,0.82)' },
  kav:          { flex: 1, justifyContent: 'flex-end' },
  sheet:        { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  tint:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,15,30,0.62)' },
  inner:        { flex: 1 },
  handle:       { width: 38, height: 4, borderRadius: 2, backgroundColor: C.navyLight, alignSelf: 'center', marginTop: 12 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title:        { color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  sub:          { color: C.textTert, fontSize: 11, marginTop: 3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  stepRow:      { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, alignItems: 'flex-start' },
  stepItem:     { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle:   { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepDone:     { backgroundColor: C.navyBright, borderColor: C.navyBright },
  stepCurr:     { backgroundColor: C.navyLight, borderColor: C.borderHi },
  stepLbl:      { color: C.textTert, fontSize: 9, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  stepLine:     { position: 'absolute', top: 14, left: '50%', right: '-50%', height: 1, backgroundColor: C.border },
  scroll:       { flex: 1 },
  stepWrap:     { paddingHorizontal: 20 },
  sectionHead:  { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 5, letterSpacing: -0.3 },
  hint:         { color: C.textTert, fontSize: 12, lineHeight: 17, marginBottom: 20 },
  label:        { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input:        { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15 },
  textarea:     { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 14, minHeight: 140, lineHeight: 22 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:       { borderColor: C.borderHi, backgroundColor: C.navyLight },
  chipTxt:      { color: C.textSec, fontSize: 13, fontWeight: '600' },
  ratingBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.goldDim, borderWidth: 1, borderColor: C.goldEdge },
  ratingTxt:    { color: C.gold, fontSize: 14, fontWeight: '800' },
  toneGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  toneCard:     { width: '48%', paddingVertical: 16, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 8 },
  toneIcon:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.navyMid, justifyContent: 'center', alignItems: 'center' },
  toneLbl:      { color: C.textSec, fontSize: 13, fontWeight: '700' },
  charBg:       { flex: 1, height: 2, borderRadius: 1, backgroundColor: C.surf, overflow: 'hidden' },
  charFill:     { height: '100%', borderRadius: 1 },
  charCount:    { color: C.textSec, fontSize: 11, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  imgWrap:      { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  imgPreview:   { width: '100%', height: '100%' },
  validBadge:   { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(2,8,16,0.80)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  imgLoader:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,8,16,0.65)', alignItems: 'center', justifyContent: 'center' },
  changeBtn:    { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,8,16,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  pickBtn:      { height: 180, borderRadius: 16, borderWidth: 1, borderColor: C.borderBlue, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  pickIcon:     { width: 64, height: 64, borderRadius: 32, backgroundColor: C.blueDim, justifyContent: 'center', alignItems: 'center' },
  pickTitle:    { color: C.text, fontSize: 14, fontWeight: '700' },
  pickSub:      { color: C.textSec, fontSize: 11 },
  err:          { color: C.red, fontSize: 12, marginBottom: 12, fontWeight: '600' },
  previewCard:  { height: 200, borderRadius: 18, overflow: 'hidden', marginBottom: 16, backgroundColor: C.navyMid },
  previewImg:   { width: '100%', height: '100%' },
  previewOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  previewTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginBottom: 2, letterSpacing: -0.3 },
  previewMeta:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 7 },
  tonePill:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginBottom: 7 },
  tonePillTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  previewBody:  { backgroundColor: C.surf, borderRadius: 14, padding: 14, marginBottom: 14 },
  checklist:    { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 11, marginBottom: 16 },
  footer:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 12 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
  nextBtn:      { flex: 1, borderRadius: 22, overflow: 'hidden' },
  btnGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnTxt:       { color: C.white, fontSize: 15, fontWeight: '700' },
});