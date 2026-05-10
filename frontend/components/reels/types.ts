// components/reels/types.ts

export interface FeedFilm {
  id:          string;
  video_url:   string;
  poster_url:  string;
  title:       string;
  genre:       string;
  director:    string;
  year:        string;
  synopsis:    string;
  duration:    number;
  likes_count: number;
  views_count: number;
  created_at:  string;
  is_liked:    boolean;
  is_saved:    boolean;
  tags?:       string[];
}

export const P = {
  bg:      '#07000F',
  primary: '#9240D6',
  primL:   '#C084FC',
  gold:    '#FFD60A',
  red:     '#EF4444',
  hot:     '#FF6B35',
} as const;