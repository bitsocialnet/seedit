import {
  canUsePureP2PBrowser,
  getBrowserGatewayPkcOptions,
  getBrowserPureP2PPkcOptions,
  getLegacyDefaultBrowserHttpRoutersOptions,
  isElectronRuntime,
  shouldUsePureP2PBrowser,
} from './p2p-browser-config';

export const P2P_STATS_SECTION_ID = 'p2p-stats-settings';

export type P2PRuntimeMode = 'browser-libp2p' | 'electron-kubo-rpc' | 'full-node-rpc';

type AccountProtocolOptions = {
  httpRoutersOptions?: string[];
  ipfsGatewayUrls?: string[];
  kuboRpcClientsOptions?: unknown[];
  libp2pJsClientsOptions?: unknown[];
  pkcRpcClientsOptions?: string[];
  pubsubHttpClientsOptions?: unknown[];
  pubsubKuboRpcClientsOptions?: unknown[];
};

type AccountShape = {
  pkc?: {
    clients?: {
      libp2pJsClients?: Record<string, unknown>;
      pkcRpcClients?: Record<string, unknown>;
    };
  };
  pkcOptions?: AccountProtocolOptions;
};

const toAccountShape = (account: unknown) => account as AccountShape | undefined;

const hasArrayItems = (value: unknown) => Array.isArray(value) && value.length > 0;

const hasObjectItems = (value: unknown) => !!value && typeof value === 'object' && Object.keys(value).length > 0;

const hasMixedBrowserPureP2POptions = (protocolOptions: AccountProtocolOptions | undefined) =>
  hasArrayItems(protocolOptions?.libp2pJsClientsOptions) &&
  (hasArrayItems(protocolOptions?.kuboRpcClientsOptions) || hasArrayItems(protocolOptions?.pubsubKuboRpcClientsOptions));

export const getP2PRuntimeMode = (account?: unknown, targetWindow: Window = window): P2PRuntimeMode | null => {
  const accountShape = toAccountShape(account);
  const protocolOptions = accountShape?.pkcOptions;
  const clients = accountShape?.pkc?.clients;

  if (hasArrayItems(protocolOptions?.libp2pJsClientsOptions) || hasObjectItems(clients?.libp2pJsClients)) {
    return 'browser-libp2p';
  }

  if (hasArrayItems(protocolOptions?.pkcRpcClientsOptions) || hasObjectItems(clients?.pkcRpcClients)) {
    return isElectronRuntime(targetWindow) ? 'electron-kubo-rpc' : 'full-node-rpc';
  }

  return null;
};

export const canConfigureBrowserPureP2P = (targetWindow: Window = window) => canUsePureP2PBrowser(targetWindow);

export const shouldShowP2PSettingsSection = (account?: unknown, targetWindow: Window = window) => {
  const runtimeMode = getP2PRuntimeMode(account, targetWindow);
  if (runtimeMode === 'electron-kubo-rpc' || runtimeMode === 'full-node-rpc') return true;
  return canConfigureBrowserPureP2P(targetWindow) && (runtimeMode === 'browser-libp2p' || isBrowserPureP2PEnabled(account, targetWindow));
};

export const isBrowserPureP2PEnabled = (account?: unknown, targetWindow: Window = window) => {
  if (!canConfigureBrowserPureP2P(targetWindow)) return false;
  const runtimeMode = getP2PRuntimeMode(account, targetWindow);
  if (runtimeMode === 'browser-libp2p') return true;
  // An account on a full node RPC is not using the browser P2P node, whatever the stored preference says.
  if (runtimeMode === 'full-node-rpc') return false;
  return shouldUsePureP2PBrowser(targetWindow);
};

export const getBrowserPureP2PAccountOptions = (account?: unknown) => {
  const protocolOptions = toAccountShape(account)?.pkcOptions;
  const pureP2POptions = getBrowserPureP2PPkcOptions();

  return {
    ...protocolOptions,
    ...pureP2POptions,
    httpRoutersOptions: hasArrayItems(protocolOptions?.httpRoutersOptions) ? protocolOptions?.httpRoutersOptions : getLegacyDefaultBrowserHttpRoutersOptions(),
    pkcRpcClientsOptions: undefined,
  };
};

export const shouldUpgradeBrowserPureP2PAccount = (account?: unknown, targetWindow: Window = window) => {
  if (!account || typeof account !== 'object' || !canConfigureBrowserPureP2P(targetWindow) || !isBrowserPureP2PEnabled(account, targetWindow)) return false;

  const protocolOptions = toAccountShape(account)?.pkcOptions;
  return getP2PRuntimeMode(account, targetWindow) === null || hasMixedBrowserPureP2POptions(protocolOptions);
};

export const getBrowserGatewayAccountOptions = (account?: unknown) => {
  const protocolOptions = toAccountShape(account)?.pkcOptions;
  const gatewayOptions = getBrowserGatewayPkcOptions();

  return {
    ...protocolOptions,
    ...gatewayOptions,
    ipfsGatewayUrls: hasArrayItems(protocolOptions?.ipfsGatewayUrls) ? protocolOptions?.ipfsGatewayUrls : gatewayOptions.ipfsGatewayUrls,
    pubsubKuboRpcClientsOptions: hasArrayItems(protocolOptions?.pubsubKuboRpcClientsOptions)
      ? protocolOptions?.pubsubKuboRpcClientsOptions
      : gatewayOptions.pubsubKuboRpcClientsOptions,
    httpRoutersOptions: hasArrayItems(protocolOptions?.httpRoutersOptions) ? protocolOptions?.httpRoutersOptions : gatewayOptions.httpRoutersOptions,
    pkcRpcClientsOptions: undefined,
  };
};
