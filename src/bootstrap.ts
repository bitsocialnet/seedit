// The collector must observe renderer initialization, including development roots.
const start = async () => {
  if (import.meta.env.DEV || import.meta.env.MODE === 'profiling') {
    const { installCollector } = await import('../scripts/react-perf/collector.mjs');
    const collector = installCollector({ buildType: import.meta.env.DEV ? 'development' : 'profiling' });
    import.meta.hot?.dispose(() => collector?.dispose());
  }
  await import('./index');
};

void start();
