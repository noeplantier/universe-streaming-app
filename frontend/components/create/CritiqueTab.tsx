import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  navyMid:  'rgba(13,34,64,0.55)',
  navyLow:  'rgba(13,34,64,0.30)',
  navyHigh: 'rgba(13,34,64,0.82)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.18)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  muted:    'rgba(255,255,255,0.38)',
  faint:    'rgba(255,255,255,0.14)',
  neon:     '#7C5EFC',
  neonL:    '#A78BFA',
  gold:     '#F5C842',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tags prédéfinis
// ─────────────────────────────────────────────────────────────────────────────
const PRESET_TAGS = [
  'Chef-d\'œuvre','Indispensable','Bouleversant','Surprenant',
  'Rythmé','Contemplatif','Novateur','Classique','Décevant',
  'Court mais intense','Série à binge','Humour fin',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ReelSuggestion {
  id:    string;
  title: string | null;
  genre: string | null;
  year:  string | null;
}

interface Form {
  title:     string;   // titre de la critique
  filmTitle: string;   // film_title (titre du film ou de la série)
  content:   string;   // texte de la critique
  rating:    number;   // 0 = non noté
  tags:      string[];
  reelId:    string | null;
}

const EMPTY: Form = {
  title: '', filmTitle: '', content: '',
  rating: 0, tags: [], reelId: null,
};

// Labels rating
const RATING_LABEL: Record<number, string> = {
  1: 'Médiocre', 2: 'Passable', 3: 'Bien', 4: 'Très bien', 5: 'Chef-d\'œuvre',
};

// ─────────────────────────────────────────────────────────────────────────────
// Étoiles
// ─────────────────────────────────────────────────────────────────────────────
const StarRow = memo(function StarRow({
  value, onChange,
}: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={sr.wrap}>
      <View style={sr.stars}>
        {[1,2,3,4,5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onChange(n === value ? 0 : n);
            }}
            hitSlop={{ top:8, bottom:8, left:4, right:4 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={n <= value ? 'star' : 'star-outline'}
              size={32}
              color={n <= value ? C.gold : C.muted}
            />
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 && <Text style={sr.label}>{RATING_LABEL[value]}</Text>}
    </View>
  );
});
const sr = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 6, paddingVertical: 8 },
  stars: { flexDirection: 'row', gap: 8 },
  label: { color: C.gold, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion de reel
// ─────────────────────────────────────────────────────────────────────────────
const ReelRow = memo(function ReelRow({
  reel, selected, onPress,
}: { reel: ReelSuggestion; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[rr.row, selected && rr.rowOn]} onPress={onPress} activeOpacity={0.80}>
      <View style={rr.icon}>
        <Ionicons name="videocam" size={13} color={selected ? "#fff" : C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rr.title} numberOfLines={1}>{reel.title ?? 'Sans titre'}</Text>
        <Text style={rr.meta} numberOfLines={1}>
          {[reel.genre, reel.year].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {selected
        ? <Ionicons name="checkmark-circle" size={18} color={"#fff"} />
        : <Ionicons name="link-outline" size={14} color={"#fff"} />
      }
    </TouchableOpacity>
  );
});
const rr = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', gap:10, padding:12, borderRadius:12, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, marginBottom:8 },
  rowOn: { backgroundColor:C.navyMid, borderColor:C.navyMid },
  icon:  { width:32, height:32, borderRadius:8, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center' },
  title: { color:C.white, fontSize:13, fontWeight:'700' },
  meta:  { color:C.muted, fontSize:10, marginTop:1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────
function SectionHead({ step, label, done }: { step: number; label: string; done?: boolean }) {
  return (
    <View style={sh.wrap}>
      <View style={[sh.badge, done && sh.badgeDone]}>
        {done
          ? <Ionicons name="checkmark" size={11} color={C.white} />
          : <Text style={sh.badgeTxt}>{step}</Text>
        }
      </View>
      <Text style={sh.label}>{label}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  wrap:     { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
  badge:    { width:24, height:24, borderRadius:12, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.borderBr, alignItems:'center', justifyContent:'center' },
  badgeDone:{ backgroundColor:C.navyMid, borderColor:"#fff" },
  badgeTxt: { color:C.muted, fontSize:10, fontWeight:'800' },
  label:    { color:C.offWhite, fontSize:14, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CritiqueTab
// ─────────────────────────────────────────────────────────────────────────────
const CritiqueTab = memo(function CritiqueTab() {
  const [form,       setForm]       = useState<Form>(EMPTY);
  const [reelSearch, setReelSearch] = useState('');
  const [reelList,   setReelList]   = useState<ReelSuggestion[]>([]);
  const [reelBusy,   setReelBusy]   = useState(false);
  const [showReels,  setShowReels]  = useState(false);
  const [tagInput,   setTagInput]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const debounce  = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef = useRef<ScrollView>(null);

  // ── Recherche de reels liés ────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounce.current);
    if (!reelSearch.trim()) { setReelList([]); return; }
    setReelBusy(true);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('reels')
        .select('id,title,genre,year')
        .ilike('title', `%${reelSearch}%`)
        .order('created_at', { ascending: false })
        .limit(10);
      setReelList((data ?? []) as ReelSuggestion[]);
      setReelBusy(false);
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [reelSearch]);

  const set = useCallback((k: keyof Form) => (v: any) => setForm(f => ({...f, [k]: v})), []);

  // Synchro filmTitle ↔ reel sélectionné
  const selectReel = useCallback((r: ReelSuggestion | null) => {
    if (!r) {
      setForm(f => ({...f, reelId: null}));
    } else {
      setForm(f => ({
        ...f,
        reelId:    r.id,
        filmTitle: f.filmTitle || r.title || '',
      }));
    }
    setShowReels(false);
    setReelSearch('');
  }, []);

  // Tags
  const addTag = useCallback((t: string) => {
    const tag = t.trim();
    if (!tag || form.tags.includes(tag) || form.tags.length >= 8) return;
    setForm(f => ({...f, tags: [...f.tags, tag]}));
    setTagInput('');
  }, [form.tags]);

  const removeTag = useCallback((t: string) => {
    setForm(f => ({...f, tags: f.tags.filter(x => x !== t)}));
  }, []);

  const reset = useCallback(() => {
    setForm(EMPTY); setTagInput(''); setDone(false); setError(null);
    setReelSearch(''); setReelList([]); setShowReels(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    setError(null);
    if (!form.title.trim()) { setError('Le titre de la critique est obligatoire.'); return; }
    if (!form.filmTitle.trim()) { setError('Le titre de l\'œuvre est obligatoire.'); return; }
    if (form.content.trim().length < 20) { setError('La critique doit faire au moins 20 caractères.'); return; }

    setSubmitting(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Non authentifié. Connecte-toi d\'abord.');

      const payload: Record<string, any> = {
        user_id: user.id,
        title: form.title.trim(),
        film_title: form.filmTitle.trim(),
        content: form.content.trim(),
        rating: form.rating > 0 ? form.rating : null,
        tags: form.tags.length > 0 ? form.tags : null,
        reel_id: form.reelId ?? null,
      };

      const { error: insErr } = await supabase.from('critiques').insert(payload);
      
      if (insErr) {
        console.error("Erreur d'insertion :", insErr);
        throw new Error(insErr.message);
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      setDone(true);
      setTimeout(reset, 3000);

    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue lors de la publication.');
    } finally {
      setSubmitting(false);
    }
  }, [form, reset]);

  // Validation pour activer/désactiver le bouton
  const canSubmit =
    !!form.title.trim() &&
    !!form.filmTitle.trim() &&
    form.content.trim().length >= 20 &&
    !submitting && !done;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={140}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={ct.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Intro ──────────────────────────────────────────────────── */}
        <View style={ct.intro}>
          <View style={ct.introIcon}>
            <Ionicons name="create" size={20} color={"#fff"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ct.introTitle}>Nouvelle critique</Text>
            <Text style={ct.introSub}>Analyse un film, un reel ou une série</Text>
          </View>
        </View>

        {/* ── ÉTAPE 1 : Titre de la critique ──────────────────────────── */}
        <View style={ct.section}>
          <SectionHead step={1} label="Titre de ta critique" done={!!form.title.trim()} />
          <TextInput
            style={ct.input}
            value={form.title}
            onChangeText={set('title')}
            placeholder="Ex : Un chef-d'œuvre contemplatif"
            placeholderTextColor={C.muted}
            selectionColor={C.neonL}
            maxLength={120}
            returnKeyType="next"
            autoCapitalize="sentences"
          />
        </View>

        {/* ── ÉTAPE 2 : Film / reel ──────────────────────────────────── */}
        <View style={ct.section}>
          <SectionHead step={2} label="Oeuvre liée à ta critique" done={!!form.filmTitle.trim()} />

          <TextInput
            style={ct.input}
            value={form.filmTitle}
            onChangeText={set('filmTitle')}
            placeholder="Ex : Inception"
            placeholderTextColor={C.muted}
            selectionColor={C.neonL}
            maxLength={120}
            returnKeyType="next"
            autoCapitalize="sentences"
          />

          {/* Lien optionnel à un reel */}
          <TouchableOpacity
            style={ct.linkBtn}
            onPress={() => setShowReels(o => !o)}
            activeOpacity={0.80}
          >
            <Ionicons
              name={form.reelId ? 'link' : 'link-outline'}
              size={14}
              color={form.reelId ? "#fff" : C.muted}
            />
            <Text style={[ct.linkTxt, form.reelId && { color: "#fff" }]}>
              {form.reelId ? 'Oeuvre liée ✓' : 'Lier à une œuvre'}
            </Text>
            <Ionicons name={showReels ? 'chevron-up' : 'chevron-down'} size={12} color={C.muted} />
          </TouchableOpacity>

          {showReels && (
            <View style={ct.reelPanel}>
              {/* Search */}
              <View style={ct.searchBar}>
                <Ionicons name="search" size={13} color={C.muted} />
                <TextInput
                  style={ct.searchInput}
                  value={reelSearch}
                  onChangeText={setReelSearch}
                  placeholder="Titre de l'oeuvre à associer…"
                  placeholderTextColor={C.muted}
                  selectionColor={"#fff"}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {reelBusy && <ActivityIndicator size="small" color={C.navyMid} />}
              </View>

              {/* Résultats */}
              {reelList.map(r => (
                <ReelRow
                  key={r.id}
                  reel={r}
                  selected={form.reelId === r.id}
                  onPress={() => selectReel(form.reelId === r.id ? null : r)}
                />
              ))}

              {!!form.reelId && (
                <TouchableOpacity style={ct.unlinkBtn} onPress={() => selectReel(null)}>
                  <Ionicons name="close-circle-outline" size={13} color={C.muted} />
                  <Text style={ct.unlinkTxt}>Délier le reel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── ÉTAPE 3 : Note ─────────────────────────────────────────── */}
        <View style={ct.section}>
          <SectionHead step={3} label="Note (optionnelle)" done={form.rating > 0} />
          <StarRow value={form.rating} onChange={set('rating')} />
        </View>

        {/* ── ÉTAPE 4 : Critique ─────────────────────────────────────── */}
        <View style={ct.section}>
          <SectionHead step={4} label="Ta critique" done={form.content.trim().length >= 20} />

          {/* Tips si vide */}
          {!form.content && (
            <View style={ct.tips}>
              <Text style={ct.tipsHead}>Idées pour commencer</Text>
              {[
                'La mise en scène et les choix visuels',
                'Le jeu des acteurs ou la narration',
                'Ce qui t\'a surpris, touché ou déçu',
                'Pour qui recommanderais-tu cette œuvre ?',
              ].map((tip, i) => <Text key={i} style={ct.tip}>· {tip}</Text>)}
            </View>
          )}

          <TextInput
            style={ct.textarea}
            value={form.content}
            onChangeText={set('content')}
            placeholder="Rédige ton analyse…"
            placeholderTextColor={C.muted}
            multiline
            maxLength={2000}
            selectionColor={C.navyMid}
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
            scrollEnabled={false}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={ct.charHelp}>
              {form.content.trim().length < 20
                ? `Encore ${Math.max(0, 20 - form.content.trim().length)} caractères`
                : '✓ Longueur suffisante'}
            </Text>
            <Text style={ct.charCount}>{form.content.length}/2000</Text>
          </View>
        </View>

        {/* ── ÉTAPE 5 : Tags ─────────────────────────────────────────── */}
        <View style={ct.section}>
          <SectionHead step={5} label="Tags (optionnel)" />

          {/* Tags prédéfinis */}
          <View style={ct.chipGrid}>
            {PRESET_TAGS.map(t => {
              const on = form.tags.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[ct.chip, on && ct.chipOn]}
                  onPress={() => on ? removeTag(t) : addTag(t)}
                  activeOpacity={0.76}
                >
                  <Text style={[ct.chipTxt, on && ct.chipTxtOn]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tag personnalisé */}
          <View style={ct.tagInputRow}>
            <TextInput
              style={ct.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={() => addTag(tagInput)}
              placeholder="Ajouter un tag…"
              placeholderTextColor={C.muted}
              selectionColor={C.navyMid}
              returnKeyType="done"
              autoCapitalize="none"
            />
         
          </View>

          {/* Tags sélectionnés */}
          {form.tags.length > 0 && (
            <View style={ct.tagsRow}>
              {form.tags.map(t => (
                <TouchableOpacity key={t} style={ct.tagBadge} onPress={() => removeTag(t)}>
                  <Text style={ct.tagBadgeTxt}>{t}</Text>
                  <Ionicons name="close" size={10} color={C.navyMid} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Erreur / Succès ─────────────────────────────────────────── */}
        {!!error && (
          <View style={ct.msgError}>
            <Ionicons name="warning-outline" size={15} color={C.error} />
            <Text style={ct.msgErrorTxt}>{error}</Text>
          </View>
        )}
        {done && (
          <View style={ct.msgSuccess}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={ct.msgSuccessTxt}>Critique publiée avec succès !</Text>
          </View>
        )}

        {/* ── Bouton ─────────────────────────────────────────────────── */}
        {!done && (
          <TouchableOpacity
            style={[ct.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]}
            onPress={submit}
            activeOpacity={0.84}
            disabled={!canSubmit}
          >
            {submitting
              ? <ActivityIndicator color={C.white} size="small" />
              : <Ionicons name="send" size={16} color={C.white} />
            }
            <Text style={ct.submitTxt}>
              {submitting ? 'Publication…' : 'Publier la critique'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

export default CritiqueTab;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const ct = StyleSheet.create({
  scroll:   { paddingHorizontal: 16, paddingTop: 4 },

  intro:     {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.navyMid, borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: 20,
  },
  introIcon: {
    width:42, height:42, borderRadius:21, backgroundColor:C.navyHigh,
    alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.borderBr,
  },
  introTitle:{ color:C.white, fontSize:15, fontWeight:'800' },
  introSub:  { color:C.muted, fontSize:11, marginTop:2 },

  section:   { marginBottom: 24 },

  input: {
    backgroundColor: C.navyMid, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, color: C.white, fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    marginBottom: 10,
  },

  // Lien reel
  linkBtn:   { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:8, paddingHorizontal:4 },
  linkTxt:   { color:C.muted, fontSize:12, fontWeight:'600', flex:1 },

  reelPanel: { backgroundColor: C.navyLow, borderRadius: 14, padding: 12, marginTop: 6, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  searchBar: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navyMid, borderRadius:10, paddingHorizontal:12, height:38, marginBottom:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  searchInput:{ flex:1, color:C.white, fontSize:13 },
  unlinkBtn: { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:6 },
  unlinkTxt: { color:C.muted, fontSize:11 },

  // Textarea
  textarea: {
    backgroundColor: C.navyMid, borderRadius: 14, padding: 14,
    color: C.white, fontSize: 14, lineHeight: 22,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    minHeight: 160, textAlignVertical: 'top',
  },
  charHelp:  { color:C.muted, fontSize:10 },
  charCount: { color:C.muted, fontSize:10 },

  // Tips
  tips:     { backgroundColor:C.navyLow, borderRadius:12, padding:12, marginBottom:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, gap:5 },
  tipsHead: { color:"#fff", fontSize:11, fontWeight:'700', marginBottom:2 },
  tip:      { color:C.muted, fontSize:11, lineHeight:16 },

  // Tags prédéfinis
  chipGrid: { flexDirection:'row', flexWrap:'wrap', gap:7, marginBottom:12 },
  chip:     { paddingHorizontal:11, paddingVertical:6, borderRadius:20, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border },
  chipOn:   { backgroundColor:C.navyMid, borderColor:"#fff" },
  chipTxt:  { color:C.muted, fontSize:11, fontWeight:'600' },
  chipTxtOn:{ color:C.white, fontWeight:'700' },

  // Tag custom
  tagInputRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 },
  tagInput:    { flex:1, backgroundColor:C.navyMid, borderRadius:10, paddingHorizontal:12, height:38, color:C.white, fontSize:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  tagAddBtn:   { width:38, height:38, borderRadius:10, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:"#fff" },

  tagsRow:    { flexDirection:'row', flexWrap:'wrap', gap:7 },
  tagBadge:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:20, backgroundColor:C.navyMid, borderWidth:1, borderColor:"#fff" },
  tagBadgeTxt:{ color:"#fff", fontSize:11, fontWeight:'600' },

  // Messages
  msgError:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(239,68,68,0.12)', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'rgba(239,68,68,0.25)' },
  msgErrorTxt: { flex:1, color:'#FCA5A5', fontSize:12 },
  msgSuccess:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(34,197,94,0.12)', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'rgba(34,197,94,0.25)' },
  msgSuccessTxt:{ color:'#86EFAC', fontSize:13, fontWeight:'700' },

  submitBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:C.navyMid, borderRadius:16, paddingVertical:15, marginBottom:12, borderColor:C.border, borderWidth:StyleSheet.hairlineWidth },
  submitOff: { backgroundColor:C.navyMid },
  submitTxt: { color:'#fff', fontSize:15, fontWeight:'800' },
});