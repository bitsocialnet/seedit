import { RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import useAdvancedSettings, { getChainProviders } from '../../../hooks/use-advanced-settings';
import { isBrowserPureP2PEnabled } from '../../../lib/p2p-runtime';
import styles from './advanced-settings.module.css';

interface SettingsProps {
  ipfsGatewayUrlsRef?: RefObject<HTMLTextAreaElement | null>;
  mediaIpfsGatewayUrlRef?: RefObject<HTMLInputElement | null>;
  pubsubProvidersRef?: RefObject<HTMLTextAreaElement | null>;
  ethRpcRef?: RefObject<HTMLTextAreaElement | null>;
  httpRoutersRef?: RefObject<HTMLTextAreaElement | null>;
  fullNodeRpcRef?: RefObject<HTMLInputElement | null>;
  p2pDataPathRef?: RefObject<HTMLInputElement | null>;
  onPureP2PBrowserChange?: (enabled: boolean) => void;
  pureP2PBrowserEnabled?: boolean;
}

const IPFSGatewaysSettings = ({ ipfsGatewayUrlsRef, mediaIpfsGatewayUrlRef }: SettingsProps) => {
  const account = useAccount();
  const { pkcOptions, mediaIpfsGatewayUrl } = account || {};
  const { ipfsGatewayUrls } = pkcOptions || {};
  const pkcRpc = usePkcRpcSettings();
  const isConnectedToRpc = pkcRpc?.state === 'connected';
  const ipfsGatewayUrlsDefaultValue = ipfsGatewayUrls?.join('\n');

  return (
    <div className={styles.ipfsGatewaysSettings}>
      <div className={styles.ipfsGatewaysSetting}>
        <textarea
          aria-label='IPFS gateway URLs'
          defaultValue={ipfsGatewayUrlsDefaultValue}
          ref={ipfsGatewayUrlsRef}
          disabled={isConnectedToRpc}
          autoCorrect='off'
          autoComplete='off'
          spellCheck='false'
          rows={ipfsGatewayUrls?.length || 3}
        />
      </div>
      <span className={styles.settingTitle}>nft profile pics gateway</span>
      <div>
        <input
          type='text'
          aria-label='Media IPFS gateway URL'
          defaultValue={mediaIpfsGatewayUrl}
          ref={mediaIpfsGatewayUrlRef}
          disabled={isConnectedToRpc}
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck='false'
        />
      </div>
    </div>
  );
};

const PubsubProvidersSettings = ({ pubsubProvidersRef }: SettingsProps) => {
  const account = useAccount();
  const { pkcOptions } = account || {};
  const { pubsubKuboRpcClientsOptions } = pkcOptions || {};
  const pkcRpc = usePkcRpcSettings();
  const isConnectedToRpc = pkcRpc?.state === 'connected';
  const pubsubProvidersDefaultValue = pubsubKuboRpcClientsOptions?.join('\n');

  return (
    <div className={styles.pubsubProvidersSettings}>
      <textarea
        aria-label='Pubsub providers'
        defaultValue={pubsubProvidersDefaultValue}
        ref={pubsubProvidersRef}
        disabled={isConnectedToRpc}
        autoCorrect='off'
        autoComplete='off'
        spellCheck='false'
        rows={pubsubKuboRpcClientsOptions?.length || 3}
      />
    </div>
  );
};

const HttpRoutersSettings = ({ httpRoutersRef }: SettingsProps) => {
  const account = useAccount();
  const { pkcOptions } = account || {};
  const { httpRoutersOptions } = pkcOptions || {};
  const pkcRpc = usePkcRpcSettings();
  const isConnectedToRpc = pkcRpc?.state === 'connected';
  const httpRoutersDefaultValue = httpRoutersOptions?.join('\n');

  return (
    <div className={styles.httpRoutersSettings}>
      <textarea
        aria-label='HTTP routers'
        defaultValue={httpRoutersDefaultValue}
        ref={httpRoutersRef}
        disabled={isConnectedToRpc}
        autoCorrect='off'
        autoComplete='off'
        spellCheck='false'
        rows={httpRoutersOptions?.length || 4}
      />
    </div>
  );
};

const BlockchainProvidersSettings = ({ ethRpcRef }: SettingsProps) => {
  const account = useAccount();
  const chainProviders = getChainProviders(account);
  const ethRpcDefaultValue = chainProviders?.['eth']?.urls?.join('\n');

  return (
    <div className={styles.blockchainProvidersSettings}>
      <span className={styles.settingTitle}>ethereum rpc, for .bso addresses</span>
      <div>
        <textarea
          aria-label='Ethereum RPC URLs'
          defaultValue={ethRpcDefaultValue}
          ref={ethRpcRef}
          autoCorrect='off'
          autoComplete='off'
          spellCheck='false'
          rows={chainProviders?.['eth']?.urls?.length || 3}
        />
      </div>
    </div>
  );
};

const FullNodeRpcSettings = ({ fullNodeRpcRef }: SettingsProps) => {
  const account = useAccount();
  const { pkcOptions } = account || {};
  const { pkcRpcClientsOptions } = pkcOptions || {};

  return (
    <div className={styles.fullNodeRpcSettings}>
      <input
        type='text'
        aria-label='Full node WebSocket RPC URL'
        defaultValue={pkcRpcClientsOptions?.[0]}
        placeholder='ws://<IP>:<port>/<secretAuthKey>'
        ref={fullNodeRpcRef}
        autoCorrect='off'
        autoCapitalize='off'
        spellCheck='false'
      />
    </div>
  );
};

const P2pDataPathSettings = ({ p2pDataPathRef }: SettingsProps) => {
  const pkcRpc = usePkcRpcSettings();
  const { pkcRpcSettings } = pkcRpc || {};
  const isConnectedToRpc = pkcRpc?.state === 'connected';
  const dataPath = pkcRpcSettings?.pkcOptions?.dataPath;
  const path = typeof dataPath === 'string' ? dataPath : '';

  return (
    <div className={styles.p2pDataPathSettings}>
      <div>
        <input
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck='false'
          type='text'
          aria-label='P2P data path'
          defaultValue={path}
          disabled={!isConnectedToRpc}
          ref={p2pDataPathRef}
        />
      </div>
    </div>
  );
};

const PureP2PBrowserSettings = ({ onPureP2PBrowserChange, pureP2PBrowserEnabled }: SettingsProps) => {
  const account = useAccount();
  const isChecked = pureP2PBrowserEnabled ?? isBrowserPureP2PEnabled(account);

  return (
    <div className={styles.pureP2PSettings}>
      <label>
        <input
          className={styles.pureP2PCheckbox}
          type='checkbox'
          aria-label='Pure P2P browser mode'
          checked={isChecked}
          onChange={(event) => onPureP2PBrowserChange?.(event.currentTarget.checked)}
        />
        enable pure p2p
      </label>
      <div className={styles.settingTitle}>use a browser P2P node instead of centralized IPFS gateways</div>
    </div>
  );
};

const isElectron = window.electronApi?.isElectron === true;

const AdvancedSettings = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { canConfigurePureP2PBrowser, browserPureP2PEnabled, setBrowserPureP2PEnabled, showsGatewaySettings, save } = useAdvancedSettings();
  const shouldShowGatewayModeSettings = showsGatewaySettings;

  const ipfsGatewayUrlsRef = useRef<HTMLTextAreaElement>(null);
  const mediaIpfsGatewayUrlRef = useRef<HTMLInputElement>(null);
  const pubsubProvidersRef = useRef<HTMLTextAreaElement>(null);
  const ethRpcRef = useRef<HTMLTextAreaElement>(null);
  const httpRoutersRef = useRef<HTMLTextAreaElement>(null);
  const fullNodeRpcRef = useRef<HTMLInputElement>(null);
  const p2pDataPathRef = useRef<HTMLInputElement>(null);

  // refs are null for fields hidden in pure p2p mode, which keeps their saved values
  const handleSave = () =>
    save({
      ipfsGatewayUrls: ipfsGatewayUrlsRef.current?.value,
      mediaIpfsGatewayUrl: mediaIpfsGatewayUrlRef.current?.value,
      pubsubProviders: pubsubProvidersRef.current?.value,
      httpRouters: httpRoutersRef.current?.value,
      ethRpcUrls: ethRpcRef.current?.value,
      fullNodeRpc: fullNodeRpcRef.current?.value,
      dataPath: p2pDataPathRef.current?.value,
    });

  return (
    <div className={styles.content}>
      {canConfigurePureP2PBrowser && (
        <div className={styles.category}>
          <span className={styles.categoryTitle}>pure p2p</span>
          <span className={styles.categorySettings}>
            <PureP2PBrowserSettings pureP2PBrowserEnabled={browserPureP2PEnabled} onPureP2PBrowserChange={setBrowserPureP2PEnabled} />
          </span>
        </div>
      )}
      {shouldShowGatewayModeSettings && (
        <>
          <div className={styles.category}>
            <span className={styles.categoryTitle}>ipfs gateways</span>
            <span className={styles.categorySettings}>
              <IPFSGatewaysSettings ipfsGatewayUrlsRef={ipfsGatewayUrlsRef} mediaIpfsGatewayUrlRef={mediaIpfsGatewayUrlRef} />
            </span>
          </div>
          <div className={styles.category}>
            <span className={styles.categoryTitle}>pubsub providers</span>
            <span className={styles.categorySettings}>
              <PubsubProvidersSettings pubsubProvidersRef={pubsubProvidersRef} />
            </span>
          </div>
        </>
      )}
      <div className={styles.category}>
        <span className={styles.categoryTitle}>http routers</span>
        <span className={styles.categorySettings}>
          <HttpRoutersSettings httpRoutersRef={httpRoutersRef} />
        </span>
      </div>
      <div className={styles.category}>
        <span className={styles.categoryTitle}>blockchain providers</span>
        <span className={styles.categorySettings}>
          <BlockchainProvidersSettings ethRpcRef={ethRpcRef} />
        </span>
      </div>
      <div className={`${styles.category} ${location.hash === '#fullNodeRpc' ? styles.highlightedSetting : ''}`} id='fullNodeRpc'>
        <span className={styles.categoryTitle}>full node websocket rpc</span>
        <span className={styles.categorySettings}>
          <FullNodeRpcSettings fullNodeRpcRef={fullNodeRpcRef} />
        </span>
      </div>
      {isElectron && (
        <div className={styles.category}>
          <span className={styles.categoryTitle}>p2p data path</span>
          <span className={styles.categorySettings}>
            <P2pDataPathSettings p2pDataPathRef={p2pDataPathRef} />
          </span>
        </div>
      )}
      <button type='button' className={styles.saveOptions} onClick={handleSave}>
        {t('save_options')}
      </button>
    </div>
  );
};

export default AdvancedSettings;
