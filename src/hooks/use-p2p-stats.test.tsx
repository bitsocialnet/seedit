// @vitest-environment jsdom

import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getP2PStats, type StatRow } from '../lib/p2p-stats';
import useP2PStats, { type P2PStatsResult } from './use-p2p-stats';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../lib/p2p-stats', () => ({ getP2PStats: vi.fn() }));

const readStats = vi.mocked(getP2PStats);
const committedStats = vi.fn<(stats: P2PStatsResult) => void>();

function StatsOutput({ stats }: { stats: P2PStatsResult }) {
  useLayoutEffect(() => {
    committedStats(stats);
  });
  return <output>{JSON.stringify(stats)}</output>;
}

function StatsHarness() {
  const stats = useP2PStats({ mode: 'browser-libp2p' });
  return <StatsOutput stats={stats} />;
}

const getLatestStats = () => {
  const latest = committedStats.mock.lastCall?.[0];
  if (!latest) throw new Error('No committed stats');
  return latest;
};

const createPendingPoll = () => {
  let resolve!: (rows: StatRow[]) => void;
  const promise = new Promise<StatRow[]>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
};

describe('useP2PStats refresh updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderStats = async () => {
    await act(async () => root.render(<StatsHarness />));
  };

  const refreshStats = async () => {
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    readStats.mockReset();
    committedStats.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('skips committed consumer work for an unchanged pending refresh and publishes completed results and timestamps', async () => {
    const firstRows: StatRow[] = [{ name: 'peers', value: '1' }];
    readStats.mockResolvedValueOnce(firstRows);
    await renderStats();
    expect(getLatestStats()).toMatchObject({ loading: false, rows: firstRows, updatedAt: 1_000_000 });

    const poll = createPendingPoll();
    readStats.mockReturnValueOnce(poll.promise);
    committedStats.mockClear();
    await refreshStats();
    expect(readStats).toHaveBeenCalledTimes(2);
    expect(committedStats).not.toHaveBeenCalled();
    expect(container.textContent).toContain('"value":"1"');

    const updatedRows: StatRow[] = [{ name: 'peers', value: '2' }];
    await act(async () => poll.resolve(updatedRows));
    expect(committedStats).toHaveBeenCalledOnce();
    expect(getLatestStats()).toMatchObject({ loading: false, rows: updatedRows, updatedAt: 1_005_000 });

    readStats.mockResolvedValueOnce(updatedRows);
    await refreshStats();
    expect(getLatestStats().rows).toBe(updatedRows);
    expect(getLatestStats().updatedAt).toBe(1_010_000);
  });

  it('reports failures and clears an old error when a retry starts while retaining the last response timestamp', async () => {
    const rows: StatRow[] = [{ name: 'peers', value: '1' }];
    readStats.mockResolvedValueOnce(rows);
    await renderStats();

    readStats.mockRejectedValueOnce(new Error('offline'));
    await refreshStats();
    expect(getLatestStats()).toMatchObject({ error: 'offline', loading: false, rows, updatedAt: 1_005_000 });

    const retry = createPendingPoll();
    readStats.mockReturnValueOnce(retry.promise);
    committedStats.mockClear();
    await refreshStats();
    expect(committedStats).toHaveBeenCalledOnce();
    expect(getLatestStats()).toEqual({ error: undefined, loading: false, rows, updatedAt: 1_005_000 });

    await act(async () => retry.resolve(rows));
    expect(getLatestStats()).toEqual({ error: undefined, loading: false, rows, updatedAt: 1_010_000 });
  });

  it('still shows loading when refreshing a completed empty result', async () => {
    readStats.mockResolvedValueOnce([]);
    await renderStats();
    expect(getLatestStats().loading).toBe(false);

    const poll = createPendingPoll();
    readStats.mockReturnValueOnce(poll.promise);
    committedStats.mockClear();
    await refreshStats();
    expect(committedStats).toHaveBeenCalledOnce();
    expect(getLatestStats()).toEqual({ error: undefined, loading: true, rows: [], updatedAt: 1_000_000 });

    await act(async () => poll.resolve([]));
    expect(getLatestStats()).toEqual({ error: undefined, loading: false, rows: [], updatedAt: 1_005_000 });
  });
});
