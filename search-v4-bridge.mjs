const STORE_ROUTE_BY_ID = Object.freeze({
  maruhan_abashiri: 'abashiri.html',
  royal_abashiri: 'abashiri.html',
  taiyo_yamashita_abashiri: 'abashiri.html',
  towa_abashiri: 'abashiri.html',
  aurora_kitami: 'aurora_kitami_integrated_factchecked.html',
  daigoro_x_kitami: 'daigoro_x_integrated_factchecked.html',
  daigoro_z_kitami: 'daigoro_z_integrated_factchecked.html',
  daiman_kitami: 'daiman_integrated_factchecked.html',
  dynam_kitami: 'dynam_kitami_integrated_factchecked.html',
  himawari_kitami: 'kitami_himawari_integrated_factchecked.html',
  maruhan_kitami: 'maruhan_kitami_integrated_factchecked.html',
  maruhan_tanno: 'maruhan_tanno_integrated_factchecked.html',
  royal_kitami: 'royal_kitami_integrated_factchecked.html',
  towa_kitami: 'towa_kitami_integrated_factchecked.html'
});

const OPERATOR_LABEL = Object.freeze({
  gte: '以上',
  gt: '超',
  lte: '以下',
  lt: '未満',
  eq: '',
  neq: '以外'
});

function freezeRows(rows) {
  for (const row of rows) Object.freeze(row);
  return Object.freeze(rows);
}

export function normalizeV4Search(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/東京グール/g, '東京喰種')
    .replace(/グール/g, '喰種')
    .replace(/[\s・･_\-ー]/g, '');
}

export function rateLabel(rate) {
  if (rate === 'unknown') return 'レート不明';
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return 'レート不明';
  return `${rate}円/枚`;
}

export function rateBand(rate) {
  if (rate === 'unknown') return 'unknown';
  const value = Number(rate);
  if (!Number.isFinite(value)) return 'unknown';
  return value >= 20 ? 'standard' : 'low';
}

function conditionLabel(condition) {
  if (condition.label) return condition.label;
  if (condition.meaning) return condition.meaning;
  if (condition.note) return condition.note;
  const value = condition.value === null || condition.value === undefined ? '' : String(condition.value);
  const unit = condition.unit && !['none', 'state'].includes(condition.unit) ? condition.unit : '';
  const op = OPERATOR_LABEL[condition.comparator] ?? condition.comparator ?? '';
  const fallback = [condition.metric, `${value}${unit}${op}`].filter(Boolean).join(' ');
  return fallback || '条件詳細不明';
}

function ruleSetLabel(ruleSet) {
  const exchangeCondition = ruleSet.appliesTo?.exchangeCondition ?? '';
  if (ruleSet.logic === 'NONE' || !ruleSet.conditions?.length) {
    return `${exchangeCondition ? `［${exchangeCondition}］` : ''}条件なし`;
  }
  const joiner = ruleSet.logic === 'AND' ? ' ＋ ' : ruleSet.logic === 'OR' ? ' または ' : ' / ';
  const body = ruleSet.conditions.map(conditionLabel).join(joiner);
  const exchange = exchangeCondition && !body.includes(exchangeCondition) ? `［${exchangeCondition}］` : '';
  return `${exchange}${body}`;
}

export function summarizeScreeningForSearch(screening) {
  if (!screening) return '一次足切り情報なし';
  if (screening.status === 'unset') return '一次足切り未設定';
  if (!screening.ruleSets?.length) return '一次足切り条件なし';
  const meaningful = screening.ruleSets.filter(rs => rs.logic !== 'NONE' || rs.conditions?.length);
  if (!meaningful.length) return '一次足切り条件なし';
  return meaningful.map(ruleSetLabel).join(' / ');
}

export function machineMatchesV4Search(machine, query) {
  const needle = normalizeV4Search(query);
  if (!needle) return true;
  return [machine.name, ...(machine.aliases ?? [])]
    .map(normalizeV4Search)
    .some(text => text.includes(needle) || needle.includes(text));
}

export function buildV4SlotSearchRows(db) {
  if (!db || typeof db.listStores !== 'function' || typeof db.listMachines !== 'function') {
    throw new TypeError('db must be a HALL SCAN data store');
  }

  const stores = new Map(db.listStores().map(store => [store.storeId, store]));
  const machines = new Map(db.listMachines().map(machine => [machine.machineId, machine]));
  const rows = [];

  for (const store of db.listStores()) {
    const route = STORE_ROUTE_BY_ID[store.storeId];
    if (!route) throw new Error(`No legacy detail route for storeId: ${store.storeId}`);
    for (const installation of db.getInstallationsForStore(store.storeId)) {
      if (installation.status === 'inactive') continue;
      const machine = machines.get(installation.machineId);
      if (!machine) throw new Error(`Unknown machineId in installation: ${installation.machineId}`);
      const screening = db.getScreening(machine.machineId);
      rows.push({
        source: 'v4',
        area: store.areaName,
        store: store.name,
        storeId: store.storeId,
        machineId: machine.machineId,
        file: route,
        kind: 'slot',
        rank: '',
        name: machine.name,
        aliases: Object.freeze([...(machine.aliases ?? [])]),
        quick: screening?.note ?? '',
        target: summarizeScreeningForSearch(screening),
        rate: rateLabel(installation.rate),
        rateValue: installation.rate,
        rateBand: rateBand(installation.rate),
        screeningStatus: screening?.status ?? 'unknown'
      });
    }
  }

  // Deterministic neutral ordering only; this is not a machine rank.
  rows.sort((a, b) =>
    a.area.localeCompare(b.area, 'ja') ||
    a.store.localeCompare(b.store, 'ja') ||
    String(a.rateValue).localeCompare(String(b.rateValue), 'ja', {numeric:true}) ||
    a.name.localeCompare(b.name, 'ja')
  );
  return freezeRows(rows);
}

export function mergeLegacyWithV4Slots(legacyRows, v4Rows, enabled) {
  if (!enabled) return legacyRows;
  return [...legacyRows.filter(row => row.kind !== 'slot'), ...v4Rows];
}

export { STORE_ROUTE_BY_ID };
