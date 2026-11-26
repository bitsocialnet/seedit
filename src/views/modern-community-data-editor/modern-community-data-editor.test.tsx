// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import ModernCommunityDataEditor from './modern-community-data-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  account: { author: { address: 'owner.bso' } },
  community: {} as Record<string, any>,
  rpc: { state: 'connected', pkcRpcSettings: { challenges: {} } },
  lastEditOptions: undefined as Record<string, any> | undefined,
  publishCommunityEdit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  deleteCommunity: vi.fn(),
  useAccount: () => testState.account,
  useCommunity: () => testState.community,
  usePkcRpcSettings: () => testState.rpc,
  usePublishCommunityEdit: (options: Record<string, any>) => {
    testState.lastEditOptions = options;
    return { publishCommunityEdit: testState.publishCommunityEdit };
  },
  useCreateCommunity: () => ({ createCommunity: vi.fn() }),
  useSubscribe: () => ({ subscribe: vi.fn() }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => createElement('a', { href: to, className }, children),
  useLocation: () => ({ pathname: '/s/example.bso/settings/editor', hash: '' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ communityAddress: 'example.bso' }),
}));
vi.mock('../../hooks/use-resolved-community-route', () => ({ default: () => ({ communityAddress: 'example.bso' }) }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../components/json-editor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement('textarea', { value, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value) }),
}));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));

let container: HTMLDivElement;
let root: Root;

const editor = () => container.querySelector('textarea')!;
const getButton = (text: string) => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === text)!;

const type = async (value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(editor(), value);
    editor().dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('ModernCommunityDataEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.community = {
      address: 'example.bso',
      createdAt: 1,
      title: 'Original title',
      suggested: { avatarUrl: 'https://example.com/avatar.png', primaryColor: '#000' },
      settings: { challenges: [] },
    };
    useCommunitySettingsStore.getState().resetCommunitySettingsStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('edits the shared draft as typed, undoes back to it, and saves without dropping the hidden avatar', async () => {
    await act(async () => root.render(createElement(ModernCommunityDataEditor)));
    const original = editor().value;
    expect(JSON.parse(original)).toMatchObject({ title: 'Original title', suggested: { primaryColor: '#000' }, communityAddress: 'example.bso' });
    expect(original).not.toContain('avatarUrl');
    expect(getButton('undo').disabled).toBe(true);

    // typed formatting stays while the JSON is valid, and the draft follows it
    const edited = JSON.stringify({ ...JSON.parse(original), title: 'Edited title' });
    await type(edited);
    expect(editor().value).toBe(edited);
    expect(useCommunitySettingsStore.getState().title).toBe('Edited title');

    await act(async () => getButton('undo').click());
    expect(useCommunitySettingsStore.getState().title).toBe('Original title');
    expect(editor().value).toBe(original);

    await type(edited);
    await act(async () => getButton('save').click());
    expect(testState.publishCommunityEdit).toHaveBeenCalledOnce();
    expect(testState.lastEditOptions).toMatchObject({
      title: 'Edited title',
      suggested: { avatarUrl: 'https://example.com/avatar.png', primaryColor: '#000' },
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe('settings_saved');
  });

  it('reports invalid JSON when saving instead of publishing it', async () => {
    await act(async () => root.render(createElement(ModernCommunityDataEditor)));
    await type('{ "title": ');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');

    await act(async () => getButton('save').click());
    expect(testState.publishCommunityEdit).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('JSON parsing error');
    expect(useCommunitySettingsStore.getState().title).toBe('Original title');
  });
});
