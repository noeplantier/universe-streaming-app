import React, { memo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';

// ✅ FIX: legacy import (no warning)
import * as FileSystem from 'expo-file-system/legacy';

import {
  G, EXPORT_FORMATS, formatBytes,
  type ExportFormat, type ExportedFile, type VideoEditParams,
} from './constants';
import { Badge, CTAButton, SectionHeader } from './UIKit';

interface Props {
  selectedFormat: string;
  setSelectedFormat: (id: string) => void;
  exporting: boolean;
  exportProgress: number;
  exportStep: string;
  exportedFiles: ExportedFile[];
  videoUri: string | null;
  editParams: VideoEditParams;
  onExport: () => void;
}

export const StepExport = memo(function StepExport({
  selectedFormat,
  setSelectedFormat,
  exporting,
  exportProgress,
  exportStep,
  exportedFiles,
  videoUri,
  editParams,
  onExport,
}: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: exportProgress,
      duration: 400,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [exportProgress]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const fmt = EXPORT_FORMATS.find(f => f.id === selectedFormat) ?? EXPORT_FORMATS[0];

  return (
    <View style={s.root}>
      <SectionHeader
        icon="rocket-outline"
        title="Export"
        sub="Téléchargement réel (Web + Mobile)"
      />

      {/* FORMATS */}
      {EXPORT_FORMATS.map(f => {
        const on = f.id === selectedFormat;
        return (
          <TouchableOpacity key={f.id} onPress={() => setSelectedFormat(f.id)}>
            <BlurView style={[s.card, on && { borderColor: f.color }]}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.meta}>{f.codec} · {f.res}</Text>
            </BlurView>
          </TouchableOpacity>
        );
      })}

      {/* FILES */}
      {exportedFiles.map(f => (
        <BlurView key={f.name} style={s.file}>
          <Text style={s.fileName}>{f.name}</Text>
          <Text style={s.fileMeta}>{formatBytes(f.bytes)}</Text>

          <TouchableOpacity
            onPress={async () => {
              if (Platform.OS === 'web') {
                window.open(f.path, '_blank');
              } else {
                await Sharing.shareAsync(f.path);
              }
            }}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </BlurView>
      ))}

      {/* PROGRESS */}
      {(exporting || exportStep) && (
        <BlurView style={s.progress}>
          <View style={s.bar}>
            <Animated.View style={[s.fill, { width: barWidth }]} />
          </View>
          <Text style={s.step}>{exportStep}</Text>
        </BlurView>
      )}

      {/* CTA */}
      <CTAButton
        label={
          exporting
            ? `Export ${Math.round(exportProgress * 100)}%`
            : 'Exporter & Télécharger'
        }
        onPress={onExport}
        disabled={!videoUri}
      />
    </View>
  );
});

// ─────────────────────────────────────────────
// 🚀 EXPORT CORE FIX (WEB + NATIVE)
// ─────────────────────────────────────────────

export async function runExport({
  videoUri,
  selectedFormat,
  onProgress,
  onFile,
}: {
  videoUri: string;
  selectedFormat: ExportFormat;
  onProgress: (p: number, m: string) => void;
  onFile: (f: ExportedFile) => void;
}): Promise<void> {
  const ts = Date.now();
  const filename = `UNIVERSE_${ts}.${selectedFormat.ext}`;

  try {
    onProgress(0.1, 'Préparation...');

    // ── 🌐 WEB EXPORT ──
    if (Platform.OS === 'web') {
      onProgress(0.3, 'Téléchargement navigateur...');

      const res = await fetch(videoUri);
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      onFile({
        name: filename,
        path: url,
        type: 'video',
        bytes: blob.size,
        icon: 'film-outline',
        color: selectedFormat.color,
      });

      onProgress(1, '✅ Téléchargé');
      return;
    }

    // ── 📱 NATIVE EXPORT ──
    onProgress(0.3, 'Copie fichier...');

    const output = FileSystem.documentDirectory + filename;

    await FileSystem.copyAsync({
      from: videoUri,
      to: output,
    });

    const info = await FileSystem.getInfoAsync(output);

    onFile({
      name: filename,
      path: output,
      type: 'video',
      bytes: (info as any).size ?? 0,
      icon: 'film-outline',
      color: selectedFormat.color,
    });

    onProgress(0.8, 'Partage...');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(output);
    }

    onProgress(1, '✅ Export terminé');

  } catch (e: any) {
    onProgress(0, `❌ ${e.message}`);
  }
}

// ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { gap: 12 },

  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.glassBorder,
  },

  label: { color: '#fff', fontWeight: '700' },
  meta: { color: G.textSub, fontSize: 11 },

  file: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },

  fileName: { color: '#fff' },
  fileMeta: { color: G.textSub, fontSize: 10 },

  progress: { padding: 10, borderRadius: 12 },

  bar: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 4,
  },

  fill: {
    height: 6,
    backgroundColor: G.primary,
  },

  step: {
    color: G.textSub,
    fontSize: 11,
    marginTop: 6,
  },
});