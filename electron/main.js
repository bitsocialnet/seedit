import './log.js';
import { app, BrowserWindow, Menu, MenuItem, Tray, shell, dialog, nativeTheme, ipcMain, Notification, systemPreferences, clipboard } from 'electron';
import isDev from 'electron-is-dev';
import fs from 'fs';
import path from 'path';
import EnvPaths from 'env-paths';
import startIpfs from './start-ipfs.js';
import './start-plebbit-rpc.js';
import { URL, fileURLToPath } from 'node:url';
import contextMenu from 'electron-context-menu';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Linux startup hardening: default to X11 ozone and sanitize env to avoid GTK mixups
const isLinux = process.platform === 'linux';
if (isLinux && !process.env.SEEDIT_NO_ENV_SANITIZE) {
  // Default to X11 unless the user explicitly sets a hint
  if (!process.env.ELECTRON_OZONE_PLATFORM_HINT) {
    process.env.ELECTRON_OZONE_PLATFORM_HINT = 'x11';
  }
  // Unset common injectors known to trigger mixed GTK majors
  delete process.env.GTK_MODULES;
  delete process.env.GTK_PATH;
  delete process.env.LD_PRELOAD;
}

// Keep a global Tray reference to prevent GC removing the tray icon
let tray;

// Determine __filename and dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

// Load package.json dynamically
const packageJson = JSON.parse(fs.readFileSync(path.join(dirname, '../package.json'), 'utf-8'));

let startIpfsError;
startIpfs.onError = (error) => {
  // only show error once or it spams the user
  const alreadyShownIpfsError = !!startIpfsError;
  startIpfsError = error;
  if (!alreadyShownIpfsError && error.message) {
    dialog.showErrorBox('IPFS warning', error.message);
  }
};

// send plebbit rpc auth key to renderer
const plebbitDataPath = !isDev ? EnvPaths('plebbit', { suffix: false }).data : path.join(dirname, '..', '.plebbit');
const plebbitRpcAuthKey = fs.readFileSync(path.join(plebbitDataPath, 'auth-key'), 'utf8');
ipcMain.on('get-plebbit-rpc-auth-key', (event) => event.reply('plebbit-rpc-auth-key', plebbitRpcAuthKey));

// use common user agent instead of electron so img, video, audio, iframe elements don't get blocked
// https://www.whatismybrowser.com/guides/the-latest-version/chrome
// https://www.whatismybrowser.com/guides/the-latest-user-agent/chrome
// NOTE: eventually should probably fake sec-ch-ua header as well
let fakeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
if (process.platform === 'darwin') fakeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
if (process.platform === 'linux') fakeUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
const realUserAgent = `seedit/${packageJson.version}`;

// Handle IPC call to show notification
ipcMain.on('show-notification', (event, notificationData) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: notificationData.title,
      body: notificationData.body,
    });
    if (notificationData.url) {
      notification.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          shell.openExternal(notificationData.url).catch((err) => console.error('Failed to open URL:', err));
        }
      });
    }
    notification.show();
  } else {
    console.warn('Electron Notifications not supported on this system.');
  }
});

// Handle request for notification permission status
ipcMain.handle('get-notification-permission-status', async () => {
  try {
    if (!Notification.isSupported()) {
      console.log('[Electron Main] Notification API not supported.');
      return 'not-supported';
    }
    if (process.platform === 'darwin') {
      if (typeof systemPreferences.getNotificationSettings === 'function') {
        const settings = systemPreferences.getNotificationSettings();
        const auth = settings.authorizationStatus;
        if (auth === 'denied') return 'denied';
        if (auth === 'authorized') return 'granted';
        return 'not-determined';
      }
      if (typeof systemPreferences.getNotificationPermissionStatus === 'function') {
        return systemPreferences.getNotificationPermissionStatus();
      }
      return 'granted';
    }
    return 'granted';
  } catch (error) {
    console.error('[Electron Main] Error getting notification permission status:', error);
    return 'unknown';
  }
});

// Handle request to test notification permission
ipcMain.handle('test-notification-permission', async () => {
  if (!Notification.isSupported()) {
    return { success: false, reason: 'not-supported' };
  }
  try {
    let status = 'unknown';
    if (process.platform === 'darwin') {
      if (typeof systemPreferences.getNotificationPermissionStatus === 'function') {
        status = systemPreferences.getNotificationPermissionStatus();
      } else {
        status = Notification.isSupported() ? 'granted' : 'not-supported';
      }
    } else {
      status = Notification.isSupported() ? 'granted' : 'not-supported';
    }
    if (status === 'denied') return { success: false, reason: 'denied' };
    if (status === 'not-supported') return { success: false, reason: 'not-supported' };
    const testNotification = new Notification({
      title: 'Seedit Test',
      body: 'Testing if notifications are allowed.',
    });
    testNotification.show();
    return { success: true };
  } catch (error) {
    console.error('[Electron Main Test] Error sending test notification:', error);
    return { success: false, reason: 'error' };
  }
});

// add right click menu
contextMenu({
  // prepend custom buttons to top
  prepend: (defaultActions, parameters, browserWindow) => [
    {
      label: 'Back',
      visible: parameters.mediaType === 'none',
      enabled: browserWindow?.webContents?.canGoBack(),
      click: () => browserWindow?.webContents?.goBack(),
    },
    {
      label: 'Forward',
      visible: parameters.mediaType === 'none',
      enabled: browserWindow?.webContents?.canGoForward(),
      click: () => browserWindow?.webContents?.goForward(),
    },
    {
      label: 'Reload',
      visible: parameters.mediaType === 'none',
      click: () => browserWindow?.webContents?.reload(),
    },
  ],
  showLookUpSelection: false,
  showCopyImage: true,
  showCopyImageAddress: true,
  showSaveImageAs: true,
  showSaveLinkAs: true,
  showInspectElement: true,
  showServices: false,
  showSearchWithGoogle: false,
});

const createMainWindow = () => {
  let mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
    webPreferences: {
      webSecurity: true, // must be true or iframe embeds like youtube can do remote code execution
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
      preload: path.join(dirname, '../build/electron/preload.cjs'),
    },
  });

  // set fake user agent
  mainWindow.webContents.userAgent = fakeUserAgent;

  // set custom user agent and other headers for window.fetch requests to prevent origin errors
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const isIframe = !!details.frame?.parent;
    // if not a fetch request (or fetch request is from within iframe), do nothing, filtering webRequest by types doesn't seem to work
    if (details.resourceType !== 'xhr' || isIframe) {
      return callback({ requestHeaders: details.requestHeaders });
    }
    // add privacy
    details.requestHeaders['User-Agent'] = realUserAgent;
    details.requestHeaders['sec-ch-ua'] = undefined;
    details.requestHeaders['sec-ch-ua-platform'] = undefined;
    details.requestHeaders['sec-ch-ua-mobile'] = undefined;
    details.requestHeaders['Sec-Fetch-Dest'] = undefined;
    details.requestHeaders['Sec-Fetch-Mode'] = undefined;
    details.requestHeaders['Sec-Fetch-Site'] = undefined;
    // prevent origin errors
    details.requestHeaders['Origin'] = undefined;
    callback({ requestHeaders: details.requestHeaders });
  });

  // fix cors errors for window.fetch. must not be enabled for iframe or can cause remote code execution
  mainWindow.webContents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const isIframe = !!details.frame?.parent;
    // if not a fetch request (or fetch request is from within iframe), do nothing, filtering webRequest by types doesn't seem to work
    if (details.resourceType !== 'xhr' || isIframe) {
      return callback({ responseHeaders: details.responseHeaders });
    }
    // must delete lower case headers or both '*, *' could get added
    delete details.responseHeaders['access-control-allow-origin'];
    delete details.responseHeaders['access-control-allow-headers'];
    delete details.responseHeaders['access-control-allow-methods'];
    delete details.responseHeaders['access-control-expose-headers'];
    details.responseHeaders['Access-Control-Allow-Origin'] = '*';
    details.responseHeaders['Access-Control-Allow-Headers'] = '*';
    details.responseHeaders['Access-Control-Allow-Methods'] = '*';
    details.responseHeaders['Access-Control-Expose-Headers'] = '*';
    callback({ responseHeaders: details.responseHeaders });
  });

  const startURL = isDev ? 'http://seedit.localhost:1355' : `file://${path.join(dirname, '../build/index.html')}`;

  mainWindow.loadURL(startURL);

  mainWindow.once('ready-to-show', async () => {
    // make sure back button is disabled on launch
    mainWindow.webContents.clearHistory();

    mainWindow.show();

    if (isDev) {
      mainWindow.openDevTools();
    }

    if (startIpfsError) {
      dialog.showErrorBox('IPFS warning', startIpfsError.message);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // don't open new windows
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    mainWindow.loadURL(url);
  });

  // open links in external browser
  // do not open links in seedit or will lead to remote execution
  mainWindow.webContents.on('will-navigate', (e, originalUrl) => {
    if (originalUrl != mainWindow.webContents.getURL()) {
      e.preventDefault();
      try {
        // do not let the user open any url with shell.openExternal
        // or it will lead to remote execution https://benjamin-altpeter.de/shell-openexternal-dangers/

        // only open valid https urls to prevent remote execution
        // will throw if url isn't valid
        const validatedUrl = new URL(originalUrl);
        let serializedUrl = '';

        // make an exception for ipfs stats
        if (validatedUrl.toString() === 'http://localhost:50019/webui/') {
          serializedUrl = validatedUrl.toString();
        } else if (validatedUrl.protocol === 'https:') {
          // open serialized url to prevent remote execution
          serializedUrl = validatedUrl.toString();
        } else {
          throw Error(`can't open url '${originalUrl}', it's not https and not the allowed http exception`);
        }

        shell.openExternal(serializedUrl);
      } catch (e) {
        console.warn(e);
      }
    }
  });

  // open links (with target="_blank") in external browser
  // do not open links in seedit or will lead to remote execution
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const originalUrl = url;
    try {
      // do not let the user open any url with shell.openExternal
      // or it will lead to remote execution https://benjamin-altpeter.de/shell-openexternal-dangers/

      // only open valid https urls to prevent remote execution
      // will throw if url isn't valid
      const validatedUrl = new URL(originalUrl);
      let serializedUrl = '';

      // make an exception for ipfs stats
      if (validatedUrl.toString() === 'http://localhost:50019/webui/') {
        serializedUrl = validatedUrl.toString();
      } else if (validatedUrl.protocol === 'https:') {
        // open serialized url to prevent remote execution
        serializedUrl = validatedUrl.toString();
      } else {
        throw Error(`can't open url '${originalUrl}', it's not https and not the allowed http exception`);
      }

      shell.openExternal(serializedUrl);
    } catch (e) {
      console.warn(e);
    }
    return { action: 'deny' };
  });

  // deny permissions like location, notifications, etc https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // deny all permissions
    return callback(false);
  });

  // deny attaching webview https://www.electronjs.org/docs/latest/tutorial/security#12-verify-webview-options-before-creation
  mainWindow.webContents.on('will-attach-webview', (e) => {
    // deny all
    e.preventDefault();
  });

  if (process.platform !== 'darwin') {
    const isWayland =
      process.platform === 'linux' &&
      (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY || process.env.ELECTRON_OZONE_PLATFORM_HINT === 'wayland');
    const trayDisabled = isWayland && process.env.SEEDIT_ENABLE_TRAY !== '1';

    if (!trayDisabled) {
      // tray
      const trayIconPath = path.join(dirname, '..', isDev ? 'public' : 'build', 'electron-tray-icon.png');
      if (tray) {
        try {
          tray.destroy();
        } catch {}
      }
      tray = new Tray(trayIconPath);
      tray.setToolTip('seedit');
      const trayMenu = Menu.buildFromTemplate([
        {
          label: 'Open seedit',
          click: () => {
            mainWindow.show();
          },
        },
        {
          label: 'Quit seedit',
          click: () => {
            mainWindow.destroy();
            app.quit();
          },
        },
      ]);
      tray.setContextMenu(trayMenu);

      // show/hide on tray right click
      tray.on('right-click', () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      });

      // close to tray
      if (!isDev) {
        let isQuiting = false;
        app.on('before-quit', () => {
          isQuiting = true;
        });
        mainWindow.on('close', (event) => {
          if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
            event.returnValue = false;
          }
        });
      }
    }
  }

  const appMenuBack = new MenuItem({
    label: '←',
    enabled: mainWindow?.webContents?.canGoBack(),
    click: () => mainWindow?.webContents?.goBack(),
  });
  const appMenuForward = new MenuItem({
    label: '→',
    enabled: mainWindow?.webContents?.canGoForward(),
    click: () => mainWindow?.webContents?.goForward(),
  });
  const appMenuReload = new MenuItem({
    label: '⟳',
    role: 'reload',
    click: () => mainWindow?.webContents?.reload(),
  });

  // application menu
  // hide useless electron help menu
  if (process.platform === 'darwin') {
    const appMenu = Menu.getApplicationMenu();
    appMenu.insert(1, appMenuBack);
    appMenu.insert(2, appMenuForward);
    appMenu.insert(3, appMenuReload);
    Menu.setApplicationMenu(appMenu);
  } else {
    // Other platforms
    const originalAppMenuWithoutHelp = Menu.getApplicationMenu()?.items.filter((item) => item.role !== 'help');
    const appMenu = [appMenuBack, appMenuForward, appMenuReload, ...originalAppMenuWithoutHelp];
    Menu.setApplicationMenu(Menu.buildFromTemplate(appMenu));
  }
};

app.whenReady().then(() => {
  // Set app name and dock icon for development mode on macOS
  if (process.platform === 'darwin') {
    app.setName('seedit');
    if (app.dock) {
      const iconPath = path.join(dirname, '..', isDev ? 'public' : 'build', 'icon.png');
      app.dock.setIcon(iconPath);
    }
  }

  createMainWindow();

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// FileUploader plugin handlers
ipcMain.handle('plugin:file-uploader:pickAndUploadMedia', async (event) => {
  try {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images & Videos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm'] }],
    });
    if (result.canceled || result.filePaths.length === 0) throw new Error('File selection cancelled');
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', fs.createReadStream(filePath));
    const response = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
    return { url: await response.text(), fileName };
  } catch (error) {
    console.error('FileUploader error:', error);
    throw error;
  }
});

ipcMain.handle('plugin:file-uploader:uploadMedia', async (event, fileData) => {
  try {
    console.log('uploadMedia handler called with data:', typeof fileData);
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (fileData.fileData && fileData.fileName) {
      const buffer = Buffer.from(fileData.fileData, 'base64');
      formData.append('fileToUpload', buffer, fileData.fileName);
    } else {
      throw new Error('Invalid file data');
    }
    const response = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
    return { url: await response.text(), fileName: fileData.fileName || 'uploaded-file' };
  } catch (error) {
    console.error('FileUploader uploadMedia error:', error);
    throw error;
  }
});

ipcMain.handle('plugin:file-uploader:pickMedia', async (event) => {
  try {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images & Videos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm'] }],
    });
    if (result.canceled || result.filePaths.length === 0) throw new Error('File selection cancelled');
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const ext = path.extname(fileName).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.webm') mimeType = 'video/webm';
    return { data: base64Data, fileName, mimeType };
  } catch (error) {
    console.error('FileUploader pickMedia error:', error);
    throw error;
  }
});

// Handle request to copy text to clipboard
ipcMain.handle('copy-to-clipboard', async (event, text) => {
  try {
    clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    console.error('[Electron Main] Error copying to clipboard:', error);
    return { success: false, error: error.message };
  }
});

// Handle request for platform info
ipcMain.handle('get-platform', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.version,
  };
});
