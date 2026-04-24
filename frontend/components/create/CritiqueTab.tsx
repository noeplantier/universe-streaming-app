/* eslint-disable react/display-name */
/**
 * CritiqueTab.tsx — Critiques de cinéma indépendant
 *
 * ⚠️  MODE PUBLIC : aucune authentification requise.
 *      Tout visiteur peut créer, modifier et supprimer une critique.
 *
 * Côté Supabase, assurez-vous que la table `critiques` dispose
 * de ces RLS policies (ou que RLS est désactivé sur cette table) :
 *
 *   -- Lecture publique
 *   CREATE POLICY "public_select" ON critiques FOR SELECT USING (true);
 *
 *   -- Insertion publique
 *   CREATE POLICY "public_insert" ON critiques FOR INSERT WITH CHECK (true);
 *
 *   -- Modification publique
 *   CREATE POLICY "public_update" ON critiques FOR UPDATE USING (true);
 *
 *   -- Suppression publique
 *   CREATE POLICY "public_delete" ON critiques FOR DELETE USING (true);
 *
 * UI : exclusivement navyMid + transparents → GalaxyBackground visible.
 */

import React, {
    useState, useEffect, useCallback, memo, useRef,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Animated, Platform,
  } from 'react-native';
  import { BlurView }  from 'expo-blur';
  import { Ionicons }  from '@expo/vector-icons';
  import * as Haptics  from 'expo-haptics';
  import { supabase }  from '@/lib/supabase';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TYPES
  // ─────────────────────────────────────────────────────────────────────────────
  interface Critique {
    id:         string;
    film_title: string;
    titre:      string;
    contenu:    string;
    note:       number | null;
    tags:       string[];
    author:     string | null; // pseudo libre, pas d'auth
    created_at: string;
    updated_at: string;
  }
  
  interface FormState {
    film_title: string;
    titre:      string;
    contenu:    string;
    note:       number | null;
    tags:       string[];
    author:     string;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PALETTE — navyMid + transparents uniquement
  // ─────────────────────────────────────────────────────────────────────────────
  const G = {
    // Surfaces semi-transparentes → galaxy visible
    surface:     'rgba(10,22,40,0.50)',
    surfaceLow:  'rgba(10,22,40,0.25)',
    surfaceHi:   'rgba(13,34,64,0.68)',
  
    // Borders
    edge:        'rgba(255,255,255,0.07)',
    edgeMid:     'rgba(255,255,255,0.13)',
    edgeHi:      'rgba(255,255,255,0.22)',
  
    // Accents
    teal:        '#00C9FF',
    tealSoft:    'rgba(0,201,255,0.10)',
    tealEdge:    'rgba(0,201,255,0.24)',
    purple:      '#7C3AED',
    purpleSoft:  'rgba(124,58,237,0.10)',
    purpleEdge:  'rgba(124,58,237,0.24)',
    gold:        '#F5C842',
    red:         '#FF3B5C',
    redSoft:     'rgba(255,59,92,0.10)',
    redEdge:     'rgba(255,59,92,0.26)',
  
    // Text
    text:        '#EDF6FF',
    textSec:     'rgba(255,255,255,0.52)',
    textTert:    'rgba(255,255,255,0.26)',
  } as const;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS — validation & sanitize
  // ─────────────────────────────────────────────────────────────────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUUID  = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
  const cap     = (v: string, max = 255)    => v.trim().slice(0, max);
  
  const BLANK: FormState = {
    film_title: '', titre: '', contenu: '',
    note: null, tags: [], author: '',
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STAR RATING
  // ─────────────────────────────────────────────────────────────────────────────
  const StarRating = memo(function StarRating({
    value, onChange, readonly = false,
  }: { value: number | null; onChange?: (n: number) => void; readonly?: boolean }) {
    return (
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <TouchableOpacity
            key={i}
            disabled={readonly}
            onPress={() => onChange?.(i === value ? 0 : i)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 5, right: 5 }}
          >
            <Ionicons
              name={value !== null && i <= value ? 'star' : 'star-outline'}
              size={readonly ? 12 : 24}
              color={value !== null && i <= value ? G.gold : G.textTert}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TAG INPUT
  // ─────────────────────────────────────────────────────────────────────────────
  const TagInput = memo(function TagInput({
    tags, onChange,
  }: { tags: string[]; onChange: (t: string[]) => void }) {
    const [input, setInput] = useState('');
  
    const addTag = useCallback(() => {
      const clean = input.trim().toLowerCase()
        .replace(/[^a-z0-9àâäéèêëîïôùûüç]/g, '')
        .slice(0, 30);
      if (clean && !tags.includes(clean) && tags.length < 6) {
        onChange([...tags, clean]);
      }
      setInput('');
    }, [input, tags, onChange]);
  
    const removeTag = useCallback(
      (t: string) => onChange(tags.filter(x => x !== t)),
      [tags, onChange],
    );
  
    return (
      <View>
        <View style={ti.row}>
          <TextInput
            style={ti.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addTag}
            placeholder="Ajouter un tag…"
            placeholderTextColor={G.textTert}
            returnKeyType="done"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={ti.addBtn}
            onPress={addTag}
            disabled={tags.length >= 6}
            activeOpacity={0.8}
          >
            <Ionicons
              name="add"
              size={18}
              color={tags.length >= 6 ? G.textTert : G.teal}
            />
          </TouchableOpacity>
        </View>
        {tags.length > 0 && (
          <View style={ti.tagsWrap}>
            {tags.map(t => (
              <TouchableOpacity
                key={t}
                style={ti.tag}
                onPress={() => removeTag(t)}
                activeOpacity={0.75}
              >
                <Text style={ti.tagTxt}>#{t}</Text>
                <Ionicons name="close" size={11} color={G.teal} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  });
  
  const ti = StyleSheet.create({
    row:      { flexDirection: 'row', gap: 8 },
    input:    { flex: 1, borderRadius: 12, borderWidth: 0.5, borderColor: G.edgeMid, paddingHorizontal: 14, paddingVertical: 11, color: G.text, fontSize: 14, backgroundColor: 'transparent' },
    addBtn:   { width: 44, height: 44, borderRadius: 12, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge, alignItems: 'center', justifyContent: 'center' },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    tag:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge },
    tagTxt:   { color: G.teal, fontSize: 12, fontWeight: '600' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CRITIQUE CARD — totalement transparent / navyMid
  // ─────────────────────────────────────────────────────────────────────────────
  const CritiqueCard = memo(function CritiqueCard({
    item, onEdit, onDelete,
  }: { item: Critique; onEdit: () => void; onDelete: () => void }) {
    const date = new Date(item.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  
    return (
      <View style={cc.wrap}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 10 : 6}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={cc.inner}>
          {/* Header */}
          <View style={cc.header}>
            <View style={{ flex: 1 }}>
              <Text style={cc.filmLabel} numberOfLines={1}>{item.film_title}</Text>
              <Text style={cc.titre} numberOfLines={1}>{item.titre}</Text>
            </View>
            <View style={cc.actions}>
              <TouchableOpacity
                style={cc.actionBtn}
                onPress={onEdit}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="pencil-outline" size={14} color={G.teal} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[cc.actionBtn, cc.actionBtnRed]}
                onPress={onDelete}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="trash-outline" size={14} color={G.red} />
              </TouchableOpacity>
            </View>
          </View>
  
          {/* Note */}
          {item.note !== null && (
            <View style={cc.noteRow}>
              <StarRating value={item.note} readonly />
              <Text style={cc.noteLabel}>{item.note}/5</Text>
            </View>
          )}
  
          {/* Contenu */}
          <Text style={cc.contenu} numberOfLines={3}>{item.contenu}</Text>
  
          {/* Tags */}
          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={cc.tagsRow}
            >
              {item.tags.map(tag => (
                <View key={tag} style={cc.tag}>
                  <Text style={cc.tagTxt}>#{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}
  
          {/* Footer */}
          <View style={cc.footer}>
            {item.author ? (
              <View style={cc.authorBadge}>
                <Ionicons name="person-outline" size={10} color={G.teal} />
                <Text style={cc.authorTxt} numberOfLines={1}>{item.author}</Text>
              </View>
            ) : <View />}
            <Text style={cc.date}>{date}</Text>
          </View>
        </View>
      </View>
    );
  });
  
  const cc = StyleSheet.create({
    wrap:          { borderRadius: 20, borderWidth: 0.5, borderColor: G.edgeMid, overflow: 'hidden', marginBottom: 14, backgroundColor: G.surface },
    inner:         { padding: 16 },
    header:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
    filmLabel:     { color: G.teal, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    titre:         { color: G.text, fontSize: 15, fontWeight: '800' },
    actions:       { flexDirection: 'row', gap: 8 },
    actionBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', borderWidth: 0.5, borderColor: G.edgeMid, alignItems: 'center', justifyContent: 'center' },
    actionBtnRed:  { borderColor: G.redEdge },
    noteRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    noteLabel:     { color: G.textTert, fontSize: 11 },
    contenu:       { color: G.textSec, fontSize: 13, lineHeight: 20, marginBottom: 10 },
    tagsRow:       { gap: 6, marginBottom: 10 },
    tag:           { paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 8, backgroundColor: G.purpleSoft, borderWidth: 0.5, borderColor: G.purpleEdge },
    tagTxt:        { color: '#A78BFA', fontSize: 11, fontWeight: '600' },
    footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    authorBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge, maxWidth: 160 },
    authorTxt:     { color: G.teal, fontSize: 10, fontWeight: '600', flexShrink: 1 },
    date:          { color: G.textTert, fontSize: 10 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────────────────────────────────────────
  const EmptyState = memo(function EmptyState({ onNew }: { onNew: () => void }) {
    return (
      <View style={es.wrap}>
        <View style={es.iconWrap}>
          <Ionicons name="document-text-outline" size={28} color={G.teal} />
        </View>
        <Text style={es.title}>Aucune critique</Text>
        <Text style={es.sub}>
          Soyez le premier à rédiger une analyse — un regard critique sur le cinéma indépendant.
        </Text>
        <TouchableOpacity style={es.cta} onPress={onNew} activeOpacity={0.85}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 14 : 8}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={es.ctaInner}>
            <Ionicons name="add" size={16} color="white" />
            <Text style={es.ctaTxt}>Écrire une critique</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  });
  
  const es = StyleSheet.create({
    wrap:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title:    { color: G.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
    sub:      { color: G.textTert, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 28, fontStyle: 'italic' },
    cta:      { borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: G.purpleEdge, backgroundColor: G.purpleSoft },
    ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
    ctaTxt:   { color: 'white', fontSize: 14, fontWeight: '700' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FORM — totalement public, champ auteur optionnel
  // ─────────────────────────────────────────────────────────────────────────────
  const CritiqueForm = memo(function CritiqueForm({
    initial, saving, onSave, onCancel,
  }: {
    initial: FormState; saving: boolean;
    onSave: (f: FormState) => void; onCancel: () => void;
  }) {
    const [form, setForm] = useState<FormState>(initial);
    const patch = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
      setForm(f => ({ ...f, [k]: v }));
    }, []);
  
    const canSave =
      form.film_title.trim().length > 0 &&
      form.titre.trim().length > 0 &&
      form.contenu.trim().length >= 10;
  
    return (
      <ScrollView
        contentContainerStyle={frm.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header row */}
        <View style={frm.headerRow}>
          <TouchableOpacity
            onPress={onCancel}
            style={frm.cancelBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={G.textSec} />
            <Text style={frm.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
  
          <TouchableOpacity
            style={[frm.saveBtn, !canSave && { opacity: 0.36 }]}
            onPress={() => canSave && onSave(form)}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 14 : 8}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
            <View style={frm.saveBtnInner}>
              {saving
                ? <ActivityIndicator size="small" color="white" />
                : (
                  <>
                    <Ionicons name="checkmark" size={15} color="white" />
                    <Text style={frm.saveTxt}>Publier</Text>
                  </>
                )
              }
            </View>
          </TouchableOpacity>
        </View>
  
        <Text style={frm.sectionTitle}>
          {initial.titre ? 'Modifier la critique' : 'Nouvelle critique'}
        </Text>
        <Text style={frm.hint}>Aucune connexion requise — publiez anonymement ou avec un pseudo.</Text>
  
        {/* Auteur (optionnel) */}
        <View style={frm.field}>
          <Text style={frm.label}>
            PSEUDO <Text style={{ color: G.textTert, fontWeight: '400' }}>(optionnel)</Text>
          </Text>
          <View style={frm.inputWrap}>
            <TextInput
              style={frm.input}
              placeholder="Votre nom ou pseudonyme…"
              placeholderTextColor={G.textTert}
              value={form.author}
              onChangeText={v => patch('author', v)}
              maxLength={80}
              returnKeyType="next"
            />
          </View>
        </View>
  
        {/* Film */}
        <View style={frm.field}>
          <Text style={frm.label}>FILM ANALYSÉ *</Text>
          <View style={frm.inputWrap}>
            <TextInput
              style={frm.input}
              placeholder="Titre du film"
              placeholderTextColor={G.textTert}
              value={form.film_title}
              onChangeText={v => patch('film_title', v)}
              maxLength={200}
              returnKeyType="next"
            />
          </View>
        </View>
  
        {/* Titre critique */}
        <View style={frm.field}>
          <Text style={frm.label}>TITRE DE LA CRITIQUE *</Text>
          <View style={frm.inputWrap}>
            <TextInput
              style={frm.input}
              placeholder="Ex : Sur la lumière et le silence"
              placeholderTextColor={G.textTert}
              value={form.titre}
              onChangeText={v => patch('titre', v)}
              maxLength={200}
              returnKeyType="next"
            />
          </View>
        </View>
  
        {/* Note */}
        <View style={frm.field}>
          <Text style={frm.label}>
            NOTE <Text style={{ color: G.textTert, fontWeight: '400' }}>(optionnel)</Text>
          </Text>
          <StarRating
            value={form.note}
            onChange={v => patch('note', v === 0 ? null : v)}
          />
        </View>
  
        {/* Contenu */}
        <View style={frm.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={frm.label}>
              CRITIQUE * <Text style={{ color: G.textTert, fontWeight: '400' }}>(min 10 car.)</Text>
            </Text>
            <Text style={{ color: G.textTert, fontSize: 10 }}>{form.contenu.length}/1200</Text>
          </View>
          <View style={frm.inputWrap}>
            <TextInput
              style={[frm.input, frm.textarea]}
              multiline
              placeholder="Votre analyse, vos intentions de mise en scène, ce qui a fonctionné ou non…"
              placeholderTextColor={G.textTert}
              value={form.contenu}
              onChangeText={v => v.length <= 1200 && patch('contenu', v)}
              textAlignVertical="top"
              maxLength={1200}
            />
          </View>
        </View>
  
        {/* Tags */}
        <View style={frm.field}>
          <Text style={frm.label}>
            TAGS <Text style={{ color: G.textTert, fontWeight: '400' }}>(max 6)</Text>
          </Text>
          <TagInput tags={form.tags} onChange={v => patch('tags', v)} />
        </View>
  
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  });
  
  const frm = StyleSheet.create({
    scroll:       { paddingHorizontal: 20, paddingTop: 12 },
    headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    cancelBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cancelTxt:    { color: G.textSec, fontSize: 14, fontWeight: '600' },
    saveBtn:      { borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: G.purpleEdge },
    saveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10 },
    saveTxt:      { color: 'white', fontSize: 14, fontWeight: '700' },
    sectionTitle: { color: G.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    hint:         { color: G.textTert, fontSize: 12, lineHeight: 18, marginBottom: 24, fontStyle: 'italic' },
    field:        { marginBottom: 20 },
    label:        { color: G.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
    inputWrap:    { borderRadius: 14, borderWidth: 0.5, borderColor: G.edgeMid, overflow: 'hidden', backgroundColor: G.surfaceLow },
    input:        { paddingHorizontal: 16, paddingVertical: 13, color: G.text, fontSize: 14, backgroundColor: 'transparent' },
    textarea:     { minHeight: 160, lineHeight: 22 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN — CritiqueTab (entièrement public)
  // ─────────────────────────────────────────────────────────────────────────────
  type ScreenView = 'list' | 'form';
  
  export default function CritiqueTab() {
    const [view,       setView]       = useState<ScreenView>('list');
    const [critiques,  setCritiques]  = useState<Critique[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [editTarget, setEditTarget] = useState<Critique | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
  
    // ── FETCH — public, aucune restriction user ────────────────────────────────
    const fetchAll = useCallback(async () => {
      setLoading(true);
      fadeAnim.setValue(0);
      try {
        const { data, error } = await supabase
          .from('critiques')
          .select('id, film_title, titre, contenu, note, tags, author, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(200);
  
        if (error) {
          console.error('[CritiqueTab] fetch:', error.code, error.message);
        } else {
          // Filtrer les lignes avec un UUID valide
          setCritiques(
            ((data ?? []) as Critique[]).filter(c => isUUID(c.id)),
          );
        }
      } catch (err) {
        console.error('[CritiqueTab] fetchAll crash:', err);
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 280, useNativeDriver: true,
        }).start();
      }
    }, [fadeAnim]);
  
    // Chargement initial
    useEffect(() => { fetchAll(); }, [fetchAll]);
  
    // ── SAVE — INSERT ou UPDATE sans user_id ──────────────────────────────────
    const handleSave = useCallback(async (form: FormState) => {
      // Validation minimale côté client
      const cleanFilm    = cap(form.film_title, 200);
      const cleanTitre   = cap(form.titre, 200);
      const cleanContenu = cap(form.contenu, 1200);
      const cleanAuthor  = cap(form.author, 80) || null;
      const cleanTags    = form.tags.slice(0, 6).map(t => cap(t, 30));
      const cleanNote    = form.note !== null && form.note >= 1 && form.note <= 5
        ? form.note
        : null;
  
      if (!cleanFilm || !cleanTitre || cleanContenu.length < 10) {
        Alert.alert(
          'Champs incomplets',
          'Le titre, le film et la critique (≥ 10 car.) sont requis.',
        );
        return;
      }
  
      setSaving(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
      const payload = {
        film_title: cleanFilm,
        titre:      cleanTitre,
        contenu:    cleanContenu,
        note:       cleanNote,
        tags:       cleanTags,
        author:     cleanAuthor,
        updated_at: new Date().toISOString(),
      };
  
      let dbError: any;
  
      if (editTarget && isUUID(editTarget.id)) {
        // UPDATE
        ({ error: dbError } = await supabase
          .from('critiques')
          .update(payload)
          .eq('id', editTarget.id));
      } else {
        // INSERT — pas de user_id (table publique)
        ({ error: dbError } = await supabase
          .from('critiques')
          .insert({ ...payload, created_at: new Date().toISOString() }));
      }
  
      setSaving(false);
  
      if (dbError) {
        console.error('[CritiqueTab] save:', dbError.code, dbError.message);
        Alert.alert(
          'Erreur de publication',
          dbError.code === '42501'
            ? 'Permission refusée. Activez les RLS policies publiques sur la table critiques.'
            : "Impossible d'enregistrer. Vérifiez votre connexion.",
        );
        return;
      }
  
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setView('list');
      setEditTarget(null);
      await fetchAll();
    }, [editTarget, fetchAll]);
  
    // ── DELETE — public, pas de filtre user_id ────────────────────────────────
    const handleDelete = useCallback((item: Critique) => {
      if (!isUUID(item.id)) return;
      Alert.alert(
        'Supprimer la critique',
        `Supprimer "${item.titre}" définitivement ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('critiques')
                .delete()
                .eq('id', item.id);
  
              if (error) {
                console.error('[CritiqueTab] delete:', error.message);
                Alert.alert('Erreur', 'Suppression impossible. Réessayez.');
                return;
              }
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              await fetchAll();
            },
          },
        ],
      );
    }, [fetchAll]);
  
    // ── NAV ────────────────────────────────────────────────────────────────────
    const openNew  = useCallback(() => { setEditTarget(null); setView('form'); }, []);
    const openEdit = useCallback((item: Critique) => {
      if (!isUUID(item.id)) return;
      setEditTarget(item);
      setView('form');
    }, []);
    const handleCancel = useCallback(() => { setEditTarget(null); setView('list'); }, []);
  
    // ── FORM VIEW ──────────────────────────────────────────────────────────────
    if (view === 'form') {
      const initial: FormState = editTarget
        ? {
            film_title: editTarget.film_title,
            titre:      editTarget.titre,
            contenu:    editTarget.contenu,
            note:       editTarget.note,
            tags:       Array.isArray(editTarget.tags) ? editTarget.tags : [],
            author:     editTarget.author ?? '',
          }
        : BLANK;
  
      return (
        <CritiqueForm
          initial={initial}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      );
    }
  
    // ── LOADER ─────────────────────────────────────────────────────────────────
    if (loading) {
      return (
        <View style={l.loader}>
          <ActivityIndicator size="large" color={G.teal} />
        </View>
      );
    }
  
    // ── LIST VIEW ──────────────────────────────────────────────────────────────
    return (
      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={l.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={l.listHeader}>
            <View>
              <Text style={l.listTitle}>Critiques</Text>
              <Text style={l.listSub}>
                {critiques.length} analyse{critiques.length !== 1 ? 's' : ''} publiée{critiques.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity style={l.newBtn} onPress={openNew} activeOpacity={0.85}>
              <BlurView
                intensity={Platform.OS === 'ios' ? 14 : 8}
                tint="dark"
                style={StyleSheet.absoluteFillObject}
              />
              <View style={l.newBtnInner}>
                <Ionicons name="add" size={15} color="white" />
                <Text style={l.newBtnTxt}>Nouvelle</Text>
              </View>
            </TouchableOpacity>
          </View>
  
          {critiques.length === 0
            ? <EmptyState onNew={openNew} />
            : critiques.map(item => (
                <CritiqueCard
                  key={item.id}
                  item={item}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))
          }
  
          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      </View>
    );
  }
  
  const l = StyleSheet.create({
    loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
    listHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    listTitle:   { color: G.text, fontSize: 20, fontWeight: '800' },
    listSub:     { color: G.textTert, fontSize: 12, marginTop: 2 },
    newBtn:      { borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: G.purpleEdge },
    newBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
    newBtnTxt:   { color: 'white', fontSize: 13, fontWeight: '700' },
  });