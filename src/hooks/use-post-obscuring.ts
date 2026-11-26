import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import useContentOptionsStore from '../stores/use-content-options-store';
import { useIsNsfwCommunity } from './use-is-nsfw-community';

/** Whether a comment's media starts covered, and the reveal label: NSFW media follows the blur setting, spoilers always start covered. */
const usePostObscuring = (comment: Comment) => {
  const { t } = useTranslation();
  const isNsfwCommunity = useIsNsfwCommunity(getCommentCommunityAddress(comment) || '');
  const blurNsfwThumbnails = useContentOptionsStore((options) => options.blurNsfwThumbnails);
  const nsfw = Boolean(comment.nsfw || isNsfwCommunity);
  const [isRevealed, setIsRevealed] = useState(false);
  const obscuredLabel = isRevealed ? undefined : nsfw && blurNsfwThumbnails ? t('see_nsfw') : comment.spoiler ? t('view_spoiler') : undefined;
  return { nsfw, obscuredLabel, reveal: () => setIsRevealed(true) };
};

export default usePostObscuring;
