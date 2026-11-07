import { describe, expect, it } from 'vitest';
import { isSeeditLink, isValidCommunityPattern, preprocessSeeditPatterns, transformSeeditLinkToInternal } from './url-utils';
import { VENDORED_DIRECTORY_CODES } from './directory-codes';

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3fteh2v6q2f6x2w4g3q';

describe('Seedit comments permalinks', () => {
  it('recognizes direct, hash-routed, and short-host comments URLs', () => {
    expect(isSeeditLink(`https://seedit.app/s/aww/comments/${CID}`)).toBe(true);
    expect(isSeeditLink(`https://s.seedit.app/s/aww/comments/${CID}`)).toBe(true);
    expect(isSeeditLink(`https://seedit.app/#/s/aww/comments/${CID}`)).toBe(true);
    expect(isSeeditLink(`https://pleb.bz/s/aww/comments/${CID}`)).toBe(true);
  });

  it('transforms external comments URLs to the matching internal route', () => {
    expect(transformSeeditLinkToInternal(`https://seedit.app/s/aww/comments/${CID}`)).toBe(`/s/aww/comments/${CID}`);
    expect(transformSeeditLinkToInternal(`https://s.seedit.app/s/aww/comments/${CID}`)).toBe(`/s/aww/comments/${CID}`);
    expect(transformSeeditLinkToInternal(`https://seedit.app/#/s/aww/comments/${CID}`)).toBe(`/s/aww/comments/${CID}`);
  });

  it('recognizes and links plain-text comments permalinks', () => {
    const pattern = `s/aww.bso/comments/${CID}`;
    expect(isValidCommunityPattern(pattern)).toBe(true);
    expect(preprocessSeeditPatterns(`${pattern}.`)).toBe(`[${pattern}](/s/aww.bso/comments/${CID}).`);
  });

  it('recognizes and links default-TLD shorthand references', () => {
    expect(isValidCommunityPattern('s/aww')).toBe(true);
    expect(preprocessSeeditPatterns('See s/aww.')).toBe('See [s/aww](/s/aww).');

    const pattern = `s/aww/comments/${CID}`;
    expect(isValidCommunityPattern(pattern)).toBe(true);
    expect(preprocessSeeditPatterns(pattern)).toBe(`[${pattern}](/s/aww/comments/${CID})`);
  });

  it('continues expanding unreserved default-TLD shorthand references', () => {
    expect(preprocessSeeditPatterns('See s/unreserved-name.')).toBe('See [s/unreserved-name](/s/unreserved-name.bso).');
  });

  it('does not interpret reserved feed routes as default-TLD community shorthand', () => {
    expect(isValidCommunityPattern('s/all')).toBe(false);
    expect(isValidCommunityPattern('s/mod')).toBe(false);
  });

  it('links punctuated community references without regex lookbehind', () => {
    expect(preprocessSeeditPatterns('See (s/aww.bso).')).toBe('See ([s/aww.bso](/s/aww.bso)).');
  });

  it('does not relink references already embedded in URLs or words', () => {
    const content = 'https://example.com/s/aww.bso https://example.com/?next=s/aww.bso https://example.com/#s/aww.bso xs/aww.bso';
    expect(preprocessSeeditPatterns(content)).toBe(content);
  });
});

describe('links to directories published after this build', () => {
  const unsettled = { codes: VENDORED_DIRECTORY_CODES, settled: false };
  const settled = { codes: VENDORED_DIRECTORY_CODES, settled: true };
  const published = { codes: [...VENDORED_DIRECTORY_CODES, 'dogs'], settled: true };

  it('keeps an unknown code as a directory route until the published codes load', () => {
    expect(transformSeeditLinkToInternal('https://seedit.app/#/s/dogs', unsettled)).toBe('/s/dogs');
    expect(transformSeeditLinkToInternal('https://seedit.app/#/s/dogs', published)).toBe('/s/dogs');
    expect(transformSeeditLinkToInternal('https://seedit.app/#/s/dogs', settled)).toBe('/s/dogs.bso');

    expect(preprocessSeeditPatterns('See s/dogs.', unsettled)).toBe('See [s/dogs](/s/dogs).');
    expect(preprocessSeeditPatterns('See s/dogs.', published)).toBe('See [s/dogs](/s/dogs).');
    expect(preprocessSeeditPatterns('See s/dogs.', settled)).toBe('See [s/dogs](/s/dogs.bso).');
    expect(preprocessSeeditPatterns(`See s/dogs/comments/${CID}`, unsettled)).toBe(`See [s/dogs/comments/${CID}](/s/dogs/comments/${CID})`);
  });
});
