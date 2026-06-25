/**
 * components/gamification/types.ts
 * Tous les types TypeScript de la gamification Universe
 */

// ─── PROFIL CINÉPHILE ─────────────────────────────────────────────────────────
export interface GamiProfile {
    xp:                number;
    level:             number;
    title:             string;
    streak_days:       number;
    longest_streak:    number;
    pct:               number;   // 0..1 dans le niveau courant
    xpToNext:          number;
    xpInLevel:         number;
    contribution_score: number;
    gems:              number;
    total_days_active: number;
  }
  
  // ─── BADGE ────────────────────────────────────────────────────────────────────
  export type Rarity = 'commun' | 'rare' | 'épique' | 'légendaire';
  
  export interface GamiBadge {
    id:          string;
    label:       string;
    description: string;
    impact:      string;         // phrase d'impact émotionnelle
    icon:        string;
    rarity:      Rarity;
    xp_reward:   number;
    gems_reward: number;
    earned:      boolean;
    earned_at?:  string;
    is_hidden:   boolean;
  }
  
  // ─── QUÊTE ────────────────────────────────────────────────────────────────────
  export interface QuestDef {
    id:           string;
    title:        string;
    desc:         string;
    hook:         string;        // phrase d'incitation émotionnelle
    target:       number;
    xp:           number;
    gems:         number;
    reward_badge: string | null;
    action:       string;
    route:        string;
    icon:         string;
  }
  
  export interface QuestProgress {
    quest_id:     string;
    progress:     number;
    completed:    boolean;
    completed_at?: string;
  }
  
  export interface QuestWithProgress extends QuestDef {
    progress:   number;
    completed:  boolean;
    pct:        number;
  }
  
  // ─── CHALLENGE QUOTIDIEN ──────────────────────────────────────────────────────
  export interface DailyChallengeBase {
    id:     string;
    title:  string;
    desc:   string;
    xp:     number;
    gems:   number;
    icon:   string;
    route:  string;
  }
  
  export interface DailyChallenge extends DailyChallengeBase {
    completed: boolean;
    claimedAt?: string;
  }
  
  // ─── CHECK-IN QUOTIDIEN ───────────────────────────────────────────────────────
  export interface DailyCheckin {
    streak_day: number;
    claimed:    boolean;
    xp_earned:  number;
    gems_earned: number;
    badge_id?:  string;
  }
  
  export interface StreakReward {
    xp:     number;
    gems:   number;
    badge?: string;
    label:  string;
    rarity: Rarity;
    color:  string;
  }
  
  // ─── CHALLENGE HEBDO ─────────────────────────────────────────────────────────
  export interface ChallengeStep {
    index:       number;
    title:       string;
    desc:        string;
    action:      string;
    actionLabel: string;
    icon:        string;
    xp:          number;
    tip:         string;
  }
  
  export type Difficulty = 'facile' | 'normal' | 'difficile' | 'légendaire';
  
  export interface WeeklyChallenge {
    id:            number;
    week_number:   number;
    title:         string;
    subtitle:      string | null;
    description:   string;
    narrative:     string | null;
    icon:          string;
    color_accent:  string;
    steps:         ChallengeStep[];
    filter_config: { type: string; value?: any; max?: number } | null;
    reward_label:  string | null;
    reward_points: number;
    reward_xp:     number;
    difficulty:    Difficulty;
  }
  
  export interface WeeklyChallengeProgress {
    step_index:     number;
    steps_done:     number[];
    completed:      boolean;
    points_earned:  number;
    xp_earned:      number;
    reward_claimed: boolean;
    time_spent_s:   number;
  }
  
  // ─── SCORE DE CONTRIBUTION ────────────────────────────────────────────────────
  export interface ContributionScore {
    total_score:           number;
    useful_reviews:        number;
    saved_recommendations: number;
    quality_comments:      number;
    valid_reports:         number;
    followed_playlists:    number;
    shared_films:          number;
    pepites_detected:      number;
  }
  
  // ─── CLASSEMENT ───────────────────────────────────────────────────────────────
  export interface LeaderEntry {
    user_id:      string;
    display_name: string;
    avatar_url?:  string;
    xp:           number;
    level:        number;
    title:        string;
    streak_days:  number;
    rank:         number;
  }
  
  // ─── WORK ────────────────────────────────────────────────────────────────────
  export interface Work {
    id:          number;
    title:       string;
    category:    string;
    genre:       string;
    year:        number;
    likes:       number;
    image:       string | null;
    is_original: boolean;
    duration:    number | null;
  }