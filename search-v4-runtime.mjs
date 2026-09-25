import { createV4SlotIntegrationAdapter } from './v4-slot-adapter.mjs';
import { V4_FEATURE_FLAGS } from './feature-flags.mjs';
import { buildV4SlotSearchRows } from './search-v4-bridge.mjs';

export async function bootV4SlotSearch(options = {}) {
  const target = options.target ?? globalThis;
  const flags = options.flags ?? V4_FEATURE_FLAGS;
  const adapter = options.adapter ?? createV4SlotIntegrationAdapter({ flags });
  const runtime = await adapter.getSlotSearchRuntime();

  if (!runtime.enabled) {
    return Object.freeze({ enabled:false, reason:runtime.reason, rows:0 });
  }

  const rows = buildV4SlotSearchRows(runtime.dataStore);
  const setter = target?.__HALLSCAN_SET_V4_SLOT_DATA__;
  if (typeof setter !== 'function') {
    throw new Error('search.html v4 slot setter is not available');
  }
  setter(rows);
  return Object.freeze({ enabled:true, reason:null, rows:rows.length });
}

export function failClosedV4SlotSearch(target=globalThis, doc=globalThis.document) {
  const setter = target?.__HALLSCAN_SET_V4_SLOT_DATA__;
  if (typeof setter === 'function') setter([]);
  if (doc?.documentElement?.dataset) doc.documentElement.dataset.v4SlotSearch = 'error-v4';
  return Object.freeze({ enabled:false, reason:'v4-error', rows:0 });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  bootV4SlotSearch({target:window})
    .then(result => {
      document.documentElement.dataset.v4SlotSearch = result.enabled ? 'enabled' : 'disabled';
      if (!result.enabled) failClosedV4SlotSearch(window, document);
    })
    .catch(error => {
      console.error('[HALL SCAN] v4 slot search unavailable; legacy slot fallback is disabled', error);
      failClosedV4SlotSearch(window, document);
    });
}
