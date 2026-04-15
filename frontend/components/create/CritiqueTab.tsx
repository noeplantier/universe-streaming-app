import React, {
    useState, useEffect, useCallback, memo, useRef,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Animated, Platform,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import * as Haptics       from 'expo-haptics';
  import { supabase }       from '@/lib/supabase';
  import { C }              from './tokens';
  import type { Critique, ReelRef } from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Star rating widget
  // ─────────────────────────────────────────────────────────────────────────────
  const StarRating = memo(function StarRating({
    value, onChange, readonly = false,
  }: { value: number | null; onChange?: (n: number) => void; readonly?: boolean }) {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <TouchableOpacity
            key={i}
            disabled={readonly}
            onPress={() => onChange?.(i === value ? 0 : i)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={value !== null && i <= value ? 'star' : 'star-outline'}
              size={readonly ? 13 : 22}
              color={value !== null && i <= value ? C.gold : C.textTert}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Critique card
  // ─────────────────────────────────────────────────────────────────────────────
  const CritiqueCard = memo(function CritiqueCard({
    item, onEdit, onDelete,
  }: { item: Critique; onEdit: () => void; onDelete: () => void }) {
    const date = new Date(item.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  
    return (
      <View style={card.wrap}>
        <LinearGradient
          colors={['rgba(124,58,237,0.06)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <View style={card.header}>
          <View style={{ flex: 1 }}>
            <Text style={card.filmTitle} numberOfLines={1}>{item.film_title}</Text>
            <Text style={card.titre} numberOfLines={1}>{item.titre}</Text>
          </View>
          <View style={card.actions}>
            <TouchableOpacity style={card.actionBtn} onPress={onEdit}>
              <Ionicons name="pencil-outline" size={14} color={C.teal} />
            </TouchableOpacity>
            <TouchableOpacity style={[card.actionBtn, { borderColor: 'rgba(255,59,92,0.25)' }]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={14} color={C.red} />
            </TouchableOpacity>
          </View>
        </View>
  
        {item.note !== null && (
          <View style={card.noteRow}>
            <StarRating value={item.note} readonly />
            <Text style={card.noteLabel}>{item.note}/5</Text>
          </View>
        )}
  
        <Text style={card.contenu} numberOfLines={3}>{item.contenu}</Text>
  
        {item.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={card.tagsRow}>
            {item.tags.map(tag => (
              <View key={tag} style={card.tag}>
                <Text style={card.tagTxt}>#{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}
  
        <Text style={card.date}>{date}</Text>
      </View>
    );
  });
  
  const card = StyleSheet.create({
    wrap:       { backgroundColor: C.surf, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14, overflow: 'hidden' },
    header:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
    filmTitle:  { color: C.teal, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
    titre:      { color: C.text, fontSize: 15, fontWeight: '800' },
    actions:    { flexDirection: 'row', gap: 8 },
    actionBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    noteRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    noteLabel:  { color: C.textTert, fontSize: 11 },
    contenu:    { color: C.textSec, fontSize: 13, lineHeight: 20, marginBottom: 10 },
    tagsRow:    { gap: 6, marginBottom: 10 },
    tag:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: C.purpleMid },
    tagTxt:     { color: C.purple, fontSize: 11, fontWeight: '600' },
    date:       { color: C.textTert, fontSize: 10, textAlign: 'right' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Empty state
  // ─────────────────────────────────────────────────────────────────────────────
  const EmptyState = memo(function EmptyState({ onNew }: { onNew: () => void }) {
    return (
      <View style={empty.wrap}>
        <View style={empty.iconWrap}>
          <LinearGradient
            colors={[C.purple, C.navyMid]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={empty.iconBg}
          >
            <Ionicons name="document-text-outline" size={30} color="white" />
          </LinearGradient>
        </View>
        <Text style={empty.title}>Aucune critique</Text>
        <Text style={empty.sub}>
          Rédigez votre première analyse — un regard critique sur votre propre création.
        </Text>
        <TouchableOpacity style={empty.cta} onPress={onNew} activeOpacity={0.85}>
          <LinearGradient colors={[C.purple, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={empty.ctaGrad}>
            <Ionicons name="add" size={18} color="white" />
            <Text style={empty.ctaTxt}>Écrire une critique</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  });
  
  const empty = StyleSheet.create({
    wrap:    { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    iconWrap:{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', marginBottom: 18 },
    iconBg:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title:   { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
    sub:     { color: C.textTert, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 28, fontStyle: 'italic' },
    cta:     { borderRadius: 20, overflow: 'hidden' },
    ctaGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
    ctaTxt:  { color: 'white', fontSize: 14, fontWeight: '700' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Tag input
  // ─────────────────────────────────────────────────────────────────────────────
  const TagInput = memo(function TagInput({
    tags, onChange,
  }: { tags: string[]; onChange: (t: string[]) => void }) {
    const [input, setInput] = useState('');
  
    const addTag = useCallback(() => {
      const clean = input.trim().toLowerCase().replace(/[^a-z0-9àâäéèêëîïôùûüç]/g, '');
      if (clean && !tags.includes(clean) && tags.length < 6) {
        onChange([...tags, clean]);
      }
      setInput('');
    }, [input, tags, onChange]);
  
    const removeTag = useCallback((t: string) => {
      onChange(tags.filter(x => x !== t));
    }, [tags, onChange]);
  
    return (
      <View>
        <View style={ti.row}>
          <TextInput
            style={ti.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addTag}
            placeholder="Ajouter un tag…"
            placeholderTextColor={C.textTert}
            returnKeyType="done"
            maxLength={20}
          />
          <TouchableOpacity style={ti.addBtn} onPress={addTag}>
            <Ionicons name="add" size={18} color={C.purple} />
          </TouchableOpacity>
        </View>
        {tags.length > 0 && (
          <View style={ti.tagsWrap}>
            {tags.map(t => (
              <TouchableOpacity key={t} style={ti.tag} onPress={() => removeTag(t)}>
                <Text style={ti.tagTxt}>#{t}</Text>
                <Ionicons name="close" size={11} color={C.purple} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  });
  
  const ti = StyleSheet.create({
    row:      { flexDirection: 'row', gap: 8 },
    input:    { flex: 1, backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 14 },
    addBtn:   { width: 44, height: 44, borderRadius: 12, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: C.purpleMid, alignItems: 'center', justifyContent: 'center' },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    tag:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: C.purpleMid },
    tagTxt:   { color: C.purple, fontSize: 12, fontWeight: '600' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Reel selector for the form
  // ─────────────────────────────────────────────────────────────────────────────
  const ReelSelector = memo(function ReelSelector({
    reels, selectedId, onSelect,
  }: { reels: ReelRef[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
    if (reels.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {reels.map(r => {
          const on = r.id === selectedId;
          return (
            <TouchableOpacity
              key={r.id}
              style={[rs.chip, on && rs.chipOn]}
              onPress={() => onSelect(on ? null : r.id)}
            >
              <Ionicons name="film-outline" size={12} color={on ? C.teal : C.textSec} />
              <Text style={[rs.chipTxt, on && rs.chipTxtOn]} numberOfLines={1}>{r.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  });
  
  const rs = StyleSheet.create({
    chip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, maxWidth: 160 },
    chipOn:    { backgroundColor: C.tealMid, borderColor: C.teal },
    chipTxt:   { color: C.textSec, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    chipTxtOn: { color: C.teal },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────────────────────
  interface FormState {
    film_title: string;
    titre:      string;
    contenu:    string;
    note:       number | null;
    tags:       string[];
    reel_id:    string | null;
  }
  
  const BLANK_FORM: FormState = {
    film_title: '', titre: '', contenu: '', note: null, tags: [], reel_id: null,
  };
  
  const CritiqueForm = memo(function CritiqueForm({
    initial, reels, saving, onSave, onCancel,
  }: {
    initial:  FormState;
    reels:    ReelRef[];
    saving:   boolean;
    onSave:   (f: FormState) => void;
    onCancel: () => void;
  }) {
    const [form, setForm] = useState<FormState>(initial);
    const patch = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
      setForm(f => ({ ...f, [k]: v }));
    }, []);
  
    const canSave = form.film_title.trim().length > 0
      && form.titre.trim().length > 0
      && form.contenu.trim().length > 0;
  
    return (
      <ScrollView
        contentContainerStyle={f.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={f.formHeader}>
          <TouchableOpacity onPress={onCancel} style={f.cancelBtn}>
            <Ionicons name="chevron-back" size={18} color={C.textSec} />
            <Text style={f.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[f.saveBtn, !canSave && { opacity: 0.4 }]}
            onPress={() => canSave && onSave(form)}
            disabled={!canSave || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="white" />
              : <>
                  <Ionicons name="checkmark" size={16} color="white" />
                  <Text style={f.saveTxt}>Enregistrer</Text>
                </>
            }
          </TouchableOpacity>
        </View>
  
        <Text style={f.sectionTitle}>
          {initial.titre ? 'Modifier la critique' : 'Nouvelle critique'}
        </Text>
        <Text style={f.hint}>Posez un regard analytique sur votre propre œuvre.</Text>
  
        {/* Film title */}
        <View style={f.field}>
          <Text style={f.label}>FILM *</Text>
          <TextInput
            style={f.input}
            placeholder="Titre du film analysé"
            placeholderTextColor={C.textTert}
            value={form.film_title}
            onChangeText={v => patch('film_title', v)}
          />
        </View>
  
        {/* Link to reel */}
        {reels.length > 0 && (
          <View style={f.field}>
            <Text style={f.label}>LIER À UN RÉEL</Text>
            <ReelSelector reels={reels} selectedId={form.reel_id} onSelect={v => patch('reel_id', v)} />
          </View>
        )}
  
        {/* Title */}
        <View style={f.field}>
          <Text style={f.label}>TITRE DE LA CRITIQUE *</Text>
          <TextInput
            style={f.input}
            placeholder="Ex : Sur la lumière et le silence"
            placeholderTextColor={C.textTert}
            value={form.titre}
            onChangeText={v => patch('titre', v)}
          />
        </View>
  
        {/* Note */}
        <View style={f.field}>
          <Text style={f.label}>NOTE PERSONNELLE</Text>
          <StarRating value={form.note} onChange={v => patch('note', v === 0 ? null : v)} />
        </View>
  
        {/* Contenu */}
        <View style={f.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={f.label}>CRITIQUE *</Text>
            <Text style={{ color: C.textTert, fontSize: 10 }}>{form.contenu.length}/1200</Text>
          </View>
          <TextInput
            style={[f.input, f.textarea]}
            multiline
            placeholder="Votre analyse, vos intentions de mise en scène, ce qui a fonctionné ou non…"
            placeholderTextColor={C.textTert}
            value={form.contenu}
            onChangeText={v => v.length <= 1200 && patch('contenu', v)}
            textAlignVertical="top"
          />
        </View>
  
        {/* Tags */}
        <View style={f.field}>
          <Text style={f.label}>TAGS <Text style={{ color: C.textTert, fontWeight: '400' }}>(max 6)</Text></Text>
          <TagInput tags={form.tags} onChange={v => patch('tags', v)} />
        </View>
  
        <View style={{ height: 80 }} />
      </ScrollView>
    );
  });
  
  const f = StyleSheet.create({
    scroll:       { paddingHorizontal: 20, paddingTop: 12 },
    formHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    cancelBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cancelTxt:    { color: C.textSec, fontSize: 14, fontWeight: '600' },
    saveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.purple, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 16 },
    saveTxt:      { color: 'white', fontSize: 14, fontWeight: '700' },
    sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    hint:         { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 24, fontStyle: 'italic' },
    field:        { marginBottom: 20 },
    label:        { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
    input:        { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 13, color: C.text, fontSize: 15 },
    textarea:     { minHeight: 160, lineHeight: 22 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN TAB
  // ─────────────────────────────────────────────────────────────────────────────
  type View = 'list' | 'form';
  
  export default function CritiqueTab() {
    const [view,       setView]       = useState<View>('list');
    const [critiques,  setCritiques]  = useState<Critique[]>([]);
    const [reels,      setReels]      = useState<ReelRef[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [userId,     setUserId]     = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<Critique | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
  
    // ── Auth ────────────────────────────────────────────────────────────────
    useEffect(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }, []);
  
    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async (uid: string) => {
      setLoading(true);
      const [{ data: c }, { data: r }] = await Promise.all([
        supabase
          .from('critiques')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('reels')
          .select('id, title')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
      ]);
      setCritiques((c ?? []) as Critique[]);
      setReels((r ?? []) as ReelRef[]);
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, [fadeAnim]);
  
    useEffect(() => {
      if (userId) fetchAll(userId);
    }, [userId, fetchAll]);
  
    // ── Save ─────────────────────────────────────────────────────────────────
    const handleSave = useCallback(async (form: FormState) => {
      if (!userId) return;
      setSaving(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
      const payload = {
        user_id:    userId,
        reel_id:    form.reel_id,
        film_title: form.film_title.trim(),
        titre:      form.titre.trim(),
        contenu:    form.contenu.trim(),
        note:       form.note,
        tags:       form.tags,
        updated_at: new Date().toISOString(),
      };
  
      let error: any;
      if (editTarget) {
        ({ error } = await supabase
          .from('critiques')
          .update(payload)
          .eq('id', editTarget.id)
          .eq('user_id', userId));
      } else {
        ({ error } = await supabase
          .from('critiques')
          .insert({ ...payload, created_at: new Date().toISOString() }));
      }
  
      setSaving(false);
      if (error) {
        Alert.alert('Erreur', "Impossible d'enregistrer. Réessayez.");
        return;
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setView('list');
      setEditTarget(null);
      await fetchAll(userId);
    }, [userId, editTarget, fetchAll]);
  
    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = useCallback((item: Critique) => {
      Alert.alert(
        'Supprimer la critique',
        `Supprimer "${item.titre}" définitivement ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer', style: 'destructive',
            onPress: async () => {
              if (!userId) return;
              await supabase.from('critiques').delete().eq('id', item.id).eq('user_id', userId);
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await fetchAll(userId);
            },
          },
        ],
      );
    }, [userId, fetchAll]);
  
    // ── Open form ─────────────────────────────────────────────────────────────
    const openNew = useCallback(() => {
      setEditTarget(null);
      setView('form');
    }, []);
  
    const openEdit = useCallback((item: Critique) => {
      setEditTarget(item);
      setView('form');
    }, []);
  
    const handleCancel = useCallback(() => {
      setEditTarget(null);
      setView('list');
    }, []);
  
    // ── Render ────────────────────────────────────────────────────────────────
    if (view === 'form') {
      const initial: FormState = editTarget
        ? {
            film_title: editTarget.film_title,
            titre:      editTarget.titre,
            contenu:    editTarget.contenu,
            note:       editTarget.note,
            tags:       editTarget.tags,
            reel_id:    editTarget.reel_id,
          }
        : BLANK_FORM;
  
      return (
        <CritiqueForm
          initial={initial}
          reels={reels}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      );
    }
  
    // List view
    return (
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={l.loader}>
            <ActivityIndicator size="large" color={C.purple} />
          </View>
        ) : (
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={l.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={l.listHeader}>
              <View>
                <Text style={l.listTitle}>Mes Critiques</Text>
                <Text style={l.listSub}>
                  {critiques.length} analyse{critiques.length !== 1 ? 's' : ''} rédigée{critiques.length !== 1 ? 's' : ''}
                </Text>
              </View>
              {critiques.length > 0 && (
                <TouchableOpacity style={l.newBtn} onPress={openNew} activeOpacity={0.85}>
                    <LinearGradient
                      colors={[C.teal, C.navyMid]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={l.newBtnGrad}
                    >
                      <Ionicons name="add" size={16} color="white" />
                      <Text style={l.newBtnTxt}>Nouvelle</Text>
                    </LinearGradient>
                </TouchableOpacity>
              )}
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
            <View style={{ height: 40 }} />
          </Animated.ScrollView>
        )}
      </View>
    );
  }
  
  const l = StyleSheet.create({
    loader:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    listTitle:  { color: C.text, fontSize: 20, fontWeight: '800' },
    listSub:    { color: C.textTert, fontSize: 12, marginTop: 2 },
    newBtn:     { borderRadius: 16, overflow: 'hidden' },
    newBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
    newBtnTxt:  { color: 'white', fontSize: 13, fontWeight: '700' },
  });