/**
 * components/gamification/constants.ts
 * Toutes les constantes de la gamification Universe
 */
import type {
    GamiBadge, QuestDef, DailyChallengeBase, StreakReward, Rarity,
  } from './types';
  
  // ─── XP & NIVEAUX ────────────────────────────────────────────────────────────
  export const XP_TABLE = [
    0, 100, 300, 700, 1500, 3000, 6000, 12000, 25000, 50000,
  ] as const;
  
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
  
  export const LEVEL_COLORS: Record<number, string> = {
    1: '#5A96E6', 2: '#5A96E6', 3: '#5A96E6',
    4: '#2ECC8A', 5: '#2ECC8A',
    6: '#F97316', 7: '#F97316',
    8: '#8B5CF6',
    9: '#F5C842', 10: '#F5C842',
  };
  
  // ─── RÉCOMPENSES STREAK ────────────────────────────────────────────────────────
  export const STREAK_REWARDS: Record<number, StreakReward> = {
    1:  { xp: 10,  gems: 0,  label: 'Réveil cinéphile',       rarity: 'commun',    color: '#5A96E6' },
    2:  { xp: 15,  gems: 1,  label: 'Curiosité allumée',      rarity: 'commun',    color: '#5A96E6' },
    3:  { xp: 25,  gems: 2,  label: 'Flamme cinéphile',       rarity: 'commun',    color: '#F97316' },
    4:  { xp: 30,  gems: 2,  label: 'Constance artistique',   rarity: 'commun',    color: '#F97316' },
    5:  { xp: 50,  gems: 4,  label: 'Passion intacte',        rarity: 'rare',      color: '#2ECC8A' },
    6:  { xp: 60,  gems: 5,  label: 'Discipline du 7ème art', rarity: 'rare',      color: '#2ECC8A' },
    7:  { xp: 100, gems: 8,  label: 'Semaine parfaite !',     rarity: 'rare',      badge: 'streak_7',  color: '#F5C842' },
    14: { xp: 200, gems: 15, label: 'Deux semaines de feu !', rarity: 'épique',    color: '#8B5CF6' },
    21: { xp: 300, gems: 22, label: 'Rituel cinéphile absolu',rarity: 'épique',    badge: 'rituel_cinephile', color: '#8B5CF6' },
    30: { xp: 500, gems: 40, label: 'Un mois de cinéma pur !',rarity: 'légendaire',badge: 'streak_30', color: '#F5C842' },
    60: { xp: 1000,gems: 80, label: 'Légende vivante',        rarity: 'légendaire',badge: 'legende_7art', color: '#F5C842' },
  };
  
  export function getStreakReward(day: number): StreakReward {
    const milestones = Object.keys(STREAK_REWARDS).map(Number).sort((a, b) => b - a);
    for (const m of milestones) { if (day >= m) return STREAK_REWARDS[m]; }
    return STREAK_REWARDS[1];
  }
  
  // ─── MESSAGES LEVEL-UP (10 niveaux) ──────────────────────────────────────────
  export const LEVEL_UP_COPY: Record<number, { headline: string; body: string }> = {
    2:  { headline: "L'éveil commence.",         body: "Votre curiosité vient de s'allumer. Rien ne sera plus comme avant." },
    3:  { headline: "Vous sortez des sentiers.", body: "Vous allez là où les autres n'osent pas. Bienvenue dans l'indépendant." },
    4:  { headline: "Votre plume prend vie.",    body: "Vous avez donné de la voix à des films qui en avaient désespérément besoin." },
    5:  { headline: "Le radar s'active.",        body: "Vous faites partie des 5% qui découvrent avant tout le monde. Votre goût est une arme." },
    6:  { headline: "Instinct de prédateur.",    body: "Vous repérez les pépites que les algorithmes manquent. Les réalisateurs ont besoin de vous." },
    7:  { headline: "Une voix dans le chaos.",   body: "D'autres cinéphiles lisent votre parole, la suivent, la respectent." },
    8:  { headline: "La maîtrise totale.",       body: "Votre contribution est réelle. Mesurable. Irréversible. Universe est différente grâce à vous." },
    9:  { headline: "Le mythe prend forme.",     body: "Peu de gens atteignent ce niveau. Vous faites désormais partie de l'histoire d'Universe." },
    10: { headline: "L'immortalité.",            body: "Vous êtes ce que le cinéma indépendant appelle quand il a besoin d'être sauvé." },
  };
  
  // ─── ★ MANIFESTE CINÉMA — 30 phrases choc ────────────────────────────────────
  export const CINEMA_MANIFESTO: readonly string[] = [
    "Universe est la seule app où votre regard vaut plus que n'importe quel algorithme.",
    "Revenez demain. Un réalisateur compte sur vous.",
    "Ce film que vous découvrez ce soir ? Dans 5 ans, tout le monde dira qu'il était évident.",
    "24 heures sans Universe, c'est 24 heures où le cinéma libre survit sans vous.",
    "Votre critique publiée hier a peut-être été lue par le réalisateur ce matin.",
    "Vous n'êtes pas utilisateur. Vous êtes gardien du 7ème art.",
    "Chaque jour que vous revenez, vous prouvez que le cinéma libre mérite d'exister.",
    "Les plateformes grand public vous disent quoi regarder. Universe vous fait confiance.",
    "Votre streak, c'est autant de jours où le cinéma indépendant a eu un témoin digne.",
    "Ce que vous faites ici, personne d'autre ne le fait. Continuez.",
    "Le vrai cinéma n'attend pas. Il compte les jours.",
    "Ouvrir Universe chaque jour, c'est un acte politique en faveur du cinéma libre.",
    "Votre niveau n'est pas un score. C'est votre identité cinéphile.",
    "Les grandes découvertes cinéma ne se font pas en salle. Elles se font ici.",
    "Universe grandit grâce à des gens comme vous. Ne nous abandonnez pas.",
    "Les films que personne ne finance ont les histoires que tout le monde doit voir.",
    "Vous n'êtes pas spectateur. Vous êtes leur premier public.",
    "Il n'y a pas de petits films. Il n'y a que des regards trop petits.",
    "Derrière chaque plan, un cinéaste a tout misé. Vous lui devez votre attention.",
    "Universe : là où le cinéma vivant cherche ses témoins.",
    "Vous ne regardez pas des films. Vous choisissez quel cinéma mérite d'exister.",
    "Certains collectionnent les films. Les vrais les font exister.",
    "Revenir chaque jour, c'est choisir le cinéma qui résiste.",
    "Un réalisateur indépendant crée sans filet. Vous regardez sans frontières.",
    "Ce que vous avez vu hier, le grand public le verra dans dix ans.",
    "Votre streak prouve que la passion est une discipline. Pas un caprice.",
    "Universe n'est pas une app. C'est la résistance du cinéma vivant.",
    "Chaque pépite que vous détectez sauve un cinéaste de l'anonymat.",
    "Un film indépendant sans spectateur, c'est un cri dans le vide. Brisez ce silence.",
    "La vraie critique ne se note pas. Elle se ressent. Universe vous donne cet espace.",
  ] as const;
  
  // ─── ★ CATALOGUE BADGES (15 badges) ─────────────────────────────────────────
  export const BADGES_CATALOG: Omit<GamiBadge, 'earned' | 'earned_at'>[] = [
    {
      id: 'explorateur_indie', label: 'Explorateur indé', rarity: 'commun', xp_reward: 15, gems_reward: 1, is_hidden: false,
      icon: 'compass-outline',
      description: '10 courts-métrages visionnés.',
      impact: "Vous avez traversé 10 univers que le grand public n'atteindra jamais.",
    },
    {
      id: 'cinephile_nocturne', label: 'Cinéphile nocturne', rarity: 'commun', xp_reward: 5, gems_reward: 1, is_hidden: false,
      icon: 'moon-outline',
      description: "Actif sur l'app après 22h.",
      impact: "Les films les plus honnêtes se regardent quand tout le monde dort.",
    },
    {
      id: 'decouvreur_pepites', label: 'Découvreur de pépites', rarity: 'rare', xp_reward: 25, gems_reward: 3, is_hidden: false,
      icon: 'star-outline',
      description: 'Liké un film avant 100 vues.',
      impact: "Votre instinct cinéphile a devancé tous les algorithmes. C'est rare.",
    },
    {
      id: 'critique_herbe', label: 'Critique en herbe', rarity: 'rare', xp_reward: 40, gems_reward: 4, is_hidden: false,
      icon: 'create-outline',
      description: '5 avis argumentés (min. 50 mots) publiés.',
      impact: "Votre plume donne une voix à des films qui en avaient besoin.",
    },
    {
      id: 'festival_lover', label: 'Festival Lover', rarity: 'rare', xp_reward: 20, gems_reward: 2, is_hidden: false,
      icon: 'trophy-outline',
      description: 'Sélection thématique complète regardée.',
      impact: "Une programmation entière. Vous avez fait le travail d'un jury.",
    },
    {
      id: 'curateur_underground', label: 'Curateur underground', rarity: 'épique', xp_reward: 50, gems_reward: 6, is_hidden: false,
      icon: 'bookmark-outline',
      description: '3 playlists suivies par 10+ personnes.',
      impact: "10 personnes vous font confiance pour guider leur regard.",
    },
    {
      id: 'ambassadeur_indie', label: 'Ambassadeur indé', rarity: 'épique', xp_reward: 60, gems_reward: 7, is_hidden: false,
      icon: 'share-outline',
      description: "10 films partagés hors de l'app.",
      impact: "Vous propagez ce que les autres ignorent. Le cinéma libre a besoin de vous.",
    },
    {
      id: 'famille_cinemato', label: 'Famille cinématographique', rarity: 'commun', xp_reward: 10, gems_reward: 1, is_hidden: false,
      icon: 'people-outline',
      description: '3 films du même réalisateur regardés.',
      impact: "Vous avez suivi un artiste dans sa vision. C'est ce que font les vrais.",
    },
    {
      id: 'esprit_ouvert', label: 'Esprit ouvert', rarity: 'rare', xp_reward: 20, gems_reward: 2, is_hidden: false,
      icon: 'flask-outline',
      description: 'Cinéma expérimental exploré.',
      impact: "L'expérimental, c'est le cinéma du futur. Vous y étiez.",
    },
    {
      id: 'rituel_cinephile', label: 'Rituel cinéphile', rarity: 'rare', xp_reward: 25, gems_reward: 3, is_hidden: false,
      icon: 'flame-outline',
      description: '5 jours de visionnage consécutifs.',
      impact: "Un film par jour pendant 5 jours. Un rituel. Une identité.",
    },
    {
      id: 'prescripteur', label: 'Prescripteur', rarity: 'épique', xp_reward: 30, gems_reward: 4, is_hidden: false,
      icon: 'thumbs-up-outline',
      description: 'Recommandation sauvegardée par 10+ personnes.',
      impact: "Votre recommandation a changé la soirée de quelqu'un. Peut-être sa vie.",
    },
    {
      id: 'streak_7', label: 'Semaine parfaite', rarity: 'rare', xp_reward: 50, gems_reward: 5, is_hidden: false,
      icon: 'calendar-outline',
      description: '7 jours de connexion consécutifs.',
      impact: "7 jours. Votre passion n'a pas pris un seul jour de congé.",
    },
    {
      id: 'streak_30', label: 'Mois de cinéma', rarity: 'légendaire', xp_reward: 300, gems_reward: 30, is_hidden: false,
      icon: 'ribbon-outline',
      description: '30 jours de connexion consécutifs.',
      impact: "30 jours. Vous êtes au-delà du cinéphile. Vous êtes Universe.",
    },
    {
      id: 'first_critique', label: 'Première parole', rarity: 'commun', xp_reward: 5, gems_reward: 1, is_hidden: false,
      icon: 'chatbubble-outline',
      description: 'Première critique publiée.',
      impact: "Le commencement de tout. Votre voix existe maintenant.",
    },
    {
      id: 'legende_7art', label: 'Légende du 7ème art', rarity: 'légendaire', xp_reward: 200, gems_reward: 25, is_hidden: false,
      icon: 'film-outline',
      description: '50+ films vus, contribution exceptionnelle.',
      impact: "Les légendes du cinéma ne naissent pas en salle. Elles naissent ici.",
    },
  ];
  
  // ─── ★ QUÊTES PERMANENTES (6) ────────────────────────────────────────────────
  export const QUEST_DEFINITIONS: QuestDef[] = [
    {
      id: 'watch_3_same_director', title: 'Famille cinématographique',
      desc: 'Regarder 3 films du même réalisateur', target: 3, xp: 20, gems: 2,
      reward_badge: 'famille_cinemato', action: 'go_catalog', route: '/search',
      icon: 'people-outline',
      hook: "Ce réalisateur a mis des années à créer son langage. 3 films, et vous le parlez.",
    },
    {
      id: 'watch_5_under_5min', title: 'Amateur de formats courts',
      desc: '5 films de moins de 5 minutes', target: 5, xp: 25, gems: 2,
      reward_badge: 'explorateur_indie', action: 'go_catalog', route: '/search',
      icon: 'timer-outline',
      hook: "5 minutes. C'est tout ce qu'il faut pour changer votre vision du cinéma.",
    },
    {
      id: 'write_5_critiques', title: 'Voix critique',
      desc: '5 critiques argumentées', target: 5, xp: 40, gems: 4,
      reward_badge: 'critique_herbe', action: 'go_social', route: '/(tabs)/social',
      icon: 'create-outline',
      hook: "Votre critique de 80 mots peut être la bouée de sauvetage d'un cinéaste.",
    },
    {
      id: 'connect_1_pro', title: 'Réseau professionnel',
      desc: 'Contacter un professionnel du cinéma', target: 1, xp: 15, gems: 2,
      reward_badge: null, action: 'go_social', route: '/(tabs)/social',
      icon: 'briefcase-outline',
      hook: "Derrière chaque connexion, une collaboration qui pourrait tout changer.",
    },
    {
      id: 'explore_experimental', title: 'Esprit ouvert',
      desc: '3 films du genre expérimental', target: 3, xp: 20, gems: 2,
      reward_badge: 'esprit_ouvert', action: 'go_catalog', route: '/search',
      icon: 'flask-outline',
      hook: "Là où les règles s'effondrent, le cinéma renaît. Explorez.",
    },
    {
      id: 'watch_5_consecutive', title: 'Rituel cinéphile',
      desc: '1 film par jour pendant 5 jours', target: 5, xp: 30, gems: 3,
      reward_badge: 'rituel_cinephile', action: 'go_catalog', route: '/search',
      icon: 'flame-outline',
      hook: "Un film par jour. Le minimum vital du cinéphile en formation.",
    },
  ];
  
  // ─── ★ DÉFIS QUOTIDIENS (7 types, 3 par jour) ─────────────────────────────────
  export const ALL_DAILY_CHALLENGES: DailyChallengeBase[] = [
    { id: 'watch',    title: 'Film du jour',       desc: 'Regarder 1 reel jusqu\'à la fin',          xp: 15, gems: 2, icon: 'play-circle-outline',  route: '/(tabs)' },
    { id: 'like',     title: 'Coup de coeur',       desc: 'Liker une critique qui vous touche',        xp: 10, gems: 1, icon: 'heart-outline',         route: '/(tabs)/social' },
    { id: 'comment',  title: 'Voix du soir',        desc: 'Commenter une critique avec sincérité',     xp: 12, gems: 1, icon: 'chatbubble-outline',     route: '/(tabs)/social' },
    { id: 'share',    title: 'Passeur de cinéma',   desc: "Partager un film hors de l'app",            xp: 10, gems: 1, icon: 'share-outline',         route: '/(tabs)/social' },
    { id: 'explore',  title: 'Terra Incognita',     desc: 'Explorer un genre que vous ignorez',         xp: 20, gems: 2, icon: 'compass-outline',      route: '/search' },
    { id: 'critique', title: 'Critique express',    desc: 'Écrire un avis de 50 mots minimum',          xp: 25, gems: 3, icon: 'create-outline',       route: '/(tabs)/create' },
    { id: 'profile',  title: 'Miroir cinéphile',    desc: 'Compléter une section de votre profil',      xp: 8,  gems: 1, icon: 'person-outline',       route: '/profile' },
  ];
  
  export function getTodaysChallenges(): DailyChallengeBase[] {
    const day = new Date().getDay(); // 0-6
    const i0 = day % 7;
    const i1 = (day + 2) % 7;
    const i2 = (day + 4) % 7;
    return [ALL_DAILY_CHALLENGES[i0], ALL_DAILY_CHALLENGES[i1], ALL_DAILY_CHALLENGES[i2]];
  }
  
  export const todayStr = () => new Date().toISOString().slice(0, 10);
  export const dailyQuestKey = (id: string) => `daily_${todayStr()}_${id}`;
  
  // ─── RARETÉ — couleurs ────────────────────────────────────────────────────────
  export const RARITY_COLOR: Record<string, string> = {
    commun: 'rgba(255,255,255,0.58)',
    rare: '#5A96E6',
    épique: '#8B5CF6',
    légendaire: '#F5C842',
  };
  export const RARITY_BG: Record<string, string> = {
    commun: 'rgba(255,255,255,0.06)',
    rare: 'rgba(90,150,230,0.14)',
    épique: 'rgba(139,92,246,0.14)',
    légendaire: 'rgba(245,200,66,0.14)',
  };
  export const RARITY_LABEL: Record<string, string> = {
    commun: 'COMMUN', rare: 'RARE', épique: 'ÉPIQUE', légendaire: 'LÉGENDAIRE',
  };
  export const DIFF_COLOR: Record<string, string> = {
    facile: '#2ECC8A', normal: '#5A96E6', difficile: '#F97316', légendaire: '#F5C842',
  };