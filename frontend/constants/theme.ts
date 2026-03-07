export const COLORS = {
  bg: '#000000',
  bgSecondary: '#09090B',
  bgTertiary: '#121212',
  bgCard: '#18181B',
  bgCard2: '#1C1C1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textTertiary: '#52525B',
  textDisabled: '#3F3F46',
  border: '#27272A',
  borderMuted: '#1C1C1E',
  borderFocus: '#FFFFFF',
  btnPrimary: '#FFFFFF',
  btnPrimaryText: '#000000',
  btnSecondary: '#27272A',
  btnSecondaryText: '#FFFFFF',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  scannerLaser: '#22C55E',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Music: '#7C3AED',
  Technology: '#2563EB',
  Food: '#EA580C',
  Business: '#059669',
  Sports: '#DC2626',
  Arts: '#D97706',
  All: '#FFFFFF',
};

export const CATEGORY_BG: Record<string, string> = {
  Music: 'rgba(124,58,237,0.15)',
  Technology: 'rgba(37,99,235,0.15)',
  Food: 'rgba(234,88,12,0.15)',
  Business: 'rgba(5,150,105,0.15)',
  Sports: 'rgba(220,38,38,0.15)',
  Arts: 'rgba(217,119,6,0.15)',
  All: 'rgba(255,255,255,0.1)',
};

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const SHADOW = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  glow: { shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
};

export const CATEGORIES = ['All', 'Music', 'Technology', 'Food', 'Business', 'Sports', 'Arts'];
