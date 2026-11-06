import { boards as fortuneBBoards } from '../../data/5chan-directories/5chan-b-directory.json';
import { boards as fortuneS5sBoards } from '../../data/5chan-directories/5chan-s5s-directory.json';
import { boards as diceQstBoards } from '../../data/5chan-directories/5chan-qst-directory.json';
import { boards as diceTgBoards } from '../../data/5chan-directories/5chan-tg-directory.json';
import { stripPostOptionMarkers } from './post-option-markers';
import type { PostOptionResultsInput } from './post-option-results';

// 5chan reads fortune and dice markers only on the boards of its /b/, /s5s/, /qst/ and /tg/ directories, so Seedit
// looks up a post's board in the same candidate lists (mirrored from bitsocialnet/lists by `yarn sync:directories`).
const POST_OPTION_DIRECTORY_BOARDS: ReadonlyArray<[directoryCode: string, boards: ReadonlyArray<{ address?: string; publicKey?: string }>]> = [
  ['b', fortuneBBoards],
  ['s5s', fortuneS5sBoards],
  ['qst', diceQstBoards],
  ['tg', diceTgBoards],
];

// 5chan treats `name.bso` and `name.eth` as the same board as `name`.
const normalizeBoardAddress = (address: string) => address.replace(/\.(?:bso|eth)$/, '');

/** The 5chan directory code of a board whose posts carry fortune or dice markers, matched by address or public key. */
export const getPostOptionsDirectoryCode = (communityAddress: string | undefined): string | undefined => {
  if (!communityAddress) return undefined;
  const normalizedAddress = normalizeBoardAddress(communityAddress);
  return POST_OPTION_DIRECTORY_BOARDS.find(([, boards]) =>
    boards.some((board) => (board.address && normalizeBoardAddress(board.address) === normalizedAddress) || board.publicKey === communityAddress),
  )?.[0];
};

// Comments come from the hooks, the indexer and pending account data, so their fields are read defensively.
interface PostOptionsComment {
  cid?: unknown;
  content?: unknown;
  edit?: { content?: unknown };
  raw?: { comment?: { content?: unknown } };
  timestamp?: unknown;
}

const getTimestamp = (comment: PostOptionsComment | undefined) => (typeof comment?.timestamp === 'number' ? comment.timestamp : undefined);

/**
 * What the markdown needs to read a comment's fortune or dice, or undefined when its board reads neither. Pass the
 * comment as it is shown (after useEditedComment), and the board address the caller trusts it to belong to: an
 * unverified crosspost's claimed board must not decide which markers count. An edit that changed the text hides the
 * results, since only that could add a marker once the CID is known; as on 5chan, an edit that resends the signed
 * text (a mod's delete or undelete of their own post) keeps them, and without the signed record any edit counts.
 */
export const getCommentPostOptions = (comment: object | undefined, communityAddress: string | undefined): PostOptionResultsInput | undefined => {
  const directoryCode = getPostOptionsDirectoryCode(communityAddress);
  if (!comment || !directoryCode) return undefined;
  const { cid, content, edit, raw } = comment as PostOptionsComment;
  const signedComment = raw?.comment;
  return {
    cid: typeof cid === 'string' ? cid : undefined,
    directoryCode,
    // pkc-js shows an edit's text only when it is non-empty, so the edit itself is compared too, as 5chan does.
    isEdited: signedComment ? (edit?.content !== undefined && edit.content !== signedComment.content) || content !== signedComment.content : edit?.content !== undefined,
    timestamp: getTimestamp(comment as PostOptionsComment),
  };
};

/** A comment's text without the fortune and dice markers its board reads, for places that show no result. */
export const stripCommentPostOptionMarkers = <T extends string | undefined>(content: T, comment: object | undefined, communityAddress: string | undefined): T => {
  if (!content) return content;
  return stripPostOptionMarkers(content, { directoryCode: getPostOptionsDirectoryCode(communityAddress), timestamp: getTimestamp(comment as PostOptionsComment) }) as T;
};
