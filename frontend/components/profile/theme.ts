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
  // Backgrounds
  bg:          '#0D0D12',   // ATV near-black, slightly blue-shifted
  bg1:         '#13131C',
  bg2:         '#0A0A10',
  surface:     '#1C1C26',
  surfaceHi:   '#26263A',

  // Glass layers
  glass:       'rgba(255,255,255,0.048)',
  glassBorder: 'rgba(255,255,255,0.072)',
  glassMid:    'rgba(255,255,255,0.10)',

  // Star particle palette
  sW: '#F5F0FF', sB: '#B8CCFF', sG: '#FFE880', sP: '#D4A0FF', sCy: '#90EEFF',

  // Brand purple
  primary:  '#BF5FFF',
  accent:   '#9B3FF0',
  purple2:  '#7020C8',

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