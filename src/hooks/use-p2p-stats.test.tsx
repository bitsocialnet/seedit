// @vitest-environment jsdom

import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityLoadStatus } from '@bitsocial/bitsocial-react-hooks';
import { getP2PStats, type AccountShape, type ConnectedPeersStatRow, type StatRow } from '../lib/p2p-stats';
import type { P2PRuntimeMode } from '../lib/p2p-runtime';
import useP2PStats, { type P2PStatsResult } from './use-p2p-stats';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const communitiesState = vi.hoisted(() => ({ loadStatuses: [] as Pick<CommunityLoadStatus, 'firstLoadFailed'>[] }));
const loadCommunities = vi.hoisted(() => vi.fn());

vi.mock('../lib/p2p-stats', () => ({ getP2PStats: vi.fn() }));
vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCommunities: (options: unknown) => {
    loadCommunities(options);
    return { communityLoadStatuses: communitiesState.loadStatuses };
  },
}));

const readStats = vi.mocked(getP2PStats);
const committedStats = vi.fn<(stats: P2PStatsResult) => void>();

function StatsOutput({ stats }: { stats: P2PStatsResult }) {
  useLayoutEffect(() => {
    committedStats(stats);
  });
  return <output>{JSON.stringify(stats)}</output>;
}

function StatsHarness({ account, mode = 'browser-libp2p' }: { account?: AccountShape; mode?: P2PRuntimeMode }) {
  const stats = useP2PStats({ account, mode });
  return <StatsOutput stats={stats} />;
}

const peersRow = (connectionCount: number): ConnectedPeersStatRow => ({
  connectionCount,
  entries: [],
  name: 'Connected peers',
  peerCount: connectionCount,
  type: 'connectedPeers',
});

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

  const renderStats = async (props: { account?: AccountShape; mode?: P2PRuntimeMode } = {}) => {
    await act(async () => root.render(<StatsHarness {...props} />));
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
    loadCommunities.mockClear();
    communitiesState.loadStatuses = [];
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
    expect(getLatestStats()).toEqual({ connecting: false, error: undefined, loading: false, rows, updatedAt: 1_005_000 });

    await act(async () => retry.resolve(rows));
    expect(getLatestStats()).toEqual({ connecting: false, error: undefined, loading: false, rows, updatedAt: 1_010_000 });
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
    expect(getLatestStats()).toEqual({ connecting: false, error: undefined, loading: true, rows: [], updatedAt: 1_000_000 });

    await act(async () => poll.resolve([]));
    expect(getLatestStats()).toEqual({ connecting: false, error: undefined, loading: false, rows: [], updatedAt: 1_005_000 });
  });
});

describe('useP2PStats while the browser node connects', () => {
  let container: HTMLDivElement;
  let root: Root;
  const account = { subscriptions: ['memes.bso', '12D3KooWCommunity'] };

  const render = async (props: { account?: AccountShape; mode?: P2PRuntimeMode }) => {
    await act(async () => root.render(<StatsHarness {...props} />));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    readStats.mockReset();
    committedStats.mockClear();
    loadCommunities.mockClear();
    communitiesState.loadStatuses = [{ firstLoadFailed: false }, { firstLoadFailed: false }];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("loads the account's communities, so a node with no peers yet reads as connecting until it has a connection", async () => {
    readStats.mockResolvedValueOnce([peersRow(0)]);
    await render({ account });
    expect(loadCommunities).toHaveBeenLastCalledWith({ communities: [{ name: 'memes.bso' }, { publicKey: '12D3KooWCommunity' }] });
    expect(getLatestStats().connecting).toBe(true);

    readStats.mockResolvedValueOnce([peersRow(2)]);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getLatestStats().connecting).toBe(false);
  });

  it('reports no peers, not connecting, once every community has failed to load', async () => {
    communitiesState.loadStatuses = [{ firstLoadFailed: true }, { firstLoadFailed: true }];
    readStats.mockResolvedValueOnce([peersRow(0)]);
    await render({ account });
    expect(getLatestStats().connecting).toBe(false);
  });

  it('loads no communities for a full node, which has its own peers', async () => {
    communitiesState.loadStatuses = [];
    readStats.mockResolvedValueOnce([peersRow(0)]);
    await render({ account, mode: 'full-node-rpc' });
    expect(loadCommunities).toHaveBeenLastCalledWith({ communities: [] });
    expect(getLatestStats().connecting).toBe(false);
  });
});
