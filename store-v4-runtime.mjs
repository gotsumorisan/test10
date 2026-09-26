import { createV4SlotIntegrationAdapter } from './v4-slot-adapter.mjs';
import { V4_FEATURE_FLAGS } from './feature-flags.mjs';
import { buildV4StoreSlotRows, getStorePageConfig, queryMatchesV4StoreSlot } from './store-v4-bridge.mjs';
import { createV4StoreSlotPanel } from './store-v4-panel.mjs';
import { buildV4SlotDetailModel } from './slot-detail-v4-bridge.mjs';
import { createV4SlotDetailPanel } from './slot-detail-v4-panel.mjs';

function queryValue(win){try{return new URLSearchParams(win.location.search).get('q')??'';}catch{return '';}}
function findSearchInput(doc){return doc.querySelector('input[type="search"]') ?? doc.querySelector('#search,#s');}

function pageLegacyControls(doc){
  return [...doc.querySelectorAll('header .filters,header .filter,header .mode,header .modes,header .f,header #ratefilters,header .ratefilters')];
}

function legacyMainNodes(doc,config){
  if(config.kind==='group') return ['#hero','#toolbar','main .v311-help','#content','main .footer'].map(s=>doc.querySelector(s)).filter(Boolean);
  const main=doc.querySelector('main');
  return main?[...main.children].filter(el=>!el.classList.contains('hs-v4-store-shell')&&!el.classList.contains('hs-v4-detail-shell')):[];
}

function setHidden(nodes,hidden){for(const node of nodes){if(node)node.hidden=hidden;}}

function isolateLegacySlotEntry(doc,config){
  for(const selector of config.legacySlotButtons??[]){const el=doc.querySelector(selector);if(el)el.hidden=true;}
  if(config.kind==='group'){
    for(const view of ['patrol','slot','audit']){const el=doc.querySelector(`.navbtn[data-view="${view}"]`);if(el)el.hidden=true;}
  }
}

export function failClosedV4StoreSlot(doc, config){
  if(!doc||!config) return Object.freeze({enabled:false,reason:'v4-error'});
  isolateLegacySlotEntry(doc,config);
  setHidden(pageLegacyControls(doc),true);
  const main=doc.querySelector('main');
  if(main){
    setHidden(legacyMainNodes(doc,config),true);
    let box=doc.getElementById('hsV4StoreError');
    if(!box){
      box=doc.createElement('section');
      box.id='hsV4StoreError';
      box.className='hs-v4-store-shell';
      box.innerHTML='<div class="hs-v4-empty">スロットデータを読み込めませんでした。通信を確認して再読み込みしてください。</div>';
      main.insertBefore(box,main.firstChild);
    }
  }
  const bottom=doc.querySelector('.bottom');if(bottom)bottom.hidden=true;
  if(doc.documentElement?.dataset){
    doc.documentElement.dataset.v4StoreSlot='error-v4';
    doc.documentElement.dataset.v4StoreSurface='slot-error';
  }
  return Object.freeze({enabled:false,reason:'v4-error'});
}

function requestedGroupStoreId(win,config){
  try{
    const key=new URLSearchParams(win.location.search).get('store');
    return key ? (config.legacyStoreKeyMap?.[key] ?? null) : null;
  }catch{return null;}
}

function chooseInitialSurface(){return 'slot';}

function mergeHistoryState(win,detailValue){
  const prior=win.history?.state;
  const base=prior&&typeof prior==='object'&&!Array.isArray(prior)?prior:{};
  return {...base,hsV4SlotDetail:detailValue};
}

export async function bootV4StoreSlots(options={}){
  const win=options.window ?? globalThis.window;
  const doc=options.document ?? globalThis.document;
  const flags=options.flags ?? V4_FEATURE_FLAGS;
  const adapter=options.adapter ?? createV4SlotIntegrationAdapter({flags});
  const pathname=options.pathname ?? win?.location?.pathname ?? '';
  const config=options.config ?? getStorePageConfig(pathname);
  if(!config) return Object.freeze({enabled:false,reason:'not_a_store_page',rows:0,detailEnabled:false});
  const runtime=await adapter.getStoreSlotRuntime();
  if(!runtime.enabled) return Object.freeze({enabled:false,reason:runtime.reason,rows:0,detailEnabled:false});
  const detailRuntime=await adapter.getSlotDetailRuntime();
  const detailEnabled=detailRuntime.enabled;

  const rows=buildV4StoreSlotRows(runtime.dataStore,config.storeIds);
  const stores=new Map(config.storeIds.map(id=>[id,runtime.dataStore.getStore(id)]));
  if(rows.length===0) throw new Error('v4 store slot rows are empty');

  const search=findSearchInput(doc);
  const initialQuery=search?.value || queryValue(win);
  let selectedStoreId=config.kind==='group'?requestedGroupStoreId(win,config):config.storeIds[0];
  if(config.kind==='group' && initialQuery){
    let hasExplicitStore=false;
    try{hasExplicitStore=new URLSearchParams(win.location.search).has('store');}catch{}
    if(!hasExplicitStore) selectedStoreId=null;
  }
  const initialSurface=chooseInitialSurface(config,rows,initialQuery,selectedStoreId);
  const panel=createV4StoreSlotPanel({document:doc,rows,stores,selectedStoreId,initialSurface,initialQuery,detailEnabled});
  const main=doc.querySelector('main');
  if(!main) throw new Error('store page main element not found');
  main.insertBefore(panel.element,main.firstChild);

  let detailPanel=null;
  let detailOpen=false;
  let listScrollY=0;
  let applyingHistory=false;

  function closeDetailImmediate({restoreScroll=true}={}){
    if(!detailPanel || !detailOpen) return;
    detailPanel.hide();
    panel.element.hidden=false;
    detailOpen=false;
    delete doc.documentElement.dataset.v4SlotDetailOpen;
    if(restoreScroll && typeof win?.requestAnimationFrame==='function') win.requestAnimationFrame(()=>win.scrollTo?.({top:listScrollY,behavior:'auto'}));
  }

  function closeDetail(){
    if(!detailOpen) return;
    if(win?.history?.state?.hsV4SlotDetail && typeof win.history.back==='function'){win.history.back();return;}
    closeDetailImmediate();
  }

  function showDetailForRow(row,{pushHistory=true,captureScroll=true}={}){
    if(!detailEnabled || !detailPanel) return false;
    const model=buildV4SlotDetailModel(runtime.dataStore,{storeId:row.storeId,machineId:row.machineId,rate:row.rate});
    if(!model) return false;
    if(captureScroll) listScrollY=Number(win?.scrollY??0);
    panel.element.hidden=true;
    detailPanel.show(model);
    detailOpen=true;
    doc.documentElement.dataset.v4SlotDetailOpen='true';
    if(pushHistory && !applyingHistory && win?.history?.pushState){
      if(!win.history.state?.hsV4SlotDetail) win.history.replaceState?.(mergeHistoryState(win,null),'');
      win.history.pushState(mergeHistoryState(win,{storeId:row.storeId,machineId:row.machineId,rate:row.rate}),'');
    }
    win?.scrollTo?.({top:0,behavior:'auto'});
    return true;
  }

  if(detailEnabled){
    detailPanel=createV4SlotDetailPanel({document:doc,onBack:closeDetail});
    panel.element.insertAdjacentElement('afterend',detailPanel.element);
    panel.onMachineSelect(row=>showDetailForRow(row));
    win?.addEventListener?.('popstate',event=>{
      const detail=event.state?.hsV4SlotDetail;
      applyingHistory=true;
      try{
        if(detail){
          const row=rows.find(x=>x.storeId===detail.storeId&&x.machineId===detail.machineId&&String(x.rate)===String(detail.rate));
          if(row) showDetailForRow(row,{pushHistory:false,captureScroll:false});
          else closeDetailImmediate({restoreScroll:false});
        }else closeDetailImmediate({restoreScroll:true});
      }finally{applyingHistory=false;}
    });
  }

  const legacyNodes=legacyMainNodes(doc,config).filter(node=>node!==panel.element&&node!==detailPanel?.element);
  const controls=pageLegacyControls(doc);
  isolateLegacySlotEntry(doc,config);

  function applySlotOnlySurface(){
    setHidden(legacyNodes,true);
    setHidden(controls,true);
    const bottom=doc.querySelector('.bottom');if(bottom)bottom.hidden=true;
    doc.documentElement.dataset.v4StoreSurface='slot';
  }
  applySlotOnlySurface();

  if(search){search.addEventListener('input',()=>panel.setQuery(search.value));}

  doc.documentElement.dataset.v4StoreSlot='enabled';
  if(detailEnabled) doc.documentElement.dataset.v4SlotDetail='enabled';
  return Object.freeze({enabled:true,reason:null,rows:rows.length,storeIds:Object.freeze([...config.storeIds]),initialSurface,detailEnabled});
}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  bootV4StoreSlots({window,document}).catch(error=>{
    console.error('[HALL SCAN] v4 store slot unavailable; legacy slot fallback is disabled',error);
    const config=getStorePageConfig(window.location?.pathname??'');
    failClosedV4StoreSlot(document,config);
  });
}
