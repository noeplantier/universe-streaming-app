import React, { memo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, GENRES } from './tokens';
import type { ReelMeta } from './types';

interface Props {
  meta:     ReelMeta;
  onChange: <K extends keyof ReelMeta>(key: K, val: string) => void;
}

const StepInfos = memo(function StepInfos({ meta, onChange }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>Présentez votre film</Text>
      <Text style={s.hint}>Ces informations apparaîtront sur votre Réel.</Text>

      <View style={s.field}>
        <Text style={s.label}>TITRE DU FILM *</Text>
        <TextInput
          style={s.input}
          placeholder="Ex : Les Silences du Lac"
          placeholderTextColor={C.textTert}
          value={meta.title}
          onChangeText={v => onChange('title', v)}
        />
      </View>

      <View style={s.row2}>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>RÉALISATEUR</Text>
          <TextInput
            style={s.input}
            placeholder="Prénom Nom"
            placeholderTextColor={C.textTert}
            value={meta.director}
            onChangeText={v => onChange('director', v)}
          />
        </View>
        <View style={[s.field, { width: 88 }]}>
          <Text style={s.label}>ANNÉE</Text>
          <TextInput
            style={s.input}
            placeholder="2025"
            placeholderTextColor={C.textTert}
            value={meta.year}
            onChangeText={v => onChange('year', v)}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>GENRE *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {GENRES.map(g => {
            const on = meta.genre === g;
            return (
              <TouchableOpacity
                key={g}
                style={[s.chip, on && s.chipOn]}
                onPress={() => onChange('genre', on ? '' : g)}
              >
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.field}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={s.label}>ACCROCHE</Text>
          <Text style={{ color: C.textTert, fontSize: 10 }}>{meta.synopsis.length}/120</Text>
        </View>
        <TextInput
          style={[s.input, s.textarea]}
          multiline
          placeholder="Une phrase qui donne envie de découvrir votre film…"
          placeholderTextColor={C.textTert}
          value={meta.synopsis}
          onChangeText={v => v.length <= 120 && onChange('synopsis', v)}
          textAlignVertical="top"
        />
      </View>

      <View style={s.indieBadge}>
        <Ionicons name="ribbon-outline" size={14} color={C.teal} />
        <Text style={s.indieTxt}>
          Votre Réel sera taggé{' '}
          <Text style={{ color: C.teal, fontWeight: '700' }}>#CinémaIndépendant</Text>
          {' '}automatiquement.
        </Text>
      </View>
    </View>
  );
});

export default StepInfos;

const s = StyleSheet.create({
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:         { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },
  field:        { marginBottom: 20 },
  label:        { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input:        { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 13, color: C.text, fontSize: 15 },
  textarea:     { minHeight: 80, lineHeight: 21 },
  row2:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chip:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:       { backgroundColor: C.tealMid, borderColor: C.teal },
  chipTxt:      { color: C.textSec, fontSize: 13, fontWeight: '600' },
  chipTxtOn:    { color: C.teal, fontWeight: '700' },
  indieBadge:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.tealSoft, borderRadius: 14, borderWidth: 1, borderColor: C.borderAcc, padding: 14 },
  indieTxt:     { flex: 1, color: C.textSec, fontSize: 12, lineHeight: 18 },
});