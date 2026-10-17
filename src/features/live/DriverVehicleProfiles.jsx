import React,{useMemo,useState} from 'react';
import {ArrowRight,Search,ShieldCheck,Truck,UserRound,Users} from 'lucide-react';
import Vehicle3D from './Vehicle3D.jsx';
import {dispatcherDriverProfiles,vehicleDisplay} from '../../lib/vehicle-3d.js';
import './modern-operations.css';

export default function DriverVehicleProfiles({drivers=[],vehicles=[],assignments=[],isDemo=false}) {
  const [driverId,setDriverId]=useState('');
  const [query,setQuery]=useState('');
  const rows=useMemo(()=>dispatcherDriverProfiles({drivers,vehicles,assignments}),[drivers,vehicles,assignments]);
  const filtered=rows.filter(row=>[row.driver.display_name,row.vehicle?.unit_number,
    row.vehicle?.make,row.vehicle?.model].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const selected=filtered.find(row=>row.driver.user_id===driverId)||filtered[0]||null;
  const data=vehicleDisplay(selected?.vehicle);
  return <section className="at-modern at-driver-equipment-profiles">
    <div className="at-modern-section-title"><div><span>CONNECTED FLEET / DISPATCH PROFILES</span>
      <h2>Driver & vehicle 3D profiles</h2>
      <p>Select an authorized driver to inspect assigned equipment and a rotatable generic 3D vehicle.</p></div>
      <span className="at-modern-pill"><Users size={14}/>{rows.length} profiles</span></div>
    <div className="at-modern-profile-grid">
      <div className="at-modern-profile-list">
        <label className="at-modern-search"><Search size={16}/>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Search driver, unit or manufacturer" aria-label="Search driver and equipment profiles"/></label>
        {filtered.map(({driver,vehicle,activeLoads})=><button key={driver.user_id}
          className={'at-modern-profile-row '+(selected?.driver.user_id===driver.user_id?'selected':'')}
          onClick={()=>setDriverId(driver.user_id)}>
          <span className="at-modern-profile-avatar"><UserRound size={20}/></span>
          <span><strong>{driver.display_name||'Unnamed driver'}</strong><small>
            {vehicle?.unit_number||'No recorded active vehicle'} · {vehicle?vehicleDisplay(vehicle).title:'Unassigned'}
          </small></span>
          <span className="at-modern-profile-work">{activeLoads} active</span>
          <ArrowRight size={16}/></button>)}
        {!filtered.length&&<div className="at-modern-empty"><Users size={27}/>No matching drivers or assigned units.</div>}
      </div>
      <div className="at-modern-profile-detail">
        {selected?<><div className="at-modern-profile-detail-head">
          <span className="at-modern-profile-avatar"><UserRound size={25}/></span>
          <div><strong>{selected.driver.display_name||'Unnamed driver'}</strong>
            <small>License {selected.driver.license_class||'not recorded'} · {selected.driver.license_verified?'Verified':'License verification pending'}</small>
          </div><span className="at-modern-pill">{selected.driver.availability||'Unknown'}</span>
        </div>
        {selected.vehicle?<Vehicle3D key={selected.vehicle.id} vehicle={selected.vehicle}
          isDemo={isDemo} compact title="Assigned vehicle · interactive 3D"/>:
          <div className="at-modern-empty"><Truck size={29}/><strong>No active vehicle assignment</strong>
            <p>Assign equipment through the existing authorized dispatch workflow before vehicle details appear here.</p></div>}
        <p className="at-modern-footnote"><ShieldCheck size={14}/> The recorded unit is actual fleet data;
          the 3D shape is a generic class illustration until OEM model assets are supplied.</p>
        </>:<div className="at-modern-empty">No authorized driver profiles available.</div>}
      </div>
    </div>
  </section>;
}
