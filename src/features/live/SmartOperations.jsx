import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock3, Command, MapPin,
  Package, Radio, Search, ShieldCheck, Sparkles, Truck, UserRound, X,
} from 'lucide-react';

const ICONS={queue:Clock3,load:Package,gps:Radio,driver:UserRound};
function timeText(value) {
  if(!value) return 'Status-based signal';
  const n=Date.parse(value);
  return Number.isFinite(n) ? new Date(n).toLocaleString() : 'Unknown timestamp';
}

export function AlertList({alerts=[],activity=[],snoozes={},onNavigate=()=>{},onSnooze=()=>{},
  onRestore=()=>{},showAll=false,isDemo=false,heading='Intelligence feed'}) {
  const [tab,setTab]=useState('alerts');
  const [includeSnoozed,setIncludeSnoozed]=useState(false);
  const active=alerts.filter(a=>!snoozes[a.id] || snoozes[a.id] <= Date.now());
  const visible=includeSnoozed ? alerts : active;
  const displayed=showAll?visible:visible.slice(0,5);
  const displayedActivity=showAll?activity:activity.slice(0,5);
  return <section className="at-surface at-insights" aria-label={heading}>
    <div className="at-insights-head"><div>
      <span className="at-kicker">RULE-BASED OPERATIONAL INTELLIGENCE</span>
      <h2><Sparkles size={19}/> {heading}</h2>
    </div><span className={'at-insight-counter '+(active.length?'has-alerts':'')}>
      {active.length} {active.length===1?'signal':'signals'}</span></div>
    <div className="at-insights-tabs">
      <button type="button" className={tab==='alerts'?'active':''} onClick={()=>setTab('alerts')}>
        <AlertTriangle size={15}/> Needs attention
      </button>
      <button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>
        <Activity size={15}/> Recent activity
      </button>
      {tab==='alerts'&&alerts.length>active.length&&<label className="at-snooze-toggle">
        <input type="checkbox" checked={includeSnoozed} onChange={e=>setIncludeSnoozed(e.target.checked)}/> Show snoozed
      </label>}
    </div>
    {tab==='alerts'? <>
      {displayed.length===0?<div className="at-intelligence-empty"><CheckCircle2 size={26}/>
        <strong>No operational signals to review</strong>
        <span>Heuristic alerts appear when visible records cross a configured threshold. This does not certify operational compliance.</span>
      </div>:<div className="at-intelligence-list">{displayed.map(alert=>{
        const Icon=ICONS[alert.kind]||AlertTriangle;
        const isSnoozed=Number(snoozes[alert.id])>Date.now();
        return <article key={alert.id} className={'at-intelligence-item at-severity-'+alert.severity}>
          <span className="at-intelligence-icon"><Icon size={18}/></span>
          <div className="at-intelligence-copy">
            <div className="at-intelligence-label"><strong>{alert.title}</strong><span>{isSnoozed?'SNOOZED':alert.severity==='high'?'HIGH':'REVIEW'}</span></div>
            <p>{alert.detail}</p>
            <small>{timeText(alert.createdAt)}{isDemo?' · DEMO SIGNAL':''}</small>
            <div className="at-insight-actions">
              <button type="button" onClick={()=>onNavigate(alert)}>
                Review <ArrowRight size={14}/>
              </button>
              {isSnoozed?
                <button type="button" className="muted" onClick={()=>onRestore(alert.id)}>Restore alert</button>:
                <button type="button" className="muted" onClick={()=>onSnooze(alert.id)}>Snooze 30m</button>}
            </div>
          </div>
        </article>;
      })}</div>}
      {!showAll&&visible.length>5&&<p className="at-intelligence-more">{visible.length-5} more alerts in Smart Operations</p>}
    </>:<>
      {displayedActivity.length===0?<div className="at-intelligence-empty"><Activity size={26}/><strong>No recent signals</strong>
        <span>Assignment creation, queue requests and reported location pings will appear as source records become available.</span></div>:
        <div className="at-activity-feed">{displayedActivity.map(item=>{
          const Icon=ICONS[item.kind]||Activity;
          return <button type="button" onClick={()=>onNavigate(item)} key={item.id} className="at-activity-item">
            <span className="at-intelligence-icon"><Icon size={17}/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span>
            <time dateTime={item.at}>{timeText(item.at)}</time><ArrowRight size={15}/>
          </button>;
        })}</div>}
    </>}
    <p className="at-insights-disclaimer">
      <ShieldCheck size={14}/> Review suggestions only. Data comes from your visible organization records; no AI forecasts or compliance decisions.
    </p>
  </section>;
}

export function AlertDrawer({open,alerts=[],activity=[],snoozes={},onNavigate,onClose,onSnooze,onRestore,isDemo}) {
  useEffect(()=>{
    if(!open)return;
    const handler=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[open,onClose]);
  if(!open)return null;
  return <div className="at-overlay at-alert-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <aside className="at-alert-drawer" role="dialog" aria-modal="true" aria-label="Operational alerts">
      <div className="at-drawer-head"><div><span className="at-kicker">LIVE INTELLIGENCE</span><h2>Operations signals</h2></div>
        <button type="button" onClick={onClose} aria-label="Close alerts"><X size={20}/></button></div>
      <AlertList heading="Attention queue" showAll alerts={alerts} activity={activity} snoozes={snoozes}
        onNavigate={a=>{onNavigate(a);onClose();}} onSnooze={onSnooze} onRestore={onRestore} isDemo={isDemo}/>
    </aside>
  </div>;
}

export function CommandPalette({open,onClose,onNavigate,assignments=[],drivers=[],pages=[]}) {
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState(0);
  const ref=useRef(null);
  useEffect(()=>{
    if(open){setQuery('');setSelected(0);ref.current?.focus();}
  },[open]);
  const results=useMemo(()=>{
    const commands=[
      ...pages.map(p=>({id:'view:'+p.id,kind:'navigation',title:p.label,detail:'Open workspace',view:p.id})),
      ...assignments.map(a=>({id:'shipment:'+a.id,kind:'load',title:a.reference||'Load',
        detail:(a.customer_name||'Customer')+' · '+(a.pickup_address||'Pickup'),view:'dispatch',assignmentId:a.id})),
      ...drivers.map(d=>({id:'driver:'+d.user_id,kind:'driver',title:d.display_name||'Driver',
        detail:'Class '+(d.license_class||'—')+' · '+(d.availability||'Unknown'),view:'fleet',driverId:d.user_id})),
    ];
    const needle=query.toLowerCase().trim();
    return (needle?commands.filter(c=>(c.title+' '+c.detail).toLowerCase().includes(needle)):commands).slice(0,12);
  },[query,assignments,drivers,pages]);
  useEffect(()=>{setSelected(0);},[query]);
  useEffect(()=>{
    if(!open)return;
    const handler=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[open,onClose]);
  if(!open)return null;
  const run=item=>{if(!item)return;onNavigate(item);onClose();};
  const onKey=e=>{
    if(e.key==='ArrowDown'){e.preventDefault();setSelected(i=>Math.min(i+1,results.length-1));}
    else if(e.key==='ArrowUp'){e.preventDefault();setSelected(i=>Math.max(0,i-1));}
    else if(e.key==='Enter'){e.preventDefault();run(results[selected]);}
  };
  return <div className="at-overlay at-command-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="at-command-dialog" role="dialog" aria-modal="true" aria-label="Search Andertrack commands and records">
      <label className="at-command-search"><Search size={20}/><input ref={ref} autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)}
        onKeyDown={onKey} placeholder="Search workspace, loads or drivers…" aria-label="Search command palette"/>
        <kbd>ESC</kbd></label>
      <div className="at-command-results">
        {results.map((item,i)=>{
          const Icon=ICONS[item.kind]||(item.kind==='navigation'?Command:Search);
          return <button type="button" key={item.id} className={'at-command-result '+(selected===i?'active':'')}
            onMouseEnter={()=>setSelected(i)} onClick={()=>run(item)}>
            <Icon size={18}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={15}/>
          </button>;
        })}
        {results.length===0&&<p className="at-command-none">No matching commands or visible records.</p>}
      </div>
      <footer className="at-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>↵</kbd> Open</span>
        <span>Only authorized records are searchable</span></footer>
    </section>
  </div>;
}
