// @vitest-environment jsdom

import { EventEmitter } from 'node:events';
import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChallengeModal from './challenge-modal';
import useChallengesStore from '../../stores/use-challenges-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'challenge_counter') return `${options?.index}/${options?.total}`;
      if (key === 'iframe_challenge_open_confirmation') return String(options?.defaultValue ?? key);
      return key;
    },
  }),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ author: { address: '0xabc' } }),
  useComment: () => undefined,
}));

vi.mock('../../hooks/use-theme', () => ({
  default: () => ['light'],
}));

let container: HTMLDivElement;
let root: Root;

type ChallengeEntryFixture = { challenge: string; type: string };

// pkc-js 0.0.152 CHALLENGE messages key the pending challenges by challenge index, so keys can be sparse.
const createChallengeMessage = (challenges: Record<string, ChallengeEntryFixture>, publishChallengeAnswers = vi.fn(), content = 'challenge post') =>
  [{ challenges }, { communityAddress: 'example.bso', content, publishChallengeAnswers }] as never;

const createChallenge = (prompt: string, publishChallengeAnswers = vi.fn()) =>
  createChallengeMessage({ '0': { challenge: prompt, type: 'text/plain' } }, publishChallengeAnswers, prompt);

const createIframeChallenge = (url: string, publishChallengeAnswers = vi.fn()) =>
  createChallengeMessage({ '0': { challenge: url, type: 'url/iframe' } }, publishChallengeAnswers, 'iframe post');

// A pkc-js publication whose challenge waits in the modal, for the tests of an exchange that ends meanwhile
const createLiveChallenge = (prompt: string, type = 'text/plain') => {
  const publication = Object.assign(new EventEmitter(), {
    communityAddress: 'example.bso',
    content: prompt,
    publishChallengeAnswers: vi.fn(),
    state: 'publishing',
    publishingState: 'waiting-challenge-answers',
  });
  publication.on('error', () => {});
  return { challenge: [{ challenges: { '0': { challenge: prompt, type } } }, publication] as never, publication };
};

// pkc-js 0.0.154 order when a publication fails, e.g. after the community stopped waiting for an answer
const failPublication = async (publication: EventEmitter & { state: string; publishingState: string }) => {
  await act(async () => {
    publication.state = 'stopped';
    publication.emit('statechange', 'stopped');
    publication.publishingState = 'failed';
    publication.emit('error', new Error('publication failed'));
    publication.emit('publishingstatechange', 'failed');
  });
};

const postIframeAnswers = async (challengeAnswers: string[]) => {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://spamblocker.bitsocial.net',
        data: { type: 'challengeAnswer', challengeAnswers, sessionId: 'session-123' },
      }),
    );
    await Promise.resolve();
  });
};

const renderModal = async () => {
  await act(async () => {
    root.render(createElement(ChallengeModal));
  });
};

const clickButton = async (text: string) => {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  expect(button).toBeDefined();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
};

const enterAnswer = async (value: string) => {
  const input = container.querySelector<HTMLInputElement>('input');
  expect(input).not.toBeNull();
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    input?.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('ChallengeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChallengesStore.setState({ challenges: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useChallengesStore.setState({ challenges: [] });
  });

  it('abandons exactly the current challenge when Cancel is clicked', async () => {
    const firstAbandon = vi.fn().mockResolvedValue(undefined);
    const secondAbandon = vi.fn().mockResolvedValue(undefined);
    useChallengesStore.getState().addChallenge(createChallenge('first prompt'), firstAbandon);
    useChallengesStore.getState().addChallenge(createChallenge('second prompt'), secondAbandon);
    await renderModal();

    await clickButton('cancel');

    expect(firstAbandon).toHaveBeenCalledOnce();
    expect(secondAbandon).not.toHaveBeenCalled();
    expect(useChallengesStore.getState().challenges).toHaveLength(1);
    expect(container.textContent).toContain('second prompt');
  });

  it('abandons exactly the current challenge once when Escape is pressed', async () => {
    const firstAbandon = vi.fn().mockResolvedValue(undefined);
    const secondAbandon = vi.fn().mockResolvedValue(undefined);
    useChallengesStore.getState().addChallenge(createChallenge('first prompt'), firstAbandon);
    useChallengesStore.getState().addChallenge(createChallenge('second prompt'), secondAbandon);
    await renderModal();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });

    expect(firstAbandon).toHaveBeenCalledOnce();
    expect(secondAbandon).not.toHaveBeenCalled();
    expect(useChallengesStore.getState().challenges).toHaveLength(1);
  });

  it('submits a text answer without abandoning and resets state for the next queue entry', async () => {
    const publishChallengeAnswers = vi.fn();
    const firstAbandon = vi.fn().mockResolvedValue(undefined);
    useChallengesStore.getState().addChallenge(createChallenge('first prompt', publishChallengeAnswers), firstAbandon);
    useChallengesStore.getState().addChallenge(createChallenge('second prompt'));
    await renderModal();

    await enterAnswer('four');
    await clickButton('submit');

    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '0': 'four' });
    expect(firstAbandon).not.toHaveBeenCalled();
    expect(useChallengesStore.getState().challenges).toHaveLength(1);
    expect(container.textContent).toContain('second prompt');
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('');
  });

  it('handles an answer pkc-js rejects because the challenge exchange already ended', async () => {
    // pkc-js 0.0.154 rejects an answer to a challenge whose exchange ended while it waited in the modal, for example
    // after the community stopped waiting for the answer
    const exchangeEnded = Object.assign(new Error('challenge exchange ended'), { code: 'ERR_PUBLICATION_CHALLENGE_EXCHANGE_ENDED' });
    const publishChallengeAnswers = vi.fn().mockRejectedValue(exchangeEnded);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    useChallengesStore.getState().addChallenge(createChallenge('stale prompt', publishChallengeAnswers));
    useChallengesStore.getState().addChallenge(createChallenge('next prompt'));
    await renderModal();

    await enterAnswer('four');
    await clickButton('submit');
    await act(async () => {
      await Promise.resolve();
    });

    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '0': 'four' });
    expect(consoleError).toHaveBeenCalledWith('Failed to publish challenge answers:', exchangeEnded);
    expect(container.textContent).toContain('next prompt');
    consoleError.mockRestore();
  });

  it('closes a challenge whose exchange ended and shows the next queued one', async () => {
    const first = createLiveChallenge('first prompt');
    const second = createLiveChallenge('second prompt');
    const firstAbandon = vi.fn();
    useChallengesStore.getState().addChallenge(first.challenge, firstAbandon);
    useChallengesStore.getState().addChallenge(second.challenge);
    await renderModal();
    await enterAnswer('half typed');

    await failPublication(first.publication);

    expect(container.textContent).not.toContain('first prompt');
    expect(container.textContent).toContain('second prompt');
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('');
    // the exchange ended on its own, so the publication is not abandoned as if the user cancelled it
    expect(firstAbandon).not.toHaveBeenCalled();
    expect(first.publication.publishChallengeAnswers).not.toHaveBeenCalled();
  });

  it('closes an open iframe challenge whose exchange ended', async () => {
    const iframe = createLiveChallenge('https://spamblocker.bitsocial.net/api/v1/iframe/session-123', 'url/iframe');
    useChallengesStore.getState().addChallenge(iframe.challenge);
    await renderModal();
    await clickButton('open');
    expect(container.querySelector('iframe')).not.toBeNull();

    await failPublication(iframe.publication);
    await postIframeAnswers(['late-token']);

    expect(container.querySelector('iframe')).toBeNull();
    expect(useChallengesStore.getState().challenges).toHaveLength(0);
    expect(iframe.publication.publishChallengeAnswers).not.toHaveBeenCalled();
  });

  it('shows only the trusted Spamblocker hostname in the confirmation', async () => {
    useChallengesStore.getState().addChallenge(createIframeChallenge('https://spamblocker.bitsocial.net/api/v1/iframe/session-123?token=large-token'));

    await renderModal();

    expect(container.textContent).toContain('wants to open spamblocker.bitsocial.net');
    expect(container.textContent).not.toContain('/api/v1/iframe/session-123');
    expect(container.textContent).not.toContain('large-token');
  });

  it('keeps the full confirmation URL for untrusted challenge providers', async () => {
    useChallengesStore.getState().addChallenge(createIframeChallenge('https://example.com/api/v1/iframe/session-123?token=visible-token'));

    await renderModal();

    expect(container.textContent).toContain('https://example.com/api/v1/iframe/session-123?token=visible-token');
  });

  it('closes automatically when Spamblocker posts a matching challenge answer', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore.getState().addChallenge(createIframeChallenge('https://spamblocker.bitsocial.net/api/v1/iframe/session-123', publishChallengeAnswers));
    await renderModal();
    await clickButton('open');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://spamblocker.bitsocial.net',
          data: { type: 'challengeAnswer', challengeAnswers: ['turnstile-token'], sessionId: 'session-123' },
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://spamblocker.bitsocial.net',
          data: { type: 'challengeAnswer', challengeAnswers: ['duplicate-token'], sessionId: 'session-123' },
        }),
      );
      await Promise.resolve();
    });

    expect(publishChallengeAnswers).toHaveBeenCalledOnce();
    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '0': 'turnstile-token' });
    expect(useChallengesStore.getState().challenges).toHaveLength(0);
  });

  it('ignores iframe completion messages with a mismatched origin or session', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore.getState().addChallenge(createIframeChallenge('https://spamblocker.bitsocial.net/api/v1/iframe/session-123', publishChallengeAnswers));
    await renderModal();
    await clickButton('open');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://example.com',
          data: { type: 'challengeAnswer', challengeAnswers: ['wrong-origin'], sessionId: 'session-123' },
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://spamblocker.bitsocial.net',
          data: { type: 'challengeAnswer', challengeAnswers: ['wrong-session'], sessionId: 'session-456' },
        }),
      );
      await Promise.resolve();
    });

    expect(publishChallengeAnswers).not.toHaveBeenCalled();
    expect(useChallengesStore.getState().challenges).toHaveLength(1);
  });

  it('keeps the manual Done fallback closing the iframe challenge', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore.getState().addChallenge(createIframeChallenge('https://spamblocker.bitsocial.net/api/v1/iframe/session-123', publishChallengeAnswers));
    await renderModal();
    await clickButton('open');

    await clickButton('done');

    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '0': '' });
    expect(useChallengesStore.getState().challenges).toHaveLength(0);
  });

  it('walks sparse challenge keys in numeric order and submits answers keyed by challenge index', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore.getState().addChallenge(
      createChallengeMessage(
        {
          '10': { challenge: 'third prompt', type: 'text/plain' },
          '3': { challenge: 'second prompt', type: 'text/plain' },
          '1': { challenge: 'first prompt', type: 'text/plain' },
        },
        publishChallengeAnswers,
      ),
    );
    await renderModal();

    expect(container.textContent).toContain('first prompt');
    expect(container.textContent).toContain('1/3');
    await enterAnswer('one');
    await clickButton('next');
    expect(container.textContent).toContain('second prompt');
    expect(container.textContent).toContain('2/3');
    await enterAnswer('two');
    await clickButton('next');
    expect(container.textContent).toContain('third prompt');
    await enterAnswer('three');
    await clickButton('submit');

    expect(publishChallengeAnswers).toHaveBeenCalledOnce();
    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '1': 'one', '3': 'two', '10': 'three' });
  });

  it('sends an empty answer for a sparse key the user skipped instead of dropping the key', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore
      .getState()
      .addChallenge(
        createChallengeMessage(
          { '1': { challenge: 'first prompt', type: 'text/plain' }, '3': { challenge: 'second prompt', type: 'text/plain' } },
          publishChallengeAnswers,
        ),
      );
    await renderModal();

    await clickButton('next');
    await enterAnswer('two');
    await clickButton('submit');

    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '1': '', '3': 'two' });
  });

  it('keys the iframe answer by the challenge currently shown', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore.getState().addChallenge(
      createChallengeMessage(
        {
          '0': { challenge: 'first prompt', type: 'text/plain' },
          '2': { challenge: 'https://spamblocker.bitsocial.net/api/v1/iframe/session-123', type: 'url/iframe' },
        },
        publishChallengeAnswers,
      ),
    );
    await renderModal();

    await enterAnswer('four');
    await clickButton('next');
    await clickButton('open');
    await postIframeAnswers(['turnstile-token']);

    expect(publishChallengeAnswers).toHaveBeenCalledOnce();
    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '0': 'four', '2': 'turnstile-token' });
    expect(useChallengesStore.getState().challenges).toHaveLength(0);
  });

  it('fills the following challenge keys in order when the iframe returns several answers', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore.getState().addChallenge(
      createChallengeMessage(
        {
          '1': { challenge: 'https://spamblocker.bitsocial.net/api/v1/iframe/session-123', type: 'url/iframe' },
          '4': { challenge: 'second prompt', type: 'text/plain' },
          '7': { challenge: 'third prompt', type: 'text/plain' },
        },
        publishChallengeAnswers,
      ),
    );
    await renderModal();
    await clickButton('open');

    await postIframeAnswers(['token-a', 'token-b']);

    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '1': 'token-a', '4': 'token-b', '7': '' });
  });

  it('keys the manual Done answer by a sparse iframe challenge index', async () => {
    const publishChallengeAnswers = vi.fn();
    useChallengesStore
      .getState()
      .addChallenge(
        createChallengeMessage({ '2': { challenge: 'https://spamblocker.bitsocial.net/api/v1/iframe/session-123', type: 'url/iframe' } }, publishChallengeAnswers),
      );
    await renderModal();
    await clickButton('open');

    await clickButton('done');

    expect(publishChallengeAnswers).toHaveBeenCalledWith({ '2': '' });
  });
});
