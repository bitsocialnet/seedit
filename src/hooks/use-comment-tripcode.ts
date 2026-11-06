import { useSyncExternalStore } from 'react';
import { getTripcodeCommentSource, parseTripcodeProof } from '../lib/utils/tripcode-utils';

type TripcodeVerifier = typeof import('../lib/tripcode-verifier');

// The ed25519 verifier loads when the first comment whose name carries a 5chan tripcode proof mounts. A failed
// load leaves trips hidden, and the next such comment that mounts tries again.
let verifier: TripcodeVerifier | undefined;
let verifierLoad: Promise<void> | undefined;
const verifierListeners = new Set<() => void>();

const subscribeToVerifierLoad = (listener: () => void) => {
  verifierListeners.add(listener);
  if (!verifier && !verifierLoad) {
    verifierLoad = import('../lib/tripcode-verifier').then(
      (module) => {
        verifierLoad = undefined;
        verifier = module;
        for (const notify of verifierListeners) notify();
      },
      (error: unknown) => {
        verifierLoad = undefined;
        console.warn('Failed to load the tripcode verifier', error);
      },
    );
  }
  return () => {
    verifierListeners.delete(listener);
  };
};

const subscribeToNothing = () => () => {};

const getVerifier = () => verifier;

// 5chan never publishes a crosspost, and a proof does not cover one, so a copy of a tripcode post with a crosspost
// added (within the board's timestamp window, or by CID) would otherwise show the trip on content its holder never posted.
const hasCrosspost = (comment: unknown) => typeof comment === 'object' && comment !== null && !!(comment as { crosspost?: unknown }).crosspost;

/**
 * The verified `!trip` / `!!trip` of a comment whose name carries a 5chan tripcode proof, or undefined. Pass the
 * comment as it is shown (after useEditedComment), so an edited or renamed post shows no trip, as on 5chan.
 */
const useCommentTripcode = (comment: unknown): string | undefined => {
  const source = hasCrosspost(comment) ? undefined : getTripcodeCommentSource(comment);
  const proof = parseTripcodeProof(source?.displayName);
  const loadedVerifier = useSyncExternalStore(proof ? subscribeToVerifierLoad : subscribeToNothing, getVerifier, getVerifier);

  const communityPublicKey = source?.fields.communityPublicKey;
  if (!loadedVerifier || !proof || !source || !communityPublicKey) return undefined;
  return loadedVerifier.getVerifiedTrip(proof, { ...source.fields, communityPublicKey });
};

export default useCommentTripcode;
