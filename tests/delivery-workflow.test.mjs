import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryCapabilities,validateEvidencePhoto,MAX_EVIDENCE_BYTES } from '../src/lib/delivery-guards.js';

const assignment={
 id:'shipment1',organization_id:'org1',driver_user_id:'driver1',
 division:'Class C',status:'at_pickup',
};
const opts=(changes={})=>({
 assignment, organizationId:'org1',userId:'driver1',
 role:'driver',verified:true,isDemo:false,...changes,
});
test('only an assigned driver can operate package custody actions',()=>{
 const allowed=deliveryCapabilities(opts());
 assert.equal(allowed.canView,true);
 assert.equal(allowed.canReadManifest,true);
 assert.equal(allowed.canScanPickup,true);
 assert.equal(allowed.canScanDelivery,false);
 assert.equal(allowed.canConfirmDelivery,false);
 for(const role of ['dispatcher','admin']){
   const p=deliveryCapabilities(opts({role}));
   assert.equal(p.canView,true);
   assert.equal(p.canScanPickup,false);
   assert.equal(p.canScanDelivery,false);
   assert.equal(p.canConfirmDelivery,false);
 }
 const outsider=deliveryCapabilities(opts({userId:'different'}));
 assert.equal(outsider.canView,false);
 assert.equal(outsider.canScanPickup,false);
 assert.equal(deliveryCapabilities(opts({isDemo:true})).canView,false);
 assert.equal(deliveryCapabilities(opts({organizationId:''})).canView,false);
});
test('courier delivery state allows a scan and verified-driver proof',()=>{
 const p=deliveryCapabilities(opts({assignment:{...assignment,status:'in_transit'}}));
 assert.equal(p.canScanDelivery,true);
 assert.equal(p.canScanPickup,false);
 assert.equal(p.canConfirmDelivery,true);
 assert.equal(deliveryCapabilities(opts({assignment:{...assignment,status:'in_transit'},verified:false})).canConfirmDelivery,false);
});
test('CDL freight delivery accepts proof without package scans',()=>{
 const p=deliveryCapabilities(opts({assignment:{...assignment,division:'CDL',status:'in_transit'}}));
 assert.equal(p.canView,true);
 assert.equal(p.canReadManifest,false);
 assert.equal(p.canScanDelivery,false);
 assert.equal(p.canConfirmDelivery,true);
});
test('delivered cargo is read-only, and unsupported statuses show no workflow',()=>{
 const complete=deliveryCapabilities(opts({assignment:{...assignment,status:'delivered'}}));
 assert.equal(complete.canView,true);
 assert.equal(complete.canConfirmDelivery,false);
 assert.equal(complete.canScanPickup,false);
 const notReady=deliveryCapabilities(opts({assignment:{...assignment,status:'offered'}}));
 assert.equal(notReady.canView,false);
});
test('private evidence photo validation enforces MIME and 10MiB maximum',()=>{
 assert.equal(validateEvidencePhoto(null),'Attach a delivery photo.');
 assert.equal(validateEvidencePhoto({type:'image/jpeg',size:1}),'');
 assert.equal(validateEvidencePhoto({type:'image/webp',size:MAX_EVIDENCE_BYTES}),'');
 assert.equal(validateEvidencePhoto({type:'image/png',size:500}),'');
 assert.match(validateEvidencePhoto({type:'image/svg+xml',size:500}),/JPEG/);
 assert.match(validateEvidencePhoto({type:'image/png',size:MAX_EVIDENCE_BYTES+1}),/10 MB/);
 assert.match(validateEvidencePhoto({type:'image/jpeg',size:0}),/JPEG/);
});
