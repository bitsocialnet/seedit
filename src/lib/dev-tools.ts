import './element-source';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const flags = window as Window & {
    __VISUAL_TESTING__?: boolean;
    __NO_DEV_TOOLBAR__?: boolean;
    __PROFILING__?: boolean;
  };

  // Keep annotation controls out of automated screenshots and profiling sessions.
  if (!flags.__VISUAL_TESTING__ && !flags.__NO_DEV_TOOLBAR__ && !flags.__PROFILING__) {
    let root: import('react-dom/client').Root | undefined;
    let host: HTMLDivElement | undefined;
    let disposed = false;
    import.meta.hot?.dispose(() => {
      disposed = true;
      root?.unmount();
      host?.remove();
    });

    Promise.all([import('agentation'), import('react'), import('react-dom/client')])
      .then(([{ Agentation }, { createElement }, { createRoot }]) => {
        if (disposed) return;
        // A separate root leaves application markup intact.
        host = document.createElement('div');
        host.id = 'agentation-root';
        document.body.append(host);
        root = createRoot(host);
        root.render(createElement(Agentation));
      })
      .catch((error) => console.error('Failed to load Agentation:', error));
  }
}
