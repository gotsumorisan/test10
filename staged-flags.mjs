import { createV4FeatureFlags } from './feature-flags.mjs';

// Current production integration switches.
// Machine-level UI/data is slot-only. Pachinko is retained only as store-level rate metadata.
export const V4_STAGED_FEATURE_FLAGS = createV4FeatureFlags({
  v4DataAccessEnabled: true,
  v4SlotSearchEnabled: true,
  v4StoreSlotEnabled: true,
  v4SlotDetailEnabled: true
});
