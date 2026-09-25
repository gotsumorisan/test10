const FLAG_NAMES = Object.freeze([
  'v4DataAccessEnabled',
  'v4SlotSearchEnabled',
  'v4StoreSlotEnabled',
  'v4SlotDetailEnabled'
]);

export const V4_FEATURE_FLAG_NAMES = FLAG_NAMES;

export const DEFAULT_V4_FEATURE_FLAGS = Object.freeze({
  v4DataAccessEnabled: false,
  v4SlotSearchEnabled: false,
  v4StoreSlotEnabled: false,
  v4SlotDetailEnabled: false
});

export function createV4FeatureFlags(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('feature flag overrides must be an object');
  }

  const unknown = Object.keys(overrides).filter(name => !FLAG_NAMES.includes(name));
  if (unknown.length) {
    throw new Error(`Unknown v4 feature flag(s): ${unknown.join(', ')}`);
  }

  const next = {...DEFAULT_V4_FEATURE_FLAGS};
  for (const name of FLAG_NAMES) {
    if (!(name in overrides)) continue;
    if (typeof overrides[name] !== 'boolean') {
      throw new TypeError(`${name} must be boolean`);
    }
    next[name] = overrides[name];
  }
  return Object.freeze(next);
}

// Production cutover (Step12.8): v4 slot surfaces are now the production default.
// DEFAULT_V4_FEATURE_FLAGS remains all-OFF as the explicit rollback baseline.
// Rollback stays independent: change only the affected production override below.
export const V4_FEATURE_FLAGS = createV4FeatureFlags({
  v4DataAccessEnabled: true,
  v4SlotSearchEnabled: true,
  v4StoreSlotEnabled: true,
  v4SlotDetailEnabled: true
});
