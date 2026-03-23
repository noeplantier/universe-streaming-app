// ─────────────────────────────────────────────
//  UNIVERSE — Design Tokens  (Galaxy Aesthetic)
// ─────────────────────────────────────────────

export const COLORS = {
  // Backgrounds — deep space
  background:     '#080010',
  backgroundMid:  '#0D0020',
  backgroundDeep: '#050008',
  surface:        '#110022',
  surfaceElevated:'#180030',
  surfaceGlass:   'rgba(255,255,255,0.04)',

  // Primary — nebula purple
  primary:        '#9B3FDE',
  primaryLight:   '#C060FF',
  primaryDark:    '#6B1FB0',
  primaryGlow:    'rgba(155,63,222,0.35)',

  // Accent — electric violet
  accent:         '#BF5FFF',
  accentGlow:     'rgba(191,95,255,0.4)',

  // Star white
  starWhite:      '#F0E8FF',

  // Text
  textPrimary:    '#F0E8FF',
  textSecondary:  'rgba(240,232,255,0.65)',
  textTertiary:   'rgba(240,232,255,0.38)',
  textDisabled:   'rgba(240,232,255,0.22)',

  // Semantic
  success:  '#34D399',
  warning:  '#FBBF24',
  error:    '#F87171',
  gold:     '#FFD60A',

  // Borders
  border:       'rgba(155,63,222,0.25)',
  borderLight:  'rgba(255,255,255,0.08)',
  borderGlow:   'rgba(155,63,222,0.6)',
};

export const GRADIENTS = {
  primary:       ['#7B2FBE', '#C060FF'] as const,
  primaryGlow:   ['#9B3FDE', '#E080FF'] as const,
  darkOverlay:   ['transparent', 'rgba(8,0,16,0.97)'] as const,
  cardOverlay:   ['transparent', 'rgba(8,0,16,0.92)'] as const,
  heroOverlay:   ['rgba(8,0,16,0.1)', 'rgba(8,0,16,0.92)'] as const,
  galaxy:        ['#1A0035', '#08001A', '#000010'] as const,
  nebula:        ['#240056', '#8C2EBA', '#000000'] as const,
  surface:       ['rgba(155,63,222,0.12)', 'rgba(8,0,16,0.6)'] as const,
  goldStar:      ['#FFD60A', '#FF9500'] as const,
};

export const SPACING = {
  xs:          4,
  sm:          8,
  md:          12,
  lg:          16,
  xl:          20,
  xxl:         28,
  screenEdge:  18,
};

export const RADIUS = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  full: 999,
};

export const SHADOWS = {
  primary: {
    shadowColor:   '#9B3FDE',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius:  16,
    elevation:     12,
  },
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius:  16,
    elevation:     10,
  },
};

export const TYPOGRAPHY = {
  display:    { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.5, color: COLORS.textPrimary },
  h1:         { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3, color: COLORS.textPrimary },
  h2:         { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.2, color: COLORS.textPrimary },
  h3:         { fontSize: 16, fontWeight: '700' as const, color: COLORS.textPrimary },
  body:       { fontSize: 14, fontWeight: '400' as const, lineHeight: 21, color: COLORS.textSecondary },
  caption:    { fontSize: 11, fontWeight: '500' as const, color: COLORS.textTertiary },
  label:      { fontSize: 10, fontWeight: '800' as const, letterSpacing: 2, color: COLORS.textTertiary },
};

export const GENRE_COLORS: Record<string, string> = {
  'Thriller':         '#DC2626',
  'Drame':            '#2563EB',
  'Romance':          '#DB2777',
  'Fantasy':          '#7C3AED',
  'Science-Fiction':  '#0891B2',
  'Documentaire':     '#059669',
  'Horreur':          '#991B1B',
  'Comédie':          '#D97706',
  'Action':           '#EA580C',
};

export const DURATION_LABELS: Record<string, string> = {
  short:  '< 10 min',
  medium: '10–40 min',
  long:   '40+ min',
};
