export const C = {
    bg0:'#020810', bg1:'#060F1E', bg2:'#0A1830',
    surf:'rgba(13,34,64,0.55)', surfHi:'rgba(13,34,64,0.82)',
    surfWhite:'rgba(255,255,255,0.05)',
    border:'rgba(255,255,255,0.07)', borderHi:'rgba(255,255,255,0.16)',
    borderBlue:'rgba(90,150,230,0.24)',
    text:'#EEF4FF', textSec:'#7A99BE', textTert:'#2E4A68',
    blue:'#5A96E6', blueDim:'rgba(90,150,230,0.13)', blueMid:'rgba(90,150,230,0.22)',
    navyMid:'#0D2240', navyLight:'#163356', navyBright:'#1E4A7A',
    gold:'#F5C842', goldDim:'rgba(245,200,66,0.12)', goldEdge:'rgba(245,200,66,0.28)',
    green:'#2ECC8A', greenDim:'rgba(46,204,138,0.12)', greenEdge:'rgba(46,204,138,0.28)',
    red:'#FF3B5C', white:'#FFFFFF',
  } as const;
  
  export const TONE_KEYS = [
    'analyse','coup de coeur','deception','reflexion',
    'détente','neutre','mitigé','enthousiaste',
  ] as const;
  export type Tone = typeof TONE_KEYS[number];
  
  export const TONES: { key: Tone; label: string; icon: string; color: string }[] = [
    { key:'analyse',       label:'Analyse',      icon:'flask-outline',        color:C.blue    },
    { key:'coup de coeur', label:'Coup de cœur', icon:'heart-outline',        color:C.red     },
    { key:'deception',     label:'Déception',    icon:'thunderstorm-outline', color:C.gold    },
    { key:'reflexion',     label:'Réflexion',    icon:'bulb-outline',         color:'#A8C8F0' },
    { key:'détente',       label:'Détente',      icon:'cafe-outline',         color:'#86EEFF' },
    { key:'neutre',        label:'Neutre',       icon:'ellipse-outline',      color:C.textSec },
    { key:'mitigé',        label:'Mitigé',       icon:'remove-outline',       color:C.textSec },
    { key:'enthousiaste',  label:'Enthousiaste', icon:'star-outline',         color:C.gold    },
  ];
  
  export const GENRES_LIST = [
    'Drame','Thriller','Sci-Fi','Documentaire',
    'Animation','Court métrage','Expérimental','Biopic',
  ] as const;
  
  export const ASPECTS = [
    'Photographie','Musique','Scénario','Montage',
    'Interprétation','Rythme','Atmosphère','Décors',
  ];
  
  export const FEED_TABS = ['Pour vous','Tendances','Pros'] as const;
  export type FeedTab = typeof FEED_TABS[number];
  
  export const MIN_BODY    = 80;
  export const POSTS_LIMIT = 40;
  export const EDGE        = 18;
  
  export const PRO_ROLES = [
    'Tous','Réalisateur·ice','Producteur·ice','Acteur·ice',
    'Scénariste','Directeur·ice photo','Compositeur·ice',
    'Monteur·euse','Distributeur·ice',
  ] as const;
  export type ProRole = typeof PRO_ROLES[number];