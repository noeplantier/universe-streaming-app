/**
 * components/gamification/index.ts
 * Barrel export — importez tout depuis '@/components/gamification'
 *
 * Usage rapide :
 *   import { useProfile, useDeviceId, XPBar, DailyRewardCard } from '@/components/gamification';
 *   import GamificationScreen from '@/components/gamification/screen/GamificationScreen';
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
    GamiProfile, GamiBadge, QuestDef, QuestWithProgress,
    DailyChallenge, DailyCheckin, StreakReward,
    WeeklyChallenge, WeeklyChallengeProgress,
    ContributionScore, LeaderEntry, Work, Rarity, Difficulty,
  } from './types';
  
  // ─── Constants ────────────────────────────────────────────────────────────────
  export {
    XP_TABLE, TITLES, LEVEL_COLORS, STREAK_REWARDS, LEVEL_UP_COPY,
    CINEMA_MANIFESTO, BADGES_CATALOG, QUEST_DEFINITIONS,
    ALL_DAILY_CHALLENGES, getTodaysChallenges, todayStr, dailyQuestKey,
    getStreakReward, RARITY_COLOR, RARITY_BG, RARITY_LABEL, DIFF_COLOR,
  } from './constants';
  
  // ─── Hooks ────────────────────────────────────────────────────────────────────
  export {
    isValidUUID, xpToLevel,
    useDeviceId,
    useProfile,
    useBadges,
    useQuests,
    useDailyCheckin,
    useDailyChallenges,
    useWeeklyChallenge,
    useLeaderboard,
    useContributionScore,
  } from './hooks';
  
  // ─── UI Components ────────────────────────────────────────────────────────────
  export { XPBar }              from './ui/XPBar';
  export { XPFloat }            from './ui/XPFloat';
  export { ParticleBurst }      from './ui/ParticleBurst';
  export { ManifestoCard }      from './ui/ManifestoCard';
  export { DailyRewardCard }    from './ui/DailyRewardCard';
  export { DailyChallengesSection } from './ui/DailyChallengesSection';
  export { QuestsPanel }        from './ui/QuestsPanel';
  export { BadgeChip, BadgesRow, BadgeGrid } from './ui/BadgeChip';
  export { LeaderboardSection } from './ui/LeaderboardSection';
  export { LevelUpModal }       from './ui/LevelUpModal';
  export { BadgeUnlockedToast } from './ui/BadgeUnlockedToast';