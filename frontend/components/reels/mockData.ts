
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
    video_url:   "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    
    caption: "oh you are an actor…\nwhat have i seen you in?",
    duration: '9:56', likes: 1324,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[2]],
    tags: ['Thriller', 'Indépendant'], director: 'Sophie Martin', year: 2024,
    comment: "ça a l'air super…", verified: true,
  },
  {
    id: '2', title: 'Nuit de Verre', series: 'Nuit de Verre', episode: 1,
    episode_title: 'La première fracture',
    poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
   
    video_url:    "https://test-videos.co.uk/vids/jellyfish/mp4/h264/1080/Jellyfish_1080_10s_1MB.mp4",
    caption: "parfois l'obscurité\nest la seule lumière",
    duration: '10:54', likes: 872,
    liked_by_friends: [FRIENDS_POOL[2], FRIENDS_POOL[4]],
    tags: ['Drame', 'Court métrage'], director: 'Karim Belhadj', year: 2024,
    comment: "cette scène m'a touché…",
  },
  {
    id: '3', title: 'Horizon Brisé', series: 'Horizon Brisé', episode: 2,
    episode_title: 'Le dernier signal',
    poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
    video_url:       "https://www.w3schools.com/html/mov_bbb.mp4",
    caption: "jusqu'où peut-on\naller pour la vérité ?",
    duration: '0:15', likes: 2100,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[3], FRIENDS_POOL[4]],
    tags: ['Sci-Fi', 'ORIGINAL'], director: 'Emma Dupont', year: 2023,
    comment: 'le bro Enzo boit l\'eau des pâtes', verified: true,
  },
  {
    id: '4', title: 'Velours Rouge', series: 'Velours Rouge', episode: 3,
    episode_title: 'Masques',
    poster_url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80',
    video_url:    "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/87/Schlossbergbahn.webm/Schlossbergbahn.webm.1080p.vp9.webm", 
    caption: "qui sommes-nous\nsans nos masques ?",
    duration: '0:15', likes: 3400,
    liked_by_friends: [FRIENDS_POOL[1], FRIENDS_POOL[2]],
    tags: ['Romance', 'Festival'], director: 'Isabelle Morin', year: 2024,
    comment: 'romantique et douloureux…',
  },
  {
    id: '5', title: 'Fractures', series: 'Fractures', episode: 1,
    episode_title: 'Avant le tremblement',
    poster_url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&q=80',
    video_url:   "https://test-videos.co.uk/vids/sintel/mp4/h264/1080/Sintel_1080_10s_1MB.mp4", 
    caption: "dans chaque fissure\nse cache une histoire",
    duration: '14:48', likes: 2750,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[1], FRIENDS_POOL[2], FRIENDS_POOL[3]],
    tags: ['Documentaire', 'Indépendant'], director: 'Lucas Moreau', year: 2023,
  },
{
    id: '6', title: 'Échos du Passé', series: 'Échos du Passé', episode: 2,
    episode_title: 'Les voix oubliées',
    poster_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    video_url:     "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
       caption: "les souvenirs résonnent\ncomme des échos lointains",
    duration: '12:30', likes: 1980,
    liked_by_friends: [FRIENDS_POOL[1], FRIENDS_POOL[4]],
    tags: ['Mystère', 'Court métrage'], director: 'Sophie Martin', year: 2024,
    comment: 'une atmosphère envoûtante…', verified: true,
    },
    {

    id: '7', title: 'Lumières Fugitives', series: 'Lumières Fugitives', episode: 1,
    episode_title: 'La rencontre',
    poster_url: 'https://images.unsplash.com/photo-1491895200222-0fc4a4c35e18?w=800&q=80',
    video_url:   "https://vjs.zencdn.net/v/oceans.mp4",                                     
    caption: "parfois, une rencontre\npeut tout changer",
    duration: '9:20', likes: 2560,
    liked_by_friends: [FRIENDS_POOL[0], FRIENDS_POOL[2], FRIENDS_POOL[3]],
    tags: ['Romance', 'Indépendant'], director: 'Karim Belhadj', year: 2024,
        comment: 'une histoire d\'amour délicate…',
    },
];