import { describe, expect, it } from 'vitest';
import type { SeeditDirectoryCode } from './directory-codes';
import {
  createEmptyDirectoryPreferences,
  dismissAutomaticDirectoryChange,
  joinDirectorySubscription,
  keepBothDirectorySubscriptions,
  keepCurrentDirectorySubscription,
  leaveDirectorySubscription,
  normalizeDirectoryPreferences,
  observeDirectoryWinnerChanges,
  reconcileAutomaticDirectorySwitches,
  setDirectoryAutoSwitch,
  switchDirectorySubscription,
  undoAutomaticDirectorySwitch,
  type AuthoritativeDirectoryWinnerSnapshot,
  type SeeditDirectoryPreferences,
} from './directory-subscriptions';

const winner = (directoryCode: SeeditDirectoryCode, address: string, revision: number): AuthoritativeDirectoryWinnerSnapshot => ({
  directoryCode,
  address,
  revision,
  authoritative: true,
});

const preferences = (
  entries: Record<SeeditDirectoryCode, { address: string; revision?: number; acknowledgedAddress?: string; autoSwitch?: boolean }>,
): SeeditDirectoryPreferences => ({
  schemaVersion: 1,
  slots: Object.fromEntries(
    Object.entries(entries).map(([code, entry]) => [
      code,
      {
        subscriptionAddress: entry.address,
        autoSwitch: entry.autoSwitch ?? false,
        acknowledgedWinner: { address: entry.acknowledgedAddress ?? entry.address, revision: entry.revision ?? 1 },
      },
    ]),
  ),
  automaticChangeNotices: {},
});

describe('directory subscription joins and leaves', () => {
  it('atomically joins only the exact winner and records route provenance', () => {
    const result = joinDirectorySubscription({
      subscriptions: ['manual.bso', 'funny', 'manual.bso'],
      winner: winner('funny', 'funny-posting.bso', 2),
    });

    expect(result.subscriptions).toEqual(['manual.bso', 'funny-posting.bso']);
    expect(result.preferences.slots.funny).toEqual({
      subscriptionAddress: 'funny-posting.bso',
      autoSwitch: false,
      acknowledgedWinner: { address: 'funny-posting.bso', revision: 2 },
    });
    expect(result.subscriptions).not.toContain('funny');
  });

  it('is idempotent and preserves an existing per-slot auto-switch choice', () => {
    const first = joinDirectorySubscription({ subscriptions: [], winner: winner('funny', 'funny-posting.bso', 1) });
    const enabled = setDirectoryAutoSwitch({ ...first, directoryCode: 'funny', enabled: true });
    const second = joinDirectorySubscription({ ...enabled, winner: winner('funny', 'funny-posting.bso', 1) });

    expect(second.subscriptions).toEqual(['funny-posting.bso']);
    expect(second.preferences.slots.funny?.autoSwitch).toBe(true);
  });

  it('does not join a stale or conflicting same-revision winner over existing slot state', () => {
    const initial = {
      subscriptions: ['funny-current.bso'],
      preferences: preferences({ funny: { address: 'funny-current.bso', revision: 3 } }),
    };

    expect(joinDirectorySubscription({ ...initial, winner: winner('funny', 'funny-stale.bso', 2) })).toEqual(initial);
    expect(joinDirectorySubscription({ ...initial, winner: winner('funny', 'funny-conflict.bso', 3) })).toEqual(initial);
  });

  it('manual leave removes the exact address and every slot and notice tracking it', () => {
    const initial = preferences({
      funny: { address: 'shared.bso', autoSwitch: true },
      memes: { address: 'shared.bso' },
      news: { address: 'news.bso' },
    });
    initial.automaticChangeNotices.funny = {
      directoryCode: 'funny',
      fromAddress: 'old-funny.bso',
      toAddress: 'shared.bso',
      winnerRevision: 2,
      addedWinnerSubscription: true,
      removedPreviousSubscription: true,
    };

    const result = leaveDirectorySubscription({
      subscriptions: ['shared.bso', 'news.bso'],
      preferences: initial,
      address: 'shared.bso',
    });

    expect(result.subscriptions).toEqual(['news.bso']);
    expect(result.preferences.slots).toEqual({ news: initial.slots.news });
    expect(result.preferences.automaticChangeNotices).toEqual({});
  });
});

describe('observing authoritative directory winners', () => {
  it('reports only newer authoritative winner changes for manually controlled slots', () => {
    const state = {
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso', revision: 2 } }),
    };

    expect(observeDirectoryWinnerChanges({ ...state, winners: [winner('funny', 'funny-b.bso', 2)] }).pendingChanges).toEqual([]);
    expect(observeDirectoryWinnerChanges({ ...state, winners: [winner('funny', 'funny-b.bso', 1)] }).pendingChanges).toEqual([]);
    expect(observeDirectoryWinnerChanges({ ...state, winners: [winner('funny', 'funny-b.bso', 3)] }).pendingChanges).toEqual([
      {
        directoryCode: 'funny',
        currentAddress: 'funny-a.bso',
        winnerAddress: 'funny-b.bso',
        winnerRevision: 3,
      },
    ]);

    const nonAuthoritative = { ...winner('funny', 'funny-c.bso', 4), authoritative: false } as unknown as AuthoritativeDirectoryWinnerSnapshot;
    expect(observeDirectoryWinnerChanges({ ...state, winners: [nonAuthoritative] }).pendingChanges).toEqual([]);
  });

  it('rejects conflicting winners published at the same revision', () => {
    const state = {
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso' } }),
    };

    expect(
      observeDirectoryWinnerChanges({
        ...state,
        winners: [winner('funny', 'funny-b.bso', 2), winner('funny', 'funny-c.bso', 2)],
      }).pendingChanges,
    ).toEqual([]);
  });

  it('advances acknowledgement when the winner returns, so A to B to A to B prompts twice', () => {
    const initial = {
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso' } }),
    };
    const firstB = observeDirectoryWinnerChanges({ ...initial, winners: [winner('funny', 'funny-b.bso', 2)] });
    expect(firstB.pendingChanges).toHaveLength(1);

    const keptA = keepCurrentDirectorySubscription({ ...firstB, winner: winner('funny', 'funny-b.bso', 2) });
    const returnedA = observeDirectoryWinnerChanges({ ...keptA, winners: [winner('funny', 'funny-a.bso', 3)] });
    expect(returnedA.pendingChanges).toEqual([]);
    expect(returnedA.preferences.slots.funny?.acknowledgedWinner).toEqual({ address: 'funny-a.bso', revision: 3 });

    const secondB = observeDirectoryWinnerChanges({ ...returnedA, winners: [winner('funny', 'funny-b.bso', 4)] });
    expect(secondB.pendingChanges).toEqual([
      {
        directoryCode: 'funny',
        currentAddress: 'funny-a.bso',
        winnerAddress: 'funny-b.bso',
        winnerRevision: 4,
      },
    ]);
  });

  it('drops stale slot tracking when its exact address was removed outside Seedit', () => {
    const result = observeDirectoryWinnerChanges({
      subscriptions: ['manual.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso' } }),
      winners: [winner('funny', 'funny-b.bso', 2)],
    });

    expect(result.preferences.slots).toEqual({});
    expect(result.pendingChanges).toEqual([]);
    expect(result.subscriptions).toEqual(['manual.bso']);
  });
});

describe('manual winner-change choices', () => {
  const initial = {
    subscriptions: ['manual.bso', 'funny-a.bso'],
    preferences: preferences({ funny: { address: 'funny-a.bso' } }),
  };

  it('keeps the current exact subscription while acknowledging the winner', () => {
    const result = keepCurrentDirectorySubscription({ ...initial, winner: winner('funny', 'funny-b.bso', 2) });

    expect(result.subscriptions).toEqual(initial.subscriptions);
    expect(result.preferences.slots.funny).toMatchObject({
      subscriptionAddress: 'funny-a.bso',
      acknowledgedWinner: { address: 'funny-b.bso', revision: 2 },
    });
  });

  it('keeps both exact addresses but tracks the new winner from then on', () => {
    const result = keepBothDirectorySubscriptions({ ...initial, winner: winner('funny', 'funny-b.bso', 2) });

    expect(result.subscriptions).toEqual(['manual.bso', 'funny-a.bso', 'funny-b.bso']);
    expect(result.preferences.slots.funny).toMatchObject({
      subscriptionAddress: 'funny-b.bso',
      acknowledgedWinner: { address: 'funny-b.bso', revision: 2 },
    });
  });

  it('switches the attributable address and deduplicates an already-subscribed winner', () => {
    const result = switchDirectorySubscription({
      ...initial,
      subscriptions: [...initial.subscriptions, 'funny-b.bso', 'funny-b.bso'],
      winner: winner('funny', 'funny-b.bso', 2),
    });

    expect(result.subscriptions).toEqual(['manual.bso', 'funny-b.bso']);
    expect(result.preferences.slots.funny?.subscriptionAddress).toBe('funny-b.bso');
  });

  it('preserves an old exact address while another directory slot still tracks it', () => {
    const sharedPreferences = preferences({
      funny: { address: 'shared.bso' },
      memes: { address: 'shared.bso' },
    });
    const first = switchDirectorySubscription({
      subscriptions: ['shared.bso'],
      preferences: sharedPreferences,
      winner: winner('funny', 'funny-b.bso', 2),
    });
    expect(first.subscriptions).toEqual(['shared.bso', 'funny-b.bso']);

    const second = switchDirectorySubscription({ ...first, winner: winner('memes', 'memes-b.bso', 2) });
    expect(second.subscriptions).toEqual(['funny-b.bso', 'memes-b.bso']);
  });

  it('ignores same and stale revisions for every manual choice', () => {
    const stale = winner('funny', 'funny-b.bso', 1);
    expect(keepCurrentDirectorySubscription({ ...initial, winner: stale }).subscriptions).toEqual(initial.subscriptions);
    expect(keepBothDirectorySubscriptions({ ...initial, winner: stale }).subscriptions).toEqual(initial.subscriptions);
    expect(switchDirectorySubscription({ ...initial, winner: stale }).subscriptions).toEqual(initial.subscriptions);
  });
});

describe('per-directory automatic switching', () => {
  it('switches only opted-in slots and persists an undoable informational notice', () => {
    const initial = {
      subscriptions: ['funny-a.bso', 'news-a.bso'],
      preferences: preferences({
        funny: { address: 'funny-a.bso', autoSwitch: true },
        news: { address: 'news-a.bso' },
      }),
    };
    const result = reconcileAutomaticDirectorySwitches({
      ...initial,
      winners: [winner('news', 'news-b.bso', 2), winner('funny', 'funny-b.bso', 2)],
    });

    expect(initial).toEqual({
      subscriptions: ['funny-a.bso', 'news-a.bso'],
      preferences: preferences({
        funny: { address: 'funny-a.bso', autoSwitch: true },
        news: { address: 'news-a.bso' },
      }),
    });
    expect(result.subscriptions).toEqual(['news-a.bso', 'funny-b.bso']);
    expect(result.preferences.slots.funny?.subscriptionAddress).toBe('funny-b.bso');
    expect(result.preferences.slots.news?.subscriptionAddress).toBe('news-a.bso');
    expect(result.preferences.automaticChangeNotices.funny).toEqual({
      directoryCode: 'funny',
      fromAddress: 'funny-a.bso',
      toAddress: 'funny-b.bso',
      winnerRevision: 2,
      addedWinnerSubscription: true,
      removedPreviousSubscription: true,
    });
  });

  it('does not claim or later remove a winner that was already subscribed', () => {
    const switched = reconcileAutomaticDirectorySwitches({
      subscriptions: ['funny-a.bso', 'funny-b.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso', autoSwitch: true } }),
      winners: [winner('funny', 'funny-b.bso', 2)],
    });

    expect(switched.subscriptions).toEqual(['funny-b.bso']);
    expect(switched.preferences.automaticChangeNotices.funny?.addedWinnerSubscription).toBe(false);

    const undone = undoAutomaticDirectorySwitch({ ...switched, directoryCode: 'funny' });
    expect(undone.subscriptions).toEqual(['funny-b.bso', 'funny-a.bso']);
    expect(undone.preferences.slots.funny?.autoSwitch).toBe(false);
  });

  it('preserves a shared previous address and removes it only after the final slot switches', () => {
    const initialPreferences = preferences({
      funny: { address: 'shared.bso', autoSwitch: true },
      memes: { address: 'shared.bso', autoSwitch: true },
    });
    const result = reconcileAutomaticDirectorySwitches({
      subscriptions: ['shared.bso'],
      preferences: initialPreferences,
      winners: [winner('memes', 'memes-b.bso', 2), winner('funny', 'funny-b.bso', 2)],
    });

    expect(result.subscriptions).toEqual(['funny-b.bso', 'memes-b.bso']);
    expect(result.preferences.automaticChangeNotices.funny?.removedPreviousSubscription).toBe(false);
    expect(result.preferences.automaticChangeNotices.memes?.removedPreviousSubscription).toBe(true);
  });

  it('undo restores the old exact address, removes an automatically added winner, and disables auto-switch', () => {
    const switched = reconcileAutomaticDirectorySwitches({
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso', autoSwitch: true } }),
      winners: [winner('funny', 'funny-b.bso', 2)],
    });
    const undone = undoAutomaticDirectorySwitch({ ...switched, directoryCode: 'funny' });

    expect(undone.subscriptions).toEqual(['funny-a.bso']);
    expect(undone.preferences.slots.funny).toEqual({
      subscriptionAddress: 'funny-a.bso',
      autoSwitch: false,
      acknowledgedWinner: { address: 'funny-b.bso', revision: 2 },
    });
    expect(undone.preferences.automaticChangeNotices).toEqual({});
    expect(reconcileAutomaticDirectorySwitches({ ...undone, winners: [winner('funny', 'funny-b.bso', 2)] }).subscriptions).toEqual(['funny-a.bso']);
  });

  it('can dismiss an automatic notice without changing subscriptions', () => {
    const switched = reconcileAutomaticDirectorySwitches({
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso', autoSwitch: true } }),
      winners: [winner('funny', 'funny-b.bso', 2)],
    });
    const dismissed = dismissAutomaticDirectoryChange({ ...switched, directoryCode: 'funny' });

    expect(dismissed.subscriptions).toEqual(switched.subscriptions);
    expect(dismissed.preferences.automaticChangeNotices).toEqual({});
  });

  it('keeps an automatic notice available for undo when auto-switch is turned off separately', () => {
    const switched = reconcileAutomaticDirectorySwitches({
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso', autoSwitch: true } }),
      winners: [winner('funny', 'funny-b.bso', 2)],
    });
    const disabled = setDirectoryAutoSwitch({ ...switched, directoryCode: 'funny', enabled: false });

    expect(disabled.preferences.automaticChangeNotices.funny).toEqual(switched.preferences.automaticChangeNotices.funny);
    expect(undoAutomaticDirectorySwitch({ ...disabled, directoryCode: 'funny' }).subscriptions).toEqual(['funny-a.bso']);
  });

  it('advances acknowledgement without a notice when an enabled slot winner returns to its subscribed address', () => {
    const result = reconcileAutomaticDirectorySwitches({
      subscriptions: ['funny-a.bso'],
      preferences: preferences({
        funny: { address: 'funny-a.bso', acknowledgedAddress: 'funny-b.bso', revision: 2, autoSwitch: true },
      }),
      winners: [winner('funny', 'funny-a.bso', 3)],
    });

    expect(result.subscriptions).toEqual(['funny-a.bso']);
    expect(result.preferences.slots.funny?.acknowledgedWinner).toEqual({ address: 'funny-a.bso', revision: 3 });
    expect(result.preferences.automaticChangeNotices).toEqual({});
  });

  it('does not enable automatic switching after the tracked exact address disappeared', () => {
    const result = setDirectoryAutoSwitch({
      subscriptions: [],
      preferences: preferences({ funny: { address: 'funny-a.bso' } }),
      directoryCode: 'funny',
      enabled: true,
    });

    expect(result.preferences.slots).toEqual({});
  });

  it('ignores same and stale revisions for automatic switching', () => {
    const initial = {
      subscriptions: ['funny-a.bso'],
      preferences: preferences({ funny: { address: 'funny-a.bso', revision: 2, autoSwitch: true } }),
    };

    expect(reconcileAutomaticDirectorySwitches({ ...initial, winners: [winner('funny', 'funny-b.bso', 2)] }).subscriptions).toEqual(['funny-a.bso']);
    expect(reconcileAutomaticDirectorySwitches({ ...initial, winners: [winner('funny', 'funny-b.bso', 1)] }).subscriptions).toEqual(['funny-a.bso']);
  });

  it('keeps empty schema-v1 preferences deterministic', () => {
    expect(createEmptyDirectoryPreferences()).toEqual({ schemaVersion: 1, slots: {}, automaticChangeNotices: {} });
  });
});

describe('directory preference validation', () => {
  it('keeps slots for directories published after this build and drops keys that cannot be directory codes', () => {
    const normalized = normalizeDirectoryPreferences(
      preferences({ dogs: { address: 'good-dogs.bso' }, all: { address: 'all-posting.bso' }, 'dogs.bso': { address: 'dogs-posting.bso' } }),
    );

    expect(Object.keys(normalized.slots)).toEqual(['dogs']);
    expect(leaveDirectorySubscription({ subscriptions: ['good-dogs.bso', 'manual.bso'], preferences: normalized, address: 'manual.bso' }).preferences.slots.dogs).toEqual(
      normalized.slots.dogs,
    );
  });
});
