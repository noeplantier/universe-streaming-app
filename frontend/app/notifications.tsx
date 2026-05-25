/**
 * app/notifications.tsx — UNIVERSE · FIX COMPLET
 *
 * Bugs corrigés :
 *  ✅ SectionList → FlatList + headers inline (plus de déformation au switch filtre)
 *  ✅ Animated.Value stabilisée via useRef initialisé une seule fois (no re-init)
 *  ✅ DELETE SQL sur toutes les suppressions (une, plusieurs, toutes)
 *  ✅ Realtime : canal unique par uid, cleanup garanti
 *  ✅ Auth : getSession() uniquement, UUID validé
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, FlatList, Platform,
  RefreshControl, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Image }       from 'expo-image';
import { Ionicons }    from '@expo/vector-icons';
import { useRouter }   from 'expo-router';
import { SafeAreaView }from 'react-native-safe-area-context';
import { StatusBar }   from 'expo-status-bar';
import * as Haptics    from 'expo-haptics';
import { supabase }    from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
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
  error:    '#EF4444',
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

// Item FlatList : header de section ou notification
type ListItem =
  | { kind: 'header'; label: string }
  | { kind: 'notif';  notif: Notif  };

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
interface NCfg {
  icon:   keyof typeof Ionicons.glyphMap;
  filter: FilterKey;
  label:  string;
  route:  (d: Record<string, any>) => string | null;
}

const NCFG: Record<string, NCfg> = {
  like:                { icon:'heart-outline',             filter:'films',       label:"J'aime",         route: d => d.post_id     ? '/(tabs)/social' : null },
  critique_like:       { icon:'star-outline',              filter:'films',       label:'Critique aimée', route: d => d.critique_id ? `/review/${d.critique_id}` : null },
  comment:             { icon:'chatbubble-outline',         filter:'films',       label:'Commentaire',    route: d => d.critique_id ? `/review/${d.critique_id}` : '/(tabs)/social' },
  follow:              { icon:'person-outline',             filter:'connections', label:'Profil consulté',route: d => d.actor_id    ? `/user/${d.actor_id}` : null },
  connection_request:  { icon:'link-outline',               filter:'connections', label:'Connexion pro',  route: _ => '/(tabs)/social' },
  connection_accepted: { icon:'checkmark-circle-outline',   filter:'connections', label:'Connexion pro',  route: _ => '/(tabs)/social' },
  reel_submitted:      { icon:'cloud-upload-outline',       filter:'system',      label:'Soumis',         route: _ => '/profile' },
  reel_approved:       { icon:'checkmark-circle-outline',   filter:'system',      label:'Reel validé',    route: d => d.reel_id ? `/reel/${d.reel_id}` : '/profile' },
  reel_rejected:       { icon:'close-circle-outline',       filter:'system',      label:'Reel rejeté',    route: _ => '/profile' },
  new_film:            { icon:'film-outline',               filter:'films',       label:'Nouveau film',   route: d => d.film_id ? `/film/${d.film_id}` : null },
  mention:             { icon:'at-outline',                 filter:'films',       label:'Mention',        route: _ => '/(tabs)/social' },
  seen_film:           { icon:'eye-outline',                filter:'films',       label:'Visionnage',     route: d => d.film_id ? `/film/${d.film_id}` : null },
  system:              { icon:'information-circle-outline', filter:'system',      label:'Système',        route: _ => null },
};

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key:'all',         label:'Tout',       icon:'apps-outline'     },
  { key:'unread',      label:'Non lus',    icon:'ellipse-outline'  },
  { key:'films',       label:'Films',      icon:'film-outline'     },
  { key:'connections', label:'Connexions', icon:'people-outline'   },
  { key:'system',      label:'Système',    icon:'settings-outline' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS + HELPERS
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

// Construit les items FlatList avec headers de sections
function buildListItems(notifs: Notif[]): ListItem[] {
  const now     = new Date();
  const today   = now.toDateString();
  const yest    = new Date(now); yest.setDate(yest.getDate() - 1);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: [string, Notif[]][] = [
    ['Aujourd\'hui', []],
    ['Hier',         []],
    ['Cette semaine',[]],
    ['Plus tôt',     []],
  ];

  notifs.forEach(n => {
    const d = new Date(n.created_at);
    if (d.toDateString() === today)            groups[0][1].push(n);
    else if (d.toDateString() === yest.toDateString()) groups[1][1].push(n);
    else if (d > weekAgo)                      groups[2][1].push(n);
    else                                       groups[3][1].push(n);
  });

  const items: ListItem[] = [];
  groups.forEach(([label, ns]) => {
    if (!ns.length) return;
    items.push({ kind:'header', label });
    ns.forEach(n => items.push({ kind:'notif', notif: n }));
  });
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB — toutes les suppressions utilisent DELETE, pas UPDATE
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
  // Marque comme lu SANS supprimer
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

/** ★ DELETE une seule notification */
async function dbDeleteOne(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error && __DEV__) console.warn('[notifs] deleteOne:', error.message);
}

/** ★ DELETE toutes les notifications d'un utilisateur */
async function dbDeleteAll(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
  if (error && __DEV__) console.warn('[notifs] deleteAll:', error.message);
}

/** ★ DELETE toutes les notifications lues */
async function dbDeleteRead(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications')
    .delete().eq('user_id', userId).eq('read', true);
  if (error && __DEV__) console.warn('[notifs] deleteRead:', error.message);
}

/** Marque toutes les notifications comme lues (UPDATE, sans supprimer) */
async function dbMarkAllRead(userId: string): Promise<void> {
  await supabase.from('notifications')
    .update({ read: true }).eq('user_id', userId).eq('read', false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r=6 }: { w:number|string; h:number; r?:number }) {
  const op = useRef(new Animated.Value(0.14)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue:0.36, duration:800, useNativeDriver:true }),
      Animated.timing(op, { toValue:0.14, duration:800, useNativeDriver:true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [op]);
  return <Animated.View style={{ width:w as any, height:h, borderRadius:r, backgroundColor:C.navyMid, opacity:op }}/>;
});

const Skeleton = memo(function Skeleton() {
  return (
    <View>
      {[0,1,2,3,4,5].map(i => (
        <View key={i} style={sk.row}>
          <Shimmer w={44} h={44} r={22}/>
          <View style={{flex:1, gap:9}}>
            <Shimmer w="64%" h={12}/>
            <Shimmer w="40%" h={10}/>
          </View>
          <Shimmer w={26} h={9} r={4}/>
        </View>
      ))}
    </View>
  );
});
const sk = StyleSheet.create({
  row:{ flexDirection:'row', alignItems:'center', gap:13, paddingHorizontal:EDGE, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS — FlatList horizontal stable
// ─────────────────────────────────────────────────────────────────────────────
const FilterTabs = memo(function FilterTabs({
  active, counts, onChange,
}: { active:FilterKey; counts:Partial<Record<FilterKey,number>>; onChange:(k:FilterKey)=>void }) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={FILTERS}
      keyExtractor={f => f.key}
      contentContainerStyle={{ paddingHorizontal:EDGE, gap:8, paddingBottom:10, alignItems:'center' }}
      renderItem={({ item:f }) => {
        const on  = active === f.key;
        const cnt = counts[f.key] ?? 0;
        return (
          <TouchableOpacity
            style={[ft.chip, on && ft.chipOn]}
            onPress={() => onChange(f.key)}
            activeOpacity={0.80}
          >
            <Ionicons name={f.icon} size={11} color={on ? C.white : C.muted}/>
            <Text style={[ft.lbl, on && ft.lblOn]}>{f.label}</Text>
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
  chip:     { flexDirection:'row', alignItems:'center', alignSelf:'flex-start', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint },
  chipOn:   { backgroundColor:C.subtle, borderColor:C.borderHi },
  lbl:      { color:C.muted, fontSize:12, fontWeight:'600' },
  lblOn:    { color:C.white, fontWeight:'700' },
  badge:    { paddingHorizontal:5, paddingVertical:1, borderRadius:8, backgroundColor:C.border, minWidth:18, alignItems:'center' },
  badgeOn:  { backgroundColor:C.subtle },
  badgeTxt: { color:C.muted, fontSize:9, fontWeight:'800' },
  badgeTxtOn:{ color:C.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER (inline dans FlatList)
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = memo(function SectionHeader({ label }: { label: string }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.txt}>{label}</Text>
      <View style={sh.line}/>
    </View>
  );
});
const sh = StyleSheet.create({
  wrap:{ flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:EDGE, paddingTop:20, paddingBottom:8 },
  txt: { color:C.muted, fontSize:10, fontWeight:'800', letterSpacing:1, textTransform:'uppercase' },
  line:{ flex:1, height:StyleSheet.hairlineWidth, backgroundColor:C.border },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ NOTIF CARD — animation stabilisée (Animated.Value jamais recréée)
//
//   Le bug de déformation venait de l'initialisation conditionnelle :
//     new Animated.Value(isNew ? W : 0)
//   → quand isNew changeait au re-render (switch filtre), la Value était
//     recréée avec une valeur différente, causant un saut visuel.
//
//   Fix : slideX toujours initialisée à 0.
//   L'animation slide-in est déclenchée via un useEffect sur `isNew` stable.
// ─────────────────────────────────────────────────────────────────────────────
const NotifCard = memo(function NotifCard({
  notif, isNew, onPress, onDelete,
}: {
  notif:    Notif;
  isNew:    boolean;
  onPress:  (n: Notif) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = NCFG[notif.type] ?? NCFG.system;

  // ★ FIXED : initialisées à 0, jamais recréées
  const slideX  = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const didInit = useRef(false);

  // Slide-in uniquement pour les vraiment nouvelles notifs (realtime)
  useEffect(() => {
    if (!isNew || didInit.current) return;
    didInit.current = true;
    slideX.setValue(300); // démarre hors-écran droite
    Animated.spring(slideX, {
      toValue: 0, tension:80, friction:11, useNativeDriver:true,
    }).start();
  }, [isNew, slideX]);

  const handleDelete = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideX,  { toValue:-300, duration:240, useNativeDriver:true }),
      Animated.timing(opacity, { toValue:0,    duration:240, useNativeDriver:true }),
    ]).start(() => onDelete(notif.id));
  }, [notif.id, onDelete, slideX, opacity]);

  const avatarUri = notif.data?.avatar_url as string | undefined;

  return (
    <Animated.View style={{ transform:[{translateX:slideX}], opacity }}>
      <TouchableOpacity
        style={[nc.card, !notif.read && nc.cardUnread]}
        onPress={() => onPress(notif)}
        onLongPress={handleDelete}
        activeOpacity={0.85}
        delayLongPress={500}
      >
        {!notif.read && <View style={nc.dot}/>}

        {/* Icône */}
        <View style={nc.iconWrap}>
          {avatarUri ? (
            <View style={nc.avatarWrap}>
              <Image source={{ uri:avatarUri }} style={nc.avatar} contentFit="cover"/>
              <View style={nc.pin}>
                <Ionicons name={cfg.icon} size={8} color={C.white}/>
              </View>
            </View>
          ) : (
            <View style={nc.iconCircle}>
              <Ionicons name={cfg.icon} size={20} color={C.mid}/>
            </View>
          )}
        </View>

        {/* Texte */}
        <View style={nc.body}>
          <View style={nc.titleRow}>
            <Text style={nc.title} numberOfLines={1}>{notif.title}</Text>
            <Text style={nc.time}>{relTime(notif.created_at)}</Text>
          </View>
          <Text style={nc.bodyTxt} numberOfLines={2}>{notif.body}</Text>
          <View style={nc.chip}><Text style={nc.chipTxt}>{cfg.label}</Text></View>
        </View>

        <Ionicons name="chevron-forward" size={13} color={C.border} style={{alignSelf:'center'}}/>
      </TouchableOpacity>
    </Animated.View>
  );
},
// Memo comparateur : re-render uniquement si les données changent
(prev, next) =>
  prev.notif.id    === next.notif.id    &&
  prev.notif.read  === next.notif.read  &&
  prev.isNew       === next.isNew
);

const nc = StyleSheet.create({
  card:      { flexDirection:'row', alignItems:'center', gap:13, paddingHorizontal:EDGE, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  cardUnread:{ backgroundColor:'rgba(255,255,255,0.03)' },
  dot:       { position:'absolute', left:6, top:'50%', marginTop:-4, width:8, height:8, borderRadius:4, backgroundColor:C.white },
  iconWrap:  { flexShrink:0 },
  iconCircle:{ width:46, height:46, borderRadius:23, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  avatarWrap:{ position:'relative', width:46, height:46 },
  avatar:    { width:46, height:46, borderRadius:23, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  pin:       { position:'absolute', bottom:-2, right:-2, width:17, height:17, borderRadius:9, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  body:      { flex:1, gap:3 },
  titleRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', gap:8 },
  title:     { color:C.white, fontSize:13, fontWeight:'700', flex:1 },
  time:      { color:C.muted, fontSize:10, flexShrink:0, marginTop:1 },
  bodyTxt:   { color:C.muted, fontSize:12, lineHeight:17 },
  chip:      { alignSelf:'flex-start', paddingHorizontal:7, paddingVertical:2, borderRadius:7, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, marginTop:2 },
  chipTxt:   { color:C.muted, fontSize:9, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(function EmptyState({ filter }: { filter: FilterKey }) {
  const m: Record<FilterKey, { icon:keyof typeof Ionicons.glyphMap; text:string; sub:string }> = {
    all:         { icon:'notifications-off-outline',    text:'Aucune notification',        sub:'Vos interactions apparaîtront ici'      },
    unread:      { icon:'checkmark-done-circle-outline',text:'Tout est lu',                sub:'Vous êtes à jour'                       },
    films:       { icon:'film-outline',                 text:'Aucune activité films',      sub:'Likes, mentions et vues arrivent ici'   },
    connections: { icon:'people-outline',               text:'Aucune connexion pro',       sub:'Demandes et confirmations arrivent ici' },
    system:      { icon:'settings-outline',             text:'Aucune notification système',sub:'Statuts de modération et mises à jour'  },
  };
  const c = m[filter];
  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}>
        <Ionicons name={c.icon} size={38} color={C.muted}/>
      </View>
      <Text style={em.text}>{c.text}</Text>
      <Text style={em.sub}>{c.sub}</Text>
    </View>
  );
});
const em = StyleSheet.create({
  wrap:    { paddingTop:80, alignItems:'center', gap:10 },
  iconWrap:{ width:76, height:76, borderRadius:38, borderWidth:1, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center', marginBottom:4 },
  text:    { color:C.offWhite, fontSize:16, fontWeight:'700' },
  sub:     { color:C.muted, fontSize:13, textAlign:'center', paddingHorizontal:32, lineHeight:19 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ SCREEN ★★★
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();

  const [uid,        setUid]        = useState<string | null>(null);
  const [notifs,     setNotifs]     = useState<Notif[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<FilterKey>('all');
  const [newIds,     setNewIds]     = useState<Set<string>>(new Set());

  // ── Auth — UUID-safe ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!mounted) return;
      const id = session?.user?.id;
      if (id && isUUID(id)) setUid(id);
    });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (!mounted) return;
      const id = s?.user?.id;
      setUid(id && isUUID(id) ? id : null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async (showLoading = true) => {
    if (!uid) { setLoading(false); setRefreshing(false); return; }
    if (showLoading) setLoading(true);
    const data = await dbFetch(uid);
    setNotifs(data);
    setLoading(false);
    setRefreshing(false);
  }, [uid]);

  useEffect(() => { if (uid) load(); }, [uid, load]);

  // ── ★ REALTIME — canal unique, cleanup garanti ────────────────────────────
  useEffect(() => {
    if (!uid) return;

    // Nom unique par uid → pas de doublons si le composant se remonte
    const chName = `notifs_${uid}`;
    const ch = supabase
      .channel(chName)
      .on('postgres_changes',
        { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        ({ new:row }) => {
          const n = row as Notif;
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
          }
          setNotifs(prev => [n, ...prev.filter(x => x.id !== n.id)]);
          setNewIds(prev => new Set([...prev, n.id]));
          setTimeout(() => setNewIds(prev => {
            const s = new Set(prev); s.delete(n.id); return s;
          }), 1400);
        })
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        ({ new:row }) => {
          const n = row as Notif;
          setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, ...n } : x));
        })
      .on('postgres_changes',
        { event:'DELETE', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        ({ old:row }) => {
          const id = (row as any).id;
          if (id) setNotifs(prev => prev.filter(x => x.id !== id));
        })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [uid]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────

  /** Tap : marque comme lu + navigation */
  const handlePress = useCallback(async (notif: Notif) => {
    if (!notif.read) {
      // Optimistic
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read:true } : n));
      dbMarkRead(notif.id).catch(()=>{});
    }
    const cfg   = NCFG[notif.type] ?? NCFG.system;
    const route = cfg.route(notif.data ?? {});
    if (route) router.push(route as any);
  }, [router]);

  /** Long-press : ★ DELETE SQL une notification */
  const handleDelete = useCallback((id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    dbDeleteOne(id).catch(()=>{});
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    }
  }, []);

  /** ★ Tout lire — marque toutes comme lues (UPDATE, conserve les entrées) */
  const handleMarkAllRead = useCallback(() => {
    if (!uid || !notifs.some(n => !n.read)) return;
    setNotifs(prev => prev.map(n => ({ ...n, read:true })));
    dbMarkAllRead(uid).catch(()=>{});
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
  }, [uid, notifs]);

  /** ★ Supprimer tout — DELETE SQL toutes les notifications */
  const handleDeleteAll = useCallback(() => {
    if (!uid || !notifs.length) return;
    setNotifs([]);
    dbDeleteAll(uid).catch(()=>{});
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
  }, [uid, notifs.length]);

  /** ★ Supprimer les lues — DELETE SQL uniquement les read=true */
  const handleDeleteRead = useCallback(() => {
    if (!uid) return;
    setNotifs(prev => prev.filter(n => !n.read));
    dbDeleteRead(uid).catch(()=>{});
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
  }, [uid]);

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'all')    return notifs;
    if (filter === 'unread') return notifs.filter(n => !n.read);
    return notifs.filter(n => (NCFG[n.type]?.filter ?? 'system') === filter);
  }, [notifs, filter]);

  // ★ FlatList items stables — recalculés uniquement quand filtered change
  const listItems = useMemo<ListItem[]>(() => buildListItems(filtered), [filtered]);

  const filterCounts = useMemo<Partial<Record<FilterKey,number>>>(() => {
    const u = notifs.filter(n => !n.read);
    return {
      unread:      u.length,
      films:       u.filter(n => (NCFG[n.type]?.filter ?? 'system') === 'films').length,
      connections: u.filter(n => (NCFG[n.type]?.filter ?? 'system') === 'connections').length,
      system:      u.filter(n => (NCFG[n.type]?.filter ?? 'system') === 'system').length,
    };
  }, [notifs]);

  const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);
  const readCount   = useMemo(() => notifs.filter(n => n.read).length,  [notifs]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <SafeAreaView style={{flex:1, justifyContent:'flex-start'}} edges={['top']}>

        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={20} color={C.white}/>
          </TouchableOpacity>

          <View style={{flex:1}}>
            <Text style={s.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={s.sub}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
            )}
          </View>

          {/* Boutons d'action */}
          <View style={s.headerActions}>
            {/* Tout lire */}
            {unreadCount > 0 && (
              <TouchableOpacity style={s.actionBtn} onPress={handleMarkAllRead} activeOpacity={0.80}>
                <Ionicons name="checkmark-done-outline" size={13} color={C.mid}/>
                <Text style={s.actionTxt}>Tout lire</Text>
              </TouchableOpacity>
            )}
            {/* Supprimer les lues */}
            {readCount > 0 && (
              <TouchableOpacity style={s.actionBtn} onPress={handleDeleteRead} activeOpacity={0.80}>
                <Ionicons name="trash-outline" size={13} color={C.muted}/>
                <Text style={s.actionTxt}>Lues</Text>
              </TouchableOpacity>
            )}
            {/* Supprimer tout */}
            {notifs.length > 0 && (
              <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={handleDeleteAll} activeOpacity={0.80}>
                <Ionicons name="trash" size={13} color={C.error}/>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* FILTRES + hint — View non-flex pour bloquer l'étirement vertical */}
        <View style={{ flexShrink:0 }}>
          <FilterTabs active={filter} counts={filterCounts} onChange={setFilter}/>
          {!loading && notifs.length > 0 && (
            <Text style={s.hint}>Maintenez appuyé pour supprimer</Text>
          )}
        </View>

        {/* LISTE — FlatList stable (pas de SectionList) */}
        {loading ? (
          <Skeleton/>
        ) : listItems.length === 0 ? (
          <EmptyState filter={filter}/>
        ) : (
          <FlatList
            data={listItems}
            // ★ clé stable : basée sur le contenu, jamais sur l'index
            keyExtractor={item =>
              item.kind === 'header' ? `h_${item.label}` : `n_${item.notif.id}`
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}      // évite les glitches layout
            contentContainerStyle={{ paddingBottom:100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(false); }}
                tintColor={C.mid}
              />
            }
            renderItem={({ item }) => {
              if (item.kind === 'header') {
                return <SectionHeader label={item.label}/>;
              }
              return (
                <NotifCard
                  notif={item.notif}
                  isNew={newIds.has(item.notif.id)}
                  onPress={handlePress}
                  onDelete={handleDelete}
                />
              );
            }}
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
  root:          { flex:1, backgroundColor:C.bg },
  header:        { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:EDGE, paddingTop:8, paddingBottom:14 },
  backBtn:       { width:38, height:38, borderRadius:19, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },
  title:         { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.4 },
  sub:           { color:C.muted, fontSize:11, marginTop:1 },
  headerActions: { flexDirection:'row', alignItems:'center', gap:6 },
  actionBtn:     { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingVertical:6, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint },
  actionBtnDanger:{ borderColor:'rgba(239,68,68,0.30)', backgroundColor:'rgba(239,68,68,0.08)' },
  actionTxt:     { color:C.mid, fontSize:11, fontWeight:'600' },
  hint:          { color:C.muted, fontSize:10, textAlign:'center', paddingBottom:6 },
});