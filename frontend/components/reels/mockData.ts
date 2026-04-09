
import type { Friend, FeedFilm } from './types';

export const FRIENDS_POOL: Friend[] = [
  { id: 'f1', name: '@lucie_mv',  avatar: 'https://i.pravatar.cc/60?img=9',  followed: true  },
  { id: 'f2', name: '@marc.film', avatar: 'https://i.pravatar.cc/60?img=12', followed: false },
  { id: 'f3', name: '@anaelle_c', avatar: 'https://i.pravatar.cc/60?img=22', followed: true  },
  { id: 'f4', name: '@hugo_cine', avatar: 'https://i.pravatar.cc/60?img=33', followed: false },
  { id: 'f5', name: '@soph_art',  avatar: 'https://i.pravatar.cc/60?img=47', followed: true  },
];

// Vidéos MP4 directement streamables (CDN public sans redirect)
export const MOCK_FEED: FeedFilm[] = [
  {
    id: '1', title: 'Puffers', series: 'Puffers', episode: 1,
    episode_title: "Reprends là où tu t'es arrêté",
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',    
    duration: '9:56', likes: 1324,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[2]],
    tags: ['Thriller', 'Indépendant'], director: 'Sophie Martin', year: 2024,
    comment: "ça a l'air super…", verified: true,
  },
  {
    id: '2', title: 'Nuit de Verre', series: 'Nuit de Verre', episode: 1,
    episode_title: 'La première fracture',
    poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
    duration: '10:54', likes: 872,
    liked_by_friends: [FRIENDS_POOL[2], FRIENDS_POOL[4]],
    tags: ['Drame', 'Court métrage'], director: 'Karim Belhadj', year: 2024,
    comment: "cette scène m'a touché…",
  },
  {
    id: '3', title: 'Horizon Brisé', series: 'Horizon Brisé', episode: 2,
    episode_title: 'Le dernier signal',
    poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
    duration: '0:15', likes: 2100,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[3], FRIENDS_POOL[4]],
    tags: ['Sci-Fi', 'ORIGINAL'], director: 'Emma Dupont', year: 2023,
    comment: 'le bro Enzo boit l\'eau des pâtes', verified: true,
  },
  {
    id: '4', title: 'Velours Rouge', series: 'Velours Rouge', episode: 3,
    episode_title: 'Masques',
    poster_url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80',
    duration: '0:15', likes: 3400,
    liked_by_friends: [FRIENDS_POOL[1], FRIENDS_POOL[2]],
    tags: ['Romance', 'Festival'], director: 'Isabelle Morin', year: 2024,
    comment: 'romantique et douloureux…',
  },
  {
    id: '5', title: 'Fractures', series: 'Fractures', episode: 1,
    episode_title: 'Avant le tremblement',
    poster_url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&q=80',
    duration: '14:48', likes: 2750,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[2], FRIENDS_POOL[3]],
    tags: ['Documentaire', 'Indépendant'], director: 'Lucas Moreau', year: 2023,
  },
];