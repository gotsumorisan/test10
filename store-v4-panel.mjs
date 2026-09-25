import { filterV4StoreSlotRows, summarizeV4StoreRates } from './store-v4-bridge.mjs';

const STATUS_LABEL=Object.freeze({verified:'確認済み',provisional:'暫定',unset:'未設定',unknown:'不明'});

function esc(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

function ensureStyle(doc){
  if(doc.getElementById('hallscan-v4-store-style')) return;
  const style=doc.createElement('style');
  style.id='hallscan-v4-store-style';
  style.textContent=`
.hs-v4-store-shell{margin:10px 0 16px;padding:12px;border:1px solid rgba(131,170,255,.35);border-radius:16px;background:rgba(20,31,52,.96);color:#f5f7ff}
.hs-v4-storebar{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.hs-v4-storebar::-webkit-scrollbar{display:none}.hs-v4-storebar button,.hs-v4-ratebar button{min-height:44px;border:1px solid #33476c;border-radius:11px;background:#111a2c;color:#b9c5dc;font-weight:800}.hs-v4-storebar button.on,.hs-v4-ratebar button.on{background:#2b4371;border-color:#6b8aca;color:#fff}
.hs-v4-store-title{font-size:17px;font-weight:900;margin:2px 0}.hs-v4-pachi-rate{margin:7px 0 9px;padding:8px 10px;border-radius:10px;background:#162238;border:1px solid #2b4166;color:#d7e2f5;font-size:11px;line-height:1.5}.hs-v4-store-sub{font-size:11px;color:#aebbd3;margin:2px 0 9px}.hs-v4-ratebar{display:flex;gap:6px;overflow-x:auto;padding:2px 0 7px;scrollbar-width:none}.hs-v4-ratebar::-webkit-scrollbar{display:none}.hs-v4-ratebar button{flex:0 0 auto;padding:7px 11px;font-size:12px}
.hs-v4-store-count{font-size:11px;color:#aebbd3;margin:2px 0 8px}.hs-v4-store-list{display:grid;gap:7px}.hs-v4-store-card{border:1px solid #2a3857;border-radius:13px;background:#111a2c;padding:10px}.hs-v4-store-card h3{margin:0;font-size:15px;line-height:1.35}.hs-v4-store-machine-name{display:block;font-size:15px;font-weight:900;line-height:1.35}.hs-v4-store-card-interactive{padding:0;overflow:hidden}.hs-v4-store-card-button{display:block;width:100%;border:0;background:transparent;text-align:left;color:inherit;font:inherit;padding:10px;cursor:pointer;touch-action:manipulation}.hs-v4-store-card-interactive:hover{border-color:#50698f}.hs-v4-store-card-button:active{transform:scale(.997)}.hs-v4-card-meta{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}.hs-v4-tag{font-size:10px;padding:2px 7px;border-radius:999px;background:#18243b;color:#c9d4e7;border:1px solid #2a3857}.hs-v4-screen-label{font-size:10px;font-weight:900;color:#aac7ff;margin-right:5px}.hs-v4-screen-copy{font-size:12px;line-height:1.55;color:#e4e9f3;overflow-wrap:anywhere}.hs-v4-empty{padding:16px 10px;text-align:center;color:#aebbd3;font-size:12px;border:1px dashed #33476c;border-radius:12px}.hs-v4-store-note{margin-top:9px;font-size:10px;color:#9dabc3}.hs-v4-store-shell[hidden]{display:none!important}
@media(max-width:560px){.hs-v4-store-shell{margin:8px 0 13px;padding:10px}.hs-v4-store-card{padding:9px}.hs-v4-store-card h3{font-size:14px}}
`;
  doc.head.appendChild(style);
}

export function createV4StoreSlotPanel({document:doc, rows, stores, selectedStoreId=null, initialSurface='slot', initialQuery='', detailEnabled=false}){
  if(!doc) throw new TypeError('document is required');
  ensureStyle(doc);
  const shell=doc.createElement('section');
  shell.className='hs-v4-store-shell';
  shell.dataset.v4StoreSlot='enabled';
  shell.innerHTML=`<div class="hs-v4-store-title"></div><div class="hs-v4-pachi-rate" data-hs-pachi-rate hidden></div><div class="hs-v4-store-sub">スロット専用。設置・レートはv4 installation master。一次足切りは相談ラインで、着席判定ではありません。</div><div class="hs-v4-storebar" data-hs-storebar></div><div class="hs-v4-ratebar" data-hs-ratebar></div><div class="hs-v4-store-count" data-hs-count></div><div class="hs-v4-store-list" data-hs-list></div><div class="hs-v4-store-note">未確認項目は推測補完しません。</div>`;

  const state={surface:'slot',storeId:selectedStoreId,band:'all',exactRate:null,query:initialQuery};
  const machineListeners=new Set();
  const storebar=shell.querySelector('[data-hs-storebar]');
  const ratebar=shell.querySelector('[data-hs-ratebar]');
  const count=shell.querySelector('[data-hs-count]');
  const list=shell.querySelector('[data-hs-list]');
  const title=shell.querySelector('.hs-v4-store-title');
  const pachiRate=shell.querySelector('[data-hs-pachi-rate]');

  function titleText(){
    if(state.storeId){const s=stores.get(state.storeId);return `${s?.name??state.storeId}｜スロット設置一覧`;}
    return `網走市｜スロット設置一覧`;
  }

  function renderPachinkoRate(){
    if(!state.storeId){pachiRate.hidden=true;pachiRate.textContent='';return;}
    const registry=globalThis.HALLSCAN_FULLRATE??{};
    const meta=Object.values(registry).find(x=>x?.storeId===state.storeId);
    const rates=Array.isArray(meta?.pachinkoRates)?meta.pachinkoRates:[];
    if(!rates.length){pachiRate.hidden=true;pachiRate.textContent='';return;}
    const checked=meta?.pachinkoRateCheckedAt?`｜${meta.pachinkoRateCheckedAt}確認`:'';
    pachiRate.hidden=false;
    pachiRate.textContent=`パチンコ設置レート：${rates.join(' / ')}${checked}（レート情報のみ）`;
  }
  function renderRatebar(){
    const sum=summarizeV4StoreRates(rows,state.storeId);
    const buttons=[
      ['all',null,`全レート ${sum.all}`],
      ['low',null,`低貸 ${sum.low}`],
      ['standard',null,`通常貸し ${sum.standard}`]
    ];
    let html=buttons.map(([band,rate,label])=>`<button type="button" class="${state.band===band&&state.exactRate===null?'on':''}" data-hs-band="${band}">${esc(label)}</button>`).join('');
    if(sum.rates.length>1){
      html+=sum.rates.map(rate=>`<button type="button" class="${state.exactRate===rate?'on':''}" data-hs-rate="${rate}">${esc(rate)}円/枚</button>`).join('');
    }
    ratebar.innerHTML=html;
    ratebar.querySelectorAll('[data-hs-band]').forEach(btn=>btn.addEventListener('click',()=>{state.band=btn.dataset.hsBand;state.exactRate=null;render();}));
    ratebar.querySelectorAll('[data-hs-rate]').forEach(btn=>btn.addEventListener('click',()=>{state.band='all';state.exactRate=Number(btn.dataset.hsRate);render();}));
  }
  function renderCards(){
    const visible=filterV4StoreSlotRows(rows,{storeId:state.storeId,band:state.band,exactRate:state.exactRate,query:state.query});
    count.textContent=`${visible.length}件`;
    if(!visible.length){list.innerHTML='<div class="hs-v4-empty">条件に合うスロット設置がありません。</div>';return;}
    list.innerHTML=visible.map((row,index)=>{
      const meta=`${state.storeId?'':`<span class="hs-v4-tag">${esc(row.storeName)}</span>`}<span class="hs-v4-tag">${esc(row.rateLabel)}</span><span class="hs-v4-tag">一次足切り ${esc(STATUS_LABEL[row.screeningStatus]??row.screeningStatus)}</span>`;
      if(detailEnabled){
        return `<article class="hs-v4-store-card hs-v4-store-card-interactive" data-machine-id="${esc(row.machineId)}" data-store-id="${esc(row.storeId)}" data-rate="${esc(row.rate)}"><button type="button" class="hs-v4-store-card-button" data-hs-row-index="${index}" aria-label="${esc(row.machineName)}の詳細を開く"><span class="hs-v4-store-machine-name">${esc(row.machineName)}</span><span class="hs-v4-card-meta">${meta}</span><span class="hs-v4-screen-copy"><span class="hs-v4-screen-label">一次足切り（相談ライン）</span>${esc(row.screeningSummary)}</span></button></article>`;
      }
      return `<article class="hs-v4-store-card" data-machine-id="${esc(row.machineId)}" data-store-id="${esc(row.storeId)}" data-rate="${esc(row.rate)}"><h3>${esc(row.machineName)}</h3><div class="hs-v4-card-meta">${meta}</div><div class="hs-v4-screen-copy"><span class="hs-v4-screen-label">一次足切り（相談ライン）</span>${esc(row.screeningSummary)}</div></article>`;
    }).join('');
    if(detailEnabled){list.querySelectorAll('[data-hs-row-index]').forEach(btn=>btn.addEventListener('click',()=>{const row=visible[Number(btn.dataset.hsRowIndex)];if(row)for(const fn of machineListeners)fn(row);}));}
  }
  function renderStorebar(){
    if(stores.size<=1){storebar.hidden=true;storebar.innerHTML='';return;}
    storebar.hidden=false;
    const options=[['','全店舗'],...[...stores.entries()].map(([id,store])=>[id,store?.name??id])];
    storebar.innerHTML=options.map(([id,label])=>`<button type="button" class="${(state.storeId??'')===id?'on':''}" data-hs-store="${esc(id)}">${esc(label)}</button>`).join('');
    storebar.querySelectorAll('[data-hs-store]').forEach(btn=>btn.addEventListener('click',()=>{
      state.storeId=btn.dataset.hsStore||null;state.band='all';state.exactRate=null;render();
    }));
  }
  function render(){title.textContent=titleText();renderPachinkoRate();renderStorebar();renderRatebar();renderCards();}

  render();
  return Object.freeze({
    element:shell,
    getState:()=>Object.freeze({...state}),
    setSurface(surface){if(surface!=='slot')return;state.surface='slot';render();},
    setStore(storeId){state.storeId=storeId??null;state.band='all';state.exactRate=null;render();},
    setQuery(query){state.query=query??'';renderCards();},
    onSurfaceChange(){return()=>{};},
    onMachineSelect(fn){if(typeof fn==='function')machineListeners.add(fn);return()=>machineListeners.delete(fn);}
  });
}
