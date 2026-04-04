
import React, { memo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Platform, Switch,
} from 'react-native';
import { BlurView }       from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as Sharing       from 'expo-sharing';
import * as FileSystem    from 'expo-file-system/legacy';
import * as MediaLibrary  from 'expo-media-library';

import {
  G, EXPORT_FORMATS, formatBytes,
  type ExportFormat, type ExportedFile, type VideoEditParams,
  type SubtitleTrack, type CastMember,
} from './constants';
import { Badge, CTAButton, SectionHeader } from './UIKit';

// ── FFmpegKit — import conditionnel (indispo sur web) ────────────────────────
let FFmpegKit: any     = null;
let ReturnCode: any    = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kit       = require('ffmpeg-kit-react-native');
    FFmpegKit  = kit.FFmpegKit;
    ReturnCode = kit.ReturnCode;
  } catch (e) {
    console.warn('[StepExport] ffmpeg-kit-react-native introuvable :', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportMeta {
  title:       string;
  director:    string;
  year:        string;
  genre:       string;
  synopsis:    string;
  dirNote:     string;
  runtime:     string;
  language:    string;
  dop:         string;
  composer:    string;
  production:  string;
  cast:        CastMember[];
  festival:    string;
  colorSpace:  string;
  aspectRatio: string;
  isan:        string;
}

interface Props {
  // Format
  selectedFormat:    string;
  setSelectedFormat: (id: string) => void;

  // État export
  exporting:      boolean;
  exportProgress: number;
  exportStep:     string;
  exportedFiles:  ExportedFile[];
  savedToLib:     boolean;

  // Options
  embedSrt:    boolean;
  setEmbedSrt: (v: boolean) => void;
  embedXmp:    boolean;
  setEmbedXmp: (v: boolean) => void;
  watermark:   boolean;
  setWatermark:(v: boolean) => void;

  // Données de montage
  videoUri:   string | null;
  editParams: VideoEditParams;
  subtitles:  SubtitleTrack[];
  meta:       ExportMeta;

  onExport: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant UI
// ─────────────────────────────────────────────────────────────────────────────

export const StepExport = memo(function StepExport({
  selectedFormat, setSelectedFormat,
  exporting, exportProgress, exportStep, exportedFiles, savedToLib,
  embedSrt, setEmbedSrt, embedXmp, setEmbedXmp, watermark, setWatermark,
  videoUri, editParams, subtitles, meta,
  onExport,
}: Props) {

  // Barre de progression animée
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue:         exportProgress,
      duration:        350,
      useNativeDriver: false,
      easing:          Easing.out(Easing.cubic),
    }).start();
  }, [exportProgress]);

  const barWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  const fmt = EXPORT_FORMATS.find(f => f.id === selectedFormat) ?? EXPORT_FORMATS[2];

  // ── Calcul de la durée de montage ──────────────────────────────────────────
  const trimDuration = (editParams.trimEnd ?? 120) - (editParams.trimStart ?? 0);

  return (
    <View style={s.root}>

      {/* ── En-tête ── */}
      <SectionHeader
        icon="rocket-outline"
        title="Export Final"
        sub="Montage complet : trim · metadata · sous-titres"
      />

      {/* ── Résumé du montage ── */}
      <BlurView style={s.summaryCard} intensity={12} tint="dark">
        <LinearGradient
          colors={['rgba(90,15,160,0.25)', 'rgba(192,96,255,0.08)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.summaryTitle}>Résumé du montage</Text>
        <View style={s.summaryRow}>
          <Ionicons name="cut-outline" size={14} color={G.primary} />
          <Text style={s.summaryTxt}>
            Trim : {fmtTime(editParams.trimStart ?? 0)} → {fmtTime(editParams.trimEnd ?? 0)}
            {'  '}({fmtTime(trimDuration)})
          </Text>
        </View>
        {meta.title ? (
          <View style={s.summaryRow}>
            <Ionicons name="film-outline" size={14} color={G.primary} />
            <Text style={s.summaryTxt} numberOfLines={1}>Titre : {meta.title}</Text>
          </View>
        ) : null}
        {subtitles.length > 0 && (
          <View style={s.summaryRow}>
            <Ionicons name="text-outline" size={14} color={G.primary} />
            <Text style={s.summaryTxt}>{subtitles.length} sous-titres détectés</Text>
          </View>
        )}
        <View style={s.summaryRow}>
          <Ionicons name="resize-outline" size={14} color={G.primary} />
          <Text style={s.summaryTxt}>Format : {fmt.label} · {fmt.codec} · {fmt.res}</Text>
        </View>
      </BlurView>

      {/* ── Sélection du format ── */}
      <Text style={s.sectionLabel}>FORMAT DE SORTIE</Text>
      {EXPORT_FORMATS.map(f => {
        const on = f.id === selectedFormat;
        return (
          <TouchableOpacity key={f.id} onPress={() => setSelectedFormat(f.id)} activeOpacity={0.8}>
            <BlurView
              style={[s.formatCard, on && { borderColor: f.color, borderWidth: 1.5 }]}
              intensity={on ? 18 : 8}
              tint="dark"
            >
              {on && (
                <LinearGradient
                  colors={[`${f.color}25`, `${f.color}08`]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={[s.formatDot, { backgroundColor: f.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.formatLabel, on && { color: '#fff' }]}>{f.label}</Text>
                <Text style={s.formatMeta}>{f.codec} · {f.res} · .{f.ext}</Text>
              </View>
              {on && <Ionicons name="checkmark-circle" size={18} color={f.color} />}
            </BlurView>
          </TouchableOpacity>
        );
      })}

      {/* ── Options d'export ── */}
      <Text style={s.sectionLabel}>OPTIONS D'ENCODAGE</Text>
      <BlurView style={s.optCard} intensity={10} tint="dark">
        <ToggleRow
          label="Intégrer sous-titres (.srt)"
          sub={subtitles.length > 0 ? `${subtitles.length} pistes` : 'Aucun sous-titre'}
          icon="text-outline"
          value={embedSrt}
          onToggle={setEmbedSrt}
          disabled={subtitles.length === 0}
        />
        <View style={s.divider} />
        <ToggleRow
          label="Intégrer métadonnées XMP"
          sub={meta.title ? meta.title : 'Titre non renseigné'}
          icon="information-circle-outline"
          value={embedXmp}
          onToggle={setEmbedXmp}
        />
        <View style={s.divider} />
        <ToggleRow
          label="Filigrane «UNIVERSE Studio»"
          sub="Incruste le logo en bas à droite"
          icon="logo-closed-captioning"
          value={watermark}
          onToggle={setWatermark}
        />
      </BlurView>

      {/* ── Progression ── */}
      {(exporting || exportStep !== '') && (
        <BlurView style={s.progressCard} intensity={14} tint="dark">
          <View style={s.progressHeader}>
            <Text style={s.progressLabel}>
              {exporting ? `Encodage  ${Math.round(exportProgress * 100)} %` : exportStep}
            </Text>
            {exporting && (
              <Text style={s.progressPct}>{Math.round(exportProgress * 100)} %</Text>
            )}
          </View>
          <View style={s.bar}>
            <Animated.View
              style={[
                s.fill,
                { width: barWidth, backgroundColor: fmt.color ?? G.primary },
              ]}
            />
          </View>
          {exportStep !== '' && (
            <Text style={s.stepTxt}>{exportStep}</Text>
          )}
        </BlurView>
      )}

      {/* ── Fichiers exportés ── */}
      {exportedFiles.length > 0 && (
        <>
          <Text style={s.sectionLabel}>FICHIERS GÉNÉRÉS</Text>
          {exportedFiles.map(f => (
            <BlurView key={f.name} style={s.fileCard} intensity={10} tint="dark">
              <Ionicons name={f.icon as any ?? 'film-outline'} size={20} color={f.color ?? G.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.fileName} numberOfLines={1}>{f.name}</Text>
                <Text style={s.fileMeta}>{formatBytes(f.bytes)}</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (Platform.OS === 'web') {
                    const a = document.createElement('a');
                    a.href  = f.path;
                    a.download = f.name;
                    a.click();
                  } else {
                    await Sharing.shareAsync(f.path);
                  }
                }}
                style={s.shareBtn}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </BlurView>
          ))}
          {savedToLib && (
            <View style={s.savedBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#4ade80" />
              <Text style={s.savedTxt}>Enregistré dans la photothèque</Text>
            </View>
          )}
        </>
      )}

      {/* ── CTA ── */}
      <CTAButton
        label={
          exporting
            ? `Encodage… ${Math.round(exportProgress * 100)} %`
            : exportedFiles.length > 0
            ? 'Re-exporter'
            : 'Exporter & Télécharger'
        }
        onPress={onExport}
        disabled={!videoUri || exporting}
        icon={exporting ? undefined : 'rocket-outline'}
      />

    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant — ligne toggle
// ─────────────────────────────────────────────────────────────────────────────

function ToggleRow({
  label, sub, icon, value, onToggle, disabled = false,
}: {
  label: string; sub?: string; icon: string;
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[s.toggleRow, disabled && { opacity: 0.4 }]}>
      <Ionicons name={icon as any} size={16} color={G.primary} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {sub ? <Text style={s.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onToggle}
        thumbColor="#fff"
        trackColor={{ false: '#333', true: G.primary }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Génère un fichier .srt depuis les pistes SubtitleTrack */
function buildSrtContent(subtitles: SubtitleTrack[]): string {
  return subtitles
    .map((sub, i) => {
      const fmt = (s: number) => {
        const h  = Math.floor(s / 3600);
        const m  = Math.floor((s % 3600) / 60);
        const sc = Math.floor(s % 60);
        const ms = Math.round((s - Math.floor(s)) * 1000);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
      };
      return `${i + 1}\n${fmt(sub.start)} --> ${fmt(sub.end)}\n${sub.text}\n`;
    })
    .join('\n');
}

/** Construit la commande FFmpeg complète */
function buildFFmpegCommand(params: {
  inputPath:    string;
  outputPath:   string;
  trimStart:    number;
  trimDuration: number;
  format:       ExportFormat;
  meta:         ExportMeta;
  srtPath?:     string;
  watermark:    boolean;
  embedXmp:     boolean;
}): string {
  const { inputPath, outputPath, trimStart, trimDuration, format, meta, srtPath, watermark, embedXmp } = params;
  const args: string[] = [];

  // ── Seeking d'entrée (rapide, avant -i) ─────────────────────────────────
  args.push(`-ss ${trimStart}`);
  args.push(`-i "${inputPath}"`);
  args.push(`-t ${trimDuration}`);
  args.push('-avoid_negative_ts make_zero');

  // ── Codec vidéo ─────────────────────────────────────────────────────────
  switch (format.id) {
    case '720_h264':
      args.push('-c:v libx264 -crf 23 -preset fast -profile:v high -level 4.0');
      args.push('-c:a aac -b:a 160k -ar 48000');
      break;
    case '1080_h264':
      args.push('-c:v libx264 -crf 18 -preset slow -profile:v high -level 4.1');
      args.push('-c:a aac -b:a 192k -ar 48000');
      break;
    case '4k_hevc':
      args.push('-c:v libx265 -crf 20 -preset medium -tag:v hvc1');
      args.push('-c:a aac -b:a 256k -ar 48000');
      break;
    case 'prores_422':
      args.push('-c:v prores_ks -profile:v 3 -vendor apl0 -bits_per_mb 8000');
      args.push('-c:a pcm_s16le -ar 48000');
      break;
    default:
      args.push('-c:v libx264 -crf 20 -preset fast');
      args.push('-c:a aac -b:a 160k');
  }

  // ── Filtres vidéo (vf) ───────────────────────────────────────────────────
  const vfilters: string[] = [];

  // Résolution cible
  const [tw, th] = (format.res ?? '1920x1080').replace('×', 'x').split('x');
  if (tw && th) {
    // scale avec letterbox/pillarbox si nécessaire
    vfilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease`);
    vfilters.push(`pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:black`);
  }

  // Sous-titres brûlés dans la vidéo
  if (srtPath) {
    // Chemin sans guillemets internes
    const safePath = srtPath.replace(/'/g, "\\'");
    vfilters.push(
      `subtitles='${safePath}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,Outline=2,Shadow=1,MarginV=20'`
    );
  }

  // Filigrane
  if (watermark) {
    vfilters.push(
      `drawtext=text='UNIVERSE Studio':fontcolor=white@0.25:fontsize=18:x=w-tw-24:y=h-th-20:shadowcolor=black@0.4:shadowx=1:shadowy=1`
    );
  }

  if (vfilters.length > 0) {
    args.push(`-vf "${vfilters.join(',')}"`);
  }

  // ── Métadonnées ─────────────────────────────────────────────────────────
  if (embedXmp) {
    const esc = (s: string) => s.replace(/"/g, '\\"');
    if (meta.title)      args.push(`-metadata title="${esc(meta.title)}"`);
    if (meta.director)   args.push(`-metadata artist="${esc(meta.director)}"`);
    if (meta.year)       args.push(`-metadata date="${esc(meta.year)}"`);
    if (meta.genre)      args.push(`-metadata genre="${esc(meta.genre)}"`);
    if (meta.synopsis)   args.push(`-metadata description="${esc(meta.synopsis)}"`);
    if (meta.language)   args.push(`-metadata language="${esc(meta.language)}"`);
    if (meta.composer)   args.push(`-metadata composer="${esc(meta.composer)}"`);
    if (meta.production) args.push(`-metadata comment="${esc(meta.production)}"`);
    if (meta.isan)       args.push(`-metadata isan="${esc(meta.isan)}"`);
    if (meta.runtime)    args.push(`-metadata duration="${esc(meta.runtime)}"`);
  }

  // ── Flags de conteneur ──────────────────────────────────────────────────
  if (format.ext === 'mp4') {
    args.push('-movflags +faststart');   // lecture streaming immédiate
  }

  args.push(`"${outputPath}"`);
  return args.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// runExport — Pipeline principale (native FFmpegKit + web MediaRecorder)
// ─────────────────────────────────────────────────────────────────────────────

export async function runExport({
  videoUri,
  editParams,
  selectedFormat,
  meta,
  subtitles,
  embedSrt,
  embedXmp,
  watermark,
  onProgress,
  onFile,
  onSavedToLib,
}: {
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
}): Promise<{ success: boolean; error?: string }> {

  const ts       = Date.now();
  const filename = `UNIVERSE_${meta.title ? meta.title.replace(/\s+/g, '_') : ts}.${selectedFormat.ext}`;
  const trimStart    = editParams.trimStart  ?? 0;
  const trimEnd      = editParams.trimEnd    ?? 120;
  const trimDuration = Math.max(trimEnd - trimStart, 1);

  // ─────────────────────────────────────────────────────────────────────────
  // 🌐 WEB — MediaRecorder trim + téléchargement navigateur
  // ─────────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    try {
      onProgress(0.05, 'Préparation web…');

      // Récupère le blob source
      const sourceRes  = await fetch(videoUri);
      const sourceBlob = await sourceRes.blob();

      // Trim via HTMLVideoElement + MediaRecorder (best-effort)
      const trimmedBlob = await trimBlobWeb(videoUri, trimStart, trimDuration, (p) => {
        onProgress(0.05 + p * 0.85, p < 1 ? `Encodage web… ${Math.round(p * 100)} %` : 'Finalisation…');
      });

      const finalBlob = trimmedBlob ?? sourceBlob;
      const blobUrl   = URL.createObjectURL(finalBlob);

      onProgress(0.95, 'Téléchargement…');
      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      onFile({
        name: filename, path: blobUrl, type: 'video',
        bytes: finalBlob.size, icon: 'film-outline', color: selectedFormat.color,
      });
      onProgress(1, '✅ Téléchargé');
      return { success: true };

    } catch (e: any) {
      onProgress(0, `❌ ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 📱 NATIVE — Pipeline FFmpegKit complète
  // ─────────────────────────────────────────────────────────────────────────
  if (!FFmpegKit) {
    return { success: false, error: 'ffmpeg-kit-react-native non installé. Lancez : npx expo install ffmpeg-kit-react-native' };
  }

  try {
    const docDir    = FileSystem.documentDirectory!;
    const outputPath = `${docDir}${filename}`;
    let   srtPath: string | undefined;

    // ── 1. Générer le fichier SRT si nécessaire ───────────────────────────
    onProgress(0.04, 'Génération sous-titres…');
    if (embedSrt && subtitles.length > 0) {
      srtPath = `${docDir}export_subs_${ts}.srt`;
      await FileSystem.writeAsStringAsync(srtPath, buildSrtContent(subtitles), {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    // ── 2. Construire la commande FFmpeg ──────────────────────────────────
    onProgress(0.08, 'Construction commande FFmpeg…');
    const cmd = buildFFmpegCommand({
      inputPath:    videoUri,
      outputPath,
      trimStart,
      trimDuration,
      format:       selectedFormat,
      meta,
      srtPath,
      watermark,
      embedXmp,
    });

    // ── 3. Exécution FFmpegKit avec suivi progression ─────────────────────
    onProgress(0.12, 'Démarrage encodage…');

    await new Promise<void>((resolve, reject) => {
      FFmpegKit.executeAsync(
        cmd,
        // Callback de fin
        async (session: any) => {
          const rc = await session.getReturnCode();
          if (ReturnCode.isSuccess(rc)) {
            resolve();
          } else {
            const logs = await session.getLogsAsString();
            reject(new Error(`FFmpeg failed (rc=${rc})\n${logs}`));
          }
        },
        // Callback de log (progression approximative via durée)
        (log: any) => {
          const msg: string = log.getMessage() ?? '';
          // Extraire time= pour la progression
          const match = msg.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
          if (match) {
            const elapsed =
              parseInt(match[1]) * 3600 +
              parseInt(match[2]) * 60 +
              parseFloat(match[3]);
            const pct = Math.min(elapsed / trimDuration, 0.99);
            onProgress(0.12 + pct * 0.80, `Encodage… ${Math.round(pct * 100)} %`);
          }
        },
        // Callback de statistiques (vitesse)
        (_stats: any) => {},
      );
    });

    // ── 4. Vérifier le fichier de sortie ──────────────────────────────────
    onProgress(0.94, 'Vérification…');
    const info = await FileSystem.getInfoAsync(outputPath);
    if (!info.exists) throw new Error('Fichier de sortie introuvable après FFmpeg');

    // ── 5. Nettoyer le SRT temporaire ─────────────────────────────────────
    if (srtPath) {
      await FileSystem.deleteAsync(srtPath, { idempotent: true });
    }

    // ── 6. Enregistrer dans la photothèque ────────────────────────────────
    onProgress(0.96, 'Enregistrement photothèque…');
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(outputPath);
        onSavedToLib(true);
      }
    } catch { /* non bloquant */ }

    // ── 7. Partage natif ──────────────────────────────────────────────────
    onProgress(0.98, 'Prêt à partager…');
    onFile({
      name:  filename,
      path:  outputPath,
      type:  'video',
      bytes: (info as any).size ?? 0,
      icon:  'film-outline',
      color: selectedFormat.color,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outputPath, {
        mimeType:   selectedFormat.ext === 'mov' ? 'video/quicktime' : 'video/mp4',
        dialogTitle: meta.title || 'Vidéo exportée',
      });
    }

    onProgress(1, '✅ Export terminé');
    return { success: true };

  } catch (e: any) {
    console.error('[runExport] Erreur :', e);
    onProgress(0, `❌ ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// trimBlobWeb — Trim dans le navigateur via MediaRecorder
// ─────────────────────────────────────────────────────────────────────────────
async function trimBlobWeb(
  uri: string,
  start: number,
  duration: number,
  onPct: (p: number) => void,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.src         = uri;
      video.crossOrigin = 'anonymous';
      video.muted       = true;

      video.addEventListener('loadedmetadata', () => {
        video.currentTime = start;

        const stream   = (video as any).captureStream?.() ?? (video as any).mozCaptureStream?.();
        if (!stream) { resolve(null); return; }

        const recorder = new MediaRecorder(stream, {
          mimeType:         'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 8_000_000,
        });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));

        recorder.start(200);
        video.play();

        const interval = setInterval(() => {
          const elapsed = video.currentTime - start;
          onPct(Math.min(elapsed / duration, 0.99));
          if (elapsed >= duration) {
            clearInterval(interval);
            recorder.stop();
            video.pause();
          }
        }, 250);
      });

      video.addEventListener('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { gap: 12 },

  summaryCard: {
    borderRadius:   14,
    borderWidth:    1,
    borderColor:    'rgba(192,96,255,0.25)',
    padding:        14,
    overflow:       'hidden',
    gap:            6,
  },
  summaryTitle: { color: '#fff', fontWeight: '800', fontSize: 13, marginBottom: 4 },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTxt:   { color: G.textSub, fontSize: 12, flex: 1 },

  sectionLabel: {
    color:         'rgba(255,255,255,0.3)',
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
    marginTop:     6,
    marginBottom:  2,
  },

  formatCard: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    padding:        13,
    borderRadius:   12,
    borderWidth:    1,
    borderColor:    G.glassBorder,
    overflow:       'hidden',
    marginBottom:   6,
  },
  formatDot:   { width: 10, height: 10, borderRadius: 5 },
  formatLabel: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 13 },
  formatMeta:  { color: G.textSub, fontSize: 11, marginTop: 2 },

  optCard: {
    borderRadius:   12,
    borderWidth:    1,
    borderColor:    G.glassBorder,
    overflow:       'hidden',
    padding:        4,
  },
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical:  10,
    paddingHorizontal: 10,
  },
  toggleLabel: { color: '#fff', fontWeight: '600', fontSize: 13 },
  toggleSub:   { color: G.textSub, fontSize: 11, marginTop: 1 },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: G.glassBorder, marginHorizontal: 8 },

  progressCard: {
    padding:        14,
    borderRadius:   14,
    borderWidth:    1,
    borderColor:    G.glassBorder,
    overflow:       'hidden',
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  progressPct:    { color: G.primary, fontWeight: '800', fontSize: 13 },
  bar:   { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  fill:  { height: 6, borderRadius: 4 },
  stepTxt: { color: G.textSub, fontSize: 11, marginTop: 8, fontStyle: 'italic' },

  fileCard: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        12,
    borderRadius:   12,
    borderWidth:    1,
    borderColor:    G.glassBorder,
    marginBottom:   6,
    overflow:       'hidden',
  },
  fileName: { color: '#fff', fontWeight: '600', fontSize: 13 },
  fileMeta: { color: G.textSub, fontSize: 11, marginTop: 2 },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  savedTxt:   { color: '#4ade80', fontSize: 12, fontWeight: '600' },
});