import { buildInstallationRow, rateLabel } from './prototype-model.mjs';
import { buildConsultationSpec } from './consultation-builder.mjs';

function freezeArray(values){
  return Object.freeze([...values]);
}

function linkedLookItemIds(screening){
  const ids=new Set();
  for(const rs of screening?.ruleSets ?? []){
    for(const condition of rs.conditions ?? []){
      if(condition.lookGuideItemId) ids.add(condition.lookGuideItemId);
    }
  }
  return ids;
}

export function buildV4SlotDetailModel(db,{storeId,machineId,rate}){
  if(!db || typeof db.getInstallationContext!=='function') throw new TypeError('db must be a HALL SCAN data store');
  const context=db.getInstallationContext(storeId,machineId,rate);
  if(!context) return null;
  const row=buildInstallationRow(db,context.installation);
  if(!row) return null;
  const explicitIds=linkedLookItemIds(row.screening);
  const linkedLookItems=(row.lookGuide?.items ?? []).filter(item=>explicitIds.has(item.itemId));
  const missingLinkedLookIds=[...explicitIds].filter(id=>!(row.lookGuide?.items ?? []).some(item=>item.itemId===id));
  const consultationSpec=buildConsultationSpec(row);
  return Object.freeze({
    store:context.store,
    installation:context.installation,
    machine:context.machine,
    screening:context.screening,
    strategy:context.strategy,
    lookGuide:context.lookGuide,
    machineAudit:context.machineAudit,
    installationAudit:context.installationAudit,
    consultationSpec,
    linkedLookItems:freezeArray(linkedLookItems),
    missingLinkedLookIds:freezeArray(missingLinkedLookIds),
    rateLabel:rateLabel(context.installation.rate)
  });
}

export function detailKey({storeId,machineId,rate}){
  return `${storeId}|${machineId}|${String(rate)}`;
}
