import { Fragment } from 'react';
import { useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import { getCountryFlagPosition, getCountryLabel, normalizeCountryCode } from '../../../lib/country-flags';
import { getApproximateCountryCode } from '../../../lib/peer-geo';
import { getP2PRuntimeMode } from '../../../lib/p2p-runtime';
import {
  SEEDER_REPO_URL,
  formatCount,
  formatPeerTransferBytes,
  transparentPixelSrc,
  type AccountShape,
  type ConnectedPeersStatRow,
  type NodeEndpointStatRow,
  type TextStatRow,
} from '../../../lib/p2p-stats';
import useP2PStats from '../../../hooks/use-p2p-stats';
import LoadingEllipsis from '../../../components/loading-ellipsis';
import PeerWorldMap from './peer-world-map';
import styles from './p2p-stats.module.css';

const NodeEndpointValue = ({ row }: { row: NodeEndpointStatRow }) => {
  const countryCode = normalizeCountryCode(row.countryCode);
  const flagPosition = getCountryFlagPosition(countryCode);
  const countryLabel = getCountryLabel(row.countryCode);

  return (
    <span className={styles.nodeEndpoint}>
      {flagPosition && (
        <img
          alt={countryLabel}
          aria-label={countryLabel}
          className={styles.peerFlag}
          src={transparentPixelSrc}
          style={{ backgroundPosition: `-${flagPosition.x}px -${flagPosition.y}px` }}
          title={countryLabel}
        />
      )}
      <span className={styles.nodeIp}>{row.ip}</span>
    </span>
  );
};

const StatValueCell = ({ row }: { row: TextStatRow }) => {
  if (row.name === 'Mode' && row.value === 'Leeching') {
    return (
      <>
        Leeching
        <a href={SEEDER_REPO_URL} rel='noopener noreferrer' target='_blank'>
          want to seed?
        </a>
      </>
    );
  }
  return row.value;
};

const ConnectedPeersValue = ({ row }: { row: ConnectedPeersStatRow }) => (
  <div>
    {/* The heading keeps the shared label/value columns, the map and peer list below sit under the value column. */}
    <div className={styles.category}>
      <span className={styles.categoryTitle}>{row.name}</span>
      <span className={styles.categorySettings}>
        {formatCount(row.peerCount, 'peer')}, {formatCount(row.connectionCount, 'connection')}
      </span>
    </div>
    <div className={styles.connectedPeersPanel}>
      <PeerWorldMap peers={row.mapEntries ?? row.entries} />
      <div className={styles.connectedPeerList}>
        {row.entries.length ? (
          row.entries.map((entry) => {
            const countryCode = entry.countryCode ?? getApproximateCountryCode(entry.address);
            const flagPosition = getCountryFlagPosition(countryCode);
            return (
              <div className={styles.connectedPeer} key={entry.id}>
                <div className={styles.connectedPeerMeta}>
                  <span className={styles.connectionTransport}>{entry.transport}</span>
                  {entry.transferStats && (
                    <span className={styles.connectionTransferStats}>
                      Received {formatPeerTransferBytes(entry.transferStats.downloadedBytes)} &middot; Sent {formatPeerTransferBytes(entry.transferStats.uploadedBytes)}
                    </span>
                  )}
                  {entry.role && (
                    <span className={styles.connectionRole} data-peer-role={entry.role}>
                      {entry.role === 'leecher' ? 'Leeching' : 'Seeding'}
                    </span>
                  )}
                </div>
                <div className={styles.peerId} title={entry.peerId}>
                  {entry.peerId}
                </div>
                <div className={styles.connectionAddressRow}>
                  {flagPosition && (
                    <img
                      alt={getCountryLabel(countryCode)}
                      aria-label={getCountryLabel(countryCode)}
                      className={styles.peerFlag}
                      src={transparentPixelSrc}
                      style={{ backgroundPosition: `-${flagPosition.x}px -${flagPosition.y}px` }}
                      title={getCountryLabel(countryCode)}
                    />
                  )}
                  <code className={styles.connectionAddress} title={entry.address}>
                    {entry.address}
                  </code>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.connectedPeerEmpty}>No active peer addresses</div>
        )}
      </div>
    </div>
  </div>
);

const P2pStats = () => {
  const account = useAccount() as AccountShape | undefined;
  const pkcRpcSettings = usePkcRpcSettings();
  const mode = getP2PRuntimeMode(account);
  const { error, loading, rows, updatedAt } = useP2PStats({ account, mode, rpcState: pkcRpcSettings?.state });
  const updatedAtLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString() : undefined;

  return (
    <div className={styles.content}>
      {mode ? (
        <>
          {rows.map((row) =>
            row.type === 'connectedPeers' ? (
              <Fragment key={row.name}>
                {updatedAtLabel && (
                  <div className={styles.category}>
                    <span className={styles.categoryTitle}>Updated</span>
                    <div className={styles.categorySettings}>{updatedAtLabel}</div>
                  </div>
                )}
                <ConnectedPeersValue row={row} />
              </Fragment>
            ) : (
              <div className={styles.category} key={row.name}>
                <span className={styles.categoryTitle}>{row.name}</span>
                <div className={styles.categorySettings}>{row.type === 'nodeEndpoint' ? <NodeEndpointValue row={row} /> : <StatValueCell row={row} />}</div>
              </div>
            ),
          )}
          <div className={styles.statsMeta}>
            {loading ? (
              <div className={styles.statsLoading}>
                <LoadingEllipsis string='loading p2p stats' />
              </div>
            ) : null}
            {error && <div className={styles.error}>{error}</div>}
          </div>
        </>
      ) : (
        <div className={styles.statsMeta}>P2P stats appear after the P2P client starts.</div>
      )}
    </div>
  );
};

export default P2pStats;
