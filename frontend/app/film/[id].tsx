/**
 * app/film/[id].tsx — UNIVERSE
 *
 * ★ getDeviceId() partout — ZERO supabase.auth.* → plus de userId vide
 * ★ handleSave  → écrit dans user_favorites  (visible sur profile)
 * ★ handleWatch → écrit dans user_history    (visible sur profile)
 * ★ Fetch parallèle : work + statut favori en Phase 1
 * ★ UX/UI enrichi : animations fluides, hero immersif, pros, similaires
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, Modal,
  TouchableOpacity, Dimensions, Platform, Animated,
  Easing, Share, ActivityIndicator, Linking, TextInput,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import { getDeviceId }  from '@/services/api'; // ★ UUID device — zero auth

const { width: W, height: H } = Dimensions.get('window');

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#020810', navyMid:'#0D2240', navyLight:'#163356', navyBright:'#1E4A7A',
  surf:'rgba(13,34,64,0.60)', border:'rgba(255,255,255,0.07)',
  borderBlue:'rgba(90,150,230,0.22)', borderHi:'rgba(255,255,255,0.22)',
  white:'#FFFFFF', text:'#EEF4FF', textSec:'#7A99BE', textTert:'#2E4A68',
  blue:'#5A96E6', gold:'#F5C842', goldDim:'rgba(245,200,66,0.12)',
  red:'#FF3B5C', green:'#2ECC8A', faint:'rgba(255,255,255,0.07)',
  muted:'rgba(255,255,255,0.36)', mid:'rgba(255,255,255,0.55)',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null;
  director:string|null; cast_list:string[]|null; created_at:string;
  video_url:string|null;
}
interface Pro {
  id:string; name:string; role:string; avatar:string|null; bio:string|null;
  films:string[]; location:string|null; contact_email:string|null;
  website:string|null; verified:boolean; open_to:string[];
}
type ConnStatus = 'none'|'pending'|'accepted'|'rejected';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveImage(raw:string|null|undefined, id:number): string {
  if (!raw) return `https://picsum.photos/seed/work_${id}/800/600`;
  if (raw.startsWith('http')) return raw;
  const { data } = supabase.storage.from('community-images').getPublicUrl(raw);
  return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/800/600`;
}
const fmtLikes = (n:number) => n>=1_000_000?`${(n/1_000_000).toFixed(1)} M`:n>=1_000?`${(n/1_000).toFixed(1)} k`:`${n}`;
const fmtDur   = (m:number) => m>=60?`${Math.floor(m/60)}h${m%60>0?` ${m%60}min`:''}`:`${m} min`;

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchWork(id:string|number): Promise<Work|null> {
  const { data } = await supabase.from('works').select('*').eq('id', id).maybeSingle();
  return data as Work|null;
}
async function fetchSimilarWorks(work:Work): Promise<Work[]> {
  const { data } = await supabase.from('works').select('id,title,image,likes,genre,category,is_original,duration').neq('id',work.id).eq('genre',work.genre).order('likes',{ascending:false}).limit(12);
  return (data ?? []) as Work[];
}
async function fetchProfessionals(workTitle:string): Promise<Pro[]> {
  const { data:direct } = await supabase.from('professionals').select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to').contains('films',[workTitle]).order('verified',{ascending:false}).limit(8);
  if (direct?.length) return direct as Pro[];
  const { data:fb } = await supabase.from('professionals').select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to').order('verified',{ascending:false}).order('created_at',{ascending:false}).limit(6);
  return (fb ?? []) as Pro[];
}
// 14 films du domaine public (~25 min) — fallback si video_url absent dans public.works
const WORKS_VIDEO_FALLBACKS = [
  'https://archive.org/download/CharlieChaplainsTheCure1917/TheCure_512kb.mp4',
  'https://archive.org/download/TheRink_201602/TheRink_512kb.mp4',
  'https://archive.org/download/EasyStreet1917/EasyStreet_512kb.mp4',
  'https://archive.org/download/CharlieChaplainsThePawnshop/ThePawnshop_512kb.mp4',
  'https://archive.org/download/charlieChaplinsTheImmigrant/TheImmigrant_512kb.mp4',
  'https://archive.org/download/OneWeek/OneWeek_512kb.mp4',
  'https://archive.org/download/convict13/convict13_512kb.mp4',
  'https://archive.org/download/NeighborsBusterKeaton/NeighborsBusterKeaton_512kb.mp4',
  'https://archive.org/download/TheBoatKeaton/TheBoatKeaton_512kb.mp4',
  'https://archive.org/download/CopsKeaton1922/CopsKeaton1922_512kb.mp4',
  'https://archive.org/download/ThePalefaceBusterKeaton/ThePaleface_512kb.mp4',
  'https://archive.org/download/ATrip_to_the_Moon_1902/Trip_to_the_Moon_512kb.mp4',
  'https://archive.org/download/TheNavigatorKeaton/TheNavigatorKeaton_512kb.mp4',
  'https://archive.org/download/ShoulderArms1918/ShoulderArms_512kb.mp4',
] as const;

// Résout un video_url stocké en base :
//   - URL complète (http/https) → retournée telle quelle
//   - Chemin relatif Supabase Storage → converti en URL publique (bucket works-videos)
//   - null / vide → fallback archive.org round-robin sur l'id du work
function resolveVideoUrl(raw: string | null | undefined, work: Work): string {
  if (!raw) return WORKS_VIDEO_FALLBACKS[(work.id - 1) % WORKS_VIDEO_FALLBACKS.length];
  if (raw.startsWith('http')) return raw;
  try {
    // Les uploads utilisateurs vont dans community-images (même bucket que les reels)
    const { data } = supabase.storage.from('community-images').getPublicUrl(raw);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return WORKS_VIDEO_FALLBACKS[(work.id - 1) % WORKS_VIDEO_FALLBACKS.length];
}

function grantXP(userId: string, amount: number, reason: string) {
  if (!userId) return;
  supabase.rpc('add_xp', { p_user_id: userId, p_xp: amount, p_reason: reason }).then(() => {}, () => {});
}

function getWorkVideoUrl(work: Work): string {
  return resolveVideoUrl(work.video_url, work);
}
async function fetchConnStatus(userId:string, proId:string): Promise<{status:ConnStatus;connId?:string}> {
  const { data } = await supabase.from('pro_connections').select('id,status').eq('requester_id',userId).eq('pro_id',proId).maybeSingle();
  if (!data) return { status:'none' };
  return { status:data.status as ConnStatus, connId:data.id };
}

// ─── Video player ─────────────────────────────────────────────────────────────
let _useVideoPlayer: any = () => ({ play(){}, pause(){}, muted:false });
let _VideoView: any = () => null;
if (Platform.OS !== 'web') {
  try { const ev=require('expo-video'); _useVideoPlayer=ev.useVideoPlayer; _VideoView=ev.VideoView; } catch {}
}

const VideoModal = memo(function VideoModal({ visible, videoUrl, title, onClose }: { visible:boolean; videoUrl:string|null; title:string; onClose:()=>void }) {
  const isWeb = Platform.OS === 'web';
  const [buffering, setBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const player = _useVideoPlayer(visible&&videoUrl?videoUrl:null, (p:any) => { if (!p) return; p.loop=false; p.muted=false; });

  useEffect(() => {
    if (!visible) { setVideoError(false); setBuffering(false); return; }
    setVideoError(false);
    if (!player || isWeb) return;
    if (visible && videoUrl) {
      setBuffering(true);
      try { player.play(); } catch {}
      let cleanup: () => void = () => {};
      try {
        const sub = player.addListener('statusChange', ({ status }: any) => {
          if (status === 'readyToPlay') setBuffering(false);
          else if (status === 'error') { setBuffering(false); setVideoError(true); }
        });
        cleanup = () => { try { sub?.remove?.(); } catch {} };
      } catch {
        // Fallback timer : 30 s pour les vidéos de 25 min
        const t = setTimeout(() => setBuffering(false), 30000);
        cleanup = () => clearTimeout(t);
      }
      return cleanup;
    } else {
      setBuffering(false);
      try { player.pause(); } catch {}
    }
  }, [visible, videoUrl, player, isWeb]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'#000' }}>
        <StatusBar style="light"/>
        {isWeb && !!videoUrl && React.createElement('video', { src:videoUrl, autoPlay:true, controls:true, playsInline:true, style:{ width:'100%', height:'100%', objectFit:'contain', background:'#000' } })}
        {!isWeb && !!videoUrl && !videoError && <_VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="contain" nativeControls/>}
        {/* Overlay chargement */}
        {(!videoUrl || buffering) && !videoError && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems:'center', justifyContent:'center', gap:16, backgroundColor:videoUrl?'rgba(0,0,0,0.65)':'#000' }]}>
            <ActivityIndicator color="#fff" size="large"/>
            <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:14 }}>
              {videoUrl ? 'Mise en mémoire tampon…' : 'Chargement…'}
            </Text>
          </View>
        )}
        {/* Overlay erreur vidéo */}
        {videoError && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems:'center', justifyContent:'center', gap:20, backgroundColor:'#000' }]}>
            <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.4)"/>
            <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:16, fontWeight:'700' }}>Vidéo indisponible</Text>
            <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:13, textAlign:'center', paddingHorizontal:32 }}>La source vidéo est inaccessible pour le moment.</Text>
            <TouchableOpacity onPress={onClose} style={{ marginTop:8, paddingHorizontal:24, paddingVertical:12, borderRadius:22, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' }}>
              <Text style={{ color:'#fff', fontSize:14, fontWeight:'600' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={{ position:'absolute', top:Platform.OS==='ios'?54:20, right:16, zIndex:10 }} onPress={onClose} hitSlop={12}>
          <BlurView intensity={40} tint="dark" style={{ width:42, height:42, borderRadius:21, overflow:'hidden', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' }}>
            <Ionicons name="close" size={22} color="#fff"/>
          </BlurView>
        </TouchableOpacity>
        <View style={{ position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:20, paddingBottom:Platform.OS==='ios'?44:20, paddingTop:16, backgroundColor:'rgba(0,0,0,0.6)' }} pointerEvents="none">
          <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }} numberOfLines={1}>{title}</Text>
        </View>
      </View>
    </Modal>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = memo(function Skeleton() {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => { const l = Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.52,duration:950,useNativeDriver:true}),Animated.timing(op,{toValue:0.22,duration:950,useNativeDriver:true})])); l.start(); return () => l.stop(); }, [op]);
  const B = ({ w, h, r=8 }:{ w:number|`${number}%`; h:number; r?:number }) => <Animated.View style={{ width:w as any, height:h, borderRadius:r, backgroundColor:C.navyLight, opacity:op, marginBottom:12 }}/>;
  return (
    <View style={{ flex:1 }}>
      <View style={{ height:H*0.46, backgroundColor:C.navyMid }}/>
      <View style={{ paddingHorizontal:20, paddingTop:24 }}>
        <B w={90} h={11}/><B w="72%" h={30}/><B w="48%" h={16}/>
        <View style={{ height:10 }}/>
        <View style={{ flexDirection:'row', gap:8 }}>{[80,80,80].map((w,i) => <B key={i} w={w} h={40} r={12}/>)}</View>
        <View style={{ height:8 }}/><B w="100%" h={54} r={16}/>
        <B w="100%" h={14}/><B w="88%" h={14}/><B w="64%" h={14}/>
      </View>
    </View>
  );
});

// ─── Similar Card ─────────────────────────────────────────────────────────────
const SimilarCard = memo(({ item, onPress }:{ item:Work; onPress:()=>void }) => {
  const uri = resolveImage(item.image, item.id);
  return (
    <TouchableOpacity style={sc.wrap} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri }} style={sc.img} resizeMode="cover"/>
      <LinearGradient colors={['transparent','rgba(2,8,16,0.88)']} style={StyleSheet.absoluteFillObject}/>
      {item.is_original && <View style={sc.badge}><Text style={sc.badgeTxt}>ORIGINAL</Text></View>}
      <View style={sc.info}>
        <Text style={sc.title} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="heart" size={9} color={C.gold}/>
          <Text style={sc.likes}>{fmtLikes(item.likes)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const sc = StyleSheet.create({ wrap:{ width:120, height:178, borderRadius:14, overflow:'hidden', marginRight:12, backgroundColor:C.surf }, img:{ width:'100%', height:'100%' }, badge:{ position:'absolute', top:7, left:7, backgroundColor:C.blue, paddingHorizontal:6, paddingVertical:2.5, borderRadius:5 }, badgeTxt:{ color:C.white, fontSize:8, fontWeight:'800', letterSpacing:0.5 }, info:{ position:'absolute', bottom:9, left:9, right:9, gap:3 }, title:{ color:C.white, fontSize:12, fontWeight:'700', lineHeight:15 }, likes:{ color:'rgba(255,255,255,0.55)', fontSize:10 } });

// ─── Pro Mini Card ────────────────────────────────────────────────────────────
const ProMiniCard = memo(function ProMiniCard({ pro, status, onPress }:{ pro:Pro; status:ConnStatus; onPress:()=>void }) {
  const avatarUri = pro.avatar ?? `https://i.pravatar.cc/80?u=${pro.id}`;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={pm.wrap}>
      <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={pm.row}>
        <View style={{ position:'relative' }}>
          <Image source={{ uri:avatarUri }} style={pm.avatar} resizeMode="cover"/>
          {pro.verified && <View style={pm.vBadge}><Ionicons name="checkmark" size={8} color={C.white}/></View>}
        </View>
        <View style={{ flex:1, gap:2 }}>
          <Text style={pm.name} numberOfLines={1}>{pro.name}</Text>
          <Text style={pm.role}>{pro.role}</Text>
          {pro.location && <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}><Ionicons name="location-outline" size={9} color={C.textTert}/><Text style={pm.loc}>{pro.location}</Text></View>}
        </View>
        <View style={[pm.statusBadge, status==='accepted'&&pm.statusAccepted]}>
          <Ionicons name={status==='accepted'?'checkmark-circle':status==='pending'?'time-outline':'person-add-outline'} size={12} color={status==='accepted'?C.green:status==='pending'?C.gold:C.textSec}/>
          <Text style={[pm.statusTxt, status==='accepted'&&{color:C.green}, status==='pending'&&{color:C.gold}]}>{status==='accepted'?'Connecté':status==='pending'?'En attente':'Contacter'}</Text>
        </View>
      </View>
      {status==='accepted' && (pro.contact_email||pro.website) && (
        <View style={pm.contactRow}>
          {pro.contact_email && <TouchableOpacity style={pm.contactBtn} onPress={() => Linking.openURL(`mailto:${pro.contact_email}`).catch(()=>{})} activeOpacity={0.85}><Ionicons name="mail-outline" size={12} color={C.blue}/><Text style={pm.contactTxt}>{pro.contact_email}</Text></TouchableOpacity>}
          {pro.website && <TouchableOpacity style={pm.contactBtn} onPress={() => Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.85}><Ionicons name="globe-outline" size={12} color={C.blue}/><Text style={pm.contactTxt}>Portfolio</Text></TouchableOpacity>}
        </View>
      )}
      {pro.open_to.length > 0 && <View style={{ flexDirection:'row', flexWrap:'wrap', gap:5, marginTop:6 }}>{pro.open_to.slice(0,3).map(o => <View key={o} style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:8, backgroundColor:'rgba(90,150,230,0.10)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(90,150,230,0.22)' }}><Text style={{ color:C.blue, fontSize:9, fontWeight:'600' }}>{o}</Text></View>)}</View>}
    </TouchableOpacity>
  );
});
const pm = StyleSheet.create({ wrap:{ marginBottom:10, borderRadius:16, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBlue }, row:{ flexDirection:'row', alignItems:'center', gap:12, padding:14 }, avatar:{ width:46, height:46, borderRadius:23, borderWidth:1.5, borderColor:C.borderBlue }, vBadge:{ position:'absolute', bottom:-2, right:-2, width:16, height:16, borderRadius:8, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.blue, alignItems:'center', justifyContent:'center' }, name:{ color:C.white, fontSize:14, fontWeight:'800', letterSpacing:-0.2 }, role:{ color:C.textSec, fontSize:11 }, loc:{ color:C.textTert, fontSize:10 }, statusBadge:{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:6, borderRadius:12, backgroundColor:C.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }, statusAccepted:{ borderColor:'rgba(46,204,138,0.30)', backgroundColor:'rgba(46,204,138,0.08)' }, statusTxt:{ color:C.textSec, fontSize:11, fontWeight:'700' }, contactRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, paddingHorizontal:14, paddingBottom:12 }, contactBtn:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:6, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBlue, backgroundColor:'rgba(90,150,230,0.08)' }, contactTxt:{ color:C.blue, fontSize:11, fontWeight:'600' } });

// ─── Connection Modal ─────────────────────────────────────────────────────────
const ProConnectionModal = memo(function ProConnectionModal({ pro, status, connId, userId, onClose, onSent }:{ pro:Pro|null; status:ConnStatus; connId?:string; userId:string; onClose:()=>void; onSent:(proId:string,newStatus:ConnStatus)=>void }) {
  const [note, setNote]     = useState('');
  const [sending, setSending] = useState(false);
  const [phase, setPhase]   = useState<'form'|'success'|'contacts'>('form');
  const slide = useRef(new Animated.Value(H)).current;
  const succSc = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pro) { setNote(''); setSending(false); setPhase(status==='accepted'?'contacts':'form'); Animated.spring(slide,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start(); }
    else { Animated.timing(slide,{toValue:H,duration:220,useNativeDriver:true}).start(); }
  }, [pro, status]);

  const handleSend = useCallback(async () => {
    if (!pro || note.trim().length < 20 || sending) return;
    setSending(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { data:existing } = await supabase.from('pro_connections').select('id').eq('requester_id',userId).eq('pro_id',pro.id).maybeSingle();
      if (existing) {
        await supabase.from('pro_connections').update({ status:'pending', message:note.trim(), updated_at:new Date().toISOString() }).eq('id',existing.id);
      } else {
        await supabase.from('pro_connections').insert({ requester_id:userId, pro_id:pro.id, status:'pending', message:note.trim() });
      }
      await supabase.from('notifications').insert({ user_id:pro.id, actor_id:userId, type:'connection_request', title:'Nouvelle demande de connexion', body:note.trim().slice(0,120), data:JSON.stringify({ requester_id:userId, pro_id:pro.id }) }).then(()=>{}, ()=>{});
      setSending(false); setPhase('success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.spring(succSc, { toValue:1, tension:80, friction:8, useNativeDriver:true }).start();
      onSent(pro.id, 'pending');
      setTimeout(onClose, 2600);
    } catch { setSending(false); }
  }, [pro, note, userId, sending, onSent, onClose]);

  if (!pro) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground/>
      <View style={{ flex:1, justifyContent:'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{ flex:1, justifyContent:'flex-end' }}>
          <Animated.View style={{ maxHeight:'92%', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBlue, transform:[{ translateY:slide }] }}>
            <BlurView intensity={Platform.OS==='ios'?90:70} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={{ width:38, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:'center', marginTop:14 }}/>
            <View style={{ flexDirection:'row', alignItems:'flex-start', gap:14, padding:20, paddingTop:16 }}>
              <Image source={{ uri:pro.avatar??`https://i.pravatar.cc/100?u=${pro.id}` }} style={{ width:56, height:56, borderRadius:28, borderWidth:2, borderColor:C.borderBlue }} resizeMode="cover"/>
              <View style={{ flex:1, gap:3 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Text style={{ color:C.white, fontSize:16, fontWeight:'900', flex:1 }} numberOfLines={1}>{pro.name}</Text>
                  {pro.verified && <View style={{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:2, borderRadius:8, backgroundColor:'rgba(90,150,230,0.15)', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBlue }}><Ionicons name="checkmark-circle" size={9} color={C.blue}/><Text style={{ color:C.blue, fontSize:9, fontWeight:'800' }}>VÉRIFIÉ</Text></View>}
                </View>
                <Text style={{ color:C.textSec, fontSize:12 }}>{pro.role}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ width:30, height:30, borderRadius:15, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' }} hitSlop={10}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
            </View>
            {phase === 'contacts' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:20, gap:14, paddingBottom:40 }}>
                <View style={{ alignItems:'center', gap:10, paddingBottom:16 }}>
                  <View style={{ width:52, height:52, borderRadius:26, backgroundColor:'rgba(46,204,138,0.12)', borderWidth:1, borderColor:'rgba(46,204,138,0.30)', alignItems:'center', justifyContent:'center' }}><Ionicons name="checkmark-circle" size={28} color={C.green}/></View>
                  <Text style={{ color:C.white, fontSize:18, fontWeight:'900' }}>Vous êtes connectés</Text>
                </View>
                {pro.contact_email && <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:12, padding:16, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(90,150,230,0.30)', backgroundColor:'rgba(90,150,230,0.08)' }} onPress={() => Linking.openURL(`mailto:${pro.contact_email}`).catch(()=>{})} activeOpacity={0.85}><Ionicons name="mail-outline" size={18} color={C.blue}/><Text style={{ color:C.white, fontSize:14, fontWeight:'700' }}>{pro.contact_email}</Text><Ionicons name="open-outline" size={14} color={C.blue} style={{ marginLeft:'auto' as any }}/></TouchableOpacity>}
                {pro.website && <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:12, padding:16, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBlue, backgroundColor:C.surf }} onPress={() => Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.85}><Ionicons name="globe-outline" size={18} color={C.blue}/><Text style={{ color:C.white, fontSize:13, fontWeight:'700' }}>{pro.website}</Text><Ionicons name="open-outline" size={14} color={C.blue} style={{ marginLeft:'auto' as any }}/></TouchableOpacity>}
                <TouchableOpacity onPress={onClose} style={{ alignSelf:'center', paddingVertical:12 }}><Text style={{ color:C.muted, fontSize:13 }}>Fermer</Text></TouchableOpacity>
              </ScrollView>
            )}
            {phase === 'success' && (
              <View style={{ alignItems:'center', padding:40, gap:14 }}>
                <Animated.View style={{ width:76, height:76, borderRadius:38, borderWidth:1, borderColor:C.borderBlue, backgroundColor:'rgba(90,150,230,0.12)', alignItems:'center', justifyContent:'center', transform:[{ scale:succSc }] }}><Ionicons name="checkmark" size={34} color={C.blue}/></Animated.View>
                <Text style={{ color:C.white, fontSize:20, fontWeight:'900' }}>Demande envoyée</Text>
                <Text style={{ color:C.textSec, fontSize:13, textAlign:'center', lineHeight:20 }}>Ses coordonnées seront partagées à l'acceptation.</Text>
              </View>
            )}
            {phase === 'form' && (
              <>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {status === 'pending' && <View style={{ flexDirection:'row', alignItems:'flex-start', gap:12, marginHorizontal:20, marginBottom:16, padding:14, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBlue, backgroundColor:'rgba(90,150,230,0.06)' }}><Ionicons name="time-outline" size={18} color={C.gold}/><Text style={{ color:C.text, fontSize:12, lineHeight:18, flex:1 }}>Invitation envoyée, en attente de réponse.</Text></View>}
                  {pro.bio && <Text style={{ color:C.textSec, fontSize:13, lineHeight:19, paddingHorizontal:20, marginBottom:16 }}>{pro.bio}</Text>}
                  {status !== 'pending' && (
                    <View style={{ paddingHorizontal:20 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}><Text style={{ color:C.white, fontSize:13, fontWeight:'700', flex:1 }}>Message</Text><Text style={{ color:C.textTert, fontSize:10 }}>20 car. min</Text></View>
                      <TextInput style={{ color:C.white, fontSize:14, minHeight:110, lineHeight:22, paddingVertical:4, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:note.trim().length>=20?C.borderBlue:C.border }} value={note} onChangeText={setNote} multiline maxLength={300} placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous ai découvert sur Universe…`} placeholderTextColor="rgba(255,255,255,0.16)" selectionColor={C.blue} textAlignVertical="top"/>
                      <Text style={{ color:note.trim().length>=20?C.blue:C.textTert, fontSize:10, fontWeight:'700', textAlign:'right', marginTop:6 }}>{note.trim().length}/300</Text>
                    </View>
                  )}
                  <View style={{ height:100 }}/>
                </ScrollView>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:20, paddingBottom:Platform.OS==='ios'?36:20, paddingTop:14, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border }}>
                  <TouchableOpacity style={{ paddingHorizontal:18, paddingVertical:13, borderRadius:15, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint }} onPress={onClose} activeOpacity={0.80}><Text style={{ color:C.muted, fontSize:14, fontWeight:'600' }}>Annuler</Text></TouchableOpacity>
                  {status === 'pending'
                    ? <TouchableOpacity style={{ flex:1, alignItems:'center', justifyContent:'center', paddingVertical:13, borderRadius:15, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.surf }} onPress={onClose} activeOpacity={0.85}><Text style={{ color:C.white, fontSize:14, fontWeight:'700' }}>Fermer</Text></TouchableOpacity>
                    : <TouchableOpacity style={{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, borderRadius:15, borderWidth:StyleSheet.hairlineWidth, borderColor:note.trim().length>=20?C.borderBlue:C.border, backgroundColor:note.trim().length>=20?'rgba(90,150,230,0.12)':C.faint, opacity:sending||note.trim().length<20?0.45:1 }} onPress={handleSend} disabled={note.trim().length<20||sending} activeOpacity={0.88}>
                        {sending?<ActivityIndicator color={C.blue} size="small"/>:<><Ionicons name="person-add-outline" size={14} color={C.blue}/><Text style={{ color:C.blue, fontSize:14, fontWeight:'800' }}>Se connecter</Text></>}
                      </TouchableOpacity>
                  }
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

// ─── UI atoms ─────────────────────────────────────────────────────────────────
const SectionTitle = memo(({ children }:{ children:string }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:14 }}>
    <View style={{ width:3, height:18, borderRadius:2, backgroundColor:C.blue }}/>
    <Text style={{ color:C.white, fontSize:16, fontWeight:'800', letterSpacing:-0.2 }}>{children}</Text>
  </View>
));
const InfoRow = memo(({ label, value }:{ label:string; value:string }) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:14, paddingVertical:11, borderBottomWidth:0.5, borderBottomColor:C.border }}>
    <Text style={{ color:C.textSec, fontSize:12, fontWeight:'600' }}>{label}</Text>
    <Text style={{ color:C.text, fontSize:12, fontWeight:'700', maxWidth:'60%' }} numberOfLines={1}>{value}</Text>
  </View>
));
const StatPill = memo(({ icon, value, label, color }:{ icon:string; value:string; label?:string; color?:string }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:9 }}>
    <Ionicons name={icon as any} size={16} color={color??C.textSec}/>
    <View>
      <Text style={{ color:color??C.text, fontSize:13, fontWeight:'700' }}>{value}</Text>
      {label && <Text style={{ color:C.textTert, fontSize:10, fontWeight:'600', marginTop:1 }}>{label}</Text>}
    </View>
  </View>
));

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function FilmDetailScreen() {
  const router   = useRouter();
  const { id }   = useLocalSearchParams<{ id:string }>();
  const rawId    = Array.isArray(id) ? id[0] : id ?? '';

  const [work,          setWork]          = useState<Work|null>(null);
  const [similar,       setSimilar]       = useState<Work[]>([]);
  const [professionals, setPros]          = useState<Pro[]>([]);
  const [proStatuses,   setProStatuses]   = useState<Record<string,{ status:ConnStatus; connId?:string }>>({});
  const [selectedPro,   setSelectedPro]   = useState<Pro|null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [liked,         setLiked]         = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [expanded,      setExpanded]      = useState(false);
  const [localLikes,    setLocalLikes]    = useState(0);
  const [userId,        setUserId]        = useState('');
  const [videoOpen,     setVideoOpen]     = useState(false);
  const [videoUrl,      setVideoUrl]      = useState<string|null>(null);
  const [videoLoading,  setVideoLoading]  = useState(false);
  const [creatorReelVideoUrl, setCreatorReelVideoUrl] = useState<string|null>(null);

  const heartSc = useRef(new Animated.Value(1)).current;
  const reveal  = useRef(new Animated.Value(0)).current;

  // ── ★ Init userId — UUID device (zéro supabase.auth.*) ──────────────────
  useEffect(() => { getDeviceId().then(setUserId); }, []);

  // Reveal anim
  useEffect(() => {
    if (!loading && !error && work)
      Animated.timing(reveal, { toValue:1, duration:420, easing:Easing.out(Easing.cubic), useNativeDriver:true }).start();
  }, [loading, error, work, reveal]);

  // ── ★ Fetch parallèle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!rawId) { setError(true); setLoading(false); return; }
    let dead = false;
    setLoading(true); setError(false);

    async function loadAll() {
      try {
        const uid = userId || await getDeviceId();

        // Phase 1 : work + favori en parallèle
        const [workData, favData] = await Promise.all([
          fetchWork(rawId),
          supabase.from('user_favorites').select('id').eq('user_id', uid).eq('work_id', Number(rawId)).maybeSingle(),
        ]);
        if (dead) return;
        if (!workData) { setError(true); setLoading(false); return; }

        setWork(workData);
        setLocalLikes(workData.likes);
        if ((favData as any)?.data) setSaved(true);
        setLoading(false);

        // Phase 2 : similar + pros + reel creator video en parallèle
        // Cherche toujours le reel de l'utilisateur courant pour ce work
        const reelQuery = supabase.from('reels')
          .select('video_url')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => data?.video_url ?? null, () => null);

        const [simItems, proItems, rawReelVid] = await Promise.all([
          fetchSimilarWorks(workData),
          fetchProfessionals(workData.title),
          reelQuery,
        ]);
        if (dead) return;
        setSimilar(simItems);
        setPros(proItems);

        if (rawReelVid) {
          const reelUrl = rawReelVid.startsWith('http')
            ? rawReelVid
            : supabase.storage.from('community-images').getPublicUrl(rawReelVid).data?.publicUrl ?? '';
          if (reelUrl && !dead) setCreatorReelVideoUrl(reelUrl);
        }

        // Statuts connexion
        if (uid && proItems.length) {
          const statuses = await Promise.all(proItems.map(p => fetchConnStatus(uid, p.id).then(r => ({ id:p.id, ...r }))));
          if (!dead) {
            const map: Record<string,{ status:ConnStatus; connId?:string }> = {};
            statuses.forEach(s => { map[s.id] = { status:s.status, connId:s.connId }; });
            setProStatuses(map);
          }
        }
      } catch {
        if (!dead) { setError(true); setLoading(false); }
      }
    }
    loadAll();
    return () => { dead = true; };
  }, [rawId, userId]);

  // Reset sur changement d'id
  useEffect(() => { setLiked(false); setExpanded(false); setSaved(false); setVideoUrl(null); setCreatorReelVideoUrl(null); }, [rawId]);

  // ── ★ handleSave — écrit dans user_favorites ────────────────────────────
  const handleSave = useCallback(async () => {
    const next = !saved;
    setSaved(next);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const uid = userId || await getDeviceId();
      if (!uid || !rawId) return;
      if (next) {
        const { error } = await supabase.from('user_favorites')
          .upsert({ user_id:uid, work_id:Number(rawId) }, { onConflict:'user_id,work_id' });
        if (error) console.warn('[film] save error:', error.message);
        grantXP(uid, 15, 'save_work');
      } else {
        await supabase.from('user_favorites').delete().eq('user_id', uid).eq('work_id', Number(rawId));
      }
    } catch (e) { console.warn('[film] save error', e); }
  }, [saved, userId, rawId]);

  // ── ★ handleWatch — écrit dans user_history ─────────────────────────────
  const handleWatch = useCallback(async () => {
    setVideoOpen(true);
    if (!videoUrl && work) {
      setVideoLoading(true);
      const workVid = getWorkVideoUrl(work);
      // Remplace le fallback archive.org par le vrai reel de l'utilisateur
      const finalVid = (workVid.includes('archive.org') && creatorReelVideoUrl)
        ? creatorReelVideoUrl
        : (creatorReelVideoUrl || workVid);
      setVideoUrl(finalVid);
      setVideoLoading(false);
    }
    try {
      const uid = userId || await getDeviceId();
      if (uid && rawId) {
        const { error } = await supabase.from('user_history')
          .upsert({ user_id:uid, work_id:Number(rawId), watched_at:new Date().toISOString() },
                  { onConflict:'user_id,work_id' });
        if (error) console.warn('[film] history error:', error.message);
        grantXP(uid, 25, 'watch_work');
      }
    } catch (e) { console.warn('[film] history error', e); }
  }, [videoUrl, creatorReelVideoUrl, work, userId, rawId]);

  // Like
  const handleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    setLocalLikes(prev => prev + (next ? 1 : -1));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.sequence([
      Animated.spring(heartSc, { toValue:1.42, useNativeDriver:true, tension:300, friction:7 }),
      Animated.spring(heartSc, { toValue:1, useNativeDriver:true, tension:200, friction:8 }),
    ]).start();
    supabase.from('works').update({ likes:localLikes+(next?1:-1) }).eq('id', rawId).then(() => {});
    if (next) grantXP(userId, 10, 'like_work');
  }, [liked, heartSc, localLikes, rawId, userId]);

  const handleShare = useCallback(() => {
    if (!work) return;
    Share.share({ message:`${work.title} — ${work.description??work.genre}`, title:work.title });
  }, [work]);

  const handleProSent = useCallback((proId:string, newStatus:ConnStatus) => {
    setProStatuses(prev => ({ ...prev, [proId]:{ ...prev[proId], status:newStatus } }));
    setSelectedPro(null);
  }, []);

  const descShort = useMemo(() => {
    if (!work?.description) return '';
    return work.description.length > 220 ? work.description.slice(0,220).trimEnd()+'…' : work.description;
  }, [work?.description]);

  const infoRows = useMemo(() => {
    if (!work) return [];
    return [
      { label:'Catégorie', value:work.category },
      { label:'Genre', value:work.genre },
      { label:'Année', value:String(work.year) },
      work.duration && { label:'Durée', value:fmtDur(work.duration) },
      work.director && { label:'Réalisateur', value:work.director },
      work.comments!=null && { label:'Commentaires', value:String(work.comments) },
    ].filter(Boolean) as { label:string; value:string }[];
  }, [work]);

  const bodyAnim = useMemo(() => ({ opacity:reveal, transform:[{ translateY:reveal.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }] }), [reveal]);
  const selectedStatus = selectedPro ? proStatuses[selectedPro.id] : { status:'none' as ConnStatus };

  if (loading) return <View style={s.root}><StatusBar style="light"/><GalaxyBackground/><Skeleton/></View>;
  if (error || !work) return (
    <View style={[s.root, s.center]}><StatusBar style="light"/><GalaxyBackground/>
      <View style={s.errIcon}><Ionicons name="film-outline" size={32} color={C.textTert}/></View>
      <Text style={s.errTitle}>Œuvre introuvable</Text>
      <Text style={s.errSub}>Cette œuvre n'existe pas dans le catalogue.</Text>
      <TouchableOpacity style={s.errBtn} onPress={() => router.back()}><Ionicons name="chevron-back" size={15} color={C.white}/><Text style={s.errBtnTxt}>Retour</Text></TouchableOpacity>
    </View>
  );

  const heroUri = resolveImage(work.image, work.id);

  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <VideoModal visible={videoOpen} videoUrl={videoUrl} title={work.title} onClose={() => { setVideoOpen(false); setVideoUrl(null); }}/>
      <ProConnectionModal pro={selectedPro} status={selectedStatus.status} connId={selectedStatus.connId} userId={userId} onClose={() => setSelectedPro(null)} onSent={handleProSent}/>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* HERO */}
        <View style={s.heroWrap}>
          <Image source={{ uri:heroUri }} style={s.heroImg} resizeMode="cover"/>
          <LinearGradient colors={['rgba(2,8,16,0.55)','transparent']} locations={[0,0.32]} style={StyleSheet.absoluteFillObject} pointerEvents="none"/>
          <LinearGradient colors={['transparent','rgba(2,8,16,0.42)',C.bg]} locations={[0.38,0.72,1]} style={StyleSheet.absoluteFillObject} pointerEvents="none"/>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={s.blurCircle}><Ionicons name="chevron-back" size={21} color={C.white}/></BlurView>
          </TouchableOpacity>
          <View style={s.topRight}>
            <TouchableOpacity style={s.blurCircle} onPress={handleSave}>
              <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name={saved?'bookmark':'bookmark-outline'} size={18} color={C.white}/>
            </TouchableOpacity>
            <TouchableOpacity style={s.blurCircle} onPress={handleShare} hitSlop={8}>
              <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name="share-outline" size={18} color={C.white}/>
            </TouchableOpacity>
          </View>
          {work.is_original && <View style={s.heroBadge}><Ionicons name="star" size={10} color={C.gold}/><Text style={s.heroBadgeTxt}>ORIGINAL</Text></View>}
        </View>

        {/* BODY */}
        <Animated.View style={[s.body, bodyAnim]}>
          <View style={s.catBadge}>
            <View style={[s.catDot, { backgroundColor:work.is_original?C.blue:C.textSec }]}/>
            <Text style={[s.catTxt, { color:work.is_original?C.blue:C.textSec }]}>{work.category.toUpperCase()}</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.genreLabel}>{work.genre.toUpperCase()}</Text>
            <Text style={s.title} numberOfLines={3}>{work.title}</Text>
            <Text style={s.adj}>{work.adjective||(work.director?`De ${work.director}`:'')} · {work.year}</Text>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <TouchableOpacity onPress={handleLike} activeOpacity={0.82}>
              <View style={[s.likePill, liked&&{ borderColor:'rgba(255,59,92,0.38)', backgroundColor:'rgba(255,59,92,0.10)' }]}>
                <Animated.View style={{ transform:[{ scale:heartSc }] }}><Ionicons name={liked?'heart':'heart-outline'} size={16} color={liked?C.red:C.textSec}/></Animated.View>
                <Text style={[s.likePillVal, liked&&{ color:C.red }]}>{fmtLikes(localLikes)}</Text>
              </View>
            </TouchableOpacity>
            {work.duration!=null && <StatPill icon="time-outline" value={fmtDur(work.duration)} label="Durée"/>}
            {work.year!=null && <StatPill icon="calendar-outline" value={String(work.year)} label="Année"/>}
          </View>

          {/* ★ Bouton Regarder — écrit dans user_history */}
          <TouchableOpacity style={s.watchBtn} onPress={handleWatch} activeOpacity={0.88}>
            <LinearGradient colors={[C.navyBright, C.navyMid]} start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={s.watchGrad}>
              <View style={s.watchIcon}><Ionicons name="play" size={18} color={C.white}/></View>
              <View>
                <Text style={s.watchTxt}>Regarder</Text>
                {work.duration!=null && <Text style={s.watchMeta}>{fmtDur(work.duration)} · HD</Text>}
              </View>
              {videoLoading && <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" style={{ marginLeft:'auto' as any }}/>}
            </LinearGradient>
          </TouchableOpacity>

          {/* Synopsis */}
          {!!work.description && (
            <View style={s.section}>
              <SectionTitle>Synopsis</SectionTitle>
              <Text style={s.synopsis}>{expanded ? work.description : descShort}</Text>
              {work.description.length > 220 && (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:8 }}>
                  <Text style={{ color:C.blue, fontSize:13, fontWeight:'700' }}>{expanded?'Réduire':'Lire la suite'}</Text>
                  <Ionicons name={expanded?'chevron-up':'chevron-down'} size={13} color={C.blue}/>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Réalisateur */}
          {!!work.director && (
            <View style={s.section}>
              <SectionTitle>Réalisateur·ice</SectionTitle>
              <View style={s.dirCard}>
                <Image source={{ uri:`https://i.pravatar.cc/120?u=${encodeURIComponent(work.director)}` }} style={s.dirAvatar}/>
                <View>
                  <Text style={s.dirName}>{work.director}</Text>
                  <Text style={s.dirMeta}>{work.genre} · {work.year}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Pros */}
          {professionals.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Avec & Industrie</SectionTitle>
              <Text style={{ color:C.textSec, fontSize:12, marginBottom:14, lineHeight:18 }}>Professionnels associés à cette œuvre.</Text>
              {professionals.map(pro => (
                <ProMiniCard key={pro.id} pro={pro} status={proStatuses[pro.id]?.status??'none'} onPress={() => setSelectedPro(pro)}/>
              ))}
            </View>
          )}

          {/* Similaires */}
          {similar.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Dans le même genre</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similar.map(item => <SimilarCard key={item.id} item={item} onPress={() => router.replace(`/film/${item.id}` as any)}/>)}
              </ScrollView>
            </View>
          )}

          {/* Infos */}
          <View style={s.section}>
            <SectionTitle>Informations</SectionTitle>
            <View style={{ backgroundColor:C.surf, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:'hidden' }}>
              {infoRows.map(row => <InfoRow key={row.label} label={row.label} value={row.value}/>)}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex:1, backgroundColor:C.bg },
  center:   { justifyContent:'center', alignItems:'center' },
  scroll:   { paddingBottom:110 },
  heroWrap: { height:H*0.46, position:'relative' },
  heroImg:  { width:'100%', height:'100%' },
  backBtn:  { position:'absolute', top:Platform.OS==='ios'?56:22, left:16 },
  topRight: { position:'absolute', top:Platform.OS==='ios'?56:22, right:16, gap:10, alignItems:'flex-end' },
  blurCircle:{ width:40, height:40, borderRadius:20, overflow:'hidden', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  heroBadge:{ position:'absolute', bottom:18, left:18, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:C.goldDim, paddingHorizontal:10, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(245,200,66,0.28)' },
  heroBadgeTxt:{ color:C.gold, fontSize:9, fontWeight:'800', letterSpacing:1 },
  body:     { paddingHorizontal:20, paddingTop:22 },
  catBadge: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:9, paddingVertical:4, borderRadius:8, borderWidth:0.5, borderColor:'rgba(90,150,230,0.3)', backgroundColor:'rgba(0,0,0,0.35)', alignSelf:'flex-start', marginBottom:14 },
  catDot:   { width:5, height:5, borderRadius:3 },
  catTxt:   { fontSize:9, fontWeight:'800', letterSpacing:0.6 },
  titleBlock:{ marginBottom:20 },
  genreLabel:{ color:C.blue, fontSize:10, fontWeight:'800', letterSpacing:1.5, marginBottom:7 },
  title:    { color:C.white, fontSize:27, fontWeight:'800', letterSpacing:-0.6, lineHeight:33, marginBottom:7 },
  adj:      { color:C.textSec, fontSize:14, fontStyle:'italic' },
  statsRow: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 },
  likePill: { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:9 },
  likePillVal:{ color:C.text, fontSize:13, fontWeight:'700' },
  watchBtn: { borderRadius:16, overflow:'hidden', marginBottom:26, borderWidth:1, borderColor:C.borderBlue },
  watchGrad:{ flexDirection:'row', alignItems:'center', gap:14, paddingVertical:15, paddingHorizontal:20 },
  watchIcon:{ width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.12)', justifyContent:'center', alignItems:'center' },
  watchTxt: { color:'white', fontSize:16, fontWeight:'800', letterSpacing:-0.2 },
  watchMeta:{ color:'rgba(255,255,255,0.6)', fontSize:11, marginTop:2 },
  section:  { marginBottom:28 },
  synopsis: { color:C.textSec, fontSize:14, lineHeight:23 },
  dirCard:  { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, padding:14, borderRadius:16 },
  dirAvatar:{ width:50, height:50, borderRadius:25, borderWidth:2, borderColor:C.navyLight },
  dirName:  { color:C.text, fontSize:15, fontWeight:'700' },
  dirMeta:  { color:C.textSec, fontSize:12, marginTop:2 },
  errIcon:  { width:72, height:72, borderRadius:36, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, justifyContent:'center', alignItems:'center', marginBottom:16 },
  errTitle: { color:C.textSec, fontSize:18, fontWeight:'700', marginBottom:8 },
  errSub:   { color:C.textTert, fontSize:13, textAlign:'center', paddingHorizontal:40, lineHeight:20, marginBottom:24 },
  errBtn:   { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:22, paddingVertical:12, borderRadius:14, backgroundColor:C.navyLight, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  errBtnTxt:{ color:C.white, fontWeight:'700', fontSize:14 },
});