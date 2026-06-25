import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useRouter }     from 'expo-router';
import GalaxyBackground  from '@/components/shared/GalaxyBackground';

import {
  useDeviceId, useProfile, useBadges, useQuests,
  useDailyCheckin, useDailyChallenges, useWeeklyChallenge,
  useLeaderboard,
} from '../hooks';
import { XPBar }                   from '../ui/XPBar';
import { ManifestoCard }           from '../ui/ManifestoCard';
import { DailyRewardCard }         from '../ui/DailyRewardCard';
import { DailyChallengesSection }  from '../ui/DailyChallengesSection';
import { QuestsPanel }             from '../ui/QuestsPanel';
import { BadgeGrid }               from '../ui/BadgeChip';
import { LeaderboardSection }      from '../ui/LeaderboardSection';
import { LevelUpModal }            from '../ui/LevelUpModal';
import { BadgeUnlockedToast }      from '../ui/BadgeUnlockedToast';
import { XPFloat }                 from '../ui/XPFloat';

let _Haptics: any = null;
if (Platform.OS !== 'web') { try { _Haptics = require('expo-haptics'); } catch {} }
const hapticSoft = () => _Haptics?.notificationAsync?.(_Haptics.NotificationFeedbackType?.Success).catch(() => {});

const EDGE = 16;

const C = {
  bg:     '#070C17',
  gold:   '#F5C842',
  blue:   '#5A96E6',
  green:  '#2ECC8A',
  white:  '#FFFFFF',
  muted:  'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.08)',
  faint:  'rgba(255,255,255,0.05)',
};

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────
function Section({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ marginHorizontal: EDGE, marginBottom: 18 }, style]}>{children}</View>;
}

// ─── WEEKLY CHALLENGE MINI ────────────────────────────────────────────────────
function WeeklyMini({ challenge, progress, weekNum, onClaim, onOpen }: any) {
  if (!challenge) return null;
  const accent     = challenge.color_accent ?? '#5A96E6';
  const total      = challenge.steps?.length ?? 0;
  const doneSteps  = progress?.steps_done?.length ?? 0;
  const isDone     = progress?.completed ?? false;
  const canClaim   = isDone && !progress?.reward_claimed;
  const pct        = total > 0 ? doneSteps / total : 0;

  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={[wm.wrap, { borderColor: `${accent}35` }]}>
      <View style={[wm.strip, { backgroundColor: accent }]} />
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[wm.icon, { backgroundColor: `${accent}18`, borderColor: `${accent}35` }]}>
            <Ionicons name={challenge.icon} size={20} color={accent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[wm.pill, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}>
                <Text style={[wm.pillTxt, { color: accent }]}>SEM. {weekNum} · {(challenge.difficulty ?? '').toUpperCase()}</Text>
              </View>
              {isDone && (
                <View style={[wm.pill, { backgroundColor: 'rgba(46,204,138,0.10)', borderColor: 'rgba(46,204,138,0.28)' }]}>
                  <Ionicons name="checkmark-circle" size={8} color={C.green} />
                  <Text style={[wm.pillTxt, { color: C.green }]}>TERMINÉ</Text>
                </View>
              )}
            </View>
            <Text style={[wm.title, { color: accent === '#5A96E6' ? C.white : accent }]}>{challenge.title}</Text>
            {challenge.subtitle && <Text style={wm.subtitle}>{challenge.subtitle}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={14} color={C.muted} />
        </View>

        <View style={{ gap: 5 }}>
          <View style={wm.track}>
            <View style={[wm.fill, { width: `${pct * 100}%` as any, backgroundColor: accent }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 10 }}>
              {isDone ? 'Terminé !' : doneSteps === 0 ? `${total} étapes` : `${doneSteps}/${total} étapes`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star-outline" size={8} color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 9 }}>{challenge.reward_points} pts</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="flash" size={8} color={C.gold} />
                <Text style={{ color: C.gold, fontSize: 9, fontWeight: '700' }}>+{challenge.reward_xp} XP</Text>
              </View>
            </View>
          </View>
        </View>

        {canClaim && (
          <TouchableOpacity onPress={onClaim} activeOpacity={0.85} style={wm.claimBtn}>
            <Ionicons name="gift-outline" size={14} color={accent} />
            <Text style={[wm.claimTxt, { color: accent }]}>Réclamer la récompense du défi !</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const wm = StyleSheet.create({
  wrap:     { borderRadius: 16, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  strip:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  icon:     { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  pillTxt:  { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.6 },
  title:    { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: C.muted, fontSize: 11 },
  track:    { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: 2 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', backgroundColor: 'rgba(255,255,255,0.06)' },
  claimTxt: { fontSize: 13, fontWeight: '800' },
});

// ─── ★ GAMIFICATION SCREEN ────────────────────────────────────────────────────
export default function GamificationScreen() {
  const router   = useRouter();
  const userId   = useDeviceId();
  const [refreshing, setRefreshing] = useState(false);
  const [showXP,     setShowXP]     = useState(false);
  const [xpAmount,   setXPAmount]   = useState(0);

  const { profile, loading: profLoad, reload, awardXP, addGems, leveledUp, dismissLevelUp } = useProfile(userId);
  const { badges, earned, loading: badgeLoad, award: awardBadge, freshBadge, dismissFreshBadge } = useBadges(userId);
  const { quests, completedCount, increment } = useQuests(userId);
  const { checkin, loading: checkinLoad, claiming, claim } = useDailyCheckin(userId);
  const { challenges, doneCount, complete: completeChallenge } = useDailyChallenges(userId);
  const { challenge, progress, weekNum, claimReward } = useWeeklyChallenge(userId);
  const { leaders, myRank } = useLeaderboard(userId);

  const showXPFloat = (amount: number) => {
    setXPAmount(amount);
    setShowXP(true);
  };

  const handleDailyClaim = useCallback(() => {
    if (!profile) return;
    claim(profile.streak_days, (xp, gems, badge) => {
      hapticSoft();
      showXPFloat(xp);
      awardXP(xp, 'daily_checkin');
      if (gems > 0) addGems(gems);
      if (badge) awardBadge(badge);
    });
  }, [profile, claim, awardXP, addGems, awardBadge]);

  const handleDailyComplete = useCallback((id: string, xp: number) => {
    completeChallenge(id, xp);
    showXPFloat(xp);
    // Check if all 3 done → award bonus
    if (doneCount === 2) {
      setTimeout(() => {
        awardXP(50, 'daily_bonus_all');
        showXPFloat(50);
        Alert.alert('🎉 Bonus débloqué !', '+50 XP bonus pour avoir complété les 3 défis du jour !');
      }, 800);
    }
  }, [completeChallenge, doneCount, awardXP]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload().finally(() => setRefreshing(false));
  }, [reload]);

  const loading = profLoad || badgeLoad;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Level-up & Badge toast (floating, zIndex 9999) */}
      {leveledUp && (
        <LevelUpModal
          level={leveledUp.level}
          title={leveledUp.title}
          visible={!!leveledUp}
          onClose={dismissLevelUp}
        />
      )}
      <BadgeUnlockedToast badge={freshBadge} visible={!!freshBadge} onDone={dismissFreshBadge} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: 4, paddingBottom: 12, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 2 }}>UNIVERSE · GAME</Text>
            <Text style={{ color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>Mon Parcours</Text>
          </View>
          {profile && (
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(245,200,66,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.28)' }}>
              <Text style={{ fontSize: 13 }}>💎</Text>
              <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900' }}>{profile.gems}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.faint, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={15} color={C.muted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <ActivityIndicator color={C.blue} size="large" />
            <Text style={{ color: C.muted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 40 }}>
              "Le cinéma n'attend pas. Mais votre voyage se prépare."
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.muted} />}
          >
            {/* XP Float */}
            <View style={{ position: 'relative' }}>
              <XPFloat amount={xpAmount} visible={showXP} onDone={() => setShowXP(false)} />
            </View>

            {/* Manifeste */}
            <Section><ManifestoCard /></Section>

            {/* Profil XP */}
            {profile && (
              <Section>
                <XPBar profile={profile} />
              </Section>
            )}

            {/* Récompense quotidienne */}
            <Section>
              <View style={sc.sectionHeader}>
                <Ionicons name="gift-outline" size={13} color={C.muted} />
                <Text style={sc.sectionTitle}>Récompense du jour</Text>
              </View>
              <DailyRewardCard
                checkin={checkin}
                streak={profile?.streak_days ?? 0}
                loading={checkinLoad}
                claiming={claiming}
                onClaim={handleDailyClaim}
              />
            </Section>

            {/* Défis quotidiens */}
            <Section>
              <DailyChallengesSection
                challenges={challenges}
                doneCount={doneCount}
                onComplete={handleDailyComplete}
                onNavigate={route => router.push(route as any)}
              />
            </Section>

            {/* Défi hebdomadaire */}
            <Section>
              <View style={sc.sectionHeader}>
                <Ionicons name="flame-outline" size={13} color={C.muted} />
                <Text style={sc.sectionTitle}>Défi hebdomadaire</Text>
              </View>
              <WeeklyMini
                challenge={challenge}
                progress={progress}
                weekNum={weekNum}
                onClaim={async () => { await claimReward(); awardXP(challenge?.reward_xp ?? 0, 'weekly_reward'); showXPFloat(challenge?.reward_xp ?? 0); }}
                onOpen={() => {/* Navigate to full challenge modal */}}
              />
            </Section>

            {/* Quêtes */}
            <Section>
              <QuestsPanel
                quests={quests}
                doneCount={completedCount}
                onNavigate={route => router.push(route as any)}
              />
            </Section>

            {/* Badges */}
            <Section>
              <View style={[sc.sectionHeader, { marginBottom: 12 }]}>
                <Ionicons name="ribbon-outline" size={13} color={C.muted} />
                <Text style={sc.sectionTitle}>Collection de badges</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{earned.length}/{badges.length}</Text>
              </View>
              <BadgeGrid badges={badges} columns={4} />
            </Section>

            {/* Classement */}
            {leaders.length > 0 && (
              <Section>
                <LeaderboardSection leaders={leaders} myRank={myRank} userId={userId} />
              </Section>
            )}

            {/* Footer */}
            <Section>
              <View style={sc.footer}>
                <Ionicons name="film-outline" size={20} color={C.muted} />
                <Text style={sc.footerTxt}>
                  "{profile?.title ?? 'Spectateur curieux'}"
                  {'\n'}Revenez demain pour progresser encore.
                </Text>
              </View>
            </Section>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const sc = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1 },
  footer:        { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.faint, alignItems: 'center', gap: 8 },
  footerTxt:     { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },
});