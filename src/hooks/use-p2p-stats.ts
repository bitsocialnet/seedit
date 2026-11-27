import { useEffect, useReducer, useRef } from 'react';
import { useCommunities } from '@bitsocial/bitsocial-react-hooks';
import { getP2PStats, type AccountShape, type ConnectedPeersStatRow, type StatRow } from '../lib/p2p-stats';
import type { P2PRuntimeMode } from '../lib/p2p-runtime';
import { getCommunityIdentifiers } from './use-community-identifier';

const STATS_REFRESH_MS = 5000;

type StatsState = {
  error?: string;
  loading: boolean;
  rows: StatRow[];
  updatedAt?: number;
};

type StatsAction =
  | {
      type: 'loading';
    }
  | {
      rows: StatRow[];
      timestamp: number;
      type: 'loaded';
    }
  | {
      error: string;
      timestamp: number;
      type: 'failed';
    };

const statsReducer = (state: StatsState, action: StatsAction): StatsState => {
  if (action.type === 'loading') {
    const loading = state.rows.length === 0;
    if (state.error === undefined && state.loading === loading) return state;
    return { ...state, error: undefined, loading };
  }
  if (action.type === 'loaded') return { loading: false, rows: action.rows, updatedAt: action.timestamp };
  return { ...state, error: action.error, loading: false, updatedAt: action.timestamp };
};

const getErrorMessage = (error: unknown, fallback = 'Error') => (error instanceof Error ? error.message : String(error || fallback));

const isConnectedPeersRow = (row: StatRow): row is ConnectedPeersStatRow => 'type' in row && row.type === 'connectedPeers';

const getSubscriptions = (account: AccountShape | undefined): string[] =>
  Array.isArray(account?.subscriptions) ? account.subscriptions.filter((address: unknown): address is string => typeof address === 'string') : [];

export interface UseP2PStatsOptions {
  account?: AccountShape;
  mode?: P2PRuntimeMode | null;
  rpcState?: string;
}

export interface P2PStatsResult {
  /** The browser node has no connection yet while it loads the account's communities: its peers are still to come. */
  connecting: boolean;
  error?: string;
  loading: boolean;
  rows: StatRow[];
  updatedAt?: number;
}

// Polls the P2P stats engine (getP2PStats) every STATS_REFRESH_MS and exposes
// the reducer-managed result. Refreshes once immediately, then on interval,
// aborting in-flight work and skipping dispatches after unmount or a dependency
// change so stale results never overwrite fresh state.
export const useP2PStats = ({ account, mode, rpcState }: UseP2PStatsOptions): P2PStatsResult => {
  const [statsState, dispatchStats] = useReducer(statsReducer, { loading: !!mode, rows: [] });
  const accountRef = useRef(account);
  accountRef.current = account;

  // pkc-js starts the browser node without peer discovery: it dials peers only to fetch content. Opened on its own,
  // as after a refresh, the stats page fetches none, so the node would stay without peers; loading the account's
  // communities, as the home feed does, connects it.
  const subscriptions = mode === 'browser-libp2p' ? getSubscriptions(account) : [];
  const { communityLoadStatuses } = useCommunities({ communities: getCommunityIdentifiers(subscriptions) });
  // Once every community has failed to load, the node is not about to connect, and its count of none is the answer.
  const canConnect = communityLoadStatuses.some((status) => !status.firstLoadFailed);
  const connecting = canConnect && statsState.rows.some((row) => isConnectedPeersRow(row) && row.connectionCount === 0);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;
    const activeMode = mode;

    if (!activeMode) return () => abortController.abort();

    const refreshStats = async () => {
      dispatchStats({ type: 'loading' });
      try {
        const rows = await getP2PStats(activeMode, accountRef.current, rpcState, signal);
        if (!signal.aborted) dispatchStats({ rows, timestamp: Date.now(), type: 'loaded' });
      } catch (error) {
        if (!signal.aborted) {
          dispatchStats({
            error: getErrorMessage(error),
            timestamp: Date.now(),
            type: 'failed',
          });
        }
      }
    };

    void refreshStats();
    const intervalId = window.setInterval(refreshStats, STATS_REFRESH_MS);
    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, [mode, rpcState]);

  return { connecting, error: statsState.error, loading: statsState.loading, rows: statsState.rows, updatedAt: statsState.updatedAt };
};

export default useP2PStats;
