/**
 * components/SideBar.tsx — UNIVERSE
 *
 * ★ Genres dynamiques depuis public.reels + public.works (merged)
 * ★ Nouveaux filtres cinéma indépendant :
 *   Format (Court/Moyen/Long-métrage), Ambiance, Découverte, Tri
 * ★ Sections collapsibles + badges de count
 * ★ Compteurs par genre depuis Supabase
 * ★ Backward-compatible (props existantes inchangées)
 */
import React, {
    memo, useCallback, useEffect, useRef, useState,
  } from 'react';
  import {
    Animated, ActivityIndicator, Platform, ScrollView,
    StyleSheet, Text, TouchableOpacity, View,
  } from 'react-native';
  import { Ionicons } from '@expo/vector-icons';
  import { supabase } from '@/lib/supabase';
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  export interface SideBarProps {
    visible:         boolean;
    liked:           boolean;
    muted:           boolean;
    saved:           boolean;
    onLike:          () => void;
    onMute:          () => void;
    onSave:          () => void;
    onInfo?:         () => void;
    onShare?:        () => void;
    activeGenre:     string | null;
    onGenreSelect:   (genre: string | null) => void;
    /** Format : 'court' | 'moyen' | 'long' | null */
    activeFormat?:   string | null;
    onFormatSelect?: (f: string | null) => void;
    /** Ambiance : string | null */
    activeAmbiance?: string | null;
    onAmbianceSelect?:(a: string | null) => void;
    /** Tri : 'tendances' | 'recent' | 'primé' | null */
    activeSort?:     string | null;
    onSortSelect?:   (s: string | null) => void;
    onInteract:      () => void;
  }
  
  // ─── PALETTE ──────────────────────────────────────────────────────────────────
  const P = {
    red:    '#FF3B5C',
    gold:   '#F5C842',
    blue:   '#5A96E6',
    green:  '#2ECC8A',
    purple: '#A78BFA',
    iconBg: 'rgba(0,0,0,0.42)',
    iconOn: 'rgba(255,255,255,0.16)',
    border: 'rgba(255,255,255,0.12)',
    muted:  'rgba(255,255,255,0.40)',
    labelColor:'rgba(255,255,255,0.26)',
  } as const;
  
  // ─── CINÉMA INDÉPENDANT — référentiels statiques ──────────────────────────────
  const GENRE_ICONS: Record<string,keyof typeof Ionicons.glyphMap> = {
    'Drame':          'sad-outline',
    'Thriller':       'eye-outline',
    'Science-Fiction':'planet-outline',
    'Documentaire':   'library-outline',
    'Animation':      'color-palette-outline',
    'Court-métrage':  'film-outline',
    'Expérimental':   'flask-outline',
    'Biopic':         'person-outline',
    'Horreur':        'skull-outline',
    'Comédie':        'happy-outline',
    'Romance':        'heart-outline',
    'Action':         'flash-outline',
    'Fantastique':    'sparkles-outline',
    'Policier':       'shield-outline',
    'Musical':        'musical-notes-outline',
    'Aventure':       'compass-outline',
    'Guerre':         'flag-outline',
    'Western':        'trail-sign-outline',
    'Essai':          'bulb-outline',
    'Réel':           'aperture-outline',
  };
  const GENRE_COLORS: Record<string,string> = {
    'Drame':'#A78BFA','Thriller':'#F87171','Science-Fiction':'#38BDF8',
    'Documentaire':'#34D399','Horreur':'#FB7185','Comédie':'#FDE68A',
    'Romance':'#F472B6','Action':'#FB923C','Fantastique':'#C084FC',
    'Expérimental':'#67E8F9','Essai':'#86EFAC','Musical':'#FCA5A5',
  };
  
  const FORMATS: { key:string; label:string; icon:keyof typeof Ionicons.glyphMap; sub:string }[] = [
    { key:'court',  label:'Court',  icon:'film-outline',   sub:'≤ 30 min'   },
    { key:'moyen',  label:'Moyen',  icon:'tv-outline',     sub:'30–70 min'  },
    { key:'long',   label:'Long',   icon:'videocam-outline',sub:'> 70 min'  },
    { key:'serie',  label:'Série',  icon:'layers-outline', sub:'Épisodes'   },
  ];
  
  const AMBIANCES: { key:string; label:string; icon:keyof typeof Ionicons.glyphMap; color:string }[] = [
    { key:'poetique',     label:'Poétique',     icon:'leaf-outline',             color:'#86EFAC' },
    { key:'sombre',       label:'Sombre',       icon:'moon-outline',             color:'#818CF8' },
    { key:'intense',      label:'Intense',      icon:'flash-outline',            color:'#FB923C' },
    { key:'contemplatif', label:'Contemplatif', icon:'time-outline',             color:'#67E8F9' },
    { key:'leger',        label:'Léger',        icon:'happy-outline',            color:'#FDE68A' },
    { key:'surrealiste',  label:'Surréaliste',  icon:'color-palette-outline',    color:'#F472B6' },
    { key:'lyrique',      label:'Lyrique',      icon:'musical-notes-outline',    color:'#A78BFA' },
    { key:'social',       label:'Social',       icon:'people-outline',           color:'#34D399' },
  ];
  
  const SORT_OPTIONS: { key:string; label:string; icon:keyof typeof Ionicons.glyphMap }[] = [
    { key:'tendances', label:'Tendances', icon:'trending-up-outline' },
    { key:'recent',    label:'Récents',   icon:'time-outline'        },
    { key:'popular',   label:'Populaires',icon:'heart-outline'       },
    { key:'prime',     label:'Primés',    icon:'trophy-outline'      },
  ];
  
  const DISCOVERY: { key:string; label:string; icon:keyof typeof Ionicons.glyphMap; color:string }[] = [
    { key:'surprise',   label:'Surprise',      icon:'shuffle-outline',       color:'#38BDF8' },
    { key:'coup',       label:'Coup de ♡',     icon:'heart-circle-outline',  color:'#F472B6' },
    { key:'universeOG', label:'Universe OG',   icon:'star-outline',          color:'#F5C842' },
    { key:'palmares',   label:'Palmarès',      icon:'ribbon-outline',        color:'#A78BFA' },
  ];
  
  // ─── HOOKS ────────────────────────────────────────────────────────────────────
  interface GenreWithCount { name:string; count:number }
  
  function useReelGenres(): { genres:GenreWithCount[]; loading:boolean } {
    const [genres,  setGenres]  = useState<GenreWithCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved ] = useState(true);
  
    useEffect(() => {
      let dead = false;
  
      const load = async () => {
        try {
          // Fetch genres depuis reels (feed) + works (catalogue), merged
          const [reelsR, worksR] = await Promise.all([
            supabase.from('reels').select('genre').eq('status','approved').not('genre','is',null),
            supabase.from('works').select('genre').not('genre','is',null),
          ]);
          if (dead) return;
  
          // Compter les occurrences (reels = poids 2, works = poids 1)
          const counts: Record<string,number> = {};
          (reelsR.data ?? []).forEach((r:any) => {
            const g = r.genre?.trim(); if (g) counts[g] = (counts[g]??0) + 2;
          });
          (worksR.data ?? []).forEach((r:any) => {
            const g = r.genre?.trim(); if (g) counts[g] = (counts[g]??0) + 1;
          });
  
          const sorted = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a,b) => b.count - a.count);
  
          setGenres(sorted);
        } catch { /* ignore */ }
        finally { if (!dead) setLoading(false); }
      };
      load();

      // setSaved function
   function setSaved(value: boolean) {
        setSaved(value);
      }
      

  
      // Realtime : nouveau reel approuvé
      const ch = supabase.channel(`sb_genres_${Date.now()}`)
        .on('postgres_changes',{ event:'INSERT', schema:'public', table:'reels' },({ new:row }) => {
          const g = (row as any)?.genre?.trim();
          if (g && (row as any)?.status === 'approved') {
            setGenres(prev => {
              const existing = prev.find(x => x.name === g);
              if (existing) return prev.map(x => x.name===g ? {...x,count:x.count+2} : x).sort((a,b)=>b.count-a.count);
              return [...prev, { name:g, count:2 }].sort((a,b)=>b.count-a.count);
            });
          }
        })
        .subscribe();
  
      return () => { dead = true; supabase.removeChannel(ch); };
    }, []);
  
    return { genres, loading };
  }
  
  // ─── MICRO UI ─────────────────────────────────────────────────────────────────
  /** Libellé de section mini */
  const SectionLabel = memo(({ label, collapsed, onToggle }:{ label:string; collapsed:boolean; onToggle:()=>void }) => (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.75} style={sl.wrap}>
      <Text style={sl.text}>{label}</Text>
      <Ionicons name={collapsed?'chevron-down':'chevron-up'} size={9} color={P.labelColor}/>
    </TouchableOpacity>
  ));
  const sl = StyleSheet.create({ wrap:{ flexDirection:'row', alignItems:'center', gap:4, paddingVertical:4, paddingHorizontal:2 }, text:{ color:P.labelColor, fontSize:7.5, fontWeight:'800', letterSpacing:1.2, textTransform:'uppercase' } });
  
  /** Bouton action (like / mute / save / info / share) */
  const ActionBtn = memo(function ActionBtn({ icon, iconOn, active, color, onPress, badge }:{ icon:keyof typeof Ionicons.glyphMap; iconOn:keyof typeof Ionicons.glyphMap; active:boolean; color:string; onPress:()=>void; badge?:number }) {
    const sc = useRef(new Animated.Value(1)).current;
    const handlePress = () => {
      Animated.sequence([
        Animated.spring(sc,{toValue:1.3,tension:350,friction:7,useNativeDriver:true}),
        Animated.spring(sc,{toValue:1,  tension:200,friction:8,useNativeDriver:true}),
      ]).start();
      onPress();
    };
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.72} style={{ position:'relative' }}>
        <Animated.View style={[ab.btn, active&&{ backgroundColor:P.iconOn, borderColor:`${color}30` }, { transform:[{scale:sc}] }]}>
          <Ionicons name={active?iconOn:icon} size={22} color={active?color:'rgba(255,255,255,0.85)'}/>
        </Animated.View>
        {badge!=null && badge>0 && (
          <View style={ab.badge}>
            <Text style={ab.badgeTxt}>{badge>99?'99+':badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  });
  const ab = StyleSheet.create({ btn:{ width:46, height:46, borderRadius:23, backgroundColor:P.iconBg, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:P.border }, badge:{ position:'absolute', top:-2, right:-2, minWidth:16, height:16, borderRadius:8, backgroundColor:'rgba(255,255,255,0.90)', alignItems:'center', justifyContent:'center', paddingHorizontal:3 }, badgeTxt:{ color:'#000', fontSize:8, fontWeight:'900' } });
  
  /** Pill genre vertical */
  const GenrePill = memo(function GenrePill({ genre, count, active, onPress }:{ genre:string; count:number; active:boolean; onPress:()=>void }) {
    const icon  = GENRE_ICONS[genre]  ?? 'film-outline';
    const color = GENRE_COLORS[genre] ?? 'rgba(255,255,255,0.55)';
    const sc    = useRef(new Animated.Value(1)).current;
    const handlePress = () => {
      Animated.sequence([Animated.spring(sc,{toValue:0.88,tension:350,friction:7,useNativeDriver:true}),Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true})]).start();
      onPress();
    };
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.80}>
        <Animated.View style={[gp.wrap, active && { borderColor:`${color}55`, backgroundColor:`${color}18` }, { transform:[{scale:sc}] }]}>
          <View style={[gp.iconBox, active && { backgroundColor:`${color}28` }]}>
            <Ionicons name={icon} size={13} color={active?color:P.muted}/>
          </View>
          <Text style={[gp.label, active && { color }]} numberOfLines={2}>{genre}</Text>
          {count > 0 && (
            <View style={[gp.cnt, active && { backgroundColor:`${color}28` }]}>
              <Text style={[gp.cntTxt, active && { color }]}>{count>99?'99+':count}</Text>
            </View>
          )}
          {active && <View style={[gp.dot, { backgroundColor:color }]}/>}
        </Animated.View>
      </TouchableOpacity>
    );
  });
  const gp = StyleSheet.create({
    wrap:   { width:52, alignItems:'center', gap:3, paddingVertical:7, paddingHorizontal:3, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)', backgroundColor:'rgba(0,0,0,0.30)' },
    iconBox:{ width:30, height:30, borderRadius:9, backgroundColor:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center' },
    label:  { color:P.muted, fontSize:7.5, fontWeight:'600', textAlign:'center', lineHeight:10 },
    cnt:    { paddingHorizontal:4, paddingVertical:1, borderRadius:5, backgroundColor:'rgba(255,255,255,0.08)' },
    cntTxt: { color:P.muted, fontSize:7, fontWeight:'700' },
    dot:    { position:'absolute', top:5, right:5, width:4, height:4, borderRadius:2 },
  });
  
  /** Pill format (Court / Moyen / Long / Série) */
  const FormatPill = memo(function FormatPill({ item, active, onPress }:{ item:typeof FORMATS[0]; active:boolean; onPress:()=>void }) {
    return (
      <TouchableOpacity style={[fp.wrap, active && fp.wrapOn]} onPress={onPress} activeOpacity={0.80}>
        <Ionicons name={item.icon} size={11} color={active?'#fff':P.muted}/>
        <Text style={[fp.label, active && { color:'#fff' }]}>{item.label}</Text>
        <Text style={[fp.sub, active && { color:'rgba(255,255,255,0.60)' }]}>{item.sub}</Text>
      </TouchableOpacity>
    );
  });
  const fp = StyleSheet.create({ wrap:{ width:50, alignItems:'center', gap:2, paddingVertical:7, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)', backgroundColor:'rgba(0,0,0,0.28)' }, wrapOn:{ backgroundColor:'rgba(255,255,255,0.14)', borderColor:'rgba(255,255,255,0.28)' }, label:{ color:P.muted, fontSize:7.5, fontWeight:'700' }, sub:{ color:'rgba(255,255,255,0.22)', fontSize:6, textAlign:'center' } });
  
  /** Pill ambiance */
  const AmbiancePill = memo(function AmbiancePill({ item, active, onPress }:{ item:typeof AMBIANCES[0]; active:boolean; onPress:()=>void }) {
    return (
      <TouchableOpacity style={[amp.wrap, active && { borderColor:`${item.color}44`, backgroundColor:`${item.color}14` }]} onPress={onPress} activeOpacity={0.80}>
        <Ionicons name={item.icon} size={12} color={active?item.color:P.muted}/>
        <Text style={[amp.label, active && { color:item.color }]} numberOfLines={2}>{item.label}</Text>
      </TouchableOpacity>
    );
  });
  const amp = StyleSheet.create({ wrap:{ width:50, alignItems:'center', gap:3, paddingVertical:6, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.07)', backgroundColor:'rgba(0,0,0,0.26)' }, label:{ color:P.muted, fontSize:7, fontWeight:'600', textAlign:'center', lineHeight:9 } });
  
  /** Pill découverte */
  const DiscovPill = memo(function DiscovPill({ item, active, onPress }:{ item:typeof DISCOVERY[0]; active:boolean; onPress:()=>void }) {
    return (
      <TouchableOpacity style={[dp2.wrap, active && { borderColor:`${item.color}44`, backgroundColor:`${item.color}16` }]} onPress={onPress} activeOpacity={0.80}>
        <Ionicons name={item.icon} size={13} color={active?item.color:P.muted}/>
        <Text style={[dp2.label, active && { color:item.color }]} numberOfLines={2}>{item.label}</Text>
      </TouchableOpacity>
    );
  });
  const dp2 = StyleSheet.create({ wrap:{ width:50, alignItems:'center', gap:3, paddingVertical:7, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.07)', backgroundColor:'rgba(0,0,0,0.26)' }, label:{ color:P.muted, fontSize:7, fontWeight:'600', textAlign:'center', lineHeight:9 } });
  
  /** Pill tri */
  const SortPill = memo(function SortPill({ item, active, onPress }:{ item:typeof SORT_OPTIONS[0]; active:boolean; onPress:()=>void }) {
    return (
      <TouchableOpacity style={[sp.wrap, active && { backgroundColor:'rgba(255,255,255,0.14)', borderColor:'rgba(255,255,255,0.28)' }]} onPress={onPress} activeOpacity={0.80}>
        <Ionicons name={item.icon} size={11} color={active?'#fff':P.muted}/>
        <Text style={[sp.label, active && { color:'#fff' }]}>{item.label}</Text>
      </TouchableOpacity>
    );
  });
  const sp = StyleSheet.create({ wrap:{ width:50, alignItems:'center', gap:2, paddingVertical:7, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)', backgroundColor:'rgba(0,0,0,0.28)' }, label:{ color:P.muted, fontSize:7.5, fontWeight:'600', textAlign:'center' } });
  
  // ─── ★ SIDEBAR ────────────────────────────────────────────────────────────────
  export const SideBar = memo(function SideBar({
    visible, liked, muted, saved,
    onLike, onMute, onSave, onInfo,
    activeGenre, onGenreSelect,
    activeFormat=null,   onFormatSelect,
    activeAmbiance=null, onAmbianceSelect,
    activeSort=null,     onSortSelect,
    onInteract,
  }: SideBarProps) {
    const { genres, loading } = useReelGenres();
  
    // Sections collapsibles
    const [showGenres,    setShowGenres]    = useState(true);
    const [showFormat,    setShowFormat]    = useState(false);
    const [showAmbiance,  setShowAmbiance]  = useState(false);
    const [showSort,      setShowSort]      = useState(false);
    const [showDiscovery, setShowDiscovery] = useState(false);
  
    const wrap = useCallback(<T extends (...a:any[])=>any>(fn:T) =>
      (...args:Parameters<T>) => { onInteract(); fn(...args); },
    [onInteract]);
  
    if (!visible) return null;


    const onShare = async () => {
      try {
        const userId = session?.user?.id; // adapte selon ton state auth
        const workId = work?.id;          // oeuvre du reel courant
    
        if (!userId || !workId) return;
    
        const { error } = await supabase
          .from('user_favorites')
          .upsert(
            { user_id: userId, work_id: workId },
            { onConflict: 'user_id,work_id' }
          );
    
        if (error) throw error;
    
        // option UX
        setSaved?.(true); // si tu as cet état local
        // toast.success('Ajouté aux favoris');
      } catch (e) {
        console.error('[share->favorite] error:', e);
        // toast.error('Impossible d’ajouter en favoris');
      }
    };
  
    // Comptage des filtres actifs (pour badge sur sections)
    const hasFormat    = !!activeFormat;
    const hasAmbiance  = !!activeAmbiance;
    const hasSort      = !!activeSort;
  
    return (
      <View style={sb.root} pointerEvents="box-none">
        <ScrollView
          style={sb.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sb.scrollContent}
        >
  
          {/* ── ACTIONS ─────────────────────────────────────────────────── */}
          <View style={sb.actions}>
            <ActionBtn icon="heart-outline"        iconOn="heart"          active={liked} color={P.red}   onPress={wrap(onLike)}/>
            <ActionBtn icon="volume-high-outline"   iconOn="volume-mute"    active={muted} color="rgba(255,255,255,0.90)" onPress={wrap(onMute)}/>
          <ActionBtn icon="share-outline" iconOn="share" active={false} color={P.blue} onPress={wrap(onShare)}/>
          <ActionBtn icon="list-outline"  iconOn="list"  active={false} color={P.muted} onPress={wrap(onInfo)}/>
          </View>
  
          <View style={sb.divider}/>
  
          {/* ── GENRES ──────────────────────────────────────────────────── */}
          <SectionLabel label="Genres" collapsed={!showGenres} onToggle={()=>setShowGenres(v=>!v)}/>
          {showGenres && (
            <View style={sb.pillGroup}>
              {/* Tous */}
              <TouchableOpacity
                style={[gp.wrap, !activeGenre && { borderColor:`${P.blue}55`, backgroundColor:`${P.blue}18` }]}
                onPress={()=>{ onInteract(); onGenreSelect(null); }}
                activeOpacity={0.80}
              >
                <View style={[gp.iconBox, !activeGenre && { backgroundColor:`${P.blue}28` }]}>
                  <Ionicons name="grid-outline" size={13} color={!activeGenre?P.blue:P.muted}/>
                </View>
                <Text style={[gp.label, !activeGenre && { color:P.blue }]}>Tous</Text>
                {!activeGenre && <View style={[gp.dot, { backgroundColor:P.blue }]}/>}
              </TouchableOpacity>
  
              {loading
                ? <View style={{ paddingVertical:10, alignItems:'center' }}><ActivityIndicator size="small" color={P.muted}/></View>
                : genres.map(g => (
                    <GenrePill
                      key={g.name} genre={g.name} count={g.count}
                      active={activeGenre===g.name}
                      onPress={() => { onInteract(); onGenreSelect(activeGenre===g.name?null:g.name); }}
                    />
                  ))
              }
            </View>
          )}
  
          <View style={sb.dividerThin}/>
  
          {/* ── FORMAT ──────────────────────────────────────────────────── */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <SectionLabel label="Format" collapsed={!showFormat} onToggle={()=>setShowFormat(v=>!v)}/>
            {hasFormat && <View style={sb.activeDot}/>}
          </View>
          {showFormat && onFormatSelect && (
            <View style={sb.pillGroup}>
              {/* Tous formats */}
              <TouchableOpacity
                style={[fp.wrap, !activeFormat && { backgroundColor:'rgba(255,255,255,0.14)', borderColor:'rgba(255,255,255,0.28)' }]}
                onPress={()=>{ onInteract(); onFormatSelect(null); }}
                activeOpacity={0.80}
              >
                <Ionicons name="albums-outline" size={11} color={!activeFormat?'#fff':P.muted}/>
                <Text style={[fp.label, !activeFormat && { color:'#fff' }]}>Tous</Text>
              </TouchableOpacity>
              {FORMATS.map(f => (
                <FormatPill key={f.key} item={f}
                  active={activeFormat===f.key}
                  onPress={()=>{ onInteract(); onFormatSelect(activeFormat===f.key?null:f.key); }}
                />
              ))}
            </View>
          )}
  
          <View style={sb.dividerThin}/>
  
          {/* ── AMBIANCE ────────────────────────────────────────────────── */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <SectionLabel label="Ambiance" collapsed={!showAmbiance} onToggle={()=>setShowAmbiance(v=>!v)}/>
            {hasAmbiance && <View style={sb.activeDot}/>}
          </View>
          {showAmbiance && onAmbianceSelect && (
            <View style={sb.pillGroup}>
              {AMBIANCES.map(a => (
                <AmbiancePill key={a.key} item={a}
                  active={activeAmbiance===a.key}
                  onPress={()=>{ onInteract(); onAmbianceSelect(activeAmbiance===a.key?null:a.key); }}
                />
              ))}
            </View>
          )}
  
          <View style={sb.dividerThin}/>
  
          {/* ── DÉCOUVERTE ──────────────────────────────────────────────── */}
          <SectionLabel label="Découverte" collapsed={!showDiscovery} onToggle={()=>setShowDiscovery(v=>!v)}/>
          {showDiscovery && (
            <View style={sb.pillGroup}>
              {DISCOVERY.map(d => (
                <DiscovPill key={d.key} item={d}
                  active={false}
                  onPress={()=>{ onInteract(); /* parent handles */ }}
                />
              ))}
            </View>
          )}
  
          <View style={sb.dividerThin}/>
  
          {/* ── TRI ─────────────────────────────────────────────────────── */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <SectionLabel label="Tri" collapsed={!showSort} onToggle={()=>setShowSort(v=>!v)}/>
            {hasSort && <View style={sb.activeDot}/>}
          </View>
          {showSort && onSortSelect && (
            <View style={sb.pillGroup}>
              {SORT_OPTIONS.map(s => (
                <SortPill key={s.key} item={s}
                  active={activeSort===s.key}
                  onPress={()=>{ onInteract(); onSortSelect(activeSort===s.key?null:s.key); }}
                />
              ))}
            </View>
          )}
  
          <View style={{ height:60 }}/>
        </ScrollView>
      </View>
    );
  });
  
  export default SideBar;
  
  // ─── STYLES ───────────────────────────────────────────────────────────────────
  const sb = StyleSheet.create({
    root: {
      position:'absolute', right:10, top:0, bottom:0, zIndex:15,
      justifyContent:'center', alignItems:'center',
    },
    scroll: { width:64, maxHeight:'90%' },
    scrollContent: {
      alignItems:'center', gap:6, paddingTop:16, paddingBottom:24, paddingHorizontal:6,
    },
    actions: {
      alignItems:'center', gap:13, marginBottom:6,
    },
    pillGroup: {
      alignItems:'center', gap:6, width:56,
    },
    divider: {
      width:36, height:StyleSheet.hairlineWidth,
      backgroundColor:'rgba(255,255,255,0.14)',
      marginVertical:8,
    },
    dividerThin: {
      width:28, height:StyleSheet.hairlineWidth,
      backgroundColor:'rgba(255,255,255,0.07)',
      marginVertical:4,
    },
    activeDot: {
      width:5, height:5, borderRadius:2.5,
      backgroundColor:'rgba(255,255,255,0.60)',
      marginRight:4,
    },
  });


function setSaved(arg0: boolean) {
  throw new Error('Function not implemented.');
}

