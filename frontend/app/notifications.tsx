/**
 * app/notifications.tsx — UNIVERSE
 * ★ getDeviceId() — zéro supabase.auth.* → fonctionne sans session
 * ★ Realtime canal unique par montage (évite l'erreur .on() after subscribe)
 * ★ UX/UI enrichi : groupes temporels, filtres, animations slide
 *
 * ★ v2 :
 *   - "Tout lire" → DELETE persistant (public.notifications) + rollback erreur
 *   - Boutons trash supprimés, seul "Tout lire" reste dans le header
 *   - Indicateur point blanc supprimé sur les notifications non-lues
 *   - Fond non-lu accentué : rgba(255,255,255,0.025) → rgba(255,255,255,0.070)
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, FlatList, Image, Platform, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { BlurView }     from 'expo-blur';
import { Ionicons }     from '@expo/vector-icons';
import { useRouter }    from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import * as Haptics     from 'expo-haptics';
import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';
import { getDeviceId }  from '@/services/api';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.88)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.35)',
  subtle:'rgba(255,255,255,0.13)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.20)',
  gold:'#F5C842', blue:'#5A96E6', green:'#2ECC8A',
  error:'#EF4444', orange:'#F97316',
} as const;
const EDGE = 18;

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = 'like'|'critique_like'|'comment'|'follow'|'connection_request'|'connection_accepted'|'reel_submitted'|'reel_approved'|'reel_rejected'|'new_film'|'mention'|'seen_film'|'system';
interface Notif { id:string; user_id:string; type:NotifType; title:string; body:string; data:Record<string,any>|null; read:boolean; created_at:string }
type FilterKey = 'all'|'unread'|'films'|'connections'|'system';
type ListItem  = { kind:'header'; label:string } | { kind:'notif'; notif:Notif };

// ─── Config notifs ────────────────────────────────────────────────────────────
interface NCfg { icon:keyof typeof Ionicons.glyphMap; color:string; filter:FilterKey; label:string; route:(d:Record<string,any>)=>string|null }
const NCFG: Record<string,NCfg> = {
  like:               { icon:'heart',              color:C.error,  filter:'films',       label:"J'aime",         route:_=>'/(tabs)/social'              },
  critique_like:      { icon:'star',               color:C.gold,   filter:'films',       label:'Critique aimée', route:d=>d.critique_id?`/review/${d.critique_id}`:null },
  comment:            { icon:'chatbubble',          color:C.blue,   filter:'films',       label:'Commentaire',    route:d=>d.critique_id?`/review/${d.critique_id}`:null },
  follow:             { icon:'person-add',          color:C.green,  filter:'connections', label:'Nouveau follower',route:d=>d.actor_id?`/user/${d.actor_id}`:null },
  connection_request: { icon:'link',                color:C.blue,   filter:'connections', label:'Connexion pro',  route:_=>'/(tabs)/social'              },
  connection_accepted:{ icon:'checkmark-circle',    color:C.green,  filter:'connections', label:'Connexion pro',  route:_=>'/(tabs)/social'              },
  reel_submitted:     { icon:'cloud-upload',        color:C.mid,    filter:'system',      label:'Soumis',         route:_=>'/profile'                    },
  reel_approved:      { icon:'checkmark-circle',    color:C.green,  filter:'system',      label:'Reel validé',    route:d=>d.reel_id?`/reel/${d.reel_id}`:'/profile' },
  reel_rejected:      { icon:'close-circle',        color:C.error,  filter:'system',      label:'Reel rejeté',    route:_=>'/profile'                    },
  new_film:           { icon:'film',                color:C.blue,   filter:'films',       label:'Nouveau film',   route:d=>d.film_id?`/film/${d.film_id}`:null },
  mention:            { icon:'at-circle',           color:C.orange, filter:'films',       label:'Mention',        route:_=>'/(tabs)/social'              },
  seen_film:          { icon:'eye',                 color:C.mid,    filter:'films',       label:'Visionnage',     route:d=>d.film_id?`/film/${d.film_id}`:null },
  system:             { icon:'information-circle',  color:C.muted,  filter:'system',      label:'Système',        route:_=>null                          },
};
const FILTERS: { key:FilterKey; label:string; icon:keyof typeof Ionicons.glyphMap }[] = [
  { key:'all',         label:'Tout',        icon:'apps-outline'             },
  { key:'unread',      label:'Non lus',     icon:'ellipse-outline'          },
  { key:'films',       label:'Films',       icon:'film-outline'             },
  { key:'connections', label:'Connexions',  icon:'people-outline'           },
  { key:'system',      label:'Système',     icon:'settings-outline'         },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function relTime(iso:string):string {
  const s = (Date.now()-new Date(iso).getTime())/1000;
  if (s<60)     return "À l'instant";
  if (s<3600)   return `${Math.floor(s/60)} min`;
  if (s<86400)  return `${Math.floor(s/3600)} h`;
  if (s<172800) return 'Hier';
  return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}
function buildListItems(notifs:Notif[]):ListItem[] {
  const now=new Date(), today=now.toDateString();
  const yest=new Date(now); yest.setDate(yest.getDate()-1);
  const weekAgo=new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
  const groups:[string,Notif[]][] = [["Aujourd'hui",[]],['Hier',[]],['Cette semaine',[]],['Plus tôt',[]]];
  notifs.forEach(n=>{
    const d=new Date(n.created_at);
    if(d.toDateString()===today)               groups[0][1].push(n);
    else if(d.toDateString()===yest.toDateString()) groups[1][1].push(n);
    else if(d>weekAgo)                         groups[2][1].push(n);
    else                                        groups[3][1].push(n);
  });
  const items:ListItem[]=[];
  groups.forEach(([label,ns])=>{ if(!ns.length)return; items.push({kind:'header',label}); ns.forEach(n=>items.push({kind:'notif',notif:n})); });
  return items;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function dbFetch(uid:string):Promise<Notif[]> {
  const{data,error}=await supabase
    .from('notifications')
    .select('id,user_id,type,title,body,data,read,created_at')
    .eq('user_id',uid)
    .order('created_at',{ascending:false})
    .limit(100);
  if(error){ console.warn('[notifs] fetch:',error.message); return []; }
  return (data??[]) as Notif[];
}

// ★ Lecture d'une seule notification (presse unique)
const dbMarkRead = (id:string) =>
  supabase.from('notifications').update({read:true}).eq('id',id);

// ★ Suppression ciblée (long-press)
const dbDeleteOne = (id:string) =>
  supabase.from('notifications').delete().eq('id',id);

// ★ "Tout lire" = DELETE complet sur public.notifications pour cet utilisateur
async function dbDeleteAll(uid:string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', uid);
  if (error) throw new Error(error.message);
}

// ─── Micro UI ─────────────────────────────────────────────────────────────────
const Shimmer = memo(({w,h,r=6}:{w:number|string;h:number;r?:number})=>{
  const op=useRef(new Animated.Value(0.14)).current;
  useEffect(()=>{const l=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.34,duration:800,useNativeDriver:true}),Animated.timing(op,{toValue:0.14,duration:800,useNativeDriver:true})]));l.start();return()=>l.stop();},[op]);
  return <Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});

const Skeleton=memo(()=>(
  <View>
    {[0,1,2,3,4,5].map(i=>(
      <View key={i} style={{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:EDGE,paddingVertical:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>
        <Shimmer w={46} h={46} r={23}/>
        <View style={{flex:1,gap:9}}><Shimmer w="60%" h={12}/><Shimmer w="40%" h={10}/></View>
        <Shimmer w={28} h={9} r={4}/>
      </View>
    ))}
  </View>
));

const FilterTabs = memo(({active,counts,onChange}:{active:FilterKey;counts:Partial<Record<FilterKey,number>>;onChange:(k:FilterKey)=>void})=>(
  <FlatList
    horizontal showsHorizontalScrollIndicator={false}
    data={FILTERS} keyExtractor={f=>f.key}
    contentContainerStyle={{paddingHorizontal:EDGE,gap:8,paddingBottom:10,alignItems:'center'}}
    renderItem={({item:f})=>{
      const on=active===f.key; const cnt=counts[f.key]??0;
      return(
        <TouchableOpacity style={[ft.pill,on&&ft.pillOn]} onPress={()=>onChange(f.key)} activeOpacity={0.80}>
          <Ionicons name={f.icon} size={11} color={on?C.white:C.muted}/>
          <Text style={[ft.label,on&&{color:C.white}]}>{f.label}</Text>
          {cnt>0&&<View style={[ft.cnt,on&&ft.cntOn]}><Text style={[ft.cntTxt,on&&{color:C.white}]}>{cnt>99?'99+':cnt}</Text></View>}
        </TouchableOpacity>
      );
    }}
  />
));
const ft=StyleSheet.create({
  pill:   {flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:5,paddingHorizontal:12,paddingVertical:7,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
  pillOn: {backgroundColor:C.subtle,borderColor:C.borderHi},
  label:  {color:C.muted,fontSize:12,fontWeight:'600'},
  cnt:    {paddingHorizontal:5,paddingVertical:1,borderRadius:8,backgroundColor:C.border,minWidth:18,alignItems:'center'},
  cntOn:  {backgroundColor:C.subtle},
  cntTxt: {color:C.muted,fontSize:9,fontWeight:'800'},
});

const SectionHeader=memo(({label}:{label:string})=>(
  <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:EDGE,paddingTop:20,paddingBottom:8}}>
    <Text style={{color:C.muted,fontSize:9.5,fontWeight:'800',letterSpacing:1.2,textTransform:'uppercase'}}>{label}</Text>
    <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:C.border}}/>
  </View>
));

// ─── Notif Card ───────────────────────────────────────────────────────────────
const NotifCard = memo(function NotifCard({
  notif, isNew, onPress, onDelete,
}:{notif:Notif;isNew:boolean;onPress:(n:Notif)=>void;onDelete:(id:string)=>void}) {
  const cfg     = NCFG[notif.type] ?? NCFG.system;
  const slideX  = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const didInit = useRef(false);

  useEffect(()=>{
    if(!isNew||didInit.current)return;
    didInit.current=true;
    slideX.setValue(280);
    Animated.spring(slideX,{toValue:0,tension:80,friction:11,useNativeDriver:true}).start();
  },[isNew,slideX]);

  const handleDelete=useCallback(()=>{
    Animated.parallel([
      Animated.timing(slideX,{toValue:-300,duration:230,useNativeDriver:true}),
      Animated.timing(opacity,{toValue:0,duration:230,useNativeDriver:true}),
    ]).start(()=>onDelete(notif.id));
  },[notif.id,onDelete,slideX,opacity]);

  const avatarUri = notif.data?.avatar_url as string|undefined;

  return (
    <Animated.View style={{transform:[{translateX:slideX}],opacity}}>
      {/* ★ cardUnread : fond accentué (×2.8), sans point blanc */}
      <TouchableOpacity
        style={[nc.card, !notif.read && nc.cardUnread]}
        onPress={()=>onPress(notif)}
        onLongPress={handleDelete}
        activeOpacity={0.85}
        delayLongPress={500}
      >
        {/* Icône / avatar */}
        <View style={nc.iconWrap}>
          {avatarUri
            ? (<View style={nc.avatarWrap}>
                <Image source={{uri:avatarUri}} style={nc.avatar} resizeMode="cover"/>
                <View style={[nc.pin,{backgroundColor:C.navyMid}]}>
                  <Ionicons name={cfg.icon} size={8} color={cfg.color}/>
                </View>
               </View>)
            : (<View style={[nc.iconCircle,{borderColor:`${cfg.color}28`}]}>
                <Ionicons name={cfg.icon} size={20} color={cfg.color}/>
               </View>)
          }
        </View>
        {/* Contenu */}
        <View style={nc.body}>
          <View style={nc.titleRow}>
            <Text style={nc.title} numberOfLines={1}>{notif.title}</Text>
            <Text style={nc.time}>{relTime(notif.created_at)}</Text>
          </View>
          <Text style={[nc.bodyTxt, !notif.read && nc.bodyTxtUnread]} numberOfLines={2}>{notif.body}</Text>
          <View style={[nc.chip,{borderColor:`${cfg.color}22`,backgroundColor:`${cfg.color}0A`}]}>
            <Ionicons name={cfg.icon} size={8} color={cfg.color}/>
            <Text style={[nc.chipTxt,{color:cfg.color}]}>{cfg.label}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={13} color={C.border} style={{alignSelf:'center'}}/>
      </TouchableOpacity>
    </Animated.View>
  );
}, (p,n)=>p.notif.id===n.notif.id&&p.notif.read===n.notif.read&&p.isNew===n.isNew);

const nc=StyleSheet.create({
  card:         {flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:EDGE,paddingVertical:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border,position:'relative'},
  // ★ Fond accentué : 0.025 → 0.070 (×2.8) — plus de point blanc
  cardUnread:   {backgroundColor:'rgba(255,255,255,0.070)'},
  iconWrap:     {flexShrink:0},
  iconCircle:   {width:46,height:46,borderRadius:23,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,alignItems:'center',justifyContent:'center'},
  avatarWrap:   {position:'relative',width:46,height:46},
  avatar:       {width:46,height:46,borderRadius:23,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  pin:          {position:'absolute',bottom:-2,right:-2,width:17,height:17,borderRadius:9,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  body:         {flex:1,gap:3},
  titleRow:     {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:8},
  title:        {color:C.white,fontSize:13,fontWeight:'700',flex:1},
  time:         {color:C.muted,fontSize:10,flexShrink:0,marginTop:1},
  bodyTxt:      {color:C.muted,fontSize:12,lineHeight:17},
  // ★ Corps du message légèrement plus clair pour les non-lues
  bodyTxtUnread:{color:C.mid},
  chip:         {flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start',paddingHorizontal:7,paddingVertical:2,borderRadius:7,borderWidth:StyleSheet.hairlineWidth,marginTop:2},
  chipTxt:      {fontSize:9,fontWeight:'700'},
});

const EmptyState=memo(({filter}:{filter:FilterKey})=>{
  const m:Record<FilterKey,{icon:keyof typeof Ionicons.glyphMap;text:string;sub:string}> = {
    all:         {icon:'notifications-off-outline',   text:'Aucune notification',    sub:'Vos interactions apparaîtront ici'},
    unread:      {icon:'checkmark-done-circle-outline',text:'Tout est lu',           sub:'Vous êtes à jour'},
    films:       {icon:'film-outline',                text:'Aucune activité films',  sub:'Likes, mentions et vues arrivent ici'},
    connections: {icon:'people-outline',              text:'Aucune connexion pro',   sub:'Demandes et confirmations arrivent ici'},
    system:      {icon:'settings-outline',            text:'Aucune notif système',   sub:'Statuts de modération et mises à jour'},
  };
  const cfg=m[filter];
  return(
    <View style={{paddingTop:80,alignItems:'center',gap:12}}>
      <View style={{width:76,height:76,borderRadius:38,borderWidth:1,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',marginBottom:4}}>
        <Ionicons name={cfg.icon} size={36} color={C.muted}/>
      </View>
      <Text style={{color:C.offWhite,fontSize:16,fontWeight:'700'}}>{cfg.text}</Text>
      <Text style={{color:C.muted,fontSize:13,textAlign:'center',paddingHorizontal:32,lineHeight:19}}>{cfg.sub}</Text>
    </View>
  );
});

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router  = useRouter();
  const [uid,        setUid]        = useState<string|null>(null);
  const [notifs,     setNotifs]     = useState<Notif[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<FilterKey>('all');
  const [newIds,     setNewIds]     = useState<Set<string>>(new Set());
  const [deleting,   setDeleting]   = useState(false); // anti-double-tap

  const rtRef   = useRef<ReturnType<typeof supabase.channel>|null>(null);
  const mountId = useRef(Date.now());

  // ── Init device ID ────────────────────────────────────────────────────────
  useEffect(()=>{
    getDeviceId().then(setUid);
  },[]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async(showLoading=true)=>{
    const id = uid || await getDeviceId();
    if(!id){ setLoading(false); setRefreshing(false); return; }
    if(showLoading) setLoading(true);
    const data = await dbFetch(id);
    setNotifs(data);
    setLoading(false);
    setRefreshing(false);
  },[uid]);

  useEffect(()=>{ if(uid) load(); },[uid,load]);

  // ── Realtime — tous les .on() AVANT .subscribe() ──────────────────────────
  useEffect(()=>{
    if(!uid)return;
    if(rtRef.current){ supabase.removeChannel(rtRef.current); rtRef.current=null; }

    rtRef.current=supabase
      .channel(`notifs_${mountId.current}_${uid}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${uid}`},({new:row})=>{
        const n=row as Notif;
        if(Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
        setNotifs(prev=>[n,...prev.filter(x=>x.id!==n.id)]);
        setNewIds(prev=>new Set([...prev,n.id]));
        setTimeout(()=>setNewIds(prev=>{const s=new Set(prev);s.delete(n.id);return s;}),1400);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications',filter:`user_id=eq.${uid}`},({new:row})=>{
        const n=row as Notif;
        setNotifs(prev=>prev.map(x=>x.id===n.id?{...x,...n}:x));
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'notifications',filter:`user_id=eq.${uid}`},({old:row})=>{
        const id=(row as any).id;
        if(id) setNotifs(prev=>prev.filter(x=>x.id!==id));
      })
      .subscribe();

    return()=>{ if(rtRef.current){supabase.removeChannel(rtRef.current);rtRef.current=null;} };
  },[uid]);

  // ── ★ "Tout lire" = DELETE persistant sur public.notifications ─────────────
  // Optimistic : vide l'état local immédiatement.
  // Rollback : restaure l'état précédent si Supabase renvoie une erreur.
  const handleMarkAllRead = useCallback(async()=>{
    if(!uid||!notifs.length||deleting)return;
    setDeleting(true);
    const snapshot = notifs; // sauvegarde pour rollback
    setNotifs([]);            // optimistic clear
    try {
      await dbDeleteAll(uid);
    } catch(err) {
      console.warn('[notifs] deleteAll error:', err);
      setNotifs(snapshot);  // rollback en cas d'échec
    } finally {
      setDeleting(false);
    }
  },[uid,notifs,deleting]);

  // ── Presse sur une notification → marque lue + navigation ─────────────────
  const handlePress = useCallback(async(notif:Notif)=>{
    if(!notif.read){
      setNotifs(prev=>prev.map(n=>n.id===notif.id?{...n,read:true}:n));
      dbMarkRead(notif.id);
    }
    const cfg   = NCFG[notif.type] ?? NCFG.system;
    const route = cfg.route(notif.data??{});
    if(route) router.push(route as any);
  },[router]);

  // ── Long-press sur une notification → supprime (avec animation) ────────────
  const handleDelete = useCallback((id:string)=>{
    setNotifs(prev=>prev.filter(n=>n.id!==id));
    dbDeleteOne(id);
    if(Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
  },[]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(()=>{
    if(filter==='all')    return notifs;
    if(filter==='unread') return notifs.filter(n=>!n.read);
    return notifs.filter(n=>(NCFG[n.type]?.filter??'system')===filter);
  },[notifs,filter]);

  const listItems = useMemo<ListItem[]>(()=>buildListItems(filtered),[filtered]);

  const filterCounts = useMemo<Partial<Record<FilterKey,number>>>(()=>{
    const u = notifs.filter(n=>!n.read);
    return{
      unread:      u.length,
      films:       u.filter(n=>(NCFG[n.type]?.filter??'system')==='films').length,
      connections: u.filter(n=>(NCFG[n.type]?.filter??'system')==='connections').length,
      system:      u.filter(n=>(NCFG[n.type]?.filter??'system')==='system').length,
    };
  },[notifs]);

  const unreadCount = useMemo(()=>notifs.filter(n=>!n.read).length,[notifs]);

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={{flex:1}} edges={['top']}>

        {/* ── Header ── */}
        <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:EDGE,paddingTop:8,paddingBottom:14}}>
          <TouchableOpacity style={hd.backBtn} onPress={()=>router.back()} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={20} color={C.white}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={{color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4}}>Notifications</Text>
            {unreadCount>0&&<Text style={{color:C.muted,fontSize:11,marginTop:1}}>{unreadCount} non lue{unreadCount>1?'s':''}</Text>}
          </View>

          {/* ★ Un seul bouton : "Tout lire" = DELETE persistant */}
          {notifs.length>0&&(
            <TouchableOpacity
              style={[hd.actionBtn, deleting&&{opacity:0.5}]}
              onPress={handleMarkAllRead}
              activeOpacity={0.80}
              disabled={deleting}
            >
              <Ionicons name="checkmark-done-outline" size={13} color={C.mid}/>
              <Text style={hd.actionTxt}>Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filtres ── */}
        <View style={{flexShrink:0}}>
          <FilterTabs active={filter} counts={filterCounts} onChange={setFilter}/>
          {!loading&&notifs.length>0&&(
            <Text style={{color:C.muted,fontSize:9.5,textAlign:'center',paddingBottom:6,letterSpacing:0.2}}>
              Maintenez appuyé pour supprimer
            </Text>
          )}
        </View>

        {/* ── Liste ── */}
        {loading ? (
          <Skeleton/>
        ) : listItems.length===0 ? (
          <EmptyState filter={filter}/>
        ) : (
          <FlatList
            data={listItems}
            keyExtractor={item=>item.kind==='header'?`h_${item.label}`:`n_${item.notif.id}`}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={{paddingBottom:100}}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={()=>{setRefreshing(true);load(false);}}
                tintColor={C.mid}
              />
            }
            renderItem={({item})=>{
              if(item.kind==='header') return <SectionHeader label={item.label}/>;
              return(
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

// ─── Styles header ────────────────────────────────────────────────────────────
const hd=StyleSheet.create({
  backBtn:   {width:38,height:38,borderRadius:19,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'},
  actionBtn: {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:6,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
  actionTxt: {color:C.mid,fontSize:11,fontWeight:'600'},
});