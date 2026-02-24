import { app, BrowserWindow, ipcMain, Notification, systemPreferences } from 'electron';
import * as path from 'path';
import { setupFileUploaderPlugin } from './plugins/file-uploader';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Prevent file drops on the window
  mainWindow!.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow!.webContents.getURL()) {
      e.preventDefault();
    }
  });

  // Prevent default file drop behavior
  // @ts-ignore: drop event not in WebContents type definitions
  (mainWindow!.webContents as any).on('drop', (e: any) => {
    e.preventDefault();
  });

  // @ts-ignore: dragover event not in WebContents type definitions
  (mainWindow!.webContents as any).on('dragover', (e: any) => {
    e.preventDefault();
  });

  // Setup the FileUploader plugin
  setupFileUploaderPlugin(mainWindow);

  // Load your app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://seedit.localhost:1355');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

app.whenReady().then(() => {
  // --- notification IPC handlers ---
  ipcMain.handle('get-notification-permission-status', async () => {
    try {
      // First check if the Notification API itself is supported
      if (!Notification.isSupported()) {
        console.log('[Electron Main] Notification API not supported.');
        return 'not-supported';
      }

      // Platform-specific checks using Electron built-ins
      if (process.platform === 'darwin') {
        // macOS
        if (typeof (systemPreferences as any).getNotificationSettings === 'function') {
          // Use systemPreferences only if available (avoids electron internal warnings on older builds)
          // @ts-ignore: getNotificationSettings may not be in TS definitions
          const settings = (systemPreferences as any).getNotificationSettings();
          const auth = settings.authorizationStatus as string; // 'authorized'|'denied'|'not-determined'
          console.log('[Electron Main] macOS getNotificationSettings returned:', auth);
          if (auth === 'denied') return 'denied';
          if (auth === 'authorized') return 'granted';
          return 'not-determined';
        } else if (typeof (systemPreferences as any).getNotificationPermissionStatus === 'function') {
          // Fallback to older API
          // @ts-ignore
          const status = (systemPreferences as any).getNotificationPermissionStatus();
          console.log('[Electron Main] macOS getNotificationPermissionStatus returned:', status);
          return status;
        } else {
          console.warn('[Electron Main] No macOS notification permission API available; assuming granted.');
          return 'granted';
        }
      }

      // Windows/Linux/Other: Assume granted if Notification API is supported
      console.log('[Electron Main] Assuming notification permission granted on non-macOS platform.');
      return 'granted';
    } catch (error) {
      console.error('[Electron Main] Error getting notification permission status:', error);
      return 'unknown';
    }
  });
  ipcMain.handle('get-platform', () => {
    return process.platform as NodeJS.Platform;
  });
  // Changed from handle to on as it doesn't need to return a value
  ipcMain.on('show-notification', (_evt, notificationData) => {
    if (!Notification.isSupported()) {
      console.log('Notifications not supported on this system.');
      return; // Don't try to show if not supported
    }
    // Use the data passed from the renderer
    const { title, body } = notificationData;
    if (title && body) {
      new Notification({ title, body }).show();
    } else {
      console.error('Invalid notification data received:', notificationData);
    }
  });
  // Placeholder for test-notification if you implement it later
  // ipcMain.handle('test-notification', async () => {
  //   // Implement test logic
  //   return { success: true };
  // });
  // ---------------------------------

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
