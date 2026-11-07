import './polyfills.js';
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
import WebAnalytics from './components/web-analytics';

// Must run before the bitsocial-react-hooks accounts store generates the default
// account, which reads window.defaultPkcOptions.
const renderApp = async () => {
  configureP2PBrowserPkcOptions();
  await configureDevelopmentMockContent();
  const { default: App } = await import('./app');

  if (import.meta.env.MODE !== 'profiling')
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
  const tree = (
    <React.StrictMode>
      <Router>
        <App />
        <WebAnalytics />
      </Router>
    </React.StrictMode>
  );
  root.render(
    (import.meta.env.DEV || import.meta.env.MODE === 'profiling') && window.__REACT_PERF__ ? (
      <React.Profiler id='app' onRender={window.__REACT_PERF__.onProfilerRender}>
        {tree}
      </React.Profiler>
    ) : (
      tree
    ),
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
