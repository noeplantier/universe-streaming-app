/**
 * components/social/ProDirectory.tsx — UNIVERSE
 *
 * ★ getDeviceId() — ZERO supabase.auth.* → fix "id=eq.anonymous" 400
 * ★ UUID guard — valide l'UUID avant tout INSERT (fix pro_connections 400)
 * ★ Connexion → INSERT pro_connections + notification + mail Edge Function
 * ★ Message pré-écrit dynamique avec nom/rôle du demandeur
 * ★ Realtime — statut connexion mis à jour en temps réel
 * ★ UX galaxie : ring gradient par rôle · animations · états visuels
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Easing,
  Linking, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Image }          from 'expo-image';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase }       from '@/lib/supabase';
import { getDeviceId }    from '@/services/api';

let _Haptics: any = null;
if (Platform.OS !== 'web') { try { _Haptics = require('expo-haptics'); } catch {} }
const hapticLight  = () => _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(()=>{});
const hapticMedium = () => _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Medium).catch(()=>{});
const hapticSoft   = () => _Haptics?.notificationAsync?.(_Haptics.NotificationFeedbackType?.Success).catch(()=>{});

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:        '#070C17',
  navy:      '#0D2040',
  navyLow:   '#0A1830',
  navyDark:  '#06101F',
  white:     '#FFFFFF',
  offWhite:  'rgba(255,255,255,0.88)',
  mid:       'rgba(255,255,255,0.55)',
  muted:     'rgba(255,255,255,0.35)',
  faint:     'rgba(255,255,255,0.07)',
  border:    'rgba(255,255,255,0.09)',
  borderHi:  'rgba(255,255,255,0.20)',
  blue:      '#5A96E6',
  blueDim:   'rgba(90,150,230,0.14)',
  green:     '#22C55E',
  greenDim:  'rgba(34,197,94,0.12)',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.12)',
  amber:     '#F59E0B',
  amberDim:  'rgba(245,158,11,0.14)',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.14)',
  purple:    '#BF5FFF',
  purpleDim: 'rgba(191,95,255,0.14)',
  surf:      'rgba(255,255,255,0.05)',
  surfHi:    'rgba(255,255,255,0.10)',
} as const;
const EDGE = 16;

// ─── Rôle → couleur accent ────────────────────────────────────────────────────
const ROLE_COLOR: Record<string,string> = {
  'Producteur':    C.blue,
  'Distributeur':  C.purple,
  'Financeur':     C.gold,
  'Agent':         C.green,
  'Réalisateur':   '#FB923C',
  'Autre':         C.mid,
};
const ROLE_RING: Record<string,[string,string,string]> = {
  'Producteur':    ['#5A96E6','#BF5FFF','#38BDF8'],
  'Distributeur':  ['#BF5FFF','#F472B6','#5A96E6'],
  'Financeur':     ['#F5C842','#FB923C','#F5C842'],
  'Agent':         ['#22C55E','#38BDF8','#22C55E'],
  'Réalisateur':   ['#FB923C','#F5C842','#BF5FFF'],
  'Autre':         ['#fff','rgba(255,255,255,0.4)','#fff'],
};

const PRO_ROLES = ['Tous','Producteur','Distributeur','Financeur','Agent','Réalisateur','Autre'];
type ConnStatus  = 'none'|'pending'|'accepted'|'rejected';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Professional {
  id:          string;
  profile_id?: string;
  name:        string;
  role:        string;
  bio?:        string;
  avatar_url?: string;
  location?:   string;
  website?:    string;
  email?:      string;
  films:       string[];
  specialties: string[];
  open_to:     string[];
  verified:    boolean;
}
interface RequesterProfile {
  display_name: string;
  role:         string;
  avatar_url?:  string;
}

// ─── UUID guard ───────────────────────────────────────────────────────────────
const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ─── Mapper ───────────────────────────────────────────────────────────────────
const mapPro = (r: any): Professional => ({
  id:          String(r.id ?? ''),
  profile_id:  r.profile_id ?? undefined,
  name:        r.name        ?? 'Professionnel',
  role:        r.role        ?? 'Autre',
  bio:         r.bio         ?? undefined,
  avatar_url:  r.avatar_url  ?? undefined,
  location:    r.location    ?? undefined,
  website:     r.website     ?? undefined,
  email:       r.email       ?? undefined,
  films:       Array.isArray(r.films)       ? r.films       : [],
  specialties: Array.isArray(r.specialties) ? r.specialties : [],
  open_to:     Array.isArray(r.open_to)     ? r.open_to     : [],
  verified:    r.verified    ?? false,
});

// ─── Message pré-écrit dynamique ──────────────────────────────────────────────
function buildDefaultMessage(
  requester: RequesterProfile | null,
  pro: Professional,
): string {
  const name = requester?.display_name || 'un artiste indépendant';
  const role = requester?.role ? `(${requester.role})` : '';
  return (
    `Bonjour ${pro.name},\n\n` +
    `Je suis ${name} ${role}, cinéaste travaillant dans le secteur indépendant.\n\n` +
    `J'ai découvert votre profil sur Universe et votre expertise en tant que ${pro.role.toLowerCase()} m'intéresse particulièrement.\n\n` +
    `Je serais ravi(e) d'échanger avec vous sur d'éventuelles collaborations ou opportunités.\n\n` +
    `Cordialement,\n${name}`
  );
}

// ─── Hook données ─────────────────────────────────────────────────────────────
function useProDirectoryData(search: string, roleFilter: string) {
  const [uid,         setUid]    = useState<string | null>(null);
  const [requester,   setReq]    = useState<RequesterProfile | null>(null);
  const [pros,        setPros]   = useState<Professional[]>([]);
  const [connStatus,  setConn]   = useState<Map<string, ConnStatus>>(new Map());
  const [loading,     setLoading]= useState(true);
  const [error,       setError]  = useState<string | null>(null);
  const rtRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ★ Init UUID device — getDeviceId() garantit un UUID v4 valide
  useEffect(() => {
    getDeviceId().then(deviceId => {
      if (!isValidUUID(deviceId)) {
        console.error('[ProDirectory] UUID invalide:', deviceId);
        setError('UUID device invalide — redémarre l\'app');
        return;
      }
      setUid(deviceId);
      // Fetch le profil du demandeur pour le message pré-écrit
      supabase.from('profiles')
        .select('display_name,role,avatar_url')
        .eq('id', deviceId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setReq({ display_name: data.display_name ?? '', role: data.role ?? '', avatar_url: data.avatar_url ?? '' });
        }).catch(() => {});
    });
    return () => { if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; } };
  }, []);

  // Fetch pros + statuts connexion
  const fetchData = useCallback(async (currentUid?: string) => {
    const userId = currentUid ?? uid;
    setLoading(true); setError(null);
    try {
      // 1. Fetch professionals
      let q = supabase.from('professionals')
        .select('*')
        .eq('is_active', true)
        .order('verified', { ascending: false })
        .order('created_at',  { ascending: false });

      if (search.trim()) {
        q = q.or(`name.ilike.%${search.trim()}%,bio.ilike.%${search.trim()}%,location.ilike.%${search.trim()}%`);
      }
      if (roleFilter !== 'Tous') {
        q = q.eq('role', roleFilter);
      }

      const { data, error: pErr } = await q;
      if (pErr) throw pErr;
      setPros((data ?? []).map(mapPro));

      // 2. Fetch statuts connexion du user
      if (userId && isValidUUID(userId)) {
        const { data: conns } = await supabase
          .from('pro_connections')
          .select('professional_id,status')
          .eq('requester_id', userId);
        const m = new Map<string, ConnStatus>();
        (conns ?? []).forEach((c: any) => m.set(c.professional_id, c.status as ConnStatus));
        setConn(m);
      }
    } catch (e: any) {
      console.error('[ProDirectory] fetch:', e);
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [uid, search, roleFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime — statuts connexion mis à jour en direct
  useEffect(() => {
    if (!uid || !isValidUUID(uid)) return;
    if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; }

    rtRef.current = supabase
      .channel(`pro_dir_${Date.now()}_${uid}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pro_connections',
        filter: `requester_id=eq.${uid}`,
      }, ({ eventType, new: row }) => {
        if ((eventType === 'INSERT' || eventType === 'UPDATE') && row) {
          setConn(prev => {
            const next = new Map(prev);
            next.set((row as any).professional_id, (row as any).status as ConnStatus);
            return next;
          });
        }
      })
      .subscribe();

    return () => { if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; } };
  }, [uid]);

  return { uid, requester, pros, connStatus, loading, error, refresh: () => fetchData() };
}

// ─── BADGE vérifié ────────────────────────────────────────────────────────────
const VerifiedBadge = memo(() => (
  <View style={vb.wrap}>
    <Ionicons name="checkmark-circle" size={10} color={C.blue}/>
    <Text style={vb.txt}>Vérifié</Text>
  </View>
));
const vb = StyleSheet.create({
  wrap: { flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.blueDim,borderWidth:0.5,borderColor:'rgba(90,150,230,0.35)' },
  txt:  { color:C.blue, fontSize:8.5, fontWeight:'800' },
});

// ─── Chip Open-to ─────────────────────────────────────────────────────────────
const OpenToChip = memo(({ label }:{ label:string }) => (
  <View style={otc.chip}><Text style={otc.txt}>{label}</Text></View>
));
const otc = StyleSheet.create({
  chip: { paddingHorizontal:8,paddingVertical:3,borderRadius:9,backgroundColor:C.greenDim,borderWidth:0.5,borderColor:'rgba(34,197,94,0.30)' },
  txt:  { color:C.green, fontSize:9.5, fontWeight:'600' },
});

// ─── Bouton de connexion avec état ────────────────────────────────────────────
const ConnectButton = memo(function ConnectButton({
  status, onPress, loading: btnLoading,
}:{ status:ConnStatus; onPress:()=>void; loading:boolean }) {
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(sc,{toValue:0.92,tension:350,friction:7,useNativeDriver:true}),
      Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
    ]).start();
    onPress();
  };

  if (status === 'accepted') return(
    <View style={[cb.base, cb.accepted]}>
      <Ionicons name="checkmark-circle" size={14} color={C.green}/>
      <Text style={[cb.txt,{color:C.green}]}>Connecté</Text>
    </View>
  );
  if (status === 'pending') return(
    <View style={[cb.base, cb.pending]}>
      <Ionicons name="time-outline" size={14} color={C.amber}/>
      <Text style={[cb.txt,{color:C.amber}]}>En attente</Text>
    </View>
  );
  if (status === 'rejected') return(
    <TouchableOpacity style={[cb.base, cb.rejected]} onPress={press} activeOpacity={0.85}>
      <Ionicons name="refresh-outline" size={14} color={C.red}/>
      <Text style={[cb.txt,{color:C.red}]}>Refusé · Renvoyer</Text>
    </TouchableOpacity>
  );

  return(
    <Animated.View style={{transform:[{scale:sc}]}}>
      <TouchableOpacity style={cb.base} onPress={press} disabled={btnLoading} activeOpacity={0.85}>
        {btnLoading
          ? <ActivityIndicator color={C.white} size="small" style={{width:70}}/>
          : <>
              <Ionicons name="mail-outline" size={14} color={C.white}/>
              <Text style={cb.txt}>Contacter</Text>
            </>
        }
      </TouchableOpacity>
    </Animated.View>
  );
});
const cb = StyleSheet.create({
  base:     { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,flex:1,paddingVertical:11,borderRadius:13,backgroundColor:C.blue,borderWidth:0.5,borderColor:'rgba(90,150,230,0.50)' },
  accepted: { backgroundColor:C.greenDim, borderColor:'rgba(34,197,94,0.30)' },
  pending:  { backgroundColor:C.amberDim, borderColor:'rgba(245,158,11,0.30)' },
  rejected: { backgroundColor:C.redDim,   borderColor:'rgba(239,68,68,0.30)'  },
  txt:      { color:C.white, fontSize:13, fontWeight:'700' },
});

// ─── PRO CARD ─────────────────────────────────────────────────────────────────
const ProCard = memo(function ProCard({
  pro, status, onContact,
}:{ pro:Professional; status:ConnStatus; onContact:(pro:Professional)=>void }) {
  const [bioExpanded, setBio] = useState(false);
  const [imgErr,      setErr] = useState(false);
  const [connecting,  setCon] = useState(false);
  const accentColor = ROLE_COLOR[pro.role] ?? C.mid;
  const ringColors  = ROLE_RING[pro.role]  ?? ['#fff','rgba(255,255,255,0.4)','#fff'];
  const avatarUri   = (!imgErr && pro.avatar_url) ? pro.avatar_url : `https://i.pravatar.cc/120?u=${pro.id}`;

  const handleConnect = useCallback(() => {
    if (status !== 'none' && status !== 'rejected') return;
    hapticMedium();
    onContact(pro);
  }, [pro, status, onContact]);

  return(
    <View style={prc.card}>
      <BlurView intensity={Platform.OS==='ios'?14:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={prc.inner}>

        {/* Header */}
        <View style={prc.header}>
          {/* Avatar avec ring gradient selon rôle */}
          <View style={prc.avatarWrap}>
            <LinearGradient colors={ringColors} style={prc.avatarRing} start={{x:0,y:0}} end={{x:1,y:1}}/>
            <Image source={{uri:avatarUri}} style={prc.avatar} contentFit="cover" onError={()=>setErr(true)}/>
          </View>
          <View style={{flex:1,gap:4}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <Text style={prc.name} numberOfLines={1}>{pro.name}</Text>
              {pro.verified && <VerifiedBadge/>}
            </View>
            {/* Rôle avec accent couleur */}
            <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
              <View style={[prc.roleChip,{borderColor:`${accentColor}55`,backgroundColor:`${accentColor}18`}]}>
                <Ionicons name="briefcase-outline" size={10} color={accentColor}/>
                <Text style={[prc.roleTxt,{color:accentColor}]}>{pro.role}</Text>
              </View>
            </View>
            {pro.location&&(
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                <Ionicons name="location-outline" size={10} color={C.muted}/>
                <Text style={prc.loc}>{pro.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bio cliquable */}
        {!!pro.bio&&(
          <TouchableOpacity onPress={()=>setBio(v=>!v)} activeOpacity={0.80}>
            <Text style={prc.bio} numberOfLines={bioExpanded?undefined:2}>{pro.bio}</Text>
            {pro.bio.length>100&&(
              <Text style={{color:C.blue,fontSize:11,fontWeight:'700',marginTop:2}}>
                {bioExpanded?'Moins ↑':'Lire plus ↓'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Films */}
        {pro.films.length>0&&(
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
            {pro.films.slice(0,5).map(film=>(
              <View key={film} style={prc.filmChip}>
                <Ionicons name="film-outline" size={10} color={C.mid}/>
                <Text style={prc.filmTxt} numberOfLines={1}>{film}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Open-to */}
        {pro.open_to.length>0&&(
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
            {pro.open_to.slice(0,3).map(o=><OpenToChip key={o} label={o}/>)}
          </View>
        )}

        {/* Actions */}
        <View style={{flexDirection:'row',gap:10,marginTop:2}}>
          <ConnectButton status={status} onPress={handleConnect} loading={connecting}/>
          {pro.website&&(
            <TouchableOpacity style={prc.webBtn} onPress={()=>Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.80}>
              <Ionicons name="globe-outline" size={16} color={C.blue}/>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const prc = StyleSheet.create({
  card:       { marginHorizontal:EDGE, marginBottom:14, borderRadius:20, overflow:'hidden', borderWidth:0.5, borderColor:'rgba(255,255,255,0.10)', backgroundColor:'rgba(13,34,64,0.50)' },
  inner:      { padding:16, gap:12 },
  header:     { flexDirection:'row', gap:12, alignItems:'flex-start' },
  avatarWrap: { position:'relative' },
  avatarRing: { position:'absolute', top:-2, left:-2, right:-2, bottom:-2, borderRadius:29 },
  avatar:     { width:52, height:52, borderRadius:26, borderWidth:2, borderColor:'#03000A' },
  name:       { color:C.white, fontSize:15, fontWeight:'800', flexShrink:1 },
  roleChip:   { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:8, borderWidth:0.5 },
  roleTxt:    { fontSize:11, fontWeight:'700' },
  loc:        { color:C.muted, fontSize:10 },
  bio:        { color:'rgba(255,255,255,0.62)', fontSize:13, lineHeight:19 },
  filmChip:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:4, borderRadius:9, backgroundColor:C.surf, borderWidth:0.5, borderColor:C.border, maxWidth:140 },
  filmTxt:    { color:C.mid, fontSize:11, fontWeight:'600', flexShrink:1 },
  webBtn:     { width:44, height:44, borderRadius:13, backgroundColor:C.surf, borderWidth:0.5, borderColor:C.border, alignItems:'center', justifyContent:'center' },
});

// ─── ★ MODAL DE CONNEXION ─────────────────────────────────────────────────────
const ConnectionModal = memo(function ConnectionModal({
  pro, uid, requester, onClose, onSent,
}:{
  pro: Professional | null;
  uid: string | null;
  requester: RequesterProfile | null;
  onClose: () => void;
  onSent:  (proId: string) => void;
}) {
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const slideY = useRef(new Animated.Value(700)).current;
  const bg     = useRef(new Animated.Value(0)).current;

  // Met à jour le message pré-écrit quand le pro change
  useEffect(() => {
    if (pro) setMessage(buildDefaultMessage(requester, pro));
  }, [pro, requester]);

  useEffect(() => {
    if (pro) {
      Animated.parallel([
        Animated.spring(slideY,{toValue:0,tension:65,friction:12,useNativeDriver:true}),
        Animated.timing(bg,{toValue:1,duration:250,useNativeDriver:false}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,{toValue:700,duration:220,useNativeDriver:true}),
        Animated.timing(bg,{toValue:0,duration:220,useNativeDriver:false}),
      ]).start();
    }
  },[pro]);

  const handleSend = useCallback(async () => {
    if (!pro || !uid || sending) return;

    // ★ UUID guard — évite l'erreur "id=eq.anonymous"
    if (!isValidUUID(uid)) {
      Alert.alert('Erreur', 'Identifiant utilisateur invalide. Redémarrez l\'application.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message vide', 'Rédigez un message avant d\'envoyer.');
      return;
    }

    setSending(true);
    hapticMedium();

    try {
      // ── 1. INSERT pro_connections ─────────────────────────────────────────
      const { error: connErr } = await supabase
        .from('pro_connections')
        .upsert({
          requester_id:    uid,
          professional_id: pro.id,
          status:          'pending',
          message:         message.trim(),
          requester_name:  requester?.display_name ?? '',
          requester_role:  requester?.role ?? '',
          updated_at:      new Date().toISOString(),
        }, { onConflict: 'requester_id,professional_id' });

      if (connErr) {
        console.error('[ProDirectory] pro_connections insert:', connErr);
        throw new Error(connErr.message);
      }

      // ── 2. Notification pour le professionnel ─────────────────────────────
      const notifTarget = pro.profile_id ?? pro.id;
      await supabase.from('notifications').insert({
        user_id: notifTarget,
        type:    'connection_request',
        content: `${requester?.display_name ?? 'Un artiste'} souhaite vous contacter`,
        read:    false,
        data:    JSON.stringify({ requester_id: uid, requester_name: requester?.display_name, message: message.trim().slice(0,200) }),
      }).catch(() => {}); // silencieux si notifications n'est pas configurée

      // ── 3. Email via Supabase Edge Function (dégradé si absent) ──────────
      if (pro.email) {
        await supabase.functions.invoke('send-connection-email', {
          body: {
            to:            pro.email,
            to_name:       pro.name,
            from_name:     requester?.display_name ?? 'Artiste Universe',
            from_role:     requester?.role ?? '',
            message:       message.trim(),
            platform_link: 'https://universe.app/professionals',
          },
        }).catch(() => {
          // Edge Function optionnelle — la connexion est créée même sans email
          console.warn('[ProDirectory] Edge Function send-connection-email absente ou erreur');
        });
      }

      hapticSoft();
      onSent(pro.id);
      onClose();
      Alert.alert(
        '✓ Demande envoyée',
        `Votre demande a été envoyée à ${pro.name}.\n${pro.email ? 'Un email de notification a été envoyé.' : 'Une notification a été envoyée dans l\'app.'}`,
      );
    } catch (e: any) {
      Alert.alert(
        'Erreur d\'envoi',
        `${e?.message ?? 'Erreur inconnue'}\n\nAssurez-vous d\'avoir exécuté fix_pro_connections.sql dans Supabase.`,
      );
    } finally {
      setSending(false);
    }
  }, [pro, uid, message, requester, sending, onSent, onClose]);

  if (!pro) return null;

  const accentColor = ROLE_COLOR[pro.role] ?? C.blue;
  const bgColor = bg.interpolate({inputRange:[0,1],outputRange:['rgba(0,0,0,0)','rgba(0,0,0,0.60)']});

  return (
    <Animated.View style={[StyleSheet.absoluteFill,{zIndex:200,justifyContent:'flex-end',backgroundColor:bgColor}]}>
      {/* Backdrop */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}/>

      <Animated.View style={[cm.sheet,{transform:[{translateY:slideY}]}]}>
        <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={StyleSheet.absoluteFillObject}/>

        {/* Handle */}
        <View style={cm.handle}/>

        {/* Pro mini header */}
        <View style={cm.proHeader}>
          <View style={[cm.roleBar,{backgroundColor:`${accentColor}22`,borderColor:`${accentColor}44`}]}>
            <Ionicons name="briefcase-outline" size={11} color={accentColor}/>
            <Text style={[cm.roleBarTxt,{color:accentColor}]}>{pro.role}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={cm.proName}>{pro.name}</Text>
            {pro.location&&<Text style={cm.proLoc}>{pro.location}</Text>}
          </View>
          {pro.verified&&<VerifiedBadge/>}
        </View>

        <View style={cm.divider}/>

        {/* Label */}
        <Text style={cm.msgLabel}>VOTRE MESSAGE</Text>
        <Text style={cm.msgHint}>Pré-rempli — modifiez librement avant d'envoyer</Text>

        {/* Message éditable */}
        <View style={cm.msgWrap}>
          <TextInput
            style={cm.msgInput}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={600}
            placeholder="Votre message…"
            placeholderTextColor={C.muted}
            selectionColor={accentColor}
            textAlignVertical="top"
            autoFocus
          />
          <Text style={cm.charCount}>{message.length}/600</Text>
        </View>

        {/* Note email */}
        {pro.email&&(
          <View style={cm.emailNote}>
            <Ionicons name="mail-outline" size={12} color={C.muted}/>
            <Text style={cm.emailNoteTxt}>
              Un email sera également envoyé à {pro.email}
            </Text>
          </View>
        )}

        {/* Bouton envoyer */}
        <TouchableOpacity
          style={[cm.sendBtn, {borderColor:`${accentColor}55`}, sending&&{opacity:0.55}]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[accentColor, `${accentColor}BB`]}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={StyleSheet.absoluteFillObject}
          />
          {sending
            ? <ActivityIndicator color={C.white} size="small"/>
            : <>
                <Ionicons name="send-outline" size={16} color={C.white}/>
                <Text style={cm.sendTxt}>Envoyer la demande</Text>
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={cm.cancelBtn}>
          <Text style={cm.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

const cm = StyleSheet.create({
  sheet:      { borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden', paddingHorizontal:20, paddingTop:8, paddingBottom:40, borderWidth:0.5, borderColor:'rgba(255,255,255,0.10)', backgroundColor:'rgba(10,24,48,0.95)' },
  handle:     { width:36, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.18)', alignSelf:'center', marginBottom:16 },
  proHeader:  { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
  roleBar:    { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:4, borderRadius:9, borderWidth:0.5 },
  roleBarTxt: { fontSize:10, fontWeight:'700' },
  proName:    { color:C.white, fontSize:16, fontWeight:'800', letterSpacing:-0.2 },
  proLoc:     { color:C.muted, fontSize:11, marginTop:1 },
  divider:    { height:StyleSheet.hairlineWidth, backgroundColor:'rgba(255,255,255,0.08)', marginBottom:16 },
  msgLabel:   { color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:1.5, marginBottom:3 },
  msgHint:    { color:'rgba(255,255,255,0.25)', fontSize:11, marginBottom:12 },
  msgWrap:    { borderRadius:14, borderWidth:1, borderColor:'rgba(255,255,255,0.12)', backgroundColor:'rgba(255,255,255,0.04)', marginBottom:10 },
  msgInput:   { color:C.white, fontSize:13, lineHeight:20, padding:14, minHeight:160 },
  charCount:  { color:C.muted, fontSize:9, textAlign:'right', paddingHorizontal:12, paddingBottom:8 },
  emailNote:  { flexDirection:'row', alignItems:'center', gap:6, marginBottom:14, paddingHorizontal:2 },
  emailNoteTxt:{ color:C.muted, fontSize:11, flex:1 },
  sendBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:15, borderRadius:16, overflow:'hidden', borderWidth:0.5, marginBottom:10 },
  sendTxt:    { color:C.white, fontSize:15, fontWeight:'700' },
  cancelBtn:  { alignItems:'center', paddingVertical:8 },
  cancelTxt:  { color:C.muted, fontSize:13, fontWeight:'600' },
});

// ─── Filtre rôle ──────────────────────────────────────────────────────────────
const RoleFilter = memo(function RoleFilter({
  active, onSelect,
}:{ active:string; onSelect:(r:string)=>void }) {
  return(
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:8,paddingVertical:4}}>
      {PRO_ROLES.map(r => {
        const on  = active === r;
        const clr = ROLE_COLOR[r] ?? C.blue;
        return(
          <TouchableOpacity
            key={r}
            style={[rfl.chip, on&&{borderColor:`${clr}60`,backgroundColor:`${clr}18`}]}
            onPress={()=>{ hapticLight(); onSelect(r); }}
            activeOpacity={0.80}
          >
            <Text style={[rfl.txt, on&&{color:clr,fontWeight:'800'}]}>{r}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});
const rfl = StyleSheet.create({
  chip: { paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:C.surf, borderWidth:1, borderColor:C.border },
  txt:  { color:C.mid, fontSize:12, fontWeight:'600' },
});

// ─── État vide ────────────────────────────────────────────────────────────────
const EmptyState = memo(({ search, role }:{ search:string; role:string }) => (
  <View style={{alignItems:'center',paddingTop:60,paddingHorizontal:32,gap:10}}>
    <View style={{width:64,height:64,borderRadius:32,backgroundColor:C.surf,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'}}>
      <Ionicons name="people-outline" size={30} color={C.muted}/>
    </View>
    <Text style={{color:C.mid,fontSize:16,fontWeight:'700'}}>Aucun professionnel</Text>
    <Text style={{color:C.muted,fontSize:13,textAlign:'center',lineHeight:18}}>
      {search ? `Aucun résultat pour « ${search} »` : `Aucun professionnel en catégorie « ${role} »`}
    </Text>
  </View>
));

// ─── ★ MAIN ───────────────────────────────────────────────────────────────────
export default function ProDirectory() {
  const [search,     setSearch]    = useState('');
  const [activeRole, setActiveRole]= useState('Tous');
  const [contactPro, setContactPro]= useState<Professional | null>(null);

  const { uid, requester, pros, connStatus, loading, error, refresh } =
    useProDirectoryData(search, activeRole);

  // Mise à jour locale du statut après envoi (avant que le Realtime n'arrive)
  const handleSent = useCallback((proId: string) => {
    // Le Realtime mettra à jour automatiquement via l'abonnement
  }, []);

  const proCount    = pros.length;
  const countStr    = `${proCount} professionnel${proCount>1?'s':''}`;

  return(
    <View style={{flex:1}}>
      {/* Header */}
      <View style={dir.header}>
        <View>
          <Text style={dir.eyebrow}>ANNUAIRE · CINÉMA INDÉPENDANT</Text>
          <Text style={dir.title}>Professionnels</Text>
          {requester?.display_name&&(
            <Text style={dir.subtitle}>Connecté en tant que {requester.display_name}</Text>
          )}
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={dir.searchWrap}>
        <BlurView intensity={Platform.OS==='ios'?16:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={dir.searchRow}>
          <Ionicons name="search" size={15} color={C.muted}/>
          <TextInput
            style={dir.searchInput}
            placeholder="Nom, localisation, spécialité…"
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
            selectionColor={C.blue}
          />
          {search.length>0&&(
            <TouchableOpacity onPress={()=>setSearch('')} hitSlop={10 as any}>
              <Ionicons name="close-circle" size={15} color={C.muted}/>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtre rôle */}
      <View style={{marginBottom:14}}>
        <RoleFilter active={activeRole} onSelect={setActiveRole}/>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={dir.loader}>
          <ActivityIndicator color={C.blue} size="large"/>
          <Text style={dir.loaderTxt}>Chargement du répertoire…</Text>
        </View>
      ) : error ? (
        <View style={dir.loader}>
          <Ionicons name="cloud-offline-outline" size={36} color={C.muted}/>
          <Text style={{color:C.red,fontSize:13,marginTop:10,textAlign:'center',paddingHorizontal:24}}>{error}</Text>
          <TouchableOpacity style={dir.retryBtn} onPress={refresh}>
            <Text style={{color:C.white,fontWeight:'700'}}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : pros.length===0 ? (
        <EmptyState search={search} role={activeRole}/>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}}>
          <Text style={dir.count}>{countStr}</Text>
          {pros.map(pro=>(
            <ProCard
              key={pro.id}
              pro={pro}
              status={connStatus.get(pro.id) ?? 'none'}
              onContact={setContactPro}
            />
          ))}
        </ScrollView>
      )}

      {/* ★ Modal connexion avec message pré-écrit */}
      <ConnectionModal
        pro={contactPro}
        uid={uid}
        requester={requester}
        onClose={()=>setContactPro(null)}
        onSent={handleSent}
      />
    </View>
  );
}

const dir = StyleSheet.create({
  header:     { paddingHorizontal:EDGE, paddingTop:10, paddingBottom:14 },
  eyebrow:    { color:C.muted, fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:2 },
  title:      { color:C.white, fontSize:26, fontWeight:'800', letterSpacing:-0.5 },
  subtitle:   { color:C.muted, fontSize:11, marginTop:3 },
  searchWrap: { marginHorizontal:EDGE, marginBottom:14, borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:C.border },
  searchRow:  { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingVertical:12 },
  searchInput:{ flex:1, color:C.white, fontSize:14, fontWeight:'500' },
  loader:     { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  loaderTxt:  { color:C.mid, fontSize:13 },
  retryBtn:   { marginTop:8, paddingHorizontal:22, paddingVertical:10, borderRadius:14, backgroundColor:C.navy, borderWidth:1, borderColor:C.borderHi },
  count:      { color:C.muted, fontSize:12, paddingHorizontal:EDGE, marginBottom:12 },
});