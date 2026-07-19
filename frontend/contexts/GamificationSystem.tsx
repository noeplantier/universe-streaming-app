import React, {
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import { ParticleBurst } from '@/components/shared/ParticleBurst';
import { GlowAccentCard } from '@/components/shared/GlowAccentCard';
import { SpringToast } from '@/components/shared/SpringToast';

// ─── Web-safe Haptics ─────────────────────────────────────────────────────────
let _Haptics: any = null;
if (Platform.OS !== 'web') { try { _Haptics = require('expo-haptics'); } catch {} }
function hapticLight()   { _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(()=>{}); }
function hapticSuccess() { _Haptics?.notificationAsync?.(_Haptics.NotificationFeedbackType?.Success).catch(()=>{}); }
function hapticWarn()    { _Haptics?.notificationAsync?.(_Haptics.NotificationFeedbackType?.Warning).catch(()=>{}); }

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  bg: '#070C17',
  navyMid: '#0D2040',
  navyLow: '#0A1830',
  navyDark: '#06101F',
  white: '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.88)',
  mid: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.35)',
  faint: 'rgba(255,255,255,0.07)',
  subtle: 'rgba(255,255,255,0.13)',
  border: 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.22)',
  blue: '#5A96E6',
  blueDim: 'rgba(90,150,230,0.18)',
  gold: '#F5C842',
  goldDim: 'rgba(245,200,66,0.14)',
  green: '#2ECC8A',
  greenDim: 'rgba(46,204,138,0.12)',
  red: '#FF3B5C',
  orange: '#F97316',
  purple: '#8B5CF6',
  purpleDim: 'rgba(139,92,246,0.14)',
  teal: '#14B8A6',
  tealDim: 'rgba(20,184,166,0.14)',
  pink: '#EC4899',
  pinkDim: 'rgba(236,72,153,0.14)',
} as const;

export const XP_TABLE = [0, 100, 300, 700, 1500, 3000, 6000, 12000, 25000, 50000] as const;

export const TITLES = [
  'Spectateur curieux',
  'Cinéphile en éveil',
  'Explorateur indé',
  'Critique en herbe',
  'Curateur underground',
  'Chasseur de pépites',
  'Voix du 7ème art',
  'Maître critique',
  'Légende vivante',
  'Immortel du cinéma',
] as const;

export const CINEMA_MANIFESTO = [
  "Les films que personne ne finance ont les histoires que tout le monde doit voir.",
  "Vous n'êtes pas spectateur. Vous êtes leur premier public.",
  "Chaque critique que vous écrivez peut changer le destin d'un cinéaste.",
  "Le 7ème art ne survit que si des gens comme vous continuent de regarder.",
  "Ce que vous découvrez ici, le grand public le découvrira dans dix ans.",
  "Un film indépendant sans spectateur, c'est un cri dans le vide. Vous brisez ce silence.",
  "Il n'y a pas de petits films. Il n'y a que des regards trop petits.",
  "Derrière chaque plan, un cinéaste a mis tout ce qu'il avait. Vous lui devez votre attention.",
  "Votre regard aiguisé vaut plus que n'importe quel algorithme.",
  "Universe : l'endroit où le cinéma vivant cherche ses témoins.",
  "Vous ne regardez pas des films. Vous choisissez quel cinéma mérite d'exister.",
  "Certains collectionnent les films. Les vrais les font exister.",
] as const;

export const LEVEL_UP_COPY: Record<number, { headline: string; body: string }> = {
  2: { headline: "L'éveil commence.", body: "Votre curiosité cinéphile vient de s'allumer. Rien ne sera plus comme avant." },
  3: { headline: "Vous sortez des sentiers.", body: "Vous explorez là où les autres n'osent pas aller. Bienvenue dans l'indépendant." },
  4: { headline: "Votre plume prend vie.", body: "5 critiques. Vous avez donné de la voix à des films qui en avaient désespérément besoin." },
  5: { headline: "Le radar s'active.", body: "Vous faites partie des 5% qui découvrent avant tout le monde. Votre goût est une arme." },
  6: { headline: "Instinct de prédateur.", body: "Vous repérez les pépites que les algorithmes manquent. Les réalisateurs ont besoin de vous." },
  7: { headline: "Une voix dans le chaos.", body: "Universe porte votre parole. D'autres cinéphiles la lisent, la suivent, la respectent." },
  8: { headline: "La maîtrise totale.", body: "Votre contribution au cinéma indépendant est réelle. Mesurable. Irréversible." },
  9: { headline: "Le mythe prend forme.", body: "Peu de gens atteignent ce niveau. Vous faites désormais partie de l'histoire d'Universe." },
  10: { headline: "L'immortalité.", body: "Vous êtes ce que le cinéma indépendant appelle quand il a besoin d'être sauvé." },
};

export const BADGE_IMPACT: Record<string, string> = {
  explorateur_indie: "Vous avez traversé 10 univers que le grand public n'atteindra jamais.",
  nocturne: "Les films les plus honnêtes se regardent quand tout le monde dort.",
  decouvreur_pepites: "Votre instinct cinéphile a devancé tous les algorithmes. C'est rare.",
  festival_lover: "Une programmation entière. Vous avez fait le travail d'un jury.",
  esprit_ouvert: "L'expérimental, c'est le cinéma du futur. Vous y étiez.",
  marathon_spectateur: "6 heures de cinéma. Votre regard ne sera plus jamais le même.",
  critique_herbe: "Votre plume donne une voix à des films qui en avaient besoin. Merci.",
  serial_critic: "10 critiques. Vous avez construit un corpus. Une identité critique.",
  grand_critique: "Votre plume a influencé des destins. C'est plus grand que vous ne le pensez.",
  prescripteur: "Votre recommandation a changé la soirée de quelqu'un. Peut-être sa vie.",
  carte_visite: "Un profil complet est un manifeste. Le vôtre parle à votre place.",
  profil_elite: "Votre présence sur Universe est complète. Vous existez pleinement ici.",
  premier_upload: "Vous avez eu le courage de montrer votre travail. C'est déjà tout.",
  producteur_actif: "5 créations publiées. Vous avez construit quelque chose de réel.",
  studio_confirmed: "Votre série de publications prouve que vous êtes un créateur sérieux.",
  curateur_underground: "10 personnes vous font confiance pour guider leur regard. C'est une responsabilité.",
  ambassadeur_indie: "10 films envoyés dans le monde. Vous propagez ce que les autres ignorent.",
  famille_cinemato: "Vous avez suivi un artiste dans sa vision. C'est ce que font les vrais cinéphiles.",
  rituel_cinephile: "5 jours. Un rituel. Une identité. Vous ne regardez plus, vous pratiquez.",
  legende_7art: "Les légendes du cinéma ne naissent pas en salle. Elles naissent ici.",
  streak_master: "30 jours consécutifs. Vous avez fait du cinéma une pratique quotidienne.",
  genres_voyageur: "5 genres traversés. Votre palette cinéphile est maintenant inépuisable.",
};

const RARITY_COL: Record<string, string> = {
  commun: 'rgba(255,255,255,0.60)',
  rare: C.blue,
  épique: C.purple,
  légendaire: C.gold,
};

const RARITY_LBL: Record<string, string> = {
  commun: 'COMMUN',
  rare: 'RARE',
  épique: 'ÉPIQUE',
  légendaire: 'LÉGENDAIRE',
};

const RARITY_GLOW: Record<string, string> = {
  commun: 'rgba(255,255,255,0.04)',
  rare: C.blueDim,
  épique: C.purpleDim,
  légendaire: C.goldDim,
};

const DIFF_COL: Record<string, string> = {
  facile: C.green,
  normal: C.blue,
  difficile: C.orange,
  légendaire: C.gold,
};

export type PillarKey = 'creator' | 'critique' | 'profile' | 'explorer' | 'watch';

export const PILLAR_DEFS: Record<
  PillarKey,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; desc: string }
> = {
  creator: { label: 'Créateur', icon: 'videocam-outline', color: C.orange, desc: 'Publiez des vidéos, séries et projets.' },
  critique: { label: 'Critique', icon: 'create-outline', color: C.purple, desc: 'Rédigez des critiques détaillées et utiles.' },
  profile: { label: 'Profil', icon: 'person-outline', color: C.teal, desc: 'Complétez et enrichissez votre présence.' },
  explorer: { label: 'Explorateur', icon: 'compass-outline', color: C.blue, desc: 'Découvrez de nouveaux films et créateurs.' },
  watch: { label: 'Spectateur', icon: 'play-circle-outline', color: C.green, desc: 'Visionnez, terminez, accumulez les genres.' },
};

const MULTIPLIER_TIERS = [
  { minStreak: 30, label: '×2.0', value: 2.0, color: C.gold },
  { minStreak: 14, label: '×1.5', value: 1.5, color: C.orange },
  { minStreak: 7, label: '×1.25', value: 1.25, color: C.purple },
  { minStreak: 3, label: '×1.1', value: 1.1, color: C.blue },
  { minStreak: 0, label: '×1.0', value: 1.0, color: C.muted },
] as const;

export interface Work {
  id: number;
  title: string;
  category: string;
  genre: string;
  year: number;
  likes: number;
  image: string | null;
  is_original: boolean;
  duration: number | null;
}

export interface GamiBadge {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire';
  xp_reward: number;
  earned: boolean;
  earned_at?: string;
  is_hidden: boolean;
}

export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  target: number;
  reward_badge: string | null;
  xp: number;
  action: string;
  icon: keyof typeof Ionicons.glyphMap;
  tip: string;
}

export interface QuestProgress {
  quest_id: string;
  progress: number;
  completed: boolean;
  completed_at?: string;
}

export interface ContributionScore {
  total_score: number;
  useful_reviews: number;
  saved_recommendations: number;
  quality_comments: number;
  valid_reports: number;
  followed_playlists: number;
  shared_films: number;
  pepites_detected: number;
}

export interface ChallengeStep {
  index: number;
  title: string;
  desc: string;
  action: string;
  actionLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  xp: number;
  tip: string;
}

export interface WeeklyChallenge {
  id: number;
  week_number: number;
  title: string;
  subtitle: string | null;
  description: string;
  narrative: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  color_accent: string;
  steps: ChallengeStep[];
  filter_config: { type: string; value?: any; max?: number } | null;
  reward_label: string | null;
  reward_points: number;
  reward_xp: number;
  difficulty: 'facile' | 'normal' | 'difficile' | 'légendaire';
}

export interface ChallengeProgress {
  step_index: number;
  steps_done: number[];
  completed: boolean;
  points_earned: number;
  xp_earned: number;
  time_spent_s: number;
}

export interface GamiProfile {
  xp: number;
  level: number;
  title: string;
  streak_days: number;
  xpToNext: number;
  xpInLevel: number;
  pct: number;
  contribution_score: number;
}

export interface GamiState {
  profile: GamiProfile;
  badges: GamiBadge[];
  earnedBadges: GamiBadge[];
  pendingBadges: GamiBadge[];
  loading: boolean;
  checkinsCount: number;
  awardXP: (amount: number, reason: string) => void;
  awardBadge: (badgeId: string) => void;
  refresh: () => void;
}

export interface ProfilePowerField {
  key: string;
  label: string;
  done: boolean;
  xp: number;
  icon: keyof typeof Ionicons.glyphMap;
  pillar: PillarKey;
}

export interface ProfilePower {
  pct: number;
  fields: ProfilePowerField[];
  earnedXP: number;
  totalXP: number;
  tier: 'starter' | 'growing' | 'strong' | 'elite';
}

export interface PillarProgress {
  key: PillarKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  score: number;
  max: number;
  pct: number;
}

export interface XPMultiplier {
  value: number;
  label: string;
  color: string;
  sources: string[];
}

// ─── ★ Défis du jour — EXACTEMENT 4, affichés simultanément ──────────────────
export interface DailyQuestDef {
  id: string;
  title: string;
  desc: string;
  pillar: PillarKey;
  xp: number;
  icon: keyof typeof Ionicons.glyphMap;
  cta: string;
  target: number;
  deepAction: string;
  hint: string;
}

export interface DailyQuestProgress {
  id: string;
  date: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export const QUEST_HOOKS: Record<string, string> = {
  watch_3_same_director: "Ce réalisateur a mis des années à créer son langage. 3 films, et vous le parlez.",
  watch_5_under_5min: "5 minutes. C'est tout ce qu'il faut pour changer votre vision du cinéma.",
  write_5_critiques: "Votre critique de 80 mots peut être la bouée de sauvetage d'un cinéaste.",
  connect_1_pro: "Derrière chaque connexion, une collaboration qui pourrait tout changer.",
  explore_experimental: "Là où les règles s'effondrent, le cinéma renaît. Explorez.",
  watch_5_consecutive: "Un film par jour. Le minimum vital du cinéphile en formation.",
  complete_profile: "Un profil complet multiplie votre impact. 5 minutes pour changer votre présence.",
  upload_first_video: "Le premier upload est toujours le plus difficile. C'est aussi le plus important.",
  watch_3_genres: "Chaque genre est une langue. En parler 3 vous rend intraduisible.",
  write_10_critiques: "10 critiques — vous n'êtes plus un utilisateur. Vous êtes une voix.",
};

export const BADGES_CATALOG: Omit<GamiBadge, 'earned' | 'earned_at'>[] = [
  { id: 'explorateur_indie', label: 'Explorateur indé', description: BADGE_IMPACT.explorateur_indie, icon: 'compass-outline', rarity: 'commun', xp_reward: 15, is_hidden: false },
  { id: 'nocturne', label: 'Cinéphile nocturne', description: BADGE_IMPACT.nocturne, icon: 'moon-outline', rarity: 'commun', xp_reward: 5, is_hidden: false },
  { id: 'decouvreur_pepites', label: 'Découvreur de pépites', description: BADGE_IMPACT.decouvreur_pepites, icon: 'star-outline', rarity: 'rare', xp_reward: 25, is_hidden: false },
  { id: 'festival_lover', label: 'Festival Lover', description: BADGE_IMPACT.festival_lover, icon: 'trophy-outline', rarity: 'rare', xp_reward: 20, is_hidden: false },
  { id: 'esprit_ouvert', label: 'Esprit ouvert', description: BADGE_IMPACT.esprit_ouvert, icon: 'flask-outline', rarity: 'rare', xp_reward: 20, is_hidden: false },
  { id: 'marathon_spectateur', label: 'Marathon spectateur', description: BADGE_IMPACT.marathon_spectateur, icon: 'tv-outline', rarity: 'rare', xp_reward: 30, is_hidden: false },
  { id: 'genres_voyageur', label: 'Voyageur de genres', description: BADGE_IMPACT.genres_voyageur, icon: 'map-outline', rarity: 'rare', xp_reward: 25, is_hidden: false },
  { id: 'critique_herbe', label: 'Critique en herbe', description: BADGE_IMPACT.critique_herbe, icon: 'create-outline', rarity: 'rare', xp_reward: 40, is_hidden: false },
  { id: 'serial_critic', label: 'Critique série', description: BADGE_IMPACT.serial_critic, icon: 'pencil-outline', rarity: 'rare', xp_reward: 35, is_hidden: false },
  { id: 'grand_critique', label: 'Grand critique', description: BADGE_IMPACT.grand_critique, icon: 'document-text-outline', rarity: 'épique', xp_reward: 80, is_hidden: false },
  { id: 'prescripteur', label: 'Prescripteur', description: BADGE_IMPACT.prescripteur, icon: 'thumbs-up-outline', rarity: 'épique', xp_reward: 30, is_hidden: false },
  { id: 'carte_visite', label: 'Carte de visite', description: BADGE_IMPACT.carte_visite, icon: 'id-card-outline', rarity: 'commun', xp_reward: 20, is_hidden: false },
  { id: 'profil_elite', label: 'Profil élite', description: BADGE_IMPACT.profil_elite, icon: 'shield-checkmark-outline', rarity: 'épique', xp_reward: 60, is_hidden: false },
  { id: 'premier_upload', label: 'Premier upload', description: BADGE_IMPACT.premier_upload, icon: 'cloud-upload-outline', rarity: 'commun', xp_reward: 25, is_hidden: false },
  { id: 'producteur_actif', label: 'Producteur actif', description: BADGE_IMPACT.producteur_actif, icon: 'film-outline', rarity: 'rare', xp_reward: 50, is_hidden: false },
  { id: 'studio_confirmed', label: 'Studio confirmé', description: BADGE_IMPACT.studio_confirmed, icon: 'videocam-outline', rarity: 'épique', xp_reward: 100, is_hidden: false },
  { id: 'curateur_underground', label: 'Curateur underground', description: BADGE_IMPACT.curateur_underground, icon: 'bookmark-outline', rarity: 'épique', xp_reward: 50, is_hidden: false },
  { id: 'ambassadeur_indie', label: 'Ambassadeur indé', description: BADGE_IMPACT.ambassadeur_indie, icon: 'share-outline', rarity: 'épique', xp_reward: 60, is_hidden: false },
  { id: 'famille_cinemato', label: 'Famille cinématographique', description: BADGE_IMPACT.famille_cinemato, icon: 'people-outline', rarity: 'commun', xp_reward: 10, is_hidden: false },
  { id: 'rituel_cinephile', label: 'Rituel cinéphile', description: BADGE_IMPACT.rituel_cinephile, icon: 'flame-outline', rarity: 'rare', xp_reward: 25, is_hidden: false },
  { id: 'streak_master', label: 'Streak Master', description: BADGE_IMPACT.streak_master, icon: 'flash-outline', rarity: 'épique', xp_reward: 75, is_hidden: false },
  { id: 'legende_7art', label: 'Légende du 7ème art', description: BADGE_IMPACT.legende_7art, icon: 'planet-outline', rarity: 'légendaire', xp_reward: 200, is_hidden: false },
];

export const QUEST_DEFINITIONS: QuestDef[] = [
  { id: 'watch_3_same_director', title: 'Famille cinématographique', desc: 'Regarder 3 films du même réalisateur', target: 3, reward_badge: 'famille_cinemato', xp: 20, action: 'go_catalog', icon: 'people-outline', tip: QUEST_HOOKS.watch_3_same_director },
  { id: 'watch_5_under_5min', title: 'Amateur de formats courts', desc: 'Découvrir 5 films de moins de 5 minutes', target: 5, reward_badge: 'explorateur_indie', xp: 25, action: 'go_catalog', icon: 'timer-outline', tip: QUEST_HOOKS.watch_5_under_5min },
  { id: 'write_5_critiques', title: 'Voix critique', desc: 'Publier 5 critiques argumentées', target: 5, reward_badge: 'critique_herbe', xp: 40, action: 'go_create', icon: 'create-outline', tip: QUEST_HOOKS.write_5_critiques },
  { id: 'connect_1_pro', title: 'Réseau professionnel', desc: 'Contacter un professionnel du cinéma', target: 1, reward_badge: null, xp: 15, action: 'go_social', icon: 'briefcase-outline', tip: QUEST_HOOKS.connect_1_pro },
  { id: 'explore_experimental', title: 'Esprit ouvert', desc: 'Explorer le cinéma expérimental (3 films)', target: 3, reward_badge: 'esprit_ouvert', xp: 20, action: 'go_catalog', icon: 'flask-outline', tip: QUEST_HOOKS.explore_experimental },
  { id: 'watch_5_consecutive', title: 'Rituel cinéphile', desc: '1 film par jour pendant 5 jours', target: 5, reward_badge: 'rituel_cinephile', xp: 30, action: 'go_catalog', icon: 'flame-outline', tip: QUEST_HOOKS.watch_5_consecutive },
  { id: 'complete_profile', title: 'Profil complet', desc: 'Compléter votre profil à 100%', target: 8, reward_badge: 'profil_elite', xp: 50, action: 'go_profile', icon: 'person-outline', tip: QUEST_HOOKS.complete_profile },
  { id: 'upload_first_video', title: 'Premier pas créateur', desc: 'Publier votre première vidéo', target: 1, reward_badge: 'premier_upload', xp: 60, action: 'go_create', icon: 'cloud-upload-outline', tip: QUEST_HOOKS.upload_first_video },
  { id: 'watch_3_genres', title: 'Voyageur de genres', desc: 'Visionner des films de 3 genres différents', target: 3, reward_badge: 'genres_voyageur', xp: 25, action: 'go_catalog', icon: 'map-outline', tip: QUEST_HOOKS.watch_3_genres },
  { id: 'write_10_critiques', title: 'Critique confirmé', desc: 'Publier 10 critiques au total', target: 10, reward_badge: 'serial_critic', xp: 80, action: 'go_create', icon: 'document-text-outline', tip: QUEST_HOOKS.write_10_critiques },
];

// ★ 4 défis du jour — un par pilier actif. C'est le seul tableau que
// DailyQuestsPanel doit consommer ; ne jamais l'afficher en même temps que
// QuestsPanel (les 10 quêtes long-terme) sur le même écran.
export const DAILY_QUEST_DEFINITIONS: DailyQuestDef[] = [
  {
    id: 'daily_watch', title: 'Session ciné', desc: 'Regardez 2 films jusqu\'au bout',
    pillar: 'watch', xp: 25, icon: 'play-circle-outline', cta: 'Explorer',
    target: 2, deepAction: 'go_catalog',
    hint: "Chaque film terminé compte. Encore un peu.",
  },
  {
    id: 'daily_explore', title: 'Chasse aux pépites', desc: 'Découvrez 3 films ou créateurs',
    pillar: 'explorer', xp: 20, icon: 'compass-outline', cta: 'Découvrir',
    target: 3, deepAction: 'go_catalog',
    hint: "L'algorithme ne trouve rien. C'est vous, le radar.",
  },
  {
    id: 'daily_critique', title: 'Voix du jour', desc: 'Publiez 1 critique argumentée',
    pillar: 'critique', xp: 40, icon: 'create-outline', cta: 'Rédiger',
    target: 1, deepAction: 'go_create',
    hint: "80 mots suffisent. Votre avis compte vraiment.",
  },
  {
    id: 'daily_create', title: 'Studio ouvert', desc: 'Publiez ou mettez à jour un projet',
    pillar: 'creator', xp: 60, icon: 'videocam-outline', cta: 'Publier',
    target: 1, deepAction: 'go_create',
    hint: "Un cinéaste a besoin d'un premier spectateur : vous.",
  },
];

export const PROFILE_POWER_FIELDS: Omit<ProfilePowerField, 'done'>[] = [
  { key: 'has_avatar', label: 'Photo de profil', xp: 10, icon: 'camera-outline', pillar: 'profile' },
  { key: 'has_bio', label: 'Bio rédigée', xp: 15, icon: 'text-outline', pillar: 'profile' },
  { key: 'has_location', label: 'Localisation', xp: 5, icon: 'location-outline', pillar: 'profile' },
  { key: 'has_watched', label: 'Premier film visionné', xp: 20, icon: 'play-outline', pillar: 'watch' },
  { key: 'has_critique', label: 'Première critique publiée', xp: 25, icon: 'create-outline', pillar: 'critique' },
  { key: 'has_badge', label: 'Premier badge débloqué', xp: 10, icon: 'ribbon-outline', pillar: 'explorer' },
  { key: 'has_streak', label: 'Streak de 3 jours', xp: 20, icon: 'flame-outline', pillar: 'watch' },
  { key: 'has_contribution', label: 'Score contributeur > 0', xp: 15, icon: 'star-outline', pillar: 'critique' },
];

function currentWeekNumber() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export const FALLBACK_CHALLENGE: WeeklyChallenge = {
  id: 0,
  week_number: currentWeekNumber(),
  title: "L'Éveil du Cinéphile",
  subtitle: 'Chapitre I — Vos premiers pas',
  description: 'Ce soir, votre regard sur le cinéma change pour toujours.',
  narrative: "Dans les rues de Paris, une affiche décrochée révèle un cinéma clandestin. Ce premier soir change tout — et vous aussi.",
  icon: 'film-outline',
  color_accent: C.blue,
  steps: [
    { index: 0, title: 'Créez votre profil', desc: 'Qui êtes-vous comme cinéphile ?', action: 'go_profile', actionLabel: 'Mon profil', icon: 'person-outline', xp: 15, tip: "Votre profil est votre carte de visite dans le monde du cinéma indépendant." },
    { index: 1, title: 'Premier visionnage', desc: 'Regardez un film du début à la fin.', action: 'go_catalog', actionLabel: 'Explorer', icon: 'play-circle-outline', xp: 20, tip: "Ce réalisateur a tout mis en jeu. Vous lui devez votre attention totale." },
    { index: 2, title: 'Première critique', desc: 'Écrivez ce que ce film vous a fait.', action: 'go_create', actionLabel: 'Écrire', icon: 'create-outline', xp: 30, tip: "80 mots peuvent changer la trajectoire d'une carrière entière." },
    { index: 3, title: 'Rejoignez l\'industrie', desc: 'Connectez-vous à un professionnel.', action: 'go_social', actionLabel: 'Voir les pros', icon: 'briefcase-outline', xp: 25, tip: "Universe est le seul endroit où les artistes et l'industrie se parlent vraiment." },
  ],
  filter_config: null,
  reward_label: 'Badge Éveil + accès anticipé',
  reward_points: 40,
  reward_xp: 90,
  difficulty: 'facile',
};

export const isValidUUID = (v?: string | null) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function xpToLevel(xp: number) {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
    else break;
  }
  level = Math.min(level, 10);
  const base = XP_TABLE[level - 1];
  const next = level < 10 ? XP_TABLE[level] : XP_TABLE[9] * 2;
  const inLevel = xp - base;
  const range = next - base;
  return {
    level,
    pct: range > 0 ? Math.min(1, inLevel / range) : 1,
    xpInLevel: inLevel,
    xpToNext: Math.max(0, range - inLevel),
  };
}

export const resolveImg = (id: number, img: string | null) => {
  if (!img) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (img.startsWith('http')) return img;
  try {
    return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;
  } catch {
    return `https://picsum.photos/seed/work_${id}/400/600`;
  }
};

export function todayKey() {
  return new Date().toISOString().split('T')[0];
}

// ★ Début de journée locale, en ISO — utilisé par les vérifications serveur
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ★ Calcule le streak réel à partir d'une liste de dates de check-in
// (format "YYYY-MM-DD"), en remontant jour par jour depuis aujourd'hui
// (ou hier si le check-in du jour n'est pas encore posé).
function computeStreakFromCheckins(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  // 400 jours de garde-fou — largement suffisant, évite toute boucle infinie
  for (let i = 0; i < 400; i++) {
    const key = cursor.toISOString().split('T')[0];
    if (!set.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeProfilePower(opts: {
  hasAvatar: boolean;
  hasBio: boolean;
  hasLocation: boolean;
  xp: number;
  usefulReviews: number;
  earnedBadgesCount: number;
  streakDays: number;
  contributionScore: number;
}): ProfilePower {
  const checks: Record<string, boolean> = {
    has_avatar: opts.hasAvatar,
    has_bio: opts.hasBio,
    has_location: opts.hasLocation,
    has_watched: opts.xp > 0,
    has_critique: opts.usefulReviews > 0,
    has_badge: opts.earnedBadgesCount > 0,
    has_streak: opts.streakDays >= 3,
    has_contribution: opts.contributionScore > 0,
  };
  const fields: ProfilePowerField[] = PROFILE_POWER_FIELDS.map(f => ({ ...f, done: checks[f.key] ?? false }));
  const doneCount = fields.filter(f => f.done).length;
  const totalXP = PROFILE_POWER_FIELDS.reduce((a, f) => a + f.xp, 0);
  const earnedXP = fields.filter(f => f.done).reduce((a, f) => a + f.xp, 0);
  const pct = fields.length > 0 ? doneCount / fields.length : 0;
  const tier: ProfilePower['tier'] = pct >= 0.875 ? 'elite' : pct >= 0.625 ? 'strong' : pct >= 0.375 ? 'growing' : 'starter';
  return { pct, fields, earnedXP, totalXP, tier };
}

export function getXPMultiplier(streakDays: number, profilePct: number): XPMultiplier {
  const tier = MULTIPLIER_TIERS.find(t => streakDays >= t.minStreak) ?? MULTIPLIER_TIERS[MULTIPLIER_TIERS.length - 1];
  const profileBonus = profilePct >= 0.875 ? 0.25 : profilePct >= 0.625 ? 0.1 : 0;
  const total = Math.round((tier.value + profileBonus) * 100) / 100;
  const sources: string[] = [];
  if (tier.value > 1) sources.push(`Streak ${streakDays}j`);
  if (profileBonus > 0) sources.push(`Profil ${Math.round(profilePct * 100)}%`);
  return {
    value: total,
    label: `×${total}`,
    color: profileBonus > 0 ? C.gold : tier.color,
    sources,
  };
}

export function computePillarProgress(
  profile: GamiProfile,
  score: ContributionScore,
  questsWithProgress: { completed: boolean; pillar?: PillarKey }[],
): PillarProgress[] {
  const creatorScore = Math.min(100, (score.shared_films * 5) + (score.pepites_detected * 3));
  const critiqueScore = Math.min(100, (score.useful_reviews * 10) + (score.quality_comments * 5));
  const profileScore = Math.min(100, (score.saved_recommendations * 8) + (score.followed_playlists * 4));
  const explorerScore = Math.min(100, (score.pepites_detected * 8) + (score.valid_reports * 5));
  const watchScore = Math.min(100, (profile.streak_days * 3) + (profile.xp / 50));

  const entries: [PillarKey, number][] = [
    ['creator', creatorScore],
    ['critique', critiqueScore],
    ['profile', profileScore],
    ['explorer', explorerScore],
    ['watch', watchScore],
  ];

  return entries.map(([key, score]) => {
    const def = PILLAR_DEFS[key];
    return {
      key,
      label: def.label,
      icon: def.icon,
      color: def.color,
      score: Math.round(score),
      max: 100,
      pct: Math.min(1, score / 100),
    };
  });
}

// ─── ★ Gamification principale — XP/niveau/streak dynamiques ────────────────
export function useGamification(userId: string, works: Work[] = [], opts?: { skipBadges?: boolean }): GamiState {
  const [profile, setProfile] = useState<GamiProfile>({
    xp: 0,
    level: 1,
    title: TITLES[0],
    streak_days: 0,
    xpToNext: 100,
    xpInLevel: 0,
    pct: 0,
    contribution_score: 0,
  });
  const [badges, setBadges] = useState<GamiBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinsCount, setCheckinsCount] = useState(0);
  const skipBadges = !!opts?.skipBadges;
  const profileRef = useRef<GamiProfile | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }

    let dead = false;

    // Fetch profile + XP from quest_progress (source de vérité XP)
    Promise.all([
      supabase.from('profiles').select('level,title,streak_days,contribution_score').eq('id', userId).maybeSingle(),
      supabase.from('quest_progress').select('xp').eq('user_id', userId).maybeSingle(),
    ])
      .then(([profR, qpR]) => {
        if (dead) return;

        const dbXP = (qpR.data as any)?.xp ?? null;
        if (profR.data) {
          const { level, title, streak_days = 0, contribution_score = 0 } = profR.data as any;
          const xp = dbXP ?? contribution_score ?? 0;
          const lvl = xpToLevel(xp);
          const effLevel = level ?? lvl.level;
          setProfile(prev => ({
            ...prev,
            xp,
            level: effLevel,
            title: title ?? TITLES[effLevel - 1],
            streak_days,
            contribution_score: contribution_score ?? 0,
            pct: lvl.pct,
            xpInLevel: lvl.xpInLevel,
            xpToNext: lvl.xpToNext,
          }));
        } else {
          supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id' }).then(() => {}, () => {});
        }

        if (!skipBadges) {
          // badges / user_badges supprimées — catalogue local uniquement
          setBadges(BADGES_CATALOG.map(b => ({ ...b, earned: false, earned_at: undefined })) as GamiBadge[]);
        }

        setLoading(false);
      }, () => {
        if (!dead) setLoading(false);
      });

    return () => {
      dead = true;
    };
  }, [userId, skipBadges]);

  // ★ Streak dynamique via public.user_history — calcul à partir des jours
  // distincts de visionnage, sans dépendre de daily_checkins.
// ★ Realtime XP — robuste contre double-mount / topic reuse

// en haut du hook useGamification
const xpChannelRef = useRef<RealtimeChannel | null>(null);

useEffect(() => {
  if (!isValidUUID(userId)) return;

  let disposed = false;
  // topic unique par montage => empêche la réutilisation d'un ancien channel déjà subscribe()
  const topic = `xp_sync:${userId}:${Math.random().toString(36).slice(2)}`;

  const ch = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'quest_progress',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (disposed) return;
        const row = (payload.new ?? payload.old) as any;
        const newXp = row?.xp;
        if (typeof newXp !== 'number') return;

        const lvl = xpToLevel(newXp);
        setProfile((prev) =>
          prev.xp === newXp
            ? prev
            : { ...prev, xp: newXp, ...lvl, title: TITLES[lvl.level - 1] }
        );
      }
    )
    .subscribe();

  xpChannelRef.current = ch;

  return () => {
    disposed = true;
    const current = xpChannelRef.current;
    xpChannelRef.current = null;
    if (current) {
      current.unsubscribe().catch(() => {});
      supabase.removeChannel(current).catch(() => {});
    }
  };
}, [userId]);
  const earnedBadges = useMemo(() => badges.filter(b => b.earned), [badges]);
  const pendingBadges = useMemo(() => badges.filter(b => !b.earned), [badges]);

  // ★ Re-lit l'XP depuis la DB — appelé sur focus depuis profile.tsx
  const refreshXP = useCallback(() => {
    if (!isValidUUID(userId)) return;
    supabase.from('quest_progress').select('xp').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        const newXp = (data as any)?.xp;
        if (typeof newXp !== 'number') return;
        const lvl = xpToLevel(newXp);
        setProfile(prev => prev.xp === newXp ? prev : {
          ...prev, xp: newXp, ...lvl, title: TITLES[lvl.level - 1],
        });
      }, () => {});
  }, [userId]);


  const awardXP = useCallback((amount: number, reason: string) => {
    if (!isValidUUID(userId)) return;
    const newXp = (profileRef.current?.xp ?? 0) + amount;
    const lvl = xpToLevel(newXp);
    setProfile(prev => ({ ...prev, xp: newXp, ...lvl, title: TITLES[lvl.level - 1] }));
    supabase.from('quest_progress')
      .upsert({ user_id: userId, xp: newXp, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) {
          console.error('[XP] quest_progress upsert failed:', reason, error.message);
          supabase.from('profiles').update({ contribution_score: newXp }).eq('id', userId)
            .then(() => {}, (e: any) => console.error('[XP] profiles fallback failed:', e));
        }
      }, (e: any) => console.error('[XP] network error:', reason, e));
  }, [userId]);

  const awardBadge = useCallback(async (badgeId: string) => {
    if (!isValidUUID(userId)) return;
    if (badges.find(b => b.id === badgeId && b.earned)) return;
    // user_badges supprimée — état local uniquement (pas de persistence DB)
    const badge = badges.find(b => b.id === badgeId);
    setBadges(prev => prev.map(b => b.id === badgeId ? { ...b, earned: true, earned_at: new Date().toISOString() } : b));
    if (badge?.xp_reward) awardXP(badge.xp_reward, `badge_${badgeId}`);
  }, [userId, badges, awardXP]);

  return { profile, badges, earnedBadges, pendingBadges, loading, checkinsCount, awardXP, awardBadge, refresh: refreshXP };
}

// ─── ★ SYSTÈME DE NOTIFICATION IN-APP (style Duolingo) ───────────────────────
// Fonctionne sans expo-notifications — banners in-app uniquement.
// Affiche des rappels streak, check-in, et célébrations XP.

export interface GamiNotif {
  id: string;
  type: 'streak' | 'checkin' | 'xp' | 'quest' | 'level';
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  description?: string;
  accentColor: string;
  glowColor?: string;
  xpAmount?: number;
}

const NOTIF_PRESETS = {
  streakAtRisk: (streak: number): GamiNotif => ({
    id: `streak_risk_${Date.now()}`,
    type: 'streak',
    icon: 'flame-outline',
    eyebrow: `STREAK · ${streak} JOURS EN JEU`,
    title: 'Votre streak risque de s\'interrompre',
    description: 'Faites votre check-in du jour pour le conserver.',
    accentColor: C.orange,
    glowColor: 'rgba(249,115,22,0.14)',
  }),
  streakMilestone: (streak: number): GamiNotif => ({
    id: `streak_mile_${streak}`,
    type: 'streak',
    icon: 'flame',
    eyebrow: 'STREAK RECORD ✦',
    title: `${streak} jours d'affilée`,
    description: 'Votre constance cinéphile est remarquable.',
    accentColor: C.gold,
    glowColor: C.goldDim,
  }),
  xpGained: (xp: number, reason: string): GamiNotif => ({
    id: `xp_${Date.now()}`,
    type: 'xp',
    icon: 'flash',
    eyebrow: 'XP GAGNÉ',
    title: `+${xp} XP`,
    description: reason,
    accentColor: C.blue,
    glowColor: C.blueDim,
    xpAmount: xp,
  }),
  questReady: (title: string): GamiNotif => ({
    id: `quest_ready_${Date.now()}`,
    type: 'quest',
    icon: 'checkmark-circle-outline',
    eyebrow: 'DÉFI COMPLÉTÉ ✦',
    title,
    description: 'Réclamez votre récompense dans vos défis.',
    accentColor: C.green,
    glowColor: C.greenDim,
  }),
  levelUp: (level: number, title: string): GamiNotif => ({
    id: `level_${level}`,
    type: 'level',
    icon: 'star',
    eyebrow: `NIVEAU ${level} ATTEINT`,
    title,
    description: 'Votre présence sur Universe grandit.',
    accentColor: level >= 9 ? C.gold : level >= 7 ? C.purple : C.blue,
  }),
} as const;

// Hook pour déclencher des notifications in-app depuis n'importe quel écran.
// Usage: const { notify } = useGamiNotify(); notify('streakAtRisk', 5);
export function useGamiNotify() {
  const [current, setCurrent] = useState<GamiNotif | null>(null);
  const queue = useRef<GamiNotif[]>([]);
  const showing = useRef(false);

  const flush = useCallback(() => {
    if (showing.current || !queue.current.length) return;
    showing.current = true;
    setCurrent(queue.current.shift() ?? null);
  }, []);

  const notify = useCallback((notif: GamiNotif) => {
    queue.current.push(notif);
    flush();
  }, [flush]);

  const notifyPreset = useCallback(<K extends keyof typeof NOTIF_PRESETS>(
    key: K,
    ...args: Parameters<typeof NOTIF_PRESETS[K]>
  ) => {
    const preset = (NOTIF_PRESETS[key] as any)(...args) as GamiNotif;
    notify(preset);
  }, [notify]);

  const dismiss = useCallback(() => {
    showing.current = false;
    setCurrent(null);
    setTimeout(flush, 200);
  }, [flush]);

  return { current, notify, notifyPreset, dismiss };
}
export type GamiNotifyReturn = ReturnType<typeof useGamiNotify>;

// Composant bannier — wraps SpringToast avec les notifs gami
export const GamiNotifyBanner = memo(function GamiNotifyBanner({
  notif, onDone,
}: { notif: GamiNotif | null; onDone: () => void }) {
  if (!notif) return null;
  const xpNode = notif.xpAmount ? (
    <View style={but.xpPill}>
      <Ionicons name="flash" size={8} color={C.gold} />
      <Text style={but.xpTxt}>+{notif.xpAmount} XP</Text>
    </View>
  ) : undefined;
  return (
    <SpringToast
      visible
      onDone={onDone}
      accentColor={notif.accentColor}
      glowColor={notif.glowColor}
      icon={notif.icon}
      eyebrow={notif.eyebrow}
      eyebrowExtra={xpNode}
      title={notif.title}
      description={notif.description}
    />
  );
});

// Hook de rappel quotidien — vérifie l'activité du jour via user_history.
// Déclenche automatiquement une bannière si le streak est à risque.
export function useGamiStreakReminder(userId: string, notify: (n: GamiNotif) => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (!isValidUUID(userId) || fired.current) return;
    fired.current = true;
    const today = todayKey();
    supabase.from('user_history')
      .select('watched_at')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const dates = [...new Set((data ?? []).map((r: any) =>
          new Date(r.watched_at).toISOString().split('T')[0]
        ))] as string[];
        if (!dates.length) return;
        const hasToday = dates.includes(today);
        if (hasToday) {
          const streak = computeStreakFromCheckins(dates);
          if ([7, 14, 30, 60, 100].includes(streak)) {
            notify(NOTIF_PRESETS.streakMilestone(streak));
          }
        } else {
          const streak = computeStreakFromCheckins(dates);
          if (streak > 0) notify(NOTIF_PRESETS.streakAtRisk(streak));
        }
      }, () => {});
  }, [userId, notify]);
}

// Export direct des presets pour usage externe
export { NOTIF_PRESETS };

export function useWeeklyChallenge(userId: string) {
  const [challenge, setChallenge] = useState<WeeklyChallenge>(FALLBACK_CHALLENGE);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const weekNum = useMemo(() => currentWeekNumber(), []);

  useEffect(() => {
    let dead = false;
    supabase
      .from('weekly_challenges')
      .select('id,week_number,title,subtitle,description,narrative,icon,color_accent,steps,filter_config,reward_label,reward_points,reward_xp,difficulty')
      .eq('week_number', weekNum)
      .maybeSingle()
      .then(({ data }) => {
        if (dead || !data) return;
        setChallenge({
          ...data,
          steps: Array.isArray(data.steps) ? data.steps : [],
          filter_config: data.filter_config ?? null,
          narrative: data.narrative ?? null,
          subtitle: data.subtitle ?? null,
          reward_label: data.reward_label ?? null,
        } as WeeklyChallenge);
      },() => {
        if (!dead) setLoading(false);
      });

    return () => {
      dead = true;
    };
  }, [weekNum]);

  useEffect(() => {
    if (!isValidUUID(userId)) return;
    let dead = false;
    supabase
      .from('quest_progress')
      .select('step_index,steps_done,completed,points_earned,xp_earned,time_spent_s')
      .eq('user_id', userId)
      .eq('week_number', weekNum)
      .maybeSingle()
      .then(({ data }) => {
        if (dead || !data) return;
        setProgress({
          step_index: data.step_index ?? 0,
          steps_done: Array.isArray(data.steps_done) ? data.steps_done : [],
          completed: data.completed ?? false,
          points_earned: data.points_earned ?? 0,
          xp_earned: data.xp_earned ?? 0,
          time_spent_s: data.time_spent_s ?? 0,
        });
      });

    return () => {
      dead = true;
    };
  }, [userId, weekNum]);

  const upsertProgress = useCallback(async (stepIndex: number, completed: boolean) => {
    if (!isValidUUID(userId)) return;
    const total = challenge.steps.length;
    const points = completed ? challenge.reward_points : Math.floor((challenge.reward_points ?? 50) * stepIndex / Math.max(1, total));
    const xp = completed ? challenge.reward_xp : Math.floor((challenge.reward_xp ?? 0) * stepIndex / Math.max(1, total));
    const prevDone = progress?.steps_done ?? [];
    const steps_done = [...new Set([...prevDone, stepIndex])];

    const next: ChallengeProgress = {
      step_index: stepIndex,
      steps_done,
      completed,
      points_earned: points,
      xp_earned: xp,
      time_spent_s: progress?.time_spent_s ?? 0,
    };

    setProgress(next);

    await supabase.from('quest_progress').upsert({
      user_id: userId,
      week_number: weekNum,
      step_index: stepIndex,
      steps_done,
      completed,
      points_earned: points,
      xp_earned: xp,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_number' }).then(() => {}, () => {});
  }, [userId, weekNum, challenge, progress]);

  return { challenge, progress, loading, upsertProgress };
}

export function useQuests(userId: string) {
  const [questProgress, setQuestProgress] = useState<Map<string, QuestProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }
    let dead = false;
    supabase.from('quests').select('quest_id,progress,completed,completed_at').eq('user_id', userId)
      .then(({ data }) => {
        if (dead) return;
        const m = new Map<string, QuestProgress>();
        (data ?? []).forEach((r: any) => m.set(r.quest_id, {
          quest_id: r.quest_id,
          progress: r.progress ?? 0,
          completed: r.completed ?? false,
          completed_at: r.completed_at ?? undefined,
        }));
        setQuestProgress(m);
        setLoading(false);
      }, () => {
        if (!dead) setLoading(false);
      });
    return () => { dead = true; };
  }, [userId]);

  const incrementQuest = useCallback(async (questId: string, by = 1) => {
    if (!isValidUUID(userId)) return;
    const def = QUEST_DEFINITIONS.find(q => q.id === questId);
    if (!def) return;
    const prev = questProgress.get(questId);
    if (prev?.completed) return;
    const newProg = Math.min((prev?.progress ?? 0) + by, def.target);
    const completed = newProg >= def.target;
    const next: QuestProgress = {
      quest_id: questId,
      progress: newProg,
      completed,
      completed_at: completed ? new Date().toISOString() : undefined,
    };
    setQuestProgress(m => {
      const nm = new Map(m);
      nm.set(questId, next);
      return nm;
    });
    await supabase.from('quests').upsert({
      user_id: userId,
      quest_id: questId,
      progress: newProg,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,quest_id' }).then(() => {}, () => {});
  }, [userId, questProgress]);

  const questsWithProgress = useMemo(() => QUEST_DEFINITIONS.map(def => ({
    ...def,
    progress: questProgress.get(def.id)?.progress ?? 0,
    completed: questProgress.get(def.id)?.completed ?? false,
    pct: Math.min(1, (questProgress.get(def.id)?.progress ?? 0) / def.target),
  })), [questProgress]);

  const completedCount = useMemo(() => questsWithProgress.filter(q => q.completed).length, [questsWithProgress]);

  return { questsWithProgress, completedCount, loading, incrementQuest };
}

export function useContributionScore(userId: string) {
  const [score, setScore] = useState<ContributionScore>({
    total_score: 0,
    useful_reviews: 0,
    saved_recommendations: 0,
    quality_comments: 0,
    valid_reports: 0,
    followed_playlists: 0,
    shared_films: 0,
    pepites_detected: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }
    let dead = false;
    supabase.from('contribution_scores').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (dead) return;
        if (data) setScore({
          total_score: data.total_score ?? 0,
          useful_reviews: data.useful_reviews ?? 0,
          saved_recommendations: data.saved_recommendations ?? 0,
          quality_comments: data.quality_comments ?? 0,
          valid_reports: data.valid_reports ?? 0,
          followed_playlists: data.followed_playlists ?? 0,
          shared_films: data.shared_films ?? 0,
          pepites_detected: data.pepites_detected ?? 0,
        });
        setLoading(false);
      }, () => {
        if (!dead) setLoading(false);
      });
    return () => { dead = true; };
  }, [userId]);

  const detectPepite = useCallback(async (workId: number, viewsAtLike: number) => {
    if (!isValidUUID(userId) || viewsAtLike >= 100) return false;
    const { error } = await supabase.from('pepite_detections').upsert({
      user_id: userId,
      work_id: workId,
      views_at_like: viewsAtLike,
    }, { onConflict: 'user_id,work_id' });
    if (!error) {
      await supabase.from('contribution_scores').upsert({
        user_id: userId,
        pepites_detected: score.pepites_detected + 1,
        total_score: score.total_score + 12,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(() => {}, () => {});
      setScore(prev => ({ ...prev, pepites_detected: prev.pepites_detected + 1, total_score: prev.total_score + 12 }));
      return true;
    }
    return false;
  }, [userId, score]);

  return { score, loading, detectPepite };
}

// ★ Vérifie côté serveur qu'un défi est RÉELLEMENT terminé, indépendamment
// de la progression locale — c'est le garde-fou anti-triche/anti-bug
// demandé : impossible de Claim une critique jamais publiée, un visionnage
// jamais enregistré, etc. Chaque cas interroge la table qui fait foi.
async function verifyQuestCompletion(userId: string, questId: string, target: number): Promise<boolean> {
  const sinceISO = startOfTodayISO();
  try {
    switch (questId) {
      case 'daily_watch': {
        const { count } = await supabase
          .from('user_history')
          .select('work_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('watched_at', sinceISO);
        return (count ?? 0) >= target;
      }
      case 'daily_explore': {
        const { data } = await supabase
          .from('user_history')
          .select('work_id')
          .eq('user_id', userId)
          .gte('watched_at', sinceISO);
        const distinctWorks = new Set((data ?? []).map((r: any) => r.work_id)).size;
        return distinctWorks >= target;
      }
      case 'daily_critique': {
        // ★ Une critique ne compte que si elle est réellement rédigée
        // (contenu substantiel), pas un brouillon vide ou quasi-vide.
        const { data } = await supabase
          .from('critiques')
          .select('id,content')
          .eq('user_id', userId)
          .gte('created_at', sinceISO);
        const validCount = (data ?? []).filter((r: any) => (r.content ?? '').trim().length >= 20).length;
        return validCount >= target;
      }
      case 'daily_create': {
        const { count } = await supabase
          .from('reels')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['pending', 'approved'])
          .gte('created_at', sinceISO);
        return (count ?? 0) >= target;
      }
      default:
        return true;
    }
  } catch {
    // En cas d'erreur réseau/permission, on refuse par prudence plutôt que
    // de créditer de l'XP sur une vérification qu'on n'a pas pu faire.
    return false;
  }
}

// ─── ★ Défis du jour — progression + Claim vérifié côté serveur ─────────────
export function useDailyQuests(userId: string, onXPClaimed?: (xp: number, questId: string) => void) {
  const today = useMemo(() => todayKey(), []);
  const [progressMap, setProgressMap] = useState<Map<string, DailyQuestProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }
    let dead = false;
    const ids = DAILY_QUEST_DEFINITIONS.map(d => `${d.id}_${today}`);
    // quests remplace user_quests — plus de colonne `claimed`, completed = réclamé
    supabase.from('quests').select('quest_id,progress,completed').eq('user_id', userId).in('quest_id', ids)
      .then(({ data }) => {
        if (dead) return;
        const m = new Map<string, DailyQuestProgress>();
        (data ?? []).forEach((r: any) => {
          const baseId = (r.quest_id as string).replace(`_${today}`, '');
          m.set(baseId, {
            id: baseId,
            date: today,
            progress: r.progress ?? 0,
            completed: r.completed ?? false,
            claimed: r.completed ?? false, // completed = réclamé dans le nouveau schéma
          });
        });
        setProgressMap(m);
        setLoading(false);
      }, () => {
        if (!dead) setLoading(false);
      });
    return () => { dead = true; };
  }, [userId, today]);

  const incrementDailyQuest = useCallback(async (questId: string, by = 1) => {
    if (!isValidUUID(userId)) return;
    const def = DAILY_QUEST_DEFINITIONS.find(d => d.id === questId);
    if (!def) return;
    const prev = progressMap.get(questId);
    if (prev?.completed) return;

    const newProg = Math.min((prev?.progress ?? 0) + by, def.target);
    const completed = newProg >= def.target;
    const next: DailyQuestProgress = { id: questId, date: today, progress: newProg, completed, claimed: false };

    setProgressMap(m => { const nm = new Map(m); nm.set(questId, next); return nm; });

    if (completed) hapticSuccess(); else hapticLight();

    await supabase.from('quests').upsert({
      user_id: userId,
      quest_id: `${questId}_${today}`,
      progress: newProg,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,quest_id' }).then(() => {}, () => {});
  }, [userId, today, progressMap]);

  // ★ Réclame l'XP — DOUBLE vérification avant tout crédit :
  //   1) garde locale : completed && progress >= target
  //   2) garde serveur : verifyQuestCompletion() relit la vraie table
  //      (critiques/reels/user_history) pour confirmer que l'action est
  //      allée au bout. Si la vérification échoue, rien n'est crédité et
  //      le défi reste réclamable (l'utilisateur peut réessayer une fois
  //      l'action réellement terminée).
  const claimDailyQuest = useCallback(async (questId: string) => {
    if (!isValidUUID(userId)) return false;
    const def = DAILY_QUEST_DEFINITIONS.find(d => d.id === questId);
    const prev = progressMap.get(questId);
    if (!def || !prev) return false;
    if (prev.claimed) return false;
    if (prev.progress < def.target || !prev.completed) return false;

    setVerifying(v => ({ ...v, [questId]: true }));
    const serverConfirmed = await verifyQuestCompletion(userId, questId, def.target);
    setVerifying(v => ({ ...v, [questId]: false }));

    if (!serverConfirmed) {
      hapticWarn();
      return false; // ★ Claim refusé : l'action n'est pas réellement terminée en base
    }

    hapticSuccess();
    setProgressMap(m => {
      const nm = new Map(m);
      nm.set(questId, { ...prev, claimed: true });
      return nm;
    });

    await supabase.from('quests').upsert({
      user_id: userId,
      quest_id: `${questId}_${today}`,
      progress: prev.progress,
      completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,quest_id' }).then(() => {}, () => {});

    onXPClaimed?.(def.xp, questId);
    return true;
  }, [userId, today, progressMap, onXPClaimed]);

  // ★ Toujours EXACTEMENT 4 entrées.
  const questsWithStatus = useMemo(() => DAILY_QUEST_DEFINITIONS.map(d => {
    const p = progressMap.get(d.id);
    return {
      ...d,
      progress: p?.progress ?? 0,
      completed: p?.completed ?? false,
      claimed: p?.claimed ?? false,
      pct: Math.min(1, (p?.progress ?? 0) / d.target),
      verifying: !!verifying[d.id],
    };
  }), [progressMap, verifying]);

  const completedToday    = useMemo(() => questsWithStatus.filter(q => q.claimed).length, [questsWithStatus]);
  const readyToClaimCount = useMemo(() => questsWithStatus.filter(q => q.completed && !q.claimed).length, [questsWithStatus]);
  const hasAnyProgress = useMemo(() => questsWithStatus.some(q => q.progress > 0), [questsWithStatus]);

  return {
    questsWithStatus,
    completedToday,
    readyToClaimCount,
    hasAnyProgress,
    loading,
    incrementDailyQuest,
    claimDailyQuest,
    today,
  };
}

// Auto-claim un défi du jour sans passer par le hook — fire-and-forget.
// Appelé directement depuis les handlers d'action (handleWatch, etc.).
export async function tryAutoClaimDailyQuest(
  userId: string,
  questId: 'daily_watch' | 'daily_explore' | 'daily_critique' | 'daily_create',
): Promise<void> {
  if (!isValidUUID(userId)) return;
  const def = DAILY_QUEST_DEFINITIONS.find(d => d.id === questId);
  if (!def) return;
  const today = todayKey();
  const fullId = `${questId}_${today}`;
  // quests remplace user_quests — completed = réclamé (pas de colonne claimed)
  const { data: existing } = await supabase.from('quests')
    .select('completed')
    .eq('user_id', userId)
    .eq('quest_id', fullId)
    .maybeSingle();
  if (existing?.completed) return;
  const ok = await verifyQuestCompletion(userId, questId, def.target);
  if (!ok) return;
  await supabase.from('quests').upsert({
    user_id: userId, quest_id: fullId,
    progress: def.target, completed: true,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,quest_id' }).then(() => {}, () => {});
  // ★ FIX: Use add_xp RPC for proper XP sync with profiles table
  try {
    await supabase.rpc('add_xp', { p_user_id: userId, p_xp: def.xp, p_reason: `daily_quest_${questId}` });
  } catch (e) {
    // Fallback: direct quest_progress update if RPC fails
    const { data: qp } = await supabase.from('quest_progress').select('xp').eq('user_id', userId).maybeSingle();
    const currentXP = (qp as any)?.xp ?? 0;
    await supabase.from('quest_progress').upsert(
      { user_id: userId, xp: currentXP + def.xp, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ).then(() => {}, () => {
      supabase.from('profiles').update({ contribution_score: currentXP + def.xp }).eq('id', userId).then(() => {}, () => {});
    });
  }
}

export function useXPMultiplier(streakDays: number, profilePct: number): XPMultiplier {
  return useMemo(() => getXPMultiplier(streakDays, profilePct), [streakDays, profilePct]);
}

export const XPFloat = memo(function XPFloat({
  amount,
  visible,
  onDone,
}: {
  amount: number;
  visible: boolean;
  onDone: () => void;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    y.setValue(0);
    op.setValue(1);
    Animated.parallel([
      Animated.timing(y, { toValue: -60, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([Animated.delay(700), Animated.timing(op, { toValue: 0, duration: 500, useNativeDriver: true })]),
    ]).start(onDone);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ position: 'absolute', alignSelf: 'center', transform: [{ translateY: y }], opacity: op, zIndex: 999, pointerEvents: 'none' } as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(245,200,66,0.20)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.40)' }}>
        <Ionicons name="flash" size={11} color={C.gold} />
        <Text style={{ color: C.gold, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>+{amount} XP</Text>
      </View>
    </Animated.View>
  );
});

const but = StyleSheet.create({
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` },
  xpTxt: { color: C.gold, fontSize: 8, fontWeight: '800' },
});

export const BadgeUnlockedToast = memo(function BadgeUnlockedToast({
  badge,
  visible,
  onDone,
}: {
  badge: GamiBadge | null;
  visible: boolean;
  onDone: () => void;
}) {
  if (!badge) return null;
  const col = RARITY_COL[badge.rarity] ?? C.muted;
  const glow = RARITY_GLOW[badge.rarity] ?? C.faint;
  return (
    <SpringToast
      visible={visible}
      onDone={onDone}
      accentColor={col}
      glowColor={glow}
      icon={badge.icon}
      eyebrow={`BADGE DÉBLOQUÉ · ${RARITY_LBL[badge.rarity]}`}
      eyebrowExtra={
        <View style={but.xpPill}>
          <Ionicons name="flash" size={8} color={C.gold} />
          <Text style={but.xpTxt}>+{badge.xp_reward} XP</Text>
        </View>
      }
      title={badge.label}
      description={BADGE_IMPACT[badge.id] ?? badge.description}
    />
  );
});

export const LevelUpCelebration = memo(function LevelUpCelebration({
  level,
  title,
  visible,
  onClose,
}: {
  level: number;
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  const bgOp      = useRef(new Animated.Value(0)).current;
  const ringOp    = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const numScale  = useRef(new Animated.Value(0.3)).current;
  const numOp     = useRef(new Animated.Value(0)).current;
  const textOp    = useRef(new Animated.Value(0)).current;
  const btnOp     = useRef(new Animated.Value(0)).current;
  const rayRot    = useRef(new Animated.Value(0)).current;
  const halo1     = useRef(new Animated.Value(1)).current;
  const halo2     = useRef(new Animated.Value(1.2)).current;
  const haloOp    = useRef(new Animated.Value(0.4)).current;
  const [burst, setBurst] = useState(0);

  const copy = LEVEL_UP_COPY[level] ?? { headline: 'Nouveau niveau.', body: 'Votre voyage dans le cinéma indépendant continue.' };
  const accent = level >= 9 ? C.gold : level >= 7 ? C.purple : level >= 5 ? C.orange : C.blue;
  const RAY_ANGLES = [0,20,40,60,80,100,120,140,160,180,200,220,240,260,280,300,320,340];

  useEffect(() => {
    if (!visible) {
      [bgOp,ringOp,numOp,textOp,btnOp].forEach(a=>a.setValue(0));
      ringScale.setValue(0.5); numScale.setValue(0.3); halo1.setValue(1); halo2.setValue(1.2);
      return;
    }
    setBurst(0);
    Animated.sequence([
      Animated.timing(bgOp,   {toValue:1, duration:260, useNativeDriver:true}),
      Animated.parallel([
        Animated.spring(ringScale, {toValue:1, tension:80, friction:8, useNativeDriver:true}),
        Animated.timing(ringOp,    {toValue:1, duration:400, useNativeDriver:true}),
      ]),
      Animated.parallel([
        Animated.spring(numScale, {toValue:1.1, tension:130, friction:6, useNativeDriver:true}),
        Animated.timing(numOp,    {toValue:1, duration:280, useNativeDriver:true}),
      ]),
      Animated.spring(numScale, {toValue:1, tension:220, friction:9, useNativeDriver:true}),
      Animated.timing(textOp, {toValue:1, duration:480, useNativeDriver:true}),
      Animated.timing(btnOp,  {toValue:1, duration:300, useNativeDriver:true}),
    ]).start(()=>setBurst(v=>v+1));

    const rayLoop = Animated.loop(Animated.timing(rayRot, {toValue:1, duration:10000, easing:Easing.linear, useNativeDriver:true}));
    rayLoop.start();

    const haloLoop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(halo1,  {toValue:1.35, duration:1300, useNativeDriver:true}),
        Animated.timing(halo2,  {toValue:1.65, duration:1300, useNativeDriver:true}),
        Animated.timing(haloOp, {toValue:0.08, duration:1300, useNativeDriver:true}),
      ]),
      Animated.parallel([
        Animated.timing(halo1,  {toValue:1,    duration:1300, useNativeDriver:true}),
        Animated.timing(halo2,  {toValue:1.2,  duration:1300, useNativeDriver:true}),
        Animated.timing(haloOp, {toValue:0.4,  duration:1300, useNativeDriver:true}),
      ]),
    ]));
    haloLoop.start();

    return () => { rayLoop.stop(); haloLoop.stop(); };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent transparent>
      <Animated.View style={{flex:1, backgroundColor:'rgba(3,5,12,0.97)', opacity:bgOp, alignItems:'center', justifyContent:'center'}}>
        <GalaxyBackground />

        <Animated.View pointerEvents="none" style={{position:'absolute', transform:[{rotate: rayRot.interpolate({inputRange:[0,1], outputRange:['0deg','360deg']})}]}}>
          {RAY_ANGLES.map(a=>(
            <View key={a} style={{position:'absolute', width:1.5, height:180, borderRadius:1, backgroundColor:`${accent}16`, transform:[{rotate:`${a}deg`},{translateY:-90}], top:0, left:-0.75}}/>
          ))}
        </Animated.View>

        <Animated.View pointerEvents="none" style={{position:'absolute', width:190, height:190, borderRadius:95, borderWidth:1, borderColor:accent, opacity:haloOp, transform:[{scale:halo1}]}}/>
        <Animated.View pointerEvents="none" style={{position:'absolute', width:190, height:190, borderRadius:95, borderWidth:1, borderColor:accent, opacity:haloOp, transform:[{scale:halo2}]}}/>

        <View pointerEvents="none" style={{position:'absolute', alignItems:'center', justifyContent:'center'}}>
          <ParticleBurst trigger={burst} color={accent} />
        </View>

        <View style={{alignItems:'center', paddingHorizontal:36, width:'100%', gap:0}}>
          <Animated.View style={{opacity:ringOp, marginBottom:32}}>
            <View style={{flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:14, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:`${accent}45`, backgroundColor:`${accent}10`}}>
              <View style={{width:5, height:5, borderRadius:2.5, backgroundColor:accent}}/>
              <Text style={{color:accent, fontSize:9, fontWeight:'900', letterSpacing:3}}>ASCENSION · NIVEAU {level}</Text>
              <View style={{width:5, height:5, borderRadius:2.5, backgroundColor:accent}}/>
            </View>
          </Animated.View>

          <Animated.View style={{transform:[{scale:numScale}], opacity:numOp, marginBottom:26}}>
            <Animated.View style={{opacity:ringOp, transform:[{scale:ringScale}]}}>
              <View style={{width:148, height:148, borderRadius:74, borderWidth:2.5, borderColor:accent, backgroundColor:`${accent}10`, alignItems:'center', justifyContent:'center',
                ...(Platform.OS!=='web'?{shadowColor:accent, shadowOffset:{width:0,height:0}, shadowOpacity:0.75, shadowRadius:24, elevation:14}:{boxShadow:`0 0 32px 8px ${accent}40`} as any)}}>
                <Text style={{fontSize:9, fontWeight:'900', color:accent, letterSpacing:2.5, marginBottom:-6}}>NIVEAU</Text>
                <Text style={{fontSize:74, fontWeight:'900', color:C.white, letterSpacing:-5, lineHeight:80}}>{level}</Text>
              </View>
            </Animated.View>
          </Animated.View>

          <Animated.View style={{alignItems:'center', gap:10, opacity:textOp, width:'100%'}}>
            <Text style={{color:`${accent}90`, fontSize:9, fontWeight:'900', letterSpacing:2.5}}>NOUVELLE IDENTITÉ</Text>
            <Text style={{color:C.white, fontSize:27, fontWeight:'900', textAlign:'center', letterSpacing:-0.8, lineHeight:32}}>{title}</Text>
            <View style={{width:44, height:1.5, backgroundColor:`${accent}55`, marginVertical:2}}/>
            <Text style={{color:accent, fontSize:16, fontWeight:'800', textAlign:'center', letterSpacing:-0.3}}>{copy.headline}</Text>
            <Text style={{color:'rgba(255,255,255,0.50)', fontSize:13, textAlign:'center', lineHeight:21, maxWidth:290}}>{copy.body}</Text>
          </Animated.View>

          <Animated.View style={{opacity:btnOp, width:'100%', marginTop:30}}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84}
              style={{paddingVertical:17, borderRadius:18, backgroundColor:accent, alignItems:'center'}}>
              <Text style={{color:C.navyDark, fontSize:15, fontWeight:'900', letterSpacing:0.2}}>Continuer votre voyage</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
});

export const CinemaManifestoCard = memo(function CinemaManifestoCard({ autoRotate = true, intervalMs = 5000 }: { autoRotate?: boolean; intervalMs?: number }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * CINEMA_MANIFESTO.length));
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const rotate = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -12, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      setIdx(i => (i + 1) % CINEMA_MANIFESTO.length);
      slideAnim.setValue(12);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  useEffect(() => {
    if (!autoRotate) return;
    const t = setInterval(rotate, intervalMs);
    return () => clearInterval(t);
  }, [autoRotate, intervalMs, rotate]);

  return (
    <TouchableOpacity onPress={rotate} activeOpacity={0.88} style={{ marginHorizontal: 20, marginBottom: 6 }}>
      <View style={cm.wrap}>
        <LinearGradient colors={['rgba(90,150,230,0.08)', 'rgba(7,12,23,0.95)']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={cm.inner}>
          <View style={cm.topRow}>
            <Ionicons name="film" size={12} color={C.blue} />
            <Text style={cm.label}>UNIVERSE · MANIFESTE</Text>
            <Ionicons name="chevron-forward" size={10} color={C.muted} />
          </View>
          <Animated.Text style={[cm.quote, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            "{CINEMA_MANIFESTO[idx]}"
          </Animated.Text>
        </View>
        <View style={cm.dotsRow}>
          {CINEMA_MANIFESTO.map((_, i) => <View key={i} style={[cm.dot, i === idx && { backgroundColor: C.blue, width: 12 }]} />)}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const cm = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,150,230,0.60)' },
  inner: { padding: 16, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: C.blue, fontSize: 8, fontWeight: '800', letterSpacing: 1.8, flex: 1 },
  quote: { color: C.white, fontSize: 14, fontWeight: '700', lineHeight: 21, letterSpacing: -0.2, fontStyle: 'italic' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingBottom: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
});

export const XPMultiplierPill = memo(function XPMultiplierPill({ multiplier }: { multiplier: XPMultiplier }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (multiplier.value <= 1) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [multiplier.value]);

  if (multiplier.value <= 1) return null;

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: `${multiplier.color}35`, backgroundColor: `${multiplier.color}14` }}>
        <Ionicons name="flash" size={11} color={multiplier.color} />
        <Text style={{ color: multiplier.color, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }}>{multiplier.label}</Text>
        {multiplier.sources.length > 0 && <Text style={{ color: `${multiplier.color}90`, fontSize: 9, fontWeight: '600' }}>{multiplier.sources.join(' · ')}</Text>}
      </View>
    </Animated.View>
  );
});

export const GameHUD = memo(function GameHUD({ profile, earnedBadges }: { profile: GamiProfile; earnedBadges: GamiBadge[] }) {
  const prog = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.timing(prog, { toValue: profile.pct, duration: 900, useNativeDriver: false }).start();
  }, [profile.pct]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const barW = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const multiplier = getXPMultiplier(profile.streak_days, 0);

  return (
    <View style={hud.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 24 : 14} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={hud.inner}>
        <Animated.View style={[hud.lvlWrap, { opacity: glowAnim }]}>
          <View style={hud.lvlBadge}><Text style={hud.lvlNum}>LV.{profile.level}</Text></View>
        </Animated.View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={hud.title} numberOfLines={1}>{profile.title}</Text>
            <Text style={hud.xpLabel}>{profile.xp} XP</Text>
          </View>
          <View style={hud.xpTrack}><Animated.View style={[hud.xpFill, { width: barW }]} /></View>
        </View>
        <View style={hud.statsRow}>
          {profile.streak_days >= 2 && <View style={hud.stat}><Ionicons name="flame" size={10} color={C.orange} /><Text style={[hud.statVal, { color: C.orange }]}>{profile.streak_days}J</Text></View>}
          {earnedBadges.length > 0 && <View style={hud.stat}><Ionicons name="ribbon-outline" size={10} color={C.gold} /><Text style={[hud.statVal, { color: C.gold }]}>{earnedBadges.length}</Text></View>}
          {multiplier.value > 1 && <View style={hud.stat}><Ionicons name="flash" size={10} color={multiplier.color} /><Text style={[hud.statVal, { color: multiplier.color }]}>{multiplier.label}</Text></View>}
        </View>
      </View>
    </View>
  );
});

const hud = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  lvlWrap: {},
  lvlBadge: { width: 46, height: 46, borderRadius: 13, borderWidth: 2, borderColor: C.borderHi, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center' },
  lvlNum: { color: C.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: C.white, fontSize: 12, fontWeight: '700', flex: 1 },
  xpLabel: { color: C.muted, fontSize: 10, fontWeight: '700' },
  xpTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 2, backgroundColor: `${C.blue}CC` },
  statsRow: { flexDirection: 'column', gap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statVal: { fontSize: 10, fontWeight: '800' },
});

// ─── ★ CARD DE NIVEAU — enrichie : titre suivant, multiplicateur, jours actifs
export const XPBar = memo(function XPBar({
  profile, compact = false, checkinsCount,
}: { profile: GamiProfile; compact?: boolean; checkinsCount?: number }) {
  const prog      = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.timing(prog, { toValue: profile.pct, duration: 1200, useNativeDriver: false }).start();
  }, [profile.pct]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowPulse, { toValue: 0.35, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const barW        = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const multiplier  = useMemo(() => getXPMultiplier(profile.streak_days, 0), [profile.streak_days]);
  const nextTitle   = profile.level < 10 ? TITLES[profile.level] : null;
  const accentCol   = profile.level >= 9 ? C.gold : profile.level >= 7 ? C.purple : profile.level >= 5 ? C.blue : C.gold;

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={xb.compactBadge}>
          <Text style={xb.compactNum}>{profile.level}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={xb.compactTitle} numberOfLines={1}>{profile.title}</Text>
          <View style={xb.track}><Animated.View style={[xb.fill, { width: barW }]} /></View>
        </View>
        <Text style={xb.xpLabel}>{profile.xp} XP</Text>
      </View>
    );
  }

  return (
    <View style={[xb.wrap, { borderColor: `${accentCol}30` }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 18 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(245,200,66,0.07)','rgba(7,12,23,0.0)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {/* ── Cercle niveau avec aura pulsante ── */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[xb.glowRing, { opacity: glowPulse, borderColor: `${accentCol}70` }]} pointerEvents="none"/>
          <View style={[
            xb.circle,
            { borderColor: accentCol, backgroundColor: `${accentCol}12` },
            Platform.OS !== 'web' && { shadowColor: accentCol, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 14, elevation: 10 },
          ]}>
            <Text style={[xb.lvlBig, { color: accentCol }]}>{profile.level}</Text>
            <Text style={[xb.lvlLbl, { color: accentCol }]}>NIV</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={xb.title} numberOfLines={1}>{profile.title}</Text>
            {profile.streak_days >= 3 && <View style={xb.streakBadge}><Ionicons name="flame" size={9} color={C.orange} /><Text style={[xb.streakTxt, { color: C.orange }]}>{profile.streak_days}j</Text></View>}
            {profile.contribution_score > 0 && <View style={xb.contribPill}><Ionicons name="star-outline" size={8} color={C.gold} /><Text style={xb.contribTxt}>{profile.contribution_score}</Text></View>}
            {multiplier.value > 1 && <View style={[xb.contribPill,{backgroundColor:`${multiplier.color}18`,borderColor:`${multiplier.color}35`}]}><Ionicons name="flash" size={8} color={multiplier.color} /><Text style={[xb.contribTxt,{color:multiplier.color}]}>{multiplier.label}</Text></View>}
          </View>
          {/* ── Barre XP dorée épaisse ── */}
          <View style={xb.track}>
            <Animated.View style={[xb.fill, { width: barW }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={[xb.xpSub, { color: C.gold, fontWeight: '700' }]}>{profile.xp.toLocaleString()} XP</Text>
            </View>
            {profile.level < 10
              ? <Text style={xb.xpSub}>encore {profile.xpToNext} → niv. {profile.level + 1}</Text>
              : <Text style={[xb.xpSub, { color: C.gold }]}>NIVEAU MAX ✦</Text>
            }
          </View>
          {(nextTitle || typeof checkinsCount === 'number') && (
            <View style={xb.enrichRow}>
              {nextTitle && <Text style={xb.enrichTxt} numberOfLines={1}>Prochain titre : {nextTitle}</Text>}
              {typeof checkinsCount === 'number' && (
                <View style={xb.enrichPill}>
                  <Ionicons name="calendar-outline" size={8} color={C.mid} />
                  <Text style={xb.enrichPillTxt}>{checkinsCount}j actifs</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});
XPBar.displayName = 'XPBar';

const xb = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,200,66,0.22)', padding: 16 },
  glowRing: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 1.5, borderColor: 'rgba(245,200,66,0.55)', backgroundColor: 'transparent' },
  circle: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: C.gold, backgroundColor: 'rgba(245,200,66,0.10)', alignItems: 'center', justifyContent: 'center' },
  lvlBig: { color: C.gold, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  lvlLbl: { color: C.gold, fontSize: 7, fontWeight: '800', letterSpacing: 2, marginTop: -4 },
  title: { color: C.white, fontSize: 13, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(245,200,66,0.10)', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.18)' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: C.gold },
  xpLabel: { color: C.gold, fontSize: 11, fontWeight: '800' },
  xpSub: { color: C.muted, fontSize: 9.5 },
  compactBadge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.gold, backgroundColor: 'rgba(245,200,66,0.10)', alignItems: 'center', justifyContent: 'center' },
  compactNum: { color: C.gold, fontSize: 12, fontWeight: '900' },
  compactTitle: { color: C.white, fontSize: 11, fontWeight: '700' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(249,115,22,0.28)' },
  streakTxt: { fontSize: 9.5, fontWeight: '800' },
  contribPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: C.goldDim, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.25)' },
  contribTxt: { color: C.gold, fontSize: 8, fontWeight: '700' },
  enrichRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 },
  enrichTxt: { color: C.muted, fontSize: 9, fontWeight: '600', flexShrink: 1 },
  enrichPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: C.faint, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  enrichPillTxt: { color: C.mid, fontSize: 8, fontWeight: '700' },
});

export const BadgeChip = memo(function BadgeChip({ b, size = 'normal' }: { b: GamiBadge; size?: 'normal' | 'small' }) {
  const [open, setOpen] = useState(false);
  const col = RARITY_COL[b.rarity] ?? C.muted;
  const bg = RARITY_GLOW[b.rarity] ?? C.faint;
  const isSmall = size === 'small';
  const impactText = BADGE_IMPACT[b.id] ?? b.description;

  return (
    <GlowAccentCard
      accentColor={col}
      active={b.earned}
      borderRadius={13}
      onPress={() => setOpen(v => !v)}
      style={[bc.wrap, b.earned && { opacity: 1, backgroundColor: bg }, isSmall && bc.wrapSmall]}
    >
      <View style={[bc.icon, b.earned && { borderColor: `${col}35`, backgroundColor: `${col}14` }, isSmall && bc.iconSmall]}>
        <Ionicons name={b.icon} size={isSmall ? 12 : 17} color={b.earned ? col : C.muted} />
      </View>
      {b.earned && <View style={[bc.rarity, { backgroundColor: `${col}14`, borderColor: `${col}30` }]}><Text style={[bc.rarityTxt, { color: col }]}>{RARITY_LBL[b.rarity]}</Text></View>}
      <Text style={[bc.label, b.earned && { color: C.offWhite }]} numberOfLines={open ? undefined : 2}>{b.label}</Text>
      {b.earned && <Text style={bc.xp}>+{b.xp_reward} XP</Text>}
      {!b.earned && <View style={{ position: 'absolute', top: 7, right: 7 }}><Ionicons name="lock-closed" size={8} color={C.muted} /></View>}
      {open && <Text style={bc.desc}>{impactText}</Text>}
    </GlowAccentCard>
  );
});
BadgeChip.displayName = 'BadgeChip';

const bc = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 5, padding: 11, backgroundColor: C.faint, width: 88, opacity: 0.52, minHeight: 100 },
  wrapSmall: { width: 68, padding: 8, minHeight: 76 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.navyMid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  iconSmall: { width: 28, height: 28, borderRadius: 14 },
  label: { color: C.muted, fontSize: 8.5, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  rarity: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  rarityTxt: { fontSize: 6.5, fontWeight: '900', letterSpacing: 0.5 },
  xp: { color: C.gold, fontSize: 8, fontWeight: '800' },
  desc: { color: 'rgba(255,255,255,0.62)', fontSize: 8.5, textAlign: 'center', lineHeight: 12, marginTop: 2, fontStyle: 'italic' },
});

export const BadgesRow = memo(function BadgesRow({ badges }: { badges: GamiBadge[] }) {
  const sorted = useMemo(() => [...badges.filter(b => b.earned), ...badges.filter(b => !b.earned)], [badges]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingHorizontal: 20 }}>
      {sorted.map(b => <BadgeChip key={b.id} b={b} />)}
    </ScrollView>
  );
});

export const QuestsPanel = memo(function QuestsPanel({
  questsWithProgress,
  completedCount,
  onAction,
}: {
  questsWithProgress: ReturnType<typeof useQuests>['questsWithProgress'];
  completedCount: number;
  onAction: (action: string) => void;
}) {
  return (
    <View style={qp.wrap}>
      <View style={qp.header}>
        <Ionicons name="flag-outline" size={13} color={C.mid} />
        <Text style={qp.title}>Quêtes cinéphiles</Text>
        <View style={qp.badge}><Text style={qp.badgeTxt}>{completedCount}/{QUEST_DEFINITIONS.length}</Text></View>
      </View>
      {questsWithProgress.map(q => {
        const pctStr = `${Math.round(q.pct * 100)}%`;
        return (
          <View key={q.id} style={[qp.row, q.completed && qp.rowDone]}>
            <View style={[qp.iconWrap, q.completed && qp.iconDone]}>
              <Ionicons name={q.completed ? 'checkmark-circle' : q.icon} size={16} color={q.completed ? C.green : C.mid} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[qp.rowTitle, q.completed && { color: C.white }]} numberOfLines={1}>{q.title}</Text>
                {q.reward_badge && <View style={qp.rewardPill}><Ionicons name="ribbon-outline" size={8} color={C.gold} /></View>}
              </View>
              <Text style={qp.hook} numberOfLines={1}>{QUEST_HOOKS[q.id] ?? q.desc}</Text>
              <View style={qp.barRow}>
                <View style={qp.barTrack}><View style={[qp.barFill, { width: pctStr, backgroundColor: q.completed ? C.green : C.blue }] as any} /></View>
                <Text style={qp.progTxt}>{q.progress}/{q.target}</Text>
              </View>
            </View>
            {!q.completed && <TouchableOpacity onPress={() => onAction(q.action)} style={qp.actionBtn} activeOpacity={0.80}><Text style={qp.actionTxt}>→</Text></TouchableOpacity>}
          </View>
        );
      })}
    </View>
  );
});

const qp = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 20, marginBottom: 4 },
  title: { color: C.white, fontSize: 15, fontWeight: '800', flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: C.navyMid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  badgeTxt: { color: C.muted, fontSize: 9, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.faint, marginHorizontal: 20 },
  rowDone: { borderColor: 'rgba(46,204,138,0.20)', backgroundColor: 'rgba(46,204,138,0.04)' },
  iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.navyMid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: 'rgba(46,204,138,0.14)', borderColor: 'rgba(46,204,138,0.30)' },
  rowTitle: { color: C.mid, fontSize: 12, fontWeight: '700', flex: 1 },
  hook: { color: C.muted, fontSize: 9.5, fontStyle: 'italic', lineHeight: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  progTxt: { color: C.muted, fontSize: 9, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  rewardPill: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.goldDim, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.28)', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blueDim, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { color: C.blue, fontSize: 14, fontWeight: '700' },
});

export const ContributionCard = memo(function ContributionCard({ score }: { score: ContributionScore }) {
  const rows = [
    { label: 'Avis utiles', value: score.useful_reviews, pts: 10, icon: 'thumbs-up-outline' as const },
    { label: 'Recommandations', value: score.saved_recommendations, pts: 15, icon: 'bookmark-outline' as const },
    { label: 'Commentaires quali.', value: score.quality_comments, pts: 5, icon: 'chatbubble-outline' as const },
    { label: 'Pépites détectées', value: score.pepites_detected, pts: 12, icon: 'star-outline' as const },
    { label: 'Playlists suivies', value: score.followed_playlists, pts: 20, icon: 'list-outline' as const },
    { label: 'Films partagés', value: score.shared_films, pts: 12, icon: 'share-outline' as const },
  ].filter(r => r.value > 0);

  return (
    <View style={cc.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={cc.header}>
        <Ionicons name="analytics-outline" size={13} color={C.mid} />
        <Text style={cc.title}>Score de contribution</Text>
        <View style={cc.scorePill}><Text style={cc.scoreNum}>{score.total_score}</Text><Text style={cc.scoreLbl}>pts</Text></View>
      </View>
      {rows.length === 0
        ? <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', paddingVertical: 10, fontStyle: 'italic' }}>Publiez votre première critique pour commencer à contribuer.</Text>
        : rows.map(r => <View key={r.label} style={cc.row}><Ionicons name={r.icon} size={12} color={C.mid} /><Text style={cc.rowLabel}>{r.label}</Text><Text style={cc.rowVal}>{r.value}×</Text><Text style={cc.rowPts}>+{r.pts} pts</Text></View>)
      }
    </View>
  );
});

const cc = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: 14, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  title: { color: C.white, fontSize: 13, fontWeight: '800', flex: 1 },
  scorePill: { flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, backgroundColor: C.goldDim, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.28)' },
  scoreNum: { color: C.gold, fontSize: 14, fontWeight: '900' },
  scoreLbl: { color: C.gold, fontSize: 9, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: C.mid, fontSize: 11, flex: 1 },
  rowVal: { color: C.white, fontSize: 11, fontWeight: '700' },
  rowPts: { color: C.muted, fontSize: 10, width: 44, textAlign: 'right' },
});

// ─── ★ Panel des 4 défis du jour — VERROU DUR À 4, UI compacte ───────────────
type DailyQuestWithStatus = DailyQuestDef & {
  progress: number;
  completed: boolean;
  claimed: boolean;
  pct: number;
  verifying?: boolean;
};

const MAX_DAILY_CARDS = 4;

export const DailyQuestsPanel = memo(function DailyQuestsPanel({
  questsWithStatus,
  completedToday,
  onAction,
  onClaim,
}: {
  questsWithStatus: DailyQuestWithStatus[];
  completedToday: number;
  onAction: (action: string) => void;
  onClaim: (questId: string) => void;
}) {
  // ★ Verrou dur : jamais plus de 4 cartes, quoi qu'on reçoive en props.
  const items = useMemo(() => {
    if (__DEV__ && questsWithStatus.length > MAX_DAILY_CARDS) {
      console.warn(
        `[DailyQuestsPanel] ${questsWithStatus.length} défis reçus — seuls les ${MAX_DAILY_CARDS} premiers sont affichés. ` +
        `Vérifie que l'écran parent ne monte pas aussi QuestsPanel (10 quêtes) en plus de ce panel.`,
      );
    }
    return questsWithStatus.slice(0, MAX_DAILY_CARDS);
  }, [questsWithStatus]);

  const nextId = useMemo(() => {
    const ready = items.find(q => q.completed && !q.claimed);
    if (ready) return ready.id;
    const inProgress = items.find(q => !q.claimed);
    return inProgress?.id;
  }, [items]);

  return (
    <View style={dq.wrap}>
      <View style={dq.header}>
        <Ionicons name="today-outline" size={13} color={C.mid} />
        <Text style={dq.title}>Défis du jour</Text>
        <View style={dq.badge}><Text style={dq.badgeTxt}>{completedToday}/{items.length}</Text></View>
      </View>

      {/* Grille 2×2 fixe, compacte — tient sur l'écran sans scroll additionnel */}
      <View style={dq.grid}>
        {items.map(q => {
          const readyToClaim = q.completed && !q.claimed;
          const isNext = q.id === nextId;
          const pillarColor = PILLAR_DEFS[q.pillar].color;

          return (
            <DailyQuestCard
              key={q.id}
              quest={q}
              accent={readyToClaim ? C.gold : pillarColor}
              highlighted={isNext}
              readyToClaim={readyToClaim}
              onPress={() => !q.claimed && !readyToClaim && onAction(q.deepAction)}
              onClaim={() => onClaim(q.id)}
            />
          );
        })}
      </View>
    </View>
  );
});

const DailyQuestCard = memo(function DailyQuestCard({
  quest, accent, highlighted, readyToClaim, onPress, onClaim,
}: {
  quest: DailyQuestWithStatus; accent: string; highlighted: boolean; readyToClaim: boolean;
  onPress: () => void; onClaim: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!readyToClaim) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [readyToClaim]);

  // ★ Le bouton Claim n'apparaît / n'est cliquable QUE si la progression
  // locale confirme la cible atteinte. La vérification serveur définitive
  // a lieu dans claimDailyQuest lui-même (voir useDailyQuests ci-dessus).
  const { width: W } = useWindowDimensions();
  const cardW = (W - 20 * 2 - 10) / 2;
  const trulyReady = readyToClaim && quest.progress >= quest.target;
  const pctStr = `${Math.round(quest.pct * 100)}%`;

  return (
    <Animated.View style={[{ transform: [{ scale: trulyReady ? pulseAnim : 1 }] }, dq.cardWrap, { width: cardW }]}>
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={quest.claimed || quest.verifying}
        onPress={trulyReady ? onClaim : onPress}
        style={dq.cardOuter}
      >
        {/* ── Fond dégradé galaxy ── */}
        <LinearGradient
          colors={
            quest.claimed
              ? ['rgba(46,204,138,0.10)', 'rgba(7,12,23,0.0)']
              : trulyReady
                ? [`${accent}18`, 'rgba(7,12,23,0.0)']
                : ['rgba(245,200,66,0.05)', 'rgba(7,12,23,0.0)']
          }
          style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={[
          dq.card,
          quest.claimed && dq.cardDone,
          trulyReady && { borderColor: `${accent}55` },
          highlighted && !trulyReady && { borderColor: `${accent}40` },
        ]}>
          {highlighted && !quest.claimed && (
            <View style={[dq.nextPill, { backgroundColor: `${accent}25`, borderColor: `${accent}55` }]}>
              <Text style={[dq.nextTxt, { color: accent }]}>SUIVANT</Text>
            </View>
          )}

          {/* ── Icône 32x32 ── */}
          <View style={[dq.iconWrap, { borderColor: `${accent}40`, backgroundColor: `${accent}18` }]}>
            <Ionicons name={quest.claimed ? 'checkmark-circle' : quest.icon} size={18} color={quest.claimed ? C.green : accent} />
          </View>

          <Text style={dq.cardTitle} numberOfLines={1}>{quest.title}</Text>
          <Text style={dq.cardDesc} numberOfLines={2}>
            {quest.claimed ? 'Réclamé aujourd\'hui.' : quest.verifying ? 'Vérification en cours…' : trulyReady ? 'Terminé — réclamez votre XP !' : quest.hint}
          </Text>

          {/* ── Barre 5px ── */}
          <View style={dq.track}>
            <View style={[dq.fill, { width: pctStr, backgroundColor: quest.claimed ? C.green : accent }] as any} />
          </View>
          <Text style={dq.progLabel}>{quest.progress}/{quest.target}</Text>

          <View style={dq.footer}>
            <View style={dq.xpPill}>
              <Ionicons name="flash" size={9} color={C.gold} />
              <Text style={dq.xpTxt}>+{quest.xp} XP</Text>
            </View>
            {quest.verifying ? (
              <Text style={dq.cta}>…</Text>
            ) : trulyReady ? (
              <LinearGradient
                colors={[C.gold, '#E6B830']}
                style={dq.claimBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="flash" size={10} color={C.navyDark}/>
                <Text style={dq.claimTxt}>Réclamer</Text>
              </LinearGradient>
            ) : (
              <Text style={dq.cta}>{quest.claimed ? 'Terminé' : quest.cta}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const dq = StyleSheet.create({
  wrap: { gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 20, marginBottom: 2 },
  title: { color: C.white, fontSize: 14, fontWeight: '800', flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: C.navyMid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  badgeTxt: { color: C.muted, fontSize: 9, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
  cardWrap: { width: (SW - 20 * 2 - 10) / 2 },
  cardOuter: { borderRadius: 16, overflow: 'hidden' },
  card: { padding: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,200,66,0.15)', backgroundColor: 'transparent', gap: 6, minHeight: 140 },
  cardDone: { borderColor: 'rgba(46,204,138,0.30)' },
  nextPill: { position: 'absolute', top: 9, right: 9, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  nextTxt: { fontSize: 6.5, fontWeight: '900', letterSpacing: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: C.white, fontSize: 12, fontWeight: '800' },
  cardDesc: { color: C.muted, fontSize: 9, lineHeight: 12, minHeight: 24 },
  track: { height: 5, borderRadius: 999, backgroundColor: 'rgba(245,200,66,0.10)', overflow: 'hidden', marginTop: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.15)' },
  fill: { height: '100%', borderRadius: 999 },
  progLabel: { color: C.muted, fontSize: 8, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, backgroundColor: C.goldDim, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.25)' },
  xpTxt: { color: C.gold, fontSize: 8.5, fontWeight: '800' },
  cta: { color: C.blue, fontSize: 9.5, fontWeight: '800' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  claimTxt: { color: C.navyDark, fontSize: 9.5, fontWeight: '900' },
});

// ─── ★ Prise en main — guide 4 étapes, compact ────────────────────────────────
export const FirstStepsGuide = memo(function FirstStepsGuide({
  visible,
  questsWithStatus,
  onAction,
  onDismiss,
}: {
  visible: boolean;
  questsWithStatus: DailyQuestWithStatus[];
  onAction: (action: string) => void;
  onDismiss: () => void;
}) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const items = useMemo(() => questsWithStatus.slice(0, MAX_DAILY_CARDS), [questsWithStatus]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible]);

  if (!visible) return null;

  const firstUndoneIdx = items.findIndex(q => q.progress === 0);

  return (
    <View style={fsg.wrap}>
      <LinearGradient colors={['rgba(90,150,230,0.10)', 'rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={fsg.inner}>
        <View style={fsg.headRow}>
          <Text style={fsg.eyebrow}>BIENVENUE SUR UNIVERSE</Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={10}>
            <Ionicons name="close" size={15} color={C.muted} />
          </TouchableOpacity>
        </View>
        <Text style={fsg.title}>4 gestes pour démarrer</Text>

        <View style={{ gap: 6, marginTop: 8 }}>
          {items.map((q, i) => {
            const isCurrent = i === firstUndoneIdx;
            const color = PILLAR_DEFS[q.pillar].color;
            return (
              <TouchableOpacity
                key={q.id}
                onPress={() => onAction(q.deepAction)}
                activeOpacity={0.82}
                style={[fsg.step, isCurrent && { borderColor: `${color}45`, backgroundColor: `${color}0F` }]}
              >
                <Animated.View style={[fsg.stepNum, { borderColor: `${color}40` }, isCurrent && { opacity: glowAnim }]}>
                  <Text style={[fsg.stepNumTxt, { color }]}>{i + 1}</Text>
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <Text style={fsg.stepTitle} numberOfLines={1}>{q.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={12} color={C.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const fsg = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 4, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi },
  inner: { padding: 12, gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: C.blue, fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: C.white, fontSize: 14, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.faint },
  stepNum: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navyMid },
  stepNumTxt: { fontSize: 10, fontWeight: '900' },
  stepTitle: { color: C.white, fontSize: 11.5, fontWeight: '700' },
});

export const PillarsDashboard = memo(function PillarsDashboard({ pillars }: { pillars: PillarProgress[] }) {
  const { width: W } = useWindowDimensions();
  const cardW = (W - 20 * 2 - 10) / 2;
  return (
    <View style={pd.wrap}>
      <View style={pd.header}>
        <Ionicons name="grid-outline" size={13} color={C.mid} />
        <Text style={pd.title}>Piliers</Text>
      </View>
      <View style={pd.grid}>
        {pillars.map(p => (
          <TouchableOpacity key={p.key} activeOpacity={0.85} style={[pd.card, { width: cardW }]}>
            <View style={[pd.iconWrap, { borderColor: `${p.color}35`, backgroundColor: `${p.color}14` }]}>
              <Ionicons name={p.icon} size={16} color={p.color} />
            </View>
            <Text style={pd.label}>{p.label}</Text>
            <Text style={pd.score}>{p.score}/100</Text>
            <View style={pd.track}><View style={[pd.fill, { width: `${p.pct * 100}%`, backgroundColor: p.color }]} /></View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const pd = StyleSheet.create({
  wrap: { gap: 10, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: C.white, fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: (SW - 20 * 2 - 10) / 2, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.faint, padding: 12, gap: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  label: { color: C.white, fontSize: 12, fontWeight: '800' },
  score: { color: C.muted, fontSize: 10, fontWeight: '700' },
  track: { height: 3, borderRadius: 999, backgroundColor: C.faint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});

export const JourneySection = memo(function JourneySection({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={js.wrap}>
      <LinearGradient colors={['rgba(90,150,230,0.10)', 'rgba(7,12,23,0.90)']} style={StyleSheet.absoluteFillObject} />
      <View style={js.inner}>
        <View style={js.badge}><Ionicons name="sparkles-outline" size={12} color={C.gold} /><Text style={js.badgeTxt}>DÉCOUVERTE</Text></View>
        <Text style={js.title}>{title}</Text>
        <Text style={js.subtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
});

const js = StyleSheet.create({
  wrap: { marginHorizontal: 20, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi },
  inner: { padding: 16, gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeTxt: { color: C.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: C.white, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: C.muted, fontSize: 11.5, lineHeight: 17 },
});

export const WeeklyChallengeCard = memo(function WeeklyChallengeCard({
  challenge,
  progress,
  onOpen,
}: {
  challenge: WeeklyChallenge;
  progress: ChallengeProgress | null;
  onOpen: () => void;
}) {
  const accent = challenge.color_accent;
  const total = challenge.steps.length;
  const doneDone = progress?.steps_done?.length ?? 0;
  const pct = total > 0 ? doneDone / total : 0;
  const isDone = progress?.completed ?? false;
  const diffCol = DIFF_COL[challenge.difficulty] ?? C.blue;

  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={wcc.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 18 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[wcc.strip, { backgroundColor: accent }]} />
      <View style={wcc.inner}>
        <View style={wcc.header}>
          <View style={[wcc.iconWrap, { backgroundColor: `${accent}18`, borderColor: `${accent}38` }]}>
            <Ionicons name={challenge.icon} size={22} color={accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={[wcc.pill, { borderColor: `${accent}35`, backgroundColor: `${accent}12` }]}>
                <Ionicons name="flame-outline" size={8} color={accent} />
                <Text style={[wcc.pillTxt, { color: accent }]}>SEM. {challenge.week_number}</Text>
              </View>
              <View style={[wcc.pill, { borderColor: `${diffCol}35`, backgroundColor: `${diffCol}10` }]}>
                <Text style={[wcc.pillTxt, { color: diffCol }]}>{challenge.difficulty.toUpperCase()}</Text>
              </View>
              {isDone && <View style={[wcc.pill, { borderColor: 'rgba(46,204,138,0.30)', backgroundColor: 'rgba(46,204,138,0.08)' }]}><Ionicons name="checkmark-circle" size={8} color={C.green} /><Text style={[wcc.pillTxt, { color: C.green }]}>TERMINÉ</Text></View>}
            </View>
            <Text style={wcc.title}>{challenge.title}</Text>
            {challenge.subtitle && <Text style={wcc.subtitle}>{challenge.subtitle}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={14} color={C.muted} />
        </View>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {challenge.steps.map((_, i) => {
            const done = (progress?.steps_done ?? []).includes(i) || isDone;
            return (
              <View key={i} style={[wcc.dot, done && { backgroundColor: accent, borderColor: accent }]}>
                {done && <Ionicons name="checkmark" size={7} color={C.white} />}
              </View>
            );
          })}
        </View>
        <View style={{ gap: 5 }}>
          <View style={wcc.track}><View style={[wcc.fill, { width: `${pct * 100}%`, backgroundColor: accent }]} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={wcc.progTxt}>{isDone ? `+${challenge.reward_points} pts gagnés` : `${Math.round(pct * 100)}% · ${challenge.reward_points} pts`}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="flash" size={9} color={C.gold} />
              <Text style={[wcc.progTxt, { color: C.gold }]}>+{challenge.reward_xp} XP</Text>
            </View>
          </View>
        </View>
        {challenge.reward_label && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="gift-outline" size={10} color={C.muted} /><Text style={wcc.rewardTxt}>{challenge.reward_label}</Text></View>}
      </View>
    </TouchableOpacity>
  );
});

const wcc = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi, marginHorizontal: 20, marginBottom: 6 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  inner: { padding: 16, paddingLeft: 20, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  pillTxt: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  title: { color: C.white, fontSize: 14, fontWeight: '900', flex: 1 },
  subtitle: { color: C.muted, fontSize: 10.5, lineHeight: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: C.faint, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center' },
  track: { height: 3, borderRadius: 999, backgroundColor: C.faint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  progTxt: { color: C.muted, fontSize: 9, fontWeight: '700' },
  rewardTxt: { color: C.muted, fontSize: 9, fontWeight: '700' },
});