import './polyfills.js';
import './lib/dev-tools';
import { configureDevelopmentMockContent } from './lib/development-debug';
import { configureP2PBrowserPkcOptions } from './lib/p2p-browser-config';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import './lib/init-translations';
import './index.css';
import './themes.css';
import './preload-assets.css';
import { App as CapacitorApp } from '@capacitor/app';
import { registerSW } from 'virtual:pwa-register';
import { Analytics } from '@vercel/analytics/react';

// Only enable analytics on seedit.app (Vercel deployment)
// Exclude Electron (file:// or localhost), Capacitor/APK (capacitor:// or localhost), and IPFS (ipfs:// or different domain)
const isVercelDeployment =
  typeof window !== 'undefined' && (window.location.hostname === 'seedit.app' || window.location.hostname === 'www.seedit.app') && !window.isElectron;

// Must run before the bitsocial-react-hooks accounts store generates the default
// account, which reads window.defaultPkcOptions.
const renderApp = async () => {
  configureP2PBrowserPkcOptions();
  await configureDevelopmentMockContent();
  const { default: App } = await import('./app');

  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Reload the page to load the new version
      // Use window.location.reload() as it's more reliable than reloadSW(true)
      if (!sessionStorage.getItem('sw-update-reload')) {
        sessionStorage.setItem('sw-update-reload', 'true');
        window.location.reload();
      }
    },
    onOfflineReady() {
      // Clear the reload flag when offline-ready (prevents loops)
      sessionStorage.removeItem('sw-update-reload');
    },
  });

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <Router>
        <App />
        {isVercelDeployment && <Analytics />}
      </Router>
    </React.StrictMode>,
  );
};

void renderApp();

// add back button in android app
CapacitorApp.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) {
    window.history.back();
  } else {
    CapacitorApp.exitApp();
  }
});
