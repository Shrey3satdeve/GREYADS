import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Base design dimensions (iPhone 13 Pro)
const BASE_W = 390;
const BASE_H = 844;

// Scale factor
const scaleW = W / BASE_W;
const scaleH = H / BASE_H;

/** Responsive width — scales by screen width */
export const rw = (val: number): number => Math.round(val * scaleW);

/** Responsive height — scales by screen height */
export const rh = (val: number): number => Math.round(val * scaleH);

/** Responsive font — scales with pixel ratio clamped for readability */
export const rf = (val: number): number => {
  const scale = Math.min(scaleW, 1.3);
  return Math.round(PixelRatio.roundToNearestPixel(val * scale));
};

/** Responsive padding/margin — scales with width, clamped */
export const rs = (val: number): number => {
  const scale = Math.min(scaleW, 1.2);
  return Math.round(val * scale);
};

export const SCREEN_W = W;
export const SCREEN_H = H;
export const isSmallPhone = W < 360;
export const isLargePhone = W >= 414;
export const isTablet = W >= 768;

// Breakpoints
export const CARD_WIDTH = W - rs(40);
export const HALF_CARD = (W - rs(50)) / 2;
export const GRID_CARD = (W - rs(52)) / 2;
