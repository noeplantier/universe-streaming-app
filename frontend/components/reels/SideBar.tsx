import React, {
    memo, useCallback, useEffect, useState,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, ActivityIndicator, Platform,
  } from 'react-native';
  import { BlurView }  from 'expo-blur';
  import { Ionicons }  from '@expo/vector-icons';
  import { supabase }  from '@/lib/supabase';
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  export interface SideBarProps {
    /** Afficher/masquer (fullscreen auto-hide) */
    visible:       boolean;
    /** Like actif sur le film courant */
    liked:         boolean;
    /** Muted */
    muted:         boolean;
    /** Sauvegardé */
    saved:         boolean;
    /** Callback like */
    onLike:        () => void;
    /** Callback mute */
    onMute:        () => void;
    /** Callback save */
    onSave:        () => void;
    /** Callback info (ouvre InfoSheet) */
    onInfo?:       () => void;
    /** Genre actif (null = tous) */
    activeGenre:   string | null;
    /** Notifie le parent du genre sélectionné */
    onGenreSelect: (genre: string | null) => void;
    /** Reset timer auto-hide à chaque interaction */
    onInteract:    () => void;
  }
  
  // ─── PALETTE ──────────────────────────────────────────────────────────────────
  const P = {
    red:     '#FF3B5C',
    gold:    '#F5C842',
    blue:    '#5A96E6',
    primary: '#1E40AF',
    iconBg:  'rgba(0,0,0,0.40)',
    iconOn:  'rgba(255,255,255,0.15)',
    border:  'rgba(255,255,255,0.12)',
  } as const;
  
  // Icônes par genre (fallback = film-outline)
  const GENRE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
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
    'Érotique':       'flame-outline',
  };
  
  function getGenreIcon(genre: string): keyof typeof Ionicons.glyphMap {
    return GENRE_ICONS[genre] ?? 'film-outline';
  }
  
  // Couleur accent par genre (optionnel — subtil)
  const GENRE_COLORS: Record<string, string> = {
    'Drame':          '#A78BFA',
    'Thriller':       '#F87171',
    'Science-Fiction':'#38BDF8',
    'Documentaire':   '#34D399',
    'Horreur':        '#FB7185',
    'Comédie':        '#FDE68A',
    'Romance':        '#F472B6',
    'Action':         '#FB923C',
    'Fantastique':    '#C084FC',
    'Expérimental':   '#67E8F9',
  };
  
  function getGenreColor(genre: string): string {
    return GENRE_COLORS[genre] ?? 'rgba(255,255,255,0.55)';
  }
  
  // ─── HOOK — genres dynamiques depuis public.reels ────────────────────────────
  function useReelGenres() {
    const [genres,  setGenres]  = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      let dead = false;
      supabase
        .from('reels')
        .select('genre')
        .eq('status', 'approved')
        .not('genre', 'is', null)
        .then(({ data }) => {
          if (dead) return;
          // Déduplique + trie alphabétiquement
          const set = new Set<string>();
          (data ?? []).forEach((r: any) => {
            if (r.genre?.trim()) set.add(r.genre.trim());
          });
          setGenres([...set].sort((a, b) => a.localeCompare(b, 'fr')));
          setLoading(false);
        })
        .catch(() => { if (!dead) setLoading(false); });
  
      // Realtime : nouveau reel approuvé avec un genre inédit
      const ch = supabase
        .channel(`sidebar_genres_${Date.now()}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'reels' },
          ({ new: row }) => {
            const g = (row as any)?.genre?.trim();
            if (g && (row as any)?.status === 'approved') {
              setGenres(prev =>
                prev.includes(g) ? prev : [...prev, g].sort((a, b) => a.localeCompare(b, 'fr'))
              );
            }
          },
        )
        .subscribe();
  
      return () => { dead = true; supabase.removeChannel(ch); };
    }, []);
  
    return { genres, loading };
  }
  
  // ─── GENRE PILL (chip vertical dans la liste) ─────────────────────────────────
  const GenrePill = memo(function GenrePill({
    genre, active, onPress,
  }: { genre: string; active: boolean; onPress: () => void }) {
    const icon  = getGenreIcon(genre);
    const color = getGenreColor(genre);
  
    return (
      <TouchableOpacity
        style={[gp.wrap, active && { borderColor: color + '60', backgroundColor: color + '18' }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {/* Icône genre */}
        <View style={[gp.iconBox, active && { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={14} color={active ? color : 'rgba(255,255,255,0.50)'} />
        </View>
        {/* Label tronqué */}
        <Text
          style={[gp.label, active && { color }]}
          numberOfLines={2}
        >
          {genre}
        </Text>
        {/* Dot actif */}
        {active && <View style={[gp.dot, { backgroundColor: color }]} />}
      </TouchableOpacity>
    );
  });
  
  const gp = StyleSheet.create({
    wrap: {
      width:           52,
      alignItems:      'center',
      gap:              4,
      paddingVertical:  8,
      paddingHorizontal: 4,
      borderRadius:    12,
      borderWidth:     StyleSheet.hairlineWidth,
      borderColor:    'rgba(255,255,255,0.08)',
      backgroundColor:'rgba(0,0,0,0.30)',
    },
    iconBox: {
      width:           32,
      height:          32,
      borderRadius:    10,
      backgroundColor:'rgba(255,255,255,0.06)',
      alignItems:      'center',
      justifyContent:  'center',
    },
    label: {
      color:     'rgba(255,255,255,0.42)',
      fontSize:   8,
      fontWeight:'600',
      textAlign: 'center',
      lineHeight: 11,
    },
    dot: {
      position:    'absolute',
      top:          6,
      right:        6,
      width:        5,
      height:       5,
      borderRadius: 2.5,
    },
  });
  
  // ─── ACTION BUTTON (like / mute / save / info) ────────────────────────────────
  const ActionBtn = memo(function ActionBtn({
    icon, iconOn, active, color, onPress,
  }: {
    icon:   keyof typeof Ionicons.glyphMap;
    iconOn: keyof typeof Ionicons.glyphMap;
    active: boolean;
    color:  string;
    onPress: () => void;
  }) {
    return (
      <TouchableOpacity
        style={[ab.btn, active && { backgroundColor: P.iconOn }]}
        onPress={onPress}
        activeOpacity={0.72}
      >
        <Ionicons name={active ? iconOn : icon} size={24} color={active ? color : 'rgba(255,255,255,0.82)'} />
      </TouchableOpacity>
    );
  });
  
  const ab = StyleSheet.create({
    btn: {
      width:           48,
      height:          48,
      borderRadius:    24,
      backgroundColor: P.iconBg,
      alignItems:      'center',
      justifyContent:  'center',
      borderWidth:      StyleSheet.hairlineWidth,
      borderColor:      P.border,
    },
  });
  
  // ─── SIDEBAR ──────────────────────────────────────────────────────────────────
  export const SideBar = memo(function SideBar({
    visible, liked, muted, saved,
    onLike, onMute, onSave, onInfo,
    activeGenre, onGenreSelect, onInteract,
  }: SideBarProps) {
    const { genres, loading } = useReelGenres();
  
    // Wrappeur interaction : toute action reset le timer auto-hide
    const wrap = useCallback(<T extends (...args: any[]) => any>(fn: T) =>
      (...args: Parameters<T>) => { onInteract(); fn(...args); },
    [onInteract]);
  
    if (!visible) return null;
  
    return (
      <View style={sb.root} pointerEvents="box-none">
  
        {/* ── Actions (like / mute / save / info) ── */}
        <View style={sb.actions}>
          <ActionBtn
            icon="heart-outline" iconOn="heart"
            active={liked} color={P.red}
            onPress={wrap(onLike)}
          />
          <ActionBtn
            icon="volume-high-outline" iconOn="volume-mute"
            active={muted} color="rgba(255,255,255,0.90)"
            onPress={wrap(onMute)}
          />
          <ActionBtn
            icon="star-outline" iconOn="star"
            active={saved} color={P.gold}
            onPress={wrap(onSave)}
          />
          {onInfo && (
            <ActionBtn
              icon="list-outline" iconOn="list"
              active={false} color="rgba(255,255,255,0.75)"
              onPress={wrap(onInfo)}
            />
          )}
        </View>
  
        {/* ── Séparateur ── */}
        <View style={sb.separator} />
  
        {/* ── Sélecteur de genres dynamique ── */}
        <View style={sb.genreSection}>
          {/* Label */}
          <Text style={sb.genreLabel}>Genres</Text>
  
          <ScrollView
            style={sb.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={sb.scrollContent}
          >
            {/* Pill "Tous" */}
            <TouchableOpacity
              style={[gp.wrap, !activeGenre && {
                borderColor: P.blue + '60',
                backgroundColor: P.blue + '18',
              }]}
              onPress={() => { onInteract(); onGenreSelect(null); }}
              activeOpacity={0.75}
            >
              <View style={[gp.iconBox, !activeGenre && { backgroundColor: P.blue + '22' }]}>
                <Ionicons
                  name="grid-outline"
                  size={14}
                  color={!activeGenre ? P.blue : 'rgba(255,255,255,0.50)'}
                />
              </View>
              <Text style={[gp.label, !activeGenre && { color: P.blue }]}>Tous</Text>
              {!activeGenre && <View style={[gp.dot, { backgroundColor: P.blue }]} />}
            </TouchableOpacity>
  
            {/* Genres dynamiques */}
            {loading ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.30)" />
              </View>
            ) : (
              genres.map(genre => (
                <GenrePill
                  key={genre}
                  genre={genre}
                  active={activeGenre === genre}
                  onPress={() => {
                    onInteract();
                    onGenreSelect(activeGenre === genre ? null : genre);
                  }}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    );
  });
  
  export default SideBar;
  
  // ─── STYLES ───────────────────────────────────────────────────────────────────
  const sb = StyleSheet.create({
    root: {
      position:  'absolute',
      right:      12,
      top:        0,
      bottom:     0,
      zIndex:     15,
      justifyContent: 'center',
      alignItems: 'center',
      gap:         0,
    },
    actions: {
      alignItems: 'center',
      gap:         16,
      marginBottom: 16,
    },
    separator: {
      width:           32,
      height:           StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.12)',
      marginBottom:     12,
    },
    genreSection: {
      alignItems: 'center',
      gap:         6,
      maxHeight:  '55%',
    },
    genreLabel: {
      color:         'rgba(255,255,255,0.28)',
      fontSize:       8,
      fontWeight:    '700',
      letterSpacing:  1.2,
      textTransform: 'uppercase',
      marginBottom:   2,
    },
    scroll: {
      width: 60,
    },
    scrollContent: {
      alignItems: 'center',
      gap:         6,
      paddingBottom: 8,
    },
  });