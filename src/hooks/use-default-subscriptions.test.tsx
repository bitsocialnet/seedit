// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStarterCommunityList } from './use-default-subscriptions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({ snapshot: undefined as ReturnType<typeof useStarterCommunityList> | undefined }));

const remoteList = { schemaVersion: 2, revision: 1000, communities: [{ address: 'new-default.bso' }] };

const StarterListProbe = () => {
  testState.snapshot = useStarterCommunityList();
  return null;
};

let container: HTMLDivElement;
let root: Root;

describe('useStarterCommunityList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries a failed request a minute later instead of keeping the fallback list for an hour', async () => {
    let resolveRetry: (response: unknown) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveRetry = resolve)));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(createElement(StarterListProbe)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(testState.snapshot).toMatchObject({ loading: false, error: expect.any(Error) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry runs without flipping pages back to loading.
    expect(testState.snapshot).toMatchObject({ loading: false, error: expect.any(Error) });

    await act(async () => {
      resolveRetry({ ok: true, status: 200, json: () => Promise.resolve(remoteList) });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(testState.snapshot).toMatchObject({ loading: false, error: null, list: { revision: 1000 } });
  });

  it('still retries when the page remounts while waiting to retry', async () => {
    // Past the hourly refresh left by the previous test.
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(remoteList) });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(createElement(StarterListProbe)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    root = createRoot(container);
    await act(async () => root.render(createElement(StarterListProbe)));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(testState.snapshot).toMatchObject({ loading: false, error: null });
  });
});
