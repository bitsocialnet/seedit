// P2P stats engine: data collection, transfer-stat instrumentation, peer
// normalization, and public-endpoint resolution behind the P2P stats settings
// UI. Extracted from p2p-stats-settings.tsx so the settings component renders
// only and this networking logic has a dedicated, testable home. Polling and
// reducer state live in src/hooks/use-p2p-stats.ts.
import {
  fetchIpMapLocation,
  fetchOwnIpCountryCode,
  fetchOwnPublicEndpoint,
  fetchPeerMapLocation,
  getApproximateCountryCode,
  getCountryConsistentLocation,
  getFirstPublicIpFromAddresses,
  isPrivateOrReservedIpv4,
  type PeerMapLocation,
  type PublicEndpoint,
} from './peer-geo';
import type { P2PRuntimeMode } from './p2p-runtime';

type AccountShape = Record<string, any>;

type TextStatRow = {
  name: string;
  type?: 'text';
  value: string;
};

type ConnectedPeerEntry = {
  address: string;
  countryCode?: string;
  direction?: string;
  id: string;
  location?: PeerMapLocation;
  // Address with the peer's own public IP, used for the flag and map when `address` has none.
  locationAddress?: string;
  peerId: string;
  role?: PeerConnectionRole;
  status?: string;
  transferStats?: TransferStats;
  transport: string;
};

type PeerConnectionRole = 'leecher' | 'seeder';

type PeerMapEntry = {
  address: string;
  id: string;
  location?: PeerMapLocation;
  peerId: string;
  role?: PeerConnectionRole;
};

type ConnectedPeersStatRow = {
  connectionCount: number;
  entries: ConnectedPeerEntry[];
  mapEntries?: PeerMapEntry[];
  name: string;
  peerCount: number;
  type: 'connectedPeers';
};

type NodeEndpointStatRow = {
  countryCode?: string;
  ip: string;
  name: string;
  type: 'nodeEndpoint';
};

type StatRow = ConnectedPeersStatRow | NodeEndpointStatRow | TextStatRow;

type Libp2pClientShape = {
  _helia?: {
    libp2p?: {
      getConnections?: () => unknown[] | Promise<unknown[]>;
      getPeers?: () => unknown[] | Promise<unknown[]>;
      peerId?: { toString: () => string };
      peerStore?: {
        get?: (peerId: unknown) => unknown;
      };
      services?: {
        pubsub?: {
          getPeers?: () => unknown[] | Promise<unknown[]>;
        };
      };
      metrics?: unknown;
    };
    metrics?: unknown;
    routing?: {
      routers?: unknown[];
    };
  };
  heliaWithKuboRpcClientFunctions?: {
    add?: unknown;
  };
  key?: string;
};

type PkcRpcClientShape = {
  getPeers?: () => unknown | Promise<unknown>;
  getStats?: () => unknown | Promise<unknown>;
  state?: string;
};

type TransferStats = {
  downloadedBytes?: number;
  uploadedBytes?: number;
};

type TransferStatsSnapshot = {
  peers: Map<string, TransferStats>;
  totals: TransferStats;
};

type ObservedTransferStats = {
  connections: WeakSet<object>;
  downloadedBytes: number;
  peers: Map<string, TransferStats>;
  streams: WeakSet<object>;
  uploadedBytes: number;
};

const KUBO_API_URL = 'http://localhost:50019/api/v0';
const SEEDER_REPO_URL = 'https://github.com/bitsocialnet/bitsocial-seeder';
const transparentPixelSrc = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
const MAX_TRANSFER_COUNTER_DEPTH = 10;
const MAX_TRANSFER_COUNTER_OBJECTS = 400;
const observedBrowserTransferStats = new WeakMap<object, ObservedTransferStats>();

const formatCount = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const formatBytes = (value: unknown) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value ?? 'unknown');
  if (numericValue < 1024) return `${numericValue} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = numericValue / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const formatOptionalBytes = (value: unknown) => (getFiniteNumber(value) === undefined ? 'unknown' : formatBytes(value));

const getFirstObjectValue = <T>(value?: Record<string, T>) => (value ? Object.values(value)[0] : undefined);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const getStringValue = (value: unknown, fallback = 'unknown') => {
  if (value === null || value === undefined) return fallback;
  try {
    const stringValue = String(value);
    return stringValue || fallback;
  } catch {
    return fallback;
  }
};

const getFiniteNumber = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const addTransferStats = (stats: TransferStats, direction: keyof TransferStats, value: unknown) => {
  const numericValue = getFiniteNumber(value);
  if (numericValue === undefined) return;
  stats[direction] = (stats[direction] ?? 0) + numericValue;
};

const mergeTransferStats = (primary: TransferStats, fallback: TransferStats): TransferStats => ({
  downloadedBytes: primary.downloadedBytes ?? fallback.downloadedBytes,
  uploadedBytes: primary.uploadedBytes ?? fallback.uploadedBytes,
});

const createTransferStatsSnapshot = (): TransferStatsSnapshot => ({ peers: new Map(), totals: {} });

const hasTransferStats = (stats?: TransferStats) => stats?.downloadedBytes !== undefined || stats?.uploadedBytes !== undefined;

const getPeerTransferKey = (value: unknown) => {
  const key = getStringValue(value, '').trim();
  if (!key) return undefined;
  const normalizedKey = key.toLowerCase();
  if (/^\d+$/.test(key) || ['global', 'value', 'total', 'sum', 'count'].includes(normalizedKey) || normalizedKey.includes('bytes') || normalizedKey.includes('rate')) {
    return undefined;
  }
  return key;
};

const addPeerTransferStats = (peers: Map<string, TransferStats>, peerKey: unknown, direction: keyof TransferStats, value: unknown) => {
  const key = getPeerTransferKey(peerKey);
  if (!key) return;
  const stats = peers.get(key) ?? {};
  addTransferStats(stats, direction, value);
  if (hasTransferStats(stats)) peers.set(key, stats);
};

const addTransferSnapshotStats = (snapshot: TransferStatsSnapshot, direction: keyof TransferStats, value: unknown, peerKey?: unknown) => {
  addTransferStats(snapshot.totals, direction, value);
  if (peerKey !== undefined) addPeerTransferStats(snapshot.peers, peerKey, direction, value);
};

const mergeTransferSnapshots = (primary: TransferStatsSnapshot, fallback: TransferStatsSnapshot): TransferStatsSnapshot => {
  const peers = new Map<string, TransferStats>();
  for (const [peerKey, stats] of fallback.peers) peers.set(peerKey, stats);
  for (const [peerKey, stats] of primary.peers) peers.set(peerKey, mergeTransferStats(stats, peers.get(peerKey) ?? {}));
  return {
    peers,
    totals: mergeTransferStats(primary.totals, fallback.totals),
  };
};

const getEntries = (value: unknown): [string, unknown][] => {
  try {
    if (value instanceof Map) return Array.from(value.entries()).map(([key, entry]) => [String(key), entry]);
    if (Array.isArray(value)) return value.map((entry, index) => [String(index), entry]);
    if (isRecord(value)) return Object.entries(value);
    return [];
  } catch {
    return [];
  }
};

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Symbol.iterator in value) return Array.from(value as Iterable<unknown>);
  return [];
};

const getRecordField = (record: unknown, fields: string[]) => {
  if (!isRecord(record)) return undefined;
  for (const field of fields) {
    if (field in record) return record[field];
  }
  return undefined;
};

const getStringField = (record: unknown, fields: string[], fallback = '') => {
  const value = getRecordField(record, fields);
  if (Array.isArray(value)) return getStringValue(value[0], fallback);
  return getStringValue(value, fallback);
};

const getAddressValues = (value: unknown): string[] => {
  const iterableValues = Array.isArray(value) ? value : toArray(value);
  const values = iterableValues.length ? iterableValues : [value];
  return values.flatMap((entry) => {
    const address = getStringValue(entry, '');
    return address ? [address] : [];
  });
};

const getNestedValue = (source: unknown, path: string[]) => {
  let current = source;
  for (const key of path) {
    if (!isRecord(current) || !(key in current)) return undefined;
    current = current[key];
  }
  return current;
};

const getFirstNestedValue = (source: unknown, paths: string[][]) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined) return value;
  }
  return undefined;
};

const getSafeArray = async (getValue?: () => unknown[] | Promise<unknown[]> | undefined): Promise<unknown[]> => {
  try {
    return toArray(getValue ? await getValue() : undefined);
  } catch {
    return [];
  }
};

const getFirstPkcRpcClient = (account?: AccountShape) => getFirstObjectValue(account?.pkc?.clients?.pkcRpcClients) as PkcRpcClientShape | undefined;

const getPkcRpcUrls = (account?: AccountShape) => {
  const optionUrls = Array.isArray(account?.pkcOptions?.pkcRpcClientsOptions) ? account.pkcOptions.pkcRpcClientsOptions : [];
  const clientUrls = isRecord(account?.pkc?.clients?.pkcRpcClients) ? Object.keys(account.pkc.clients.pkcRpcClients) : [];
  return [...new Set([...optionUrls, ...clientUrls].filter((url): url is string => typeof url === 'string' && url.trim().length > 0))];
};

const getByteLength = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return new TextEncoder().encode(value).byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (isRecord(value)) {
    const directByteLength = getFiniteNumber(value.byteLength);
    if (directByteLength !== undefined) return directByteLength;
    const dataByteLength = getByteLength(value.data);
    if (dataByteLength !== undefined) return dataByteLength;
  }
  if (Array.isArray(value)) {
    const total = value.reduce((sum, entry) => sum + (getByteLength(entry) ?? 0), 0);
    return total > 0 ? total : undefined;
  }
  return undefined;
};

const getTransferStatsFromHeliaCounters = (helia: unknown): TransferStatsSnapshot => {
  const snapshot = createTransferStatsSnapshot();
  const visited = new WeakSet<object>();
  let objectsVisited = 0;

  const visit = (value: unknown, depth: number, peerKey?: string) => {
    try {
      if (!isRecord(value) || visited.has(value) || depth > MAX_TRANSFER_COUNTER_DEPTH || objectsVisited > MAX_TRANSFER_COUNTER_OBJECTS) return;
      visited.add(value);
      objectsVisited++;

      if ('bytesReceived' in value || 'bytesSent' in value) {
        const directPeerKey = getPeerTransferKey(getRecordField(value, ['peerId', 'peer', 'Peer', 'id', 'remotePeer'])) ?? peerKey;
        addTransferSnapshotStats(snapshot, 'downloadedBytes', value.bytesReceived, directPeerKey);
        addTransferSnapshotStats(snapshot, 'uploadedBytes', value.bytesSent, directPeerKey);
      }

      for (const [key, entry] of getEntries(value)) {
        if (typeof entry === 'function' || key === 'logger' || key === 'log' || key === 'events' || key === 'datastore' || key === 'routing') continue;
        const nextPeerKey = peerKey ?? (isRecord(entry) && ('bytesReceived' in entry || 'bytesSent' in entry) ? getPeerTransferKey(key) : undefined);
        visit(entry, depth + 1, nextPeerKey);
      }
    } catch {
      return;
    }
  };

  visit(helia, 0);
  return snapshot;
};

const classifyTransferMetricPath = (path: string[]) => {
  const normalizedPath = path
    .join('_')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (normalizedPath.includes('rate')) return undefined;
  if (
    normalizedPath.includes('totalin') ||
    normalizedPath.includes('bytesreceived') ||
    normalizedPath.includes('receivedbytes') ||
    normalizedPath.includes('datareceivedbytes')
  ) {
    return 'downloadedBytes' as const;
  }
  if (
    normalizedPath.includes('totalout') ||
    normalizedPath.includes('bytessent') ||
    normalizedPath.includes('sentbytes') ||
    normalizedPath.includes('datasentbytes') ||
    normalizedPath.includes('sentdatabytes')
  ) {
    return 'uploadedBytes' as const;
  }
  return undefined;
};

const getMetricSnapshot = async (source: unknown) => {
  if (!isRecord(source)) return source;
  const snapshots = await Promise.all(
    ['getMetrics', 'getMetricValues', 'toJSON'].map(async (method) => {
      const candidate = source[method];
      if (typeof candidate !== 'function') return undefined;
      try {
        return await candidate.call(source);
      } catch {
        return undefined;
      }
    }),
  );
  return snapshots.find((snapshot) => snapshot !== undefined) ?? source;
};

const getTransferStatsFromMetricSnapshot = (metricSnapshot: unknown): TransferStatsSnapshot => {
  const snapshot = createTransferStatsSnapshot();
  const visited = new WeakSet<object>();

  const visit = (value: unknown, path: string[], depth: number) => {
    const direction = classifyTransferMetricPath(path);
    const numericValue = getFiniteNumber(value);
    if (direction && numericValue !== undefined) {
      addTransferStats(snapshot.totals, direction, numericValue);
      return;
    }

    if (!isRecord(value) || visited.has(value) || depth > MAX_TRANSFER_COUNTER_DEPTH) return;
    visited.add(value);

    if (direction) {
      const totalValue = 'global' in value ? value.global : 'value' in value ? value.value : undefined;
      const hasTotalValue = getFiniteNumber(totalValue) !== undefined;
      if (hasTotalValue) addTransferStats(snapshot.totals, direction, totalValue);

      let foundPeerValue = false;
      for (const [key, entry] of getEntries(value)) {
        const peerKey = getPeerTransferKey(key);
        const peerValue = getFiniteNumber(entry);
        if (!peerKey || peerValue === undefined) continue;
        addPeerTransferStats(snapshot.peers, peerKey, direction, peerValue);
        if (!hasTotalValue) addTransferStats(snapshot.totals, direction, peerValue);
        foundPeerValue = true;
      }

      if (hasTotalValue || foundPeerValue) return;
    }

    for (const [key, entry] of getEntries(value)) visit(entry, [...path, key], depth + 1);
  };

  visit(metricSnapshot, [], 0);
  return snapshot;
};

const getTransferStatsFromSources = (sources: unknown[]): TransferStats =>
  sources.reduce<TransferStats>((stats, source) => {
    if (!isRecord(source)) return stats;
    const downloadedBytes = source.totalIn ?? source.TotalIn ?? source.downloadedBytes ?? source.bytesReceived ?? source.receivedBytes ?? source.dataReceivedBytes;
    const uploadedBytes = source.totalOut ?? source.TotalOut ?? source.uploadedBytes ?? source.bytesSent ?? source.sentBytes ?? source.dataSentBytes;
    addTransferStats(stats, 'downloadedBytes', downloadedBytes);
    addTransferStats(stats, 'uploadedBytes', uploadedBytes);
    return stats;
  }, {});

const getNestedTransferStats = (source: unknown): TransferStats => {
  if (!isRecord(source)) return {};
  return getTransferStatsFromSources([
    source,
    source.stat,
    source.stats,
    source.sessionStats,
    source.bandwidth,
    source.Bandwidth,
    source.bandwidthStats,
    source.transferStats,
  ]);
};

const getTransferStatsFromClientShape = (client?: Libp2pClientShape): TransferStats => {
  const clientRecord = isRecord(client) ? (client as Record<string, unknown>) : undefined;
  return getNestedTransferStats(clientRecord);
};

const getObservedTransferStats = (client?: Libp2pClientShape): ObservedTransferStats | undefined => {
  if (!isRecord(client)) return undefined;
  let stats = observedBrowserTransferStats.get(client);
  if (!stats) {
    stats = {
      connections: new WeakSet<object>(),
      downloadedBytes: 0,
      peers: new Map(),
      streams: new WeakSet<object>(),
      uploadedBytes: 0,
    };
    observedBrowserTransferStats.set(client, stats);
  }
  return stats;
};

const addObservedTransferStats = (stats: ObservedTransferStats, direction: keyof TransferStats, value: unknown, peerKey?: unknown) => {
  addTransferStats(stats, direction, value);
  addPeerTransferStats(stats.peers, peerKey, direction, value);
};

const getObservedTransferSnapshot = (stats?: ObservedTransferStats): TransferStatsSnapshot => {
  const snapshot = createTransferStatsSnapshot();
  if (!stats) return snapshot;
  snapshot.totals = {
    downloadedBytes: stats.downloadedBytes,
    uploadedBytes: stats.uploadedBytes,
  };
  for (const [peerKey, peerStats] of stats.peers) snapshot.peers.set(peerKey, peerStats);
  return snapshot;
};

const instrumentStreamTransferStats = (stream: unknown, stats: ObservedTransferStats, peerKey?: unknown) => {
  if (!isRecord(stream) || stats.streams.has(stream)) return;
  stats.streams.add(stream);

  const send = stream.send;
  if (typeof send === 'function') {
    try {
      stream.send = function sendWithTransferStats(this: unknown, data: unknown, ...args: unknown[]) {
        addObservedTransferStats(stats, 'uploadedBytes', getByteLength(data), peerKey);
        return send.call(this, data, ...args);
      };
    } catch {
      // Some stream implementations may expose read-only methods.
    }
  }

  const addEventListener = stream.addEventListener;
  if (typeof addEventListener === 'function') {
    try {
      addEventListener.call(stream, 'message', (event: unknown) => {
        const data = isRecord(event) ? (event.data ?? event.detail) : undefined;
        addObservedTransferStats(stats, 'downloadedBytes', getByteLength(data), peerKey);
      });
    } catch {
      return;
    }
  }
};

const instrumentConnectionTransferStats = (connection: unknown, stats: ObservedTransferStats) => {
  if (!isRecord(connection)) return;
  const peerKey = getStringValue(connection.remotePeer);

  if (!stats.connections.has(connection)) {
    stats.connections.add(connection);
    const newStream = connection.newStream;
    if (typeof newStream === 'function') {
      try {
        connection.newStream = async function newStreamWithTransferStats(this: unknown, ...args: unknown[]) {
          const stream = await newStream.apply(this, args);
          instrumentStreamTransferStats(stream, stats, peerKey);
          return stream;
        };
      } catch {
        // Some connection implementations may expose read-only methods.
      }
    }
  }

  for (const stream of toArray(connection.streams)) instrumentStreamTransferStats(stream, stats, peerKey);
};

const getBrowserTransferStats = async (client?: Libp2pClientShape, connections: unknown[] = []): Promise<TransferStatsSnapshot> => {
  try {
    const helia = client?._helia;
    const observedStats = getObservedTransferStats(client);
    if (observedStats) connections.forEach((connection) => instrumentConnectionTransferStats(connection, observedStats));

    const clientStats = { peers: new Map(), totals: getTransferStatsFromClientShape(client) };
    const counterStats = getTransferStatsFromHeliaCounters(helia);
    const metricSources = [helia?.metrics, helia?.libp2p?.metrics].filter(Boolean);
    const metricSnapshots = await Promise.all(metricSources.map((source) => getMetricSnapshot(source)));
    const metricStats = metricSnapshots
      .map((snapshot) => getTransferStatsFromMetricSnapshot(snapshot))
      .reduce<TransferStatsSnapshot>((stats, nextStats) => mergeTransferSnapshots(stats, nextStats), createTransferStatsSnapshot());

    return mergeTransferSnapshots(mergeTransferSnapshots(mergeTransferSnapshots(clientStats, counterStats), metricStats), getObservedTransferSnapshot(observedStats));
  } catch {
    return createTransferStatsSnapshot();
  }
};

const getFunctionSource = (value: unknown) => {
  if (typeof value !== 'function') return undefined;
  try {
    return Function.prototype.toString.call(value).toLowerCase();
  } catch {
    return undefined;
  }
};

const hasSupportedAdd = (client?: Libp2pClientShape) => {
  const add = client?.heliaWithKuboRpcClientFunctions?.add;
  const source = getFunctionSource(add);
  return typeof add === 'function' && !source?.includes('not supported') && !source?.includes('unsupported');
};

const isKnownNoopProvide = (provide: unknown) => {
  const source = getFunctionSource(provide);
  if (typeof provide !== 'function') return true;
  return Boolean(source?.includes('noop') || source?.replace(/\s/g, '') === 'asyncprovide(){}');
};

const hasProviderPublishingRouter = (client?: Libp2pClientShape) =>
  (client?._helia?.routing?.routers ?? []).some((router) => isRecord(router) && !isKnownNoopProvide(router.provide));

const getBrowserMode = (client?: Libp2pClientShape) => {
  if (!client) return 'Unknown';
  return hasSupportedAdd(client) && hasProviderPublishingRouter(client) ? 'Seeding' : 'Leeching';
};

const getEndpointAddress = (ip: string) => (ip.includes(':') ? `/ip6/${ip}/tcp/0` : `/ip4/${ip}/tcp/0`);

const isIpv4Address = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);

const isLikelyPublicIp = (value: string) => {
  const ip = value.trim();
  if (!ip) return false;
  if (isIpv4Address(ip)) return !isPrivateOrReservedIpv4(ip);
  if (!ip.includes(':')) return false;
  const normalized = ip.toLowerCase();
  return normalized !== '::1' && !normalized.startsWith('fe80:') && !normalized.startsWith('fc') && !normalized.startsWith('fd');
};

const getHostnameFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return undefined;
  }
};

const resolveEndpointFromIp = async (ip: string, signal?: AbortSignal): Promise<PublicEndpoint | undefined> => {
  if (!isLikelyPublicIp(ip)) return undefined;
  const location = await fetchIpMapLocation(ip, signal);
  return {
    countryCode: location?.countryCode ?? getApproximateCountryCode(getEndpointAddress(ip)),
    ip,
    location,
  };
};

const resolveEndpointFromHost = async (hostname: string, signal?: AbortSignal): Promise<PublicEndpoint | undefined> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname || normalizedHostname === 'localhost') return undefined;
  return isLikelyPublicIp(normalizedHostname) ? resolveEndpointFromIp(normalizedHostname, signal) : undefined;
};

const getTransportLabel = (address: string) => {
  const normalizedAddress = address.toLowerCase();
  let transport = 'Unknown transport';
  if (normalizedAddress.includes('/webtransport')) transport = 'WebTransport';
  else if (normalizedAddress.includes('/webrtc-direct')) transport = 'WebRTC direct';
  else if (normalizedAddress.includes('/webrtc')) transport = 'WebRTC';
  else if (normalizedAddress.includes('/wss')) transport = 'Secure WebSocket';
  else if (normalizedAddress.includes('/ws')) transport = 'WebSocket';
  else if (normalizedAddress.includes('/quic')) transport = 'QUIC';
  else if (normalizedAddress.includes('/tcp')) transport = 'TCP';
  else if (normalizedAddress.includes('/udp')) transport = 'UDP';

  return normalizedAddress.includes('/p2p-circuit') ? `${transport} through relay` : transport;
};

const getConnectionPeerId = (connection: unknown) => (isRecord(connection) ? getStringValue(connection.remotePeer) : 'unknown');

const getConnectionAddress = (connection: unknown) => (isRecord(connection) ? getStringValue(connection.remoteAddr, 'address unavailable') : 'address unavailable');

type Libp2pShape = NonNullable<NonNullable<Libp2pClientShape['_helia']>['libp2p']>;

// A peer reached through its own domain (/dns4/<domain>/tcp/443/tls/ws) has no IP in the
// connection address, so locate it by the public IP it announced over identify instead.
const getPeerLocationAddress = async (libp2p: Libp2pShape | undefined, connection: unknown): Promise<string | undefined> => {
  if (!isRecord(connection) || getFirstPublicIpFromAddresses([getConnectionAddress(connection)])) return undefined;
  try {
    const peer = await libp2p?.peerStore?.get?.(connection.remotePeer);
    const addresses = toArray(isRecord(peer) ? peer.addresses : undefined).map((entry) => (isRecord(entry) ? entry.multiaddr : entry));
    // Relay addresses carry the relay's IP, not the peer's.
    const ip = getFirstPublicIpFromAddresses(addresses.filter((address) => !getStringValue(address, '').includes('/p2p-circuit')));
    return ip ? getEndpointAddress(ip) : undefined;
  } catch {
    return undefined;
  }
};

const getPeerIdFromAddress = (address: string) => {
  const parts = address.split('/p2p/');
  return parts.length > 1 ? parts.at(-1)?.split('/')[0] : undefined;
};

const getPeerTransferStats = (peerStats: Map<string, TransferStats>, peerId: string, address: string) => {
  const addressPeerId = getPeerIdFromAddress(address);
  return peerStats.get(peerId) ?? (addressPeerId ? peerStats.get(addressPeerId) : undefined) ?? peerStats.get(address);
};

const getBrowserPeerTransferStats = (connection: unknown, peerId: string, address: string, peerStats: Map<string, TransferStats>) =>
  mergeTransferStats(
    getPeerTransferStats(peerStats, peerId, address) ?? {},
    mergeTransferStats(getNestedTransferStats(connection), { downloadedBytes: 0, uploadedBytes: 0 }),
  );

const formatPeerTransferBytes = (value: unknown) => (getFiniteNumber(value) === undefined ? 'unknown' : formatBytes(value));

const getBrowserConnectedPeersRow = (
  peers: unknown[],
  connections: unknown[],
  peerTransferStats: Map<string, TransferStats>,
  locationAddresses: (string | undefined)[] = [],
): ConnectedPeersStatRow => {
  const entries = connections.map<ConnectedPeerEntry>((connection, index) => {
    const address = getConnectionAddress(connection);
    const peerId = getConnectionPeerId(connection);
    const fallbackId = `${peerId}-${address}`;
    return {
      address,
      direction: isRecord(connection) ? getStringValue(connection.direction, '') : undefined,
      id: isRecord(connection) ? getStringValue(connection.id, fallbackId) : fallbackId,
      locationAddress: locationAddresses[index],
      peerId,
      status: isRecord(connection) ? getStringValue(connection.status, '') : undefined,
      transferStats: getBrowserPeerTransferStats(connection, peerId, address, peerTransferStats),
      transport: getTransportLabel(address),
    };
  });
  const peerIds = [...peers, ...entries].reduce<Set<string>>((ids, peerOrEntry) => {
    const peerId = isRecord(peerOrEntry) && 'peerId' in peerOrEntry ? getStringValue(peerOrEntry.peerId) : getStringValue(peerOrEntry);
    if (peerId && peerId !== 'unknown') ids.add(peerId);
    return ids;
  }, new Set());

  return {
    connectionCount: connections.length,
    entries,
    name: 'Connected peers',
    peerCount: peerIds.size || entries.length,
    type: 'connectedPeers',
  };
};

const PEER_LIST_FIELDS = ['Peers', 'peers', 'connectedPeers', 'connections'];
const PEER_ADDRESS_FIELDS = ['Addr', 'address', 'addr', 'remoteAddr', 'multiaddr', 'multiaddrString'];
const PEER_ID_FIELDS = ['Peer', 'peer', 'peerId', 'id', 'remotePeer'];
const PEER_DIRECTION_FIELDS = ['Direction', 'direction'];
const PEER_STATUS_FIELDS = ['Status', 'status', 'state'];
const PEER_ROLE_FIELDS = ['role', 'Role', 'mode', 'Mode', 'connectionRole', 'connectionType'];
const PEER_LISTEN_ADDRESS_FIELDS = ['listenAddress', 'listenAddresses', 'ListenAddress', 'ListenAddresses'];

const normalizePeerRecords = (peers: unknown): unknown[] => {
  if (isRecord(peers)) {
    for (const field of PEER_LIST_FIELDS) {
      const value = peers[field];
      if (Array.isArray(value)) return value;
    }
    return Object.values(peers);
  }
  return toArray(peers);
};

const getPeerAddress = (peer: unknown) => {
  const address = getStringField(peer, PEER_ADDRESS_FIELDS, '');
  if (address) return address;
  const listenAddress = getAddressValues(getRecordField(peer, PEER_LISTEN_ADDRESS_FIELDS))[0];
  return listenAddress || 'address unavailable';
};

const normalizePeerRole = (value: unknown): PeerConnectionRole | undefined => {
  const role = getStringValue(value, '').toLowerCase();
  if (!role) return undefined;
  if (role.includes('leech') || role === 'client') return 'leecher';
  if (role.includes('seed') || role === 'server') return 'seeder';
  return undefined;
};

const getListenAddressRole = (peer: unknown): PeerConnectionRole | undefined => {
  if (!isRecord(peer)) return undefined;
  for (const field of PEER_LISTEN_ADDRESS_FIELDS) {
    if (!(field in peer)) continue;
    return getAddressValues(peer[field]).length > 0 ? 'seeder' : 'leecher';
  }
  return undefined;
};

const getPeerConnectionRole = (peer: unknown) => normalizePeerRole(getRecordField(peer, PEER_ROLE_FIELDS)) ?? getListenAddressRole(peer);

const getConnectedPeersRowFromRecords = (peers: unknown): ConnectedPeersStatRow => {
  const peerRecords = normalizePeerRecords(peers);
  const entries = peerRecords.map<ConnectedPeerEntry>((peer, index) => {
    const address = getPeerAddress(peer);
    const peerId = getStringField(peer, PEER_ID_FIELDS, getStringValue(peer, 'unknown'));
    const direction = getStringField(peer, PEER_DIRECTION_FIELDS, '');
    const status = getStringField(peer, PEER_STATUS_FIELDS, '');
    const fallbackId = `${peerId}-${address}-${direction}-${index}`;
    const transferStats = getNestedTransferStats(peer);
    return {
      address,
      direction: direction || undefined,
      id: fallbackId,
      peerId,
      role: getPeerConnectionRole(peer),
      status: status || undefined,
      transferStats: hasTransferStats(transferStats) ? transferStats : undefined,
      transport: getTransportLabel(address),
    };
  });
  const peerIds = entries.reduce<Set<string>>((ids, entry) => {
    if (entry.peerId && entry.peerId !== 'unknown') ids.add(entry.peerId);
    return ids;
  }, new Set());
  const peerCount = getFiniteNumber(getRecordField(peers, ['peerCount', 'peersCount', 'PeerCount']));
  const connectionCount = getFiniteNumber(getRecordField(peers, ['connectionCount', 'connectionsCount', 'ConnectionCount']));

  return {
    connectionCount: connectionCount ?? entries.length,
    entries,
    name: 'Connected peers',
    peerCount: peerCount ?? (peerIds.size || entries.length),
    type: 'connectedPeers',
  };
};

const resolveConnectedPeerLocations = async (row: ConnectedPeersStatRow, signal?: AbortSignal): Promise<ConnectedPeersStatRow> => {
  if (!row.entries.length) return row;
  const lookups = new Map<string, Promise<PeerMapLocation | undefined>>();
  const entries = await Promise.all(
    row.entries.map(async (entry) => {
      const lookupAddress = entry.locationAddress ?? entry.address;
      let lookup = lookups.get(lookupAddress);
      if (!lookup) {
        lookup = fetchPeerMapLocation(lookupAddress, signal);
        lookups.set(lookupAddress, lookup);
      }
      const location = await lookup;
      if (!location) return entry;
      return {
        ...entry,
        countryCode: location.countryCode ?? entry.countryCode,
        location,
      };
    }),
  );
  return { ...row, entries };
};

// Resolves node-owned listen addresses for full-node and Kubo fallback paths.
// Browser libp2p observed addresses can be WebRTC relay/CDN endpoints, so browser
// mode uses fetchOwnPublicEndpoint instead.
const resolveOwnEndpoint = async (addresses: unknown[], signal?: AbortSignal): Promise<PublicEndpoint | undefined> => {
  const ip = getFirstPublicIpFromAddresses(addresses);
  if (ip) {
    const [countryCode, location] = await Promise.all([fetchOwnIpCountryCode(ip, signal), fetchIpMapLocation(ip, signal)]);
    const resolvedCountryCode = countryCode ?? location?.countryCode ?? getApproximateCountryCode(getEndpointAddress(ip));
    return {
      countryCode: resolvedCountryCode,
      ip,
      location: getCountryConsistentLocation(resolvedCountryCode, location),
    };
  }
  return fetchOwnPublicEndpoint(signal);
};

const resolveKuboOwnEndpoint = async (addresses: unknown[], signal?: AbortSignal): Promise<PublicEndpoint | undefined> => {
  const endpoint = await fetchOwnPublicEndpoint(signal);
  if (endpoint) return endpoint;
  const directAddresses = addresses.filter((address) => !getStringValue(address, '').toLowerCase().includes('/p2p-circuit'));
  return resolveOwnEndpoint(directAddresses.length ? directAddresses : addresses, signal);
};

const getOwnMapEntry = (endpoint: PublicEndpoint | undefined, mode: string): PeerMapEntry[] => {
  if (!endpoint?.location) return [];
  return [
    {
      address: getEndpointAddress(endpoint.ip),
      id: 'self-node-endpoint',
      location: endpoint.location,
      peerId: 'Your node',
      role: mode === 'Leeching' ? 'leecher' : 'seeder',
    },
  ];
};

const getPeerMapEntries = (row: ConnectedPeersStatRow): PeerMapEntry[] =>
  row.entries.map((entry) => ({
    address: entry.address,
    id: entry.id,
    location: entry.location,
    peerId: entry.peerId,
    role: entry.role ?? 'seeder',
  }));

const getElectronConnectedPeersRow = (peers: unknown): ConnectedPeersStatRow => getConnectedPeersRowFromRecords(peers);

const getAddressListFromRecord = (record: unknown) =>
  [
    ...getAddressValues(getRecordField(record, ['Addresses', 'addresses'])),
    ...getAddressValues(getRecordField(record, ['listenAddress', 'listenAddresses', 'ListenAddress', 'ListenAddresses'])),
    ...getAddressValues(getRecordField(record, ['multiaddr', 'multiaddrs', 'Multiaddrs'])),
  ].filter(Boolean);

const getBrowserLibp2pStats = async (account?: AccountShape, signal?: AbortSignal): Promise<StatRow[]> => {
  const client = getFirstObjectValue(account?.pkc?.clients?.libp2pJsClients) as Libp2pClientShape | undefined;
  const libp2p = client?._helia?.libp2p;
  const [peers, connections] = await Promise.all([getSafeArray(() => libp2p?.getPeers?.()), getSafeArray(() => libp2p?.getConnections?.())]);
  const mode = getBrowserMode(client);
  const [transferStats, nodeEndpoint, locationAddresses] = await Promise.all([
    getBrowserTransferStats(client, connections),
    fetchOwnPublicEndpoint(signal),
    Promise.all(connections.map((connection) => getPeerLocationAddress(libp2p, connection))),
  ]);
  const connectedPeersRow = getBrowserConnectedPeersRow(peers, connections, transferStats.peers, locationAddresses);
  const connectedPeers = await resolveConnectedPeerLocations(connectedPeersRow, signal);
  const connectedPeersWithMapEntries = {
    ...connectedPeers,
    mapEntries: [...getOwnMapEntry(nodeEndpoint, mode), ...getPeerMapEntries(connectedPeers)],
  };

  return [
    { name: 'Mode', value: mode },
    { name: 'Peer ID', value: libp2p?.peerId?.toString() ?? 'unknown' },
    nodeEndpoint ? { countryCode: nodeEndpoint.countryCode, ip: nodeEndpoint.ip, name: 'Your IP', type: 'nodeEndpoint' } : { name: 'Your IP', value: 'unavailable' },
    { name: 'Data received', value: transferStats.totals.downloadedBytes === undefined ? 'unknown' : formatBytes(transferStats.totals.downloadedBytes) },
    { name: 'Data sent', value: transferStats.totals.uploadedBytes === undefined ? 'unknown' : formatBytes(transferStats.totals.uploadedBytes) },
    connectedPeersWithMapEntries,
  ];
};

const getFullNodeRpcEndpoint = async (account?: AccountShape, signal?: AbortSignal): Promise<PublicEndpoint | undefined> => {
  const hostnames = getPkcRpcUrls(account).flatMap((rpcUrl) => {
    const hostname = getHostnameFromUrl(rpcUrl);
    return hostname ? [hostname] : [];
  });
  const hasRemoteHost = hostnames.some((hostname) => hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1');
  const endpoints = await Promise.all(hostnames.map((hostname) => resolveEndpointFromHost(hostname, signal)));
  const endpoint = endpoints.find(Boolean);
  if (endpoint) return endpoint;
  return hasRemoteHost ? undefined : fetchOwnPublicEndpoint(signal);
};

const isImplementedRpcMethod = (method: unknown): method is () => unknown | Promise<unknown> => {
  if (typeof method !== 'function') return false;
  const source = getFunctionSource(method);
  return !source?.includes('not implemented');
};

const callPkcRpcMethod = async (client: PkcRpcClientShape | undefined, methodName: 'getPeers' | 'getStats') => {
  const method = client?.[methodName];
  if (!isImplementedRpcMethod(method)) return undefined;
  try {
    return await method.call(client);
  } catch {
    return undefined;
  }
};

const getRpcIdentity = (stats: unknown) => getFirstNestedValue(stats, [['identity'], ['Identity'], ['id'], ['node']]);

const getRpcPeerId = (stats: unknown) => {
  const identity = getRpcIdentity(stats);
  return getStringValue(getRecordField(identity, ['ID', 'id', 'PeerID', 'peerId']) ?? getRecordField(stats, ['ID', 'id', 'PeerID', 'peerId']));
};

const getRpcAgent = (stats: unknown) => {
  const identity = getRpcIdentity(stats);
  return getStringValue(getRecordField(identity, ['AgentVersion', 'agentVersion', 'agent']) ?? getRecordField(stats, ['AgentVersion', 'agentVersion', 'agent']));
};

const getRpcBandwidthValue = (stats: unknown, fields: string[][]) => getFirstNestedValue(stats, fields);

const getFullNodeRpcStats = async (account?: AccountShape, rpcState?: string, signal?: AbortSignal): Promise<StatRow[]> => {
  const rpcClient = getFirstPkcRpcClient(account);
  const [stats, rpcPeers] = await Promise.all([callPkcRpcMethod(rpcClient, 'getStats'), callPkcRpcMethod(rpcClient, 'getPeers')]);
  const identity = getRpcIdentity(stats);
  const statsAddresses = [...getAddressListFromRecord(identity), ...getAddressListFromRecord(stats)];
  const peerRecords = rpcPeers ?? getFirstNestedValue(stats, [['peers'], ['Peers'], ['connectedPeers'], ['connections']]);
  const connectedPeers = await resolveConnectedPeerLocations(getConnectedPeersRowFromRecords(peerRecords), signal);
  const nodeEndpoint = statsAddresses.length ? await resolveOwnEndpoint(statsAddresses, signal) : await getFullNodeRpcEndpoint(account, signal);
  const connectedPeersWithMapEntries = {
    ...connectedPeers,
    mapEntries: [...getOwnMapEntry(nodeEndpoint, 'Seeding'), ...getPeerMapEntries(connectedPeers)],
  };
  const bandwidthIn = getRpcBandwidthValue(stats, [
    ['bandwidth', 'TotalIn'],
    ['bandwidth', 'totalIn'],
    ['Bandwidth', 'TotalIn'],
    ['TotalIn'],
    ['totalIn'],
    ['downloadedBytes'],
  ]);
  const bandwidthOut = getRpcBandwidthValue(stats, [
    ['bandwidth', 'TotalOut'],
    ['bandwidth', 'totalOut'],
    ['Bandwidth', 'TotalOut'],
    ['TotalOut'],
    ['totalOut'],
    ['uploadedBytes'],
  ]);

  return [
    { name: 'Mode', value: 'Seeding' },
    { name: 'PKC RPC', value: rpcClient?.state ?? rpcState ?? 'unknown' },
    { name: 'Peer ID', value: getRpcPeerId(stats) },
    nodeEndpoint ? { countryCode: nodeEndpoint.countryCode, ip: nodeEndpoint.ip, name: 'Your IP', type: 'nodeEndpoint' } : { name: 'Your IP', value: 'unavailable' },
    ...(getRpcAgent(stats) !== 'unknown' ? [{ name: 'Agent', value: getRpcAgent(stats) } satisfies TextStatRow] : []),
    { name: 'Data received', value: formatOptionalBytes(bandwidthIn) },
    { name: 'Data sent', value: formatOptionalBytes(bandwidthOut) },
    connectedPeersWithMapEntries,
  ];
};

const kuboPostJson = async (path: string, params?: Record<string, string | boolean>, signal?: AbortSignal) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) searchParams.set(key, String(value));
  const query = searchParams.toString();
  const response = await fetch(`${KUBO_API_URL}/${path}${query ? `?${query}` : ''}`, { method: 'POST', signal });
  if (!response.ok) throw new Error(`Kubo ${path} returned ${response.status}`);
  const text = await response.text();
  const firstJsonLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstJsonLine ? JSON.parse(firstJsonLine) : {};
};

const getElectronKuboStats = async (signal?: AbortSignal): Promise<StatRow[]> => {
  const [identity, peers, bandwidth] = await Promise.all([
    kuboPostJson('id', undefined, signal),
    kuboPostJson('swarm/peers', { direction: true, latency: true, streams: true }, signal),
    kuboPostJson('stats/bw', undefined, signal),
  ]);
  const peerId = getStringValue(identity.ID, 'unknown');
  const [nodeEndpoint, connectedPeers] = await Promise.all([
    resolveKuboOwnEndpoint(getAddressListFromRecord(identity), signal),
    resolveConnectedPeerLocations(getElectronConnectedPeersRow(peers), signal),
  ]);
  const connectedPeersWithMapEntries = {
    ...connectedPeers,
    mapEntries: [...getOwnMapEntry(nodeEndpoint, 'Seeding'), ...getPeerMapEntries(connectedPeers)],
  };

  return [
    { name: 'Mode', value: 'Seeding' },
    { name: 'Kubo RPC', value: KUBO_API_URL },
    { name: 'Peer ID', value: peerId },
    nodeEndpoint ? { countryCode: nodeEndpoint.countryCode, ip: nodeEndpoint.ip, name: 'Your IP', type: 'nodeEndpoint' } : { name: 'Your IP', value: 'unavailable' },
    { name: 'Data received', value: formatOptionalBytes(bandwidth.TotalIn) },
    { name: 'Data sent', value: formatOptionalBytes(bandwidth.TotalOut) },
    connectedPeersWithMapEntries,
  ];
};

const getP2PStats = async (mode: P2PRuntimeMode, account?: AccountShape, rpcState?: string, signal?: AbortSignal) => {
  if (mode === 'browser-libp2p') return getBrowserLibp2pStats(account, signal);
  if (mode === 'full-node-rpc') return getFullNodeRpcStats(account, rpcState, signal);
  return getElectronKuboStats(signal);
};

export {
  SEEDER_REPO_URL,
  transparentPixelSrc,
  formatBytes,
  formatCount,
  formatPeerTransferBytes,
  getConnectedPeersRowFromRecords,
  getP2PStats,
  getTransferStatsFromMetricSnapshot,
  getTransportLabel,
  isLikelyPublicIp,
  mergeTransferSnapshots,
};
export type { AccountShape, ConnectedPeerEntry, ConnectedPeersStatRow, NodeEndpointStatRow, PeerConnectionRole, PeerMapEntry, StatRow, TextStatRow };
