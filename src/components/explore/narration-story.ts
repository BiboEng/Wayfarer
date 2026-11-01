import type { NarrationView } from '@/explore/explore-view';

/** The story text of a narration, when it has arrived. */
export function storyText(narration: NarrationView): string | undefined {
  return narration.status === 'writing' ? undefined : narration.text;
}
