/**
 * Reader side of 5chan tripcodes, ported from 5chan's `src/lib/utils/tripcode-utils.ts` (the signature check
 * is in lib/tripcode-verifier.ts). Keep the format, message and source rules byte-compatible with 5chan, or
 * the two clients show different trips for the same post.
 *
 * 5chan publishes a tripcode as a proof appended to the post's `author.displayName`:
 *
 *   <name>#tc1[.<nonce>]:<kind><publicKey><signature>[:<kind><publicKey><signature>]
 *
 * kind is `n` (normal) or `s` (secure), at most one of each, normal first. publicKey (32 bytes) and
 * signature (64 bytes) are unpadded base64url, 43 and 86 characters. The signature covers
 * getTripcodeMessage: the name, the board's public key, the thread, the author's timestamp and the post's
 * text, link and gallery, so a proof cannot be moved to another post. Readers hide the proof and show
 * `!trip` / `!!trip` only when it verifies.
 */

export type TripcodeKind = 'normal' | 'secure';

export interface TripcodeProofEntry {
  kind: TripcodeKind;
  publicKey: string;
  signature: string;
}

export interface ParsedTripcodeProof {
  /** The published name before the proof, untrimmed, exactly as signed. */
  name: string;
  nonce: number;
  entries: TripcodeProofEntry[];
}

export interface TripcodeSignedFields {
  communityPublicKey: string;
  parentCid?: string;
  postCid?: string;
  timestamp: number;
  title?: string;
  content?: string;
  link?: string;
  galleryUrls?: string[];
}

export const TRIPCODE_PROOF_VERSION = 'tc1';
export const TRIPCODE_MESSAGE_DOMAIN = '5chan-tripcode-v1';

const BASE64URL_PUBLIC_KEY_LENGTH = 43;
const BASE64URL_SIGNATURE_LENGTH = 86;
const PROOF_PATTERN = new RegExp(
  `#${TRIPCODE_PROOF_VERSION}(?:\\.([1-9][0-9]?))?((?::[ns][A-Za-z0-9_-]{${BASE64URL_PUBLIC_KEY_LENGTH + BASE64URL_SIGNATURE_LENGTH}}){1,2})$`,
);
const PROOF_ENTRY_PATTERN = new RegExp(`:([ns])([A-Za-z0-9_-]{${BASE64URL_PUBLIC_KEY_LENGTH}})([A-Za-z0-9_-]{${BASE64URL_SIGNATURE_LENGTH}})`, 'g');

export const parseTripcodeProof = (displayName: string | undefined): ParsedTripcodeProof | undefined => {
  // Every name is checked, and almost none carry a proof.
  if (!displayName?.includes(`#${TRIPCODE_PROOF_VERSION}`)) return undefined;
  const match = PROOF_PATTERN.exec(displayName);
  if (!match) return undefined;

  const entries: TripcodeProofEntry[] = [];
  for (const [, code, publicKey, signature] of match[2].matchAll(PROOF_ENTRY_PATTERN)) {
    entries.push({ kind: code === 'n' ? 'normal' : 'secure', publicKey, signature });
  }
  // One entry per kind, normal first, so each proof has a single encoding.
  if (entries.length === 2 && (entries[0].kind !== 'normal' || entries[1].kind !== 'secure')) {
    return undefined;
  }

  return { name: displayName.slice(0, match.index), nonce: match[1] ? Number(match[1]) : 0, entries };
};

/** The name to show, with any tripcode proof removed whether or not it verifies. */
export const stripTripcodeProof = <T extends string | undefined>(displayName: T): T => {
  const proof = parseTripcodeProof(displayName);
  return (proof ? proof.name : displayName) as T;
};

/** The exact text each tripcode key signs. A JSON array keeps every field's boundaries unambiguous. */
export const getTripcodeMessage = (kind: TripcodeKind, nonce: number, name: string, fields: TripcodeSignedFields): string =>
  JSON.stringify([
    TRIPCODE_MESSAGE_DOMAIN,
    kind,
    nonce,
    name,
    fields.communityPublicKey,
    fields.parentCid ?? '',
    fields.parentCid ? (fields.postCid ?? '') : '',
    fields.timestamp,
    fields.title ?? '',
    fields.content ?? '',
    fields.link ?? '',
    fields.galleryUrls ?? [],
  ]);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const getString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

export interface TripcodeCommentSource {
  displayName?: string;
  fields: Omit<TripcodeSignedFields, 'communityPublicKey'> & { communityPublicKey?: string };
}

/**
 * What a proof must have been signed over for a reader to show its trip. The name, text and gallery are the
 * ones on screen (including a pending or applied author edit), which can differ from the comment's signed
 * record: an author edit replaces the text, and the board's CommentUpdate can replace the author's name. A
 * proof covers neither the key that published the comment nor its edits, so anyone who republishes a
 * tripcode post verbatim within the board's timestamp window could otherwise edit their copy and show any
 * text under that trip. An edited or renamed post therefore loses its trip. The thread, timestamp and board
 * come from the signed record when the comment has one.
 */
export const getTripcodeCommentSource = (comment: unknown): TripcodeCommentSource | undefined => {
  if (!isRecord(comment)) return undefined;
  const raw = isRecord(comment.raw) && isRecord(comment.raw.comment) ? comment.raw.comment : undefined;
  const source = raw ?? comment;
  const timestamp = typeof source.timestamp === 'number' ? source.timestamp : undefined;
  if (timestamp === undefined) return undefined;

  const author = isRecord(comment.author) ? comment.author : undefined;
  const parentCid = getString(source.parentCid);
  const gallery = Array.isArray(comment.gallery) ? comment.gallery : undefined;
  return {
    displayName: getString(author?.displayName),
    fields: {
      communityPublicKey: getString(source.communityPublicKey),
      parentCid,
      postCid: parentCid ? getString(source.postCid) : undefined,
      timestamp,
      title: getString(comment.title),
      content: getString(comment.content),
      link: getString(comment.link),
      galleryUrls: gallery?.map((item) => (isRecord(item) ? getString(item.url) : undefined)).filter((url): url is string => !!url),
    },
  };
};
