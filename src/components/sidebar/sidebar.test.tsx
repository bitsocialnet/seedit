// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import type { Community } from '@bitsocial/bitsocial-react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './sidebar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  blocked: false,
  block: vi.fn(),
  unblock: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ author: { address: 'author.bso' } }),
  useBlock: ({ address }: { address?: string }) => ({
    blocked: testState.blocked,
    block: () => testState.block(address),
    unblock: () => testState.unblock(address),
  }),
  useCommunityStats: () => ({}),
  usePkcRpcSettings: () => undefined,
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('../../hooks/use-community-subtitles', () => ({ default: () => [] }));
vi.mock('../../hooks/use-is-mobile', () => ({ default: () => false }));
vi.mock('../../hooks/use-is-community-offline', () => ({ default: () => ({ isOffline: false }) }));
vi.mock('../../hooks/use-account-comment', () => ({ default: () => undefined }));
vi.mock('../../hooks/use-directory-registry', () => ({ useDirectoryRegistry: () => ({ codes: [] }) }));
vi.mock('../community-reachability-alert', () => ({ default: () => null }));
vi.mock('../faq', () => ({ default: () => null }));
vi.mock('../loading-ellipsis', () => ({ default: () => null }));
vi.mock('../markdown', () => ({ default: () => null }));
vi.mock('../search-bar', () => ({ default: () => null }));
vi.mock('../subscribe-button', () => ({ default: () => null }));
vi.mock('../directory-auto-switch-control', () => ({ default: () => null }));
vi.mock('../version', () => ({ Version: () => null }));

// mirrors the community view, which keeps one sidebar mounted while its route switches communities
const CommunityRouteSidebar = () => {
  const { communityAddress } = useParams();
  return <Sidebar community={{ address: communityAddress } as Community} communityAddress={communityAddress} reset={testState.reset} />;
};

describe('Sidebar block confirmation', () => {
  let container: HTMLDivElement;
  let root: Root;

  const clickText = async (text: string) => {
    const element = [...container.querySelectorAll('span, a')].find((candidate) => candidate.textContent === text) as HTMLElement | undefined;
    expect(element, `element with text ${text}`).toBeDefined();
    await act(async () => element?.click());
  };

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/s/first.bso']}>
          <Link to='/s/second.bso'>go to second</Link>
          <Routes>
            <Route path='/s/:communityAddress' element={<CommunityRouteSidebar />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    testState.blocked = false;
    testState.block.mockReset();
    testState.unblock.mockReset();
    testState.reset.mockReset();
  });

  it('blocks the community the confirmation was opened for', async () => {
    await clickText('block_community');
    expect(container.textContent).toContain('are_you_sure');
    await clickText('yes');
    expect(testState.block).toHaveBeenCalledExactlyOnceWith('first.bso');
    expect(testState.reset).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('are_you_sure');
  });

  it('does not carry an open confirmation over to the next community', async () => {
    await clickText('block_community');
    expect(container.textContent).toContain('are_you_sure');

    await clickText('go to second');
    expect(container.textContent).not.toContain('are_you_sure');
    expect(container.textContent).toContain('block_community');

    await clickText('block_community');
    await clickText('yes');
    expect(testState.block).toHaveBeenCalledExactlyOnceWith('second.bso');
  });
});
