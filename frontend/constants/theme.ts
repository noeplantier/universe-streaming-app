import { Dimensions } from 'react-native';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const COLORS = {
  background: '#000000',
  surface: '#0B0014',
  surfaceHighlight: '#1A052E',
  primary: '#8C2EBA',
  secondary: '#240056',
  border: 'rgba(140, 46, 186, 0.3)',
  borderLight: 'rgba(140, 46, 186, 0.15)',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0A0C0',
  textTertiary: '#685080',
  success: '#00E096',
  error: '#FF3B30',
  warning: '#FFD60A',
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(11, 0, 20, 0.7)',
};

export const GRADIENTS = {
  primary: ['#8C2EBA', '#240056'] as const,
  galaxy: ['#240056', '#000000'] as const,
  heroOverlay: ['transparent', 'rgba(0,0,0,0.95)'] as const,
  cardOverlay: ['transparent', 'rgba(0,0,0,0.8)'] as const,
  surface: ['#1A052E', '#0B0014'] as const,
  purpleGlow: ['rgba(140, 46, 186, 0.4)', 'transparent'] as const,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenEdge: 20,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const SHADOWS = {
  neonGlow: {
    shadowColor: '#8C2EBA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const DURATION_LABELS: Record<string, string> = {
  short: 'Court Métrage',
  medium: 'Moyen Métrage',
  long: 'Long Métrage',
};

export const GENRE_COLORS: Record<string, string> = {
  Thriller: '#FF6B6B',
  Romance: '#FF8FAB',
  Drame: '#A78BFA',
  Fantasy: '#34D399',
  'Science-Fiction': '#60A5FA',
  Documentaire: '#FBBF24',
  Horreur: '#EF4444',
  Comédie: '#F59E0B',
};
