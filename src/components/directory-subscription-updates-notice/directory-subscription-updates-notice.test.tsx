// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DirectorySubscriptionUpdatesNotice from './directory-subscription-updates-notice';

const testState = vi.hoisted(() => ({ account: undefined as unknown }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ useAccount: () => testState.account }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, string>) => (values?.directoryCode ? `${key}:${values.directoryCode}` : key) }),
}));
vi.mock('../../hooks/use-directory-registry', () => ({ useDirectoryRegistry: () => ({ codes: ['funny'], settled: true }) }));
vi.mock('../../hooks/use-directory-list', () => ({ useDirectoryList: () => ({ list: null, loading: false, error: null }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let root: Root;
let container: HTMLDivElement;

describe('DirectorySubscriptionUpdatesNotice', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps an automatic switch notice for a directory that is no longer published', () => {
    testState.account = {
      id: 'account-1',
      subscriptions: ['good-dogs.bso'],
      seeditDirectoryPreferences: {
        slots: {},
        automaticChangeNotices: { dogs: { fromAddress: 'old-dogs.bso', toAddress: 'good-dogs.bso' } },
      },
    };

    act(() => root.render(createElement(MemoryRouter, null, createElement(DirectorySubscriptionUpdatesNotice))));

    expect(container.textContent).toContain('directory_automatic_switch_notice:dogs');
    expect(Array.from(container.querySelectorAll('button')).map((button) => button.textContent)).toEqual(['undo', 'dismiss']);
  });
});
