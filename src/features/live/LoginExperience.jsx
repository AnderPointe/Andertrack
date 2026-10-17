import React from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Fingerprint, LockKeyhole, MapPinned, Radio, Route, ShieldCheck, Truck, Wifi } from 'lucide-react';
import './command-center.css';
import './auth-experience.css';

/** Authentication UI only; all session operations stay in LiveWorkspace. */
export default function LoginExperience({ email, setEmail, sent, busy, error, onSubmit, onDemo, onChangeEmail }) {
  const rateLimited = /rate limit|too many requests/i.test(error || '');
  const needsInvite = /signup|signups not allowed/i.test(error || '');
  return <div className="at-auth-screen">
    <div className="at-auth-nav">
      <div className="at-auth-brand"><span><Route size={21}/></span><strong>ANDER<em>TRACK</em></strong></div>
      <span className="at-auth-nav-caption"><ShieldCheck size={15}/> SECURE LOGISTICS WORKSPACE</span>
    </div>
    <div className="at-auth-layout">
      <aside className="at-auth-intro">
        <div className="at-auth-overline"><span/> DISPATCH. VISIBILITY. CONTROL.</div>
        <h1>The next generation<br/>of <span>fleet intelligence.</span></h1>
        <p>One connected workspace for dispatchers, drivers and every mile in between. See your fleet, manage assignments and stay one step ahead.</p>
        <div className="at-auth-graphic" aria-hidden="true">
          <div className="at-auth-grid"/>
          <svg viewBox="0 0 570 310" preserveAspectRatio="none" className="at-auth-route">
            <path d="M-15 258 C80 258 66 180 155 190 S253 98 322 124 S397 46 588 29" stroke="#2f6b65" strokeWidth="28" fill="none" opacity=".2"/>
            <path d="M-15 258 C80 258 66 180 155 190 S253 98 322 124 S397 46 588 29" stroke="#32d2c1" strokeWidth="3.5" fill="none" strokeDasharray="9 8"/>
            <path d="M0 111 C75 98 143 121 208 73 S388 89 570 166" stroke="#ed8b1e" strokeWidth="1.6" fill="none" opacity=".65"/>
            <circle cx="155" cy="190" r="16" fill="#101b21" stroke="#32d2c1" strokeWidth="2"/>
            <circle cx="155" cy="190" r="6" fill="#32d2c1"/>
            <circle cx="322" cy="124" r="15" fill="#101b21" stroke="#ff981b" strokeWidth="2"/>
            <circle cx="322" cy="124" r="5" fill="#ff981b"/>
            <circle cx="484" cy="57" r="14" fill="#101b21" stroke="#32d2c1" strokeWidth="2"/>
            <circle cx="484" cy="57" r="5" fill="#32d2c1"/>
          </svg>
          <div className="at-auth-floating at-auth-float-one"><span><Truck size={20}/></span><div><strong>Dispatch intelligence</strong><small>Connected operations</small></div><ArrowUpRight size={17}/></div>
          <div className="at-auth-floating at-auth-float-two"><Radio size={16}/><strong>Realtime event stream</strong><span className="at-auth-pulse"/></div>
          <div className="at-auth-floating at-auth-float-three"><MapPinned size={15}/><span>Fleet visibility across every route</span></div>
        </div>
        <div className="at-auth-feature-row">
          <span><Radio size={17}/> Live tracking</span>
          <span><Route size={17}/> Smart dispatch</span>
          <span><ShieldCheck size={17}/> Role-based security</span>
        </div>
      </aside>
      <section className="at-auth-form-wrap">
        <div className="at-auth-form-top"><span><LockKeyhole size={19}/></span><div><strong>AUTHORIZED ACCESS</strong><small>ANDERTRACK OPERATIONS OS</small></div></div>
        <h2>Welcome back.</h2><p>Sign in to your operations workspace using your approved company email.</p>
        {sent ? <div className="at-auth-success" role="status"><CheckCircle2 size={22}/><div><strong>Check your inbox</strong>
          <span>A secure sign-in link was requested for {email}. Use the newest message and open it in this browser. If it does not arrive, check spam before retrying.</span>
          <button type="button" className="at-auth-change-email" onClick={onChangeEmail}>Use a different email</button>
          </div></div> :
        <form className="at-auth-form" onSubmit={onSubmit}>
          <label htmlFor="at-auth-email">Work email address</label>
          <input id="at-auth-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email"/>
          <button disabled={busy} className="at-auth-submit" type="submit">{busy?'Requesting link…':'Email me a secure login link'}<ArrowRight size={18}/></button>
          {error&&<div className="at-auth-error" role="alert">
            {rateLimited?'Email sending is temporarily rate-limited. Wait for the limit to reset before requesting another link.':
              needsInvite?'This email is not registered in this environment. Ask your workspace administrator for an invitation, or use the production site.':
              error}
          </div>}
        </form>}
        <div className="at-auth-separator"><span/> OR EXPLORE THE PLATFORM <span/></div>
        <button className="at-auth-preview-button" onClick={onDemo}>
          Explore interactive demo <ArrowUpRight size={17}/>
        </button>
        <div className="at-auth-security"><Fingerprint size={17}/><span>Private organization data stays protected. Demo mode uses clearly labeled sample records and cannot update live assignments.</span></div>
      </section>
    </div>
    <footer className="at-auth-footer"><span>© ANDERTRACK · INTELLIGENT LOGISTICS SYSTEMS</span><span>ORANGE / TEAL / WHITE / BLACK</span></footer>
  </div>;
}
