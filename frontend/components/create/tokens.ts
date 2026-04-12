export const C = {
    bg0:       '#03000A',
    bg1:       '#07001A',
    surf:      'rgba(255,255,255,0.05)',
    surfHi:    'rgba(255,255,255,0.09)',
    border:    'rgba(255,255,255,0.07)',
    borderHi:  'rgba(255,255,255,0.15)',
    borderAcc: 'rgba(0,201,255,0.30)',
    text:      '#EDF6FF',
    textSec:   '#8BA4BE',
    textTert:  '#3D5470',
    gold:      '#F5C842',
    goldDim:   'rgba(245,200,66,0.12)',
    teal:      '#00C9FF',
    tealSoft:  'rgba(0,201,255,0.08)',
    tealMid:   'rgba(0,201,255,0.20)',
    tealGlow:  'rgba(0,201,255,0.45)',
    navy:      '#0A1628',
    navyMid:   '#0D2240',
    green:     '#2ECC8A',
    greenDim:  'rgba(46,204,138,0.14)',
    red:       '#FF3B5C',
    purple:    '#7C3AED',
    purpleSoft:'rgba(124,58,237,0.15)',
    purpleMid: 'rgba(124,58,237,0.35)',
  } as const;
  
  export const GENRES = [
    'Drame', 'Thriller', 'Documentaire', 'Sci-Fi',
    'Animation', 'Expérimental', 'Biopic', 'Court métrage',
  ] as const;
  
  export const MAX_DURATION = 15;