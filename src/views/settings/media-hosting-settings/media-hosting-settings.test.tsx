// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMediaHostingRuntime, getProviderAvailabilitySnapshot, subscribeProviderAvailability } from '../../../lib/media-hosting';
import useMediaHostingStore from '../../../stores/use-media-hosting-store';
import MediaHostingSettings from './media-hosting-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../lib/media-hosting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/media-hosting')>()),
  getMediaHostingRuntime: vi.fn(() => 'web'),
  getProviderAvailabilitySnapshot: vi.fn(() => ({})),
  // No network probes in tests.
  subscribeProviderAvailability: vi.fn(() => () => {}),
}));

let container: HTMLDivElement;
let root: Root;

const render = () => act(() => root.render(createElement(MediaHostingSettings)));
const radio = (value: string) => container.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
const radioValues = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map((input) => input.value);

describe('MediaHostingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMediaHostingRuntime).mockReturnValue('web');
    vi.mocked(getProviderAvailabilitySnapshot).mockReturnValue({});
    useMediaHostingStore.setState({ uploadMode: 'preferred', preferredProvider: 'forge' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('offers Forge Images, checked by default, or no uploads on web', () => {
    render();

    expect(radioValues()).toEqual(['forge', 'none']);
    expect(radio('forge')?.checked).toBe(true);
    expect(container.textContent).toContain('images.bitsocialforge.com');
    expect(container.textContent).toContain('media_hosting_more_providers_in_apps');
    expect(subscribeProviderAvailability).toHaveBeenCalledWith(expect.any(Function), 'web');
  });

  it('turns uploads off', () => {
    render();

    act(() => radio('none')?.click());

    expect(useMediaHostingStore.getState().uploadMode).toBe('none');
    expect(radio('none')?.checked).toBe(true);
    expect(radio('forge')?.checked).toBe(false);
  });

  it('lists Random and the automated providers in the desktop app, and switches the preferred one', () => {
    vi.mocked(getMediaHostingRuntime).mockReturnValue('electron');
    render();

    expect(radioValues()).toEqual(['random', 'forge', 'catbox', 'imgur', 'imgbb', 'none']);
    expect(container.textContent).not.toContain('media_hosting_more_providers_in_apps');

    act(() => radio('catbox')?.click());
    expect(useMediaHostingStore.getState()).toMatchObject({ uploadMode: 'preferred', preferredProvider: 'catbox' });

    act(() => radio('random')?.click());
    expect(useMediaHostingStore.getState().uploadMode).toBe('random');
    expect(radio('catbox')?.checked).toBe(false);
  });

  it('shows a stored provider the web app cannot use as Forge Images', () => {
    useMediaHostingStore.setState({ uploadMode: 'random', preferredProvider: 'imgur' });
    render();

    expect(radio('forge')?.checked).toBe(true);
  });

  it('disables a provider that is unreachable from this network and says why', () => {
    vi.mocked(getMediaHostingRuntime).mockReturnValue('android');
    vi.mocked(getProviderAvailabilitySnapshot).mockReturnValue({ imgur: 'unavailable' });
    render();

    expect(radio('imgur')?.disabled).toBe(true);
    expect(radio('catbox')?.disabled).toBe(false);
    expect(container.textContent).toContain('media_hosting_provider_unavailable');
  });
});
