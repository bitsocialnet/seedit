import { create } from 'zustand';

type CommentEditDraft = { content?: string; reason?: string; spoiler?: boolean; nsfw?: boolean };

interface State {
  /** The last edit saved for each comment that the community has not accepted yet, by comment cid. */
  drafts: { [commentCid: string]: CommentEditDraft | undefined };
  setDraft: (commentCid: string, draft: CommentEditDraft) => void;
  /** Clears the comment's draft only if it is still this one, so a newer save outlives an older edit's verdict. */
  clearDraft: (commentCid: string, draft: CommentEditDraft) => void;
}

const useCommentEditDraftStore = create<State>((set) => ({
  drafts: {},
  setDraft: (commentCid, draft) => set((state) => ({ drafts: { ...state.drafts, [commentCid]: draft } })),
  clearDraft: (commentCid, draft) =>
    set((state) => {
      if (state.drafts[commentCid] !== draft) return state;
      const { [commentCid]: _clearedDraft, ...drafts } = state.drafts;
      return { drafts };
    }),
}));

export default useCommentEditDraftStore;
