export interface Friend {
    id:       string;
    name:     string;
    avatar:   string;
    followed: boolean;
  }
  
  export interface FeedFilm {
    id:              string;
    title:           string;
    series:          string;
    episode:         number;
    episode_title:   string;
    poster_url:      string;
    video_url?:      string;
    caption:         string;
    duration:        string;
  }
  
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