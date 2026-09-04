import { useAuthorAddress, useComments } from '@bitsocial/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPostPath } from '../../lib/utils/community-route-utils';
import InfoTooltip from '../info-tooltip';
import type { FivechanQuoteReference } from './fivechan-quote-utils';

interface FivechanQuoteProps {
  quotedCids: string[];
  reference: FivechanQuoteReference;
}

const FivechanQuote = ({ quotedCids, reference }: FivechanQuoteProps) => {
  const { t } = useTranslation();
  const { comments: quoteComments } = useComments({ commentCids: quotedCids, onlyIfCached: true });
  const quotedComment = reference.board ? undefined : quoteComments.find((comment) => comment?.number === reference.number);
  const { shortAuthorAddress } = useAuthorAddress({ comment: quotedComment });
  const communityAddress = getCommentCommunityAddress(quotedComment);
  const authorLabel = getDisplayAddress(shortAuthorAddress);
  const quotedCommentPath = communityAddress && quotedComment?.cid ? getCommunityPostPath(communityAddress, quotedComment.cid) : undefined;
  const label = authorLabel ? t('quoting_user', { author: authorLabel }) : t('fivechan_quote', { reference: reference.raw });

  return (
    <span>
      {quotedCommentPath ? <Link to={quotedCommentPath}>[{label}]</Link> : <span>[{label}]</span>}
      <InfoTooltip content={t('fivechan_quote_tooltip')} />
    </span>
  );
};

export default FivechanQuote;
