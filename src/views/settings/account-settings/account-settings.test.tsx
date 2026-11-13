// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountSettings from './account-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const hookMocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  exportAccount: vi.fn(),
  importAccount: vi.fn(),
  setActiveAccount: vi.fn(),
  useAccount: vi.fn(),
  useAccounts: vi.fn(),
}));

const fileReaderState = vi.hoisted(() => ({ result: '' as unknown }));
const persistenceMocks = vi.hoisted(() => ({ deleteAccountAfterStarterWrites: vi.fn() }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  deleteAccount: hookMocks.deleteAccount,
  exportAccount: hookMocks.exportAccount,
  importAccount: hookMocks.importAccount,
  setActiveAccount: hookMocks.setActiveAccount,
  useAccount: hookMocks.useAccount,
  useAccounts: hookMocks.useAccounts,
}));

vi.mock('../../../lib/utils/starter-account-persistence', () => persistenceMocks);

vi.mock('react-i18next', async () => {
  const ReactModule = await import('react');
  return {
    Trans: ({ components, i18nKey }: { components?: Record<number, React.ReactElement>; i18nKey: string }) => {
      const component = components?.[1];
      return component ? ReactModule.cloneElement(component, {}, i18nKey) : ReactModule.createElement('span', null, i18nKey);
    },
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock('react-router-dom', async () => {
  const ReactModule = await import('react');
  return {
    Link: ({ children }: { children?: React.ReactNode }) => ReactModule.createElement('a', null, children),
  };
});

class MockFileReader {
  onload: ((event: { target: { result: unknown } }) => void) | null = null;
  result: unknown = null;

  readAsText() {
    this.result = fileReaderState.result;
    this.onload?.({ target: { result: this.result } });
  }
}

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage;
};

let root: Root;
let container: HTMLDivElement;
let createdInput: HTMLInputElement | null;
let createElementSpy: ReturnType<typeof vi.spyOn>;
let inputClickSpy: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let reloadMock: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

const render = () => {
  act(() => root.render(createElement(AccountSettings)));
};

const getImportButton = () => {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === 'import_account_backup');
  if (!button) throw new Error('Import account backup button not found');
  return button;
};

const selectImportFile = async () => {
  await act(async () => {
    getImportButton().click();
  });
  const file = new File(['{}'], 'account.json', { type: 'application/json' });
  await act(async () => {
    await createdInput?.onchange?.({ target: { files: [file] } } as unknown as Event);
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('AccountSettings account import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorage());
    fileReaderState.result = '';
    createdInput = null;
    window.electronApi = undefined;
    window.isElectron = false;
    hookMocks.useAccount.mockReturnValue({ id: 'current-id', name: 'Account current', author: { shortAddress: 'current' } });
    hookMocks.useAccounts.mockReturnValue({
      accounts: [
        { id: 'current-id', name: 'Account current', author: { shortAddress: 'current' } },
        { id: 'imported-id', name: 'Account dress', author: { shortAddress: 'dress' } },
        { id: 'imported-2-id', name: 'Account dress 2', author: { shortAddress: 'dress' } },
      ],
      state: 'succeeded',
    });
    hookMocks.importAccount.mockResolvedValue(undefined);
    hookMocks.setActiveAccount.mockResolvedValue(undefined);

    vi.stubGlobal('FileReader', MockFileReader);
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);

    const originalCreateElement = document.createElement.bind(document);
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === 'input') createdInput = element as HTMLInputElement;
      return element;
    }) as typeof document.createElement);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    createElementSpy?.mockRestore();
    inputClickSpy?.mockRestore();
    alertSpy?.mockRestore();
    consoleLogSpy?.mockRestore();
    vi.unstubAllGlobals();
  });

  it('imports, normalizes, records, and activates the next available account name without reloading', async () => {
    fileReaderState.result = JSON.stringify({
      account: {
        id: 'backup-id',
        name: 'Account dress',
        author: { address: 'address-dress' },
        communities: { 'music.bso': {} },
        pkcOptions: { pubsubKuboRpcClientsOptions: ['https://pubsub.example'] },
      },
    });

    render();
    await selectImportFile();

    expect(hookMocks.importAccount).toHaveBeenCalledOnce();
    const importedPayload = JSON.parse(hookMocks.importAccount.mock.calls[0][0]);
    expect(importedPayload.account.subscriptions).toEqual(['music.bso']);
    expect(importedPayload.account.pkcOptions.libp2pJsClientsOptions).toEqual([{ key: 'libp2pjs' }]);
    expect(hookMocks.setActiveAccount).toHaveBeenCalledWith('Account dress 3');
    expect(localStorage.getItem('importedAccountAddresses')).toBe(JSON.stringify(['address-dress']));
    expect(localStorage.getItem('importedAccountAddress')).toBe('address-dress');
    expect(alertSpy).toHaveBeenCalledWith('Imported Account dress 3');
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('disables importing until the hooks account store is ready', () => {
    hookMocks.useAccounts.mockReturnValue({ accounts: [], state: 'initializing' });

    render();

    expect(getImportButton().disabled).toBe(true);
  });

  it('surfaces malformed backup JSON without importing', async () => {
    fileReaderState.result = '{bad json';

    render();
    await selectImportFile();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse account data:'));
    expect(hookMocks.importAccount).not.toHaveBeenCalled();
  });

  it('does not record or activate the account when hooks import fails', async () => {
    fileReaderState.result = JSON.stringify({ account: { id: 'backup-id', name: 'Account dress', author: { address: 'address-dress' } } });
    hookMocks.importAccount.mockRejectedValue(new Error('import failed'));

    render();
    await selectImportFile();

    expect(alertSpy).toHaveBeenCalledWith('import failed');
    expect(hookMocks.setActiveAccount).not.toHaveBeenCalled();
    expect(localStorage.getItem('importedAccountAddress')).toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});

describe('AccountSettings account deletion', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    hookMocks.useAccount.mockReturnValue({ id: 'current-id', name: 'Account current', author: { shortAddress: 'current' } });
    hookMocks.useAccounts.mockReturnValue({ accounts: [{ id: 'current-id', name: 'Account current', author: { shortAddress: 'current' } }], state: 'succeeded' });
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    persistenceMocks.deleteAccountAfterStarterWrites.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  const getDeleteButton = () => Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === 'delete_this_account');

  it('deletes the account through the helper that waits for its default-community writes', () => {
    render();

    act(() => getDeleteButton()?.click());

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(persistenceMocks.deleteAccountAfterStarterWrites).toHaveBeenCalledWith('Account current');
    expect(hookMocks.deleteAccount).not.toHaveBeenCalled();
  });

  it('alerts when deleting the account fails', async () => {
    persistenceMocks.deleteAccountAfterStarterWrites.mockRejectedValue(new Error('account delete failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render();

    await act(async () => getDeleteButton()?.click());

    expect(alertSpy).toHaveBeenCalledWith('account delete failed');
    consoleErrorSpy.mockRestore();
  });
});
