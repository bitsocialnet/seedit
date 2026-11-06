import { describe, expect, it } from 'vitest';
import { getVerifiedTrip } from '../tripcode-verifier';
import { getTripcodeCommentSource, parseTripcodeProof, stripTripcodeProof, type TripcodeSignedFields } from './tripcode-utils';

// Signed by 5chan's createTripcodeDisplayName (bitsocialnet/5chan#1281) with the password
// `hunter2`, and the trips its getVerifiedTrip shows for them, so Seedit must read 5chan's proofs exactly as 5chan does.
const BOARD_KEY = '12D3KooWJkJYkuVbJQhapcVGpo8oNmsXsKmFRrFqc1SHezZW9fX8';
const postFields: TripcodeSignedFields = {
  communityPublicKey: BOARD_KEY,
  timestamp: 1_800_000_000,
  title: 'Thread',
  content: 'Body',
  galleryUrls: ['https://example.com/a.png'],
};
const POST_DISPLAY_NAME = 'Anon#tc1:nWUoKS0wOjBFohS9iJPuFvBMPKqrTX4TRxUVM5zBf6Ko5ionTGoIOuOxWAdADPSbTfbEWR2wnNslrQ1lWtBL_WrpeA5yxSTkfNjrqBQdcBR90sPYV1jiecL7zAywE0PHDQ';
const POST_TRIP = '!j9z.SNnenn';
const replyFields: TripcodeSignedFields = {
  communityPublicKey: BOARD_KEY,
  parentCid: 'QmParent',
  postCid: 'QmPost',
  timestamp: 1_800_000_100,
  content: 'hello >>123',
};
// An empty name with both a normal and a secure tripcode.
const REPLY_DISPLAY_NAME =
  '#tc1:nWUoKS0wOjBFohS9iJPuFvBMPKqrTX4TRxUVM5zBf6KoyP2zRr8kc0GvjJJH9PrkHnXkMi0lPM9ojnyqbvUjsuhdqpX2FplLMiO_bSi73Bzs14-ZIFbMRHe4-BWA_cFDDA:sUBZ6FIfRBk9GanPXPt8D-6weFl9iiNbwl3Ej3cOVr2MDuhTfXw6IMp8NHSp_LW1dE-0ElP0BiZLTjbAf3SB0SpE4UwLxIrlmOOmMKvaIOVosqUvtBDn1-dDCm-oSq_5Cg';
const REPLY_TRIP = '!j9z.SNnenn!!cqU1snALHK';

const verify = (displayName: string, fields: TripcodeSignedFields) => {
  const proof = parseTripcodeProof(displayName);
  return proof ? getVerifiedTrip(proof, fields) : undefined;
};

describe('5chan tripcode proofs', () => {
  it('strips the proof from the name, whether or not it verifies', () => {
    expect(stripTripcodeProof(POST_DISPLAY_NAME)).toBe('Anon');
    expect(stripTripcodeProof(REPLY_DISPLAY_NAME)).toBe('');
    expect(stripTripcodeProof(`Admin${POST_DISPLAY_NAME.slice('Anon'.length)}`)).toBe('Admin');
    // Names that only resemble a proof stay as published.
    expect(stripTripcodeProof('Anon')).toBe('Anon');
    expect(stripTripcodeProof('Anon#tc1:nshort')).toBe('Anon#tc1:nshort');
    expect(stripTripcodeProof(`${POST_DISPLAY_NAME}x`)).toBe(`${POST_DISPLAY_NAME}x`);
    expect(stripTripcodeProof(undefined)).toBeUndefined();
    // Two entries must be normal then secure, so each proof has one encoding.
    const [normalEntry, secureEntry] = REPLY_DISPLAY_NAME.slice('#tc1'.length).split(/(?=:[ns])/);
    expect(stripTripcodeProof(`Anon#tc1${secureEntry}${normalEntry}`)).toBe(`Anon#tc1${secureEntry}${normalEntry}`);
  });

  it('shows the trips 5chan shows for a valid proof', () => {
    expect(verify(POST_DISPLAY_NAME, postFields)).toBe(POST_TRIP);
    expect(verify(REPLY_DISPLAY_NAME, replyFields)).toBe(REPLY_TRIP);
  });

  it('shows no trip for a proof moved to another post, board, name or time', () => {
    expect(verify(POST_DISPLAY_NAME, { ...postFields, content: 'Other body' })).toBeUndefined();
    expect(verify(POST_DISPLAY_NAME, { ...postFields, communityPublicKey: '12D3KooWOtherBoard' })).toBeUndefined();
    expect(verify(POST_DISPLAY_NAME, { ...postFields, timestamp: postFields.timestamp + 1 })).toBeUndefined();
    expect(verify(POST_DISPLAY_NAME, { ...postFields, galleryUrls: undefined })).toBeUndefined();
    expect(verify(REPLY_DISPLAY_NAME, { ...replyFields, parentCid: 'QmOtherThread' })).toBeUndefined();
    expect(verify(`Admin${POST_DISPLAY_NAME.slice('Anon'.length)}`, postFields)).toBeUndefined();
  });

  it('shows no trip for a small-order public key, whose forged signature would verify any message', () => {
    // The identity point as the key, and a signature of the identity point and s = 0. ed25519's default ZIP 215
    // rules accept it for every message; the strict RFC 8032 check must not.
    const identityKey = `AQ${'A'.repeat(41)}`;
    const forgedSignature = `AQ${'A'.repeat(84)}`;
    const displayName = `Anon#tc1:n${identityKey}${forgedSignature}`;

    expect(parseTripcodeProof(displayName)).toBeDefined();
    expect(stripTripcodeProof(displayName)).toBe('Anon');
    expect(verify(displayName, postFields)).toBeUndefined();
    expect(verify(displayName, { ...postFields, content: 'any other text' })).toBeUndefined();
  });

  it('verifies the name, text and gallery shown and the thread, time and board of the signed record', () => {
    const record = { ...replyFields, gallery: undefined, author: { displayName: REPLY_DISPLAY_NAME } };
    const verifyComment = (shown: Record<string, unknown>) => {
      const source = getTripcodeCommentSource({ ...record, cid: 'QmReply', raw: { comment: record }, ...shown });
      const proof = parseTripcodeProof(source?.displayName);
      return proof && source?.fields.communityPublicKey ? getVerifiedTrip(proof, { ...source.fields, communityPublicKey: source.fields.communityPublicKey }) : undefined;
    };

    expect(verifyComment({})).toBe(REPLY_TRIP);
    // A field the reader's copy carries outside the signed record cannot move the proof to another thread or time.
    expect(verifyComment({ parentCid: 'QmOtherThread', timestamp: 1 })).toBe(REPLY_TRIP);
    // An author edit, a board renaming the author, or a changed gallery drops the trip.
    expect(verifyComment({ content: 'edited text' })).toBeUndefined();
    expect(verifyComment({ author: { displayName: `Admin${REPLY_DISPLAY_NAME}` } })).toBeUndefined();
    expect(verifyComment({ gallery: [{ url: 'https://example.com/other.png' }] })).toBeUndefined();
  });
});
