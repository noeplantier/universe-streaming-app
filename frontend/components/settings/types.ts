export const G = {
    bg0:  '#060010',
    bg1:  '#0A001E',
    bg2:  '#070014',
    sW:   '#F3EDFF',
    sB:   '#B2CCFF',
    sG:   '#FFE270',
    sP:   '#CF98FF',
    sCy:  '#86EEFF',
    glass:       'rgba(255,255,255,0.056)',
    glassBorder: 'rgba(255,255,255,0.09)',
    glassBorderActive: 'rgba(192,96,255,0.40)',
    primary:     '#C060FF',
    primaryDim:  'rgba(192,96,255,0.18)',
    primaryDeep: '#8C2EBA',
    surface:     '#0D0025',
    surfaceRaised:'#120030',
    textSub:     '#BCB8C2',
    textTert:    'rgba(237,232,255,0.35)',
    red:         '#FF453A',
    green:       '#30D158',
    gold:        '#FFD60A',
    border:      'rgba(255,255,255,0.07)',
    borderActive:'rgba(192,96,255,0.28)',
  } as const;
  
  // ── Types des paramètres de l'app ─────────────────────────────────────────────
  export type VideoQuality = 'auto' | '4k' | '1080p' | '720p' | '480p';
  export type SubtitleSize  = 'small' | 'medium' | 'large';
  export type AppLanguage   = 'fr' | 'en' | 'es' | 'de';
  export type AppTheme      = 'galaxy' | 'midnight' | 'void';
  export type FeedSort      = 'recommended' | 'recent' | 'trending';
  
  export interface AppSettings {
    // Lecture
    autoPlay:         boolean;
    autoNextEpisode:  boolean;
    videoQuality:     VideoQuality;
    dataSaver:        boolean;
    // Sous-titres
    subtitlesEnabled: boolean;
    subtitleLanguage: AppLanguage;
    subtitleSize:     SubtitleSize;
    // Notifications
    notifNewEpisode:  boolean;
    notifSocial:      boolean;
    notifFestival:    boolean;
    notifNewsletter:  boolean;
    // Vie privée
    privateProfile:   boolean;
    publicWatchlist:  boolean;
    analyticsOpt:     boolean;
    // App
    language:         AppLanguage;
    theme:            AppTheme;
    feedSort:         FeedSort;
    haptics:          boolean;
  }
  
  export const DEFAULT_SETTINGS: AppSettings = {
    autoPlay:         true,
    autoNextEpisode:  true,
    videoQuality:     'auto',
    dataSaver:        false,
    subtitlesEnabled: true,
    subtitleLanguage: 'fr',
    subtitleSize:     'medium',
    notifNewEpisode:  true,
    notifSocial:      true,
    notifFestival:    false,
    notifNewsletter:  false,
    privateProfile:   false,
    publicWatchlist:  true,
    analyticsOpt:     true,
    language:         'fr',
    theme:            'galaxy',
    feedSort:         'recommended',
    haptics:          true,
  };
  
  export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
    fr: 'Français',
    en: 'English',
    es: 'Español',
    de: 'Deutsch',
  };
  
  export const QUALITY_LABELS: Record<VideoQuality, string> = {
    auto:  'Automatique (recommandé)',
    '4k':  '4K Ultra HD',
    '1080p': '1080p HD',
    '720p':  '720p',
    '480p':  '480p (économique)',
  };
  
  export const SUBTITLE_SIZE_LABELS: Record<SubtitleSize, string> = {
    small:  'Petit',
    medium: 'Moyen',
    large:  'Grand',
  };
  
  export const FEED_SORT_LABELS: Record<FeedSort, string> = {
    recommended: 'Recommandé',
    recent:      'Plus récent',
    trending:    'Tendances',
  };
  
  // ── Profil utilisateur ────────────────────────────────────────────────────────
  export type UserRole = 'director' | 'critic' | 'dop' | 'viewer';
  
  export interface UserProfile {
    id:         string;
    username:   string;
    email:      string;
    bio:        string;
    avatar_url: string;
    role:       UserRole;
    isPremium:  boolean;
    followers:  number;
    following:  number;
    posts:      number;
  }
  
  export const ROLE_META: Record<UserRole, { label: string; emoji: string; color: string; bg: string }> = {
    director: { label: 'Réalisateur', emoji: '🎬', color: '#FFD60A', bg: 'rgba(255,214,10,0.14)' },
    critic:   { label: 'Critique',    emoji: '✍️', color: '#86EEFF', bg: 'rgba(134,238,255,0.14)' },
    dop:      { label: 'Chef Op.',    emoji: '🎥', color: '#CF98FF', bg: 'rgba(207,152,255,0.14)' },
    viewer:   { label: 'Spectateur',  emoji: '👁️', color: G.sW,    bg: 'rgba(255,255,255,0.08)' },
  };