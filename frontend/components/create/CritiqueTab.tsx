import React, {
    useState, useEffect, useCallback, memo, useRef,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Animated, Platform,
  } from 'react-native';
  import { BlurView }   from 'expo-blur';
  import { Ionicons }   from '@expo/vector-icons';
  import * as Haptics   from 'expo-haptics';
  import { supabase }   from '@/lib/supabase';
  import { C }          from './tokens';
  import type { Critique, ReelRef } from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PALETTE — transparent / navyMid only, GalaxyBackground bleeds through
  // ─────────────────────────────────────────────────────────────────────────────
  const G = {
    // Surfaces — always semi-transparent so the galaxy shows
    surface:    'rgba(10,22,40,0.55)',   // navyMid teinté
    surfaceHi:  'rgba(13,34,64,0.70)',   // un cran plus opaque pour les focus
    surfaceLow: 'rgba(10,22,40,0.30)',   // très léger pour les badges
  
    // Borders
    edge:       'rgba(255,255,255,0.09)',
    edgeMid:    'rgba(255,255,255,0.16)',
    edgeHi:     'rgba(255,255,255,0.26)',
  
    // Accents — identiques au reste de l'app
    teal:       '#00C9FF',
    tealSoft:   'rgba(0,201,255,0.12)',
    tealEdge:   'rgba(0,201,255,0.28)',
    purple:     '#7C3AED',
    purpleSoft: 'rgba(124,58,237,0.12)',
    purpleEdge: 'rgba(124,58,237,0.28)',
    gold:       '#F5C842',
    red:        '#FF3B5C',
    green:      '#2ECC8A',
    greenSoft:  'rgba(46,204,138,0.12)',
  
    // Text
    text:       '#EDF6FF',
    textSec:    'rgba(255,255,255,0.55)',
    textTert:   'rgba(255,255,255,0.28)',
  } as const;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS — validation & sanitize
  // ─────────────────────────────────────────────────────────────────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isValidUUID = (v: unknown): v is string =>
    typeof v === 'string' && UUID_RE.test(v);
  
  const sanitize = (v: string, max = 255): string => v.trim().slice(0, max);
  
  interface FormState {
    film_title: string;
    titre:      string;
    contenu:    string;
    note:       number | null;
    tags:       string[];
    reel_id:    string | null;
  }
  
  const BLANK_FORM: FormState = {
    film_title: '', titre: '', contenu: '',
    note: null, tags: [], reel_id: null,
  };
  
  const buildPayload = (form: FormState, userId: string) => ({
    user_id:    userId,
    reel_id:    isValidUUID(form.reel_id) ? form.reel_id : null,
    film_title: sanitize(form.film_title, 200),
    titre:      sanitize(form.titre, 200),
    contenu:    sanitize(form.contenu, 1200),
    note:       form.note !== null && form.note >= 1 && form.note <= 5 ? form.note : null,
    tags:       form.tags.slice(0, 6).map(t => sanitize(t, 30)),
    updated_at: new Date().toISOString(),
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH GATE — affiché si l'user n'est pas connecté
  // ─────────────────────────────────────────────────────────────────────────────
  const AuthGate = memo(function AuthGate() {
    return (
      <View style={ag.wrap}>
        <View style={ag.card}>
          <BlurView intensity={Platform.OS === 'ios' ? 18 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={ag.inner}>
            <View style={ag.iconWrap}>
              <Ionicons name="lock-closed-outline" size={28} color={G.teal} />
            </View>
            <Text style={ag.title}>Connexion requise</Text>
            <Text style={ag.sub}>
              Connectez-vous pour rédiger et gérer vos critiques cinématographiques.
            </Text>
          </View>
        </View>
      </View>
    );
  });
  
  const ag = StyleSheet.create({
    wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    card:    { width: '100%', borderRadius: 22, overflow: 'hidden', borderWidth: 0.5, borderColor: G.edgeMid, backgroundColor: G.surface },
    inner:   { alignItems: 'center', padding: 28, gap: 10 },
    iconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    title:   { color: G.text, fontSize: 17, fontWeight: '800' },
    sub:     { color: G.textTert, fontSize: 13, lineHeight: 20, textAlign: 'center', fontStyle: 'italic' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STAR RATING
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
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons
              name={value !== null && i <= value ? 'star' : 'star-outline'}
              size={readonly ? 13 : 24}
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
      const clean = input.trim().toLowerCase().replace(/[^a-z0-9àâäéèêëîïôùûüç]/g, '').slice(0, 30);
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
            <Ionicons name="add" size={18} color={tags.length >= 6 ? G.textTert : G.teal} />
          </TouchableOpacity>
        </View>
        {tags.length > 0 && (
          <View style={ti.tagsWrap}>
            {tags.map(t => (
              <TouchableOpacity key={t} style={ti.tag} onPress={() => removeTag(t)} activeOpacity={0.7}>
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
  // REEL SELECTOR
  // ─────────────────────────────────────────────────────────────────────────────
  const ReelSelector = memo(function ReelSelector({
    reels, selectedId, onSelect,
  }: { reels: ReelRef[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
    if (reels.length === 0) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {reels.map(r => {
          if (!isValidUUID(r.id)) return null;
          const on = r.id === selectedId;
          return (
            <TouchableOpacity
              key={r.id}
              style={[rsel.chip, on && rsel.chipOn]}
              onPress={() => onSelect(on ? null : r.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="film-outline" size={12} color={on ? G.teal : G.textSec} />
              <Text style={[rsel.chipTxt, on && rsel.chipTxtOn]} numberOfLines={1}>
                {r.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  });
  
  const rsel = StyleSheet.create({
    chip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'transparent', borderWidth: 0.5, borderColor: G.edgeMid, maxWidth: 160 },
    chipOn:    { backgroundColor: G.tealSoft, borderColor: G.tealEdge },
    chipTxt:   { color: G.textSec, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    chipTxtOn: { color: G.teal },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CRITIQUE CARD — entièrement transparent / glass
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
          intensity={Platform.OS === 'ios' ? 12 : 8}
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
                style={[cc.actionBtn, cc.actionBtnDanger]}
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
          {item.tags.length > 0 && (
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
            {isValidUUID(item.reel_id) && (
              <View style={cc.reelBadge}>
                <Ionicons name="film-outline" size={10} color={G.teal} />
                <Text style={cc.reelBadgeTxt}>Réel lié</Text>
              </View>
            )}
            <Text style={cc.date}>{date}</Text>
          </View>
        </View>
      </View>
    );
  });
  
  const cc = StyleSheet.create({
    wrap:           { borderRadius: 20, borderWidth: 0.5, borderColor: G.edgeMid, overflow: 'hidden', marginBottom: 14, backgroundColor: G.surface },
    inner:          { padding: 16 },
    header:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
    filmLabel:      { color: G.teal, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    titre:          { color: G.text, fontSize: 15, fontWeight: '800' },
    actions:        { flexDirection: 'row', gap: 8 },
    actionBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', borderWidth: 0.5, borderColor: G.edgeMid, alignItems: 'center', justifyContent: 'center' },
    actionBtnDanger:{ borderColor: 'rgba(255,59,92,0.30)' },
    noteRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    noteLabel:      { color: G.textTert, fontSize: 11 },
    contenu:        { color: G.textSec, fontSize: 13, lineHeight: 20, marginBottom: 10 },
    tagsRow:        { gap: 6, marginBottom: 10 },
    tag:            { paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 8, backgroundColor: G.purpleSoft, borderWidth: 0.5, borderColor: G.purpleEdge },
    tagTxt:         { color: '#A78BFA', fontSize: 11, fontWeight: '600' },
    footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reelBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge },
    reelBadgeTxt:   { color: G.teal, fontSize: 10, fontWeight: '600' },
    date:           { color: G.textTert, fontSize: 10 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EMPTY STATE — transparent
  // ─────────────────────────────────────────────────────────────────────────────
  const EmptyState = memo(function EmptyState({ onNew }: { onNew: () => void }) {
    return (
      <View style={es.wrap}>
        <View style={es.iconWrap}>
          <Ionicons name="document-text-outline" size={30} color={G.teal} />
        </View>
        <Text style={es.title}>Aucune critique</Text>
        <Text style={es.sub}>
          Rédigez votre première analyse — un regard critique sur votre propre création.
        </Text>
        <TouchableOpacity
          style={es.cta}
          onPress={onNew}
          activeOpacity={0.85}
        >
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
    iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: G.tealSoft, borderWidth: 0.5, borderColor: G.tealEdge, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title:    { color: G.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
    sub:      { color: G.textTert, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 28, fontStyle: 'italic' },
    cta:      { borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: G.purpleEdge, backgroundColor: G.purpleSoft },
    ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
    ctaTxt:   { color: 'white', fontSize: 14, fontWeight: '700' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CRITIQUE FORM — transparent / navyMid
  // ─────────────────────────────────────────────────────────────────────────────
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
  
    const canSave =
      form.film_title.trim().length > 0 &&
      form.titre.trim().length > 0 &&
      form.contenu.trim().length >= 10; // au moins 10 chars pour éviter les soumissions vides
  
    return (
      <ScrollView
        contentContainerStyle={frm.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header row */}
        <View style={frm.headerRow}>
          <TouchableOpacity onPress={onCancel} style={frm.cancelBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-back" size={18} color={G.textSec} />
            <Text style={frm.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[frm.saveBtn, !canSave && { opacity: 0.38 }]}
            onPress={() => canSave && onSave(form)}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 14 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={frm.saveBtnInner}>
              {saving
                ? <ActivityIndicator size="small" color="white" />
                : <>
                    <Ionicons name="checkmark" size={15} color="white" />
                    <Text style={frm.saveTxt}>Enregistrer</Text>
                  </>
              }
            </View>
          </TouchableOpacity>
        </View>
  
        <Text style={frm.sectionTitle}>
          {initial.titre ? 'Modifier la critique' : 'Nouvelle critique'}
        </Text>
        <Text style={frm.hint}>Posez un regard analytique sur votre propre œuvre.</Text>
  
        {/* Film title */}
        <View style={frm.field}>
          <Text style={frm.label}>FILM *</Text>
          <View style={frm.inputWrap}>
            <TextInput
              style={frm.input}
              placeholder="Titre du film analysé"
              placeholderTextColor={G.textTert}
              value={form.film_title}
              onChangeText={v => patch('film_title', v)}
              maxLength={200}
              returnKeyType="next"
            />
          </View>
        </View>
  
        {/* Reel link */}
        {reels.length > 0 && (
          <View style={frm.field}>
            <Text style={frm.label}>LIER À UN RÉEL <Text style={{ color: G.textTert, fontWeight: '400' }}>(optionnel)</Text></Text>
            <ReelSelector
              reels={reels}
              selectedId={form.reel_id}
              onSelect={v => patch('reel_id', v)}
            />
          </View>
        )}
  
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
          <Text style={frm.label}>NOTE PERSONNELLE <Text style={{ color: G.textTert, fontWeight: '400' }}>(optionnel)</Text></Text>
          <StarRating value={form.note} onChange={v => patch('note', v === 0 ? null : v)} />
        </View>
  
        {/* Contenu */}
        <View style={frm.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={frm.label}>CRITIQUE * <Text style={{ color: G.textTert, fontWeight: '400' }}>(min 10 car.)</Text></Text>
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
    saveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
    saveTxt:      { color: 'white', fontSize: 14, fontWeight: '700' },
    sectionTitle: { color: G.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    hint:         { color: G.textTert, fontSize: 13, lineHeight: 19, marginBottom: 24, fontStyle: 'italic' },
    field:        { marginBottom: 20 },
    label:        { color: G.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
    inputWrap:    { borderRadius: 14, borderWidth: 0.5, borderColor: G.edgeMid, overflow: 'hidden', backgroundColor: G.surfaceLow },
    input:        { paddingHorizontal: 16, paddingVertical: 13, color: G.text, fontSize: 14, backgroundColor: 'transparent' },
    textarea:     { minHeight: 160, lineHeight: 22 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // LIST HEADER — transparent
  // ─────────────────────────────────────────────────────────────────────────────
  const ListHeader = memo(function ListHeader({
    count, onNew,
  }: { count: number; onNew: () => void }) {
    return (
      <View style={lh.wrap}>
        <View>
          <Text style={lh.title}>Mes Critiques</Text>
          <Text style={lh.sub}>
            {count} analyse{count !== 1 ? 's' : ''} rédigée{count !== 1 ? 's' : ''}
          </Text>
        </View>
        {count > 0 && (
          <TouchableOpacity style={lh.btn} onPress={onNew} activeOpacity={0.85}>
            <BlurView intensity={Platform.OS === 'ios' ? 14 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={lh.btnInner}>
              <Ionicons name="add" size={15} color="white" />
              <Text style={lh.btnTxt}>Nouvelle</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  });
  
  const lh = StyleSheet.create({
    wrap:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title:   { color: G.text, fontSize: 20, fontWeight: '800' },
    sub:     { color: G.textTert, fontSize: 12, marginTop: 2 },
    btn:     { borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: G.purpleEdge },
    btnInner:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
    btnTxt:  { color: 'white', fontSize: 13, fontWeight: '700' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN EXPORT
  // ─────────────────────────────────────────────────────────────────────────────
  type ScreenView = 'list' | 'form';
  
  export default function CritiqueTab() {
    const [view,       setView]       = useState<ScreenView>('list');
    const [critiques,  setCritiques]  = useState<Critique[]>([]);
    const [reels,      setReels]      = useState<ReelRef[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [userId,     setUserId]     = useState<string | null>(null);
    const [authReady,  setAuthReady]  = useState(false);
    const [editTarget, setEditTarget] = useState<Critique | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
  
    // ── Auth — vérification stricte ────────────────────────────────────────
    useEffect(() => {
      supabase.auth.getUser().then(({ data: { user }, error }) => {
        if (!error && user && isValidUUID(user.id)) {
          setUserId(user.id);
        }
        setAuthReady(true);
      });
  
      // Écouter les changements de session
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id;
        setUserId(uid && isValidUUID(uid) ? uid : null);
      });
  
      return () => subscription.unsubscribe();
    }, []);


  
    const fetchAll = useCallback(async (uid: string) => {
        if (!isValidUUID(uid)) {
          console.warn('[CritiqueLab] fetchAll: invalid uid', uid);
          return;
        }
      
        setLoading(true);
        fadeAnim.setValue(0);
      
        const [critiqueRes, reelRes] = await Promise.all([
          supabase
            .from('critiques')
            .select('id, user_id, reel_id, film_title, titre, contenu, note, tags, created_at, updated_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(100),
      
          supabase
            .from('reels')
            .select('id, title')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);
      
        if (critiqueRes.error) {
          console.error('[CritiqueLab] fetch critiques:', {
            message: critiqueRes.error.message,
            details: critiqueRes.error.details,
            hint: critiqueRes.error.hint,
            code: critiqueRes.error.code,
          });
          setLoading(false);
          return;
        }
      
        if (reelRes.error) {
          console.error('[CritiqueLab] fetch reels:', {
            message: reelRes.error.message,
            details: reelRes.error.details,
            hint: reelRes.error.hint,
            code: reelRes.error.code,
          });
          setLoading(false);
          return;
        }
      
        const safeCritiques = (critiqueRes.data ?? []).filter(
          c => isValidUUID(c.id) && c.user_id === uid,
        ) as Critique[];
      
        const safeReels = (reelRes.data ?? []).filter(
          r => isValidUUID(r.id),
        ) as ReelRef[];
      
        setCritiques(safeCritiques);
        setReels(safeReels);
        setLoading(false);
      
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      }, [fadeAnim]);
  
    useEffect(() => {
      if (userId) fetchAll(userId);
      else if (authReady) setLoading(false);
    }, [userId, authReady, fetchAll]);
  
    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = useCallback(async (form: FormState) => {
      if (!isValidUUID(userId)) {
        Alert.alert('Erreur', 'Session invalide. Reconnectez-vous.');
        return;
      }
      if (!form.film_title.trim() || !form.titre.trim() || form.contenu.trim().length < 10) {
        Alert.alert('Champs incomplets', 'Remplissez tous les champs obligatoires (min 10 car. pour la critique).');
        return;
      }
  
      setSaving(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
      const payload = buildPayload(form, userId!);
  
      let dbError: any;
  
      if (editTarget && isValidUUID(editTarget.id)) {
        // UPDATE — double filtre id + user_id pour éviter les modifications croisées
        const { error } = await supabase
          .from('critiques')
          .update(payload)
          .eq('id', editTarget.id)
          .eq('user_id', userId!);
        dbError = error;
      } else {
        // INSERT — created_at explicite
        const { error } = await supabase
          .from('critiques')
          .insert({ ...payload, created_at: new Date().toISOString() });
        dbError = error;
      }
  
      setSaving(false);
  
      if (dbError) {
        console.error('[CritiqueLab] save:', dbError.message, dbError.code);
        Alert.alert(
          'Erreur d\'enregistrement',
          dbError.code === '42501'
            ? 'Permission refusée. Vérifiez vos droits Supabase.'
            : 'Impossible d\'enregistrer. Réessayez.',
        );
        return;
      }
  
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setView('list');
      setEditTarget(null);
      await fetchAll(userId!);
    }, [userId, editTarget, fetchAll]);
  
    // ── Delete ────────────────────────────────────────────────────────────
    const handleDelete = useCallback((item: Critique) => {
      if (!isValidUUID(userId) || !isValidUUID(item.id)) return;
  
      Alert.alert(
        'Supprimer la critique',
        `Supprimer "${item.titre}" définitivement ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer', style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('critiques')
                .delete()
                .eq('id', item.id)
                .eq('user_id', userId!); // double protection RLS
  
              if (error) {
                console.error('[CritiqueLab] delete:', error.message);
                Alert.alert('Erreur', 'Suppression impossible. Réessayez.');
                return;
              }
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              await fetchAll(userId!);
            },
          },
        ],
      );
    }, [userId, fetchAll]);
  
    // ── Navigation ────────────────────────────────────────────────────────
    const openNew = useCallback(() => {
      setEditTarget(null);
      setView('form');
    }, []);
  
    const openEdit = useCallback((item: Critique) => {
      if (!isValidUUID(item.id)) return;
      setEditTarget(item);
      setView('form');
    }, []);
  
    const handleCancel = useCallback(() => {
      setEditTarget(null);
      setView('list');
    }, []);
  
    // ── Render — guard auth ────────────────────────────────────────────────
    if (!authReady || (authReady && !userId && !loading)) {
      return authReady && !userId ? <AuthGate /> : (
        <View style={root.loader}>
          <ActivityIndicator size="large" color={G.teal} />
        </View>
      );
    }
  
    // ── Form view ─────────────────────────────────────────────────────────
    if (view === 'form') {
      const initial: FormState = editTarget
        ? {
            film_title: editTarget.film_title,
            titre:      editTarget.titre,
            contenu:    editTarget.contenu,
            note:       editTarget.note,
            tags:       editTarget.tags,
            reel_id:    isValidUUID(editTarget.reel_id) ? editTarget.reel_id : null,
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
  
    // ── List view ─────────────────────────────────────────────────────────
    if (loading) {
      return (
        <View style={root.loader}>
          <ActivityIndicator size="large" color={G.teal} />
        </View>
      );
    }
  
    return (
      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={root.scroll}
          showsVerticalScrollIndicator={false}
        >
          <ListHeader count={critiques.length} onNew={openNew} />
  
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
          <View style={{ height: 60 }} />
        </Animated.ScrollView>
      </View>
    );
  }
  
  const root = StyleSheet.create({
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  });