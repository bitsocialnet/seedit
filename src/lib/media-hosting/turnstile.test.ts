// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTurnstileToken } from './turnstile';

type RenderOptions = Record<string, unknown> & {
  callback: (token: string) => void;
  'error-callback': (code: string) => boolean;
  'before-interactive-callback': () => void;
};

const turnstileWindow = window as Window & { turnstile?: unknown };

function installTurnstile() {
  let options: RenderOptions | null = null;
  const api = {
    render: vi.fn((_container: HTMLElement, renderOptions: RenderOptions) => {
      options = renderOptions;
      return 'widget-1';
    }),
    remove: vi.fn(),
  };
  turnstileWindow.turnstile = api;
  const getOptions = () => {
    if (!options) throw new Error('Turnstile widget was not rendered');
    return options;
  };
  return { api, getOptions };
}

const getContainer = () => document.querySelector<HTMLElement>('[data-turnstile-container]');

describe('getTurnstileToken', () => {
  beforeEach(() => {
    delete turnstileWindow.turnstile;
    document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((script) => script.remove());
  });

  afterEach(() => {
    vi.useRealTimers();
    getContainer()?.remove();
    delete turnstileWindow.turnstile;
  });

  it('renders an invisible-unless-interactive widget and resolves a single token, then cleans up', async () => {
    const { api, getOptions } = installTurnstile();

    const pending = getTurnstileToken('sitekey');
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledOnce());
    const container = getContainer();
    expect(container).not.toBeNull();
    expect(container?.style.border).toBe('');
    expect(getOptions()).toMatchObject({ sitekey: 'sitekey', appearance: 'interaction-only', retry: 'never', 'response-field': false });

    getOptions().callback('token-1');

    await expect(pending).resolves.toBe('token-1');
    expect(api.remove).toHaveBeenCalledWith('widget-1');
    expect(getContainer()).toBeNull();
  });

  it('shows a bordered, usable container when Cloudflare requires interaction', async () => {
    const { api, getOptions } = installTurnstile();

    const pending = getTurnstileToken('sitekey');
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledOnce());
    getOptions()['before-interactive-callback']();

    const container = getContainer();
    expect(container?.hasAttribute('data-interactive')).toBe(true);
    expect(container?.style.border).toBe('1px solid var(--border-text)');
    expect(container?.style.backgroundColor).toBe('var(--background)');
    expect(container?.style.display).not.toBe('none');
    expect(container?.style.visibility).not.toBe('hidden');

    getOptions().callback('token-2');
    await expect(pending).resolves.toBe('token-2');
    expect(getContainer()).toBeNull();
  });

  it('rejects with the Turnstile error code and cleans up', async () => {
    const { api, getOptions } = installTurnstile();

    const pending = getTurnstileToken('sitekey');
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledOnce());
    getOptions()['error-callback']('300030');

    await expect(pending).rejects.toThrow('Turnstile error 300030');
    expect(api.remove).toHaveBeenCalledWith('widget-1');
    expect(getContainer()).toBeNull();
  });

  it('times out a widget that never answers', async () => {
    vi.useFakeTimers();
    const { api } = installTurnstile();

    const pending = getTurnstileToken('sitekey').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await pending).toEqual(new Error('Turnstile check timed out'));
    expect(api.remove).toHaveBeenCalledWith('widget-1');
    expect(getContainer()).toBeNull();
  });

  it('lazy-loads the explicit-render script and retries after a failed load', async () => {
    const first = getTurnstileToken('sitekey');
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]');
    expect(script?.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    script?.onerror?.(new Event('error'));
    await expect(first).rejects.toThrow('Turnstile script failed to load');
    expect(document.head.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();

    const second = getTurnstileToken('sitekey');
    const retryScript = document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]');
    expect(retryScript).not.toBeNull();
    const { getOptions } = installTurnstile();
    retryScript?.onload?.(new Event('load'));
    await vi.waitFor(() => expect(getContainer()).not.toBeNull());
    getOptions().callback('token-3');

    await expect(second).resolves.toBe('token-3');
  });
});
