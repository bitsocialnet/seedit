import { useMemo } from 'react';
import { useClientsStates, useSubplebbit, useSubplebbitsStates } from '@bitsocialnet/bitsocial-react-hooks';
import { debounce } from 'lodash';

interface CommentOrSubplebbit {
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

const useStateString = (commentOrSubplebbit: CommentOrSubplebbit): string | undefined => {
  const { states: rawStates } = useClientsStates({ comment: commentOrSubplebbit }) as { states: States };

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

    if (!stateString && commentOrSubplebbit?.state !== 'succeeded') {
      if (commentOrSubplebbit?.publishingState && commentOrSubplebbit?.publishingState !== 'stopped' && commentOrSubplebbit?.publishingState !== 'succeeded') {
        stateString = commentOrSubplebbit.publishingState;
      } else if (commentOrSubplebbit?.updatingState !== 'stopped' && commentOrSubplebbit?.updatingState !== 'succeeded') {
        stateString = commentOrSubplebbit.updatingState;
      }
      if (stateString) {
        stateString = stateString.replaceAll('-', ' ').replace('subplebbit ipns', 'community').replace('fetching', 'downloading').replace('ipfs', 'post');
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
  }, [debouncedStates, commentOrSubplebbit]);
};

export const useFeedStateString = (subplebbitAddresses?: string[]): string | undefined => {
  // single subplebbit feed state string
  const subplebbitAddress = subplebbitAddresses?.length === 1 ? subplebbitAddresses[0] : undefined;
  const subplebbit = useSubplebbit({ subplebbitAddress });
  const singleSubplebbitFeedStateString = useStateString(subplebbit);

  // multiple subplebbit feed state string
  const { states } = useSubplebbitsStates({ subplebbitAddresses });

  const multipleSubplebbitsFeedStateString = useMemo(() => {
    if (subplebbitAddress) {
      return;
    }

    // e.g. Resolving 2 addresses from infura.io, fetching 2 IPNS, 1 IPFS from cloudflare-ipfs.com, ipfs.io
    let stateString = '';

    if (states['resolving-address']) {
      const { subplebbitAddresses, clientUrls } = states['resolving-address'];
      if (subplebbitAddresses.length && clientUrls.length) {
        stateString += `resolving ${subplebbitAddresses.length} ${subplebbitAddresses.length === 1 ? 'address' : 'addresses'} from ${clientUrls
          .map(getClientHost)
          .join(', ')}`;
      }
    }

    // find all page client and sub addresses
    const pagesStatesClientHosts = new Set();
    const pagesStatesSubplebbitAddresses = new Set();
    for (const state in states) {
      if (state.match('page')) {
        states[state].clientUrls.forEach((clientUrl) => pagesStatesClientHosts.add(getClientHost(clientUrl)));
        states[state].subplebbitAddresses.forEach((subplebbitAddress) => pagesStatesSubplebbitAddresses.add(subplebbitAddress));
      }
    }

    if (states['fetching-ipns'] || states['fetching-ipfs'] || pagesStatesSubplebbitAddresses.size) {
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
          stateString += `${states['fetching-ipns'].subplebbitAddresses.length} ${
            states['fetching-ipns'].subplebbitAddresses.length === 1 ? 'community' : 'communities'
          }`;
        }
        if (states['fetching-ipfs']) {
          if (states['fetching-ipns']) {
            stateString += ', ';
          }
          stateString += `${states['fetching-ipfs'].subplebbitAddresses.length} ${states['fetching-ipfs'].subplebbitAddresses.length === 1 ? 'post' : 'posts'}`;
        }
        if (pagesStatesSubplebbitAddresses.size) {
          if (states['fetching-ipns'] || states['fetching-ipfs']) {
            stateString += ', ';
          }
          stateString += `${pagesStatesSubplebbitAddresses.size} ${pagesStatesSubplebbitAddresses.size === 1 ? 'page' : 'pages'}`;
        }
        stateString += ` from ${[...clientHosts].join(', ')}`;
      }
    }

    // capitalize first letter
    stateString = stateString.charAt(0).toUpperCase() + stateString.slice(1);

    // if string is empty, return undefined instead
    return stateString === '' ? undefined : stateString;
  }, [states, subplebbitAddress]);

  if (singleSubplebbitFeedStateString) {
    return singleSubplebbitFeedStateString;
  }
  return multipleSubplebbitsFeedStateString;
};

export default useStateString;
