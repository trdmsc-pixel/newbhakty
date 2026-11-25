import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Route-aware boot: Studio OS and the client portal skip the marketing-site
// bundle entirely, which keeps their first load small on mobile.
const root = createRoot(document.getElementById('root')!);
const path = window.location.pathname;
const goHome = () => window.location.assign('/');

const boot = async () => {
  if (path === '/studio-os' || path.startsWith('/studio-os/')) {
    const { default: StudioOSApp } = await import('./studio-os/StudioOSApp');
    root.render(<StrictMode><StudioOSApp onNavigateHome={goHome} /></StrictMode>);
  } else if (path === '/portal' || path.startsWith('/portal/')) {
    const { default: PortalApp } = await import('./portal/PortalApp');
    root.render(<StrictMode><PortalApp onNavigateHome={goHome} /></StrictMode>);
  } else {
    const { default: App } = await import('./App.tsx');
    root.render(<StrictMode><App /></StrictMode>);
  }
};
boot();
