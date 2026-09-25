export function rateLabel(rate) {
  return rate === 'unknown' ? 'レート不明' : `${rate}円/枚`;
}

export function rateBand(rate) {
  if (rate === 'unknown') return 'unknown';
  const n = Number(rate);
  if (!Number.isFinite(n)) return 'unknown';
  return n >= 20 ? 'standard' : 'low';
}

export function normalizeSearch(value='') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/東京グール/g, '東京喰種')
    .replace(/グール/g, '喰種')
    .replace(/[\s・･_\-ー]/g, '');
}

export function machineMatches(machine, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const hay = [machine.name, ...(machine.aliases ?? [])].map(normalizeSearch);
  return hay.some(x => x.includes(q) || q.includes(x));
}

export function summarizeScreening(screening) {
  if (!screening) return {status:'unknown', ruleSets:0, conditions:0, label:'一次足切り情報なし'};
  const conditions = screening.ruleSets.reduce((n, rs) => n + rs.conditions.length, 0);
  const label = screening.status === 'unset'
    ? '一次足切り未設定'
    : screening.ruleSets.length === 0
      ? '一次足切り条件なし'
      : `相談条件 ${screening.ruleSets.length}パターン`;
  return {status:screening.status, ruleSets:screening.ruleSets.length, conditions, label};
}

export function buildInstallationRow(db, installation) {
  const machine = db.getMachine(installation.machineId);
  if (!machine) return null;
  const screening = db.getScreening(machine.machineId);
  const lookGuide = db.getLookGuide(machine.machineId);
  const strategy = db.getStrategy(machine.machineId);
  return Object.freeze({
    installation,
    machine,
    screening,
    screeningSummary: summarizeScreening(screening),
    lookGuide,
    strategy
  });
}

export function listStoreRates(db, storeId) {
  const seen = new Map();
  for (const x of db.getInstallationsForStore(storeId)) seen.set(String(x.rate), x.rate);
  return Object.freeze([...seen.values()].sort((a,b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return Number(a) - Number(b);
  }));
}

export function filterRatesByBand(rates, band='all') {
  if (band === 'all') return Object.freeze([...rates]);
  return Object.freeze(rates.filter(rate => rateBand(rate) === band));
}

export function availableRateBands(rates) {
  return Object.freeze({
    low: rates.some(rate => rateBand(rate) === 'low'),
    standard: rates.some(rate => rateBand(rate) === 'standard'),
    unknown: rates.some(rate => rateBand(rate) === 'unknown')
  });
}

export function defaultRateBand(rates) {
  const available = availableRateBands(rates);
  if (available.low) return 'low';
  if (available.standard) return 'standard';
  return 'all';
}

export function listRows(db, storeId, rate, query='') {
  return Object.freeze(db.getInstallationsForStore(storeId)
    .filter(x => String(x.rate) === String(rate))
    .map(x => buildInstallationRow(db, x))
    .filter(Boolean)
    .filter(x => machineMatches(x.machine, query))
    .sort((a,b) => a.machine.name.localeCompare(b.machine.name, 'ja')));
}
