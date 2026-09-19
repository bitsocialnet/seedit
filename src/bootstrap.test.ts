import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('application bootstrap', () => {
  let events: string[];
  let toolsError: Error | undefined;

  beforeEach(() => {
    events = [];
    toolsError = undefined;
    vi.resetModules();
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('../scripts/react-perf/collector.mjs', () => ({
      installCollector: () => {
        events.push('collector');
        return { dispose: vi.fn() };
      },
    }));
    vi.doMock('./lib/dev-tools', () => {
      events.push('tools');
      if (toolsError) throw toolsError;
      return {};
    });
    vi.doMock('./index', () => {
      events.push('app');
      return {};
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('installs the collector before loading the app and development tools', async () => {
    await import('./bootstrap');
    await vi.dynamicImportSettled();

    expect(events[0]).toBe('collector');
    expect(events).toContain('tools');
    expect(events).toContain('app');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('still starts the app when development tools cannot load', async () => {
    toolsError = new Error('Failed to resolve import "agentation"');

    await import('./bootstrap');
    await vi.dynamicImportSettled();

    expect(events).toContain('app');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('corepack yarn install --immutable'), expect.any(Error));
  });

  it('excludes development tools and the collector in production', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');

    await import('./bootstrap');
    await vi.dynamicImportSettled();

    expect(events).toEqual(['app']);
  });

  it('keeps the collector but excludes development tools in profiling builds', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'profiling');

    await import('./bootstrap');
    await vi.dynamicImportSettled();

    expect(events).toEqual(['collector', 'app']);
  });
});
