// The collector must observe renderer initialization, including development roots.
const start = async () => {
  if (import.meta.env.DEV || import.meta.env.MODE === 'profiling') {
    const { installCollector } = await import('../scripts/react-perf/collector.mjs');
    const collector = installCollector({ buildType: import.meta.env.DEV ? 'development' : 'profiling' });
    import.meta.hot?.dispose(() => collector?.dispose());
  }
  if (import.meta.env.DEV) {
    // Optional tooling must not prevent the app from loading if its module fails.
    void import('./lib/dev-tools').catch((error) => {
      console.warn('Development tools could not load. Run corepack yarn install --immutable if dependencies are missing.', error);
    });
  }
  await import('./index');
};

void start();
