import React, { useState, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, TextInput, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import * as Haptics  from 'expo-haptics';
import { C, PRO_ROLES, EDGE } from './SocialTokens';
import type { Pro, ProRole } from './SocialTypes';
import { useProDirectory } from '@/hooks/usePostsFeed';
import ContactProModal from './ContactProModal';

// ── Verified badge ─────────────────────────────────────────────────────────
const VerifiedBadge = memo(() => (
  <View style={vb.wrap}>
    <Ionicons name="checkmark-circle" size={11} color={C.blue} />
    <Text style={vb.txt}>Vérifié</Text>
  </View>
));
const vb = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:C.blueDim, borderWidth:0.5, borderColor:C.borderBlue },
  txt:  { color:C.blue, fontSize:9, fontWeight:'800' },
});

// ── Open-to chips ──────────────────────────────────────────────────────────
const OpenToChip = memo(({ label }: { label: string }) => (
  <View style={otc.chip}>
    <Text style={otc.txt}>{label}</Text>
  </View>
));
const otc = StyleSheet.create({
  chip: { paddingHorizontal:9, paddingVertical:3, borderRadius:10, backgroundColor:C.greenDim, borderWidth:0.5, borderColor:C.greenEdge },
  txt:  { color:C.green, fontSize:10, fontWeight:'600' },
});

// ── Pro card ──────────────────────────────────────────────────────────────
const ProCard = memo(function ProCard({
  pro, onContact,
}: { pro: Pro; onContact: (pro: Pro) => void }) {
  const avatarUri = pro.avatar ?? `https://i.pravatar.cc/120?u=${pro.id}`;

  const openWebsite = useCallback(() => {
    if (pro.website) Linking.openURL(pro.website).catch(() => {});
  }, [pro.website]);

  return (
    <View style={pc.card}>
      <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={pc.inner}>
        {/* Header */}
        <View style={pc.header}>
          <Image source={{ uri: avatarUri }} style={pc.avatar} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={pc.nameRow}>
              <Text style={pc.name} numberOfLines={1}>{pro.name}</Text>
              {pro.verified && <VerifiedBadge />}
            </View>
            <View style={pc.roleRow}>
              <Ionicons name="briefcase-outline" size={11} color={C.blue} />
              <Text style={pc.role}>{pro.role}</Text>
            </View>
            {pro.location && (
              <View style={pc.locRow}>
                <Ionicons name="location-outline" size={11} color={C.textTert} />
                <Text style={pc.loc}>{pro.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bio */}
        {pro.bio && (
          <Text style={pc.bio} numberOfLines={3}>{pro.bio}</Text>
        )}

        {/* Films */}
        {pro.films.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pc.filmsRow}>
            {pro.films.slice(0, 4).map(film => (
              <View key={film} style={pc.filmChip}>
                <Ionicons name="film-outline" size={10} color={C.textSec} />
                <Text style={pc.filmTxt} numberOfLines={1}>{film}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Open to */}
        {pro.open_to.length > 0 && (
          <View style={pc.openToRow}>
            {pro.open_to.slice(0, 3).map(o => <OpenToChip key={o} label={o} />)}
          </View>
        )}

        {/* Actions */}
        <View style={pc.actions}>
          <TouchableOpacity
            style={pc.contactBtn}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onContact(pro);
            }}
            activeOpacity={0.85}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 16 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={pc.contactInner}>
              <Ionicons name="mail-outline" size={14} color={C.white} />
              <Text style={pc.contactTxt}>Contacter</Text>
            </View>
          </TouchableOpacity>

          {pro.website && (
            <TouchableOpacity style={pc.webBtn} onPress={openWebsite} activeOpacity={0.8}>
              <Ionicons name="globe-outline" size={16} color={C.blue} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const pc = StyleSheet.create({
  card:        { marginHorizontal:EDGE, marginBottom:14, borderRadius:20, overflow:'hidden', borderWidth:0.5, borderColor:'rgba(255,255,255,0.10)', backgroundColor:'rgba(13,34,64,0.48)' },
  inner:       { padding:16, gap:12 },
  header:      { flexDirection:'row', gap:12, alignItems:'flex-start' },
  avatar:      { width:52, height:52, borderRadius:26, borderWidth:1.5, borderColor:'rgba(255,255,255,0.12)' },
  nameRow:     { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  name:        { color:C.text, fontSize:15, fontWeight:'800', flexShrink:1 },
  roleRow:     { flexDirection:'row', alignItems:'center', gap:4 },
  role:        { color:C.blue, fontSize:11, fontWeight:'700' },
  locRow:      { flexDirection:'row', alignItems:'center', gap:4 },
  loc:         { color:C.textTert, fontSize:10 },
  bio:         { color:C.textSec, fontSize:13, lineHeight:19 },
  filmsRow:    { gap:7 },
  filmChip:    { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:4, borderRadius:10, backgroundColor:C.surf, borderWidth:0.5, borderColor:C.border, maxWidth:140 },
  filmTxt:     { color:C.textSec, fontSize:11, fontWeight:'600', flexShrink:1 },
  openToRow:   { flexDirection:'row', flexWrap:'wrap', gap:7 },
  actions:     { flexDirection:'row', gap:10 },
  contactBtn:  { flex:1, borderRadius:14, overflow:'hidden', borderWidth:0.5, borderColor:C.borderBlue },
  contactInner:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, paddingVertical:11 },
  contactTxt:  { color:C.white, fontSize:13, fontWeight:'700' },
  webBtn:      { width:42, height:42, borderRadius:14, backgroundColor:C.surf, borderWidth:0.5, borderColor:C.border, alignItems:'center', justifyContent:'center' },
});

// ── Role filter bar ────────────────────────────────────────────────────────
const RoleFilter = memo(function RoleFilter({
  active, onSelect,
}: { active: string; onSelect: (r: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={rf.row}
    >
      {PRO_ROLES.map(r => {
        const on = active === r;
        return (
          <TouchableOpacity
            key={r}
            style={[rf.chip, on && rf.chipOn]}
            onPress={() => onSelect(r)}
            activeOpacity={0.8}
          >
            <Text style={[rf.txt, on && rf.txtOn]}>{r}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

const rf = StyleSheet.create({
  row:   { paddingHorizontal:EDGE, gap:8, paddingVertical:4 },
  chip:  { paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:C.surf, borderWidth:1, borderColor:C.border },
  chipOn:{ backgroundColor:C.navyLight, borderColor:C.borderBlue },
  txt:   { color:C.textSec, fontSize:12, fontWeight:'600' },
  txtOn: { color:C.blue, fontWeight:'800' },
});

// ── Empty state ────────────────────────────────────────────────────────────
const EmptyPros = memo(() => (
  <View style={ep.wrap}>
    <View style={ep.icon}>
      <Ionicons name="people-outline" size={32} color={C.textTert} />
    </View>
    <Text style={ep.title}>Aucun professionnel trouvé</Text>
    <Text style={ep.sub}>Modifiez votre recherche ou votre filtre</Text>
  </View>
));
const ep = StyleSheet.create({
  wrap:  { alignItems:'center', paddingTop:60, paddingHorizontal:32, gap:10 },
  icon:  { width:64, height:64, borderRadius:32, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  title: { color:C.textSec, fontSize:16, fontWeight:'700' },
  sub:   { color:C.textTert, fontSize:13, textAlign:'center' },
});

// ── MAIN EXPORT ───────────────────────────────────────────────────────────
export default function ProDirectory() {
  const [search,      setSearch]      = useState('');
  const [activeRole,  setActiveRole]  = useState('Tous');
  const [contactPro,  setContactPro]  = useState<Pro | null>(null);
  const { pros, loading, error, refresh } = useProDirectory(search, activeRole);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={dir.header}>
        <View>
          <Text style={dir.eyebrow}>ANNUAIRE · CINÉMA INDÉPENDANT</Text>
          <Text style={dir.title}>Professionnels</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={dir.searchWrap}>
        <BlurView intensity={Platform.OS === 'ios' ? 16 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={dir.searchRow}>
          <Ionicons name="search" size={15} color={C.textTert} />
          <TextInput
            style={dir.searchInput}
            placeholder="Rechercher un nom…"
            placeholderTextColor={C.textTert}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8 as any}>
              <Ionicons name="close-circle" size={15} color={C.textTert} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Role filter */}
      <View style={{ marginBottom: 14 }}>
        <RoleFilter active={activeRole} onSelect={setActiveRole} />
      </View>

      {/* Results */}
      {loading ? (
        <View style={dir.loader}>
          <ActivityIndicator color={C.blue} size="large" />
          <Text style={dir.loaderTxt}>Chargement du répertoire…</Text>
        </View>
      ) : error ? (
        <View style={dir.loader}>
          <Ionicons name="cloud-offline-outline" size={36} color={C.textTert} />
          <Text style={{ color:C.red, fontSize:13, marginTop:10 }}>{error}</Text>
          <TouchableOpacity style={dir.retryBtn} onPress={refresh}>
            <Text style={{ color:C.white, fontWeight:'700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : pros.length === 0 ? (
        <EmptyPros />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Count */}
          <Text style={dir.count}>{pros.length} professionnel{pros.length > 1 ? 's' : ''}</Text>
          {pros.map(pro => (
            <ProCard key={pro.id} pro={pro} onContact={setContactPro} />
          ))}
        </ScrollView>
      )}

      {/* Contact modal */}
      <ContactProModal
        pro={contactPro}
        onClose={() => setContactPro(null)}
      />
    </View>
  );
}

const dir = StyleSheet.create({
  header:     { paddingHorizontal:EDGE, paddingTop:10, paddingBottom:14 },
  eyebrow:    { color:C.textTert, fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:2 },
  title:      { color:C.text, fontSize:26, fontWeight:'800', letterSpacing:-0.5 },
  searchWrap: { marginHorizontal:EDGE, marginBottom:14, borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:C.border },
  searchRow:  { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingVertical:12 },
  searchInput:{ flex:1, color:C.text, fontSize:14, fontWeight:'500' },
  loader:     { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  loaderTxt:  { color:C.textSec, fontSize:13 },
  retryBtn:   { marginTop:8, paddingHorizontal:22, paddingVertical:10, borderRadius:14, backgroundColor:C.navyLight, borderWidth:1, borderColor:C.borderHi },
  count:      { color:C.textTert, fontSize:12, paddingHorizontal:EDGE, marginBottom:12 },
});
