import type { Side } from '@/tour/types';

const LABELS: Record<Side, string> = {
  left: 'On your left',
  right: 'On your right',
  ahead: 'Ahead',
};

/** "On your left" / "On your right" / "Ahead". */
export function sideLabel(side: Side): string {
  return LABELS[side];
}
