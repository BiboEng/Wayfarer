import { PlaceholderCard } from '@/components/placeholder-card';

import { LengthSetting } from './length-setting';
import { TravelModeSetting } from './travel-mode-setting';
import { VoiceSetting } from './voice-setting';

/** The Narration card of the Settings screen: voice, length and travel mode. */
export function NarrationCard() {
  return (
    <PlaceholderCard title="Narration">
      <VoiceSetting />
      <LengthSetting />
      <TravelModeSetting />
    </PlaceholderCard>
  );
}
