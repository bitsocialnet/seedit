import { contextBridge, ipcRenderer, webUtils } from 'electron';

// dev uses http://localhost, prod uses file://...index.html

const defaultPkcOptions = {
  pkcRpcClientsOptions: ['ws://localhost:9138'],
  httpRoutersOptions: ['https://peers.pleb.bot', 'https://routing.lol', 'https://peers.forumindex.com', 'https://peers.plebpubsub.xyz'],
};

contextBridge.exposeInMainWorld('isElectron', true);
contextBridge.exposeInMainWorld('defaultPkcOptions', defaultPkcOptions);
contextBridge.exposeInMainWorld('defaultMediaIpfsGatewayUrl', 'http://localhost:6473');

// receive PKC RPC auth key from main
ipcRenderer.on('pkc-rpc-auth-key', (event, pkcRpcAuthKey) => contextBridge.exposeInMainWorld('pkcRpcAuthKey', pkcRpcAuthKey));
ipcRenderer.send('get-pkc-rpc-auth-key');

// notifications IPC
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    const validChannels = ['get-notification-permission-status', 'get-platform', 'test-notification-permission', 'copy-to-clipboard'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },
  sendNotification: (notification) => {
    ipcRenderer.send('show-notification', notification);
  },
});

const getPathForFile = (file) => {
  try {
    return webUtils.getPathForFile(file) || null;
  } catch {
    return null;
  }
};

contextBridge.exposeInMainWorld('electronApi', {
  isElectron: true,
  getNotificationStatus: () => ipcRenderer.invoke('get-notification-permission-status'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getNodeReachability: () => ipcRenderer.invoke('get-node-reachability'),
  testNotification: () => ipcRenderer.invoke('test-notification-permission'),
  showNotification: (notification) => ipcRenderer.send('show-notification', notification),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  // Takes a File, not a path: only a file the user picked or dropped has one, so the renderer cannot make the app upload other files.
  automateUploadMedia: ({ provider, file }) => {
    const filePath = getPathForFile(file);
    if (!filePath) return Promise.reject(new Error('File path unavailable'));
    return ipcRenderer.invoke('automate-upload-media', { provider, filePath });
  },
  isFileOnDisk: (file) => Boolean(getPathForFile(file)),
  automateUploadGeneratedMedia: (options) => ipcRenderer.invoke('automate-upload-generated-media', options),
  getForgeTurnstileToken: async (sitekey) => {
    const { token, error } = await ipcRenderer.invoke('get-forge-turnstile-token', sitekey);
    if (error) throw new Error(error);
    return token;
  },
});
