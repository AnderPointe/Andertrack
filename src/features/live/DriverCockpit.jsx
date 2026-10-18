import React,{useEffect,useMemo,useState} from 'react';
import {
  Activity, ArrowRight, Banknote, BatteryCharging, CalendarClock, CheckCircle2,
  Clock3, Compass, DollarSign, FileCheck2, HeartPulse, LockKeyhole, MapPinned,
  Navigation, PackageCheck, Radio, Route, ShieldAlert, ShieldCheck, Truck, Wallet,
} from 'lucide-react';
import AssignmentActions from './AssignmentActions.jsx';
import DeliveryWorkflow from './DeliveryWorkflow.jsx';
import FleetMap from './FleetMap.jsx';
import HolographicHud from './HolographicHud.jsx';
import ArcviewCinema from './ArcviewCinema.jsx';
import Vehicle3D from './Vehicle3D.jsx';
import {assignedVehicleForDriver} from '../../lib/vehicle-3d.js';
import {ClassCShiftRibbon} from './ClassCOpsDashboard.jsx';
import { cockpitCinemaAccess } from '../../lib/arcview-cinema.js';
import { validGpsPosition, freshGpsPosition } from '../../lib/operations.js';
import {
  DEMO_PEOPLE,DUTY_STATES,safeDutyLog,setDemoDutySlot,formatHrsMinutes,
  demoHosGauges,moneyTotal,visibleDriverAssignments,cockpitRouteUrl,
} from '../../lib/driver-cockpit.js';
import './driver-cockpit.css';
import {
  DutyScenarioLab, EarningsScenarioStudio, PayoutSandbox,
  JurisdictionReconciliationLab, StopVerificationLab, LiveDriverMission,
} from './DriverCockpitPro.jsx';

const fmtCash=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value||0);
const pretty=value=>String(value||'Unknown').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const DEMO_COORDS=Object.freeze({
  'sample-cdl-jameson':{latitude:31.9974,longitude:-102.0779},
  'sample-local-oliver':{latitude:32.7564,longitude:-97.3322},
  'sample-cdl-michael':{latitude:32.7459,longitude:-97.3332},
});
const EARNINGS_LABELS=Object.freeze({
  base:'Base shift / loaded mileage',stops:'Stops & delivery pay',
  detention:'Detention pay',tips:'Customer tips',bonus:'Safety / efficiency incentives',
});
const CLOCK_LABELS=['00:00','04:00','08:00','12:00','16:00','20:00','24:00'];
const DUTY_SHORT=Object.freeze({OFF:'OFF',SB:'SB',D:'D',ON:'ON'});

function DutyGrid({slots}) {
  return <div className="at-cockpit-eld" aria-label="24-hour illustrative duty-status grid">
    <div className="at-cockpit-eld-hours">
      {CLOCK_LABELS.map(x=><span key={x}>{x}</span>)}
    </div>
    {DUTY_STATES.map(state=><div className="at-cockpit-eld-row" key={state.id}>
      <span className="at-cockpit-eld-row-label">{DUTY_SHORT[state.id]}</span>
      <div className="at-cockpit-eld-track" role="img"
        aria-label={state.label+' status in 15-minute increments across 24 hours'}>
        {slots.map((slot,i)=><span key={i} style={{
          background:slot===state.id?state.color:'transparent'
        }} className={slot===state.id?'on':'off'}/>)}
      </div>
    </div>)}
    <p className="at-cockpit-note">Illustrative 15-minute log grid. Not an FMCSA-registered ELD, certified driver's record of duty status, or compliance calculation.</p>
  </div>;
}
function Gauge({label,used,max,remaining,pct}) {
  return <div className="at-cockpit-gauge">
    <div className="at-cockpit-gauge-ring" style={{'--gauge-progress':pct+'%'}}>
      <strong>{formatHrsMinutes(remaining)}</strong><small>remaining</small>
    </div>
    <span>{label}</span><small>{formatHrsMinutes(used)} sample used</small>
  </div>;
}

export default function DriverCockpit({
  assignments=[],drivers=[],vehicles=[],locations=[],role='',currentUserId='',
  profile=null,organizationId='',reload=()=>{},isDemo=false,
}) {
  const [demoId,setDemoId]=useState(DEMO_PEOPLE[0].id);
  const [dutyStatus,setDutyStatus]=useState(DEMO_PEOPLE[0].status);
  const [driveUsedMinutes,setDriveUsedMinutes]=useState(DEMO_PEOPLE[0].hos.driveUsedMinutes);
  const [simulateDrop,setSimulateDrop]=useState(false);
  const [proofReady,setProofReady]=useState(false);
  const [selectedLoadId,setSelectedLoadId]=useState('');
  const person=DEMO_PEOPLE.find(p=>p.id===demoId)||DEMO_PEOPLE[0];
  const isDriver=role==='driver';
  const cinemaAccess=cockpitCinemaAccess({isDemo,role});
  const liveAssignments=useMemo(()=>visibleDriverAssignments(assignments,role,currentUserId),
    [assignments,role,currentUserId]);
  const shipment=liveAssignments.find(a=>a.id===selectedLoadId)||liveAssignments.find(a=>a.status!=='delivered')||liveAssignments[0]||null;
  const demoCoords=DEMO_COORDS[person.id];
  const sampleLocation=cinemaAccess.sampleOnly?{
    id:person.id,driver_id:person.id,unit_number:person.unit,...demoCoords,status:person.status,
    speed_mph:38,heading:90,last_ping_at:new Date().toISOString(),
  }:null;
  const reportedGps=isDemo?sampleLocation:locations.find(p=>p.driver_id===currentUserId)||null;
  const hasGps=reportedGps&&validGpsPosition(reportedGps);
  const gpsRecent=hasGps&&freshGpsPosition(reportedGps);
  const gauges=useMemo(()=>demoHosGauges(person.hos?{
    ...person.hos,driveUsedMinutes,
    intervalDriveMinutes:Math.min(480,Math.max(0,driveUsedMinutes-56)),
  }:null),[person,driveUsedMinutes]);
  const slots=useMemo(()=>setDemoDutySlot(person.log,dutyStatus,95),[person,dutyStatus]);
  const liveMode=!isDemo;
  const cinemaSampleAssignment=cinemaAccess.sampleOnly?{
    reference:person.reference,division:person.division,customer_name:person.customer,
    pickup_address:'Sample pickup location — Fort Worth, TX',
    dropoff_address:person.address,commodity:'Illustrative delivery',
    status:'in_transit',driver_user_id:person.id,id:person.id,
  }:null;
  const detail=isDemo?{
    reference:person.reference,division:person.division,customer_name:person.customer,
    dropoff_address:person.address,status:'in_transit',driver_user_id:person.id,id:person.id,
  }:shipment;
  const driverEquipment=isDemo?{
    id:'sample-equipment:'+person.id,unit_number:person.unit,
    vehicle_type:person.role==='Local'?'cargo_van':'tractor',
  }:isDriver?assignedVehicleForDriver({
    assignments:liveAssignments,vehicles,driverUserId:currentUserId
  }):null;
  const destinationUrl=cockpitRouteUrl(detail);
  const demoEarnings=moneyTotal(person.earnings)+(simulateDrop?15:0);
  const itemizedEarnings=isDemo?{...person.earnings,stops:person.earnings.stops+(simulateDrop?15:0)}:null;
  useEffect(()=>{
    setDutyStatus(person.status);
    setDriveUsedMinutes(person.hos?.driveUsedMinutes||0);
    setSimulateDrop(false);setProofReady(false);
  },[person.id]);

  return <div className="at-cockpit">
    <section className="at-surface at-cockpit-hero">
      <div><span className="at-kicker">DRIVER EXPERIENCE · HOS / OPERATIONS</span>
        <h2><Truck size={25}/> Driver Cockpit & HOS</h2>
        <p>Unified driver workspace for assignments, duty-status integration readiness, trip telemetry and proof of delivery.</p>
        <div className="at-cockpit-tags">
          <span><ShieldCheck size={14}/>{isDemo?'SIMULATION ONLY':'RLS-PROTECTED'}</span>
          <span><Radio size={14}/> {isDemo?'Example sensor data':'Verified connectors required'}</span>
        </div>
      </div>
      {isDemo&&<label className="at-cockpit-person-select">
        <span>Sample driver cockpit</span>
        <select value={demoId} onChange={e=>setDemoId(e.target.value)}>
          {DEMO_PEOPLE.map(p=><option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
        </select>
      </label>}
    </section>

    {(isDemo?person.division==='Class C':isDriver&&drivers.some(d=>
      d.user_id===currentUserId&&d.license_class==='C'))&&
      <ClassCShiftRibbon key={'shift:'+person.id+':'+currentUserId} isDemo={isDemo}
        role={role} currentUserId={currentUserId} organizationId={organizationId}
        vehicles={vehicles} assignments={assignments} drivers={drivers}
        locations={locations} demoUnit={isDemo?person.unit:''}/>}

    {cinemaAccess.visible&&<ArcviewCinema
      key={cinemaAccess.sampleOnly ? 'cinema-sample:'+person.id : 'cinema-driver:'+currentUserId}
      isDemo={cinemaAccess.sampleOnly}
      person={cinemaAccess.sampleOnly?person:null}
      dutyStatus={cinemaAccess.sampleOnly?dutyStatus:null}
      location={cinemaAccess.sampleOnly?sampleLocation:reportedGps}
      assignment={cinemaAccess.sampleOnly?cinemaSampleAssignment:shipment}
      locked={false}/>}

    {isDemo?<div className="at-cockpit-banner"><ShieldAlert size={16}/>
      SIMULATED DATA · Every dollar, HOS clock, ECG, IFTA mile and GPS position on this screen is fictitious. No payment or legal record is created.
    </div>:<div className="at-cockpit-banner live"><ShieldCheck size={16}/>
      LIVE ACCOUNT · Unconnected telemetry, HOS, health, mileage and payroll feeds are not estimated or replaced with demo values.
    </div>}

    {!isDemo&&!isDriver&&<section className="at-surface at-cockpit-lock">
      <LockKeyhole size={24}/><div><strong>Driver account required for live cockpit</strong>
        <p>Sign in with an authorized driver account to see your own loads. Admin and dispatcher users can review shipments in the existing Dispatch Center, but cannot act as a driver or access another person's health/payroll data through this page.</p></div>
    </section>}

    <div className="at-cockpit-identity">
      <div className="at-cockpit-avatar"><Truck size={24}/></div>
      <div><span className="at-kicker">{isDemo?'EXAMPLE OPERATOR':'SIGNED-IN DRIVER'}</span>
        <strong>{isDemo?person.name:profile?.display_name||(isDriver?'Driver workspace':'Restricted access')}</strong>
        <small>{isDemo?person.subtitle:isDriver?'Your organization-authorized assignments':'Driver-only operational controls'}</small>
      </div>
      <span className="at-cockpit-current-duty">{isDemo?DUTY_STATES.find(s=>s.id===dutyStatus)?.label.toUpperCase():
        'ELD NOT CONNECTED'}</span>
    </div>

    {(isDemo||isDriver)&&<Vehicle3D key={'driver-equipment:'+(
      driverEquipment?.id||'unassigned')} vehicle={driverEquipment}
      isDemo={isDemo} title={driverEquipment?'My assigned vehicle · 3D':'Equipment showroom · unassigned'}
      allowSelection={true}/>}

    <HolographicHud key={isDemo ? 'sample-hud:'+person.id : 'driver-hud:'+currentUserId}
      isDemo={isDemo} person={isDemo?person:null} dutyStatus={isDemo?dutyStatus:null}
      location={isDemo ? sampleLocation : isDriver ? reportedGps : null}
      assignment={isDemo ? detail : isDriver ? shipment : null}
      locked={!isDemo&&!isDriver}/>

    {!isDemo&&isDriver&&<LiveDriverMission assignments={liveAssignments}
      activeAssignment={shipment} profile={profile}/>}

    <div className="at-cockpit-two-col">
      <section className="at-surface at-cockpit-panel">
        <div className="at-cockpit-panel-header">
          <div><span className="at-kicker">DUTY STATUS & FMCSA INTEGRATION READINESS</span>
            <h3><Clock3 size={19}/> Hours of Service</h3></div>
          <span className="at-cockpit-status">{isDemo?'DEMO / NONCERTIFIED':'NO VERIFIED ELD FEED'}</span>
        </div>
        {isDemo?<><div className="at-cockpit-duty-controls" role="group" aria-label="Simulated duty status">
          {DUTY_STATES.map(state=><button key={state.id} type="button"
            className={dutyStatus===state.id?'selected':''} style={{'--status-color':state.color}}
            onClick={()=>setDutyStatus(state.id)}>{state.label}</button>)}
        </div>
        {person.role==='CDL'?<>
          <div className="at-cockpit-gauges">
            {gauges.map(g=><Gauge key={g.label} {...g}/>)}
          </div>
          <label className="at-cockpit-drive-slider" htmlFor="at-cockpit-driving">
            <span>Explore sample driving-time counter</span><strong>{formatHrsMinutes(driveUsedMinutes)} used</strong>
          </label>
          <input id="at-cockpit-driving" type="range" min={0} max={660} step={5}
            value={driveUsedMinutes} onChange={e=>setDriveUsedMinutes(Number(e.target.value))}/>
          <p className="at-cockpit-note">Sample clocks only. Actual HOS uses regulatory exceptions, rest periods, rolling time windows and certified ELD records. The 8-hour interval is not a simple universal break countdown.</p>
        </>:<div className="at-cockpit-unconnected"><CalendarClock size={19}/>
          <div><strong>Local driver shift illustration</strong><p>FMCSA HOS applicability varies by vehicle and operation. No HOS compliance determination is made for this example.</p></div>
        </div>}
        <DutyGrid slots={slots}/>
        <DutyScenarioLab key={person.id} person={person} baseSlots={slots}/>
        </>:<div className="at-cockpit-unconnected"><Clock3 size={23}/>
          <div><strong>No certified ELD integration connected</strong><p>Real clocks and status changes are intentionally unavailable. Connect a supported certified ELD and sync authenticated driving, duty and cycle events before enabling controls.</p></div>
        </div>}
      </section>

      <section className="at-surface at-cockpit-panel">
        <div className="at-cockpit-panel-header"><div>
          <span className="at-kicker">DRIVER WELLNESS / OPTIONAL WEARABLE</span>
          <h3><HeartPulse size={19}/> Cabin & driver vitals</h3></div>
          <span className="at-cockpit-status">{isDemo?'SIMULATED':'NOT CONNECTED'}</span>
        </div>
        {isDemo?<><div className="at-cockpit-vitals">
          <div><span>Heart rate</span><strong>{person.vitals.heartRate}<small> BPM</small></strong></div>
          <div><span>Oxygen saturation</span><strong>{person.vitals.spo2}<small> % SpO₂</small></strong></div>
          <div><span>Example alertness</span><strong>{person.vitals.alertness}<small> / 100</small></strong></div>
          <div><span>Example safety score</span><strong>{person.vitals.safety}<small> / 100</small></strong></div>
        </div>
        <svg className="at-cockpit-ecg" viewBox="0 0 580 75" role="img" aria-label="Illustrative ECG-style waveform, not actual biometric monitoring">
          <path d="M0 42 L70 42 L86 37 L95 44 L119 44 L131 6 L143 68 L156 28 L172 42 L244 42 L258 36 L268 44 L289 44 L301 5 L313 70 L327 30 L342 42 L421 42 L438 36 L448 44 L469 44 L481 5 L493 70 L507 30 L522 42 L580 42"
            stroke="#32d2c1" strokeWidth="2.2" fill="none" strokeLinejoin="round"/>
        </svg><p className="at-cockpit-note">Illustration only. These values do not come from a sensor, are not medical measurements, and should not be used to assess fitness to drive.</p>
        </>:<div className="at-cockpit-unconnected"><ShieldCheck size={23}/><div>
          <strong>Biometric monitoring unavailable</strong>
          <p>No wearable device, driver consent flow, health-data permission model or validated fatigue assessment is configured. No biometric collection occurs.</p></div></div>}
      </section>
    </div>

    <div className="at-cockpit-two-col">
      <section className="at-surface at-cockpit-panel">
        <div className="at-cockpit-panel-header"><div><span className="at-kicker">PAYROLL / LOCAL TIPS</span>
          <h3><Wallet size={19}/> Driver wallet & earnings</h3></div>
          <span className="at-cockpit-status">{isDemo?'FAKE BALANCES':'PAYROLL NOT CONNECTED'}</span></div>
        {isDemo?<><div className="at-cockpit-wallet-total">
          <small>Example shift earnings</small><strong>{fmtCash(demoEarnings)}</strong>
          <span>Example weekly earnings {fmtCash(person.weeklyEarnings)}</span>
        </div>
        <div className="at-cockpit-pay-list">
          {Object.entries(itemizedEarnings).map(([key,value])=><div key={key}>
            <span>{EARNINGS_LABELS[key]}</span><strong>{fmtCash(value)}</strong>
          </div>)}
        </div>
        <EarningsScenarioStudio key={person.id} earnings={itemizedEarnings}/>
        <PayoutSandbox key={'payout:'+person.id} balance={demoEarnings}/></>:<div className="at-cockpit-unconnected"><Wallet size={22}/><div>
          <strong>No verified driver payment ledger</strong><p>Shift earnings, tips, detention and bonuses require an authorized payroll source. Instant cash-out is disabled until identity verification, provider integration and payout controls are implemented.</p></div></div>}
      </section>
      <section className="at-surface at-cockpit-panel">
        <div className="at-cockpit-panel-header"><div><span className="at-kicker">TRIP DISTANCE / IFTA</span>
          <h3><Route size={19}/> Mileage & state reporting</h3></div>
          <span className="at-cockpit-status">{isDemo?'EXAMPLE LEDGER':'TELEMATICS NOT VERIFIED'}</span></div>
        {isDemo?<><div className="at-cockpit-distance">
          <div><span>Today’s recorded miles (sample)</span><strong>{person.mileage.today} <small>/ {person.mileage.planned} mi planned</small></strong></div>
          <div className="at-cockpit-progress"><span style={{width:(Math.min(100,person.mileage.today/person.mileage.planned*100))+'%'}}/></div>
          <div className="at-cockpit-mile-split">
            <div><strong>{person.mileage.loaded} mi</strong><small>Loaded miles</small></div>
            <div><strong>{person.mileage.deadhead} mi</strong><small>Deadhead miles</small></div>
            <div><strong>{person.mileage.odometer.toLocaleString()} mi</strong><small>Example odometer</small></div>
          </div>
        </div>
        <div className="at-cockpit-state-list">
          {person.mileage.states.map(([state,miles])=><div key={state}>
            <strong>{state}</strong><span className="at-cockpit-progress"><span style={{width:Math.min(100,miles/person.mileage.today*100)+'%'}}/></span><small>{miles} mi</small>
          </div>)}
        </div><p className="at-cockpit-note">Example state mileage is not an IFTA-compliant report. Verified trip distances, jurisdictions, taxable miles, fuel records and audit trails are not connected.</p>
        <JurisdictionReconciliationLab key={person.id} mileage={person.mileage}/>
        </>:<div className="at-cockpit-unconnected"><Route size={23}/><div>
          <strong>IFTA / odometer data not available</strong>
          <p>Current GPS positions alone cannot support state-by-state taxable mileage. Connect a validated odometer and jurisdiction trip ledger before reporting or filing.</p></div></div>}
      </section>
    </div>

    <div className="at-cockpit-two-col">
      <section className="at-surface at-cockpit-panel">
        <div className="at-cockpit-panel-header"><div><span className="at-kicker">DRIVER MAP / EXTERNAL ROUTING</span>
          <h3><Navigation size={19}/> Navigation & vehicle position</h3></div>
          <span className="at-cockpit-status">{isDemo?'SAMPLE GPS':'NO TURN-BY-TURN ENGINE'}</span></div>
        {isDemo?<FleetMap locations={[sampleLocation]} theme="dark"/>:
          hasGps?<FleetMap locations={[reportedGps]} theme="dark"/>:
          <div className="at-cockpit-map-placeholder"><MapPinned size={28}/>
            <strong>No authorized driver GPS feed</strong>
            <p>Only real GPS rows permitted by workspace policies can appear here. Drivers do not yet have a dedicated self-location read policy.</p>
          </div>}
        <div className="at-cockpit-nav-dest">
          <div><span>Destination</span><strong>{detail?.dropoff_address||'No assigned destination'}</strong></div>
          <div><span>Device telemetry</span><strong>{isDemo?'Sample point only':gpsRecent?'Last ping recently received':'Unavailable / stale'}</strong></div>
        </div>
        {destinationUrl?<a className="at-cockpit-action" href={destinationUrl} target="_blank" rel="noopener noreferrer">
          <Navigation size={16}/> Open directions in Google Maps <ArrowRight size={15}/></a>:
          <p className="at-cockpit-note">No valid assigned destination is available for external navigation.</p>}
        <p className="at-cockpit-note">Map is not turn-by-turn navigation, and does not know current legal speed limits, PrePass availability, truck restrictions or upcoming maneuvers. Confirm third-party routing suitability before driving. Do not interact with the screen while driving.</p>
      </section>

      <section className="at-surface at-cockpit-panel">
        <div className="at-cockpit-panel-header"><div><span className="at-kicker">CUSTOMER / PROOF OF DELIVERY</span>
          <h3><PackageCheck size={19}/> Active delivery & manifest</h3></div>
          <span className="at-cockpit-status">{isDemo?'SAMPLE DROP':'SERVER AUTHORIZED'}</span></div>
        {isDemo?<><div className="at-cockpit-manifest">
          <span className="at-kicker">{person.reference}</span><h4>{person.customer}</h4>
          <p>{person.stop}</p><div><MapPinned size={16}/>{person.address}</div>
          <small>{person.instructions}</small></div>
          <StopVerificationLab key={person.id} person={person} completed={simulateDrop}
            onReadinessChange={setProofReady}/>
          <button className="at-cockpit-action" type="button" onClick={()=>{if(proofReady)setSimulateDrop(true);}}
            disabled={simulateDrop || !proofReady}><PackageCheck size={17}/>
            {simulateDrop?'Simulated stop complete':proofReady?'Simulate verified handoff (+$15)':'Finish demo handoff checklist'} <ArrowRight size={15}/></button>
          {simulateDrop&&<div className="at-cockpit-demo-notice" role="status"><CheckCircle2 size={16}/>
            Sample stop +$15 applied to the on-screen demo only. No shipment, money, customer proof or backend record was changed.
          </div>}
          <DeliveryWorkflow isDemo assignment={detail} organizationId="demo-only"
            currentUserId="demo-only" role="admin" profile={null}/>
        </>:isDriver?<>
          {liveAssignments.length>1&&<label className="at-cockpit-load-select">My assignment
            <select value={shipment?.id||''} onChange={e=>setSelectedLoadId(e.target.value)}>
              {liveAssignments.map(a=><option key={a.id} value={a.id}>{a.reference||'Load'} · {pretty(a.status)}</option>)}
            </select></label>}
          {shipment?<><div className="at-cockpit-manifest">
            <span className="at-kicker">{shipment.reference}</span>
            <h4>{shipment.customer_name||'Delivery assignment'}</h4>
            <p>{pretty(shipment.status)}</p>
            <div><MapPinned size={16}/>{shipment.dropoff_address||'Address not recorded'}</div>
            <small>Only approved assignment records and customer notes supplied by your dispatcher are available here. No unverified gate codes are shown.</small>
          </div>
          <AssignmentActions assignment={shipment} role={role} currentUserId={currentUserId}
            profile={profile} drivers={drivers} vehicles={vehicles} onChanged={reload}/>
          <DeliveryWorkflow key={organizationId+':'+shipment.id} assignment={shipment}
            organizationId={organizationId} currentUserId={currentUserId}
            role={role} profile={profile} onChanged={reload}/>
          </>:<div className="at-cockpit-unconnected"><PackageCheck size={20}/><div>
            <strong>No assigned deliveries</strong><p>Accepted loads and their server-authorized ePOD controls appear here when available.</p></div></div>}
        </>:<div className="at-cockpit-unconnected"><LockKeyhole size={20}/><div>
          <strong>Driver-only delivery controls</strong>
          <p>Administrators must use the dispatch page; they cannot capture proofs as another driver.</p></div></div>}
      </section>
    </div>
    <footer className="at-cockpit-footer"><ShieldCheck size={15}/>
      {isDemo?'Everything shown is illustrative and nonpersistent.':
        'Only verified driver assignments and existing authorized dispatch/ePOD actions are active; all other integrations remain disabled.'}
    </footer>
  </div>;
}
