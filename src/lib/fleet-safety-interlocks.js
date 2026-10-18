/**
 * Phase 10: explanation-only dispatch safety screening.
 *
 * The authoritative safety hold MUST be enforced in Postgres in the same
 * transaction as assignment offer/claim/acceptance. A browser snapshot is
 * advisory and may be stale; never treat it as permission to dispatch.
 */
export const SAFETY_SNAPSHOT_STATE=Object.freeze({
  LOADING:'loading',READY:'ready',UNAVAILABLE:'unavailable',
});
export const SAFETY_REASONS=Object.freeze({
  UNKNOWN:'Fleet safety status could not be verified — do not recommend this equipment',
  HOLD:'Open out-of-service DVIR defect — dispatch safety hold',
});
export function normalizeSafetySnapshot(rows,organizationId,checkedAt=Date.now()) {
  if(!organizationId || !Array.isArray(rows)) return {
    state:SAFETY_SNAPSHOT_STATE.UNAVAILABLE,organizationId,holds:[],coveredVehicleIds:[],checkedAt:null,
  };
  const holds=[];
  const seen=new Set();
  for(const row of rows) {
    if(!row?.vehicle_id || seen.has(row.vehicle_id)) return {
      state:SAFETY_SNAPSHOT_STATE.UNAVAILABLE,organizationId,holds:[],coveredVehicleIds:[],checkedAt:null,
    };
    seen.add(row.vehicle_id);
    const count=Number(row.open_out_of_service);
    if(!Number.isSafeInteger(count)||count<0)return {
      state:SAFETY_SNAPSHOT_STATE.UNAVAILABLE,organizationId,holds:[],coveredVehicleIds:[],checkedAt:null,
    };
    if(count>0)holds.push(row.vehicle_id);
  }
  return {state:SAFETY_SNAPSHOT_STATE.READY,organizationId,holds,coveredVehicleIds:[...seen],checkedAt};
}
/**
 * Unverified / expired reads are unknown, never "clear".
 * CheckedAt is only a short-lived UI freshness signal, not dispatch authority.
 */
export function screenVehicleSafety(snapshot,vehicleId,{
  organizationId='',now=Date.now(),maxAgeMs=60000,
}={}) {
  if(!vehicleId||!snapshot||snapshot.organizationId!==organizationId||
    snapshot.state!==SAFETY_SNAPSHOT_STATE.READY ||
    !Number.isFinite(snapshot.checkedAt)||snapshot.checkedAt>now||
    now-snapshot.checkedAt>maxAgeMs) {
    return {state:'unknown',eligible:false,reason:SAFETY_REASONS.UNKNOWN};
  }
  if(!Array.isArray(snapshot.holds) || !Array.isArray(snapshot.coveredVehicleIds) ||
    !snapshot.coveredVehicleIds.includes(vehicleId))return {
    state:'unknown',eligible:false,reason:SAFETY_REASONS.UNKNOWN,
  };
  if(snapshot.holds.includes(vehicleId))return {
    state:'hold',eligible:false,reason:SAFETY_REASONS.HOLD,
  };
  return {state:'screened',eligible:true,reason:''};
}
