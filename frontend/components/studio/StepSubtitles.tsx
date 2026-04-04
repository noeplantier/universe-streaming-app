import React, { memo, useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { G } from './constants';
import { SectionHeader, CTAButton } from './UIKit';

interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface Props {
  subtitles: Subtitle[];
  setSubtitles: (s: Subtitle[]) => void;
  videoDuration?: number;
}

const formatTime = (s: number) => {
  const d = new Date(s * 1000).toISOString().substr(11, 12);
  return d.replace('.', ',');
};

export const generateSRT = (subs: Subtitle[]) =>
  subs.map((s, i) =>
    `${i + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)}\n${s.text}\n`
  ).join('\n');

export const StepSubtitles = memo(function StepSubtitles({
  subtitles,
  setSubtitles,
  videoDuration = 60,
}: Props) {

  const [loadingAI, setLoadingAI] = useState(false);

  const add = useCallback(() => {
    setSubtitles([
      ...subtitles,
      {
        id: Date.now().toString(),
        start: 0,
        end: 2,
        text: '',
      },
    ]);
  }, [subtitles]);

  const remove = useCallback((id: string) => {
    setSubtitles(subtitles.filter(s => s.id !== id));
  }, [subtitles]);

  const update = useCallback((id: string, key: keyof Subtitle, value: any) => {
    setSubtitles(subtitles.map(s =>
      s.id === id ? { ...s, [key]: value } : s
    ));
  }, [subtitles]);

  // ── AI GENERATION (mock ready to plug OpenAI) ──
  const generateAI = useCallback(async () => {
    try {
      setLoadingAI(true);

      // simulate AI
      await new Promise(r => setTimeout(r, 1200));

      const generated: Subtitle[] = [
        { id: '1', start: 0, end: 2, text: 'Bienvenue dans ce film.' },
        { id: '2', start: 2, end: 5, text: 'Une histoire captivante commence.' },
        { id: '3', start: 5, end: 8, text: 'Chaque moment compte.' },
      ];

      setSubtitles(generated);

    } catch {
      Alert.alert('Erreur IA', 'Impossible de générer les sous-titres.');
    } finally {
      setLoadingAI(false);
    }
  }, []);

  const renderItem = ({ item }: { item: Subtitle }) => (
    <BlurView intensity={10} tint="dark" style={s.card}>
      
      {/* HEADER */}
      <View style={s.row}>
        <Text style={s.index}>#{subtitles.indexOf(item) + 1}</Text>

        <TouchableOpacity onPress={() => remove(item.id)}>
          <Ionicons name="trash-outline" size={16} color={G.danger} />
        </TouchableOpacity>
      </View>

      {/* TIME */}
      <View style={s.timeRow}>
        <TextInput
          style={s.timeInput}
          value={String(item.start)}
          onChangeText={(v) => update(item.id, 'start', parseFloat(v) || 0)}
          placeholder="Début"
          keyboardType="numeric"
        />
        <Text style={s.arrow}>→</Text>
        <TextInput
          style={s.timeInput}
          value={String(item.end)}
          onChangeText={(v) => update(item.id, 'end', parseFloat(v) || 0)}
          placeholder="Fin"
          keyboardType="numeric"
        />
      </View>

      {/* TEXT */}
      <TextInput
        style={s.input}
        value={item.text}
        onChangeText={(v) => update(item.id, 'text', v)}
        placeholder="Texte du sous-titre..."
        placeholderTextColor={G.textSub}
        multiline
      />

      {/* PREVIEW */}
      <Text style={s.preview}>
        {formatTime(item.start)} → {formatTime(item.end)}
      </Text>

    </BlurView>
  );

  return (
    <View style={s.root}>
      <SectionHeader
        icon="text-outline"
        title="Sous-titres"
        sub="Édition · IA · Export SRT"
      />

      {/* ACTIONS */}
      <View style={s.actions}>
        <CTAButton
          label="Générer avec IA"
          onPress={generateAI}
          loading={loadingAI}
          icon="sparkles-outline"
        />
        <CTAButton
          label="Ajouter"
          onPress={add}
          variant="ghost"
          icon="add"
        />
      </View>

      {/* LIST */}
      <FlatList
        data={subtitles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* EMPTY */}
      {subtitles.length === 0 && (
        <BlurView intensity={10} tint="dark" style={s.empty}>
          <Ionicons name="alert-circle-outline" size={16} color={G.textSub} />
          <Text style={s.emptyTxt}>
            Aucun sous-titre. Génère via IA ou ajoute manuellement.
          </Text>
        </BlurView>
      )}

      {/* EXPORT PREVIEW */}
      {subtitles.length > 0 && (
        <BlurView intensity={10} tint="dark" style={s.export}>
          <Text style={s.exportTitle}>Preview SRT</Text>
          <Text style={s.exportTxt} numberOfLines={6}>
            {generateSRT(subtitles)}
          </Text>
        </BlurView>
      )}
    </View>
  );
});

export default StepSubtitles;

const s = StyleSheet.create({
  root: { gap: 12 },

  actions: {
    flexDirection: 'row',
    gap: 10,
  },

  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: G.glassBorder,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  index: {
    color: '#fff',
    fontWeight: '700',
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },

  timeInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 6,
    borderRadius: 6,
    color: '#fff',
    flex: 1,
  },

  arrow: {
    color: '#fff',
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 10,
    color: '#fff',
    minHeight: 50,
  },

  preview: {
    marginTop: 6,
    color: G.textSub,
    fontSize: 10,
  },

  empty: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
  },

  emptyTxt: {
    color: G.textSub,
    fontSize: 12,
  },

  export: {
    padding: 12,
    borderRadius: 12,
  },

  exportTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 6,
  },

  exportTxt: {
    color: G.textSub,
    fontSize: 10,
  },
});