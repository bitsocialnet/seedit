import { RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { setAccount, useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import { getBrowserGatewayPkcOptions, getBrowserPureP2PPkcOptions, setPureP2PBrowserPreference } from '../../../lib/p2p-browser-config';
import { canConfigureBrowserPureP2P, isBrowserPureP2PEnabled } from '../../../lib/p2p-runtime';
import { getSupportedChainProviders } from '../../../lib/utils/chain-provider-utils';
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

type AccountProtocolOptions = {
  chainProviders?: Record<string, { urls?: string[]; chainId: number }>;
  dataPath?: string;
  httpRoutersOptions?: string[];
  ipfsGatewayUrls?: string[];
  kuboRpcClientsOptions?: unknown[];
  libp2pJsClientsOptions?: unknown[];
  pkcRpcClientsOptions?: string[];
  pubsubHttpClientsOptions?: string[];
  pubsubKuboRpcClientsOptions?: string[];
};

// chainProviders live on the account top-level since bitsocial-react-hooks 0.1.27;
// fall back to the legacy pkcOptions location for accounts saved by older versions
const getChainProviders = (account: unknown) => {
  const accountShape = account as { chainProviders?: AccountProtocolOptions['chainProviders']; pkcOptions?: AccountProtocolOptions } | undefined;
  return accountShape?.chainProviders ?? accountShape?.pkcOptions?.chainProviders;
};

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

const getTrimmedLines = (value: string | undefined): string[] | undefined => {
  return value?.split('\n').reduce<string[]>((lines, line) => {
    const trimmedLine = line.trim();
    if (trimmedLine) lines.push(trimmedLine);
    return lines;
  }, []);
};

const applyBrowserGatewayPkcOptions = (
  pkcOptions: AccountProtocolOptions,
  ipfsGatewayUrls: string[] | undefined,
  pubsubKuboRpcClientsOptions: string[] | undefined,
  httpRoutersOptions: string[] | undefined,
) => {
  const gatewayOptions = getBrowserGatewayPkcOptions();

  return {
    ...pkcOptions,
    ...gatewayOptions,
    ipfsGatewayUrls: ipfsGatewayUrls?.length ? ipfsGatewayUrls : gatewayOptions.ipfsGatewayUrls,
    pubsubKuboRpcClientsOptions: pubsubKuboRpcClientsOptions?.length ? pubsubKuboRpcClientsOptions : gatewayOptions.pubsubKuboRpcClientsOptions,
    httpRoutersOptions: httpRoutersOptions?.length ? httpRoutersOptions : gatewayOptions.httpRoutersOptions,
  };
};

const AdvancedSettings = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const account = useAccount();
  const protocolOptions: AccountProtocolOptions | undefined = account?.pkcOptions;
  const canConfigurePureP2PBrowser = canConfigureBrowserPureP2P();
  const activeBrowserPureP2PEnabled = canConfigurePureP2PBrowser && isBrowserPureP2PEnabled(account);
  const [browserPureP2PSelection, setBrowserPureP2PSelection] = useState<boolean | undefined>(undefined);
  const browserPureP2PEnabled = browserPureP2PSelection ?? activeBrowserPureP2PEnabled;
  const shouldShowGatewayModeSettings = !canConfigurePureP2PBrowser || !activeBrowserPureP2PEnabled;

  const ipfsGatewayUrlsRef = useRef<HTMLTextAreaElement>(null);
  const mediaIpfsGatewayUrlRef = useRef<HTMLInputElement>(null);
  const pubsubProvidersRef = useRef<HTMLTextAreaElement>(null);
  const ethRpcRef = useRef<HTMLTextAreaElement>(null);
  const httpRoutersRef = useRef<HTMLTextAreaElement>(null);
  const fullNodeRpcRef = useRef<HTMLInputElement>(null);
  const p2pDataPathRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    // refs are null for fields hidden in pure p2p mode, fall back to the saved account values
    const ipfsGatewayUrls = ipfsGatewayUrlsRef.current ? getTrimmedLines(ipfsGatewayUrlsRef.current.value) : protocolOptions?.ipfsGatewayUrls;

    const mediaIpfsGatewayUrl = mediaIpfsGatewayUrlRef.current ? mediaIpfsGatewayUrlRef.current.value.trim() || undefined : account?.mediaIpfsGatewayUrl;

    const pubsubKuboRpcClientsOptions = pubsubProvidersRef.current ? getTrimmedLines(pubsubProvidersRef.current.value) : protocolOptions?.pubsubKuboRpcClientsOptions;

    const ethRpcUrls = getTrimmedLines(ethRpcRef.current?.value);

    const httpRoutersOptions = httpRoutersRef.current ? getTrimmedLines(httpRoutersRef.current.value) : protocolOptions?.httpRoutersOptions;

    const pkcRpcClientsOptions = fullNodeRpcRef.current?.value.trim() ? [fullNodeRpcRef.current.value.trim()] : undefined;
    const dataPath = p2pDataPathRef.current?.value.trim() || undefined;
    // A full node RPC URL selects RPC mode, since the pure p2p options below would discard it, unless the user
    // ticked pure p2p and left the saved URL that prefills the field as it was.
    const pureP2PTickedOverSavedRpcUrl = browserPureP2PSelection === true && pkcRpcClientsOptions?.[0] === protocolOptions?.pkcRpcClientsOptions?.[0];
    const usesRpcUrl = !!pkcRpcClientsOptions && !pureP2PTickedOverSavedRpcUrl;
    const pureP2PBrowserPreference = canConfigurePureP2PBrowser ? browserPureP2PEnabled && !usesRpcUrl : undefined;

    const chainProviders: NonNullable<AccountProtocolOptions['chainProviders']> = getSupportedChainProviders(getChainProviders(account)) ?? {};
    if (ethRpcUrls?.length) chainProviders.eth = { urls: ethRpcUrls, chainId: 1 };

    let pkcOptions: AccountProtocolOptions = {
      ...protocolOptions,
      ipfsGatewayUrls,
      pubsubKuboRpcClientsOptions,
      httpRoutersOptions,
      pkcRpcClientsOptions,
      dataPath,
      chainProviders: getSupportedChainProviders(protocolOptions?.chainProviders),
    };

    if (pureP2PBrowserPreference !== undefined) {
      if (pureP2PBrowserPreference) {
        const pureP2POptions = getBrowserPureP2PPkcOptions();
        pkcOptions = {
          ...pkcOptions,
          ...pureP2POptions,
          httpRoutersOptions: httpRoutersOptions?.length ? httpRoutersOptions : pureP2POptions.httpRoutersOptions,
          pkcRpcClientsOptions: undefined,
        };
      } else {
        pkcOptions = applyBrowserGatewayPkcOptions(pkcOptions, ipfsGatewayUrls, pubsubKuboRpcClientsOptions, httpRoutersOptions);
      }
    }

    // Store the mode before the account: without it, the upgrade hook turns a gateway account back to pure p2p after the reload.
    if (pureP2PBrowserPreference !== undefined && !setPureP2PBrowserPreference(pureP2PBrowserPreference)) {
      alert('Error saving options: the pure p2p setting could not be stored in browser storage');
      return;
    }

    try {
      await setAccount({
        ...account,
        mediaIpfsGatewayUrl,
        chainProviders,
        pkcOptions,
      });
      alert('Options saved, reloading...');
      window.location.reload();
    } catch (e) {
      if (e instanceof Error) {
        alert('Error saving options: ' + e.message);
        console.log(e);
      } else {
        alert('Error');
      }
    }
  };

  return (
    <div className={styles.content}>
      {canConfigurePureP2PBrowser && (
        <div className={styles.category}>
          <span className={styles.categoryTitle}>pure p2p</span>
          <span className={styles.categorySettings}>
            <PureP2PBrowserSettings pureP2PBrowserEnabled={browserPureP2PEnabled} onPureP2PBrowserChange={setBrowserPureP2PSelection} />
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
