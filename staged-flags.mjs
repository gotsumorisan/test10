import { createV4FeatureFlags } from './feature-flags.mjs';

// Current staged-integration switches.
// Phase D enables the shared data layer, v4 slot search, store-page slot branch, and slot detail.
// Pachinko remains on the legacy v3 branch.
export const V4_STAGED_FEATURE_FLAGS = createV4FeatureFlags({
  v4DataAccessEnabled: true,
  v4SlotSearchEnabled: true,
  v4StoreSlotEnabled: true,
  v4SlotDetailEnabled: true
});
