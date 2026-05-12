/**
 * app/universe-admin.tsx
 *
 * Universe Office — Back-office de modération vidéo
 *
 * Fonctionnalités :
 *   ✦ Gate super_users — redirige si non autorisé
 *   ✦ Miniature vidéo dans chaque card (source toujours chargée)
 *   ✦ Modal de rejet avec catégorie + raison libre
 *   ✦ Re-approbation depuis l'onglet "Rejetés"
 *   ✦ DetailCard slide-up pour voir toute la vidéo + métadonnées
 *   ✦ Realtime INSERT → nouvelles vidéos pending apparaissent sans refresh
 *   ✦ Realtime UPDATE → feed approuvés mis à jour sans refresh
 */

import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from 'react';
  import {
    Animated,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
  } from 'react-native';
  import { StatusBar }     from 'expo-status-bar';
  import { SafeAreaView }  from 'react-native-safe-area-context';
  import { useRouter }     from 'expo-router';
  import { Ionicons }      from '@expo/vector-icons';
  import * as Haptics      from 'expo-haptics';
  
  import { supabase }      from '@/lib/supabase';
  import GalaxyBackground  from '@/components/social/GalaxyBackground';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // expo-video — même pattern que FeedItem (callback stable module-level)
  // ─────────────────────────────────────────────────────────────────────────────
  let _useVideoPlayer: any = null;
  let _VideoView:      any = null;
  let _useEvent:       any = (_p: any, _e: string, d: any) => d;
  
  if (Platform.OS !== 'web') {
    try {
      const ev        = require('expo-video');
      _useVideoPlayer = ev.useVideoPlayer;
      _VideoView      = ev.VideoView;
      _useEvent       = ev.useEvent ?? require('expo').useEvent;
    } catch {}
  }
  
  // ★ Stable — ne recrée jamais le player à chaque render
  function setupPlayer(p: any) {
    if (!p) return;
    p.loop  = true;
    p.muted = true;
    try { p.bufferOptions = { preferredForwardBufferDuration: 8, preferredBackwardBufferDuration: 0 }; } catch {}
  }
  
  const _hook = _useVideoPlayer ?? ((_src: any) => null);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TOKENS
  // ─────────────────────────────────────────────────────────────────────────────
  const C = {
    bg:       '#03020A',
    surface:  'rgba(255,255,255,0.05)',
    surfaceMd:'rgba(255,255,255,0.09)',
    border:   'rgba(255,255,255,0.09)',
    borderBr: 'rgba(255,255,255,0.18)',
    white:    '#FFFFFF',
    offWhite: 'rgba(255,255,255,0.85)',
    muted:    'rgba(255,255,255,0.40)',
    faint:    'rgba(255,255,255,0.15)',
    neon:     '#7C5EFC',
    neonL:    '#A78BFA',
    green:    '#22C55E',
    greenDk:  '#166534',
    red:      '#EF4444',
    redDk:    '#991B1B',
    gold:     '#F5C842',
    amber:    '#F59E0B',
  } as const;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TYPES
  // ─────────────────────────────────────────────────────────────────────────────
  type Status = 'pending' | 'approved' | 'rejected';
  type RejCategory = 'inappropriate' | 'quality' | 'format' | 'copyright' | 'spam' | 'other';
  
  interface AdminReel {
    id:                 string;
    created_at:         string;
    user_id:            string;
    video_url:          string;
    title:              string | null;
    genre:              string | null;
    director:           string | null;
    year:               string | null;
    synopsis:           string | null;
    duration:           number | null;
    likes_count:        number;
    views_count:        number;
    status:             Status;
    rejection_category: RejCategory | null;
    rejection_reason:   string | null;
    moderated_at:       string | null;
  }
  
  const REJ_CATEGORIES: { key: RejCategory; label: string; icon: string; color: string }[] = [
    { key: 'inappropriate', label: 'Contenu inapproprié', icon: 'warning-outline',     color: '#EF4444' },
    { key: 'quality',       label: 'Qualité insuffisante', icon: 'eye-off-outline',     color: '#F59E0B' },
    { key: 'format',        label: 'Mauvais format',       icon: 'construct-outline',   color: '#8B5CF6' },
    { key: 'copyright',     label: 'Droits d\'auteur',     icon: 'lock-closed-outline', color: '#EC4899' },
    { key: 'spam',          label: 'Spam / répétition',    icon: 'copy-outline',        color: '#6B7280' },
    { key: 'other',         label: 'Autre',                icon: 'help-circle-outline', color: '#9CA3AF' },
  ];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';
  const BUCKET       = 'community-images';
  const COLS         =
    'id,created_at,user_id,video_url,title,genre,director,year,' +
    'synopsis,duration,likes_count,views_count,status,' +
    'rejection_category,rejection_reason,moderated_at';
  
  function resolveUrl(raw: string | null): string {
    if (!raw?.trim()) return '';
    if (raw.startsWith('http')) return raw;
    try {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(raw);
      return data?.publicUrl ?? '';
    } catch { return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${raw}`; }
  }
  
  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SUPABASE QUERIES
  // ─────────────────────────────────────────────────────────────────────────────
  // isSuperUser — désactivé temporairement
  // async function isSuperUser(): Promise<boolean> { ... }
  
  async function fetchReels(status: Status): Promise<AdminReel[]> {
    const { data, error } = await supabase
      .from('reels')
      .select(COLS)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) { console.warn('[admin]', error.message); return []; }
    return (data ?? []) as AdminReel[];
  }
  
  async function moderateReel(params: {
    id:       string;
    status:   Status;
    category?: RejCategory | null;
    reason?:  string | null;
    moderatorId: string;
  }): Promise<void> {
    const payload: Record<string, any> = {
      status:       params.status,
      moderated_by: params.moderatorId,
      moderated_at: new Date().toISOString(),
    };
    if (params.status === 'rejected') {
      payload.rejection_category = params.category ?? null;
      payload.rejection_reason   = params.reason   ?? null;
    } else {
      // Reset rejection fields on re-approval
      payload.rejection_category = null;
      payload.rejection_reason   = null;
    }
    const { error } = await supabase.from('reels').update(payload).eq('id', params.id);
    if (error) throw new Error(error.message);
  }
  
  async function fetchCounts(): Promise<Record<Status, number>> {
    const statuses: Status[] = ['pending', 'approved', 'rejected'];
    const results = await Promise.all(
      statuses.map(s =>
        supabase.from('reels').select('id', { count: 'exact', head: true }).eq('status', s)
          .then(({ count }) => [s, count ?? 0] as [Status, number])
      )
    );
    return Object.fromEntries(results) as Record<Status, number>;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS TABS
  // ─────────────────────────────────────────────────────────────────────────────
  const STATUS_TABS: { key: Status; label: string; icon: string; color: string }[] = [
    { key: 'pending',  label: 'En attente', icon: 'time-outline',             color: C.amber },
    { key: 'approved', label: 'Validés',    icon: 'checkmark-circle-outline', color: C.green },
    { key: 'rejected', label: 'Rejetés',    icon: 'close-circle-outline',     color: C.red   },
  ];
  
  const StatusTabs = memo(function StatusTabs({
    active, counts, onChange,
  }: { active: Status; counts: Record<Status, number>; onChange: (s: Status) => void }) {
    return (
      <View style={tabs.wrap}>
        {STATUS_TABS.map(t => {
          const on = active === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[tabs.tab, on && { borderColor: t.color, backgroundColor: `${t.color}14` }]}
              onPress={() => onChange(t.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={t.icon as any} size={13} color={on ? t.color : C.muted} />
              <Text style={[tabs.label, on && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
              {counts[t.key] > 0 && (
                <View style={[tabs.badge, { backgroundColor: on ? t.color : C.surface }]}>
                  <Text style={[tabs.badgeTxt, { color: on ? '#03020A' : C.muted }]}>{counts[t.key]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  });
  
  const tabs = StyleSheet.create({
    wrap:     { flexDirection:'row', paddingHorizontal:16, gap:8, marginBottom:16 },
    tab:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, paddingVertical:9, borderRadius:12, borderWidth:1, borderColor:C.border, backgroundColor:C.surface },
    label:    { color:C.muted, fontSize:10, fontWeight:'600' },
    badge:    { paddingHorizontal:5, paddingVertical:1, borderRadius:8, minWidth:18, alignItems:'center' },
    badgeTxt: { fontSize:9, fontWeight:'800' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REJECTION MODAL
  // ─────────────────────────────────────────────────────────────────────────────
  interface RejModalProps {
    visible: boolean;
    onConfirm: (cat: RejCategory, reason: string) => void;
    onCancel:  () => void;
  }
  
  const RejectionModal = memo(function RejectionModal({ visible, onConfirm, onCancel }: RejModalProps) {
    const [cat,    setCat]    = useState<RejCategory | null>(null);
    const [reason, setReason] = useState('');
  
    const reset = useCallback(() => { setCat(null); setReason(''); }, []);
  
    const handleConfirm = useCallback(() => {
      if (!cat) return;
      onConfirm(cat, reason.trim());
      reset();
    }, [cat, reason, onConfirm, reset]);
  
    const handleCancel = useCallback(() => { reset(); onCancel(); }, [reset, onCancel]);
  
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel} statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={rm.backdrop} onPress={Keyboard.dismiss}>
            <View style={rm.sheet}>
              <View style={rm.handle} />
              <Text style={rm.title}>Motif du rejet</Text>
              <Text style={rm.sub}>Sélectionne une catégorie (obligatoire)</Text>
  
              <View style={rm.grid}>
                {REJ_CATEGORIES.map(c => {
                  const on = cat === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[rm.catBtn, on && { borderColor: c.color, backgroundColor: `${c.color}14` }]}
                      onPress={() => setCat(c.key)}
                      activeOpacity={0.80}
                    >
                      <Ionicons name={c.icon as any} size={16} color={on ? c.color : C.muted} />
                      <Text style={[rm.catTxt, on && { color: c.color, fontWeight:'700' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
  
              <TextInput
                style={rm.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Précision optionnelle…"
                placeholderTextColor={C.muted}
                multiline
                maxLength={300}
                selectionColor={C.neonL}
              />
  
              <View style={rm.btnRow}>
                <TouchableOpacity style={rm.cancelBtn} onPress={handleCancel} activeOpacity={0.80}>
                  <Text style={rm.cancelTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rm.confirmBtn, !cat && rm.confirmOff]}
                  onPress={handleConfirm}
                  disabled={!cat}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-circle" size={16} color={cat ? C.white : C.muted} />
                  <Text style={[rm.confirmTxt, !cat && { color: C.muted }]}>Rejeter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  });
  
  const rm = StyleSheet.create({
    backdrop:   { flex:1, backgroundColor:'rgba(0,0,0,0.72)', justifyContent:'flex-end' },
    sheet:      { backgroundColor:'#0D0B1E', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40, gap:12 },
    handle:     { width:40, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.18)', alignSelf:'center', marginBottom:8 },
    title:      { color:C.white, fontSize:18, fontWeight:'800', textAlign:'center' },
    sub:        { color:C.muted, fontSize:12, textAlign:'center', marginBottom:4 },
    grid:       { flexDirection:'row', flexWrap:'wrap', gap:8 },
    catBtn:     { flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:12, paddingVertical:9, borderRadius:12, borderWidth:1, borderColor:C.border, backgroundColor:C.surface },
    catTxt:     { color:C.muted, fontSize:12, fontWeight:'600' },
    input:      { backgroundColor:C.surface, borderRadius:12, padding:12, color:C.white, fontSize:13, minHeight:70, borderWidth:1, borderColor:C.border, textAlignVertical:'top' },
    btnRow:     { flexDirection:'row', gap:10, marginTop:4 },
    cancelBtn:  { flex:1, paddingVertical:13, borderRadius:14, borderWidth:1, borderColor:C.border, alignItems:'center' },
    cancelTxt:  { color:C.muted, fontSize:14, fontWeight:'600' },
    confirmBtn: { flex:2, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, borderRadius:14, backgroundColor:C.redDk, borderWidth:1, borderColor:C.red },
    confirmOff: { backgroundColor:C.surface, borderColor:C.border },
    confirmTxt: { color:C.white, fontSize:14, fontWeight:'800' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DETAIL MODAL — vidéo plein écran + métadonnées + re-approbation
  // ─────────────────────────────────────────────────────────────────────────────
  interface DetailModalProps {
    reel:       AdminReel | null;
    onClose:    () => void;
    onReapprove:(id: string) => void;
  }
  
  const DetailModal = memo(function DetailModal({ reel, onClose, onReapprove }: DetailModalProps) {
    const isWeb = Platform.OS === 'web';
    const src   = resolveUrl(reel?.video_url ?? null);
    const player = _hook(reel && src ? src : null, setupPlayer);
  
    useEffect(() => {
      if (!player || isWeb) return;
      try { reel ? player.play() : player.pause(); } catch {}
    }, [reel, player, isWeb]);
  
    if (!reel) return null;
  
    const cat = REJ_CATEGORIES.find(c => c.key === reel.rejection_category);
    const meta = [reel.genre, reel.year, reel.director].filter(Boolean).join(' · ');
  
    return (
      <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <View style={{ flex:1, backgroundColor:'#000' }}>
          <StatusBar style="light" />
  
          {/* Vidéo plein écran */}
          <View style={dm.video}>
            {!isWeb && src && _VideoView && player && (
              <_VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />
            )}
            {isWeb && src && React.createElement('video', {
              src, autoPlay:true, loop:true, muted:false, playsInline:true,
              style:{ width:'100%', height:'100%', objectFit:'cover' },
            })}
  
            {/* Header overlay */}
            <View style={dm.topBar}>
              <TouchableOpacity style={dm.closeBtn} onPress={onClose} activeOpacity={0.80}>
                <Ionicons name="chevron-down" size={22} color={C.white} />
              </TouchableOpacity>
              <Text style={dm.topTitle} numberOfLines={1}>{reel.title ?? 'Sans titre'}</Text>
            </View>
          </View>
  
          {/* Métadonnées + actions */}
          <ScrollView style={dm.info} contentContainerStyle={{ paddingBottom:50 }}>
            <Text style={dm.infoTitle}>{reel.title ?? 'Sans titre'}</Text>
            {!!meta && <Text style={dm.infoMeta}>{meta}</Text>}
            {!!reel.synopsis && <Text style={dm.infoDesc}>{reel.synopsis}</Text>}
  
            <View style={dm.stats}>
              <View style={dm.stat}><Ionicons name="eye-outline" size={12} color={C.muted} /><Text style={dm.statTxt}>{reel.views_count}</Text></View>
              <View style={dm.stat}><Ionicons name="heart-outline" size={12} color={C.muted} /><Text style={dm.statTxt}>{reel.likes_count}</Text></View>
              {reel.duration != null && <View style={dm.stat}><Ionicons name="time-outline" size={12} color={C.muted} /><Text style={dm.statTxt}>{reel.duration}s</Text></View>}
            </View>
  
            <View style={dm.divider} />
            <Text style={dm.metaLabel}>Publié le</Text>
            <Text style={dm.metaVal}>{fmtDate(reel.created_at)}</Text>
  
            {reel.status === 'rejected' && (
              <>
                <View style={dm.divider} />
                {cat && (
                  <View style={[dm.catRow, { borderColor: cat.color, backgroundColor: `${cat.color}10` }]}>
                    <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                    <Text style={[dm.catTxt, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                )}
                {!!reel.rejection_reason && (
                  <Text style={dm.rejReason}>"{reel.rejection_reason}"</Text>
                )}
                <Text style={dm.metaLabel}>Rejeté le {fmtDate(reel.moderated_at)}</Text>
  
                {/* Re-approbation */}
                <TouchableOpacity
                  style={dm.reapproveBtn}
                  onPress={() => { onReapprove(reel.id); onClose(); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={18} color={C.white} />
                  <Text style={dm.reapproveTxt}>Approuver quand même</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  });
  
  const dm = StyleSheet.create({
    video:       { height: 340, backgroundColor:'#000', position:'relative' },
    topBar:      { position:'absolute', top:0, left:0, right:0, flexDirection:'row', alignItems:'center', gap:12, padding:16, paddingTop:52 },
    closeBtn:    { width:36, height:36, borderRadius:18, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' },
    topTitle:    { color:C.white, fontSize:15, fontWeight:'700', flex:1 },
    info:        { flex:1, backgroundColor:'#03020A', padding:20 },
    infoTitle:   { color:C.white, fontSize:20, fontWeight:'800', marginBottom:4 },
    infoMeta:    { color:C.muted, fontSize:12, fontStyle:'italic', marginBottom:8 },
    infoDesc:    { color:'rgba(255,255,255,0.55)', fontSize:13, lineHeight:19, marginBottom:12 },
    stats:       { flexDirection:'row', gap:16, marginBottom:12 },
    stat:        { flexDirection:'row', alignItems:'center', gap:4 },
    statTxt:     { color:C.muted, fontSize:11, fontWeight:'600' },
    divider:     { height:1, backgroundColor:C.border, marginVertical:12 },
    metaLabel:   { color:C.muted, fontSize:10, fontWeight:'600', letterSpacing:0.5, textTransform:'uppercase', marginBottom:3 },
    metaVal:     { color:C.offWhite, fontSize:13, marginBottom:8 },
    catRow:      { flexDirection:'row', alignItems:'center', gap:8, padding:10, borderRadius:12, borderWidth:1, marginBottom:8 },
    catTxt:      { fontSize:13, fontWeight:'700' },
    rejReason:   { color:C.muted, fontSize:12, fontStyle:'italic', marginBottom:8 },
    reapproveBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:C.greenDk, borderRadius:16, paddingVertical:14, marginTop:16, borderWidth:1, borderColor:C.green },
    reapproveTxt:{ color:C.white, fontSize:14, fontWeight:'800' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REEL CARD
  // ─────────────────────────────────────────────────────────────────────────────
  interface ReelCardProps {
    reel:        AdminReel;
    isActive:    boolean;
    activeTab:   Status;
    onApprove:   (id: string) => void;
    onReject:    (id: string) => void;
    onReapprove: (id: string) => void;
    onDetail:    (reel: AdminReel) => void;
  }
  
  const ReelCard = memo(function ReelCard({
    reel, isActive, activeTab, onApprove, onReject, onReapprove, onDetail,
  }: ReelCardProps) {
    const isWeb = Platform.OS === 'web';
    const src   = resolveUrl(reel.video_url);
  
    const [muted,  setMuted]  = useState(true);
    const [acting, setActing] = useState<'approve' | 'reject' | null>(null);
  
    // ★ Toujours charger la source (thumbnail visible même quand inactif)
    const player = _hook(src || null, setupPlayer);
    const { isPlaying } = _useEvent(player, 'playingChange', { isPlaying: false });
  
    useEffect(() => {
      if (isWeb || !player) return;
      try { isActive ? player.play() : player.pause(); } catch {}
    }, [isActive, player, isWeb]);
  
    useEffect(() => {
      if (isWeb || !player) return;
      try { player.muted = muted; } catch {}
    }, [muted, player, isWeb]);
  
    // Animations
    const approveScale = useRef(new Animated.Value(1)).current;
    const rejectScale  = useRef(new Animated.Value(1)).current;
    const cardOp       = useRef(new Animated.Value(1)).current;
  
    const animAction = useCallback((
      scaleRef: Animated.Value,
      action: 'approve' | 'reject',
      cb: () => void,
    ) => {
      setActing(action);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          action === 'approve'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
      }
      Animated.sequence([
        Animated.spring(scaleRef, { toValue:1.16, useNativeDriver:true, tension:300, friction:6 }),
        Animated.spring(scaleRef, { toValue:0.96, useNativeDriver:true, tension:200, friction:8 }),
        Animated.timing(cardOp,   { toValue:0, duration:280, useNativeDriver:true }),
      ]).start(cb);
    }, [cardOp]);
  
    const handleApprove = useCallback(() => {
      if (acting) return;
      animAction(approveScale, 'approve', () => onApprove(reel.id));
    }, [acting, reel.id, approveScale, animAction, onApprove]);
  
    const handleReject = useCallback(() => {
      if (acting) return;
      animAction(rejectScale, 'reject', () => onReject(reel.id));
    }, [acting, reel.id, rejectScale, animAction, onReject]);
  
    const cat = REJ_CATEGORIES.find(c => c.key === reel.rejection_category);
    const meta = [reel.genre, reel.year, reel.director].filter(Boolean).join(' · ');
  
    return (
      <Animated.View style={[cs.card, { opacity: cardOp }]}>
  
        {/* ── Zone vidéo (thumbnail toujours visible) ─────────────────── */}
        <TouchableOpacity style={cs.videoWrap} onPress={() => onDetail(reel)} activeOpacity={0.92}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor:'#000', borderRadius:14 }]} />
  
          {/* Player (toujours monté pour thumbnail) */}
          {!isWeb && src && _VideoView && player && (
            <_VideoView
              player={player}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              nativeControls={false}
              allowsFullscreen={false}
              allowsPictureInPicture={false}
            />
          )}
  
          {isWeb && src && React.createElement('video', {
            src, autoPlay:isActive, loop:true, muted,
            playsInline:true,
            style:{ width:'100%', height:'100%', objectFit:'cover', borderRadius:14 },
          })}
  
          {!src && (
            <View style={cs.noVideo}>
              <Ionicons name="videocam-off-outline" size={28} color={C.muted} />
              <Text style={cs.noVideoTxt}>Aucune vidéo</Text>
            </View>
          )}
  
          {/* Gradient bas */}
          <View style={cs.grad} pointerEvents="none" />
  
          {/* Badge statut */}
          <View style={[cs.statusBadge, {
            backgroundColor: reel.status === 'approved' ? `${C.green}22` : reel.status === 'rejected' ? `${C.red}22` : `${C.amber}22`,
            borderColor:     reel.status === 'approved' ? C.green        : reel.status === 'rejected' ? C.red        : C.amber,
          }]}>
            <Ionicons
              name={reel.status === 'approved' ? 'checkmark-circle' : reel.status === 'rejected' ? 'close-circle' : 'time'}
              size={10}
              color={reel.status === 'approved' ? C.green : reel.status === 'rejected' ? C.red : C.amber}
            />
            <Text style={[cs.statusTxt, { color: reel.status === 'approved' ? C.green : reel.status === 'rejected' ? C.red : C.amber }]}>
              {reel.status === 'approved' ? 'Validé' : reel.status === 'rejected' ? 'Rejeté' : 'En attente'}
            </Text>
          </View>
  
          {/* Bouton mute */}
          <TouchableOpacity style={cs.muteBtn} onPress={() => setMuted(m => !m)} activeOpacity={0.80}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={13} color={C.white} />
          </TouchableOpacity>
  
          {/* Bouton détail */}
          <TouchableOpacity style={cs.detailBtn} onPress={() => onDetail(reel)} activeOpacity={0.80}>
            <Ionicons name="expand-outline" size={13} color={C.white} />
          </TouchableOpacity>
  
          {/* Indicateur lecture */}
          {isActive && !isPlaying && !!src && (
            <View style={cs.playIcon} pointerEvents="none">
              <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.50)" />
            </View>
          )}
        </TouchableOpacity>
  
        {/* ── Métadonnées ──────────────────────────────────────────────── */}
        <View style={cs.meta}>
          <View style={cs.metaRow}>
            <View style={{ flex:1 }}>
              <Text style={cs.metaTitle} numberOfLines={1}>{reel.title ?? 'Sans titre'}</Text>
              {!!meta && <Text style={cs.metaSub} numberOfLines={1}>{meta}</Text>}
            </View>
            <Text style={cs.metaDate}>{fmtDate(reel.created_at)}</Text>
          </View>
  
          {/* Raison de rejet si applicable */}
          {reel.status === 'rejected' && cat && (
            <View style={[cs.rejRow, { backgroundColor:`${cat.color}12`, borderColor:cat.color }]}>
              <Ionicons name={cat.icon as any} size={11} color={cat.color} />
              <Text style={[cs.rejTxt, { color:cat.color }]}>{cat.label}</Text>
              {!!reel.rejection_reason && (
                <Text style={cs.rejReason} numberOfLines={1}>— {reel.rejection_reason}</Text>
              )}
            </View>
          )}
  
          <View style={cs.statsRow}>
            <View style={cs.stat}><Ionicons name="eye-outline" size={10} color={C.muted} /><Text style={cs.statTxt}>{reel.views_count}</Text></View>
            <View style={cs.stat}><Ionicons name="heart-outline" size={10} color={C.muted} /><Text style={cs.statTxt}>{reel.likes_count}</Text></View>
            {reel.duration != null && <View style={cs.stat}><Ionicons name="time-outline" size={10} color={C.muted} /><Text style={cs.statTxt}>{reel.duration}s</Text></View>}
            <Text style={cs.userId} numberOfLines={1}>{reel.user_id.slice(0,8)}…</Text>
          </View>
        </View>
  
        {/* ── Actions ──────────────────────────────────────────────────── */}
        {activeTab === 'pending' && (
          <View style={cs.actions}>
            <Animated.View style={{ flex:1, transform:[{ scale:rejectScale }] }}>
              <TouchableOpacity style={[cs.btn, cs.btnRej]} onPress={handleReject} disabled={!!acting} activeOpacity={0.85}>
                <Ionicons name="close" size={18} color={C.white} />
                <Text style={cs.btnTxt}>Rejeter</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={{ flex:1, transform:[{ scale:approveScale }] }}>
              <TouchableOpacity style={[cs.btn, cs.btnApr]} onPress={handleApprove} disabled={!!acting} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={18} color={C.white} />
                <Text style={cs.btnTxt}>Approuver</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
  
        {activeTab === 'rejected' && (
          <TouchableOpacity
            style={cs.reapproveRow}
            onPress={() => onReapprove(reel.id)}
            activeOpacity={0.82}
          >
            <Ionicons name="refresh-circle-outline" size={14} color={C.green} />
            <Text style={cs.reapproveTxt}>Approuver par erreur · remettre dans les Reels</Text>
          </TouchableOpacity>
        )}
  
        {activeTab === 'approved' && (
          <View style={cs.approvedRow}>
            <Ionicons name="checkmark-circle" size={13} color={C.green} />
            <Text style={cs.approvedTxt}>Visible dans les Reels · approuvé le {fmtDate(reel.moderated_at)}</Text>
          </View>
        )}
      </Animated.View>
    );
  });
  
  const VIDEO_H = 230;
  const cs = StyleSheet.create({
    card:        { backgroundColor:C.surface, borderRadius:20, borderWidth:1, borderColor:C.border, marginBottom:20, overflow:'hidden' },
    videoWrap:   { height:VIDEO_H, margin:10, marginBottom:0, borderRadius:14, overflow:'hidden', position:'relative' },
    grad:        { position:'absolute', bottom:0, left:0, right:0, height:'45%', backgroundColor:'rgba(0,0,0,0.55)' },
    noVideo:     { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', gap:8 },
    noVideoTxt:  { color:C.muted, fontSize:11 },
    statusBadge: { position:'absolute', top:10, left:10, flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:4, borderRadius:10, borderWidth:1 },
    statusTxt:   { fontSize:9, fontWeight:'800', letterSpacing:0.3 },
    muteBtn:     { position:'absolute', top:10, right:44, width:30, height:30, borderRadius:15, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' },
    detailBtn:   { position:'absolute', top:10, right:10, width:30, height:30, borderRadius:15, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' },
    playIcon:    { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center' },
    meta:        { padding:14, gap:6 },
    metaRow:     { flexDirection:'row', alignItems:'flex-start', gap:8 },
    metaTitle:   { color:C.white, fontSize:14, fontWeight:'800', flex:1 },
    metaSub:     { color:C.muted, fontSize:10, fontStyle:'italic', marginTop:1 },
    metaDate:    { color:C.muted, fontSize:10, marginTop:2 },
    rejRow:      { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:10, paddingVertical:6, borderRadius:10, borderWidth:1 },
    rejTxt:      { fontSize:11, fontWeight:'700' },
    rejReason:   { color:'rgba(255,255,255,0.40)', fontSize:10, flex:1 },
    statsRow:    { flexDirection:'row', alignItems:'center', gap:10 },
    stat:        { flexDirection:'row', alignItems:'center', gap:3 },
    statTxt:     { color:C.muted, fontSize:10, fontWeight:'600' },
    userId:      { color:'rgba(255,255,255,0.18)', fontSize:9, flex:1, textAlign:'right' },
    actions:     { flexDirection:'row', gap:10, padding:12, paddingTop:6 },
    btn:         { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, paddingVertical:13, borderRadius:14 },
    btnApr:      { backgroundColor:C.greenDk, borderWidth:1, borderColor:C.green },
    btnRej:      { backgroundColor:C.redDk,   borderWidth:1, borderColor:C.red   },
    btnTxt:      { color:C.white, fontSize:14, fontWeight:'800' },
    reapproveRow:{ flexDirection:'row', alignItems:'center', gap:8, padding:12, paddingTop:6 },
    reapproveTxt:{ color:C.green, fontSize:11, fontWeight:'600', flex:1 },
    approvedRow: { flexDirection:'row', alignItems:'center', gap:6, padding:12, paddingTop:6 },
    approvedTxt: { color:C.green, fontSize:11, fontWeight:'600' },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  export default function UniverseAdminScreen() {
    const router = useRouter();
  
    const [moderatorId, setModeratorId] = useState<string>('');
    const [activeTab,   setActiveTab]   = useState<Status>('pending');
    const [reels,       setReels]       = useState<AdminReel[]>([]);
    const [loading,     setLoading]     = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [counts,      setCounts]      = useState<Record<Status,number>>({ pending:0, approved:0, rejected:0 });
    const [rejTarget,   setRejTarget]   = useState<string | null>(null);
    const [detailReel,  setDetailReel]  = useState<AdminReel | null>(null);
  
    // ── Récupère l'id du modérateur (sans gate super_user pour l'instant) ──────
    useEffect(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setModeratorId(user.id);
      });
    }, []);
  
    // ── Fetch ─────────────────────────────────────────────────────────────────
    const load = useCallback(async (tab: Status) => {
      setLoading(true); setActiveIndex(0);
      const data = await fetchReels(tab);
      setReels(data);
      setLoading(false);
    }, []);
  
    const refreshCounts = useCallback(async () => {
      const c = await fetchCounts();
      setCounts(c);
    }, []);
  
    useEffect(() => {
      load(activeTab);
      refreshCounts();
    }, []);
  
    // ── Realtime — nouvelles vidéos pending + changements de statut ───────────
    useEffect(() => {
      const chName = `admin_reels_rt_${Date.now()}`;
      const ch = supabase.channel(chName)
        // INSERT → nouvelle vidéo pending
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'reels' },
          ({ new: row }) => {
            const r = row as AdminReel;
            if (activeTab === 'pending') {
              setReels(prev => prev.some(x => x.id === r.id) ? prev : [r, ...prev]);
            }
            setCounts(prev => ({ ...prev, pending: prev.pending + 1 }));
          }
        )
        // UPDATE → changement de statut
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'reels' },
          ({ new: row }) => {
            const r = row as AdminReel;
            setReels(prev => {
              const inList = prev.some(x => x.id === r.id);
              if (r.status === activeTab) {
                return inList ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev];
              } else {
                return prev.filter(x => x.id !== r.id);
              }
            });
            refreshCounts();
          }
        )
        .subscribe();
  
      return () => { supabase.removeChannel(ch); };
    }, [activeTab, refreshCounts]);
  
    // ── Changement d'onglet ───────────────────────────────────────────────────
    const handleTabChange = useCallback((tab: Status) => {
      setActiveTab(tab);
      load(tab);
    }, [load]);
  
    // ── Actions ───────────────────────────────────────────────────────────────
    const removeFromList = useCallback((id: string) => {
      setReels(prev => prev.filter(r => r.id !== id));
      refreshCounts();
    }, [refreshCounts]);
  
    const handleApprove = useCallback(async (id: string) => {
      try {
        await moderateReel({ id, status:'approved', moderatorId });
        removeFromList(id);
      } catch (e: any) { console.error(e.message); }
    }, [moderatorId, removeFromList]);
  
    const openRejectModal = useCallback((id: string) => {
      setRejTarget(id);
    }, []);
  
    const confirmReject = useCallback(async (cat: RejCategory, reason: string) => {
      if (!rejTarget) return;
      setRejTarget(null);
      try {
        await moderateReel({ id:rejTarget, status:'rejected', category:cat, reason, moderatorId });
        removeFromList(rejTarget);
      } catch (e: any) { console.error(e.message); }
    }, [rejTarget, moderatorId, removeFromList]);
  
    const handleReapprove = useCallback(async (id: string) => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      try {
        await moderateReel({ id, status:'approved', moderatorId });
        removeFromList(id);
      } catch (e: any) { console.error(e.message); }
    }, [moderatorId, removeFromList]);
  
    // ── Viewability → autoplay ────────────────────────────────────────────────
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    }).current;
  
    // ── Render item ───────────────────────────────────────────────────────────
    const renderItem = useCallback(({ item, index }: { item: AdminReel; index: number }) => (
      <ReelCard
        reel={item}
        isActive={index === activeIndex}
        activeTab={activeTab}
        onApprove={handleApprove}
        onReject={openRejectModal}
        onReapprove={handleReapprove}
        onDetail={setDetailReel}
      />
    ), [activeIndex, activeTab, handleApprove, openRejectModal, handleReapprove]);
  
    const keyExtractor = useCallback((r: AdminReel) => r.id, []);
  
    const ListEmpty = useMemo(() => (
      loading
        ? <View style={sc.loadBox}><Text style={sc.loadTxt}>Chargement…</Text></View>
        : <View style={sc.empty}>
            <Ionicons name={activeTab === 'pending' ? 'checkmark-done-circle-outline' : activeTab === 'approved' ? 'film-outline' : 'trash-outline'} size={48} color={C.muted} />
            <Text style={sc.emptyTitle}>
              {activeTab === 'pending' ? 'Aucune vidéo en attente' : activeTab === 'approved' ? 'Aucune vidéo validée' : 'Aucune vidéo rejetée'}
            </Text>
          </View>
    ), [loading, activeTab]);
  
    // ─────────────────────────────────────────────────────────────────────────
    return (
      <View style={sc.root}>
        <StatusBar style="light" />
        <GalaxyBackground />
  
        <SafeAreaView style={{ flex:1 }} edges={['top']}>
  
          {/* Header */}
          <View style={sc.header}>
            <TouchableOpacity style={sc.backBtn} onPress={() => router.back()} activeOpacity={0.80}>
              <Ionicons name="chevron-back" size={20} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={sc.title}>Universe Office</Text>
              <Text style={sc.sub}>Modération · vidéos</Text>
            </View>
            <TouchableOpacity style={sc.refreshBtn} onPress={() => { load(activeTab); refreshCounts(); }} activeOpacity={0.80}>
              <Ionicons name="refresh" size={17} color={C.muted} />
            </TouchableOpacity>
          </View>
  
          {/* Tabs */}
          <StatusTabs active={activeTab} counts={counts} onChange={handleTabChange} />
  
          {/* Feed */}
          <FlatList
            data={reels}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={ListEmpty}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            contentContainerStyle={sc.list}
            showsVerticalScrollIndicator={false}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={false}
          />
        </SafeAreaView>
  
        {/* Modal rejet */}
        <RejectionModal
          visible={!!rejTarget}
          onConfirm={confirmReject}
          onCancel={() => setRejTarget(null)}
        />
  
        {/* Detail plein écran */}
        <DetailModal
          reel={detailReel}
          onClose={() => setDetailReel(null)}
          onReapprove={handleReapprove}
        />
      </View>
    );
  }
  
  const sc = StyleSheet.create({
    root:       { flex:1, backgroundColor:C.bg },
    list:       { paddingHorizontal:16, paddingBottom:40 },
    header:     { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:16, marginTop:12 },
    backBtn:    { width:36, height:36, borderRadius:18, backgroundColor:C.surface, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border },
    title:      { color:C.white, fontSize:19, fontWeight:'800', letterSpacing:-0.4 },
    sub:        { color:C.muted, fontSize:11, marginTop:1 },
    refreshBtn: { width:36, height:36, borderRadius:18, backgroundColor:C.surface, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border },
    loadBox:    { paddingVertical:80, alignItems:'center' },
    loadTxt:    { color:C.muted, fontSize:14 },
    empty:      { paddingVertical:80, alignItems:'center', gap:12 },
    emptyTitle: { color:C.offWhite, fontSize:16, fontWeight:'700' },
  });