import { Dimensions } from 'react-native';

export const { width: W, height: H } = Dimensions.get('window');

// ─── Card — uniform portrait size across ALL sections ───────────────────────
export const CARD_W      = 130;
export const CARD_H      = Math.round(CARD_W * 1.52);   // ≈ 198 px, movie-poster ratio
export const CARD_RADIUS = 13;
export const CARD_GAP    = 10;
export const H_PADDING   = 16;

// ─── Numbered card (Apple TV Top-10 layout) ──────────────────────────────────
// [  N  [CARD]]  — number sits LEFT, card overlaps it from the right
export const NUM_W       = 52;    // px reserved for the rank digit area
export const NUM_OVERLAP = 20;    // px the card overlaps the number
// Total item slot width (number area + card - overlap):
export const NUM_ITEM_W  = NUM_W + CARD_W - NUM_OVERLAP; // = 162

// ─── Scroll / header ────────────────────────────────────────────────────────
export const HEADER_SCROLL_DISTANCE = 90;

// ─── Apple TV × Galaxy palette ──────────────────────────────────────────────
export const G = {
  // Backgrounds - Rendus transparents pour laisser voir le fond Galaxy
  bg:          'transparent',   
  bg1:         'transparent',
  bg2:         'transparent',
  surface:     'rgba(28, 28, 38, 0.4)', // Légèrement translucide pour la lisibilité
  surfaceHi:   'rgba(38, 38, 58, 0.5)',

  // Glass layers
  glass:       'rgba(255,255,255,0.048)',
  glassBorder: 'rgba(255,255,255,0.072)',
  glassMid:    'rgba(255,255,255,0.10)',

  // Star particle palette
  sW: '#F5F0FF', sB: '#B8CCFF', sG: '#FFE880', sP: '#D4A0FF', sCy: '#90EEFF',

  // Brand colors - Violet supprimé et remplacé par des tons neutres/blancs
  primary:  '#FFFFFF',
  accent:   'rgba(255, 255, 255, 0.8)',
  purple2:  'rgba(255, 255, 255, 0.5)',

  // ATV semantic colours
  gold:     '#FFD60A',   // Apple gold — rank #1
  silver:   '#E8E8F0',   // rank #2
  amber:    '#FF9F0A',   // Apple orange — rank #3
  cyan:     '#32D2FF',   // ATV signature blue
  success:  '#30D158',   // Apple green
  danger:   '#FF375F',   // Apple red

  // Typography
  text:     '#FFFFFF',
  textSec:  'rgba(255,255,255,0.72)',
  textTer:  'rgba(255,255,255,0.40)',
  textQuat: 'rgba(255,255,255,0.18)',
} as const;