import { loadHallScanDataStore } from './hallscan-data-store.mjs';
import { V4_FEATURE_FLAGS, createV4FeatureFlags } from './feature-flags.mjs';

const SURFACE_FLAGS = Object.freeze({
  search: 'v4SlotSearchEnabled',
  store: 'v4StoreSlotEnabled',
  detail: 'v4SlotDetailEnabled'
});

function freezeStatus(value) {
  return Object.freeze(value);
}

export function createV4SlotIntegrationAdapter(options = {}) {
  const flags = options.flags === undefined
    ? V4_FEATURE_FLAGS
    : createV4FeatureFlags(options.flags);
  const loadDataStore = options.loadDataStore ?? loadHallScanDataStore;
  const dataStoreOptions = options.dataStoreOptions ?? {};

  if (typeof loadDataStore !== 'function') {
    throw new TypeError('loadDataStore must be a function');
  }

  let dataStorePromise = null;

  function status(surface) {
    const surfaceFlag = SURFACE_FLAGS[surface];
    if (!surfaceFlag) throw new Error(`Unknown v4 integration surface: ${surface}`);
    if (!flags.v4DataAccessEnabled) {
      return freezeStatus({enabled:false, reason:'v4_data_access_disabled', surface});
    }
    if (!flags[surfaceFlag]) {
      return freezeStatus({enabled:false, reason:`${surfaceFlag}_disabled`, surface});
    }
    return freezeStatus({enabled:true, reason:null, surface});
  }

  async function getDataStore() {
    if (!flags.v4DataAccessEnabled) return null;
    if (!dataStorePromise) {
      dataStorePromise = Promise.resolve().then(() => loadDataStore(dataStoreOptions));
    }
    return dataStorePromise;
  }

  async function getSurfaceRuntime(surface) {
    const gate = status(surface);
    if (!gate.enabled) return freezeStatus({...gate, dataStore:null});
    const dataStore = await getDataStore();
    return freezeStatus({...gate, dataStore});
  }

  function resetForTest() {
    // Kept non-public in production behavior: returned API exposes this only when explicitly requested.
    dataStorePromise = null;
  }

  const api = {
    flags,
    getStatus: status,
    getDataStore,
    getSlotSearchRuntime: () => getSurfaceRuntime('search'),
    getStoreSlotRuntime: () => getSurfaceRuntime('store'),
    getSlotDetailRuntime: () => getSurfaceRuntime('detail')
  };

  if (options.exposeTestReset === true) api.resetForTest = resetForTest;
  return Object.freeze(api);
}

export const V4_SLOT_INTEGRATION = createV4SlotIntegrationAdapter();
