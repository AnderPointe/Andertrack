import React, { useState } from 'react';
import DemoApp from './App.jsx';
import LiveWorkspace from './features/live/LiveWorkspace.jsx';
import './live.css';

export default function Root() {
  const [mode, setMode] = useState('live');
  if (mode === 'demo') {
    return <div className="demo-wrap">
      <div className="demo-banner">
        <span>Sample data only — changes here do not affect Supabase.</span>
        <button onClick={() => setMode('live')}>Return to secure operations</button>
      </div>
      <DemoApp />
    </div>;
  }
  return <LiveWorkspace onDemo={() => setMode('demo')} />;
}
