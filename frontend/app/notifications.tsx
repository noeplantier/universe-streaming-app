/**
 * app/notifications.tsx
 *
 * Centre de notifications Universe — Cinéma Indépendant
 *
 *  REALTIME  : INSERT live via Supabase channel (user_id filter)
 *              → nouvelle notification = haptic + slide-in animé
 *  GROUPEMENT: Aujourd'hui / Hier / Cette semaine / Plus tôt
 *  FILTRES   : Tout · Non lus · Films & Critiques · Connexions · Système
 *  NAVIGATION: chaque type redirige vers la bonne page (social/profile/review/film)
 *  ACTIONS   : marquer lu (tap) · tout marquer lu · supprimer (swipe)
 *  DONNÉES   : public.notifications dynamique (Supabase)
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, FlatList, Pressable, RefreshControl,
  SectionList, StyleSheet, Text, TouchableOpacity, View,
  Platform, Dimensions,
} from 'react-native';
import { Image }         from 'expo-image';
import { BlurView }      from 'expo-blur';
import { LinearGradient }from 'expo-linear-gradient';
import { Ionicons }      from '@expo/vector-icons';
import { useRouter }     from 'expo-router';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import * as Haptics      from 'expo-haptics';
import { supabase }      from '@/lib/supabase';
import { useAuth }       from '../contexts/AuthContext';
import GalaxyBackground  from '@/components/social/GalaxyBackground';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#03000A',
  surface:  'rgba(255,255,255,0.05)',
  surfMd:   'rgba(255,255,255,0.08)',
  border:   'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.16)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  muted:    'rgba(255,255,255,0.42)',
  faint:    'rgba(255,255,255,0.12)',
  // Accents notification (cohérents avec social.tsx et profile.tsx)
  red:      '#FF3B5C',
  gold:     '#F5C842',
  green:    '#22C55E',
  blue:     '#5A96E6',
  violet:   '#8B5CF6',
  orange:   '#F97316',
  teal:     '#14B8A6',
  gray:     '#6B7280',
} as const;

const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type NotifType =
  | 'like'               // quelqu'un a aimé un post community
  | 'critique_like'      // quelqu'un a aimé une critique
  | 'comment'            // commentaire sur une critique
  | 'follow'             // nouvel abonné
  | 'connection_request' // demande de connexion pro
  | 'connection_accepted'// connexion pro acceptée
  | 'reel_approved'      // reel validé par modération
  | 'reel_rejected'      // reel rejeté par modération
  | 'new_film'           // nouveau film ajouté au catalogue
  | 'mention'            // mention dans une critique/post
  | 'seen_film'          // quelqu'un a marqué votre film comme vu
  | 'system';            // notification système

interface Notif {
  id:         string;
  user_id:    string;
  type:       NotifType;
  title:      string;
  body:       string;
  data:       Record<string,any> | null;
  read:       boolean;
  created_at: string;
  // Enrichi côté client depuis data.avatar_url
  avatar?:    string;
}

type FilterKey = 'all' | 'unread' | 'films' | 'connections' | 'system';

interface Section { title: string; data: Notif[] }

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TYPES — icône, couleur, navigation
// ─────────────────────────────────────────────────────────────────────────────
const NOTIF_CFG: Record<NotifType, {
  icon:    string;
  color:   string;
  filter:  FilterKey;
  label:   string;
}> = {
  like:                { icon:'heart',                 color:C.red,    filter:'films',       label:'J\'aime'          },
  critique_like:       { icon:'star',                  color:C.gold,   filter:'films',       label:'Critique aimée'   },
  comment:             { icon:'chatbubble',             color:C.blue,   filter:'films',       label:'Commentaire'      },
  follow:              { icon:'person-add',             color:C.violet, filter:'connections', label:'Abonnement'       },
  connection_request:  { icon:'link',                  color:C.violet, filter:'connections', label:'Connexion pro'    },
  connection_accepted: { icon:'checkmark-circle',      color:C.green,  filter:'connections', label:'Connexion pro'    },
  reel_approved:       { icon:'checkmark-circle',      color:C.green,  filter:'system',      label:'Reel validé'      },
  reel_rejected:       { icon:'close-circle',          color:C.red,    filter:'system',      label:'Reel rejeté'      },
  new_film:            { icon:'film',                  color:C.teal,   filter:'films',       label:'Nouveau film'     },
  mention:             { icon:'at',                    color:C.orange, filter:'films',       label:'Mention'          },
  seen_film:           { icon:'eye',                   color:C.blue,   filter:'films',       label:'Visionnage'       },
  system:              { icon:'information-circle',    color:C.gray,   filter:'system',      label:'Système'          },
};

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key:'all',         label:'Tout',          icon:'apps-outline'           },
  { key:'unread',      label:'Non lus',       icon:'ellipse-outline'        },
  { key:'films',       label:'Films',         icon:'film-outline'           },
  { key:'connections', label:'Connexions',    icon:'people-outline'         },
  { key:'system',      label:'Système',       icon:'settings-outline'       },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return 'À l\'instant';
  if (s < 3600)  return `Il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `Il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800)return 'Hier';
  if (s < 604800)return `Il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
}

function groupByDate(notifs: Notif[]): Section[] {
  const now      = new Date();
  const todayStr = now.toDateString();
  const yest     = new Date(now); yest.setDate(yest.getDate()-1);
  const yestStr  = yest.toDateString();
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate()-7);

  const groups: Record<string, Notif[]> = {
    'Aujourd\'hui':   [],
    'Hier':           [],
    'Cette semaine':  [],
    'Plus tôt':       [],
  };

  notifs.forEach(n => {
    const d = new Date(n.created_at);
    if (d.toDateString() === todayStr)     groups['Aujourd\'hui'].push(n);
    else if (d.toDateString() === yestStr) groups['Hier'].push(n);
    else if (d > weekAgo)                  groups['Cette semaine'].push(n);
    else                                   groups['Plus tôt'].push(n);
  });

  return Object.entries(groups)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

function navigateFromNotif(router: ReturnType<typeof useRouter>, notif: Notif) {
  const d = notif.data ?? {};
  switch (notif.type) {
    case 'like':
    case 'comment':
    case 'mention':
      if (d.post_id)    return router.push(`/(tabs)/social` as any);
      break;
    case 'critique_like':
    case 'seen_film':
      if (d.critique_id) return router.push(`/review/${d.critique_id}` as any);
      break;
    case 'follow':
    case 'connection_request':
    case 'connection_accepted':
      return router.push(`/(tabs)/social` as any);
    case 'new_film':
      if (d.film_id) return router.push(`/film/${d.film_id}` as any);
      break;
    case 'reel_approved':
    case 'reel_rejected':
      return router.push('/profile' as any);
    default: break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────────────
async function dbFetchNotifs(userId: string): Promise<Notif[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,type,title,body,data,read,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) { console.warn('[notifs]', error.message); return []; }
  return ((data ?? []) as Notif[]).map(n => ({
    ...n,
    avatar: n.data?.avatar_url ?? null,
  }));
}

async function dbMarkRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

async function dbMarkAllRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true })
    .eq('user_id', userId).eq('read', false);
}

async function dbDelete(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 8 }: { w: number|string; h: number; r?: number }) {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.18, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ width:w, height:h, borderRadius:r, backgroundColor:'rgba(255,255,255,0.09)', opacity:op }}/>
  );
});

const NotifSkeleton = memo(function NotifSkeleton() {
  return (
    <View style={{ paddingTop: 16, gap: 1 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={sk.row}>
          <Shimmer w={44} h={44} r={22}/>
          <View style={{ flex:1, gap:8 }}>
            <Shimmer w="70%" h={13}/>
            <Shimmer w="45%" h={10}/>
          </View>
          <Shimmer w={30} h={10} r={5}/>
        </View>
      ))}
    </View>
  );
});
const sk = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:EDGE, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────
const FilterTabs = memo(function FilterTabs({
  active, counts, onChange,
}: { active: FilterKey; counts: Partial<Record<FilterKey,number>>; onChange: (k:FilterKey) => void }) {
  return (
    <View style={ft.wrap}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={f => f.key}
        contentContainerStyle={{ paddingHorizontal:EDGE, gap:8 }}
        renderItem={({ item: f }) => {
          const on  = active === f.key;
          const cnt = counts[f.key] ?? 0;
          return (
            <TouchableOpacity
              style={[ft.chip, on && ft.chipOn]}
              onPress={() => onChange(f.key)}
              activeOpacity={0.80}
            >
              <Ionicons name={f.icon as any} size={12} color={on ? C.white : C.muted}/>
              <Text style={[ft.label, on && ft.labelOn]}>{f.label}</Text>
              {cnt > 0 && (
                <View style={[ft.badge, on && ft.badgeOn]}>
                  <Text style={[ft.badgeTxt, on && ft.badgeTxtOn]}>{cnt}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
});
const ft = StyleSheet.create({
  wrap:       { marginBottom: 8 },
  chip:       { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.surface },
  chipOn:     { backgroundColor:'rgba(255,255,255,0.14)', borderColor:C.borderHi },
  label:      { color:C.muted, fontSize:12, fontWeight:'600' },
  labelOn:    { color:C.white, fontWeight:'700' },
  badge:      { paddingHorizontal:5, paddingVertical:1, borderRadius:8, backgroundColor:C.faint, minWidth:18, alignItems:'center' },
  badgeOn:    { backgroundColor:'rgba(255,255,255,0.22)' },
  badgeTxt:   { color:C.muted, fontSize:9, fontWeight:'800' },
  badgeTxtOn: { color:C.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// DATE SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionHead = memo(function SectionHead({ title }: { title: string }) {
  return (
    <View style={shead.wrap}>
      <Text style={shead.title}>{title}</Text>
      <View style={shead.line}/>
    </View>
  );
});
const shead = StyleSheet.create({
  wrap:  { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:EDGE, paddingTop:20, paddingBottom:8 },
  title: { color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase' },
  line:  { flex:1, height:StyleSheet.hairlineWidth, backgroundColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ NOTIF CARD — slide-in animé pour les nouvelles, swipe-delete
// ─────────────────────────────────────────────────────────────────────────────
interface NotifCardProps {
  notif:      Notif;
  isNew:      boolean;
  onPress:    (n: Notif) => void;
  onDelete:   (id: string) => void;
}

const NotifCard = memo(function NotifCard({ notif, isNew, onPress, onDelete }: NotifCardProps) {
  const cfg       = NOTIF_CFG[notif.type] ?? NOTIF_CFG.system;
  const slideX    = useRef(new Animated.Value(isNew ? W : 0)).current;
  const cardOp    = useRef(new Animated.Value(1)).current;
  const swipeX    = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);

  // Slide-in pour les nouvelles notifs
  useEffect(() => {
    if (!isNew) return;
    Animated.spring(slideX, { toValue:0, tension:80, friction:11, useNativeDriver:true }).start();
  }, [isNew]);

  const handleDelete = useCallback(() => {
    Animated.parallel([
      Animated.timing(swipeX,  { toValue:-W, duration:280, useNativeDriver:true }),
      Animated.timing(cardOp,  { toValue:0,  duration:280, useNativeDriver:true }),
    ]).start(() => onDelete(notif.id));
  }, [notif.id, onDelete, swipeX, cardOp]);

  const avatar = notif.data?.avatar_url ?? null;
  const timeStr = relTime(notif.created_at);

  return (
    <Animated.View style={[nc.wrap, {
      transform:[{ translateX: Animated.add(slideX, swipeX) }],
      opacity: cardOp,
    }]}>
      {/* Swipe hint (fond rouge visible en dessous) */}
      <View style={nc.swipeBg}>
        <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.70)"/>
        <Text style={nc.swipeTxt}>Supprimer</Text>
      </View>

      <TouchableOpacity
        style={[nc.card, !notif.read && nc.cardUnread]}
        onPress={() => onPress(notif)}
        onLongPress={handleDelete}
        activeOpacity={0.84}
        delayLongPress={500}
      >
        {/* Unread dot */}
        {!notif.read && <View style={nc.dot}/>}

        {/* Icône / Avatar */}
        <View style={nc.iconWrap}>
          {avatar ? (
            <View style={nc.avatarWrap}>
              <Image source={{ uri: avatar }} style={nc.avatar} contentFit="cover"/>
              <View style={[nc.typeIcon, { backgroundColor: `${cfg.color}22`, borderColor:`${cfg.color}50` }]}>
                <Ionicons name={cfg.icon as any} size={9} color={cfg.color}/>
              </View>
            </View>
          ) : (
            <View style={[nc.iconCircle, { backgroundColor: `${cfg.color}18`, borderColor:`${cfg.color}40` }]}>
              <Ionicons name={cfg.icon as any} size={20} color={cfg.color}/>
            </View>
          )}
        </View>

        {/* Contenu */}
        <View style={nc.content}>
          <View style={nc.titleRow}>
            <Text style={nc.title} numberOfLines={1}>{notif.title}</Text>
            <Text style={nc.time}>{timeStr}</Text>
          </View>
          <Text style={nc.body} numberOfLines={2}>{notif.body}</Text>

          {/* Type label chip */}
          <View style={nc.chipRow}>
            <View style={[nc.typeChip, { backgroundColor:`${cfg.color}14`, borderColor:`${cfg.color}35` }]}>
              <Text style={[nc.typeLabel, { color:cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.20)" style={{ alignSelf:'center' }}/>
      </TouchableOpacity>
    </Animated.View>
  );
});

const nc = StyleSheet.create({
  wrap:       { position:'relative', overflow:'hidden' },
  swipeBg:    { position:'absolute', right:0, top:0, bottom:0, width:90, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor:'rgba(239,68,68,0.25)' },
  swipeTxt:   { color:'rgba(255,255,255,0.70)', fontSize:11, fontWeight:'600' },
  card:       { flexDirection:'row', alignItems:'center', gap:13, paddingHorizontal:EDGE, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border, backgroundColor:'transparent' },
  cardUnread: { backgroundColor:'rgba(255,255,255,0.03)' },
  dot:        { position:'absolute', left:7, top:'50%', marginTop:-4, width:8, height:8, borderRadius:4, backgroundColor:'rgba(255,255,255,0.60)' },
  iconWrap:   { flexShrink:0 },
  iconCircle: { width:46, height:46, borderRadius:23, alignItems:'center', justifyContent:'center', borderWidth:1 },
  avatarWrap: { position:'relative', width:46, height:46 },
  avatar:     { width:46, height:46, borderRadius:23, borderWidth:1, borderColor:C.border },
  typeIcon:   { position:'absolute', bottom:-2, right:-2, width:18, height:18, borderRadius:9, alignItems:'center', justifyContent:'center', borderWidth:1 },
  content:    { flex:1, gap:3 },
  titleRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', gap:8 },
  title:      { color:C.white, fontSize:13, fontWeight:'700', flex:1 },
  time:       { color:C.muted, fontSize:10, flexShrink:0, marginTop:1 },
  body:       { color:'rgba(255,255,255,0.52)', fontSize:12, lineHeight:17 },
  chipRow:    { marginTop:4 },
  typeChip:   { alignSelf:'flex-start', paddingHorizontal:8, paddingVertical:2.5, borderRadius:8, borderWidth:StyleSheet.hairlineWidth },
  typeLabel:  { fontSize:9, fontWeight:'700', letterSpacing:0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(function EmptyState({ filter }: { filter: FilterKey }) {
  const msgs: Record<FilterKey, { icon: string; text: string; sub: string }> = {
    all:         { icon:'notifications-off-outline', text:'Aucune notification',         sub:'Vos interactions apparaîtront ici'      },
    unread:      { icon:'checkmark-done-circle-outline',text:'Tout est lu !',            sub:'Vous êtes à jour'                       },
    films:       { icon:'film-outline',              text:'Aucune activité sur vos films', sub:'Likes, critiques et mentions arrivent ici' },
    connections: { icon:'people-outline',            text:'Aucune connexion pro',        sub:'Demandes et confirmations arrivent ici' },
    system:      { icon:'settings-outline',          text:'Aucune notification système', sub:'Statuts de modération et mises à jour'  },
  };
  const m = msgs[filter];
  return (
    <View style={es.wrap}>
      <View style={es.iconWrap}>
        <Ionicons name={m.icon as any} size={42} color="rgba(255,255,255,0.20)"/>
      </View>
      <Text style={es.text}>{m.text}</Text>
      <Text style={es.sub}>{m.sub}</Text>
    </View>
  );
});
const es = StyleSheet.create({
  wrap:    { paddingTop:80, alignItems:'center', gap:10 },
  iconWrap:{ width:80, height:80, borderRadius:40, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, alignItems:'center', justifyContent:'center', marginBottom:4 },
  text:    { color:C.offWhite, fontSize:16, fontWeight:'700', textAlign:'center' },
  sub:     { color:C.muted, fontSize:13, textAlign:'center', paddingHorizontal:32, lineHeight:19 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router      = useRouter();
  const { user }    = useAuth();

  const [notifs,    setNotifs]    = useState<Notif[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [filter,    setFilter]    = useState<FilterKey>('all');
  const [newIds,    setNewIds]    = useState<Set<string>>(new Set());

  const isValidUUID = useCallback((id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id), []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const uid = user?.id;
    if (!uid || !isValidUUID(uid)) { setLoading(false); setRefreshing(false); return; }
    const data = await dbFetchNotifs(uid);
    setNotifs(data);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id, isValidUUID]);

  useEffect(() => { load(); }, [load]);

  // ── ★ REALTIME — nouvelles notifications live ──────────────────────────────
  useEffect(() => {
    const uid = user?.id;
    if (!uid || !isValidUUID(uid)) return;

    const ch = supabase
      .channel(`notifs_live_${uid}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${uid}`,
      }, ({ new: row }) => {
        const n = { ...(row as Notif), avatar: (row as any).data?.avatar_url ?? null };
        // Haptic + flag pour l'animation slide-in
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setNotifs(prev => [n, ...prev]);
        setNewIds(prev => new Set([...prev, n.id]));
        // Retire le flag après l'animation
        setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(n.id); return s; }), 1500);
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${uid}`,
      }, ({ new: row }) => {
        setNotifs(prev => prev.map(n => n.id === (row as any).id ? { ...n, ...(row as any) } : n));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id, isValidUUID]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handlePress = useCallback(async (notif: Notif) => {
    // Marquer comme lu
    if (!notif.read) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      dbMarkRead(notif.id).catch(() => {});
    }
    navigateFromNotif(router, notif);
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    dbDelete(id).catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    dbMarkAllRead(uid).catch(() => {});
  }, [user?.id]);

  // ── Filtrage + groupement ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'all')    return notifs;
    if (filter === 'unread') return notifs.filter(n => !n.read);
    return notifs.filter(n => (NOTIF_CFG[n.type]?.filter ?? 'system') === filter);
  }, [notifs, filter]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  // Compteurs par filtre (pour les badges)
  const filterCounts = useMemo<Partial<Record<FilterKey,number>>>(() => {
    const unread = notifs.filter(n => !n.read);
    return {
      unread:      unread.length,
      films:       unread.filter(n => NOTIF_CFG[n.type]?.filter === 'films').length,
      connections: unread.filter(n => NOTIF_CFG[n.type]?.filter === 'connections').length,
      system:      unread.filter(n => NOTIF_CFG[n.type]?.filter === 'system').length,
    };
  }, [notifs]);

  const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <SafeAreaView style={{ flex:1 }} edges={['top']}>

        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity style={s.navBtn} onPress={() => router.back()} activeOpacity={0.80}>
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
              <Ionicons name="checkmark-done-outline" size={14} color={C.muted}/>
              <Text style={s.readAllTxt}>Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* FILTER TABS */}
        <FilterTabs active={filter} counts={filterCounts} onChange={setFilter}/>

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
            contentContainerStyle={{ paddingBottom: 80 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor="rgba(255,255,255,0.40)"
              />
            }
            renderSectionHeader={({ section }) => (
              <SectionHead title={section.title}/>
            )}
            renderItem={({ item }) => (
              <NotifCard
                notif={item}
                isNew={newIds.has(item.id)}
                onPress={handlePress}
                onDelete={handleDelete}
              />
            )}
            // Léger séparateur de section
            SectionSeparatorComponent={() => <View style={{ height: 4 }}/>}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES GLOBAUX
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:C.bg },
  header:     { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:EDGE, paddingTop:8, paddingBottom:16 },
  navBtn:     { width:38, height:38, borderRadius:19, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.surface, alignItems:'center', justifyContent:'center' },
  title:      { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.4 },
  sub:        { color:C.muted, fontSize:11, marginTop:2 },
  readAllBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.surface },
  readAllTxt: { color:C.muted, fontSize:11, fontWeight:'600' },
});