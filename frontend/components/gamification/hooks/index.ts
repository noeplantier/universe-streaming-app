/**
 * components/gamification/hooks/index.ts
 * Tous les hooks Universe Gamification — getDeviceId() / isValidUUID()
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase }    from '@/lib/supabase';
import { getDeviceId } from '@/services/api';
import {
  XP_TABLE, TITLES, BADGES_CATALOG, QUEST_DEFINITIONS,
  getTodaysChallenges, dailyQuestKey, todayStr, getStreakReward,
} from '../constants';
import type {
  GamiProfile, GamiBadge, QuestWithProgress, DailyChallenge,
  DailyCheckin, WeeklyChallenge, WeeklyChallengeProgress,
  ContributionScore, LeaderEntry,
} from '../types';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export const isValidUUID = (v?: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function xpToLevel(xp: number) {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1; else break;
  }
  level = Math.min(level, 10);
  const base = XP_TABLE[level - 1];
  const next = level < 10 ? XP_TABLE[level] : XP_TABLE[9] * 2;
  const inLvl = xp - base, range = next - base;
  return { level, pct: range > 0 ? Math.min(1, inLvl / range) : 1, xpInLevel: inLvl, xpToNext: Math.max(0, range - inLvl) };
}

function currentWeek(): number {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - ys.getTime()) / 86400000 + 1) / 7);
}

// ─── useDeviceId ─────────────────────────────────────────────────────────────
export function useDeviceId() {
  const [uid, setUid] = useState('');
  useEffect(() => { getDeviceId().then(id => setUid(id)); }, []);
  return uid;
}

// ─── useProfile ──────────────────────────────────────────────────────────────
export function useProfile(userId: string) {
  const [profile, setProfile] = useState<GamiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const prevLevel = useRef(0);
  const [leveledUp, setLeveledUp] = useState<{ level: number; title: string } | null>(null);

  const load = useCallback(async () => {
    if (!isValidUUID(userId)) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('xp,level,title,streak_days,longest_streak,contribution_score,gems,total_days_active')
      .eq('user_id', userId).maybeSingle();
    if (data) {
      const lvl = xpToLevel(data.xp ?? 0);
      const p: GamiProfile = {
        xp: data.xp ?? 0, level: data.level ?? lvl.level, title: data.title ?? TITLES[lvl.level - 1],
        streak_days: data.streak_days ?? 0, longest_streak: data.longest_streak ?? 0,
        pct: lvl.pct, xpToNext: lvl.xpToNext, xpInLevel: lvl.xpInLevel,
        contribution_score: data.contribution_score ?? 0,
        gems: data.gems ?? 0, total_days_active: data.total_days_active ?? 0,
      };
      if (prevLevel.current > 0 && p.level > prevLevel.current) setLeveledUp({ level: p.level, title: p.title });
      prevLevel.current = p.level;
      setProfile(p);
    } else {
      await supabase.from('profiles').upsert({ user_id: userId, xp: 0 }, { onConflict: 'user_id' }).match(() => {});
      setProfile({ xp: 0, level: 1, title: TITLES[0], streak_days: 0, longest_streak: 0, pct: 0, xpToNext: 100, xpInLevel: 0, contribution_score: 0, gems: 0, total_days_active: 0 });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const awardXP = useCallback(async (amount: number, reason: string) => {
    if (!isValidUUID(userId)) return;
    await supabase.rpc('add_xp', { p_user_id: userId, p_xp: amount, p_reason: reason }).match(() => {});
    setProfile(prev => {
      if (!prev) return prev;
      const newXp = prev.xp + amount;
      const lvl = xpToLevel(newXp);
      if (lvl.level > prev.level) setLeveledUp({ level: lvl.level, title: TITLES[lvl.level - 1] });
      return { ...prev, xp: newXp, ...lvl, title: TITLES[lvl.level - 1] };
    });
  }, [userId]);

  const addGems = useCallback(async (n: number) => {
    if (!isValidUUID(userId)) return;
    await supabase.from('profiles')
      .upsert({ user_id: userId, gems: (profile?.gems ?? 0) + n }, { onConflict: 'user_id' }).match(() => {});
    setProfile(prev => prev ? { ...prev, gems: (prev.gems ?? 0) + n } : prev);
  }, [userId, profile?.gems]);

  return { profile, loading, reload: load, awardXP, addGems, leveledUp, dismissLevelUp: () => setLeveledUp(null), setProfile };
}

// ─── useBadges ───────────────────────────────────────────────────────────────
export function useBadges(userId: string) {
  const [badges, setBadges]   = useState<GamiBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [freshBadge, setFreshBadge] = useState<GamiBadge | null>(null);

  useEffect(() => {
    if (!isValidUUID(userId)) { setLoading(false); return; }
    let dead = false;
    Promise.all([
      supabase.from('badges').select('id,label,description,icon,rarity,xp_reward,is_hidden').eq('is_hidden', false),
      supabase.from('user_badges').select('badge_id,earned_at').eq('user_id', userId),
    ]).then(([bR, uR]) => {
      if (dead) return;
      const em = new Map((uR.data ?? []).map((r: any) => [r.badge_id, r.earned_at]));
      const dbBadges: GamiBadge[] = (bR.data ?? []).map((b: any) => ({
        ...b,
        impact:      BADGES_CATALOG.find(c => c.id === b.id)?.impact ?? b.description,
        gems_reward: BADGES_CATALOG.find(c => c.id === b.id)?.gems_reward ?? 0,
        earned: em.has(b.id), earned_at: em.get(b.id) ?? undefined,
      }));
      const merged = dbBadges.length > 0 ? dbBadges
        : BADGES_CATALOG.map(b => ({ ...b, earned: em.has(b.id), earned_at: em.get(b.id) })) as GamiBadge[];
      setBadges(merged); setLoading(false);
    }).catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [userId]);

  const award = useCallback(async (badgeId: string) => {
    if (!isValidUUID(userId) || badges.find(b => b.id === badgeId && b.earned)) return;
    const { error } = await supabase.from('user_badges')
      .upsert({ user_id: userId, badge_id: badgeId }, { onConflict: 'user_id,badge_id' });
    if (!error) {
      const badge = badges.find(b => b.id === badgeId);
      setBadges(prev => prev.map(b => b.id === badgeId ? { ...b, earned: true, earned_at: new Date().toISOString() } : b));
      if (badge) setFreshBadge({ ...badge, earned: true });
    }
  }, [userId, badges]);

  const earned = useMemo(() => badges.filter(b => b.earned), [badges]);
  const locked = useMemo(() => badges.filter(b => !b.earned), [badges]);
  return { badges, earned, locked, loading, award, freshBadge, dismissFreshBadge: () => setFreshBadge(null) };
}

// ─── useQuests ───────────────────────────────────────────────────────────────
export function useQuests(userId: string) {
  const [progressMap, setProgressMap] = useState<Map<string, { progress: number; completed: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isValidUUID(userId)) { setLoading(false); return; }
    supabase.from('user_quests').select('quest_id,progress,completed').eq('user_id', userId)
      .in('quest_id', QUEST_DEFINITIONS.map(q => q.id))
      .then(({ data }) => {
        const m = new Map<string, { progress: number; completed: boolean }>();
        (data ?? []).forEach((r: any) => m.set(r.quest_id, { progress: r.progress ?? 0, completed: r.completed ?? false }));
        setProgressMap(m); setLoading(false);
      }).catch(() => setLoading(false));
  }, [userId]);

  const increment = useCallback(async (questId: string, by = 1) => {
    if (!isValidUUID(userId)) return;
    const def = QUEST_DEFINITIONS.find(q => q.id === questId); if (!def) return;
    const prev = progressMap.get(questId); if (prev?.completed) return;
    const np = Math.min((prev?.progress ?? 0) + by, def.target);
    const done = np >= def.target;
    setProgressMap(m => { const nm = new Map(m); nm.set(questId, { progress: np, completed: done }); return nm; });
    await supabase.from('user_quests').upsert(
      { user_id: userId, quest_id: questId, progress: np, completed: done, completed_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,quest_id' },
    ).match(() => {});
  }, [userId, progressMap]);

  const quests: QuestWithProgress[] = useMemo(() =>
    QUEST_DEFINITIONS.map(q => ({
      ...q, progress: progressMap.get(q.id)?.progress ?? 0,
      completed: progressMap.get(q.id)?.completed ?? false,
      pct: Math.min(1, (progressMap.get(q.id)?.progress ?? 0) / q.target),
    })), [progressMap]);

  return { quests, completedCount: quests.filter(q => q.completed).length, loading, increment };
}

// ─── useDailyCheckin ─────────────────────────────────────────────────────────
export function useDailyCheckin(userId: string) {
  const [checkin, setCheckin]   = useState<DailyCheckin | null>(null);
  const [loading, setLoading]   = useState(true);
  const [claiming, setClaiming] = useState(false);
  const today = todayStr();

  useEffect(() => {
    if (!isValidUUID(userId)) { setLoading(false); return; }
    supabase.from('daily_checkins').select('streak_day,claimed,xp_earned,badge_id')
      .eq('user_id', userId).eq('date', today).maybeSingle()
      .then(({ data }) => {
        if (data) setCheckin({ streak_day: data.streak_day ?? 1, claimed: data.claimed ?? false, xp_earned: data.xp_earned ?? 10, gems_earned: 0, badge_id: data.badge_id ?? undefined });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [userId, today]);

  const claim = useCallback(async (currentStreak: number, onSuccess: (xp: number, gems: number, badge?: string) => void) => {
    if (!isValidUUID(userId) || checkin?.claimed || claiming) return;
    setClaiming(true);
    try {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      const { data: yData } = await supabase.from('daily_checkins').select('streak_day').eq('user_id', userId).eq('date', yStr).maybeSingle();
      const newStreak = yData ? currentStreak + 1 : 1;
      const reward = getStreakReward(newStreak);
      await supabase.from('daily_checkins').upsert(
        { user_id: userId, date: today, streak_day: newStreak, xp_earned: reward.xp, claimed: true, reward_type: 'streak', badge_id: reward.badge ?? null },
        { onConflict: 'user_id,date' },
      ).match(() => {});
      await supabase.from('profiles').upsert(
        { user_id: userId, streak_days: newStreak, last_active_date: today, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ).match(() => {});
      if (reward.badge) await supabase.from('user_badges').upsert({ user_id: userId, badge_id: reward.badge }, { onConflict: 'user_id,badge_id' }).match(() => {});
      setCheckin({ streak_day: newStreak, claimed: true, xp_earned: reward.xp, gems_earned: reward.gems, badge_id: reward.badge });
      onSuccess(reward.xp, reward.gems, reward.badge);
    } finally { setClaiming(false); }
  }, [userId, checkin, claiming, today]);

  return { checkin, loading, claiming, claim };
}

// ─── useDailyChallenges ──────────────────────────────────────────────────────
export function useDailyChallenges(userId: string) {
  const [completedSet, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading]        = useState(true);
  const todayChallenges = useMemo(() => getTodaysChallenges(), []);

  useEffect(() => {
    if (!isValidUUID(userId)) { setLoading(false); return; }
    const keys = todayChallenges.map(c => dailyQuestKey(c.id));
    supabase.from('user_quests').select('quest_id,completed').eq('user_id', userId).in('quest_id', keys)
      .then(({ data }) => {
        const s = new Set((data ?? []).filter((r: any) => r.completed).map((r: any) => r.quest_id));
        setCompleted(s); setLoading(false);
      }).catch(() => setLoading(false));
  }, [userId]);

  const complete = useCallback(async (id: string, xp: number) => {
    if (!isValidUUID(userId)) return;
    const qid = dailyQuestKey(id);
    await supabase.from('user_quests').upsert(
      { user_id: userId, quest_id: qid, progress: 1, completed: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,quest_id' },
    ).match(() => {});
    await supabase.rpc('add_xp', { p_user_id: userId, p_xp: xp, p_reason: `daily_${id}` }).match(() => {});
    setCompleted(s => { const ns = new Set(s); ns.add(qid); return ns; });
  }, [userId]);

  const challenges: DailyChallenge[] = useMemo(() =>
    todayChallenges.map(c => ({ ...c, completed: completedSet.has(dailyQuestKey(c.id)) })),
    [todayChallenges, completedSet],
  );
  const doneCount = challenges.filter(c => c.completed).length;
  return { challenges, doneCount, bonusEarned: doneCount >= 3, loading, complete };
}

// ─── useWeeklyChallenge ──────────────────────────────────────────────────────
export function useWeeklyChallenge(userId: string) {
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [progress,  setProgress]  = useState<WeeklyChallengeProgress | null>(null);
  const [loading,   setLoading]   = useState(true);
  const weekNum = useMemo(() => currentWeek(), []);

  useEffect(() => {
    let dead = false;
    supabase.from('weekly_challenges')
      .select('id,week_number,title,subtitle,description,narrative,icon,color_accent,steps,filter_config,reward_label,reward_points,reward_xp,difficulty')
      .eq('week_number', weekNum).maybeSingle()
      .then(({ data }) => {
        if (!dead && data) setChallenge({ ...data, steps: Array.isArray(data.steps) ? data.steps : [], filter_config: data.filter_config ?? null, narrative: data.narrative ?? null, subtitle: data.subtitle ?? null, reward_label: data.reward_label ?? null } as WeeklyChallenge);
        if (!dead) setLoading(false);
      }).catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [weekNum]);

  useEffect(() => {
    if (!isValidUUID(userId)) return;
    let dead = false;
    supabase.from('challenge_progress')
      .select('step_index,steps_done,completed,points_earned,xp_earned,reward_claimed,time_spent_s')
      .eq('user_id', userId).eq('week_number', weekNum).maybeSingle()
      .then(({ data }) => {
        if (!dead && data) setProgress({ step_index: data.step_index ?? 0, steps_done: Array.isArray(data.steps_done) ? data.steps_done : [], completed: data.completed ?? false, points_earned: data.points_earned ?? 0, xp_earned: data.xp_earned ?? 0, reward_claimed: data.reward_claimed ?? false, time_spent_s: data.time_spent_s ?? 0 });
      }).catch(() => {});
    return () => { dead = true; };
  }, [userId, weekNum]);

  const advanceStep = useCallback(async (stepIndex: number, isDone: boolean) => {
    if (!isValidUUID(userId) || !challenge) return;
    const total = challenge.steps.length;
    const points = isDone ? challenge.reward_points : Math.floor(challenge.reward_points * stepIndex / Math.max(1, total));
    const xp = isDone ? challenge.reward_xp : Math.floor(challenge.reward_xp * stepIndex / Math.max(1, total));
    const steps_done = [...new Set([...(progress?.steps_done ?? []), stepIndex])];
    setProgress(p => ({ ...(p ?? { step_index: 0, steps_done: [], completed: false, points_earned: 0, xp_earned: 0, reward_claimed: false, time_spent_s: 0 }), step_index: stepIndex, steps_done, completed: isDone, points_earned: points, xp_earned: xp }));
    await supabase.from('challenge_progress').upsert(
      { user_id: userId, week_number: weekNum, step_index: stepIndex, steps_done, completed: isDone, points_earned: points, xp_earned: xp, completed_at: isDone ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,week_number' },
    ).match(() => {});
  }, [userId, weekNum, challenge, progress]);

  const claimReward = useCallback(async () => {
    if (!isValidUUID(userId) || !progress?.completed || progress?.reward_claimed) return;
    await supabase.from('challenge_progress').update({ reward_claimed: true }).eq('user_id', userId).eq('week_number', weekNum).match(() => {});
    setProgress(p => p ? { ...p, reward_claimed: true } : p);
  }, [userId, weekNum, progress]);

  return { challenge, progress, weekNum, loading, advanceStep, claimReward };
}

// ─── useLeaderboard ──────────────────────────────────────────────────────────
export function useLeaderboard(userId: string) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [myRank,  setMyRank]  = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from('v_leaderboard').select('user_id,display_name,avatar_url,xp,level,title,streak_days,rank').limit(10)
      .then(({ data }) => {
        if (data) { setLeaders(data as LeaderEntry[]); if (isValidUUID(userId)) { const me = data.find((r: any) => r.user_id === userId); if (me) setMyRank(me.rank); } }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [userId]);
  return { leaders, myRank, loading };
}

// ─── useContributionScore ────────────────────────────────────────────────────
export function useContributionScore(userId: string) {
  const [score, setScore]     = useState<ContributionScore>({ total_score: 0, useful_reviews: 0, saved_recommendations: 0, quality_comments: 0, valid_reports: 0, followed_playlists: 0, shared_films: 0, pepites_detected: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isValidUUID(userId)) { setLoading(false); return; }
    supabase.from('contribution_scores').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data) setScore({ total_score: data.total_score ?? 0, useful_reviews: data.useful_reviews ?? 0, saved_recommendations: data.saved_recommendations ?? 0, quality_comments: data.quality_comments ?? 0, valid_reports: data.valid_reports ?? 0, followed_playlists: data.followed_playlists ?? 0, shared_films: data.shared_films ?? 0, pepites_detected: data.pepites_detected ?? 0 }); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);
  return { score, loading };
}