export const G = {
    bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
    sW:  '#F3EDFF', sB:  '#B2CCFF', sG:  '#FFE270',
    sP:  '#CF98FF', sCy: '#86EEFF',
    glass:       'rgba(255,255,255,0.056)',
    glassBorder: 'rgba(255,255,255,0.09)',
    glassBorderHover: 'rgba(192,96,255,0.35)',
    primary:  '#C060FF',
    primaryDim:'rgba(192,96,255,0.18)',
    textSub:  '#BCB8C2',
    red:      '#FF453A',
    green:    '#30D158',
    gold:     '#FFD60A',
  } as const;
  
  export const ROLES: Record<string, { label: string; color: string; bg: string }> = {
    director: { label: 'PROD',     color: '#FFD60A', bg: 'rgba(255,214,10,0.15)'  },
    critic:   { label: 'CRITIQUE', color: '#86EEFF', bg: 'rgba(134,238,255,0.15)' },
    dop:      { label: 'IMAGE',    color: '#CF98FF', bg: 'rgba(207,152,255,0.15)' },
    viewer:   { label: '',         color: 'transparent', bg: 'transparent'         },
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  export interface Author {
    name:      string;
    handle:    string;
    avi:       string;
    role:      string;
    following: boolean;
  }
  
  export interface FilmEmbed {
    title:   string;
    poster:  string;
    year:    string;
    filmId?: string;
    rating?: number;
  }
  
  export interface Comment {
    id:     string;
    author: Author;
    text:   string;
    time:   string;
    likes:  number;
    liked:  boolean;
  }
  
  export interface PostData {
    avatar: string;
    createdAt: string;
    userName: ReactNode;
    id:       string;
    author:   Author;
    content:  string;
    time:     string;
    likes:    number;
    liked:    boolean;
    saved:    boolean;
    comments: Comment[];
    film?:    FilmEmbed;
    tab:      'foryou' | 'subs' | 'trending';
    image?:   string;
  }
  
  export interface Story {
    id:      string;
    user:    string;
    avi:     string;
    seen:    boolean;
    isMe?:   boolean;
  }
  
  export type FeedTab = 'Pour vous' | 'Abonnements' | 'Tendances';
  export const FEED_TABS: FeedTab[] = ['Pour vous', 'Abonnements', 'Tendances'];
  
  export const TAB_FILTER: Record<FeedTab, (p: PostData) => boolean> = {
    'Pour vous':   ()           => true,
    'Abonnements': (p)          => p.tab === 'subs',
    'Tendances':   (p)          => p.tab === 'trending',
  };
  
  // Moi
  export const ME: Author = {
    name: 'Hugo C.', handle: 'hugoch', role: 'director',
    avi:  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s', following: false,
  };