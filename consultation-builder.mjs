function unitSuffix(unit){
  if(!unit) return '';
  const u=String(unit).trim();
  if(['none','state'].includes(u)) return '';
  if(['回','times'].includes(u)) return '回';
  if(u==='cycle') return '周期';
  return u;
}

function cleanLabel(s){
  return String(s ?? '').replace(/\s+/g,' ').trim();
}

function fieldKey(c){
  if(c.strategyCounterId) return `counter::${c.strategyCounterId}`;
  return `condition::${c.lookGuideItemId ?? 'no-look'}::${c.metric ?? 'unknown'}::${c.unit ?? ''}`;
}

function sourceLabel(condition,counter,lookItem){
  if(counter?.label) return cleanLabel(counter.label);
  if(condition?.metric==='data_counter_game') return '今日の累計G';
  if(condition?.metric==='reset_confirmed') return '設定変更確認';
  const source=cleanLabel(condition?.label || condition?.meaning);
  if(source) return source;
  if(lookItem?.label) return cleanLabel(lookItem.label);
  if(condition?.metric) return cleanLabel(condition.metric);
  return '確認項目';
}

function preferredCondition(conditions){
  const rank=u=>['G','pt','times','cycle'].includes(u)?0:['none'].includes(u)?1:2;
  return conditions.slice().sort((a,b)=>rank(a.unit)-rank(b.unit))[0] ?? null;
}

function screeningMode(screening){
  if(!screening || screening.status==='unset') return 'unset';
  const sets=screening.ruleSets ?? [];
  if(sets.length && sets.every(rs=>rs.logic==='NONE' && !(rs.conditions ?? []).length)) return 'none';
  if(!sets.length) return 'none';
  return 'conditions';
}

function addDailyJugglerFields(fields,seen,lookItem){
  const defs=[
    ['daily_data_counter::total_game','今日の累計G','G','data_counter_game'],
    ['daily_data_counter::bb_count','BB回数','回','custom'],
    ['daily_data_counter::reg_count','REG回数','回','custom']
  ];
  for(const [key,label,unit,metric] of defs){
    if(seen.has(key)) continue;
    seen.add(key);
    fields.push(Object.freeze({
      key,label,unit,metric,observability:'direct',lookItem,
      sourceConditionLabel:'店舗データカウンターの当日データ'
    }));
  }
}

export function buildConsultationSpec(row){
  const screening=row?.screening;
  const strategy=row?.strategy;
  const lookGuide=row?.lookGuide;
  const counters=new Map((strategy?.counterDefinitions ?? []).map(x=>[x.counterId,x]));
  const looks=new Map((lookGuide?.items ?? []).map(x=>[x.itemId,x]));
  const fields=[];
  const seen=new Set();
  const exchangeConditions=new Set();
  const grouped=new Map();
  let hasDailyJugglerData=false;

  for(const rs of screening?.ruleSets ?? []){
    if(rs?.appliesTo?.exchangeCondition) exchangeConditions.add(rs.appliesTo.exchangeCondition);
    for(const c of rs.conditions ?? []){
      if(c.lookGuideItemId==='daily_data_counter') hasDailyJugglerData=true;
      const key=fieldKey(c);
      if(!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key).push(c);
    }
  }

  if(hasDailyJugglerData){
    const lookItem=looks.get('daily_data_counter') ?? null;
    addDailyJugglerFields(fields,seen,lookItem);
  }

  for(const [key,conditions] of grouped){
    const first=preferredCondition(conditions);
    if(!first) continue;
    // The Juggler daily counter is expanded into cumulative G / BB / REG above.
    if(first.lookGuideItemId==='daily_data_counter') continue;
    if(seen.has(key)) continue;
    seen.add(key);
    const counter=first.strategyCounterId ? counters.get(first.strategyCounterId) ?? null : null;
    const explicitLookIds=[...new Set(conditions.map(c=>c.lookGuideItemId).filter(Boolean))];
    const lookItem=explicitLookIds.length===1 ? looks.get(explicitLookIds[0]) ?? null : null;
    fields.push(Object.freeze({
      key,
      label:sourceLabel(first,counter,lookItem),
      unit:unitSuffix(first.unit),
      metric:first.metric,
      observability:first.observability ?? null,
      lookItem,
      sourceConditionLabel:first.label ?? first.meaning ?? null
    }));
  }

  return Object.freeze({
    machineName:row?.machine?.name ?? '機種不明',
    rate:row?.installation?.rate ?? 'unknown',
    screeningStatus:screening?.status ?? 'unset',
    screeningMode:screeningMode(screening),
    fields:Object.freeze(fields),
    needsExchangeCondition:exchangeConditions.size>0,
    exchangeConditionOptions:Object.freeze([...exchangeConditions])
  });
}

export function formatConsultationValue(raw, unit=''){
  const v=String(raw ?? '').trim();
  if(!v) return '不明';
  if(!unit) return v;
  if(v.endsWith(unit)) return v;
  return `${v}${unit}`;
}

export function buildConsultationText({storeName,spec,values={},exchangeCondition=''}){
  const head=[storeName || '店舗不明',spec.machineName,spec.rate==='unknown'?'レート不明':`${spec.rate}円/枚`].join(' ');
  const parts=[];
  if(spec.needsExchangeCondition) parts.push(`交換条件 ${String(exchangeCondition ?? '').trim() || '不明'}`);
  for(const f of spec.fields){
    parts.push(`${f.label} ${formatConsultationValue(values[f.key],f.unit)}`);
  }
  if(!spec.fields.length){
    if(spec.screeningMode==='unset') parts.push('一次足切り未設定');
    else if(spec.screeningMode==='none') parts.push('一次足切り条件なし');
    else parts.push('確認項目なし');
  }
  return `${head} ${parts.join(' ')}`.replace(/\s+/g,' ').trim();
}
