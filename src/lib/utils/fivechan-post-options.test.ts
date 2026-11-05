import { describe, expect, it } from 'vitest';
import { getCommentPostOptions, getPostOptionsDirectoryCode, stripCommentPostOptionMarkers } from './fivechan-post-options';

const TIMESTAMP = 1_800_000_000;

describe('5chan post option boards', () => {
  it("finds a board's 5chan directory by address, alias suffix, or public key", () => {
    expect(getPostOptionsDirectoryCode('random-nsfw.bso')).toBe('b');
    expect(getPostOptionsDirectoryCode('random-nsfw')).toBe('b');
    expect(getPostOptionsDirectoryCode('random-nsfw.eth')).toBe('b');
    expect(getPostOptionsDirectoryCode('12D3KooWJkJYkuVbJQhapcVGpo8oNmsXsKmFRrFqc1SHezZW9fX8')).toBe('b');
    expect(getPostOptionsDirectoryCode('shit-5chan-says.bso')).toBe('s5s');
    expect(getPostOptionsDirectoryCode('quests-posting.bso')).toBe('qst');
    expect(getPostOptionsDirectoryCode('traditional-games.bso')).toBe('tg');
    expect(getPostOptionsDirectoryCode('music-posting.bso')).toBeUndefined();
    expect(getPostOptionsDirectoryCode(undefined)).toBeUndefined();
  });

  it('leaves markers alone on boards that do not read them', () => {
    const comment = { communityAddress: 'music-posting.bso', cid: 'QmPost', content: '[dice=1d6]body[fortune]', timestamp: TIMESTAMP };
    expect(getCommentPostOptions(comment, comment.communityAddress)).toBeUndefined();
    expect(stripCommentPostOptionMarkers(comment.content, comment, comment.communityAddress)).toBe(comment.content);
  });

  it("strips the markers the post's own board reads", () => {
    const comment = { communityAddress: 'random-nsfw.bso', cid: 'QmPost', content: '[dice=1d6]body[fortune]', timestamp: TIMESTAMP };
    expect(stripCommentPostOptionMarkers(comment.content, comment, comment.communityAddress)).toBe('[dice=1d6]body');
    expect(stripCommentPostOptionMarkers(comment.content, comment, 'traditional-games.bso')).toBe('body[fortune]');
    expect(stripCommentPostOptionMarkers(undefined, comment, comment.communityAddress)).toBeUndefined();
  });

  it('ignores the board a comment claims when the caller has no trusted board for it, such as an unverified crosspost', () => {
    // A backdated record claiming /b/ with legacy markup would otherwise show any fortune its author picked.
    const forged = { communityAddress: 'random-nsfw.bso', cid: 'QmForged', content: 'hi[fortune color=#d302a7]Godly Luck[/fortune]', timestamp: 1_790_000_000 };
    expect(getCommentPostOptions(forged, undefined)).toBeUndefined();
    expect(stripCommentPostOptionMarkers(forged.content, forged, undefined)).toBe(forged.content);
  });

  it('counts an edit only when it changed the signed text', () => {
    const signed = { content: 'body[fortune]' };
    const comment = { communityAddress: 'random-nsfw.bso', cid: 'QmPost', content: signed.content, timestamp: TIMESTAMP };
    const isEdited = (shown: Record<string, unknown>) => getCommentPostOptions({ ...comment, ...shown }, comment.communityAddress)?.isEdited;
    expect(getCommentPostOptions({ ...comment, raw: { comment: signed } }, comment.communityAddress)).toEqual({
      cid: 'QmPost',
      directoryCode: 'b',
      isEdited: false,
      timestamp: TIMESTAMP,
    });
    // A mod's edit of their own post resends the same text with a delete or undelete; it keeps the result.
    expect(isEdited({ edit: { content: signed.content }, raw: { comment: signed } })).toBe(false);
    // An applied edit, or a pending one merged in by useEditedComment, changes the text shown.
    expect(isEdited({ content: 'new[fortune]', edit: { content: 'new[fortune]' }, raw: { comment: signed } })).toBe(true);
    expect(isEdited({ content: 'new[fortune]', raw: { comment: signed } })).toBe(true);
    // pkc-js keeps showing the signed text for an edit to empty text; 5chan still counts that edit.
    expect(isEdited({ edit: { content: '' }, raw: { comment: signed } })).toBe(true);
    // Without the signed record, any edited text counts.
    expect(isEdited({ edit: { content: signed.content } })).toBe(true);
    expect(isEdited({})).toBe(false);
  });
});
