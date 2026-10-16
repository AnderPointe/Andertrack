import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Database, LockKeyhole, LogOut, MapPinned, Package, RefreshCw, ShieldAlert, Truck, Wifi } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabase';

function Label({ children, tone = '' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
const displayStatus = value => (value || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

function Login({ onDemo }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError(''); setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setSent(true);
  }
  return <div className="live-shell"><div className="live-top"><div className="brand"><span className="brandicon"><Truck size={22}/></span><div><strong>ANDER<span>TRACK</span></strong><small>OPERATIONS / SECURE ACCESS</small></div></div><Label tone="info">Phase 2 pilot</Label></div><section className="live-login panel">
    <LockKeyhole size={27} color="#55d8ca"/>
    <h1>Sign in to Andertrack</h1>
    <p className="muted">Dispatcher and driver access is assigned by your organization. Your role determines which workspace opens.</p>
    {sent ? <div className="live-message"><CheckCircle2 size={19}/> Check your email for your sign-in link. Return to this browser to complete sign-in.</div> : <form onSubmit={submit} className="live-form"><label htmlFor="sign-in-email">Work email</label><input id="sign-in-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"/><button className="primary" disabled={busy}>{busy ? 'Sending link…' : 'Email me a sign-in link'} <ArrowRight size={17}/></button>{error && <p className="live-error" role="alert">{error}</p>}</form>}
    <div className="live-separator">or</div><button className="secondary" onClick={onDemo}>Explore demo without logging in</button>
  </section></div>;
}
function Configuration({ onDemo }) {
  return <div className="live-shell"><section className="live-login panel"><Database size={28} color="#ffcc83"/><h1>Supabase connection not configured</h1><p className="muted">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your deployment environment and restart the build. Never place a database password or service-role key in the frontend.</p><button className="secondary" onClick={onDemo}>Open sample dashboard</button></section></div>;
}
export default function LiveWorkspace({ onDemo }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sync, setSync] = useState('Not connected');
  const identityRef = useRef('');
  const scopeRef = useRef('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      identityRef.current = data.session?.user?.id || '';
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      const nextId = next?.user?.id || '';
      if (nextId !== identityRef.current) {
        identityRef.current = nextId;
        scopeRef.current = '';
        setMemberships([]); setOrganizationId(''); setProfile(null);
        setAssignments([]); setDrivers([]); setSelected('');
      }
      setSession(next);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user?.id || '';
  useEffect(() => {
    if (!supabase || !userId) {
      setMemberships([]); setOrganizationId(''); setProfile(null); setAssignments([]); setDrivers([]);
      return;
    }
    let active = true;
    setLoading(true);
    supabase.from('at_organization_members').select('organization_id, role').eq('user_id', userId).then(({ data, error: lookupError }) => {
      if (!active) return;
      setLoading(false);
      if (lookupError) { setError(lookupError.message); return; }
      setError('');
      setMemberships(data || []);
      setOrganizationId(previous => (data || []).some(item => item.organization_id === previous) ? previous : data?.[0]?.organization_id || '');
    });
    return () => { active = false; };
  }, [userId]);

  const membership = memberships.find(item => item.organization_id === organizationId);
  scopeRef.current = userId + ':' + organizationId;
  const role = membership?.role || '';
  const isPlanner = role === 'admin' || role === 'dispatcher';

  const reload = useCallback(async () => {
    if (!supabase || !userId || !organizationId || !role) return;
    setLoading(true);
    const requestedScope = userId + ':' + organizationId;
    const requests = [
      supabase.from('at_assignments').select('id,reference,division,customer_name,commodity,pickup_address,dropoff_address,estimated_miles,status,driver_user_id,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(150),
      supabase.from('at_driver_profiles').select('user_id,display_name,license_class,license_verified,availability').eq('organization_id',organizationId).limit(200)
    ];
    if (!isPlanner) requests.push(supabase.from('at_driver_profiles').select('user_id,display_name,license_class,license_verified,availability').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle());
    const results = await Promise.all(requests);
    if (scopeRef.current !== requestedScope) return;
    if (results.some(r => r.error)) setError(results.find(r => r.error).error.message);
    else {
      setAssignments(results[0].data || []);
      setDrivers(results[1].data || []);
      setProfile(isPlanner ? null : results[2].data);
      setError('');
      setSync('Latest data received');
    }
    setLoading(false);
  }, [organizationId, userId, role, isPlanner]);

  useEffect(() => {
    if (!organizationId || !userId || !role || !supabase) return;
    reload();
    const channel = supabase.channel(`assignments:${organizationId}`)
      .on('postgres_changes', { event: '*', schema:'public', table:'at_assignments', filter:`organization_id=eq.${organizationId}` }, () => reload())
      .subscribe(status => setSync(status === 'SUBSCRIBED' ? 'Realtime connected' : status === 'CHANNEL_ERROR' ? 'Connection interrupted; refreshing periodically' : status));
    const interval = setInterval(reload, 30000);
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [organizationId, userId, role, reload]);

  const ordered = useMemo(() => [...assignments].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),[assignments]);
  const active = ordered.find(a => a.id === selected) || ordered[0];
  const driver = drivers.find(d => d.user_id === active?.driver_user_id);
  const division = profile?.license_class === 'A' || profile?.license_class === 'B' ? 'CDL' : 'Class C';
  if (!supabaseConfigured) return <Configuration onDemo={onDemo}/>;
  if (!authReady) return <div className="live-loading">Checking session…</div>;
  if (!session) return <Login onDemo={onDemo}/>;
  return <div className="live-shell">
    <header className="live-top"><div className="brand"><span className="brandicon"><Truck size={22}/></span><div><strong>ANDER<span>TRACK</span></strong><small>AUTHENTICATED OPERATIONS</small></div></div><div className="live-top-actions"><Label tone="success">Signed in</Label><button className="secondary" onClick={() => supabase.auth.signOut()}><LogOut size={14}/> Sign out</button></div></header>
    <main className="layout">
      <section className="heading"><div><p className="eyebrow">ANDERTRACK / SECURE OPERATIONS</p><h1>{isPlanner ? 'Dispatcher / Planner' : 'Driver Dashboard'}</h1><p>{session.user.email}</p></div><button className="secondary" onClick={onDemo}>Sample dashboard</button></section>
      {error && <div className="notice" role="alert"><ShieldAlert size={16}/><span>{error}{error.includes('does not exist') ? ' — Phase 2 database schema has not been deployed.' : ''}</span></div>}
      {loading && <p className="muted" role="status">Refreshing operational data…</p>}
      {memberships.length === 0 ? <section className="panel live-empty"><LockKeyhole size={25}/><h2>Organization access pending</h2><p className="muted">A trusted administrator must assign your user to an organization as an admin, dispatcher, or driver. No customer or shipment data is exposed until access is granted.</p></section> : <>
        {memberships.length > 1 && <div className="live-org"><label htmlFor="org-selector">Organization</label><select id="org-selector" value={organizationId} onChange={e => { setOrganizationId(e.target.value);setAssignments([]);setProfile(null);setDrivers([]);setSelected(''); }}>{memberships.map(m => <option value={m.organization_id} key={m.organization_id}>{m.organization_id.slice(0,8)} · {m.role}</option>)}</select></div>}
        <div className="live-meta"><Label tone="info">{role}</Label><span><Wifi size={14}/> {sync}</span><button className="secondary" onClick={reload} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
        {!isPlanner && !profile && <section className="panel live-empty"><ShieldAlert size={23}/><h2>Driver onboarding incomplete</h2><p className="muted">Your organization must verify your license class and create a driver profile. Assigned work is unavailable until onboarding is complete.</p></section>}
        {(!(!isPlanner && !profile)) && <>
          {!isPlanner && <section className="panel live-driver"><Truck size={20}/><div><strong>{profile.display_name}</strong><p>License Class {profile.license_class} · {division} workspace · {profile.availability}</p><small>{profile.license_verified ? 'License verification recorded' : 'License verification pending'}</small></div></section>}
          <div className="stats">{[{name:'Visible assignments',value:ordered.length,icon:Package},{name:'In transit',value:ordered.filter(j=>j.status==='in_transit').length,icon:Truck},{name:'Awaiting',value:ordered.filter(j=>['offered','unassigned'].includes(j.status)).length,icon:Clock},{name:'Delivered',value:ordered.filter(j=>j.status==='delivered').length,icon:CheckCircle2}].map(x=><div className="stat" key={x.name}><x.icon size={17}/><strong>{x.value}</strong><span>{x.name}</span></div>)}</div>
          {ordered.length === 0 ? <section className="panel live-empty"><Package size={26}/><h2>No accessible assignments</h2><p className="muted">{isPlanner?'There are no assignments visible in your organization yet.':'No assignments have been assigned to your account.'}</p></section> : <div className="columns"><section className="panel listpanel"><div className="sectionhead"><h2>{isPlanner?'Organization assignments':division+' assignments'}</h2><Label>{ordered.length} visible</Label></div><div className="cards">{ordered.map(a=><button key={a.id} onClick={()=>setSelected(a.id)} className={'job '+(active?.id===a.id?'selected':'')}><div className="jobrow"><b>{a.reference}</b><Label tone={a.status==='delivered'?'success':'info'}>{displayStatus(a.status)}</Label></div><p className="customer">{a.customer_name} <span>· {a.division}</span></p><p className="path">{a.pickup_address} <ArrowRight size={13}/> {a.dropoff_address}</p><div className="jobfooter"><span>{a.commodity}</span><strong>{a.estimated_miles??'—'} mi</strong></div></button>)}</div></section><section className="panel details"><div className="sectionhead"><h2>Shipment detail</h2><Label tone="info">{active.reference}</Label></div><h3>{active.customer_name}</h3><p className="muted">{active.commodity}</p><div className="route"><MapPinned size={20}/><div><span>{active.pickup_address}</span><i></i><span>{active.dropoff_address}</span></div></div><dl><div><dt>Division</dt><dd>{active.division}</dd></div><div><dt>Status</dt><dd>{displayStatus(active.status)}</dd></div><div><dt>Assigned driver</dt><dd>{driver?.display_name|| (active.driver_user_id?'Driver ID '+active.driver_user_id.slice(0,8):'Unassigned')}</dd></div></dl><div className="notice"><LockKeyhole size={16}/><span>Live operations are read-only in this phase. Driver assignment and completion controls will be enabled after authenticated, audited write workflows are deployed.</span></div></section></div>}
        </>}
      </>}
    </main>
    <footer>Andertrack Phase 2 Pilot · Supabase-backed read-only operations · No simulated jobs shown as live</footer>
  </div>;
}
