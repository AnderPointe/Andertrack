import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Database, LockKeyhole, LogOut, MapPinned, Package, RefreshCw, ShieldAlert, Truck, Wifi } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import AssignmentActions from './AssignmentActions.jsx';
import DispatchRequestQueue from './DispatchRequestQueue.jsx';
import OpsCommandCenter from './OpsCommandCenter.jsx';
import LoginExperience from './LoginExperience.jsx';

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
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setSent(true);
  }
  return <LoginExperience email={email} setEmail={setEmail} sent={sent} busy={busy} error={error} onSubmit={submit} onDemo={onDemo}/>;
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
  const [dispatchRequests, setDispatchRequests] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
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
        setAssignments([]); setDispatchRequests([]); setDrivers([]); setVehicles([]); setLocations([]); setSelected('');
      }
      setSession(next);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user?.id || '';
  useEffect(() => {
    if (!supabase || !userId) {
      setMemberships([]); setOrganizationId(''); setProfile(null); setAssignments([]); setDispatchRequests([]); setDrivers([]); setVehicles([]); setLocations([]);
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
      supabase.from('at_driver_profiles').select('user_id,display_name,license_class,license_verified,availability').eq('organization_id',organizationId).limit(200),
      supabase.from('at_vehicles').select('id,unit_number,vehicle_type,required_license_class,enabled').eq('organization_id',organizationId).limit(250),
      supabase.from('at_dispatch_requests').select('id,queue_number,driver_user_id,requested_at,status').eq('organization_id',organizationId).eq('status','queued').order('queue_number',{ascending:true}).limit(200)
    ];
    if (!isPlanner) requests.push(supabase.from('at_driver_profiles').select('user_id,display_name,license_class,license_verified,availability').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle());
    else requests.push(supabase.from('driver_location_current').select('id,driver_id,latitude,longitude,status,unit_number,last_ping_at').eq('company_id',organizationId).limit(250));
    const results = await Promise.all(requests);
    if (scopeRef.current !== requestedScope) return;
    const critical = results.slice(0, isPlanner ? 4 : 5);
    if (critical.some(r => r.error)) setError(critical.find(r => r.error).error.message);
    else {
      setAssignments(results[0].data || []);
      setDrivers(results[1].data || []);
      setVehicles(results[2].data || []);
      setDispatchRequests(results[3].data || []);
      setProfile(isPlanner ? null : results[4].data);
      setLocations(isPlanner && !results[4].error ? results[4].data || [] : []);
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
      .on('postgres_changes', { event: '*', schema:'public', table:'at_dispatch_requests', filter:`organization_id=eq.${organizationId}` }, () => reload())
      .on('postgres_changes', { event: '*', schema:'public', table:'driver_location_current', filter:`company_id=eq.${organizationId}` }, () => reload())
      .subscribe(status => setSync(status === 'SUBSCRIBED' ? 'Realtime connected' : status === 'CHANNEL_ERROR' ? 'Connection interrupted; refreshing periodically' : status));
    const interval = setInterval(reload, 30000);
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [organizationId, userId, role, reload]);

  if (!supabaseConfigured) return <Configuration onDemo={onDemo}/>;
  if (!authReady) return <div className="live-loading">Checking session…</div>;
  if (!session) return <Login onDemo={onDemo}/>;
  return <OpsCommandCenter
    session={session} memberships={memberships} organizationId={organizationId} setOrganizationId={setOrganizationId}
    role={role} profile={profile} assignments={assignments} dispatchRequests={dispatchRequests}
    drivers={drivers} vehicles={vehicles} locations={locations} loading={loading} error={error}
    sync={sync} reload={reload} onDemo={onDemo}
    onSignOut={() => supabase.auth.signOut({scope:'global'})}/>;
}
