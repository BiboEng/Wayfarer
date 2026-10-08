/** Wayfarer palette: old map and leather-bound journal. Dark only. */
export const colors = {
  background: '#2A1410',
  surface: '#3D1F18',
  surfaceRaised: '#4A2A21',
  primary: '#8B3A2B',
  primaryPressed: '#6F2D21',
  accent: '#C1693C',
  accentPressed: '#A55730',
  text: '#F3E6D8',
  textSecondary: '#C9B3A0',
  textOnAccent: '#1F0D09',
  border: '#5A3A2E',
  success: '#9CB57A',
  danger: '#E08A6B',
  overlay: 'rgba(42, 20, 16, 0.85)',
} as const;

export type ColorToken = keyof typeof colors;
