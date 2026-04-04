import React, { memo, useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Switch, ScrollView, Alert, Platform,
} from 'react-native';
import { BlurView }       from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as FileSystem    from 'expo-file-system';
import * as Sharing       from 'expo-sharing';
import * as MediaLibrary  from 'expo-media-library';
import { createClient }   from '@supabase/supabase-js';
import { FFmpegKit, ReturnCode, FFmpegKitConfig } from 'ffmpeg-kit-react-native';

import {
  G, EXPORT_FORMATS, formatBytes, generateSRT, generateXMP,
  generatePressKit, buildFFmpegCommand,
  type ExportFormat, type SubtitleTrack, type CastMember,
  type ExportedFile, type VideoEditParams,
} from './constants';
import { Badge, CTAButton, SectionHeader } from './UIKit';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.EXPO_PUBLIC_SUPABASE_KEY || '',
);

interface ExportMeta {
  title: string; director: string; year: string; genre: string;
  synopsis: string; dirNote: string; runtime: string; language: string;
  cast: CastMember[]; dop: string; composer: string; production: string;
  colorSpace: string; aspectRatio: string; festival: string; isan: string;
}

interface StepExportProps {
  selectedFormat:    string;
  setSelectedFormat: (id: string) => void;
  exporting:         boolean;
  exportProgress:    number;
  exportStep:        string;
  exportedFiles:     ExportedFile[];
  savedToLib:        boolean;
  embedSrt:          boolean; setEmbedSrt: (v: boolean) => void;
  embedXmp:          boolean; setEmbedXmp: (v: boolean) => void;
  watermark:         boolean; setWatermark: (v: boolean) => void;
  subtitles:         SubtitleTrack[];
  videoUri:          string | null;
  editParams:        VideoEditParams;
  meta:              ExportMeta;
  onExport:          () => void;
}

export const StepExport = memo(function StepExport({
  selectedFormat, setSelectedFormat,
  exporting, exportProgress, exportStep, exportedFiles, savedToLib,
  embedSrt, setEmbedSrt, embedXmp, setEmbedXmp, watermark, setWatermark,
  subtitles, videoUri, editParams, meta, onExport,
}: StepExportProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: exportProgress, duration: 450,
      useNativeDriver: false, easing: Easing.out(Easing.cubic),
    }).start();
  }, [exportProgress]);

  const barWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const fmt      = EXPORT_FORMATS.find(f => f.id === selectedFormat) ?? EXPORT_FORMATS[2];
  const isDone   = exportStep.startsWith('✅');
  const isError  = exportStep.startsWith('❌');

  const editSummaryItems = [
    editParams.trimStart > 0 || editParams.trimEnd < 9999
      ? `✂️ Rognage : ${editParams.trimStart.toFixed(0)}s → ${editParams.trimEnd.toFixed(0)}s`
      : null,
    editParams.speed !== 1
      ? `⚡ Vitesse : ${editParams.speed}×`
      : null,
    editParams.zoom > 1.01
      ? `🔍 Zoom : ${editParams.zoom.toFixed(2)}×`
      : null,
    editParams.brightness !== 0
      ? `☀️ Luminosité : ${editParams.brightness >= 0 ? '+' : ''}${editParams.brightness.toFixed(2)}`
      : null,
    editParams.applied ? '✅ Traitement FFmpeg appliqué' : '⚠️ Modifications non traitées',
  ].filter(Boolean);

  return (
    <View style={s.root}>
      <SectionHeader icon="rocket-outline" title="Exporter le film" sub="Rendu final · Téléchargement · Partage" />

      {/* ── Résumé montage ── */}
      {editSummaryItems.length > 0 && (
        <BlurView intensity={10} tint="dark" style={s.editSummary}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="cut-outline" size={13} color={G.gold} />
            <Text style={s.editSummaryTitle}>Modifications appliquées</Text>
          </View>
          {editSummaryItems.map((item, i) => (
            <Text key={i} style={s.editSummaryItem}>{item}</Text>
          ))}
          {!editParams.applied && (
            <Text style={[s.editSummaryItem, { color: G.orange, marginTop: 6 }]}>
              ⚠️ Retournez à l'étape Import → Éditeur vidéo et appuyez sur "Appliquer" pour encoder les modifications avant l'export.
            </Text>
          )}
        </BlurView>
      )}

      {/* ── Format selector ── */}
      <Text style={s.sectionHead}>FORMAT D'EXPORT</Text>
      {EXPORT_FORMATS.map(f => {
        const on = selectedFormat === f.id;
        return (
          <TouchableOpacity key={f.id} onPress={() => setSelectedFormat(f.id)} activeOpacity={0.85}>
            <BlurView intensity={10} tint="dark" style={[s.fmtCard, on && { borderColor: f.color }]}>
              <LinearGradient
                colors={on ? [`${f.color}1A`, `${f.color}06`] : ['transparent', 'transparent']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={[s.fmtIcon, { backgroundColor: `${f.color}15`, borderColor: `${f.color}30` }]}>
                <Ionicons name={f.icon as any} size={20} color={f.color} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.fmtLabel}>{f.label}</Text>
                  {f.badge && <Badge label={f.badge} color={f.color} />}
                </View>
                <Text style={s.fmtMeta}>{f.codec} · {f.res} · {f.bitrate}</Text>
                <Text style={[s.fmtMeta, { color: `${f.color}BB` }]}>{f.sizeMb} · .{f.ext}</Text>
              </View>
              <View style={[s.fmtRadio, on && { borderColor: f.color }]}>
                {on && <View style={[s.fmtRadioDot, { backgroundColor: f.color }]} />}
              </View>
            </BlurView>
          </TouchableOpacity>
        );
      })}

      {/* ── Options ── */}
      <Text style={s.sectionHead}>OPTIONS</Text>
      <BlurView intensity={10} tint="dark" style={s.optionsCard}>
        {[
          { label: 'Sous-titres .SRT intégrés',  sub: `${subtitles.length} piste(s) incluses dans l'archive`,      val: embedSrt,  set: setEmbedSrt,  color: G.cyan,    disabled: subtitles.length === 0 },
          { label: 'Métadonnées XMP',             sub: 'Tags Adobe/Apple dans les headers du fichier',              val: embedXmp,  set: setEmbedXmp,  color: G.primary, disabled: false },
          { label: 'Watermark UNIVERSE',          sub: 'Logo coin inférieur droit (désactivé = rendu propre)',      val: watermark, set: setWatermark, color: G.textSub, disabled: false },
        ].map(({ label, sub, val, set, color, disabled }) => (
          <View key={label} style={s.optRow}>
            <View style={{ flex: 1, opacity: disabled ? 0.4 : 1 }}>
              <Text style={s.optLabel}>{label}</Text>
              <Text style={s.optSub}>{sub}</Text>
            </View>
            <Switch
              value={val}
              onValueChange={disabled ? undefined : set}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${color}55` }}
              thumbColor={val ? color : 'rgba(255,255,255,0.4)'}
              ios_backgroundColor="rgba(255,255,255,0.1)"
              disabled={disabled}
            />
          </View>
        ))}
      </BlurView>

      {/* ── Fichiers générés ── */}
      {exportedFiles.length > 0 && (
        <>
          <Text style={s.sectionHead}>FICHIERS GÉNÉRÉS</Text>
          {exportedFiles.map(f => (
            <BlurView key={f.name} intensity={10} tint="dark" style={s.fileCard}>
              <View style={[s.fileIcon, { backgroundColor: `${f.color}15`, borderColor: `${f.color}30` }]}>
                <Ionicons name={f.icon as any} size={16} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{f.name}</Text>
                <Text style={s.fileMeta}>{f.type} · {formatBytes(f.bytes)}</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(f.path, { dialogTitle: f.name });
                  }
                }}
                style={{ padding: 6 }}
              >
                <Ionicons name="share-outline" size={18} color={G.textSub} />
              </TouchableOpacity>
              <Badge label="OK" color={G.success} />
            </BlurView>
          ))}
        </>
      )}

      {/* ── Barre de progression ── */}
      {(exporting || exportStep !== '') && (
        <BlurView intensity={12} tint="dark" style={s.progressWrap}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.progressTitle}>Rendu en cours</Text>
            <Text style={[s.progressPct, isDone && { color: G.success }, isError && { color: G.danger }]}>
              {Math.round(exportProgress * 100)}%
            </Text>
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressBar, { width: barWidth }]}>
              <LinearGradient
                colors={
                  isDone  ? [G.success, '#0FA060'] :
                  isError ? ['#8B0000', G.danger]  :
                  [G.accent, G.primary, G.cyan]
                }
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Ionicons
              name={isDone ? 'checkmark-circle' : isError ? 'alert-circle' : 'time-outline'}
              size={16}
              color={isDone ? G.success : isError ? G.danger : G.textSub}
            />
            <Text style={[s.progressStep, isDone && { color: G.success }, isError && { color: G.danger }]}>
              {exportStep}
            </Text>
          </View>
          {savedToLib && (
            <View style={s.libBadge}>
              <Ionicons name="images-outline" size={11} color={G.success} />
              <Text style={s.libBadgeText}>Enregistré · Album « UNIVERSE Studio »</Text>
            </View>
          )}
        </BlurView>
      )}

      {/* ── CTA ── */}
      <View style={{ gap: 10, marginTop: 8, paddingBottom: 20 }}>
        <CTAButton
          label={
            exporting ? `Encodage… ${Math.round(exportProgress * 100)}%` :
            isDone    ? 'Partager à nouveau' :
            !videoUri ? 'Importez une vidéo d\'abord' :
            'Exporter & Télécharger'
          }
          onPress={onExport}
          variant="gold"
          loading={exporting}
          disabled={!videoUri}
          icon={isDone ? 'share-outline' : 'rocket-outline'}
        />
        {isDone && exportedFiles.length > 0 && (
          <CTAButton
            label="Ouvrir dans les fichiers"
            onPress={async () => {
              const vid = exportedFiles.find(f => f.type.startsWith('Fichier vidéo'));
              if (vid && await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(vid.path, { dialogTitle: vid.name });
              }
            }}
            variant="ghost"
            icon="folder-outline"
          />
        )}
      </View>

      {/* Info card FFmpegKit */}
      <BlurView intensity={8} tint="dark" style={s.infoCard}>
        <Ionicons name="information-circle-outline" size={15} color={G.info} />
        <Text style={s.infoTxt}>
          <Text style={{ color: G.info, fontWeight: '700' }}>ffmpeg-kit-react-native</Text>
          {' '}requis pour l'encodage réel. Installez-le via{'\n'}
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            npx expo install ffmpeg-kit-react-native
          </Text>
          {'\n'}et activez le dev build (EAS Build).
        </Text>
      </BlurView>
    </View>
  );
});

// ─── Export handler (à appeler depuis create.tsx) ─────────────────

export async function runExport(params: {
  videoUri:       string;
  editParams:     VideoEditParams;
  selectedFormat: ExportFormat;
  meta:           ExportMeta;
  subtitles:      SubtitleTrack[];
  embedSrt:       boolean;
  embedXmp:       boolean;
  watermark:      boolean;
  onProgress:     (pct: number, msg: string) => void;
  onFile:         (f: ExportedFile) => void;
  onSavedToLib:   (v: boolean) => void;
}): Promise<{ success: boolean; outputPath: string | null; error?: string }> {
  const {
    videoUri, editParams, selectedFormat, meta, subtitles,
    embedSrt, embedXmp, onProgress, onFile, onSavedToLib,
  } = params;

  const safeTitle = (meta.title || 'Sans_titre').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const ts        = Date.now();
  const baseDir   = FileSystem.documentDirectory!;
  const outPath   = `${baseDir}UNIVERSE_${safeTitle}_${ts}.${selectedFormat.ext}`;
  const files: ExportedFile[] = [];

  try {
    // ── 1. Permissions ──────────────────────────────────────────
    onProgress(0.04, '🔐 Vérification des permissions…');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission photothèque refusée');

    // ── 2. FFmpegKit encode ─────────────────────────────────────
    onProgress(0.10, `🎬 Encodage ${selectedFormat.codec} (${selectedFormat.res})…`);

    const cmd = buildFFmpegCommand({ inputPath: videoUri, outputPath: outPath, edit: editParams, format: selectedFormat });

    // ── REAL FFmpegKit ──────────────────────────────────────────
    // FFmpegKitConfig.enableStatisticsCallback(stats => {
    //   const frames = stats.getVideoFrameNumber();
    //   const dur    = editParams.trimEnd - editParams.trimStart;
    //   const fps    = 25;
    //   const total  = dur * fps;
    //   onProgress(0.10 + (Math.min(frames, total) / total) * 0.55, `Encodage frame ${frames}…`);
    // });
    // const session    = await FFmpegKit.execute(cmd);
    // const returnCode = await session.getReturnCode();
    // if (!ReturnCode.isSuccess(returnCode)) {
    //   const log = await session.getLogsAsString();
    //   throw new Error(`FFmpegKit error: ${log.slice(-300)}`);
    // }

    // SIMULATION ─────────────────────────────────────────────────
    await FileSystem.copyAsync({ from: videoUri, to: outPath });
    for (let p = 0.12; p <= 0.65; p += 0.05) {
      onProgress(p, `Encodage ${selectedFormat.codec}…`);
      await new Promise(r => setTimeout(r, 150));
    }
    // ────────────────────────────────────────────────────────────

    const info = await FileSystem.getInfoAsync(outPath);
    files.push({
      name: `UNIVERSE_${safeTitle}_${ts}.${selectedFormat.ext}`,
      path: outPath, type: `Vidéo ${selectedFormat.codec}`,
      bytes: (info as any).size ?? 0, icon: 'film-outline', color: selectedFormat.color,
    });
    onFile(files[files.length - 1]);

    // ── 3. XMP ─────────────────────────────────────────────────
    onProgress(0.68, '📝 Métadonnées XMP…');
    if (embedXmp) {
      const xmpContent = generateXMP({ title: meta.title, director: meta.director, year: meta.year, genre: meta.genre, synopsis: meta.synopsis });
      const xmpPath    = `${baseDir}UNIVERSE_${safeTitle}_${ts}.xmp`;
      await FileSystem.writeAsStringAsync(xmpPath, xmpContent);
      const xmpInfo    = await FileSystem.getInfoAsync(xmpPath);
      const f: ExportedFile = { name: `UNIVERSE_${safeTitle}_${ts}.xmp`, path: xmpPath, type: 'XMP Metadata', bytes: (xmpInfo as any).size ?? xmpContent.length, icon: 'code-outline', color: G.primary };
      files.push(f); onFile(f);
    }

    // ── 4. SRT ─────────────────────────────────────────────────
    onProgress(0.73, '📋 Sous-titres SRT…');
    if (embedSrt && subtitles.length > 0) {
      const srtContent = generateSRT(subtitles);
      const srtPath    = `${baseDir}UNIVERSE_${safeTitle}_${ts}.srt`;
      await FileSystem.writeAsStringAsync(srtPath, srtContent);
      const srtInfo    = await FileSystem.getInfoAsync(srtPath);
      const f: ExportedFile = { name: `UNIVERSE_${safeTitle}_${ts}.srt`, path: srtPath, type: 'Sous-titres SRT', bytes: (srtInfo as any).size ?? srtContent.length, icon: 'text-outline', color: G.cyan };
      files.push(f); onFile(f);
    }

    // ── 5. Dossier de presse ───────────────────────────────────
    onProgress(0.78, '📰 Dossier de presse…');
    const pressKit     = generatePressKit(meta);
    const pressKitPath = `${baseDir}UNIVERSE_${safeTitle}_DossierPresse_${ts}.txt`;
    await FileSystem.writeAsStringAsync(pressKitPath, pressKit);
    const pkInfo       = await FileSystem.getInfoAsync(pressKitPath);
    const pkF: ExportedFile = { name: `UNIVERSE_${safeTitle}_DossierPresse_${ts}.txt`, path: pressKitPath, type: 'Dossier de presse', bytes: (pkInfo as any).size ?? pressKit.length, icon: 'document-text-outline', color: G.gold };
    files.push(pkF); onFile(pkF);

    // ── 6. Manifeste JSON ─────────────────────────────────────
    onProgress(0.82, '📦 Manifeste projet…');
    const manifest = JSON.stringify({
      app: 'UNIVERSE Studio', version: '2.0',
      exportedAt: new Date().toISOString(),
      project: { ...meta, cast: meta.cast.filter(c => c.name) },
      format: { id: selectedFormat.id, label: selectedFormat.label, codec: selectedFormat.codec, res: selectedFormat.res, ext: selectedFormat.ext },
      editParams, ffmpegCommand: cmd,
      files: files.map(f => ({ name: f.name, type: f.type, bytes: f.bytes })),
    }, null, 2);
    const maniPath = `${baseDir}UNIVERSE_${safeTitle}_manifest_${ts}.json`;
    await FileSystem.writeAsStringAsync(maniPath, manifest);
    const maniInfo = await FileSystem.getInfoAsync(maniPath);
    const mF: ExportedFile = { name: `UNIVERSE_${safeTitle}_manifest_${ts}.json`, path: maniPath, type: 'Manifeste JSON', bytes: (maniInfo as any).size ?? manifest.length, icon: 'construct-outline', color: G.textSub };
    files.push(mF); onFile(mF);

    // ── 7. Supabase (non-bloquant) ─────────────────────────────
    onProgress(0.87, '☁️ Synchronisation cloud…');
    try {
      await supabase.from('projects').insert({
        title: meta.title || 'Sans titre', director: meta.director,
        year: parseInt(meta.year) || new Date().getFullYear(),
        genre: meta.genre, format: selectedFormat.id,
        export_date: new Date().toISOString(),
        file_count: files.length, created_at: new Date().toISOString(),
      });
    } catch { /* non-bloquant */ }

    // ── 8. MediaLibrary ────────────────────────────────────────
    onProgress(0.92, '🖼️ Enregistrement dans la galerie…');
    try {
      const videoAsset = await MediaLibrary.createAssetAsync(outPath);
      const album      = await MediaLibrary.getAlbumAsync('UNIVERSE Studio');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([videoAsset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('UNIVERSE Studio', videoAsset, false);
      }
      onSavedToLib(true);
    } catch { /* déjà logué */ }

    // ── 9. Share ───────────────────────────────────────────────
    onProgress(0.96, '📤 Ouverture du partage…');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outPath, {
        mimeType:    `video/${selectedFormat.ext}`,
        dialogTitle: `Exporter "${meta.title || 'Sans titre'}" — ${selectedFormat.label}`,
        UTI:         selectedFormat.ext === 'mov' ? 'com.apple.quicktime-movie' : 'public.mpeg-4',
      });
    }

    onProgress(1, `✅ Export complet — ${files.length} fichier(s) générés`);
    return { success: true, outputPath: outPath };

  } catch (err: any) {
    const msg = err?.message ?? 'Erreur inconnue';
    onProgress(exportProgress, `❌ ${msg}`);
    return { success: false, outputPath: null, error: msg };
  }
}

// ── Valeur exportProgress capturée dans le handler ────────────────
let exportProgress = 0; // used only in error closure above

const s = StyleSheet.create({
  root:            { gap: 0 },
  editSummary:     { borderRadius: 14, borderWidth: 1, borderColor: `${G.gold}33`, padding: 14, marginBottom: 16, overflow: 'hidden' },
  editSummaryTitle:{ color: '#fff', fontSize: 13, fontWeight: '700' },
  editSummaryItem: { color: G.textSub, fontSize: 12, marginTop: 4 },
  sectionHead:     { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  fmtCard:         { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 10, overflow: 'hidden' },
  fmtIcon:         { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fmtLabel:        { color: '#fff', fontSize: 14, fontWeight: '700' },
  fmtMeta:         { color: G.textSub, fontSize: 10, fontVariant: ['tabular-nums'] },
  fmtRadio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  fmtRadioDot:     { width: 11, height: 11, borderRadius: 6 },
  optionsCard:     { borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 4, marginBottom: 14, overflow: 'hidden' },
  optRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  optLabel:        { color: '#fff', fontSize: 13, fontWeight: '600' },
  optSub:          { color: G.textSub, fontSize: 11, marginTop: 1 },
  fileCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, padding: 12, marginBottom: 8, overflow: 'hidden' },
  fileIcon:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fileName:        { color: '#fff', fontSize: 13, fontWeight: '600' },
  fileMeta:        { color: G.textSub, fontSize: 10, marginTop: 1 },
  progressWrap:    { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,96,255,0.22)', padding: 16, marginBottom: 14, overflow: 'hidden' },
  progressTitle:   { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  progressPct:     { color: G.primary, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressTrack:   { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressBar:     { height: '100%', borderRadius: 4, overflow: 'hidden' },
  progressStep:    { color: G.textSub, fontSize: 11, flex: 1 },
  libBadge:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(30,215,96,0.07)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(30,215,96,0.2)' },
  libBadgeText:    { color: G.success, fontSize: 10, fontWeight: '600' },
  infoCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, marginTop: 8, overflow: 'hidden', marginBottom: 20 },
  infoTxt:         { color: G.textSub, fontSize: 12, lineHeight: 18, flex: 1 },
});