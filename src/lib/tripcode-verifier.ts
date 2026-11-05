import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { TRIPCODE_MESSAGE_DOMAIN, getTripcodeMessage, type ParsedTripcodeProof, type TripcodeKind, type TripcodeSignedFields } from './utils/tripcode-utils';

// The verification half of 5chan's `src/lib/tripcode-crypto.ts`. Loaded on demand by useCommentTripcode, so the
// ed25519 code stays out of the startup bundle. Reading a trip needs no password key derivation (scrypt).

// 4chan's tripcode alphabet, so trips look familiar.
const TRIP_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const TRIP_LENGTH = 10;
const MAX_VERIFIED_TRIP_CACHE_SIZE = 2000;

const base64UrlToBytes = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (character) => character.charCodeAt(0));
};

/** `!` or `!!` and 10 characters of the hash of the kind and the public key. */
export const getTripFromPublicKey = (kind: TripcodeKind, publicKey: Uint8Array): string => {
  const hash = sha256(concatBytes(utf8ToBytes(`${TRIPCODE_MESSAGE_DOMAIN}:${kind}:`), publicKey));
  let bits = 0;
  let bitCount = 0;
  let trip = '';
  for (const byte of hash) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 6 && trip.length < TRIP_LENGTH) {
      bitCount -= 6;
      trip += TRIP_ALPHABET[(bits >> bitCount) & 63];
    }
    bits &= (1 << bitCount) - 1;
    if (trip.length === TRIP_LENGTH) break;
  }
  return `${kind === 'secure' ? '!!' : '!'}${trip}`;
};

const verifiedTrips = new Map<string, string | null>();

/** The trips a proof shows (`!trip`, `!!trip` or `!trip!!trip`), or undefined when any signature fails. */
export const getVerifiedTrip = (proof: ParsedTripcodeProof, fields: TripcodeSignedFields): string | undefined => {
  const cacheKey = JSON.stringify([proof, fields]);
  const cached = verifiedTrips.get(cacheKey);
  if (cached !== undefined) return cached ?? undefined;

  let trip: string | null = '';
  for (const { kind, publicKey, signature } of proof.entries) {
    try {
      const publicKeyBytes = base64UrlToBytes(publicKey);
      const message = utf8ToBytes(getTripcodeMessage(kind, proof.nonce, proof.name, fields));
      // RFC 8032's strict rules, which also reject small-order public keys. The default (ZIP 215) accepts
      // them, and with the identity point as the key, a signature of the identity point and zero verifies
      // every message, so anyone could post under that key's trip.
      if (!ed25519.verify(base64UrlToBytes(signature), message, publicKeyBytes, { zip215: false })) {
        trip = null;
        break;
      }
      trip += getTripFromPublicKey(kind, publicKeyBytes);
    } catch {
      trip = null;
      break;
    }
  }

  if (verifiedTrips.size >= MAX_VERIFIED_TRIP_CACHE_SIZE) {
    verifiedTrips.delete(verifiedTrips.keys().next().value as string);
  }
  verifiedTrips.set(cacheKey, trip);
  return trip ?? undefined;
};
