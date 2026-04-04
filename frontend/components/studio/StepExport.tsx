// /components/studio/StepExport.tsx

import React, { memo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Switch,
} from 'react-native';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import * as Sharing       from 'expo-sharing';
import { FFmpegKit }      from 'ffmpeg-kit-react-native';


// ✅ NEW FILESYSTEM API
import { File, Directory, Paths } from 'expo-file-system';

import {
  G, EXPORT_FORMATS, formatBytes, generateSRT, generateXMP,
  generatePressKit, buildFFmpegCommand,
  type ExportFormat, type SubtitleTrack,
  type ExportedFile, type VideoEditParams,
} from './constants';
import { Badge, CTAButton, SectionHeader } from './UIKit';

export const StepExport = memo(function StepExport(props: any) {
  const {
    selectedFormat, setSelectedFormat,
    exporting, exportProgress, exportStep,
    exportedFiles, embedSrt, setEmbedSrt,
    embedXmp, setEmbedXmp, watermark, setWatermark,
    subtitles, videoUri, onExport,
  } = props;

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: exportProgress,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [exportProgress]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const fmt = EXPORT_FORMATS.find(f => f.id === selectedFormat) ?? EXPORT_FORMATS[0];

  return (
    <View style={s.root}>
      <SectionHeader title="Export" icon="rocket-outline" />

      {EXPORT_FORMATS.map(f => (
        <TouchableOpacity key={f.id} onPress={() => setSelectedFormat(f.id)}>
          <View style={s.card}>
            <Text style={s.title}>{f.label}</Text>
            {selectedFormat === f.id && <Badge label="✓" color={f.color} />}
          </View>
        </TouchableOpacity>
      ))}

      <View style={s.card}>
        <Text>SRT</Text>
        <Switch value={embedSrt} onValueChange={setEmbedSrt} />
      </View>

      {(exporting || exportStep) && (
        <View style={s.progressWrap}>
          <Animated.View style={[s.progressBar, { width: barWidth }]} />
          <Text style={s.progressTxt}>{exportStep}</Text>
        </View>
      )}

      <CTAButton
        label="Exporter"
        onPress={onExport}
        disabled={!videoUri}
        loading={exporting}
      />
    </View>
  );
});


// ================= EXPORT ENGINE (NEW API) =================

export async function runExport(params: {
  videoUri: string;
  selectedFormat: ExportFormat;
  subtitles: SubtitleTrack[];
  embedSrt: boolean;
  embedXmp: boolean;
  watermark: boolean;
  meta: any;
  editParams: VideoEditParams;
  onProgress: (p: number, msg: string) => void;
  onFile: (f: ExportedFile) => void;
}) {
  const {
    videoUri, selectedFormat, subtitles,
    embedSrt, embedXmp, meta,
    editParams, onProgress, onFile,
  } = params;

  try {
    const dir = new Directory(Paths.document);
    const filename = `UNIVERSE_${Date.now()}.${selectedFormat.ext}`;
    const file = new File(dir, filename);

    // ── ENCODE
    onProgress(0.1, 'Encodage');

    const cmd = buildFFmpegCommand({
      inputPath: videoUri,
      outputPath: file.uri,
      edit: editParams,
      format: selectedFormat,
    });

    try {
      await FFmpegKit.execute(cmd);
    } catch {
      // fallback copy
      const src = new File(videoUri);
      await src.copyToAsync(file);
    }

    const info = await file.info();

    const videoFile: ExportedFile = {
      name: filename,
      path: file.uri,
      type: 'video',
      bytes: info.size ?? 0,
      icon: 'film',
      color: selectedFormat.color,
    };

    onFile(videoFile);

    // ── SRT
    if (embedSrt && subtitles.length) {
      const srt = new File(dir, filename.replace('.mp4', '.srt'));
      await srt.write(generateSRT(subtitles));
    }

    // ── XMP
    if (embedXmp) {
      const xmp = new File(dir, filename.replace('.mp4', '.xmp'));
      await xmp.write(generateXMP(meta));
    }

    // ── PRESS KIT
    const press = new File(dir, 'press.txt');
    await press.write(generatePressKit(meta));

    // ── SHARE (DOWNLOAD UX)
    onProgress(0.95, 'Téléchargement');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
    }

    onProgress(1, '✅ Done');

    return { success: true, path: file.uri };

  } catch (e: any) {
    onProgress(0, '❌ ' + e.message);
    return { success: false };
  }
}


// ================= STYLES =================

const s = StyleSheet.create({
  root: { gap: 12 },
  card: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#111',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { color: '#fff' },
  progressWrap: { height: 20, backgroundColor: '#222' },
  progressBar: { height: 20, backgroundColor: '#a855f7' },
  progressTxt: { color: '#fff', fontSize: 10 },
});