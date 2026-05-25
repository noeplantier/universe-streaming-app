/**
 * app/notifications.tsx — UNIVERSE · CENTRE DE NOTIFICATIONS
 *
 * Sources :
 *   – profile.tsx  : reels approuvés/rejetés, visites profil, films vus
 *   – social.tsx   : likes, mentions, connexions pro, commentaires
 *   – VideoTab     : confirmation soumission reel
 *
 * Fonctionnalités :
 *   ★ Realtime INSERT (postgres_changes filtré par user_id)
 *   ★ Haptic + slide-in pour chaque nouvelle notification
 *   ★ Groupement Aujourd'hui / Hier / Cette semaine / Plus tôt
 *   ★ Filtres : Tout · Non lus · Films · Connexions · Système
 *   ★ Navigation vers la bonne page selon le type
 *   ★ Long-press → supprimer avec animation
 *   ★ Auth : getSession() uniquement (UUID garanti, pas de display_name)
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, FlatList, Platform,
  RefreshControl, SectionList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Image }          from 'expo-image';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import * as Haptics       from 'expo-haptics';
import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — blanc + navyMid
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navyMid:  '#0D2040',
  navyLow:  '#0A1830',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.36)',
  subtle:   'rgba(255,255,255,0.14)',
  faint:    'rgba(255,255,255,0.07)',
  border:   'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.20)',
} as const;

const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type NotifType =
  | 'like' | 'critique_like' | 'comment'
  | 'follow' | 'connection_request' | 'connection_accepted'
  | 'reel_submitted' | 'reel_approved' | 'reel_rejected'
  | 'new_film' | 'mention' | 'seen_film' | 'system';

interface Notif {
  id:         string;
  user_id:    string;
  type:       NotifType;
  title:      string;
  body:       string;
  data:       Record<string, any> | null;
  read:       boolean;
  created_at: string;
}

type FilterKey = 'all' | 'unread' | 'films' | 'connections' | 'system';
interface Section { title: string; data: Notif[] }

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — icône + navigation par type
// ─────────────────────────────────────────────────────────────────────────────
interface NotifConfig {
  icon:   keyof typeof Ionicons.glyphMap;
  filter: FilterKey;
  label:  string;
  route?: (data: Record<string, any>) => string | null;
}

const NCFG: Record<string, NotifConfig> = {
  like:                { icon:'heart-outline',          filter:'films',       label:'J\'aime',        route: d => d.post_id     ? '/(tabs)/social' : null },
  critique_like:       { icon:'star-outline',           filter:'films',       label:'Critique aimée', route: d => d.critique_id ? `/review/${d.critique_id}` : null },
  comment:             { icon:'chatbubble-outline',     filter:'films',       label:'Commentaire',    route: d => d.critique_id ? `/review/${d.critique_id}` : '/(tabs)/social' },
  follow:              { icon:'person-outline',         filter:'connections', label:'Profil consulté',route: d => d.actor_id    ? `/user/${d.actor_id}` : null },
  connection_request:  { icon:'link-outline',           filter:'connections', label:'Connexion pro',  route: _ => '/(tabs)/social' },
  connection_accepted: { icon:'checkmark-circle-outline',filter:'connections',label:'Connexion pro',  route: _ => '/(tabs)/social' },
  reel_submitted:      { icon:'cloud-upload-outline',   filter:'system',      label:'Soumis',         route: _ => '/profile' },
  reel_approved:       { icon:'checkmark-circle-outline',filter:'system',     label:'Reel validé',    route: d => d.reel_id ? `/reel/${d.reel_id}` : '/profile' },
  reel_rejected:       { icon:'close-circle-outline',   filter:'system',      label:'Reel rejeté',    route: _ => '/profile' },
  new_film:            { icon:'film-outline',           filter:'films',       label:'Nouveau film',   route: d => d.film_id ? `/film/${d.film_id}` : null },
  mention:             { icon:'at-outline',             filter:'films',       label:'Mention',        route: _ => '/(tabs)/social' },
  seen_film:           { icon:'eye-outline',            filter:'films',       label:'Visionnage',     route: d => d.film_id ? `/film/${d.film_id}` : null },
  system:              { icon:'information-circle-outline',filter:'system',   label:'Système',        route: _ => null },
};

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key:'all',         label:'Tout',       icon:'apps-outline'        },
  { key:'unread',      label:'Non lus',    icon:'ellipse-outline'     },
  { key:'films',       label:'Films',      icon:'film-outline'        },
  { key:'connections', label:'Connexions', icon:'people-outline'      },
  { key:'system',      label:'Système',    icon:'settings-outline'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)     return 'À l\'instant';
  if (s < 3600)   return `${Math.floor(s / 60)} min`;
  if (s < 86400)  return `${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'Hier';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
}

function groupByDate(notifs: Notif[]): Section[] {
  const now     = new Date();
  const today   = now.toDateString();
  const yest    = new Date(now); yest.setDate(yest.getDate() - 1);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const g: Record<string, Notif[]> = {
    'Aujourd\'hui': [], 'Hier': [], 'Cette semaine': [], 'Plus tôt': [],
  };
  notifs.forEach(n => {
    const d = new Date(n.created_at);
    if (d.toDateString() === today)     g['Aujourd\'hui'].push(n);
    else if (d.toDateString() === yest.toDateString()) g['Hier'].push(n);
    else if (d > weekAgo)               g['Cette semaine'].push(n);
    else                                g['Plus tôt'].push(n);
  });
  return Object.entries(g).filter(([, d]) => d.length > 0).map(([title, data]) => ({ title, data }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────────────
async function dbFetch(userId: string): Promise<Notif[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,type,title,body,data,read,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { if (__DEV__) console.warn('[notifs] fetch:', error.message); return []; }
  return (data ?? []) as Notif[];
}

async function dbMarkRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

async function dbMarkAllRead(userId: string): Promise<void> {
  await supabase.from('notifications')
    .update({ read: true }).eq('user_id', userId).eq('read', false);
}

async function dbDelete(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  const op = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.40, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.15, duration: 800, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [op]);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: C.navyMid, opacity: op }}/>;
});

const NotifSkeleton = memo(function NotifSkeleton() {
  return (
    <View style={{ paddingTop: 12, gap: 1 }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <View key={i} style={sk.row}>
          <Shimmer w={44} h={44} r={22}/>
          <View style={{ flex: 1, gap: 9 }}>
            <Shimmer w="68%" h={12}/>
            <Shimmer w="44%" h={10}/>
          </View>
          <Shimmer w={28} h={9} r={4}/>
        </View>
      ))}
    </View>
  );
});
const sk = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', gap:13, paddingHorizontal:EDGE, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────
const FilterTabs = memo(function FilterTabs({
  active, counts, onChange,
}: { active: FilterKey; counts: Partial<Record<FilterKey, number>>; onChange: (k: FilterKey) => void }) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={FILTERS}
      keyExtractor={f => f.key}
      contentContainerStyle={{ paddingHorizontal: EDGE, gap: 8, paddingBottom: 10 }}
      renderItem={({ item: f }) => {
        const on  = active === f.key;
        const cnt = counts[f.key] ?? 0;
        return (
          <TouchableOpacity
            style={[ft.chip, on && ft.chipOn]}
            onPress={() => onChange(f.key)}
            activeOpacity={0.80}
          >
            <Ionicons name={f.icon} size={11} color={on ? C.white : C.muted}/>
            <Text style={[ft.label, on && ft.labelOn]}>{f.label}</Text>
            {cnt > 0 && (
              <View style={[ft.badge, on && ft.badgeOn]}>
                <Text style={[ft.badgeTxt, on && ft.badgeTxtOn]}>{cnt > 99 ? '99+' : cnt}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
});
const ft = StyleSheet.create({
  chip:      { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint },
  chipOn:    { backgroundColor:C.subtle, borderColor:C.borderHi },
  label:     { color:C.muted, fontSize:12, fontWeight:'600' },
  labelOn:   { color:C.white, fontWeight:'700' },
  badge:     { paddingHorizontal:5, paddingVertical:1, borderRadius:8, backgroundColor:C.border, minWidth:18, alignItems:'center' },
  badgeOn:   { backgroundColor:C.subtle },
  badgeTxt:  { color:C.muted, fontSize:9, fontWeight:'800' },
  badgeTxtOn:{ color:C.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionHead = memo(function SectionHead({ title }: { title: string }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.txt}>{title}</Text>
      <View style={sh.line}/>
    </View>
  );
});
const sh = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:EDGE, paddingTop:20, paddingBottom:8 },
  txt:  { color:C.muted, fontSize:10, fontWeight:'800', letterSpacing:1, textTransform:'uppercase' },
  line: { flex:1, height:StyleSheet.hairlineWidth, backgroundColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ NOTIF CARD — slide-in animé + long-press supprimer
// ─────────────────────────────────────────────────────────────────────────────
const NotifCard = memo(function NotifCard({
  notif, isNew, onPress, onDelete,
}: {
  notif:    Notif;
  isNew:    boolean;
  onPress:  (n: Notif) => void;
  onDelete: (id: string) => void;
}) {
  const cfg      = NCFG[notif.type] ?? NCFG.system;
  const slideX   = useRef(new Animated.Value(isNew ? W : 0)).current;
  const opacity  = useRef(new Animated.Value(1)).current;
  const avatarUri = notif.data?.avatar_url as string | undefined;

  // Slide-in pour les nouvelles notifs reçues en realtime
  useEffect(() => {
    if (!isNew) return;
    Animated.spring(slideX, {
      toValue: 0, tension: 80, friction: 11, useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line

  const handleDelete = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideX,  { toValue: -W, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,  duration: 260, useNativeDriver: true }),
    ]).start(() => onDelete(notif.id));
  }, [notif.id, onDelete, slideX, opacity]);

  return (
    <Animated.View style={{ transform: [{ translateX: slideX }], opacity }}>
      <TouchableOpacity
        style={[nc.card, !notif.read && nc.cardUnread]}
        onPress={() => onPress(notif)}
        onLongPress={handleDelete}
        activeOpacity={0.85}
        delayLongPress={500}
      >
        {/* Point non lu */}
        {!notif.read && <View style={nc.dot}/>}

        {/* Icône / Avatar */}
        <View style={nc.iconWrap}>
          {avatarUri ? (
            <View style={nc.avatarWrap}>
              <Image source={{ uri: avatarUri }} style={nc.avatar} contentFit="cover"/>
              <View style={nc.typePin}>
                <Ionicons name={cfg.icon} size={8} color={C.white}/>
              </View>
            </View>
          ) : (
            <View style={nc.iconCircle}>
              <Ionicons name={cfg.icon} size={20} color={C.mid}/>
            </View>
          )}
        </View>

        {/* Contenu */}
        <View style={nc.body}>
          <View style={nc.titleRow}>
            <Text style={nc.title} numberOfLines={1}>{notif.title}</Text>
            <Text style={nc.time}>{relTime(notif.created_at)}</Text>
          </View>
          <Text style={nc.bodyTxt} numberOfLines={2}>{notif.body}</Text>
          <View style={nc.chip}>
            <Text style={nc.chipTxt}>{cfg.label}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={13} color={C.border} style={{ alignSelf:'center' }}/>
      </TouchableOpacity>
    </Animated.View>
  );
});

const nc = StyleSheet.create({
  card:       { flexDirection:'row', alignItems:'center', gap:13, paddingHorizontal:EDGE, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  cardUnread: { backgroundColor:'rgba(255,255,255,0.03)' },
  dot:        { position:'absolute', left:6, top:'50%', marginTop:-4, width:8, height:8, borderRadius:4, backgroundColor:C.white },
  iconWrap:   { flexShrink:0 },
  iconCircle: { width:46, height:46, borderRadius:23, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  avatarWrap: { position:'relative', width:46, height:46 },
  avatar:     { width:46, height:46, borderRadius:23, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  typePin:    { position:'absolute', bottom:-2, right:-2, width:17, height:17, borderRadius:9, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  body:       { flex:1, gap:3 },
  titleRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', gap:8 },
  title:      { color:C.white, fontSize:13, fontWeight:'700', flex:1 },
  time:       { color:C.muted, fontSize:10, flexShrink:0, marginTop:1 },
  bodyTxt:    { color:C.muted, fontSize:12, lineHeight:17 },
  chip:       { alignSelf:'flex-start', paddingHorizontal:7, paddingVertical:2, borderRadius:7, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, marginTop:2 },
  chipTxt:    { color:C.muted, fontSize:9, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(function EmptyState({ filter }: { filter: FilterKey }) {
  const m: Record<FilterKey, { icon: keyof typeof Ionicons.glyphMap; text: string; sub: string }> = {
    all:         { icon:'notifications-off-outline',       text:'Aucune notification',          sub:'Vos interactions apparaîtront ici'       },
    unread:      { icon:'checkmark-done-circle-outline',   text:'Tout est lu',                  sub:'Vous êtes à jour'                        },
    films:       { icon:'film-outline',                    text:'Aucune activité films',         sub:'Likes, mentions et vues arrivent ici'    },
    connections: { icon:'people-outline',                  text:'Aucune connexion pro',          sub:'Demandes et confirmations arrivent ici'  },
    system:      { icon:'settings-outline',                text:'Aucune notification système',   sub:'Statuts de modération et mises à jour'   },
  };
  const c = m[filter];
  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}>
        <Ionicons name={c.icon} size={40} color={C.muted}/>
      </View>
      <Text style={em.text}>{c.text}</Text>
      <Text style={em.sub}>{c.sub}</Text>
    </View>
  );
});
const em = StyleSheet.create({
  wrap:    { paddingTop: 80, alignItems:'center', gap:10 },
  iconWrap:{ width:78, height:78, borderRadius:39, borderWidth:1, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center', marginBottom:4 },
  text:    { color:C.offWhite, fontSize:16, fontWeight:'700' },
  sub:     { color:C.muted, fontSize:13, textAlign:'center', paddingHorizontal:32, lineHeight:19 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ SCREEN ★★★
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();

  const [uid,       setUid]       = useState<string | null>(null);
  const [notifs,    setNotifs]    = useState<Notif[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [filter,    setFilter]    = useState<FilterKey>('all');
  const [newIds,    setNewIds]    = useState<Set<string>>(new Set());

  // ── Auth — UUID garanti via getSession() ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const id = session?.user?.id;
      if (id && isUUID(id)) setUid(id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      const id = s?.user?.id;
      setUid(id && isUUID(id) ? id : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch initial ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!uid) { setLoading(false); setRefreshing(false); return; }
    const data = await dbFetch(uid);
    setNotifs(data);
    setLoading(false);
    setRefreshing(false);
  }, [uid]);

  useEffect(() => { if (uid) load(); }, [uid, load]);

  // ── ★ REALTIME — INSERT en temps réel filtré par user_id ─────────────────
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`notifs_rt_${uid}`)
      .on(
        'postgres_changes',
        { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        ({ new: row }) => {
          const notif = row as Notif;
          // Haptic discret
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          // Ajout en tête + flag pour l'animation slide-in
          setNotifs(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
          setNewIds(prev => new Set([...prev, notif.id]));
          // Retire le flag après l'animation (1.2s)
          setTimeout(() => {
            setNewIds(prev => { const s = new Set(prev); s.delete(notif.id); return s; });
          }, 1200);
        },
      )
      .on(
        'postgres_changes',
        { event:'UPDATE', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        ({ new: row }) => {
          setNotifs(prev => prev.map(n => n.id === (row as Notif).id ? { ...n, ...(row as Notif) } : n));
        },
      )
      .on(
        'postgres_changes',
        { event:'DELETE', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        ({ old: row }) => {
          setNotifs(prev => prev.filter(n => n.id !== (row as any).id));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [uid]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handlePress = useCallback(async (notif: Notif) => {
    // Marque comme lu immédiatement (optimistic)
    if (!notif.read) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      dbMarkRead(notif.id).catch(() => {});
    }
    // Navigation
    const cfg   = NCFG[notif.type] ?? NCFG.system;
    const route = cfg.route?.(notif.data ?? {});
    if (route) router.push(route as any);
  }, [router]);

  const handleDelete = useCallback((id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    dbDelete(id).catch(() => {});
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const handleMarkAllRead = useCallback(() => {
    if (!uid) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    dbMarkAllRead(uid).catch(() => {});
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [uid]);

  // ── Filtrage + groupement ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'all')    return notifs;
    if (filter === 'unread') return notifs.filter(n => !n.read);
    return notifs.filter(n => (NCFG[n.type]?.filter ?? 'system') === filter);
  }, [notifs, filter]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  const filterCounts = useMemo<Partial<Record<FilterKey, number>>>(() => {
    const u = notifs.filter(n => !n.read);
    return {
      unread:      u.length,
      films:       u.filter(n => (NCFG[n.type]?.filter ?? 'system') === 'films').length,
      connections: u.filter(n => (NCFG[n.type]?.filter ?? 'system') === 'connections').length,
      system:      u.filter(n => (NCFG[n.type]?.filter ?? 'system') === 'system').length,
    };
  }, [notifs]);

  const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <SafeAreaView style={{ flex:1 }} edges={['top']}>

        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={20} color={C.white}/>
          </TouchableOpacity>

          <View style={{ flex:1 }}>
            <Text style={s.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={s.sub}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
            )}
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity style={s.readAllBtn} onPress={handleMarkAllRead} activeOpacity={0.80}>
              <Ionicons name="checkmark-done-outline" size={13} color={C.mid}/>
              <Text style={s.readAllTxt}>Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* FILTERS */}
        <FilterTabs active={filter} counts={filterCounts} onChange={setFilter}/>

        {/* HINT long-press */}
        {notifs.length > 0 && !loading && (
          <Text style={s.hint}>Maintenez pour supprimer une notification</Text>
        )}

        {/* CONTENT */}
        {loading ? (
          <NotifSkeleton/>
        ) : sections.length === 0 ? (
          <EmptyState filter={filter}/>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={C.mid}
              />
            }
            renderSectionHeader={({ section }) => <SectionHead title={section.title}/>}
            renderItem={({ item }) => (
              <NotifCard
                notif={item}
                isNew={newIds.has(item.id)}
                onPress={handlePress}
                onDelete={handleDelete}
              />
            )}
            SectionSeparatorComponent={() => <View style={{ height: 2 }}/>}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:C.bg },
  header:     { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:EDGE, paddingTop:8, paddingBottom:14 },
  backBtn:    { width:38, height:38, borderRadius:19, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },
  title:      { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.4 },
  sub:        { color:C.muted, fontSize:11, marginTop:1 },
  readAllBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint },
  readAllTxt: { color:C.mid, fontSize:11, fontWeight:'600' },
  hint:       { color:C.muted, fontSize:10, textAlign:'center', paddingBottom:6 },
});