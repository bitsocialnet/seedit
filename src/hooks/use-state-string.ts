import { useMemo } from 'react';
import { useClientsStates, useCommunity, useCommunitiesStates } from '@bitsocial/bitsocial-react-hooks';
import debounce from 'lodash/debounce';
import { getCommunityIdentifier, getCommunityIdentifiers } from './use-community-identifier';

interface CommentOrCommunity {
  state?: string;
  publishingState?: string;
  updatingState?: string;
}

interface States {
  [key: string]: string[];
}

const clientHosts: { [key: string]: string } = {};

const getClientHost = (clientUrl: string): string => {
  if (!clientHosts[clientUrl]) {
    try {
      clientHosts[clientUrl] = new URL(clientUrl).hostname || clientUrl;
    } catch {
      clientHosts[clientUrl] = clientUrl;
    }
  }
  return clientHosts[clientUrl];
};

const useStateString = (commentOrCommunity: CommentOrCommunity): string | undefined => {
  const { states: rawStates } = useClientsStates({ comment: commentOrCommunity }) as { states: States };

  const debouncedStates = useMemo(() => {
    const debouncedValue = debounce((value: States) => value, 300);
    return debouncedValue(rawStates);
  }, [rawStates]);

  return useMemo(() => {
    let stateString: string | undefined = '';

    for (const state in debouncedStates) {
      const clientUrls = debouncedStates[state];
      const clientHosts = clientUrls.map((clientUrl: string) => getClientHost(clientUrl));

      if (clientHosts.length === 0) {
        continue;
      }

      if (stateString) {
        stateString += ', ';
      }

      const formattedState = state.replaceAll('-', ' ').replace('ipfs', 'IPFS').replace('ipns', 'IPNS');
      stateString += `${formattedState} from ${clientHosts.join(', ')}`;
    }

    if (!stateString && commentOrCommunity?.state !== 'succeeded') {
      if (commentOrCommunity?.publishingState && commentOrCommunity?.publishingState !== 'stopped' && commentOrCommunity?.publishingState !== 'succeeded') {
        stateString = commentOrCommunity.publishingState;
      } else if (commentOrCommunity?.updatingState !== 'stopped' && commentOrCommunity?.updatingState !== 'succeeded') {
        stateString = commentOrCommunity.updatingState;
      }
      if (stateString) {
        stateString = stateString.replaceAll('-', ' ').replace('fetching', 'downloading').replace('ipfs', 'post');
      }
    }

    if (stateString) {
      stateString = stateString.charAt(0).toUpperCase() + stateString.slice(1);
    }

    if (stateString) {
      stateString = stateString.replace(/ipns/gi, 'community');
      if (stateString.includes('downloading')) {
        stateString = stateString.replace(/IPFS/g, 'post');
      }
    }

    return stateString === '' ? undefined : stateString;
  }, [debouncedStates, commentOrCommunity]);
};

export const useFeedStateString = (communityAddresses?: string[]): string | undefined => {
  // single community feed state string
  const communityAddress = communityAddresses?.length === 1 ? communityAddresses[0] : undefined;
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const singleCommunityFeedStateString = useStateString(community);

  // multiple community feed state string
  const { states } = useCommunitiesStates({ communities: getCommunityIdentifiers(communityAddresses || []) });

  const multipleCommunityFeedStateString = useMemo(() => {
    if (communityAddress) {
      return;
    }

    // e.g. Resolving 2 addresses from infura.io, fetching 2 IPNS, 1 IPFS from cloudflare-ipfs.com, ipfs.io
    let stateString = '';

    if (states['resolving-address']) {
      const { communityAddresses, clientUrls } = states['resolving-address'];
      if (communityAddresses.length && clientUrls.length) {
        stateString += `resolving ${communityAddresses.length} ${communityAddresses.length === 1 ? 'address' : 'addresses'} from ${clientUrls
          .map(getClientHost)
          .join(', ')}`;
      }
    }

    // find all page client and community addresses
    const pagesStatesClientHosts = new Set();
    const pagesStatesCommunityAddresses = new Set();
    for (const state in states) {
      if (state.match('page')) {
        states[state].clientUrls.forEach((clientUrl) => pagesStatesClientHosts.add(getClientHost(clientUrl)));
        states[state].communityAddresses.forEach((communityAddress) => pagesStatesCommunityAddresses.add(communityAddress));
      }
    }

    if (states['fetching-ipns'] || states['fetching-ipfs'] || pagesStatesCommunityAddresses.size) {
      // separate 2 different states using ', '
      if (stateString) {
        stateString += ', ';
      }

      // find all client urls
      const clientHosts = new Set(pagesStatesClientHosts);
      states['fetching-ipns']?.clientUrls.forEach((clientUrl) => clientHosts.add(getClientHost(clientUrl)));
      states['fetching-ipfs']?.clientUrls.forEach((clientUrl) => clientHosts.add(getClientHost(clientUrl)));

      if (clientHosts.size) {
        stateString += 'downloading ';
        if (states['fetching-ipns']) {
          stateString += `${states['fetching-ipns'].communityAddresses.length} ${states['fetching-ipns'].communityAddresses.length === 1 ? 'community' : 'communities'}`;
        }
        if (states['fetching-ipfs']) {
          if (states['fetching-ipns']) {
            stateString += ', ';
          }
          stateString += `${states['fetching-ipfs'].communityAddresses.length} ${states['fetching-ipfs'].communityAddresses.length === 1 ? 'post' : 'posts'}`;
        }
        if (pagesStatesCommunityAddresses.size) {
          if (states['fetching-ipns'] || states['fetching-ipfs']) {
            stateString += ', ';
          }
          stateString += `${pagesStatesCommunityAddresses.size} ${pagesStatesCommunityAddresses.size === 1 ? 'page' : 'pages'}`;
        }
        stateString += ` from ${[...clientHosts].join(', ')}`;
      }
    }

    // capitalize first letter
    stateString = stateString.charAt(0).toUpperCase() + stateString.slice(1);

    // if string is empty, return undefined instead
    return stateString === '' ? undefined : stateString;
  }, [states, communityAddress]);

  if (singleCommunityFeedStateString) {
    return singleCommunityFeedStateString;
  }
  return multipleCommunityFeedStateString;
};

export default useStateString;
