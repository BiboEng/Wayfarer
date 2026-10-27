import { ResultsView } from '@/components/landmark-debug/results-view';
import { SearchForm } from '@/components/landmark-debug/search-form';
import { Screen } from '@/components/screen';
import { useLandmarkSearch } from '@/hooks/use-landmark-search';

export default function LandmarkDebugScreen() {
  const { state, searchNearby, searchNearest } = useLandmarkSearch();
  return (
    <Screen scroll>
      <SearchForm onNearby={searchNearby} onNearest={searchNearest} />
      <ResultsView state={state} />
    </Screen>
  );
}
