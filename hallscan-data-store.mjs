const DATASET_FILES = Object.freeze({
  stores: 'stores.json',
  machines: 'machines.json',
  installations: 'installations.json',
  strategies: 'strategies.json',
  screening: 'screening.json',
  lookGuides: 'look-guides.json',
  auditMeta: 'audit-meta.json',
  schemaManifest: 'schema-manifest.json'
});

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function exactRateKey(rate) {
  if (rate === 'unknown') return 'unknown';
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new TypeError('rate must be a finite number or "unknown"');
  }
  return String(rate);
}

function installationKey(storeId, machineId, rate) {
  return `${storeId}::${machineId}::${exactRateKey(rate)}`;
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function freezeArray(items) {
  return Object.freeze(items.slice());
}

export function createHallScanDataStore(raw) {
  const required = ['stores','machines','installations','strategies','screening','lookGuides','auditMeta','schemaManifest'];
  for (const name of required) {
    if (!(name in raw)) throw new Error(`Missing dataset: ${name}`);
  }

  const data = deepFreeze({
    stores: raw.stores,
    machines: raw.machines,
    installations: raw.installations,
    strategies: raw.strategies,
    screening: raw.screening,
    lookGuides: raw.lookGuides,
    auditMeta: raw.auditMeta,
    schemaManifest: raw.schemaManifest
  });

  const storeById = new Map(data.stores.map(x => [x.storeId, x]));
  const machineById = new Map(data.machines.map(x => [x.machineId, x]));
  const strategyByMachine = new Map(data.strategies.map(x => [x.machineId, x]));
  const screeningByMachine = new Map(data.screening.map(x => [x.machineId, x]));
  const lookByMachine = new Map(data.lookGuides.map(x => [x.machineId, x]));

  const installationsByStore = new Map();
  const installationsByMachine = new Map();
  const installationByKey = new Map();
  for (const x of data.installations) {
    const key = installationKey(x.storeId, x.machineId, x.rate);
    installationByKey.set(key, x);
    if (!installationsByStore.has(x.storeId)) installationsByStore.set(x.storeId, []);
    if (!installationsByMachine.has(x.machineId)) installationsByMachine.set(x.machineId, []);
    installationsByStore.get(x.storeId).push(x);
    installationsByMachine.get(x.machineId).push(x);
  }
  for (const [k,v] of installationsByStore) installationsByStore.set(k, freezeArray(v));
  for (const [k,v] of installationsByMachine) installationsByMachine.set(k, freezeArray(v));

  const storeAudit = new Map();
  const machineAudit = new Map();
  const installationAudit = new Map();
  for (const x of data.auditMeta) {
    if (x.entityType === 'store') storeAudit.set(x.storeId, x);
    else if (x.entityType === 'machine') machineAudit.set(x.machineId, x);
    else if (x.entityType === 'installation') installationAudit.set(installationKey(x.storeId, x.machineId, x.rate), x);
  }

  function listStores() {
    return data.stores;
  }
  function listMachines() {
    return data.machines;
  }
  function getStore(storeId) {
    return storeById.get(requireId(storeId, 'storeId')) ?? null;
  }
  function getMachine(machineId) {
    return machineById.get(requireId(machineId, 'machineId')) ?? null;
  }
  function getStrategy(machineId) {
    return strategyByMachine.get(requireId(machineId, 'machineId')) ?? null;
  }
  function getScreening(machineId) {
    return screeningByMachine.get(requireId(machineId, 'machineId')) ?? null;
  }
  function getLookGuide(machineId) {
    return lookByMachine.get(requireId(machineId, 'machineId')) ?? null;
  }
  function getInstallationsForStore(storeId) {
    return installationsByStore.get(requireId(storeId, 'storeId')) ?? Object.freeze([]);
  }
  function getInstallationsForMachine(machineId) {
    return installationsByMachine.get(requireId(machineId, 'machineId')) ?? Object.freeze([]);
  }
  function getInstallation(storeId, machineId, rate) {
    return installationByKey.get(installationKey(requireId(storeId,'storeId'), requireId(machineId,'machineId'), rate)) ?? null;
  }
  function getStoreAudit(storeId) {
    return storeAudit.get(requireId(storeId, 'storeId')) ?? null;
  }
  function getMachineAudit(machineId) {
    return machineAudit.get(requireId(machineId, 'machineId')) ?? null;
  }
  function getInstallationAudit(storeId, machineId, rate) {
    return installationAudit.get(installationKey(requireId(storeId,'storeId'), requireId(machineId,'machineId'), rate)) ?? null;
  }

  function getMachineContext(machineId) {
    const machine = getMachine(machineId);
    if (!machine) return null;
    return deepFreeze({
      machine,
      strategy: getStrategy(machineId),
      screening: getScreening(machineId),
      lookGuide: getLookGuide(machineId),
      audit: getMachineAudit(machineId),
      installations: getInstallationsForMachine(machineId)
    });
  }

  function getStoreContext(storeId) {
    const store = getStore(storeId);
    if (!store) return null;
    const installations = getInstallationsForStore(storeId).map(installation => deepFreeze({
      installation,
      machine: getMachine(installation.machineId),
      audit: getInstallationAudit(storeId, installation.machineId, installation.rate)
    }));
    return deepFreeze({store, audit: getStoreAudit(storeId), installations});
  }

  function getInstallationContext(storeId, machineId, rate) {
    const installation = getInstallation(storeId, machineId, rate);
    if (!installation) return null;
    return deepFreeze({
      installation,
      store: getStore(storeId),
      machine: getMachine(machineId),
      strategy: getStrategy(machineId),
      screening: getScreening(machineId),
      lookGuide: getLookGuide(machineId),
      machineAudit: getMachineAudit(machineId),
      installationAudit: getInstallationAudit(storeId, machineId, rate)
    });
  }

  function resolveScreeningCondition(machineId, ruleSetId, conditionIndex) {
    const screening = getScreening(machineId);
    if (!screening) return null;
    const ruleSet = screening.ruleSets.find(x => x.ruleSetId === ruleSetId);
    if (!ruleSet) return null;
    const condition = ruleSet.conditions[conditionIndex];
    if (!condition) return null;

    const strategy = getStrategy(machineId);
    const lookGuide = getLookGuide(machineId);
    const counter = condition.strategyCounterId && strategy
      ? strategy.counterDefinitions.find(x => x.counterId === condition.strategyCounterId) ?? null
      : null;
    const lookItem = condition.lookGuideItemId && lookGuide
      ? lookGuide.items.find(x => x.itemId === condition.lookGuideItemId) ?? null
      : null;

    return deepFreeze({condition, counter, lookItem});
  }

  const counts = deepFreeze({
    stores: data.stores.length,
    machines: data.machines.length,
    installations: data.installations.length,
    strategies: data.strategies.length,
    screening: data.screening.length,
    lookGuides: data.lookGuides.length,
    auditMeta: data.auditMeta.length
  });

  return Object.freeze({
    schemaVersion: data.schemaManifest.schemaVersion,
    counts,
    listStores,
    listMachines,
    getStore,
    getMachine,
    getStrategy,
    getScreening,
    getLookGuide,
    getInstallationsForStore,
    getInstallationsForMachine,
    getInstallation,
    getStoreAudit,
    getMachineAudit,
    getInstallationAudit,
    getMachineContext,
    getStoreContext,
    getInstallationContext,
    resolveScreeningCondition
  });
}

export async function loadHallScanDataStore(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const baseUrl = options.baseUrl ?? new URL('./', import.meta.url);
  const base = baseUrl instanceof URL ? baseUrl : new URL(baseUrl, globalThis.location?.href ?? import.meta.url);

  async function readJson(file) {
    const url = new URL(file, base);
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Failed to load ${file}: HTTP ${response.status}`);
    return response.json();
  }

  const entries = await Promise.all(Object.entries(DATASET_FILES).map(async ([name,file]) => [name, await readJson(file)]));
  return createHallScanDataStore(Object.fromEntries(entries));
}

export { DATASET_FILES };
