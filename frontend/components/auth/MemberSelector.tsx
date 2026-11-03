/**
 * components/auth/MemberSelector.tsx — Sélecteur de membre équipe Universe
 * Les groupes sont purement visuels : onSelect continue de recevoir le même nom.
 */
import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export const TEAM_MEMBERS = [
  { name: 'Chassaing', initials: 'CH', group: 'admin' },
  { name: 'Sharl',     initials: 'SH', group: 'admin' },
  { name: 'BSE',       initials: 'BS', group: 'admin' },
  { name: 'Enzo',      initials: 'EN', group: 'admin' },
  { name: 'Noé',       initials: 'NO', group: 'admin' },
  { name: 'Guest',     initials: 'GU', group: 'guest' },
  { name: 'Real',      initials: 'RE', group: 'real' },
] as const;

type TeamMember = typeof TEAM_MEMBERS[number];
type Props = {
  selected?: string | null;
  onSelect: (name: string) => void;
  disabled?: boolean;
};

const MemberTile = memo(function MemberTile({
  member, selected, disabled, layout, onSelect,
}: {
  member: TeamMember;
  selected: boolean;
  disabled: boolean;
  layout: 'compact' | 'row';
  onSelect: (name: string) => void;
}) {
  const isRow = layout === 'row';
  const caption = member.group === 'guest' ? 'Compte invité' : 'Compte distinct';

  return (
    <Pressable
      onPress={() => !disabled && onSelect(member.name)}
      disabled={disabled}
      accessibilityLabel={`Se connecter en tant que ${member.name}`}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        isRow ? s.tileRow : s.tileCompact,
        selected && s.tileSelected,
        pressed && !disabled && s.tilePressed,
        disabled && s.tileDisabled,
      ]}
    >
      <View style={[s.avatarAura, selected && s.avatarAuraSelected]}>
        <View style={s.avatarCore}>
          <Text style={s.initials}>{member.initials}</Text>
        </View>
      </View>
      <View style={isRow ? s.rowText : undefined}>
        <Text style={[s.name, selected && s.nameSelected]} numberOfLines={1}>
          {member.name}
        </Text>
        {isRow && <Text style={s.caption} numberOfLines={1}>{caption}</Text>}
      </View>
      {selected && <View style={s.selectedMark} />}
    </Pressable>
  );
});

export default memo(function MemberSelector({ selected, onSelect, disabled = false }: Props) {
  const admins = TEAM_MEMBERS.filter(member => member.group === 'admin');
  const distinctAccounts = TEAM_MEMBERS.filter(member => member.group !== 'admin');

  return (
    <View style={s.wrap}>
      <View style={s.adminPanel}>
        <View style={s.headingRow}>
          <View style={s.headingMark} />
          <Text style={s.heading}>ADMINISTRATEURS</Text>
          <Text style={s.count}>05</Text>
        </View>
        <View style={s.adminGrid}>
          {admins.map(member => (
            <MemberTile
              key={member.name}
              member={member}
              selected={selected === member.name}
              disabled={disabled}
              layout="compact"
              onSelect={onSelect}
            />
          ))}
        </View>
      </View>

      <View style={s.distinctRow}>
        {distinctAccounts.map(member => (
          <View key={member.name} style={s.distinctPanel}>
            <View style={s.headingRow}>
              <View style={s.headingMark} />
              <Text style={s.heading}>{member.group === 'guest' ? 'GUEST' : 'REAL'}</Text>
            </View>
            <MemberTile
              member={member}
              selected={selected === member.name}
              disabled={disabled}
              layout="row"
              onSelect={onSelect}
            />
          </View>
        ))}
      </View>
    </View>
  );
});

const gold = '#F5C842';
const webAura = Platform.OS === 'web'
  ? ({ boxShadow: '0 0 13px rgba(245,200,66,0.28)' } as any)
  : {};

const s = StyleSheet.create({
  wrap: { gap: 9, paddingHorizontal: 16 },
  adminPanel: {
    padding: 9,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,200,66,0.20)',
    backgroundColor: 'rgba(8,24,48,0.70)',
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  headingMark: { width: 4, height: 4, borderRadius: 2, backgroundColor: gold },
  heading: { color: 'rgba(255,226,145,0.86)', fontSize: 8, fontWeight: '800', letterSpacing: 1.6 },
  count: { marginLeft: 'auto', color: 'rgba(255,255,255,0.38)', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 5, rowGap: 5 },
  distinctRow: { flexDirection: 'row', gap: 8 },
  distinctPanel: {
    flex: 1,
    padding: 8,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,200,66,0.18)',
    backgroundColor: 'rgba(8,24,48,0.56)',
  },
  tileCompact: {
    flexGrow: 1,
    flexBasis: 52,
    maxWidth: 68,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.12)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  tileRow: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.12)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  tileSelected: {
    borderColor: 'rgba(255,222,128,0.90)',
    backgroundColor: 'rgba(245,200,66,0.09)',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 16px rgba(245,200,66,0.28)' } as any) : { elevation: 4 }),
  },
  tilePressed: { backgroundColor: 'rgba(245,200,66,0.08)' },
  tileDisabled: { opacity: 0.55 },
  avatarAura: {
    width: 43,
    height: 43,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(245,200,66,0.72)',
    backgroundColor: '#0D2240',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: gold,
    shadowRadius: 8,
    shadowOpacity: 0.50,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
    ...webAura,
  },
  avatarAuraSelected: {
    borderColor: '#FFE291',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  avatarCore: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#173A70',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: 'rgba(255,255,255,0.74)', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.25, textAlign: 'center' },
  nameSelected: { color: '#FFFFFF' },
  caption: { color: 'rgba(255,255,255,0.38)', fontSize: 7.5, marginTop: 1 },
  selectedMark: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFE291' },
});
