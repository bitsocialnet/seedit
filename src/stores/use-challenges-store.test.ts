import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useChallengesStore from './use-challenges-store';

const createChallenge = (publisher: object = {}) => [{ challenges: [] }, publisher] as never;

// A pkc-js publication waiting for a challenge answer. The hooks listen to its errors, so an error event does not throw.
const createPublication = () => {
  const publication = Object.assign(new EventEmitter(), { state: 'publishing', publishingState: 'waiting-challenge-answers' });
  publication.on('error', () => {});
  return publication;
};

// pkc-js 0.0.154 emits these when a publication fails, e.g. the community gave up waiting for an answer it never got
// or the RPC server failed the publish
const failPublication = (publication: ReturnType<typeof createPublication>) => {
  publication.state = 'stopped';
  publication.emit('statechange', 'stopped');
  publication.publishingState = 'failed';
  publication.emit('error', new Error('publication failed'));
  publication.emit('publishingstatechange', 'failed');
};

// An error pkc-js recovers from, such as a challenge it cannot decrypt, sets publishingState "failed" and keeps the
// exchange, and so the state, "publishing"
const emitRecoverableError = (publication: ReturnType<typeof createPublication>) => {
  publication.publishingState = 'failed';
  publication.emit('error', new Error('failed to decrypt challenge'));
  publication.emit('publishingstatechange', 'failed');
};

const queuedPublications = () => useChallengesStore.getState().challenges.map((entry) => entry.challenge[1]);

afterEach(() => {
  useChallengesStore.setState({ challenges: [] });
  vi.restoreAllMocks();
});

describe('useChallengesStore', () => {
  it('queues unique entries FIFO and removes the head before awaiting abandonment', async () => {
    let finishAbandon: (() => void) | undefined;
    const onAbandon = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishAbandon = resolve;
        }),
    );
    const firstChallenge = createChallenge();
    const secondChallenge = createChallenge();

    useChallengesStore.getState().addChallenge(firstChallenge, onAbandon);
    useChallengesStore.getState().addChallenge(secondChallenge);

    const [first, second] = useChallengesStore.getState().challenges;
    expect(first.challenge).toBe(firstChallenge);
    expect(second.challenge).toBe(secondChallenge);
    expect(first.id).not.toBe(second.id);

    const abandonment = useChallengesStore.getState().abandonCurrentChallenge();

    expect(onAbandon).toHaveBeenCalledOnce();
    expect(useChallengesStore.getState().challenges.map((entry) => entry.challenge)).toEqual([secondChallenge]);

    finishAbandon?.();
    await abandonment;
  });

  it('falls back to stopping the live publisher when no callback is supplied', async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    useChallengesStore.getState().addChallenge(createChallenge({ stop }));

    await useChallengesStore.getState().abandonCurrentChallenge();

    expect(stop).toHaveBeenCalledOnce();
    expect(useChallengesStore.getState().challenges).toEqual([]);
  });

  it('logs abandonment failures after removing the challenge', async () => {
    const error = new Error('stop failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useChallengesStore.getState().addChallenge(createChallenge(), vi.fn().mockRejectedValue(error));

    await expect(useChallengesStore.getState().abandonCurrentChallenge()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith('Failed to abandon challenge publication:', error);
    expect(useChallengesStore.getState().challenges).toEqual([]);
  });

  it('drops a queued challenge once its exchange ends, but not on an error the exchange recovers from', () => {
    const failing = createPublication();
    const verified = createPublication();
    const waiting = createPublication();
    useChallengesStore.getState().addChallenge(createChallenge(failing));
    useChallengesStore.getState().addChallenge(createChallenge(verified));
    useChallengesStore.getState().addChallenge(createChallenge(waiting));

    emitRecoverableError(failing);
    expect(queuedPublications()).toEqual([failing, verified, waiting]);

    failPublication(failing);
    expect(queuedPublications()).toEqual([verified, waiting]);

    // a verdict, here for a challenge that is not the one shown, ends the exchange too
    verified.publishingState = 'failed';
    verified.state = 'stopped';
    verified.emit('challengeverification', { challengeSuccess: false, reason: 'timed out waiting for the challenge answer' });
    verified.emit('statechange', 'stopped');
    expect(queuedPublications()).toEqual([waiting]);
    expect(failing.listenerCount('statechange')).toBe(0);
    expect(verified.listenerCount('statechange')).toBe(0);
  });

  it('stops watching a publication once its challenge is answered or abandoned', async () => {
    const answered = createPublication();
    const abandoned = Object.assign(createPublication(), {
      stop: vi.fn(async () => {
        abandoned.state = 'stopped';
        abandoned.emit('statechange', 'stopped');
      }),
    });
    const next = createPublication();
    useChallengesStore.getState().addChallenge(createChallenge(answered));
    useChallengesStore.getState().addChallenge(createChallenge(abandoned));
    useChallengesStore.getState().addChallenge(createChallenge(next));

    useChallengesStore.getState().removeChallenge();
    expect(answered.listenerCount('statechange')).toBe(0);

    await useChallengesStore.getState().abandonCurrentChallenge();
    expect(abandoned.stop).toHaveBeenCalledOnce();
    expect(abandoned.listenerCount('statechange')).toBe(0);
    expect(queuedPublications()).toEqual([next]);
  });
});
