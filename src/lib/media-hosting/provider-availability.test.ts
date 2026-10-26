// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureProviderAvailability, getProviderAvailabilitySnapshot, probeProviderAvailability, resetProviderAvailabilityForTests } from './provider-availability';

class MockImage {
  static failedUrlPart = '';

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = '';

  set src(value: string) {
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
  beforeEach(() => {
    resetProviderAvailabilityForTests();
    MockImage.failedUrlPart = '';
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
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
});
