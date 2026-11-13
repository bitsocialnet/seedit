// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCanonicalCommunityRoute from './use-canonical-community-route';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  location: { pathname: '/', search: '', hash: '' },
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => testState.location,
  useNavigate: () => testState.navigate,
}));

const okJson = (payload: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(payload) });
const dogsDefaults = { schemaVersion: 1, revision: 1, updatedAt: 200, directories: { dogs: { directoryCode: 'dogs', title: 'Dogs' } } };

const CanonicalRouteProbe = () => {
  useCanonicalCommunityRoute();
  return null;
};

let container: HTMLDivElement;
let root: Root;

describe('useCanonicalCommunityRoute', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps a directory route published after this build when the first defaults request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue(okJson(dogsDefaults));
    vi.stubGlobal('fetch', fetchMock);
    testState.location = { pathname: '/s/dogs', search: '', hash: '' };

    await act(async () => root.render(createElement(CanonicalRouteProbe)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Replacing /s/dogs with /s/dogs.bso now would lose the directory for good.
    expect(testState.navigate).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(testState.navigate).not.toHaveBeenCalled();

    // Once the published directories are known, an unknown shorthand still becomes its community address.
    testState.location = { pathname: '/s/cows', search: '', hash: '' };
    await act(async () => root.render(createElement(CanonicalRouteProbe)));
    expect(testState.navigate).toHaveBeenCalledWith({ pathname: '/s/cows.bso', search: '', hash: '' }, { replace: true });
  });
});
