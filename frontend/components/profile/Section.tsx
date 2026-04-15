import React, { memo } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { G, H_PADDING, NUM_ITEM_W, CARD_GAP } from './theme';
import type { FilmItem, ReviewItem } from './data';
import { C } from '../create/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// 📌 SECTION HEADER — Apple TV aesthetic
// ─────────────────────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  count?: number;
  accentColor?: string;
  onViewAll?: () => void;
}

export const SectionHeader = memo(({
  icon, label, subtitle, count, accentColor = G.primary, onViewAll,
}: SectionHeaderProps) => (
  <View style={sh.wrap}>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon && (
          <View style={[sh.iconWrap, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}28` }]}>
            <Ionicons name={icon} size={13} color={accentColor} />
          </View>
        )}
        <Text style={sh.label}>{label}</Text>
        {count != null && (
          <View style={[sh.countBadge, { backgroundColor: `${accentColor}16`, borderColor: `${accentColor}28` }]}>
            <Text style={[sh.countTxt, { color: accentColor }]}>{count}</Text>
          </View>
        )}
      </View>
      {subtitle && <Text style={sh.subtitle}>{subtitle}</Text>}
    </View>
    {onViewAll && (
      <TouchableOpacity onPress={onViewAll} style={sh.viewAllBtn} activeOpacity={0.7}>
        <Text style={[sh.viewAllTxt, { color: accentColor }]}>Voir tout</Text>
        <Ionicons name="chevron-forward" size={12} color={accentColor} />
      </TouchableOpacity>
    )}
  </View>
));
SectionHeader.displayName = 'SectionHeader';

const sh = StyleSheet.create({
  wrap:        { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:H_PADDING, paddingTop:22, paddingBottom:12 },
  iconWrap:    { width:26, height:26, borderRadius:9, alignItems:'center', justifyContent:'center', borderWidth:1 },
  label:       { color:G.text, fontSize:17, fontWeight:'700', letterSpacing:-0.2 },
  subtitle:    { color:G.textTer, fontSize:11, marginTop:3, marginLeft:34 },
  countBadge:  { borderRadius:8, paddingHorizontal:8, paddingVertical:2.5, borderWidth:1 },
  countTxt:    { fontSize:10, fontWeight:'800' },
  viewAllBtn:  { flexDirection:'row', alignItems:'center', gap:2, marginTop:2 },
  viewAllTxt:  { fontSize:12, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎠 HORIZONTAL SCROLL ROW — numbered items snap per card slot
// ─────────────────────────────────────────────────────────────────────────────
export const HScrollRow = memo(({ children, paddingBottom = 4 }: { children: React.ReactNode; paddingBottom?: number }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    decelerationRate="fast"
    // Snap per numbered-item slot width
    snapToInterval={NUM_ITEM_W + CARD_GAP}
    snapToAlignment="start"
    contentContainerStyle={{
      paddingLeft: H_PADDING,
      paddingRight: H_PADDING,
      gap: CARD_GAP,
      paddingBottom,
    }}
  >
    {children}
  </ScrollView>
));
HScrollRow.displayName = 'HScrollRow';

// ─────────────────────────────────────────────────────────────────────────────
// 🚫 EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
export const EmptyState = memo(({
  icon, text, subtext,
}: { icon: keyof typeof Ionicons.glyphMap; text: string; subtext?: string }) => (
  <View style={es.wrap}>
    <LinearGradient colors={[C.navyMid, 'transparent']} style={es.circle}>
      <Ionicons name={icon} size={34} color={G.primary} />
    </LinearGradient>
    <Text style={es.text}>{text}</Text>
    {subtext && <Text style={es.sub}>{subtext}</Text>}
  </View>
));
EmptyState.displayName = 'EmptyState';
const es = StyleSheet.create({
  wrap:   { alignItems:'center', paddingVertical:44, gap:12 },
  circle: { width:68, height:68, borderRadius:34, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.navyMid },
  text:   { color:'rgba(255,255,255,0.36)', fontSize:14, fontWeight:'600' },
  sub:    { color:'rgba(255,255,255,0.20)', fontSize:12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📊 STATS BLOCK — MyDramaList-style genre bars + counters
// ─────────────────────────────────────────────────────────────────────────────
interface StatsBlockProps {
  reviews: ReviewItem[];
  seenFilms: FilmItem[];
}
export const StatsBlock = memo(({ reviews, seenFilms }: StatsBlockProps) => {
  // Genre frequency across all seen + reviewed films
  const genreMap: Record<string, number> = {};
  [...seenFilms, ...reviews.map(r => r.film).filter(Boolean)].forEach(f => {
    if (f?.genre) genreMap[f.genre] = (genreMap[f.genre] ?? 0) + 1;
  });
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount  = topGenres[0]?.[1] ?? 1;
  const barColors = [G.primary, G.cyan, G.gold, G.success, G.amber];

  const totalLikes = reviews.reduce((s, r) => s + r.likes, 0);
  const statItems = [
    { val: `${seenFilms.filter(f => f.type === 'film').length}`,  label:'Films',   color:G.success, icon:'film'   as const },
    { val: `${seenFilms.filter(f => f.type === 'série').length}`, label:'Séries',  color:G.cyan,    icon:'tv'     as const },
    { val: `${reviews.length}`,                                    label:'Critiques',color:G.gold,   icon:'pencil' as const },
    { val: totalLikes >= 1000 ? `${(totalLikes/1000).toFixed(1)}k` : `${totalLikes}`,
       label:'Likes', color:G.danger, icon:'heart' as const },
  ];

  return (
    <View style={{ paddingHorizontal: H_PADDING, paddingTop: 8, paddingBottom: 12 }}>
      <BlurView intensity={10} tint="dark" style={sb.card}>
        {/* Header */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:18 }}>
          <Ionicons name="bar-chart-outline" size={14} color={G.primary} />
          <Text style={{ color:G.text, fontSize:13, fontWeight:'800', letterSpacing:-0.1 }}>Statistiques</Text>
        </View>

        {/* Counters row */}
        <View style={sb.countersRow}>
          {statItems.map((st, idx, arr) => (
            <View key={st.label} style={[
              sb.counter,
              idx < arr.length - 1 && { borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.07)' },
            ]}>
              <View style={[sb.counterIcon, { backgroundColor: `${st.color}16` }]}>
                <Ionicons name={st.icon} size={13} color={st.color} />
              </View>
              <Text style={[sb.counterVal, { color: st.color }]}>{st.val}</Text>
              <Text style={sb.counterLbl}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Genre bars */}
        {topGenres.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={sb.genreTitle}>GENRES FAVORIS</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {topGenres.map(([genre, count], gi) => (
                <View key={genre} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Text style={sb.genreName} numberOfLines={1}>{genre}</Text>
                  <View style={sb.barTrack}>
                    <View style={[sb.barFill, { width: `${(count / maxCount) * 100}%`, backgroundColor: barColors[gi] ?? G.primary }]} />
                  </View>
                  <Text style={sb.genreCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </BlurView>
    </View>
  );
});
StatsBlock.displayName = 'StatsBlock';

const sb = StyleSheet.create({
  card:        { borderRadius:16, borderWidth:1, borderColor:G.glassBorder, padding:16, overflow:'hidden' },
  countersRow: { flexDirection:'row' },
  counter:     { flex:1, alignItems:'center', gap:5, paddingVertical:4 },
  counterIcon: { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center' },
  counterVal:  { fontSize:16, fontWeight:'900', letterSpacing:-0.5 },
  counterLbl:  { color:G.textTer, fontSize:9, fontWeight:'600' },
  genreTitle:  { color:'rgba(255,255,255,0.28)', fontSize:9, fontWeight:'800', letterSpacing:1 },
  genreName:   { color:G.textTer, fontSize:9, width:74 },
  barTrack:    { flex:1, height:5, borderRadius:3, backgroundColor:'rgba(255,255,255,0.07)', overflow:'hidden' },
  barFill:     { height:'100%', borderRadius:3 },
  genreCount:  { color:'rgba(255,255,255,0.28)', fontSize:9, width:18, textAlign:'right' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎛️ STAT COLUMN (profile header)
// ─────────────────────────────────────────────────────────────────────────────
export const StatColumn = memo(({
  value, label, onPress,
}: { value: string; label: string; onPress?: () => void }) => (
  <TouchableOpacity style={stc.col} onPress={onPress} activeOpacity={0.7}>
    <Text style={stc.val}>{value}</Text>
    <Text style={stc.lbl}>{label}</Text>
  </TouchableOpacity>
));
StatColumn.displayName = 'StatColumn';
const stc = StyleSheet.create({
  col: { alignItems:'center', flex:1 },
  val: { color:G.text, fontSize:17, fontWeight:'800', letterSpacing:-0.4 },
  lbl: { color:'rgba(255,255,255,0.48)', fontSize:11, marginTop:1, textAlign:'center' },
});