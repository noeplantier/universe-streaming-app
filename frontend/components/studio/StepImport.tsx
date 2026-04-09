
import React, { memo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { BlurView }       from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

import {
  G, formatBytes, msToTimecode, type VideoEditParams, type ExportFormat,
} from './constants';
import { Badge, CTAButton, SectionHeader } from './UIKit';
import { VideoEditorPanel } from './VideoEditorPanel';

const { width: W } = Dimensions.get('window');

interface StepImportProps {
  videoUri:       string | null;
  onPick:         () => void;
  onRemove:       () => void;
  videoDuration:  number;
  videoFileSize:  number;
  videoFileName:  string;
  editParams:     VideoEditParams;
  onEditChange:   (p: VideoEditParams) => void;
  onProcessed:    (uri: string) => void;
  selectedFormat: ExportFormat;
}

export const StepImport = memo(function StepImport({
  videoUri, onPick, onRemove, videoDuration, videoFileSize, videoFileName,
  editParams, onEditChange, onProcessed, selectedFormat,
}: StepImportProps) {
  const [showEditor, setShowEditor] = useState(false);

  const glowAnim  = useRef(new Animated.Value(0)).current;

  const borderColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(192,96,255,0.15)', 'rgba(192,96,255,0.55)'],
  });

  return (
    <View style={s.root}>
      <SectionHeader
        icon="cloud-upload-outline"
        title="Importer la vidéo"
        sub={videoUri ? videoFileName || 'Vidéo chargée' : 'Formats acceptés : MOV · MP4 · MXF · ProRes'}
      />

      {/* Drop zone */}
      <TouchableOpacity onPress={videoUri ? undefined : onPick} activeOpacity={videoUri ? 1 : 0.85}>
        <Animated.View style={{
          borderRadius: 20, borderWidth: 1.5,
          borderColor: videoUri ? G.primary : borderColor,
          overflow: 'hidden',
        }}>
          <BlurView intensity={14} tint="dark" style={s.dropzone}>
            {videoUri ? (
              <>
                <Video
                  source={{ uri: videoUri }}
                  style={s.videoPreview}
                  resizeMode={ResizeMode.COVER}
                  isLooping shouldPlay={false} isMuted
                />
                <LinearGradient
                  colors={['transparent', 'rgba(6,0,16,0.92)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                {/* Waveform decorative */}
                <View style={s.waveRow}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <View key={i} style={[s.waveBar, {
                      height: 3 + Math.abs(Math.sin(i * 0.7 + 1)) * 14 + Math.random() * 5,
                    }]} />
                  ))}
                </View>

                {/* Meta overlay */}
                <View style={s.videoMeta}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge label="VIDÉO CHARGÉE" color={G.success} />
                    <Badge label={msToTimecode(videoDuration * 1000)} color={G.primary} />
                    {videoFileSize > 0 && <Badge label={formatBytes(videoFileSize)} color={G.cyan} />}
                    {editParams.applied && <Badge label="✓ ÉDITÉ" color={G.gold} />}
                  </View>
                  {videoFileName ? (
                    <Text style={s.videoFileName} numberOfLines={1}>{videoFileName}</Text>
                  ) : null}
                </View>

                {/* Remove */}
                <TouchableOpacity style={s.removeBtn} onPress={onRemove} activeOpacity={0.8}>
                  <BlurView intensity={40} tint="dark" style={s.removeBtnInner}>
                    <Ionicons name="close" size={16} color={G.danger} />
                  </BlurView>
                </TouchableOpacity>

                {/* Replace */}
                <TouchableOpacity style={s.replaceBtn} onPress={onPick} activeOpacity={0.8}>
                  <BlurView intensity={30} tint="dark" style={s.replaceBtnInner}>
                    <Ionicons name="swap-horizontal-outline" size={13} color="rgba(255,255,255,0.6)" />
                    <Text style={s.replaceTxt}>Remplacer</Text>
                  </BlurView>
                </TouchableOpacity>
              </>
            ) : (
              <Animated.View style={s.emptyContent}>
                <LinearGradient
                  colors={['rgba(192,96,255,0.18)', 'rgba(108,16,195,0.28)']}
                  style={s.uploadCircle}
                >
                  <Ionicons name="film" size={40} color={G.primary} />
                </LinearGradient>
                <Text style={s.uploadTitle}>Déposer ou sélectionner</Text>
                <Text style={s.uploadSub}>Jusqu'à 4K · 10 Go · 60 min max</Text>
                <View style={s.formatRow}>
                  {['MOV', 'MP4', 'ProRes', 'MXF', 'WEBM'].map(f => (
                    <View key={f} style={s.formatTag}>
                      <Text style={s.formatTagText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>

      {!videoUri && (
        <CTAButton label="Choisir depuis la galerie" onPress={onPick} icon="images-outline" />
      )}

      {/* ── Éditeur vidéo ── */}
      {videoUri && (
        <>
          <TouchableOpacity
            style={s.editorToggle}
            onPress={() => setShowEditor(v => !v)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(192,96,255,0.15)', 'rgba(108,16,195,0.08)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.editorToggleGrad}
            >
              <View style={s.editorToggleLeft}>
                <LinearGradient
                  colors={['rgba(192,96,255,0.3)', 'rgba(108,16,195,0.2)']}
                  style={s.editorToggleIcon}
                >
                  <Ionicons name="cut" size={16} color={G.primary} />
                </LinearGradient>
                <View>
                  <Text style={s.editorToggleTitle}>Éditeur vidéo</Text>
                  <Text style={s.editorToggleSub}>
                    {editParams.applied ? '✓ Modifications appliquées' : 'Rogner · Vitesse · Zoom · Couleur'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={showEditor ? 'chevron-up' : 'chevron-down'}
                size={18} color={G.textSub}
              />
            </LinearGradient>
          </TouchableOpacity>

          {showEditor && (
            <View style={s.editorContainer}>
              <VideoEditorPanel
                videoUri={videoUri}
                duration={videoDuration}
                editParams={editParams}
                onChange={onEditChange}
                onProcessed={onProcessed}
                selectedFormat={selectedFormat}
              />
            </View>
          )}
        </>
      )}

      {/* ── Spec grid ── */}
      <View style={s.specGrid}>
        {[
          { icon: 'resize',           label: 'Résolution', val: 'jusqu\'à 4K UHD'       },
          { icon: 'timer-outline',    label: 'Durée max',  val: '60 minutes'              },
          { icon: 'musical-notes',    label: 'Audio',      val: 'PCM · AAC · MP3'        },
          { icon: 'color-wand',       label: 'Color',      val: 'Rec.709 / DCI-P3'       },
          { icon: 'layers-outline',   label: 'Codecs',     val: 'H.264 · H.265 · ProRes' },
          { icon: 'document-outline', label: 'Conteneurs', val: 'MP4 · MOV · WEBM'       },
        ].map(sp => (
          <BlurView key={sp.label} intensity={10} tint="dark" style={s.specCard}>
            <Ionicons name={sp.icon as any} size={15} color={G.primary} />
            <Text style={s.specLabel}>{sp.label}</Text>
            <Text style={s.specVal}>{sp.val}</Text>
          </BlurView>
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  root:            { gap: 0 },
  dropzone:        { height: 250, alignItems: 'center', justifyContent: 'center' },
  videoPreview:    { ...StyleSheet.absoluteFillObject as any },
  videoMeta:       { position: 'absolute', bottom: 38, left: 14, right: 50, gap: 6 },
  videoFileName:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontStyle: 'italic' },
  removeBtn:       { position: 'absolute', top: 10, right: 10 },
  removeBtnInner:  { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${G.danger}44` },
  replaceBtn:      { position: 'absolute', bottom: 10, right: 10 },
  replaceBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  replaceTxt:      { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  waveRow:         { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', height: 30, paddingHorizontal: 6, gap: 2, opacity: 0.35 },
  waveBar:         { flex: 1, backgroundColor: G.primary, borderRadius: 2 },
  emptyContent:    { alignItems: 'center', gap: 14 },
  uploadCircle:    { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.3)' },
  uploadTitle:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  uploadSub:       { color: G.textSub, fontSize: 13 },
  formatRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  formatTag:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: G.glassBorder },
  formatTagText:   { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Editor toggle
  editorToggle:       { marginTop: 14, marginBottom: 2, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.28)' },
  editorToggleGrad:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  editorToggleLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editorToggleIcon:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.3)' },
  editorToggleTitle:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  editorToggleSub:    { color: G.textSub, fontSize: 11, marginTop: 1 },
  editorContainer:    { marginBottom: 14 },

  // Specs
  specGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  specCard:   { width: (W - 52) / 2, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 14, gap: 4, overflow: 'hidden' },
  specLabel:  { color: G.textSub, fontSize: 10, fontWeight: '600', marginTop: 2 },
  specVal:    { color: '#fff', fontSize: 11, fontWeight: '700' },
});