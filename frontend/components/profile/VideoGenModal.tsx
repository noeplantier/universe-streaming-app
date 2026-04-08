import React, { memo, useCallback, useRef, useState } from 'react';
import { Animated, Easing, Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem   from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing      from 'expo-sharing';
import { G, H, W } from './theme';
import GalaxyBackground from '../social/GalaxyBackground';
import {
  EXPORT_FORMATS, VIDEO_STYLES, GEN_PHASES,
  type ExportId,
} from './data';


// ─────────────────────────────────────────────────────────────────────────────
interface Props { visible: boolean; onClose: () => void; }

export const VideoGenModal = memo(({ visible, onClose }: Props) => {
  const [style,        setStyle]        = useState('noir');
  const [generating,   setGenerating]   = useState(false);
  const [phase,        setPhase]        = useState(0);
  const [generated,    setGenerated]    = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportId>('h264');
  const [exporting,    setExporting]    = useState(false);
  const [exportStep,   setExportStep]   = useState('');
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [savedToLib,   setSavedToLib]   = useState(false);

  const genProg    = useRef(new Animated.Value(0)).current;
  const exportProg = useRef(new Animated.Value(0)).current;

  const resetState = useCallback(() => {
    setGenerated(false); setExportedPath(null); setSavedToLib(false);
    setExporting(false); setExportStep(''); setPhase(0);
    genProg.setValue(0); exportProg.setValue(0);
  }, [genProg, exportProg]);

  const handleClose = useCallback(() => { resetState(); onClose(); }, [resetState, onClose]);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setGenerating(true); setGenerated(false); genProg.setValue(0);
    for (let i = 0; i < GEN_PHASES.length; i++) {
      setPhase(i);
      await new Promise(r => setTimeout(r, 820 + Math.random() * 600));
    }
    Animated.timing(genProg, { toValue: 1, duration: 460, useNativeDriver: false }).start();
    await new Promise(r => setTimeout(r, 520));
    setGenerating(false); setGenerated(true);
  }, [genProg]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (exporting) return;
    const fmt  = EXPORT_FORMATS.find(f => f.id === exportFormat)!;
    const vst  = VIDEO_STYLES.find(s => s.id === style)?.label ?? 'Universe';
    const name = `UNIVERSE_${vst.replace(/\s+/g,'_')}_${fmt.id}_${Date.now()}.${fmt.ext}`;
    const path = `${FileSystem.cacheDirectory}${name}`;

    setExporting(true); setExportStep(''); setExportedPath(null); setSavedToLib(false);
    exportProg.setValue(0);

    const anim = (to: number) =>
      Animated.timing(exportProg, {
        toValue: to,
        duration: 300,
        easing: Easing.bezier(0.42, 0, 0.58, 1),
        useNativeDriver: false,
      }).start();

    try {
      setExportStep('Vérification des permissions…'); anim(0.12);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { setExportStep('❌ Permission photothèque refusée.'); setExporting(false); return; }

      setExportStep('Préparation du projet…'); anim(0.32);
      await FileSystem.writeAsStringAsync(path, JSON.stringify({
        app: 'UNIVERSE — Studio Cinéma', version: '2.0', style: vst, format: fmt.label,
        exportedAt: new Date().toISOString(),
        note: 'Connecter FFmpeg/Remotion pour le rendu vidéo réel.',
      }, null, 2));
      setExportedPath(path); anim(0.54);

      setExportStep('Enregistrement dans la photothèque…'); anim(0.72);
      try {
        const asset = await MediaLibrary.createAssetAsync(path);
        const album = await MediaLibrary.getAlbumAsync('UNIVERSE Studio');
        if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        else       await MediaLibrary.createAlbumAsync('UNIVERSE Studio', asset, false);
        setSavedToLib(true);
      } catch { /* unsupported format — continue */ }

      setExportStep('Ouverture du partage système…'); anim(0.88);
      const mime = fmt.ext === 'mov' ? 'video/quicktime' : fmt.ext === 'webm' ? 'video/webm' : 'video/mp4';
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: mime,
          UTI: fmt.ext === 'mov' ? 'com.apple.quicktime-movie' : 'public.movie',
          dialogTitle: `Exporter — ${fmt.label}`,
        });
      }
      anim(1); setExportStep('✅ Export terminé');
    } catch (err: any) {
      setExportStep(`❌ Erreur : ${err?.message ?? 'inconnue'}`);
    } finally { setExporting(false); }
  }, [exporting, exportFormat, style, exportProg]);

  const genBarW    = genProg.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] });
  const expBarW    = exportProg.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] });
  const activeStyle = VIDEO_STYLES.find(s => s.id === style)!;
  const activeFmt   = EXPORT_FORMATS.find(f => f.id === exportFormat)!;
  const isDone  = exportStep.startsWith('✅');
  const isError = exportStep.startsWith('❌');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={m.backdrop} onPress={handleClose} />
      <View style={m.sheet}>
        <GalaxyBackground />
        <View style={m.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={m.content}>

          {/* ── Header ── */}
          <View style={m.header}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
              <LinearGradient colors={['#3A0070', G.primary]} style={m.headerIcon}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={m.title}>Studio IA Cinéma</Text>
                <Text style={m.subtitle}>{generated ? 'Prêt pour l\'export' : 'Génération de court métrage'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={m.closeBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.48)" />
            </TouchableOpacity>
          </View>

          {/* ════ Phase A — Config ════ */}
          {!generated && (
            <>
              <Text style={m.sectionLbl}>STYLE CINÉMATOGRAPHIQUE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap:10, paddingBottom:4, paddingRight:20, marginBottom:18 }}>
                {VIDEO_STYLES.map(st => {
                  const on = style === st.id;
                  return (
                    <TouchableOpacity key={st.id}
                      style={[m.styleChip, on && { borderColor:st.color, backgroundColor:`${st.color}15` }]}
                      onPress={() => setStyle(st.id)} activeOpacity={0.8}>
                      <Text style={{ fontSize:22 }}>{st.icon}</Text>
                      <Text style={[m.styleLabel, on && { color:st.color }]}>{st.label}</Text>
                      {on && <View style={[m.styleDot, { backgroundColor:st.color }]} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={m.sectionLbl}>INTENTION NARRATIVE</Text>
              <BlurView intensity={14} tint="dark" style={m.promptBox}>
                <Ionicons name="create-outline" size={15} color={activeStyle.color} style={{ marginRight:10, marginTop:2 }} />
                <Text style={m.promptHint}>
                  Une femme seule dans un appartement vide contemple la pluie sur Paris. Le néon d'en face pulse doucement…
                </Text>
              </BlurView>

              <Text style={m.sectionLbl}>PARAMÈTRES TECHNIQUES</Text>
              <View style={m.paramsGrid}>
                {[
                  { label:'Durée',  val:'2–4 min',      icon:'timer-outline'          },
                  { label:'Format', val:'4K 16:9',       icon:'resize-outline'         },
                  { label:'FPS',    val:'24 fps cinéma', icon:'film-outline'           },
                  { label:'Son',    val:'IA + ambiance', icon:'musical-notes-outline'  },
                ].map(p => (
                  <BlurView key={p.label} intensity={10} tint="dark" style={m.paramCard}>
                    <Ionicons name={p.icon as any} size={14} color={activeStyle.color} />
                    <Text style={m.paramLabel}>{p.label}</Text>
                    <Text style={m.paramVal}>{p.val}</Text>
                  </BlurView>
                ))}
              </View>

              {generating && (
                <BlurView intensity={14} tint="dark" style={m.genBox}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
                    <ActivityIndicator color={activeStyle.color} size="small" />
                    <Text style={m.genPhase}>{GEN_PHASES[phase]}</Text>
                  </View>
                  <View style={m.barTrack}>
                    <Animated.View style={[m.barFill, { width: genBarW }]}>
                      <LinearGradient colors={[G.accent, G.primary, G.cyan]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject} />
                    </Animated.View>
                  </View>
                  <View style={{ flexDirection:'row', gap:6, justifyContent:'center', marginTop:10 }}>
                    {GEN_PHASES.map((_,i) => (
                      <View key={i} style={[m.phaseDot, i<=phase && { backgroundColor:activeStyle.color }]} />
                    ))}
                  </View>
                </BlurView>
              )}

              <TouchableOpacity onPress={handleGenerate} disabled={generating} activeOpacity={0.88}>
                <LinearGradient
                  colors={generating ? ['#1A0035','#2A0050'] : ['#5A0FA0', G.primary]}
                  start={{x:0,y:0}} end={{x:1,y:0}} style={m.actionBtn}>
                  {generating
                    ? <><ActivityIndicator color="#fff" size="small" style={{marginRight:10}} /><Text style={m.actionBtnTxt}>Génération en cours…</Text></>
                    : <><Ionicons name="sparkles" size={18} color="#fff" style={{marginRight:10}} /><Text style={m.actionBtnTxt}>Générer le court métrage</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ════ Phase B — Export ════ */}
          {generated && (
            <>
              <BlurView intensity={14} tint="dark" style={m.successBanner}>
                <LinearGradient colors={['rgba(48,209,88,0.12)','transparent']} style={StyleSheet.absoluteFillObject} />
                <View style={m.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={28} color={G.success} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={m.successTitle}>Court métrage généré ✓</Text>
                  <Text style={m.successSub}>{activeStyle.icon} {activeStyle.label} · Prêt pour l'export</Text>
                </View>
                <TouchableOpacity onPress={() => { setGenerated(false); setExportedPath(null); setSavedToLib(false); }} style={m.regenBtn}>
                  <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.44)" />
                </TouchableOpacity>
              </BlurView>

              <Text style={[m.sectionLbl, { marginTop:4 }]}>FORMAT D'EXPORT</Text>
              {EXPORT_FORMATS.map(fmt => {
                const on = exportFormat === fmt.id;
                return (
                  <TouchableOpacity key={fmt.id} onPress={() => setExportFormat(fmt.id)} activeOpacity={0.85}>
                    <BlurView intensity={10} tint="dark" style={[m.fmtCard, on && { borderColor:fmt.color }]}>
                      <View style={[m.fmtIconCircle, { backgroundColor:`${fmt.color}16`, borderColor:`${fmt.color}30` }]}>
                        <Ionicons name={fmt.icon as any} size={18} color={fmt.color} />
                      </View>
                      <View style={{ flex:1, gap:2 }}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                          <Text style={m.fmtLabel}>{fmt.label}</Text>
                          <View style={[m.fmtBadge, { backgroundColor:`${fmt.color}20`, borderColor:`${fmt.color}40` }]}>
                            <Text style={[m.fmtBadgeTxt, { color:fmt.color }]}>{fmt.badge}</Text>
                          </View>
                        </View>
                        <Text style={m.fmtDesc}>{fmt.desc} · .{fmt.ext}</Text>
                      </View>
                      <View style={[m.radio, on && { borderColor:fmt.color }]}>
                        {on && <View style={[m.radioDot, { backgroundColor:fmt.color }]} />}
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}

              {(exporting || exportStep !== '') && (
                <BlurView intensity={12} tint="dark" style={m.exportProgress}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
                    {exporting
                      ? <ActivityIndicator color={activeFmt.color} size="small" />
                      : <Ionicons name={isDone ? 'checkmark-circle' : 'alert-circle'} size={18} color={isDone ? G.success : G.danger} />
                    }
                    <Text style={[m.exportStepTxt, isDone && {color:G.success}, isError && {color:G.danger}]}>
                      {exportStep}
                    </Text>
                  </View>
                  <View style={m.barTrack}>
                    <Animated.View style={[m.barFill, { width:expBarW }]}>
                      <LinearGradient
                        colors={isDone ? [G.success,'#0FA060'] : [activeFmt.color, G.primary]}
                        start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject} />
                    </Animated.View>
                  </View>
                  {exportedPath && (
                    <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:10 }}>
                      <Ionicons name="document-outline" size={11} color={G.textTer} />
                      <Text style={{ color:G.textTer, fontSize:10, flex:1, fontFamily:Platform.OS==='ios'?'Menlo':'monospace' }} numberOfLines={1}>
                        {exportedPath.split('/').pop()}
                      </Text>
                    </View>
                  )}
                  {savedToLib && (
                    <View style={m.libBadge}>
                      <Ionicons name="images-outline" size={11} color={G.success} />
                      <Text style={m.libBadgeTxt}>Enregistré · Album « UNIVERSE Studio »</Text>
                    </View>
                  )}
                </BlurView>
              )}

              <TouchableOpacity onPress={handleExport} disabled={exporting} activeOpacity={0.88}>
                <LinearGradient
                  colors={exporting ? ['#1A0035','#2A0050'] : isDone ? [G.success,'#0FA060'] : ['#B8860B', G.gold]}
                  start={{x:0,y:0}} end={{x:1,y:0}} style={m.actionBtn}>
                  {exporting
                    ? <><ActivityIndicator color="#fff" size="small" style={{marginRight:10}} /><Text style={[m.actionBtnTxt,{color:'#fff'}]}>Export en cours…</Text></>
                    : isDone
                      ? <><Ionicons name="share-outline" size={18} color="#000" style={{marginRight:10}} /><Text style={[m.actionBtnTxt,{color:'#000'}]}>Partager à nouveau</Text></>
                      : <><Ionicons name="rocket-outline" size={18} color="#000" style={{marginRight:10}} /><Text style={[m.actionBtnTxt,{color:'#000'}]}>Exporter en {activeFmt.label}</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
});
VideoGenModal.displayName = 'VideoGenModal';

// ─────────────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  backdrop:      { flex:1, backgroundColor:'rgba(0,0,0,0.70)' },
  sheet:         { height:H*0.9, borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden', backgroundColor:G.bg, borderTopWidth:1, borderColor:G.glassBorder },
  handle:        { width:36, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.22)', alignSelf:'center', marginTop:10 },
  content:       { paddingHorizontal:20, paddingTop:12, paddingBottom:52 },
  header:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:22 },
  headerIcon:    { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  title:         { color:G.text, fontSize:18, fontWeight:'800', letterSpacing:-0.3 },
  subtitle:      { color:G.textTer, fontSize:12, marginTop:1 },
  closeBtn:      { width:34, height:34, borderRadius:17, backgroundColor:G.glass, borderWidth:1, borderColor:G.glassBorder, alignItems:'center', justifyContent:'center' },
  sectionLbl:    { color:'rgba(255,255,255,0.28)', fontSize:10, fontWeight:'800', letterSpacing:1, marginBottom:10 },
  styleChip:     { alignItems:'center', gap:5, paddingHorizontal:14, paddingVertical:11, borderRadius:16, borderWidth:1, borderColor:G.glassBorder, backgroundColor:G.glass, minWidth:78 },
  styleLabel:    { color:'rgba(255,255,255,0.40)', fontSize:11, fontWeight:'600' },
  styleDot:      { width:5, height:5, borderRadius:3 },
  promptBox:     { flexDirection:'row', alignItems:'flex-start', borderRadius:16, borderWidth:1, borderColor:G.glassBorder, padding:14, marginBottom:16, overflow:'hidden' },
  promptHint:    { color:'rgba(255,255,255,0.20)', fontSize:13, lineHeight:20, fontStyle:'italic', flex:1 },
  paramsGrid:    { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 },
  paramCard:     { width:(W-50)/2, borderRadius:14, borderWidth:1, borderColor:G.glassBorder, padding:12, gap:4, overflow:'hidden' },
  paramLabel:    { color:G.textTer, fontSize:10, fontWeight:'600', marginTop:2 },
  paramVal:      { color:G.text, fontSize:12, fontWeight:'700' },
  genBox:        { borderRadius:16, borderWidth:1, borderColor:'rgba(191,95,255,0.28)', padding:16, marginBottom:16, overflow:'hidden' },
  genPhase:      { color:G.text, fontSize:13, fontWeight:'600' },
  barTrack:      { height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.07)', overflow:'hidden' },
  barFill:       { height:'100%', borderRadius:3, overflow:'hidden' },
  phaseDot:      { width:6, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.12)' },
  actionBtn:     { paddingVertical:16, borderRadius:16, flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:4 },
  actionBtnTxt:  { color:G.text, fontSize:15, fontWeight:'800', letterSpacing:0.2 },
  successBanner: { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, borderWidth:1, borderColor:`${G.success}36`, padding:14, marginBottom:20, overflow:'hidden' },
  successIconWrap:{ width:44, height:44, borderRadius:22, backgroundColor:`${G.success}18`, alignItems:'center', justifyContent:'center' },
  successTitle:  { color:G.text, fontSize:14, fontWeight:'800' },
  successSub:    { color:G.textTer, fontSize:11, marginTop:2 },
  regenBtn:      { width:32, height:32, borderRadius:16, backgroundColor:G.glass, borderWidth:1, borderColor:G.glassBorder, alignItems:'center', justifyContent:'center' },
  fmtCard:       { flexDirection:'row', alignItems:'center', gap:12, borderRadius:14, borderWidth:1, borderColor:G.glassBorder, padding:13, marginBottom:9, overflow:'hidden' },
  fmtIconCircle: { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', borderWidth:1 },
  fmtLabel:      { color:G.text, fontSize:13, fontWeight:'700' },
  fmtDesc:       { color:G.textTer, fontSize:10 },
  fmtBadge:      { borderRadius:4, paddingHorizontal:6, paddingVertical:2, borderWidth:1 },
  fmtBadgeTxt:   { fontSize:8, fontWeight:'800', letterSpacing:0.5 },
  radio:         { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:G.glassBorder, alignItems:'center', justifyContent:'center' },
  radioDot:      { width:10, height:10, borderRadius:5 },
  exportProgress:{ borderRadius:14, borderWidth:1, borderColor:'rgba(191,95,255,0.24)', padding:14, marginBottom:14, overflow:'hidden' },
  exportStepTxt: { color:G.text, fontSize:12, fontWeight:'600', flex:1 },
  libBadge:      { flexDirection:'row', alignItems:'center', gap:6, marginTop:8, backgroundColor:`${G.success}10`, borderRadius:8, padding:7, borderWidth:1, borderColor:`${G.success}26` },
  libBadgeTxt:   { color:G.success, fontSize:10, fontWeight:'600' },
});