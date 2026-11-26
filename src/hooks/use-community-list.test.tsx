// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCommunityList, { type CommunityListView } from './use-community-list';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  account: { author: { address: 'me' }, subscriptions: ['joined.bso', 'cats.bso'] },
  accountCommunities: {} as Record<string, Record<string, unknown>>,
  requested: [] as unknown[],
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
  useAccountCommunities: () => ({ accountCommunities: testState.accountCommunities }),
  useCommunities: ({ communities }: { communities: { name?: string; publicKey?: string }[] }) => {
    testState.requested = communities;
    return { communities: communities.map((identifier) => ({ address: identifier.name ?? identifier.publicKey, roles: {} })) };
  },
}));
vi.mock('./use-community-identifier', () => ({ getCommunityIdentifiers: (addresses: string[]) => addresses.map((name) => ({ name })) }));
vi.mock('./use-default-subscriptions', () => ({
  useDefaultSubscriptions: () => [
    { address: 'cats.bso', tags: ['animals'] },
    { address: 'joined.bso', nsfw: true },
  ],
}));

let result: ReturnType<typeof useCommunityList>;
const Probe = ({ view, tag }: { view: CommunityListView; tag: string | null }) => {
  result = useCommunityList(view, tag);
  return null;
};

let container: HTMLDivElement;
let root: Root;
const render = (view: CommunityListView, tag: string | null = null) => act(async () => root.render(createElement(Probe, { view, tag })));
const addresses = () => result.items.map((item) => item.community.address);

describe('useCommunityList', () => {
  beforeEach(() => {
    testState.accountCommunities = {
      'owned.bso': { address: 'owned.bso', settings: {}, roles: {} },
      'modded.bso': { address: 'modded.bso', roles: { me: { role: 'moderator' } } },
    };
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('lists moderated communities, then subscriptions newest first, under all', async () => {
    await render('all');
    expect(addresses()).toEqual(['owned.bso', 'modded.bso', 'cats.bso', 'joined.bso']);
    expect(result.items.find((item) => item.community.address === 'owned.bso')?.role).toBe('owner');
  });

  it('lists only subscriptions under subscriber', async () => {
    await render('subscriber');
    expect(addresses()).toEqual(['cats.bso', 'joined.bso']);
  });

  it('lists owned communities under every role, and others under their own role', async () => {
    await render('moderator');
    expect(addresses()).toEqual(['owned.bso', 'modded.bso']);
    expect(testState.requested).toEqual([]);

    await render('admin');
    expect(addresses()).toEqual(['owned.bso']);
  });

  it('filters by a default-list tag or by NSFW', async () => {
    await render('subscriber', 'animals');
    expect(addresses()).toEqual(['cats.bso']);

    await render('subscriber', 'nsfw');
    expect(addresses()).toEqual(['joined.bso']);
    expect(result.items[0].nsfw).toBe(true);
  });
});
