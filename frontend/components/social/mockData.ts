import type { PostData, Story, Author, Comment } from './types';

const mkAuthor = (
  name: string, handle: string, avi: string,
  role: string, following = false,
): Author => ({ name, handle, avi, role, following });

const mkComment = (
  id: string, author: Author, text: string,
  time: string, likes = 0,
): Comment => ({ id, author, text, time, likes, liked: false });

// ─── Authors ──────────────────────────────────────────────────────
const NOLAN  = mkAuthor('Nolan R.',  'cinenolan',     'https://i.pravatar.cc/150?u=a042581f4e29026024d', 'director', true);
const SARAH  = mkAuthor('Sarah K.',  'sarah_cuts',    'https://i.pravatar.cc/150?u=a042581f4e29026704d', 'critic',   true);
const MARC   = mkAuthor('Marc D.',   'marcdop',       'https://i.pravatar.cc/150?u=a04258114e29026302d', 'dop',      false);
const JULIE  = mkAuthor('Julie M.',  'julie_viewer',  'https://i.pravatar.cc/150?u=a042581f4e29026502d', 'viewer',   false);
const ALEX   = mkAuthor('Alex P.',   'alexcinephile', 'https://i.pravatar.cc/150?u=a042581f4e29026102d', 'viewer',   false);
const EMMA   = mkAuthor('Emma L.',   'emma_cinephile','https://i.pravatar.cc/150?u=a042581f4e29026602d', 'viewer',   true);
const KARIM  = mkAuthor('Karim B.',  'karim_dop',     'https://i.pravatar.cc/150?u=kb77',               'dop',      false);
const LEA    = mkAuthor('Léa D.',    'lea_films',     'https://i.pravatar.cc/150?u=ld88',               'critic',   true);
const TOM    = mkAuthor('Tom V.',    'tomv_indie',    'https://i.pravatar.cc/150?u=tv99',               'director', false);
const LUCIE  = mkAuthor('Lucie M.',  'lucie_mv',      'https://i.pravatar.cc/60?img=9',                 'viewer',   true);
const ANAELLE= mkAuthor('Anaëlle C.','anaelle_c',     'https://i.pravatar.cc/60?img=22',                'viewer',   false);

// ─── Feed ─────────────────────────────────────────────────────────
export const INITIAL_POSTS: PostData[] = [
  {
    id: '1', tab: 'foryou', author: NOLAN, time: '2h',
    liked: false, saved: false, likes: 1240,
    content: 'La photographie dans "The Lighthouse" est une masterclass de contraste. Le ratio 1.19:1 enferme littéralement les personnages dans leur folie. Des avis ? 🎥',
    film: { title: 'The Lighthouse', poster: 'https://image.tmdb.org/t/p/w200/3nk9UoepYmv1G9oP18q6JJCeYMB.jpg', year: '2019', filmId: 'lighthouse', rating: 4.8 },
    comments: [
      mkComment('c1', LUCIE,   "Totalement d'accord, un chef d'œuvre !", '1h', 14),
      mkComment('c2', MARC,    "Le ratio 1.19:1 c'est Eggers en mode maîtrise totale.", '45m', 8),
      mkComment('c3', ANAELLE, "Je préfère quand même The Witch pour l'ambiance.", '20m', 3),
    ],
  },
  {
    id: '2', tab: 'subs', author: SARAH, time: '4h',
    liked: false, saved: false, likes: 856,
    content: 'Je reviens de Cannes. Le cinéma coréen est encore en train de redéfinir les codes du thriller. Incroyable énergie cette année. 🇰🇷',
    comments: [
      mkComment('c4', ALEX,  'Lesquels tu recommandes particulièrement ?', '3h', 5),
      mkComment('c5', KARIM, 'Hâte de lire ton compte rendu complet !', '2h', 2),
    ],
  },
  {
    id: '3', tab: 'trending', author: MARC, time: '5h',
    liked: false, saved: false, likes: 2100,
    content: "Petit thread sur l'utilisation des lentilles anamorphiques chez Wes Anderson. Chaque film est une étude de symétrie et de couleur 👇",
    film: { title: 'Asteroid City', poster: 'https://image.tmdb.org/t/p/w200/qfgysK1I5s2m86e1hQY6k3qK5q8.jpg', year: '2023', filmId: 'asteroid-city', rating: 4.2 },
    comments: [
      mkComment('c6', EMMA,  'Grand Island en arrière-plan = niveau de détail dingue.', '4h', 18),
      mkComment('c7', JULIE, 'Tes analyses sont toujours au top Marc !', '3h', 7),
    ],
  },
  {
    id: '4', tab: 'foryou', author: JULIE, time: '6h',
    liked: false, saved: false, likes: 430,
    content: "Quelqu'un a vu le dernier film de Céline Sciamma ? J'ai adoré la narration visuelle, c'est du grand art.",
    film: { title: 'Petite Maman', poster: 'https://picsum.photos/seed/pm/200/300', year: '2021', filmId: 'petite-maman', rating: 4.6 },
    comments: [mkComment('c8', TOM, 'Oui ! La scène du bois est un moment de grâce pur.', '5h', 12)],
  },
  {
    id: '5', tab: 'trending', author: ALEX, time: '8h',
    liked: false, saved: false, likes: 980,
    content: "Thread : les meilleurs films de science-fiction des 20 dernières années 🚀\n\n1/ Hereditary (2018) — terreur domestique totale\n2/ Annihilation (2018) — le chaos au microscope\n3/ Ex Machina (2014) — l'IA comme miroir de l'humain",
    film: { title: 'Ex Machina', poster: 'https://picsum.photos/seed/ex/200/300', year: '2014', filmId: 'ex-machina', rating: 4.5 },
    comments: [],
  },
  {
    id: '6', tab: 'subs', author: EMMA, time: '10h',
    liked: false, saved: false, likes: 670,
    content: 'Je viens de découvrir "The Farewell" de Lulu Wang. Un mélange parfait d\'humour et d\'émotion. À voir absolument !',
    film: { title: 'The Farewell', poster: 'https://picsum.photos/seed/tf/200/300', year: '2019', filmId: 'the-farewell', rating: 4.4 },
    comments: [mkComment('c9', LEA, 'Lulu Wang mérite beaucoup plus de reconnaissance.', '8h', 9)],
  },
  {
    id: '7', tab: 'trending', author: KARIM, time: '12h',
    liked: false, saved: false, likes: 3400,
    content: 'Palette de couleurs dans "Parasite" : Bong Joon-ho utilise le vert mousse pour symboliser le sous-sol et ses habitants. Génie chromatique absolu. 🎨',
    comments: [
      mkComment('c10', MARC,  'La ligne de lumière sur les marches, aussi.', '11h', 24),
      mkComment('c11', SARAH, 'On en parle de la pièce semi-enterrée et du cadrage ?', '10h', 16),
      mkComment('c12', NOLAN, 'Bong est dans une autre catégorie.', '9h', 31),
    ],
  },
  {
    id: '8', tab: 'subs', author: LEA, time: '14h',
    liked: false, saved: false, likes: 1820,
    content: 'Cannes 2025 — ma liste des films les plus attendus de la compétition officielle. Le cinéma africain est enfin représenté dignement cette année. 🎬',
    comments: [mkComment('c13', SARAH, 'Hâte de te lire en live depuis là-bas !', '13h', 7)],
  },
  {
    id: '9', tab: 'foryou', author: TOM, time: '1j',
    liked: false, saved: false, likes: 512,
    content: 'Vient de terminer le montage de mon court. 6 mois de post-production pour 18 minutes. Le cinéma indé c\'est ça aussi 💪',
    comments: [
      mkComment('c14', NOLAN,   'Félicitations ! Tu le soumets à quels festivals ?', '22h', 8),
      mkComment('c15', ANAELLE, 'On veut voir ça !', '20h', 4),
    ],
  },
];

// ─── Stories ──────────────────────────────────────────────────────
export const INITIAL_STORIES: Story[] = [
  { id: 's0', user: 'Moi',       avi: 'https://i.pravatar.cc/100?u=hugoch',              seen: true,  isMe: true },
  { id: 's1', user: 'cinenolan', avi: 'https://i.pravatar.cc/150?u=a042581f4e29026024d', seen: false },
  { id: 's2', user: 'sarah_cuts',avi: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', seen: false },
  { id: 's3', user: 'marcdop',   avi: 'https://i.pravatar.cc/150?u=a04258114e29026302d', seen: true  },
  { id: 's4', user: 'lea_films', avi: 'https://i.pravatar.cc/150?u=ld88',                seen: false },
  { id: 's5', user: 'karim_dop', avi: 'https://i.pravatar.cc/150?u=kb77',                seen: true  },
  { id: 's6', user: 'tomv_indie',avi: 'https://i.pravatar.cc/150?u=tv99',                seen: false },
];