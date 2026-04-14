import { G } from './theme';

// ─────────────────────────────────────────────────────────────────────────────
// 📐 SHARED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface FilmItem {
  id: string; // UI key (fav1, fav2...) — uniquement pour React keys
  title: string;
  posterUrl: string;
  genre: string;
  type: 'film' | 'série';
  rating: number;
  director?: string;
  year?: number;
  episodes?: number;
  status?: string;

  workId?: number; // résolu depuis Supabase
}
  
  export interface ReviewItem {
    id: string;
    filmId: string;
    content: string;
    rating: number;
    likes: number;
    date: string;
    film?: {
      id: string; title: string; posterUrl: string;
      genre: string; type: 'film' | 'série';
    };
  }
  
  export interface ReelItem {
    id: string;
    title: string;
    duration: string;
    posterUrl: string;
    views: string;
    festival: string;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🎬 CDN HELPERS — picsum.photos: stable portrait / landscape seeds
  // ─────────────────────────────────────────────────────────────────────────────
  export const poster = (s: string) =>
    `https://picsum.photos/seed/${encodeURIComponent(s)}/500/750`;
  export const still  = (s: string) =>
    `https://picsum.photos/seed/${encodeURIComponent(s)}/800/450`;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🏆 FILMS FAVORIS (top 8, ranked 1→8)
  // ─────────────────────────────────────────────────────────────────────────────
  export const ALL_FAVS: FilmItem[] = [
    { id:'fav1', workId: undefined, title:'Mulholland Drive', posterUrl:poster('mulholland-drive-lynch'), genre:'Néo-Noir', type:'film', rating:5, director:'David Lynch', year:2001 },
    { id:'fav2', workId: undefined, title:'La Haine', posterUrl:poster('la-haine-kassovitz-1995'), genre:'Drame', type:'film', rating:5, director:'M. Kassovitz', year:1995 },
    { id:'fav3', workId: undefined, title:'Parasite', posterUrl:poster('parasite-bong-joon-ho'), genre:'Thriller', type:'film', rating:5, director:'Bong Joon-ho', year:2019 },
    { id:'fav4', workId: undefined, title:'Moonlight', posterUrl:poster('moonlight-2016-barry'), genre:'Drame', type:'film', rating:5, director:'B. Jenkins', year:2016 },
    { id:'fav5', workId: undefined, title:'Mad Max: Fury Road', posterUrl:poster('mad-max-fury-road-2015'), genre:'Action', type:'film', rating:5, director:'G. Miller', year:2015 },
    { id:'fav6', workId: undefined, title:'2001: A Space Odyssey', posterUrl:poster('2001-kubrick-space'), genre:'Sci-Fi', type:'film', rating:5, director:'S. Kubrick', year:1968 },
    { id:'fav7', workId: undefined, title:'Grand Budapest Hotel', posterUrl:poster('grand-budapest-wes'), genre:'Comédie', type:'film', rating:5, director:'Wes Anderson', year:2014 },
    { id:'fav8', workId: undefined, title:'Roma', posterUrl:poster('roma-alfonso-cuaron'), genre:'Drame', type:'film', rating:5, director:'A. Cuarón', year:2018 },
  ];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ✍️ CRITIQUES (sorted by likes desc → defines rank order)
  // ─────────────────────────────────────────────────────────────────────────────
  export const DEFAULT_REVIEWS: ReviewItem[] = [
    {
      id:'cr1', filmId:'cr1', rating:5, likes:342, date:'2024-11-12',
      content:"Une œuvre visuelle d'une densité rare. Villeneuve signe un manifeste sur la mémoire et l'identité, porté par une photographie de Deakins qui frôle le sublime pictural.",
      film:{ id:'cr1', title:'Dune: Part Two',       posterUrl:poster('dune-part-two-villeneuve'),  genre:'Épique',   type:'film' },
    },
    {
      id:'cr2', filmId:'cr2', rating:5, likes:218, date:'2024-10-01',
      content:"Anatomy of a Fall déconstruit le récit judiciaire pour révéler l'opacité fondamentale des relations humaines. Hüller est phénoménale.",
      film:{ id:'cr2', title:'Anatomy of a Fall',    posterUrl:poster('anatomy-of-a-fall-triet'),  genre:'Thriller', type:'film' },
    },
    {
      id:'cr3', filmId:'cr3', rating:5, likes:204, date:'2024-06-10',
      content:"Past Lives touche à quelque chose d'universel et d'intime simultanément. Un premier film éblouissant de Celine Song.",
      film:{ id:'cr3', title:'Past Lives',            posterUrl:poster('past-lives-celine-song'),  genre:'Romance',  type:'film' },
    },
    {
      id:'cr4', filmId:'cr4', rating:5, likes:189, date:'2024-08-20',
      content:"The Zone of Interest opère à froid — l'horreur par son absence, dans le bourdonnement d'une maison ordinaire.",
      film:{ id:'cr4', title:'Zone of Interest',     posterUrl:poster('zone-of-interest-glazer'),  genre:'Guerre',   type:'film' },
    },
    {
      id:'cr5', filmId:'cr5', rating:4, likes:156, date:'2024-07-15',
      content:"Aftersun accumule les fragments d'une relation père-fille avec une pudeur déchirante. Wells sublime.",
      film:{ id:'cr5', title:'Aftersun',             posterUrl:poster('aftersun-charlotte-wells'), genre:'Drame',    type:'film' },
    },
    {
      id:'cr6', filmId:'cr6', rating:4, likes:132, date:'2024-05-02',
      content:"Poor Things déborde d'une énergie visuelle folle. Lanthimos à son sommet baroque et iconoclaste.",
      film:{ id:'cr6', title:'Poor Things',          posterUrl:poster('poor-things-lanthimos'),   genre:'Fantasy',  type:'film' },
    },
  ];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 👁️ FILMS & SÉRIES VISIONNÉS
  // ─────────────────────────────────────────────────────────────────────────────
  export const DEFAULT_SEEN: FilmItem[] = [
    { id:'sw1',  title:'The Bear',            posterUrl:poster('the-bear-fx-series'),          genre:'Drame',        type:'série',  rating:5, episodes:18, status:'Terminé' },
    { id:'sw2',  title:'Shogun',              posterUrl:poster('shogun-fx-2024-series'),        genre:'Historique',   type:'série',  rating:5, episodes:10, status:'Terminé' },
    { id:'sw3',  title:'All of Us Strangers', posterUrl:poster('all-of-us-strangers-haigh'),   genre:'Drame',        type:'film',   rating:5, status:'Vu' },
    { id:'sw4',  title:'Pachinko',            posterUrl:poster('pachinko-apple-series'),        genre:'Épique',       type:'série',  rating:5, episodes:16, status:'Terminé' },
    { id:'sw5',  title:'Fallen Leaves',       posterUrl:poster('fallen-leaves-kaurismaki'),    genre:'Comédie',      type:'film',   rating:5, status:'Vu' },
    { id:'sw6',  title:'Tótem',               posterUrl:poster('totem-lila-aviles-2023'),      genre:'Drame',        type:'film',   rating:5, status:'Vu' },
    { id:'sw7',  title:'Dune (2021)',          posterUrl:poster('dune-2021-villeneuve'),         genre:'Épique',       type:'film',   rating:4, status:'Vu' },
    { id:'sw8',  title:'Priscilla',           posterUrl:poster('priscilla-coppola-2023'),      genre:'Biopic',       type:'film',   rating:4, status:'Vu' },
    { id:'sw9',  title:'The Substance',       posterUrl:poster('the-substance-fargeat'),       genre:'Horreur',      type:'film',   rating:4, status:'Vu' },
    { id:'sw10', title:'I Saw the TV Glow',   posterUrl:poster('i-saw-the-tv-glow-schofield'), genre:'Expérimental', type:'film',   rating:4, status:'Vu' },
    { id:'sw11', title:'Dream Scenario',      posterUrl:poster('dream-scenario-cage-2023'),    genre:'Comédie',      type:'film',   rating:4, status:'Vu' },
    { id:'sw12', title:'Oppenheimer',         posterUrl:poster('oppenheimer-nolan-2023'),      genre:'Biopic',       type:'film',   rating:4, status:'Vu' },
  ];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🎞️ COURTS MÉTRAGES
  // ─────────────────────────────────────────────────────────────────────────────
  export const OWN_REELS: ReelItem[] = [
    {
      id: 'e1',
      title: 'Reprends là où tu t\'es arrêté',
      posterUrl:
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
      duration: '9:56',
      views: '1324 likes',
      festival: 'Puffers',
    },
    {
      id: 'e2',
      title: 'La première fracture',
      posterUrl:
        'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
      duration: '10:54',
      views: '872 likes',
      festival: 'Nuit de Verre',
    },
    {
      id: 'e3',
      title: 'Le dernier signal',
      posterUrl:
        'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
      duration: '0:15',
      views: '2100 likes',
      festival: 'Horizon Brisé',
    },
    {
      id: 'e4',
      title: 'Masques',
      posterUrl:
        'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80',
      duration: '0:15',
      views: '3400 likes',
      festival: 'Velours Rouge',
    },
    {
      id: 'e5',
      title: 'Avant le tremblement',
      posterUrl:
        'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&q=80',
      duration: '14:48',
      views: '2750 likes',
      festival: 'Fractures',
    },
    {
      id: 'e6',
      title: 'Les voix oubliées',
      posterUrl:
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
      duration: '12:30',
      views: '1980 likes',
      festival: 'Échos du Passé',
    },
    {
      id: 'e7',
      title: 'La rencontre',
      posterUrl:
        'https://images.unsplash.com/photo-1491895200222-0fc4a4c35e18?w=800&q=80',
      duration: '9:20',
      views: '2560 likes',
      festival: 'Lumières Fugitives',
    },
  ];

// ─────────────────────────────────────────────────────────────────────────────
  // 🎞️ MOYENS ET LONGS MÉTRAGES
  // ─────────────────────────────────────────────────────────────────────────────
  export const OWN_MOYEN_REELS: ReelItem[] = []; // Sélections 30-60 min
  export const OWN_LONG_REELS: ReelItem[] = [];  // Sélections 60 min+


  // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 EXPORT / GENERATION CONSTANTS (shared with VideoGenModal)
  // ─────────────────────────────────────────────────────────────────────────────
  
  export const EXPORT_FORMATS = [
    { id:'prores', label:'ProRes 4K',   ext:'mov',  desc:'Festival / DCP',  icon:'diamond-outline',  color:G.gold,    badge:'FESTIVAL' },
    { id:'h264',   label:'H.264 1080p', ext:'mp4',  desc:'Standard web',    icon:'film-outline',     color:G.primary, badge:'STANDARD' },
    { id:'h265',   label:'H.265 1080p', ext:'mp4',  desc:'Compact HDR',     icon:'cube-outline',     color:G.cyan,    badge:'COMPACT'  },
    { id:'vp9',    label:'VP9 720p',    ext:'webm', desc:'Streaming Web',   icon:'globe-outline',    color:G.textSec, badge:'WEB'      },
  ] as const;
  
  export type ExportId = typeof EXPORT_FORMATS[number]['id'];
  
  export const VIDEO_STYLES = [
    { id:'noir',   label:'Néo-Noir',     icon:'🌑', color:'#888888'  },
    { id:'dream',  label:'Onirique',     icon:'🌀', color:G.accent   },
    { id:'docu',   label:'Documentaire', icon:'🎙️', color:G.cyan     },
    { id:'essay',  label:'Essai visuel', icon:'🎞️', color:G.gold     },
    { id:'experi', label:'Expérimental', icon:'✦',  color:'#FF6B9D'  },
  ];
  
  export const GEN_PHASES = [
    'Analyse du scénario',
    'Génération des plans',
    'Color grading IA',
    'Mixage sonore',
    'Rendu final',
  ];