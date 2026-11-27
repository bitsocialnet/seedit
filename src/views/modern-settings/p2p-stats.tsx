import { useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import useP2PStats from '../../hooks/use-p2p-stats';
import { getApproximateCountryCode } from '../../lib/peer-geo';
import { getP2PRuntimeMode } from '../../lib/p2p-runtime';
import { SEEDER_REPO_URL, formatCount, formatPeerTransferBytes, type AccountShape, type ConnectedPeersStatRow, type StatRow } from '../../lib/p2p-stats';
import PeerWorldMap, { CountryFlag } from '../../components/peer-world-map';
import { SettingsRow, SettingsSection, settingsStyles } from '../../components/modern-settings-section';
import styles from './modern-settings.module.css';

const StatValue = ({ row }: { row: Exclude<StatRow, ConnectedPeersStatRow> }) => {
  if (row.type === 'nodeEndpoint') {
    return (
      <span className={settingsStyles.controls}>
        <CountryFlag countryCode={row.countryCode} />
        <span className={settingsStyles.mono}>{row.ip}</span>
      </span>
    );
  }
  if (row.name === 'Mode' && row.value === 'Leeching') {
    return (
      <span className={settingsStyles.controls}>
        Leeching
        <a className={settingsStyles.link} href={SEEDER_REPO_URL} rel='noopener noreferrer' target='_blank'>
          want to seed?
        </a>
      </span>
    );
  }
  return <span className={styles.statValue}>{row.value}</span>;
};

interface ConnectedPeersProps {
  row: ConnectedPeersStatRow;
  updatedAt: string | undefined;
  /** No connection yet, while the node loads communities: a count of none would read as no peers at all. */
  connecting: boolean;
}

const ConnectedPeers = ({ row, updatedAt, connecting }: ConnectedPeersProps) => (
  <SettingsSection
    title={row.name}
    description={
      connecting ? undefined : `${formatCount(row.peerCount, 'peer')}, ${formatCount(row.connectionCount, 'connection')}${updatedAt ? ` · Updated ${updatedAt}` : ''}`
    }
  >
    <PeerWorldMap peers={row.mapEntries ?? row.entries} />
    <ul className={styles.peerList}>
      {connecting && (
        <li className={settingsStyles.status} role='status'>
          Connecting to peers…
        </li>
      )}
      {!connecting && row.entries.length === 0 && <li className={settingsStyles.status}>No active peer addresses</li>}
      {row.entries.map((entry) => (
        <li key={entry.id} className={styles.peer}>
          <div className={styles.peerMeta}>
            <strong>{entry.transport}</strong>
            {entry.transferStats && (
              <span>
                Received {formatPeerTransferBytes(entry.transferStats.downloadedBytes)} · Sent {formatPeerTransferBytes(entry.transferStats.uploadedBytes)}
              </span>
            )}
            {entry.role && (
              <span className={entry.role === 'leecher' ? settingsStyles.statusError : settingsStyles.statusSuccess}>
                {entry.role === 'leecher' ? 'Leeching' : 'Seeding'}
              </span>
            )}
          </div>
          <div className={`${settingsStyles.mono} ${styles.truncate}`} title={entry.peerId}>
            {entry.peerId}
          </div>
          <div className={`${settingsStyles.controls} ${styles.peerAddress}`}>
            <CountryFlag countryCode={entry.countryCode ?? getApproximateCountryCode(entry.address)} />
            <code className={`${styles.muted} ${styles.truncate}`} title={entry.address}>
              {entry.address}
            </code>
          </div>
        </li>
      ))}
    </ul>
  </SettingsSection>
);

/** What the P2P client is doing: its mode, node, and connected peers. */
const P2pStats = () => {
  const account = useAccount() as AccountShape | undefined;
  const pkcRpcSettings = usePkcRpcSettings();
  const mode = getP2PRuntimeMode(account);
  const { connecting, error, loading, rows, updatedAt } = useP2PStats({ account, mode, rpcState: pkcRpcSettings?.state });
  const updatedAtLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString() : undefined;

  if (!mode) {
    return (
      <SettingsSection title='p2p'>
        <p className={settingsStyles.status}>P2P stats appear after the P2P client starts.</p>
      </SettingsSection>
    );
  }

  const statRows = rows.filter((row): row is Exclude<StatRow, ConnectedPeersStatRow> => row.type !== 'connectedPeers');
  const peerRows = rows.filter((row): row is ConnectedPeersStatRow => row.type === 'connectedPeers');

  return (
    <>
      <SettingsSection title='node'>
        <div className={settingsStyles.rows}>
          {statRows.map((row) => (
            <SettingsRow key={row.name} label={row.name}>
              <StatValue row={row} />
            </SettingsRow>
          ))}
        </div>
        {loading && (
          <p className={settingsStyles.status} role='status'>
            Loading p2p stats…
          </p>
        )}
        {error && (
          <p className={`${settingsStyles.status} ${settingsStyles.statusError}`} role='alert'>
            {error}
          </p>
        )}
      </SettingsSection>
      {peerRows.map((row) => (
        <ConnectedPeers key={row.name} row={row} updatedAt={updatedAtLabel} connecting={connecting} />
      ))}
    </>
  );
};

export default P2pStats;
