import React, { useState } from 'react';
import DemoApp from './App.jsx';
import LiveWorkspace from './features/live/LiveWorkspace.jsx';
import './live.css';

export default function Root() {
  const [mode, setMode] = useState('live');
  return mode === 'demo'
    ? <DemoApp onReturn={() => setMode('live')} />
    : <LiveWorkspace onDemo={() => setMode('demo')} />;
}
