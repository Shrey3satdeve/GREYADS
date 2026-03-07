import { rs, rf } from '../utils/responsive';

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
  phonepe: '#5F259F',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Music: '#7C3AED',
  Technology: '#2563EB',
  Food: '#EA580C',
  Business: '#059669',
  Sports: '#DC2626',
  Arts: '#D97706',
  Fashion: '#EC4899',
  All: '#FFFFFF',
};

export const CATEGORY_BG: Record<string, string> = {
  Music: 'rgba(124,58,237,0.15)',
  Technology: 'rgba(37,99,235,0.15)',
  Food: 'rgba(234,88,12,0.15)',
  Business: 'rgba(5,150,105,0.15)',
  Sports: 'rgba(220,38,38,0.15)',
  Arts: 'rgba(217,119,6,0.15)',
  Fashion: 'rgba(236,72,153,0.15)',
  All: 'rgba(255,255,255,0.1)',
};

export const RADIUS = {
  sm: 6,
  md: rs(12),
  lg: rs(16),
  xl: rs(20),
  full: 9999,
};

export const SPACING = {
  xs: rs(4),
  sm: rs(8),
  md: rs(16),
  lg: rs(20),
  xl: rs(28),
  '2xl': rs(40),
};

export const SHADOW = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  glow: { shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
};

export const FONT_SIZE = {
  xs: rf(11),
  sm: rf(13),
  md: rf(15),
  lg: rf(17),
  xl: rf(20),
  '2xl': rf(24),
  '3xl': rf(28),
  '4xl': rf(34),
};

export const CATEGORIES = ['All', 'Music', 'Technology', 'Food', 'Business', 'Sports', 'Arts', 'Fashion'];

export const COVER_IMAGES: Record<string, string> = {
  Music: 'https://images.unsplash.com/photo-1571751239008-50cad6cb9265?w=800&q=80',
  Technology: 'https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80',
  Food: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  Business: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80',
  Sports: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
  Arts: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80',
  Fashion: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  All: 'https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80',
};
