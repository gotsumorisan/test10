import { buildConsultationText } from './consultation-builder.mjs';

const STATUS_LABEL=Object.freeze({
  verified:'確認済み', provisional:'暫定', partial:'一部確認', unset:'未設定', unknown:'不明',
  edge:'期待値狙い', setting:'設定狙い', unverified:'未検証'
});

function esc(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function safe(value,fallback='—'){return value===null||value===undefined||value===''?fallback:String(value);}
function yen(value){return typeof value==='number'?`${value.toLocaleString('ja-JP')}円`:'金額不明';}
function unitSuffix(unit){
  if(!unit || ['none','state'].includes(unit)) return '';
  if(unit==='times') return '回';
  if(unit==='cycle') return '周期';
  return unit;
}
function conditionText(c){
  if(c.label) return c.label;
  if(c.meaning) return c.meaning;
  const v=c.value===null||c.value===undefined?'':String(c.value);
  return `${c.metric??'条件'} ${c.comparator??''} ${v}${unitSuffix(c.unit)}`.trim();
}
function badgeClass(status){return status==='verified'?'good':(['partial','provisional'].includes(status)?'partial':'unknown');}
function ensureStyle(doc){
  if(doc.getElementById('hallscan-v4-detail-style')) return;
  const style=doc.createElement('style');
  style.id='hallscan-v4-detail-style';
  style.textContent=`
.hs-v4-detail-shell{margin:8px 0 16px;color:#f5f7ff}.hs-v4-detail-shell[hidden]{display:none!important}.hs-v4-detail-nav{position:sticky;top:max(env(safe-area-inset-top),0px);z-index:20;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 2px 8px;background:rgba(11,16,28,.94);backdrop-filter:blur(12px)}.hs-v4-detail-back,.hs-v4-detail-bottom,.hs-v4-consult-copy{min-height:44px;touch-action:manipulation}.hs-v4-detail-back{border:0;background:transparent;color:#eef3fb;font-weight:900;padding:8px 4px}.hs-v4-detail-rate{font-size:12px;color:#aac7ff;font-weight:900;white-space:nowrap}.hs-v4-detail-card{border:1px solid #2f3e5e;border-radius:18px;background:#111a2c;padding:13px;box-shadow:0 18px 48px rgba(0,0,0,.22)}.hs-v4-detail-hero{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hs-v4-detail-kicker{margin:0;color:#91a9d0;font-size:11px;font-weight:800}.hs-v4-detail-title{margin:4px 0 0;font-size:22px;line-height:1.3}.hs-v4-badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.hs-v4-badge{border:1px solid #33476c;border-radius:999px;padding:3px 7px;font-size:10px;color:#c9d4e7;background:#18243b}.hs-v4-badge.good{border-color:#285d41;color:#7fe0aa;background:#102019}.hs-v4-badge.partial{border-color:#684e24;color:#f2c474;background:#201a10}.hs-v4-badge.unknown{color:#aeb9ca}.hs-v4-detail-block{margin-top:10px;border:1px solid #2a3857;border-radius:14px;background:#0e1626;padding:11px;overflow-wrap:anywhere}.hs-v4-detail-block.emphasis{border-color:#554828;background:#18170f}.hs-v4-detail-block.consult{border-color:#35506c;background:#101823}.hs-v4-detail-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;font-weight:900}.hs-v4-detail-heading small{color:#d8b65e;font-size:10px}.hs-v4-rule{border-top:1px solid #283754;padding:9px 0}.hs-v4-rule:first-child{border-top:0}.hs-v4-rule-head{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#c8d3e4}.hs-v4-condition{margin-top:6px;padding:9px;border-radius:10px;background:#0a111e;font-size:12px;line-height:1.5}.hs-v4-condition-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.hs-v4-condition-meta code{font-size:9px;color:#8998b0}.hs-v4-consult-note,.hs-v4-muted{color:#aebbd3;font-size:11px;line-height:1.5}.hs-v4-consult-field{display:block;border-top:1px solid #283754;padding:9px 0}.hs-v4-consult-field:first-of-type{border-top:0}.hs-v4-consult-label{display:block;font-size:12px;font-weight:900;margin-bottom:5px}.hs-v4-consult-input{width:100%;min-height:44px;border:1px solid #33476c;background:#090f19;color:#fff;border-radius:10px;padding:9px 10px;font-size:16px}.hs-v4-consult-help{display:block;margin-top:4px;color:#9fb0c8;font-size:10px;line-height:1.45}.hs-v4-consult-preview{margin-top:8px;border:1px solid #30445b;border-radius:11px;background:#09111c;padding:9px}.hs-v4-consult-preview p{margin:0;font-size:11px;line-height:1.55}.hs-v4-consult-actions{display:flex;align-items:center;gap:8px;margin-top:7px}.hs-v4-consult-copy{border:0;border-radius:10px;background:#f2c45f;color:#17130a;font-weight:900;padding:8px 12px}.hs-v4-consult-state{font-size:10px;color:#7fe0aa}.hs-v4-look,.hs-v4-audit-group{border-top:1px solid #283754;padding:8px 0}.hs-v4-look:first-child,.hs-v4-audit-group:first-child{border-top:0}.hs-v4-kv{display:grid;grid-template-columns:88px 1fr;gap:8px;margin-top:5px;font-size:11px}.hs-v4-kv span:first-child{color:#8f9db2}.hs-v4-strategy-section{margin-top:10px}.hs-v4-strategy-section h4{margin:0 0 6px;font-size:13px}.hs-v4-strategy-line,.hs-v4-ev-line{border-top:1px solid #283754;padding:7px 0;font-size:11px;line-height:1.5}.hs-v4-strategy-line:first-of-type,.hs-v4-ev-line:first-of-type{border-top:0}.hs-v4-strategy-line strong,.hs-v4-ev-line strong{display:block}.hs-v4-source-list a{color:#aac7ff;overflow-wrap:anywhere}.hs-v4-detail-details{margin-top:8px}.hs-v4-detail-details summary{min-height:40px;display:flex;align-items:center;cursor:pointer;color:#cbd7e8;font-size:11px;font-weight:800}.hs-v4-detail-bottom{width:100%;margin-top:10px;border:1px solid #33476c;border-radius:11px;background:#1b2942;color:#fff;font-weight:900}.hs-v4-audit-line{display:flex;justify-content:space-between;gap:8px;margin-top:5px;font-size:10px}.hs-v4-audit-line span:last-child{color:#95a4ba}.hs-v4-detail-warning{padding:8px;border:1px dashed #684e24;border-radius:10px;color:#f2c474;font-size:10px;line-height:1.5}
@media(max-width:560px){.hs-v4-detail-card{padding:10px;border-radius:15px}.hs-v4-detail-hero{display:block}.hs-v4-badges{justify-content:flex-start;margin-top:7px}.hs-v4-detail-title{font-size:19px}.hs-v4-kv{grid-template-columns:76px 1fr}.hs-v4-detail-block{padding:10px}}
`;
  doc.head.appendChild(style);
}

function addBadge(doc,box,text,status='unknown'){
  const span=doc.createElement('span'); span.className=`hs-v4-badge ${badgeClass(status)}`; span.textContent=text; box.appendChild(span);
}
function clear(node){while(node.firstChild) node.firstChild.remove();}
function make(doc,tag,cls,text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}

function renderScreening(doc,box,model){
  clear(box); const screening=model.screening;
  if(!screening){box.append(make(doc,'p','hs-v4-muted','一次足切り情報なし'));return;}
  if(!screening.ruleSets?.length){box.append(make(doc,'p','hs-v4-muted',screening.status==='unset'?'一次足切り未設定':'一次足切り条件なし'));return;}
  const counters=new Map((model.strategy?.counterDefinitions??[]).map(x=>[x.counterId,x]));
  const looks=new Map((model.lookGuide?.items??[]).map(x=>[x.itemId,x]));
  for(const rs of screening.ruleSets){
    const group=make(doc,'div','hs-v4-rule');
    const head=make(doc,'div','hs-v4-rule-head');
    head.append(make(doc,'strong','',rs.logic),make(doc,'span','',rs.appliesTo?.exchangeCondition??'交換条件指定なし')); group.append(head);
    if(!rs.conditions?.length){group.append(make(doc,'div','hs-v4-condition','条件なし（NONE）'));box.append(group);continue;}
    rs.conditions.forEach((c,i)=>{
      const item=make(doc,'div','hs-v4-condition'); item.append(make(doc,'strong','',`${i+1}. ${conditionText(c)}`));
      const meta=make(doc,'div','hs-v4-condition-meta');
      const counter=c.strategyCounterId?counters.get(c.strategyCounterId):null;
      const look=c.lookGuideItemId?looks.get(c.lookGuideItemId):null;
      const codes=[`metric: ${c.metric}`,counter?`counter: ${counter.label}`:'counter: 未接続',look?`見る場所: ${look.displayLocation??look.label}`:'見る場所: 未接続'];
      for(const s of codes) meta.append(make(doc,'code','',s)); item.append(meta); group.append(item);
    }); box.append(group);
  }
}

function renderConsultation(doc,box,model){
  clear(box); const spec=model.consultationSpec; const inputs=new Map();
  box.append(make(doc,'p','hs-v4-consult-note','写真は不要です。分からない項目は空欄でOK。コピー時は「不明」と入ります。'));
  let exchange=null;
  if(spec.needsExchangeCondition){
    const wrap=make(doc,'label','hs-v4-consult-field'); wrap.append(make(doc,'span','hs-v4-consult-label','交換条件'));
    exchange=make(doc,'select','hs-v4-consult-input'); const u=make(doc,'option','', '不明');u.value='';exchange.append(u);
    for(const opt of spec.exchangeConditionOptions){const o=make(doc,'option','',opt);o.value=opt;exchange.append(o);} wrap.append(exchange);box.append(wrap);
  }
  if(!spec.fields.length){
    const msg=spec.screeningMode==='unset'?'一次足切り未設定。確認値の入力項目はありません。':spec.screeningMode==='none'?'一次足切り条件なし。確認値の入力項目はありません。':'確認値の入力項目はありません。';
    box.append(make(doc,'p','hs-v4-muted',msg));
  }
  for(const f of spec.fields){
    const wrap=make(doc,'label','hs-v4-consult-field'); wrap.append(make(doc,'span','hs-v4-consult-label',f.label));
    const input=make(doc,'input','hs-v4-consult-input'); input.type='text';input.autocomplete='off';input.placeholder='不明';if(['G','pt','回','枚','人'].includes(f.unit))input.inputMode='decimal';wrap.append(input);
    const where=f.lookItem?[f.lookItem.displayLocation,f.lookItem.operation].filter(Boolean).join(' / '):'';
    wrap.append(make(doc,'small','hs-v4-consult-help',where?`見る場所：${where}`:'見る場所：未登録（推測しません）'));
    inputs.set(f.key,input);box.append(wrap);
  }
  const preview=make(doc,'div','hs-v4-consult-preview'); const text=make(doc,'p',''); preview.append(text);
  const actions=make(doc,'div','hs-v4-consult-actions'); const copy=make(doc,'button','hs-v4-consult-copy','相談文をコピー');copy.type='button';const state=make(doc,'span','hs-v4-consult-state','');state.setAttribute('aria-live','polite');actions.append(copy,state);preview.append(actions);box.append(preview);
  const update=()=>{state.textContent='';const values=Object.fromEntries([...inputs].map(([k,input])=>[k,input.value]));text.textContent=buildConsultationText({storeName:model.store?.name,spec,values,exchangeCondition:exchange?.value??''});};
  for(const input of inputs.values()) input.addEventListener('input',update);exchange?.addEventListener('input',update);update();
  copy.addEventListener('click',async()=>{
    const value=text.textContent; const nav=doc.defaultView?.navigator;
    try{if(!nav?.clipboard?.writeText)throw new Error('clipboard unavailable');await nav.clipboard.writeText(value);state.textContent='コピーしました';}
    catch{const ta=doc.createElement('textarea');ta.value=value;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';doc.body.append(ta);ta.select();let ok=false;try{ok=doc.execCommand('copy');}catch{}ta.remove();state.textContent=ok?'コピーしました':'長押しでコピーしてください';}
    doc.defaultView?.setTimeout?.(()=>{state.textContent='';},1800);
  });
}

function renderLook(doc,box,model){
  clear(box);
  if(model.missingLinkedLookIds.length){box.append(make(doc,'p','hs-v4-detail-warning',`参照先未解決: ${model.missingLinkedLookIds.join(', ')}`));}
  if(!model.linkedLookItems.length){box.append(make(doc,'p','hs-v4-muted','一次足切りから明示接続された「見る場所」はありません。推測表示しません。'));return;}
  for(const item of model.linkedLookItems){
    const wrap=make(doc,'div','hs-v4-look');wrap.append(make(doc,'strong','',item.label));
    for(const [k,v] of [['場所',item.displayLocation],['操作',item.operation],['前任者分',item.recoverability],['状態',STATUS_LABEL[item.status]??item.status]]){
      const row=make(doc,'div','hs-v4-kv');row.append(make(doc,'span','',k),make(doc,'span','',safe(v)));wrap.append(row);
    }
    if(item.note)wrap.append(make(doc,'p','hs-v4-muted',item.note));box.append(wrap);
  }
}

function renderStrategy(doc,box,model){
  clear(box);const st=model.strategy;
  if(!st){box.append(make(doc,'p','hs-v4-muted','攻略情報なし'));return;}
  if(st.strategyType==='unverified'){box.append(make(doc,'p','hs-v4-muted','安全に移行できた攻略情報がありません。'));return;}
  const sections=[];
  sections.push(['天井・到達条件',(st.ceilings??[]).map(x=>({title:x.name,body:`${safe(x.threshold)} → ${safe(x.result)}`}))]);
  sections.push(['短縮条件',(st.shortenings??[]).map(x=>({title:safe(x.trigger),body:safe(x.effect)}))]);
  sections.push(['やめ時',(st.stopRules??[]).map(x=>({title:safe(x.timing),body:safe(x.action)}))]);
  for(const [title,rows] of sections){
    const sec=make(doc,'div','hs-v4-strategy-section');sec.append(make(doc,'h4','',title));
    if(!rows.length)sec.append(make(doc,'p','hs-v4-muted','登録なし'));
    for(const x of rows){const line=make(doc,'div','hs-v4-strategy-line');line.append(make(doc,'strong','',x.title),make(doc,'span','',x.body));sec.append(line);}box.append(sec);
  }
  const ev=make(doc,'div','hs-v4-strategy-section');ev.append(make(doc,'h4','','期待値根拠（登録済みのみ）'));
  if(!(st.expectedValueEvidence??[]).length)ev.append(make(doc,'p','hs-v4-muted','登録された期待値金額なし'));
  for(const x of st.expectedValueEvidence??[]){
    const line=make(doc,'div','hs-v4-ev-line');line.append(make(doc,'strong','',`${safe(x.conditionLabel)}｜${yen(x.expectedValueYen)}`));
    line.append(make(doc,'span','hs-v4-muted',`交換: ${safe(x.exchangeCondition,'不明')} / 貸出: ${x.rate==='unknown'?'不明':safe(x.rate)} / 確認日: ${safe(x.checkedAt)}`));
    if(x.sourceUrl){const a=make(doc,'a','', '出典を開く ↗');a.href=x.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';line.append(doc.createElement('br'),a);}ev.append(line);
  }box.append(ev);
  const defs=make(doc,'details','hs-v4-detail-details');defs.append(make(doc,'summary','',`カウンター定義 ${(st.counterDefinitions??[]).length}件`));
  for(const c of st.counterDefinitions??[]){const line=make(doc,'div','hs-v4-strategy-line');line.append(make(doc,'strong','',c.label),make(doc,'span','',c.meaning));defs.append(line);}box.append(defs);
  const sources=make(doc,'details','hs-v4-detail-details hs-v4-source-list');sources.append(make(doc,'summary','',`攻略出典 ${(st.sourceLinks??[]).length}件`));
  for(const s of st.sourceLinks??[]){const line=make(doc,'div','hs-v4-strategy-line');const a=make(doc,'a','',s.label??'出典');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';line.append(a);sources.append(line);}if(st.note)sources.append(make(doc,'p','hs-v4-muted',st.note));box.append(sources);
}

function renderAudit(doc,box,model){
  clear(box);
  for(const [label,audit] of [['機種',model.machineAudit],['設置',model.installationAudit]]){
    const group=make(doc,'div','hs-v4-audit-group');group.append(make(doc,'strong','',label));
    if(!audit){group.append(make(doc,'p','hs-v4-muted','監査情報なし'));box.append(group);continue;}
    for(const c of audit.checks??[]){const line=make(doc,'div','hs-v4-audit-line');line.append(make(doc,'span','',`${c.kind}: ${STATUS_LABEL[c.status]??c.status}`),make(doc,'span','',safe(c.checkedAt)));group.append(line);}box.append(group);
  }
}

export function createV4SlotDetailPanel({document:doc,onBack}={}){
  if(!doc) throw new TypeError('document is required');ensureStyle(doc);
  const shell=doc.createElement('section');shell.className='hs-v4-detail-shell';shell.hidden=true;shell.dataset.v4SlotDetail='enabled';
  shell.innerHTML=`<div class="hs-v4-detail-nav"><button type="button" class="hs-v4-detail-back">← 機種一覧へ</button><span class="hs-v4-detail-rate">—</span></div><article class="hs-v4-detail-card"><div class="hs-v4-detail-hero"><div><p class="hs-v4-detail-kicker">—</p><h2 class="hs-v4-detail-title">—</h2></div><div class="hs-v4-badges"></div></div><section class="hs-v4-detail-block emphasis"><div class="hs-v4-detail-heading"><span>一次足切り</span><small>相談ライン</small></div><div data-hs-detail-screening></div></section><section class="hs-v4-detail-block consult"><div class="hs-v4-detail-heading"><span>ChatGPTに相談</span><small>短い文字入力</small></div><div data-hs-detail-consult></div></section><section class="hs-v4-detail-block"><div class="hs-v4-detail-heading"><span>どこを見るか</span><small>明示接続のみ</small></div><div data-hs-detail-look></div></section><section class="hs-v4-detail-block"><div class="hs-v4-detail-heading"><span>攻略情報</span></div><div data-hs-detail-strategy></div></section><details class="hs-v4-detail-block"><summary>監査状態（必要時だけ確認）</summary><div data-hs-detail-audit></div></details><button type="button" class="hs-v4-detail-bottom">機種一覧へ戻る</button></article>`;
  const goBack=()=>{if(typeof onBack==='function')onBack();};
  shell.querySelector('.hs-v4-detail-back').addEventListener('click',goBack);shell.querySelector('.hs-v4-detail-bottom').addEventListener('click',goBack);
  function show(model){
    if(!model)throw new Error('detail model is required');
    shell.querySelector('.hs-v4-detail-rate').textContent=model.rateLabel;shell.querySelector('.hs-v4-detail-kicker').textContent=model.store?.name??model.installation.storeId;shell.querySelector('.hs-v4-detail-title').textContent=model.machine.name;
    const badges=shell.querySelector('.hs-v4-badges');clear(badges);addBadge(doc,badges,STATUS_LABEL[model.screening?.status]??model.screening?.status??'不明',model.screening?.status??'unknown');addBadge(doc,badges,`見る場所 ${STATUS_LABEL[model.lookGuide?.status]??model.lookGuide?.status??'不明'}`,model.lookGuide?.status??'unknown');addBadge(doc,badges,STATUS_LABEL[model.strategy?.strategyType]??model.strategy?.strategyType??'攻略不明','unknown');
    renderScreening(doc,shell.querySelector('[data-hs-detail-screening]'),model);renderConsultation(doc,shell.querySelector('[data-hs-detail-consult]'),model);renderLook(doc,shell.querySelector('[data-hs-detail-look]'),model);renderStrategy(doc,shell.querySelector('[data-hs-detail-strategy]'),model);renderAudit(doc,shell.querySelector('[data-hs-detail-audit]'),model);
    shell.hidden=false;return model;
  }
  function hide(){shell.hidden=true;}
  return Object.freeze({element:shell,show,hide,isOpen:()=>!shell.hidden});
}
