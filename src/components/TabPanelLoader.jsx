import { UnloadingLoader } from './UnloadingLoader.jsx';

export function TabPanelLoader() {
  return (
    <div className="flex justify-center py-20" role="status" aria-live="polite">
      <UnloadingLoader size="sm" />
    </div>
  );
}
