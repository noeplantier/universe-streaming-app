// ═══════════════════════════════════════════════════════════
//  UNIVERSE — Design Tokens & Galaxy System
//  Single source of truth for all visual laws of the app
// ═══════════════════════════════════════════════════════════

import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Screen dimensions (export for galaxy calculations) ──────
export { SCREEN_WIDTH, SCREEN_HEIGHT };

// ═══════════════════════════════════════════════════════════
//  1. COLOR SYSTEM
// ═══════════════════════════════════════════════════════════

export const COLORS = {
  // ── Backgrounds — Deep Space Layers ─────────────────────
  background:      '#080010',   // void of space
  backgroundMid:   '#0D0020',   // slightly lighter void
  backgroundDeep:  '#040008',   // absolute darkness
  surface:         '#110022',   // card surfaces
  surfaceElevated: '#180030',   // elevated modals
  surfaceGlass:    'rgba(255,255,255,0.04)',

  // ── Primary — Nebula Purple ──────────────────────────────
  primary:         '#9B3FDE',
  primaryLight:    '#C060FF',
  primaryDark:     '#6B1FB0',
  primaryGlow:     'rgba(155,63,222,0.35)',
  primaryDeepGlow: 'rgba(155,63,222,0.12)',

  // ── Accent — Electric Violet ─────────────────────────────
  accent:          '#BF5FFF',
  accentGlow:      'rgba(191,95,255,0.4)',
  accentSoft:      'rgba(191,95,255,0.15)',

  // ── Nebula Tones (for galaxy blobs) ─────────────────────
  nebulaMagenta:   'rgba(180,40,180,0.18)',
  nebulaBlue:      'rgba(40,40,200,0.14)',
  nebulaTeal:      'rgba(20,160,180,0.10)',
  nebulaDeep:      'rgba(80,0,120,0.25)',
  nebulaCore:      'rgba(140,46,186,0.30)',

  // ── Star Colors (for particle system) ───────────────────
  starWhite:       '#F0E8FF',
  starBlue:        '#C0D8FF',
  starGold:        '#FFE680',
  starPurple:      '#D4A0FF',
  starCyan:        '#A0F0FF',

  // ── Text ─────────────────────────────────────────────────
  textPrimary:     '#F0E8FF',
  textSecondary:   'rgba(240,232,255,0.65)',
  textTertiary:    'rgba(240,232,255,0.38)',
  textDisabled:    'rgba(240,232,255,0.22)',

  // ── Semantic ─────────────────────────────────────────────
  success:         '#34D399',
  warning:         '#FBBF24',
  error:           '#F87171',
  gold:            '#FFD60A',

  // ── Borders ──────────────────────────────────────────────
  border:          'rgba(155,63,222,0.25)',
  borderLight:     'rgba(255,255,255,0.08)',
  borderGlow:      'rgba(155,63,222,0.6)',
  borderStar:      'rgba(192,96,255,0.4)',
};

// ═══════════════════════════════════════════════════════════
//  2. GRADIENT SYSTEM
// ═══════════════════════════════════════════════════════════

export const GRADIENTS = {
  // ── Primary CTAs ─────────────────────────────────────────
  primary:         ['#7B2FBE', '#C060FF'] as const,
  primaryGlow:     ['#9B3FDE', '#E080FF'] as const,
  primaryDeep:     ['#4B0082', '#9B3FDE'] as const,
  primaryReverse:  ['#E080FF', '#7B2FBE'] as const,

  // ── Overlays ─────────────────────────────────────────────
  darkOverlay:     ['transparent', 'rgba(8,0,16,0.97)'] as const,
  darkOverlayTop:  ['rgba(8,0,16,0.97)', 'transparent'] as const,
  cardOverlay:     ['transparent', 'rgba(8,0,16,0.92)'] as const,
  heroOverlay:     ['rgba(8,0,16,0.05)', 'rgba(8,0,16,0.92)'] as const,
  heroMulti:       ['rgba(8,0,16,0.0)', 'transparent', 'rgba(8,0,16,0.8)', 'rgba(8,0,16,0.98)'] as const,
  sideGlow:        ['rgba(155,63,222,0.35)', 'transparent'] as const,

  // ── Galaxy Backgrounds ───────────────────────────────────
  galaxy:          ['#1A0035', '#08001A', '#000010'] as const,
  galaxyDeep:      ['#0A0018', '#050010', '#020008'] as const,
  nebula:          ['#240056', '#8C2EBA', '#000000'] as const,
  nebulaCore:      ['#3D0070', '#1A0035', '#080010'] as const,
  milkyWay:        ['rgba(120,60,200,0.0)', 'rgba(120,60,200,0.08)', 'rgba(180,100,255,0.12)', 'rgba(120,60,200,0.08)', 'rgba(120,60,200,0.0)'] as const,

  // ── Surface ──────────────────────────────────────────────
  surface:         ['rgba(155,63,222,0.12)', 'rgba(8,0,16,0.6)'] as const,
  surfaceCard:     ['rgba(24,0,48,0.8)', 'rgba(8,0,16,0.95)'] as const,

  // ── Accents ──────────────────────────────────────────────
  goldStar:        ['#FFD60A', '#FF9500'] as const,
  success:         ['#059669', '#34D399'] as const,
  danger:          ['#991B1B', '#F87171'] as const,
};

// ═══════════════════════════════════════════════════════════
//  3. SPACING SYSTEM
// ═══════════════════════════════════════════════════════════

export const SPACING = {
  xs:         4,
  sm:         8,
  md:         12,
  lg:         16,
  xl:         20,
  xxl:        28,
  xxxl:       40,
  screenEdge: 18,
  cardPad:    14,
  sectionGap: 30,
};

// ═══════════════════════════════════════════════════════════
//  4. RADIUS SYSTEM
// ═══════════════════════════════════════════════════════════

export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  xxl:  36,
  full: 999,
};

// ═══════════════════════════════════════════════════════════
//  5. SHADOW SYSTEM
// ═══════════════════════════════════════════════════════════

export const SHADOWS = {
  primary: {
    shadowColor:    '#9B3FDE',
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.8,
    shadowRadius:   16,
    elevation:      12,
  },
  primarySoft: {
    shadowColor:    '#9B3FDE',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.4,
    shadowRadius:   12,
    elevation:      8,
  },
  card: {
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.5,
    shadowRadius:   16,
    elevation:      10,
  },
  cardSubtle: {
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.35,
    shadowRadius:   10,
    elevation:      6,
  },
  gold: {
    shadowColor:    '#FFD60A',
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.7,
    shadowRadius:   10,
    elevation:      8,
  },
  none: {
    shadowColor:    'transparent',
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0,
    shadowRadius:   0,
    elevation:      0,
  },
};

// ═══════════════════════════════════════════════════════════
//  6. TYPOGRAPHY SYSTEM
// ═══════════════════════════════════════════════════════════

export const TYPOGRAPHY = {
  // Display — hero titles, big numbers
  display: {
    fontSize:      36,
    fontWeight:    '900' as const,
    letterSpacing: -0.8,
    color:         COLORS.textPrimary,
    lineHeight:    42,
  },
  // H1 — screen titles
  h1: {
    fontSize:      26,
    fontWeight:    '800' as const,
    letterSpacing: -0.3,
    color:         COLORS.textPrimary,
  },
  // H2 — section titles
  h2: {
    fontSize:      20,
    fontWeight:    '800' as const,
    letterSpacing: -0.2,
    color:         COLORS.textPrimary,
  },
  // H3 — card titles
  h3: {
    fontSize:      16,
    fontWeight:    '700' as const,
    color:         COLORS.textPrimary,
  },
  // H4 — sub-titles
  h4: {
    fontSize:      14,
    fontWeight:    '700' as const,
    color:         COLORS.textPrimary,
  },
  // Body — normal text
  body: {
    fontSize:      14,
    fontWeight:    '400' as const,
    lineHeight:    21,
    color:         COLORS.textSecondary,
  },
  // Body small
  bodySmall: {
    fontSize:      12,
    fontWeight:    '400' as const,
    lineHeight:    18,
    color:         COLORS.textSecondary,
  },
  // Caption — metadata
  caption: {
    fontSize:      11,
    fontWeight:    '500' as const,
    color:         COLORS.textTertiary,
  },
  // Label — section headers, badges
  label: {
    fontSize:      10,
    fontWeight:    '800' as const,
    letterSpacing: 2.5,
    color:         COLORS.textTertiary,
  },
  // Micro — tiny labels
  micro: {
    fontSize:      9,
    fontWeight:    '600' as const,
    letterSpacing: 0.5,
    color:         COLORS.textTertiary,
  },
};

// ═══════════════════════════════════════════════════════════
//  7. GALAXY PARTICLE SYSTEM CONFIG
//  Governs GalaxyBackground.tsx behavior
// ═══════════════════════════════════════════════════════════

export const GALAXY_CONFIG = {
  // ── Layer 1: Background dust — tiny, very faint ──────────
  dustLayer: {
    count:        80,
    minSize:      0.5,
    maxSize:      1.2,
    minOpacity:   0.08,
    maxOpacity:   0.35,
    minDuration:  2500,   // twinkle speed ms
    maxDuration:  5000,
    colors:       [COLORS.starWhite, COLORS.starBlue],
  },
  // ── Layer 2: Stars — medium, main twinkle layer ──────────
  starLayer: {
    count:        55,
    minSize:      1.0,
    maxSize:      2.2,
    minOpacity:   0.3,
    maxOpacity:   0.9,
    minDuration:  1800,
    maxDuration:  4000,
    colors:       [COLORS.starWhite, COLORS.starBlue, COLORS.starPurple, COLORS.starGold],
  },
  // ── Layer 3: Bright stars — large, intense sparkle ───────
  brightLayer: {
    count:        18,
    minSize:      2.5,
    maxSize:      4.0,
    minOpacity:   0.6,
    maxOpacity:   1.0,
    minDuration:  1200,
    maxDuration:  3000,
    colors:       [COLORS.starWhite, COLORS.starCyan, COLORS.primaryLight],
  },
  // ── Layer 4: Sparkle crosses — diamond star effect ───────
  sparkleLayer: {
    count:        8,
    minSize:      10,    // cross arm length
    maxSize:      20,
    minOpacity:   0.3,
    maxOpacity:   0.8,
    minDuration:  2000,
    maxDuration:  4500,
    colors:       [COLORS.starWhite, COLORS.primaryLight, COLORS.starGold],
  },
  // ── Shooting stars ───────────────────────────────────────
  shootingStars: {
    enabled:         true,
    intervalMin:     4000,  // ms between shooting stars
    intervalMax:     9000,
    trailLength:     120,   // px
    duration:        700,   // animation ms
    color:           COLORS.starWhite,
  },
  // ── Nebula blobs ─────────────────────────────────────────
  nebulae: {
    count:        4,
    pulseDuration: 5000,    // slow breathing ms
    colors: [
      COLORS.nebulaCore,
      COLORS.nebulaMagenta,
      COLORS.nebulaBlue,
      COLORS.nebulaDeep,
    ],
  },
  // ── Milky Way band ───────────────────────────────────────
  milkyWay: {
    enabled:      true,
    angle:        -35,      // degrees diagonal
    width:        SCREEN_WIDTH * 0.75,
    opacity:      0.06,
  },
};

// ═══════════════════════════════════════════════════════════
//  8. CONTENT METADATA
// ═══════════════════════════════════════════════════════════

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
  'Animation':        '#7C3AED',
  'Biopic':           '#0D9488',
};

export const GENRE_GLOW: Record<string, string> = {
  'Thriller':         'rgba(220,38,38,0.3)',
  'Drame':            'rgba(37,99,235,0.3)',
  'Romance':          'rgba(219,39,119,0.3)',
  'Fantasy':          'rgba(124,58,237,0.3)',
  'Science-Fiction':  'rgba(8,145,178,0.3)',
  'Documentaire':     'rgba(5,150,105,0.3)',
  'Horreur':          'rgba(153,27,27,0.3)',
  'Comédie':          'rgba(217,119,6,0.3)',
  'Action':           'rgba(234,88,12,0.3)',
};

export const DURATION_LABELS: Record<string, string> = {
  short:  '< 10 min',
  medium: '10–40 min',
  long:   '40+ min',
};

export const DURATION_COLORS: Record<string, string> = {
  short:  '#34D399',
  medium: '#A78BFA',
  long:   '#C060FF',
};

// ═══════════════════════════════════════════════════════════
//  9. ANIMATION DURATIONS
// ═══════════════════════════════════════════════════════════

export const ANIMATION = {
  fast:       150,
  normal:     250,
  slow:       400,
  verySlow:   700,
  spring: {
    tension:  50,
    friction: 8,
  },
};

// ═══════════════════════════════════════════════════════════
//  10. Z-INDEX LAYERS
// ═══════════════════════════════════════════════════════════

export const Z_INDEX = {
  galaxyBackground: -10,
  content:          1,
  card:             5,
  header:           20,
  modal:            50,
  toast:            100,
};

// ═══════════════════════════════════════════════════════════
//  11. LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════

export const LAYOUT = {
  tabBarHeight:          70,
  headerHeight:          60,
  heroHeight:            290,
  cardHalfWidth:         (SCREEN_WIDTH - SPACING.screenEdge * 2 - 10) / 2,
  cardThirdWidth:        (SCREEN_WIDTH - SPACING.screenEdge * 2 - 16) / 3,
  isSmallScreen:         SCREEN_HEIGHT < 750,
  isLargeScreen:         SCREEN_HEIGHT > 900,
  platform:              Platform.OS,
};


// ═══════════════════════════════════════════════════════════
//  12. LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════


export const SIZE = {
  // Global basics
  base:    8,
  font:    14,
  radius:  12,
  padding: 24,
  margin:  20,

  // Font Sizes
  h1:      26,
  h2:      20,
  h3:      16,
  h4:      14,
  body1:   30,
  body2:   22,
  body3:   16,
  body4:   14,

  // Screen dimensions
  width:   SCREEN_WIDTH,
  height:  SCREEN_HEIGHT,
};