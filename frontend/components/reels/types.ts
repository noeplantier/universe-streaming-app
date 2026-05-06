export interface Reel {
  id:          string;           // uuid
  created_at:  string;           // timestamptz
  user_id:     string;           // uuid
  video_url:   string;           // text NOT NULL
  title:       string | null;
  genre:       string | null;
  director:    string | null;
  year:        string | null;
  synopsis:    string | null;
  duration:    number | null;    // numeric (secondes)
  likes_count: number;           // integer default 0
  views_count: number;           // integer default 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Modèle UI — enrichi côté client uniquement
// ─────────────────────────────────────────────────────────────────────────────
export interface FeedFilm {
  // identité
  id:          string;
  video_url:   string;
  poster_url:  string;           // picsum fallback si absent de la BDD
  title:       string;
  genre:       string;
  director:    string;
  year:        string;
  synopsis:    string;
  duration:    number;           // secondes (0 si inconnu)
  created_at:  string;

  // engagement
  likes_count: number;
  views_count: number;
  is_liked:    boolean;
  is_saved:    boolean;

  // compat ancienne interface (non utilisé par le nouveau feed)
  likes?:          number;
  series?:         string;
  episode?:        number;
  episode_title?:  string;
  caption?:        string;
  liked_by_friends?: Array<{ id: string; username?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
export const P = {
  bg:      '#07000F',
  surface: '#130025',
  glass:   'rgba(255,255,255,0.06)',
  primary: '#9240D6',
  primL:   '#fff',
  primGl:  'rgba(146,64,214,0.38)',
  t1:      '#FFFFFF',
  t2:      'rgba(240,232,255,0.62)',
  t3:      'rgba(240,232,255,0.36)',
  bord:    'rgba(146,64,214,0.30)',
  bordL:   'rgba(255,255,255,0.08)',
  gold:    '#FFD60A',
  red:     '#EF4444',
  hot:     '#FF6B35',
} as const;