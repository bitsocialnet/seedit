// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureProviderAvailability,
  getProviderAvailabilitySnapshot,
  probeProviderAvailability,
  resetProviderAvailabilityForTests,
  subscribeProviderAvailability,
} from './provider-availability';

class MockImage {
  static failedUrlPart = '';
  static loads = 0;

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = '';

  set src(value: string) {
    MockImage.loads++;
    queueMicrotask(() => {
      if (MockImage.failedUrlPart && value.includes(MockImage.failedUrlPart)) {
        this.onerror?.();
        return;
      }
      this.onload?.();
    });
  }
}

describe('provider-availability', () => {
  let unsubscribe = () => {};

  beforeEach(() => {
    resetProviderAvailabilityForTests();
    MockImage.failedUrlPart = '';
    MockImage.loads = 0;
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
    unsubscribe();
    unsubscribe = () => {};
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetProviderAvailabilityForTests();
  });

  it('marks runtime-supported providers available when probes load', async () => {
    const snapshot = await ensureProviderAvailability('android');

    expect(snapshot.catbox).toBe('available');
    expect(snapshot.imgbb).toBe('available');
    expect(snapshot.imgur).toBe('available');
  });

  it('marks a provider unavailable when one of its media probes fails', async () => {
    MockImage.failedUrlPart = 'i.ibb.co';

    const status = await probeProviderAvailability('imgbb');

    expect(status).toBe('unavailable');
    expect(getProviderAvailabilitySnapshot().imgbb).toBe('unavailable');
  });

  it('leaves providers unknown when image probing is unavailable', async () => {
    vi.stubGlobal('Image', undefined);

    const status = await probeProviderAvailability('catbox');

    expect(status).toBe('unknown');
    expect(getProviderAvailabilitySnapshot().catbox).toBe('unknown');
  });

  it('probes a provider that failed again for the next upload within a minute', async () => {
    vi.useFakeTimers();
    MockImage.failedUrlPart = 'i.ibb.co';
    expect(await probeProviderAvailability('imgbb')).toBe('unavailable');

    MockImage.failedUrlPart = '';
    await vi.advanceTimersByTimeAsync(60_000);

    expect((await ensureProviderAvailability('electron')).imgbb).toBe('available');
  });

  it('keeps probing an unavailable provider while its status is shown, without flickering back to selectable', async () => {
    vi.useFakeTimers();
    MockImage.failedUrlPart = 'i.ibb.co';
    const statuses: (string | undefined)[] = [];
    unsubscribe = subscribeProviderAvailability(() => statuses.push(getProviderAvailabilitySnapshot().imgbb), 'electron');
    await vi.advanceTimersByTimeAsync(0);
    expect(getProviderAvailabilitySnapshot().imgbb).toBe('unavailable');

    statuses.length = 0;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getProviderAvailabilitySnapshot().imgbb).toBe('unavailable');
    expect(statuses).not.toContain('checking');

    MockImage.failedUrlPart = '';
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getProviderAvailabilitySnapshot().imgbb).toBe('available');
  });

  // Timers run on a monotonic clock, while Date.now() follows the wall clock, which can lag it by a few milliseconds.
  it('keeps probing an unavailable provider while its status is shown when the wall clock lags the timers', async () => {
    vi.useFakeTimers();
    MockImage.failedUrlPart = 'i.ibb.co';
    unsubscribe = subscribeProviderAvailability(() => {}, 'electron');
    await vi.advanceTimersByTimeAsync(0);
    expect(getProviderAvailabilitySnapshot().imgbb).toBe('unavailable');

    vi.setSystemTime(Date.now() - 1);
    MockImage.failedUrlPart = '';
    await vi.advanceTimersByTimeAsync(30_000);

    expect(getProviderAvailabilitySnapshot().imgbb).toBe('available');
  });

  it('probes an expired failure when its status is shown again, even if the wall clock lags the timers', async () => {
    vi.useFakeTimers();
    MockImage.failedUrlPart = 'i.ibb.co';
    unsubscribe = subscribeProviderAvailability(() => {}, 'electron');
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();

    vi.setSystemTime(Date.now() - 1);
    MockImage.failedUrlPart = '';
    await vi.advanceTimersByTimeAsync(30_000);
    unsubscribe = subscribeProviderAvailability(() => {}, 'electron');
    await vi.advanceTimersByTimeAsync(0);

    expect(getProviderAvailabilitySnapshot().imgbb).toBe('available');
  });

  it('keeps an available result when the retry of an older failure fires', async () => {
    vi.useFakeTimers();
    MockImage.failedUrlPart = 'i.ibb.co';
    unsubscribe = subscribeProviderAvailability(() => {}, 'electron');
    await vi.advanceTimersByTimeAsync(0);

    // A wall clock that jumps ahead lets an upload probe again before the retry fires.
    vi.setSystemTime(Date.now() + 60_000);
    MockImage.failedUrlPart = '';
    expect((await ensureProviderAvailability('electron')).imgbb).toBe('available');
    const loads = MockImage.loads;

    await vi.advanceTimersByTimeAsync(30_000);
    expect(MockImage.loads).toBe(loads);
  });

  it('stops probing an unavailable provider once nothing shows its status', async () => {
    vi.useFakeTimers();
    MockImage.failedUrlPart = 'i.ibb.co';
    unsubscribe = subscribeProviderAvailability(() => {}, 'electron');
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();
    const loads = MockImage.loads;

    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(MockImage.loads).toBe(loads);
  });

  it('keeps an available result for ten minutes', async () => {
    vi.useFakeTimers();
    await probeProviderAvailability('imgbb');
    const loads = MockImage.loads;

    await vi.advanceTimersByTimeAsync(9 * 60_000);
    await probeProviderAvailability('imgbb');
    expect(MockImage.loads).toBe(loads);

    await vi.advanceTimersByTimeAsync(2 * 60_000);
    await probeProviderAvailability('imgbb');
    expect(MockImage.loads).toBeGreaterThan(loads);
  });
});
