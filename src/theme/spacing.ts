/** 4dp-based spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Minimum comfortable touch target (dp). */
export const minTouchTarget = 48;

export type SpacingToken = keyof typeof spacing;
