import { rateBand, rateLabel, summarizeScreeningForSearch, normalizeV4Search } from './search-v4-bridge.mjs';

export const STORE_PAGE_CONFIG = Object.freeze({
  abashiri: Object.freeze({
    kind:'group',
    pathname:'abashiri.html',
    storeIds:Object.freeze(['maruhan_abashiri','royal_abashiri','taiyo_yamashita_abashiri','towa_abashiri']),
    defaultSurface:'slot',
    legacyStoreKeyMap:Object.freeze({
      all:null,
      maruhan:'maruhan_abashiri',
      royal:'royal_abashiri',
      taiyo:'taiyo_yamashita_abashiri',
      towa:'towa_abashiri'
    })
  }),
  aurora_kitami: Object.freeze({kind:'single',pathname:'aurora_kitami_integrated_factchecked.html',storeIds:Object.freeze(['aurora_kitami']),defaultSurface:'slot'}),
  daigoro_x_kitami: Object.freeze({kind:'single',pathname:'daigoro_x_integrated_factchecked.html',storeIds:Object.freeze(['daigoro_x_kitami']),defaultSurface:'slot'}),
  daigoro_z_kitami: Object.freeze({kind:'single',pathname:'daigoro_z_integrated_factchecked.html',storeIds:Object.freeze(['daigoro_z_kitami']),defaultSurface:'slot',legacyPachiButton:'#bp',legacySlotButtons:Object.freeze(['#b562','#b25'])}),
  daiman_kitami: Object.freeze({kind:'single',pathname:'daiman_integrated_factchecked.html',storeIds:Object.freeze(['daiman_kitami']),defaultSurface:'slot'}),
  dynam_kitami: Object.freeze({kind:'single',pathname:'dynam_kitami_integrated_factchecked.html',storeIds:Object.freeze(['dynam_kitami']),defaultSurface:'slot',legacyPachiButton:'#pachiBtn',legacySlotButtons:Object.freeze(['#slotBtn'])}),
  himawari_kitami: Object.freeze({kind:'single',pathname:'kitami_himawari_integrated_factchecked.html',storeIds:Object.freeze(['himawari_kitami']),defaultSurface:'slot',legacyPachiButton:'#pachiBtn',legacySlotButtons:Object.freeze(['#slotBtn'])}),
  maruhan_kitami: Object.freeze({kind:'single',pathname:'maruhan_kitami_integrated_factchecked.html',storeIds:Object.freeze(['maruhan_kitami']),defaultSurface:'slot',legacyPachiButton:'#pachiBtn',legacySlotButtons:Object.freeze(['#slotBtn'])}),
  maruhan_tanno: Object.freeze({kind:'single',pathname:'maruhan_tanno_integrated_factchecked.html',storeIds:Object.freeze(['maruhan_tanno']),defaultSurface:'slot',legacyPachiButton:'#pachiBtn',legacySlotButtons:Object.freeze(['#slotBtn'])}),
  royal_kitami: Object.freeze({kind:'single',pathname:'royal_kitami_integrated_factchecked.html',storeIds:Object.freeze(['royal_kitami']),defaultSurface:'slot'}),
  towa_kitami: Object.freeze({kind:'single',pathname:'towa_kitami_integrated_factchecked.html',storeIds:Object.freeze(['towa_kitami']),defaultSurface:'slot'})
});

const CONFIG_BY_PATH = new Map(Object.values(STORE_PAGE_CONFIG).map(config => [config.pathname, config]));

function freezeRows(rows) {
  for (const row of rows) Object.freeze(row);
  return Object.freeze(rows);
}

export function getStorePageConfig(pathname='') {
  const file=String(pathname).split('/').pop() || '';
  return CONFIG_BY_PATH.get(file) ?? null;
}

export function buildV4StoreSlotRows(db, storeIds) {
  if (!db || typeof db.getStore !== 'function' || typeof db.getInstallationsForStore !== 'function') {
    throw new TypeError('db must be a HALL SCAN data store');
  }
  if (!Array.isArray(storeIds) || storeIds.length===0) throw new TypeError('storeIds must be a non-empty array');
  const rows=[];
  for (const storeId of storeIds) {
    const store=db.getStore(storeId);
    if (!store) throw new Error(`Unknown storeId: ${storeId}`);
    for (const installation of db.getInstallationsForStore(storeId)) {
      if (installation.status==='inactive') continue;
      const machine=db.getMachine(installation.machineId);
      if (!machine) throw new Error(`Unknown machineId: ${installation.machineId}`);
      const screening=db.getScreening(machine.machineId);
      rows.push({
        source:'v4',
        storeId,
        storeName:store.name,
        areaId:store.areaId,
        areaName:store.areaName,
        machineId:machine.machineId,
        machineName:machine.name,
        aliases:Object.freeze([...(machine.aliases??[])]),
        rate:installation.rate,
        rateLabel:rateLabel(installation.rate),
        rateBand:rateBand(installation.rate),
        installationStatus:installation.status,
        confirmedAt:installation.confirmedAt,
        screeningStatus:screening?.status ?? 'unknown',
        screeningSummary:summarizeScreeningForSearch(screening)
      });
    }
  }
  rows.sort((a,b)=>
    a.storeName.localeCompare(b.storeName,'ja') ||
    (typeof a.rate==='number'&&typeof b.rate==='number'?a.rate-b.rate:String(a.rate).localeCompare(String(b.rate),'ja')) ||
    a.machineName.localeCompare(b.machineName,'ja')
  );
  return freezeRows(rows);
}

export function filterV4StoreSlotRows(rows, options={}) {
  const storeId=options.storeId ?? null;
  const band=options.band ?? 'all';
  const exactRate=options.exactRate ?? null;
  const query=normalizeV4Search(options.query ?? '');
  return freezeRows(rows.filter(row=>{
    if (storeId && row.storeId!==storeId) return false;
    if (band!=='all' && row.rateBand!==band) return false;
    if (exactRate!==null && String(row.rate)!==String(exactRate)) return false;
    if (query) {
      const hay=[row.machineName,...row.aliases,row.storeName,row.screeningSummary].map(normalizeV4Search).join(' ');
      if (!hay.includes(query)) return false;
    }
    return true;
  }));
}

export function summarizeV4StoreRates(rows, storeId=null) {
  const scoped=storeId?rows.filter(x=>x.storeId===storeId):rows;
  const numeric=[...new Set(scoped.filter(x=>typeof x.rate==='number').map(x=>x.rate))].sort((a,b)=>a-b);
  const unknown=scoped.some(x=>x.rate==='unknown');
  return Object.freeze({
    rates:Object.freeze(numeric),
    unknown,
    all:scoped.length,
    low:scoped.filter(x=>x.rateBand==='low').length,
    standard:scoped.filter(x=>x.rateBand==='standard').length
  });
}

export function queryMatchesV4StoreSlot(rows, query, storeId=null) {
  const needle=normalizeV4Search(query ?? '');
  if (!needle) return false;
  return rows.some(row => (!storeId || row.storeId===storeId) && [row.machineName,...row.aliases].map(normalizeV4Search).some(x=>x.includes(needle)||needle.includes(x)));
}
