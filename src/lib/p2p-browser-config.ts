export const PURE_P2P_BROWSER_SETTING_KEY = 'seedit:pure-p2p-browser-enabled';
export const BROWSER_PURE_P2P_DEFAULT_ENABLED = true;

const BROWSER_PUBSUB_KUBO_RPC_CLIENTS_OPTIONS = ['https://pubsubprovider.xyz/api/v0', 'https://plebpubsub.xyz/api/v0', 'https://rannithepleb.com/api/v0'];
// Keep this aligned with bitsocial-react-hooks' DEFAULT_HTTP_ROUTER_URLS without relying on a package-internal runtime import before window.defaultPkcOptions is configured.
const DEFAULT_HTTP_ROUTER_URLS = [
  'https://peers.pleb.bot',
  'https://routing.lol',
  'https://peers.forumindex.com',
  'https://peers.plebpubsub.xyz',
  'https://routerofbitsocial.xyz',
  'https://bsotracker.online',
];

const LEGACY_DEFAULT_BROWSER_HTTP_ROUTER_URLS = ['https://routing.lol', 'https://peers.pleb.bot', 'https://peers.plebpubsub.xyz', 'https://peers.forumindex.com'];

const LEGACY_DEFAULT_HTTP_ROUTER_URL_SETS = [['https://peers.plebpubsub.xyz', 'https://routing.lol', 'https://peers.pleb.bot'], LEGACY_DEFAULT_BROWSER_HTTP_ROUTER_URLS];

export type BrowserHttpRoutersSettingsUpgrade = {
  currentHttpRoutersOptions: string[];
  missingDefaultHttpRoutersOptions: string[];
  upgradedHttpRoutersOptions: string[];
};

export const P2P_BROWSER_PKC_OPTIONS = {
  libp2pJsClientsOptions: [{ key: 'libp2pjs' }],
  ipfsGatewayUrls: undefined,
  kuboRpcClientsOptions: undefined,
  pubsubHttpClientsOptions: undefined,
  pubsubKuboRpcClientsOptions: undefined as string[] | undefined,
  httpRoutersOptions: DEFAULT_HTTP_ROUTER_URLS,
};

const GATEWAY_BROWSER_PKC_OPTIONS = {
  ipfsGatewayUrls: ['https://ipfsgateway.xyz', 'https://gateway.plebpubsub.xyz', 'https://gateway.forumindex.com'],
  kuboRpcClientsOptions: undefined,
  libp2pJsClientsOptions: undefined,
  pubsubHttpClientsOptions: undefined,
  pubsubKuboRpcClientsOptions: BROWSER_PUBSUB_KUBO_RPC_CLIENTS_OPTIONS,
  httpRoutersOptions: DEFAULT_HTTP_ROUTER_URLS,
};

type P2PBrowserConfigWindow = {
  location?: Pick<Location, 'hostname'>;
  defaultPkcOptions?: Record<string, unknown>;
  electronApi?: { isElectron?: boolean };
  isElectron?: boolean;
  localStorage?: Pick<Storage, 'getItem' | 'setItem'>;
};

const cloneArray = <T>(value: T[] | undefined) => (value ? [...value] : undefined);

const getUniqueTrimmedUrls = (urls: string[] | undefined) =>
  urls?.reduce<string[]>((uniqueUrls, url) => {
    const trimmedUrl = url.trim();
    if (trimmedUrl && !uniqueUrls.includes(trimmedUrl)) uniqueUrls.push(trimmedUrl);
    return uniqueUrls;
  }, []) ?? [];

const hasSameUrlSet = (urls: string[], comparisonUrls: string[]) => {
  if (urls.length !== comparisonUrls.length) return false;
  return urls.every((url) => comparisonUrls.includes(url));
};

const hasUrlSet = (urls: string[], comparisonUrls: string[]) => comparisonUrls.every((url) => urls.includes(url));

const isKnownDefaultHttpRoutersOptions = (httpRoutersOptions: string[]) => {
  if (hasSameUrlSet(httpRoutersOptions, DEFAULT_HTTP_ROUTER_URLS)) return true;
  if (LEGACY_DEFAULT_HTTP_ROUTER_URL_SETS.some((legacyRouters) => hasSameUrlSet(httpRoutersOptions, legacyRouters))) return true;
  return (
    httpRoutersOptions.every((routerUrl) => DEFAULT_HTTP_ROUTER_URLS.includes(routerUrl)) &&
    LEGACY_DEFAULT_HTTP_ROUTER_URL_SETS.some((legacyRouters) => hasUrlSet(httpRoutersOptions, legacyRouters))
  );
};

export const getBrowserHttpRoutersSettingsUpgrade = (httpRoutersOptions: string[] | undefined): BrowserHttpRoutersSettingsUpgrade | undefined => {
  const httpRouters = getUniqueTrimmedUrls(httpRoutersOptions);
  if (httpRouters.length === 0 || !isKnownDefaultHttpRoutersOptions(httpRouters)) return undefined;

  const missingDefaultHttpRoutersOptions = DEFAULT_HTTP_ROUTER_URLS.filter((routerUrl) => !httpRouters.includes(routerUrl));
  if (missingDefaultHttpRoutersOptions.length === 0) return undefined;

  return {
    currentHttpRoutersOptions: httpRouters,
    missingDefaultHttpRoutersOptions,
    upgradedHttpRoutersOptions: [...httpRouters, ...missingDefaultHttpRoutersOptions],
  };
};

export const addBrowserHttpRoutersOptions = (httpRoutersOptions: string[] | undefined, routerUrls: string[]) => {
  const normalizedRouters = getUniqueTrimmedUrls(httpRoutersOptions);
  return routerUrls.reduce<string[]>((routers, routerUrl) => {
    const trimmedRouterUrl = routerUrl.trim();
    if (trimmedRouterUrl && !routers.includes(trimmedRouterUrl)) routers.push(trimmedRouterUrl);
    return routers;
  }, normalizedRouters);
};

export const getLegacyDefaultBrowserHttpRoutersOptions = () => [...LEGACY_DEFAULT_BROWSER_HTTP_ROUTER_URLS];

export const getBrowserPureP2PPkcOptions = () => ({
  ...P2P_BROWSER_PKC_OPTIONS,
  libp2pJsClientsOptions: P2P_BROWSER_PKC_OPTIONS.libp2pJsClientsOptions.map((options) => ({ ...options })),
  pubsubKuboRpcClientsOptions: cloneArray(P2P_BROWSER_PKC_OPTIONS.pubsubKuboRpcClientsOptions),
  httpRoutersOptions: [...P2P_BROWSER_PKC_OPTIONS.httpRoutersOptions],
});

export const getBrowserGatewayPkcOptions = () => ({
  ...GATEWAY_BROWSER_PKC_OPTIONS,
  ipfsGatewayUrls: [...GATEWAY_BROWSER_PKC_OPTIONS.ipfsGatewayUrls],
  pubsubKuboRpcClientsOptions: [...GATEWAY_BROWSER_PKC_OPTIONS.pubsubKuboRpcClientsOptions],
  httpRoutersOptions: [...GATEWAY_BROWSER_PKC_OPTIONS.httpRoutersOptions],
});

export const getPureP2PBrowserPreference = (targetWindow: P2PBrowserConfigWindow = window) => {
  try {
    const storedValue = targetWindow.localStorage?.getItem(PURE_P2P_BROWSER_SETTING_KEY);
    if (storedValue === 'true') return true;
    if (storedValue === 'false') return false;
  } catch {
    return undefined;
  }

  return undefined;
};

export const setPureP2PBrowserPreference = (enabled: boolean, targetWindow: P2PBrowserConfigWindow = window) => {
  try {
    if (!targetWindow.localStorage) return false;
    targetWindow.localStorage.setItem(PURE_P2P_BROWSER_SETTING_KEY, String(enabled));
    return true;
  } catch {
    return false;
  }
};

export const isElectronRuntime = (targetWindow: P2PBrowserConfigWindow = window) => targetWindow.electronApi?.isElectron === true || targetWindow.isElectron === true;

export const canUsePureP2PBrowser = (targetWindow: P2PBrowserConfigWindow = window) => !isElectronRuntime(targetWindow);

export const shouldUsePureP2PBrowser = (targetWindow: P2PBrowserConfigWindow = window) => {
  if (!canUsePureP2PBrowser(targetWindow)) return false;

  const preference = getPureP2PBrowserPreference(targetWindow);
  if (preference !== undefined) return preference;

  return BROWSER_PURE_P2P_DEFAULT_ENABLED;
};

export const configureP2PBrowserPkcOptions = (targetWindow: P2PBrowserConfigWindow = window) => {
  if (!shouldUsePureP2PBrowser(targetWindow)) {
    if (canUsePureP2PBrowser(targetWindow)) {
      targetWindow.defaultPkcOptions = {
        ...targetWindow.defaultPkcOptions,
        ...getBrowserGatewayPkcOptions(),
      };
    }

    return false;
  }

  targetWindow.defaultPkcOptions = {
    ...targetWindow.defaultPkcOptions,
    ...getBrowserPureP2PPkcOptions(),
  };

  return true;
};
