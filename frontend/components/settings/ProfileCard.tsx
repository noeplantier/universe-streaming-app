import React, { memo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';

import { useSettings }   from './SettingsContext';
import EditProfileModal   from './EditProfileModal';
import { G, ROLE_META }  from './types';

// ─────────────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{fmt(value)}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const ProfileCard = memo(function ProfileCard() {
  const { user } = useSettings();
  const [editOpen, setEditOpen] = useState(false);

  const role = ROLE_META[user.role];

  return (
    <>
      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} />

      <View style={s.cardOuter}>
        {/* Fond glassmorphism avec gradient */}
        <LinearGradient
          colors={['#1A0038', '#2C0064', '#180040']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Lueur d'arrière-plan */}
        <View style={s.glow} pointerEvents="none">
          <LinearGradient
            colors={['rgba(192,96,255,0.30)', 'transparent']}
            style={{ flex: 1 }}
          />
        </View>

        {/* Badge Premium */}
        {user.isPremium && (
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeTxt}>✨ PREMIUM</Text>
          </View>
        )}

        <View style={s.cardInner}>
          {/* Avatar + anneau dégradé */}
          <TouchableOpacity onPress={() => setEditOpen(true)} activeOpacity={0.9}>
            <LinearGradient
              colors={['#C060FF', '#86EEFF', '#FFD60A']}
              start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
              style={s.avatarRing}
            >
              <View style={s.avatarInner}>
                <Image source={{ uri: user.avatar_url }} style={s.avatar} />
              </View>
            </LinearGradient>
            <View style={s.editBadge}>
              <Ionicons name="pencil" size={10} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Infos */}
          <View style={s.info}>
            <View style={s.nameRow}>
              <Text style={s.name}>{user.username}</Text>
              <View style={[s.roleBadge, { backgroundColor: role.bg }]}>
                <Text style={[s.roleEmoji]}>{role.emoji}</Text>
                <Text style={[s.roleLabel, { color: role.color }]}>{role.label}</Text>
              </View>
            </View>
            <Text style={s.email} numberOfLines={1}>{user.email}</Text>
            {user.bio ? (
              <Text style={s.bio} numberOfLines={2}>{user.bio}</Text>
            ) : null}
          </View>
        </View>

        {/* Séparateur */}
        <LinearGradient
          colors={['transparent', 'rgba(192,96,255,0.22)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.divider}
        />

        {/* Stats */}
        <View style={s.statsRow}>
          <Stat label="Abonnés"     value={user.followers} />
          <View style={s.statSep} />
          <Stat label="Abonnements" value={user.following} />
          <View style={s.statSep} />
          <Stat label="Publications" value={user.posts} />
        </View>
      </View>
    </>
  );
});

export default ProfileCard;

const s = StyleSheet.create({
  cardOuter:    { marginHorizontal: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.28)', marginBottom: 14 },
  glow:         { position: 'absolute', top: -40, left: -40, width: 160, height: 160, borderRadius: 80 },
  premiumBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(255,214,10,0.18)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,214,10,0.35)', zIndex: 2 },
  premiumBadgeTxt:{ color: G.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  cardInner:    { flexDirection: 'row', gap: 14, padding: 18, alignItems: 'flex-start' },
  avatarRing:   { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarInner:  { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', backgroundColor: G.bg0 },
  avatar:       { width: '100%', height: '100%' },
  editBadge:    { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: G.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: G.bg0 },
  info:         { flex: 1 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  name:         { color: G.sW, fontSize: 17, fontWeight: '800' },
  roleBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  roleEmoji:    { fontSize: 11 },
  roleLabel:    { fontSize: 10, fontWeight: '800' },
  email:        { color: G.textTert, fontSize: 12, marginBottom: 6 },
  bio:          { color: 'rgba(237,232,255,0.55)', fontSize: 12, lineHeight: 17 },
  divider:      { height: 1, marginHorizontal: 0 },
  statsRow:     { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 18 },
  stat:         { flex: 1, alignItems: 'center', gap: 2 },
  statVal:      { color: G.sW, fontSize: 18, fontWeight: '800' },
  statLabel:    { color: G.textTert, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  statSep:      { width: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },
});