import { useState } from 'react';
import { setAccount, useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import {
  getBrowserGatewayPkcOptions,
  getBrowserPureP2PPkcOptions,
  getPureP2PBrowserPreference,
  restorePureP2PBrowserPreference,
  setPureP2PBrowserPreference,
} from '../lib/p2p-browser-config';
import { canConfigureBrowserPureP2P, isBrowserPureP2PEnabled } from '../lib/p2p-runtime';
import { getSupportedChainProviders } from '../lib/utils/chain-provider-utils';

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

/** The raw text of each advanced field; undefined for a field that is not shown, which keeps the saved value. */
export interface AdvancedSettingsValues {
  ipfsGatewayUrls?: string;
  mediaIpfsGatewayUrl?: string;
  pubsubProviders?: string;
  httpRouters?: string;
  ethRpcUrls?: string;
  fullNodeRpc?: string;
  dataPath?: string;
}

// chainProviders live on the account top-level since bitsocial-react-hooks 0.1.27;
// fall back to the legacy pkcOptions location for accounts saved by older versions
export const getChainProviders = (account: unknown) => {
  const accountShape = account as { chainProviders?: AccountProtocolOptions['chainProviders']; pkcOptions?: AccountProtocolOptions } | undefined;
  return accountShape?.chainProviders ?? accountShape?.pkcOptions?.chainProviders;
};

const getTrimmedLines = (value: string | undefined): string[] | undefined =>
  value?.split('\n').reduce<string[]>((lines, line) => {
    const trimmedLine = line.trim();
    if (trimmedLine) lines.push(trimmedLine);
    return lines;
  }, []);

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

/**
 * The account's P2P options: gateways, pubsub providers, routers, chain RPCs, a full node, and pure P2P in the browser.
 * Saving writes the account and reloads, since the P2P client starts with them. Both interfaces' settings pages use it.
 */
const useAdvancedSettings = () => {
  const account = useAccount();
  const pkcRpc = usePkcRpcSettings();
  const protocolOptions: AccountProtocolOptions | undefined = account?.pkcOptions;
  const canConfigurePureP2PBrowser = canConfigureBrowserPureP2P();
  const activeBrowserPureP2PEnabled = canConfigurePureP2PBrowser && isBrowserPureP2PEnabled(account);
  const [browserPureP2PSelection, setBrowserPureP2PSelection] = useState<boolean | undefined>(undefined);
  const browserPureP2PEnabled = browserPureP2PSelection ?? activeBrowserPureP2PEnabled;
  const chainProviders = getChainProviders(account);
  const rpcDataPath = pkcRpc?.pkcRpcSettings?.pkcOptions?.dataPath;

  const save = async (values: AdvancedSettingsValues) => {
    const ipfsGatewayUrls = values.ipfsGatewayUrls !== undefined ? getTrimmedLines(values.ipfsGatewayUrls) : protocolOptions?.ipfsGatewayUrls;
    const mediaIpfsGatewayUrl = values.mediaIpfsGatewayUrl !== undefined ? values.mediaIpfsGatewayUrl.trim() || undefined : account?.mediaIpfsGatewayUrl;
    const pubsubKuboRpcClientsOptions = values.pubsubProviders !== undefined ? getTrimmedLines(values.pubsubProviders) : protocolOptions?.pubsubKuboRpcClientsOptions;
    const ethRpcUrls = getTrimmedLines(values.ethRpcUrls);
    const httpRoutersOptions = values.httpRouters !== undefined ? getTrimmedLines(values.httpRouters) : protocolOptions?.httpRoutersOptions;
    const pkcRpcClientsOptions = values.fullNodeRpc?.trim() ? [values.fullNodeRpc.trim()] : undefined;
    const dataPath = values.dataPath?.trim() || undefined;
    // A full node RPC URL selects RPC mode, since the pure p2p options below would discard it, unless the user ticked
    // pure p2p and left the saved URL that prefills the field as it was.
    const pureP2PTickedOverSavedRpcUrl = browserPureP2PSelection === true && pkcRpcClientsOptions?.[0] === protocolOptions?.pkcRpcClientsOptions?.[0];
    const usesRpcUrl = !!pkcRpcClientsOptions && !pureP2PTickedOverSavedRpcUrl;
    const pureP2PBrowserPreference = canConfigurePureP2PBrowser ? browserPureP2PEnabled && !usesRpcUrl : undefined;

    const nextChainProviders: NonNullable<AccountProtocolOptions['chainProviders']> = getSupportedChainProviders(getChainProviders(account)) ?? {};
    if (ethRpcUrls?.length) nextChainProviders.eth = { urls: ethRpcUrls, chainId: 1 };

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
    const previousPureP2PBrowserPreference = getPureP2PBrowserPreference();
    if (pureP2PBrowserPreference !== undefined && !setPureP2PBrowserPreference(pureP2PBrowserPreference)) {
      alert('Error saving options: the pure p2p setting could not be stored in browser storage');
      return;
    }

    try {
      await setAccount({ ...account, mediaIpfsGatewayUrl, chainProviders: nextChainProviders, pkcOptions });
      alert('Options saved, reloading...');
      window.location.reload();
    } catch (e) {
      // The account kept its old mode, so the stored mode goes back too, or the upgrade hook would switch it on the next load.
      if (pureP2PBrowserPreference !== undefined) restorePureP2PBrowserPreference(previousPureP2PBrowserPreference);
      if (e instanceof Error) {
        alert('Error saving options: ' + e.message);
        console.log(e);
      } else {
        alert('Error');
      }
    }
  };

  return {
    isConnectedToRpc: pkcRpc?.state === 'connected',
    canConfigurePureP2PBrowser,
    browserPureP2PEnabled,
    setBrowserPureP2PEnabled: setBrowserPureP2PSelection,
    /** Gateways and pubsub providers apply only when the browser is not its own P2P node. */
    showsGatewaySettings: !canConfigurePureP2PBrowser || !activeBrowserPureP2PEnabled,
    savedValues: {
      ipfsGatewayUrls: protocolOptions?.ipfsGatewayUrls?.join('\n') ?? '',
      mediaIpfsGatewayUrl: account?.mediaIpfsGatewayUrl ?? '',
      pubsubProviders: protocolOptions?.pubsubKuboRpcClientsOptions?.join('\n') ?? '',
      httpRouters: protocolOptions?.httpRoutersOptions?.join('\n') ?? '',
      ethRpcUrls: chainProviders?.['eth']?.urls?.join('\n') ?? '',
      fullNodeRpc: protocolOptions?.pkcRpcClientsOptions?.[0] ?? '',
      dataPath: typeof rpcDataPath === 'string' ? rpcDataPath : '',
    },
    save,
  };
};

export default useAdvancedSettings;
