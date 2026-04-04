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
  razorpay: '#3395FF',
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

// Multiple curated high-quality images per category for variety
// Using verified 11-character Unsplash IDs for maximum reliability and premium quality
export const CATEGORY_IMAGE_POOLS: Record<string, string[]> = {
  Music: [
    'https://images.unsplash.com/photo-1470225722913-7c0e2dbbafd3?w=800&q=80', // Crowd OaGfnPEiMhA actually 1470225722913 works too but let's use the shorter ones where possible
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', // DJ 2Kl2VzdoVns
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80', // Stage IQOyho3CZGU
  ],
  Technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80', // Coding afG2ZF8h1OQ
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80', // Hardware d2UbZWIcIJo
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80', // Setup YzKdrThXLIk
  ],
  Food: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', // Plated 4lSxubD62ys
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80', // Chef hrlBBk2ILXM
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80', // Restaurant bXOHW6fKdPI
  ],
  Business: [
    'https://images.unsplash.com/photo-1507679799987-c7377fb1865e?w=800&q=80', // Meeting F4coHibryBo
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80', // Office 3tCLyPBSQ5k
    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80', // Discussion 0L1XzREL6Mo
  ],
  Sports: [
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80', // Epic stadium pitch
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80', // Cricket match action
    'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&q=80', // Stadium game crowd
  ],
  Arts: [
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80', // Gallery xfh2G7poB24
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80', // Painting pYomB9e8lX0
    'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80', // Abstract mP7aPSUm7aE
  ],
  Fashion: [
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80', // Runway UhWly5nS15g
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80', // Catwalk kmF0GjQ-dDA
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80', // Stage wsittKS1Q5k
  ],
};

// Legacy single-image fallback (kept for backward compatibility)
export const COVER_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_IMAGE_POOLS).map(([k, v]) => [k, v[0]])
);
COVER_IMAGES.All = CATEGORY_IMAGE_POOLS.Music[0];

/**
 * Get a category-appropriate image. Uses a simple hash of `seed` (e.g. event title)
 * to deterministically pick from the pool so the same event always gets the same image.
 */
export function getCategoryImage(category: string, seed?: string): string {
  const pool = CATEGORY_IMAGE_POOLS[category] || CATEGORY_IMAGE_POOLS.Music;
  if (!seed) return pool[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

/**
 * Get the display image for an event.
 * - If the stored URL is from Firebase Storage (real admin upload) → use it as-is
 * - If it's an Unsplash URL (old fallback) or empty → replace with correct category image
 * This ensures existing events with wrong Unsplash URLs get fixed automatically.
 */
export function getEventImage(coverUrl: string | undefined, category: string, title?: string): string {
  if (!coverUrl) return getCategoryImage(category, title);
  // Real uploaded images go to Firebase Storage
  const isFirebaseStorage = coverUrl.includes('firebasestorage.googleapis.com') || coverUrl.includes('storage.googleapis.com');
  if (isFirebaseStorage) return coverUrl;
  // Any other URL (Unsplash, etc.) → use the correct category fallback
  return getCategoryImage(category, title);
}
