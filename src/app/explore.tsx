import { AppText } from '@/components/app-text';
import { PlaceholderCard } from '@/components/placeholder-card';
import { Screen } from '@/components/screen';

export default function ExploreScreen() {
  return (
    <Screen>
      <PlaceholderCard title="Explore the World" badge="Arrives in Phase 4">
        <AppText color="textSecondary">
          Pick any spot on the map to see its landmarks and hear their stories.
        </AppText>
      </PlaceholderCard>
    </Screen>
  );
}
