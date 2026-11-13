/**
 * Unit tests for the Electron main process lifecycle: the main window handle, notification clicks,
 * the application menu, the IPFS warning dialog and the single-instance lock.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  app: null,
  appReady: null,
  isReady: true,
  singleInstanceLock: true,
  quit: null,
  windows: [],
  ipcOn: {},
  notifications: [],
  applicationMenu: null,
  showErrorBox: null,
  openExternal: null,
  pkcDataPath: '',
  startIpfs: {},
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');

  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.visible = false;
      this.destroyed = false;
      const webContents = new EventEmitter();
      Object.assign(webContents, {
        session: { webRequest: { onBeforeSendHeaders: vi.fn(), onHeadersReceived: vi.fn() }, setPermissionRequestHandler: vi.fn() },
        clearHistory: vi.fn(),
        canGoBack: vi.fn(() => false),
        canGoForward: vi.fn(() => false),
        goBack: vi.fn(),
        goForward: vi.fn(),
        reload: vi.fn(),
        getURL: vi.fn(() => 'file:///seedit/build/index.html#/'),
        setWindowOpenHandler: vi.fn(),
        executeJavaScript: vi.fn(async () => undefined),
      });
      this.webContents = webContents;
      this.loadURL = vi.fn(async () => undefined);
      this.show = vi.fn(() => {
        this.visible = true;
      });
      this.hide = vi.fn(() => {
        this.visible = false;
      });
      this.focus = vi.fn();
      this.restore = vi.fn();
      this.openDevTools = vi.fn();
      this.destroy = vi.fn(() => {
        this.destroyed = true;
        this.emit('closed');
      });
      state.windows.push(this);
    }
    isVisible() {
      return this.visible;
    }
    isMinimized() {
      return false;
    }
    isDestroyed() {
      return this.destroyed;
    }
    // what the OS close button does: 'close' can be prevented, otherwise the window is destroyed
    close() {
      const event = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      this.emit('close', event);
      if (!event.defaultPrevented) this.destroy();
    }
    static getAllWindows() {
      return state.windows.filter((window) => !window.destroyed);
    }
    static fromWebContents(webContents) {
      return state.windows.find((window) => window.webContents === webContents) ?? null;
    }
  }

  class MenuItem {
    constructor(options) {
      Object.assign(this, { enabled: true }, options);
    }
  }

  class FakeMenu {
    constructor(items) {
      this.items = items;
    }
    insert(position, item) {
      this.items.splice(position, 0, item);
    }
  }

  class Notification extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.show = vi.fn();
      state.notifications.push(this);
    }
    static isSupported() {
      return true;
    }
  }

  class Tray {
    setToolTip() {}
    setContextMenu() {}
    on() {}
    destroy() {}
  }

  return {
    app: {
      on: (...args) => state.app.on(...args),
      once: (...args) => state.app.once(...args),
      whenReady: () => state.appReady,
      isReady: () => state.isReady,
      quit: (...args) => state.quit(...args),
      requestSingleInstanceLock: () => state.singleInstanceLock,
      setName: () => {},
      dock: { setIcon: () => {} },
      getPath: () => os.tmpdir(),
    },
    BrowserWindow,
    Menu: {
      getApplicationMenu: () => (state.applicationMenu ??= new FakeMenu([new MenuItem({ role: 'appMenu' }), new MenuItem({ role: 'help' })])),
      setApplicationMenu: (menu) => {
        state.applicationMenu = menu;
      },
      buildFromTemplate: (template) => new FakeMenu(template.map((item) => (item instanceof MenuItem ? item : new MenuItem(item)))),
    },
    MenuItem,
    Tray,
    Notification,
    shell: { openExternal: (...args) => state.openExternal(...args) },
    dialog: { showErrorBox: (...args) => state.showErrorBox(...args) },
    nativeTheme: { shouldUseDarkColors: false },
    ipcMain: {
      on: (channel, handler) => {
        state.ipcOn[channel] = handler;
      },
      handle: () => {},
    },
    systemPreferences: {},
    clipboard: { writeText: async () => undefined },
  };
});

vi.mock('electron-is-dev', () => ({ default: false }));
vi.mock('electron-context-menu', () => ({ default: () => {} }));
vi.mock('./log.js', () => ({}));
vi.mock('./start-ipfs.js', () => ({ default: state.startIpfs }));
vi.mock('./start-pkc-rpc.js', () => ({}));
vi.mock('./pkc-paths.js', () => ({ getPkcDataPath: () => state.pkcDataPath }));
vi.mock('./node-reachability.js', () => ({ getNodeReachability: () => 'unknown' }));
vi.mock('./media-upload-automation.js', () => ({ automateUploadMedia: () => {} }));
vi.mock('./media-upload-recipes.js', () => ({ MEDIA_UPLOAD_RECIPES: {} }));
vi.mock('./forge-turnstile.js', () => ({ getForgeTurnstileToken: () => {} }));
vi.mock('./strip-media-metadata.js', () => ({ prepareStrippedUploadFile: () => {} }));

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const setPlatform = (platform) => Object.defineProperty(process, 'platform', { value: platform, configurable: true, enumerable: true });
const restorePlatform = () => {
  if (realPlatform) Object.defineProperty(process, 'platform', realPlatform);
  else delete process.platform;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const importMain = async () => {
  vi.resetModules();
  await import('./main.js');
  await flush();
};

const deferAppReady = () => {
  state.isReady = false;
  let resolveReady;
  state.appReady = new Promise((resolve) => {
    resolveReady = resolve;
  });
  return async () => {
    state.isReady = true;
    resolveReady();
    await flush();
  };
};

const notify = (url) => {
  state.ipcOn['show-notification']({}, { title: 'You received a reply', body: 'u/someone replied', url });
  return state.notifications.at(-1);
};

const menuItemsLabeled = (label) => state.applicationMenu.items.filter((item) => item.label === label);

beforeAll(() => {
  state.pkcDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'seedit-main-test-'));
  fs.writeFileSync(path.join(state.pkcDataPath, 'auth-key'), 'test-auth-key');
});

afterAll(() => {
  fs.rmSync(state.pkcDataPath, { recursive: true, force: true });
});

beforeEach(() => {
  state.app = new EventEmitter();
  state.appReady = Promise.resolve();
  state.isReady = true;
  state.singleInstanceLock = true;
  state.quit = vi.fn();
  state.windows = [];
  state.ipcOn = {};
  state.notifications = [];
  state.applicationMenu = null;
  state.showErrorBox = vi.fn();
  state.openExternal = vi.fn(async () => undefined);
  for (const key of Object.keys(state.startIpfs)) delete state.startIpfs[key];
});

afterEach(restorePlatform);

describe('notification click', () => {
  it('shows the hidden window and opens the notification route in the app', async () => {
    setPlatform('win32');
    await importMain();
    const [window] = state.windows;
    window.close(); // hidden to the tray
    expect(window.isVisible()).toBe(false);

    const notification = notify('/#/s/community.bso/comments/QmCid');
    expect(() => notification.emit('click')).not.toThrow();

    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith('window.location.hash = "#/s/community.bso/comments/QmCid"');
    expect(state.openExternal).not.toHaveBeenCalled();
  });

  it('opens a new window on the notification route when macOS closed the last one', async () => {
    setPlatform('darwin');
    await importMain();
    state.windows[0].close();
    expect(state.windows[0].isDestroyed()).toBe(true);

    notify('/#/s/community.bso/comments/QmCid').emit('click');

    const window = state.windows.at(-1);
    expect(window.isDestroyed()).toBe(false);
    expect(state.windows.filter((candidate) => !candidate.isDestroyed())).toHaveLength(1);
    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith('window.location.hash = "#/s/community.bso/comments/QmCid"');
  });

  it('does not open notification urls that are not in-app routes', async () => {
    setPlatform('win32');
    await importMain();
    const [window] = state.windows;

    for (const url of ['https://example.com/', 'file:///etc/hosts', '/s/community.bso']) {
      const notification = notify(url);
      expect(() => notification.emit('click')).not.toThrow();
    }

    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(state.openExternal).not.toHaveBeenCalled();
  });
});

describe('application menu', () => {
  it('adds the back, forward and reload items once when macOS re-creates the window', async () => {
    setPlatform('darwin');
    await importMain();
    state.windows[0].close();
    state.app.emit('activate');
    expect(state.windows.filter((window) => !window.isDestroyed())).toHaveLength(1);

    expect(menuItemsLabeled('←')).toHaveLength(1);
    expect(menuItemsLabeled('→')).toHaveLength(1);
    expect(menuItemsLabeled('⟳')).toHaveLength(1);
  });

  it('keeps back and forward usable and acts on the focused window', async () => {
    setPlatform('win32');
    await importMain();
    const [window] = state.windows;
    const [back] = menuItemsLabeled('←');
    const [forward] = menuItemsLabeled('→');

    // the items are created before any in-app navigation, when the window has no history yet
    expect(back.enabled).not.toBe(false);
    expect(forward.enabled).not.toBe(false);

    back.click(back, window);
    forward.click(forward, window);
    expect(window.webContents.goBack).toHaveBeenCalledTimes(1);
    expect(window.webContents.goForward).toHaveBeenCalledTimes(1);
  });
});

describe('IPFS warning', () => {
  it('shows a start error once, not again when the window is ready', async () => {
    await importMain();
    state.startIpfs.onError(new Error('ipfs repo is locked'));
    state.windows[0].emit('ready-to-show');
    state.startIpfs.onError(new Error('ipfs repo is locked'));

    expect(state.showErrorBox).toHaveBeenCalledTimes(1);
    expect(state.showErrorBox).toHaveBeenCalledWith('IPFS warning', 'ipfs repo is locked');
  });

  it('never shows an empty warning, and an error without a message does not hide a later one', async () => {
    await importMain();
    // a daemon that exits without writing to stderr is reported as Error(undefined)
    state.startIpfs.onError(new Error(undefined));
    state.windows[0].emit('ready-to-show');
    expect(state.showErrorBox).not.toHaveBeenCalled();

    state.startIpfs.onError(new Error('ipfs daemon failed'));
    expect(state.showErrorBox).toHaveBeenCalledTimes(1);
    expect(state.showErrorBox).toHaveBeenCalledWith('IPFS warning', 'ipfs daemon failed');
  });

  it('shows an error from before the app was ready once, when the window is ready', async () => {
    const appIsReady = deferAppReady();
    await importMain();
    state.startIpfs.onError(new Error('ipfs repo is locked'));
    // before ready, Linux prints showErrorBox to stderr only
    expect(state.showErrorBox).not.toHaveBeenCalled();

    await appIsReady();
    state.windows[0].emit('ready-to-show');
    expect(state.showErrorBox).toHaveBeenCalledTimes(1);
    expect(state.showErrorBox).toHaveBeenCalledWith('IPFS warning', 'ipfs repo is locked');
  });

  it('does not show an error that a later successful start recovered from', async () => {
    const appIsReady = deferAppReady();
    await importMain();
    state.startIpfs.onError(new Error('ipfs repo is locked'));
    state.startIpfs.onStarted?.();

    await appIsReady();
    state.windows[0].emit('ready-to-show');
    expect(state.showErrorBox).not.toHaveBeenCalled();
  });
});

describe('single instance', () => {
  it('quits a second instance instead of opening another window', async () => {
    state.singleInstanceLock = false;
    await importMain();

    expect(state.quit).toHaveBeenCalled();
    expect(state.windows).toHaveLength(0);
  });

  it('shows the window hidden in the tray when seedit is launched again', async () => {
    setPlatform('win32');
    await importMain();
    const [window] = state.windows;
    window.close(); // hidden to the tray
    window.show.mockClear();

    state.app.emit('second-instance', {}, [], '');

    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(state.windows).toHaveLength(1);
  });
});
