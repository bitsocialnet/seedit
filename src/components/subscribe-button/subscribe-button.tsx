import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './subscribe-button.module.css';
import { isAuthorView, isProfileView, isPendingPostView } from '../../lib/utils/view-utils';
import useCommunitySubscription from '../../hooks/use-community-subscription';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';

interface subscribeButtonProps {
  address: string | undefined;
  directoryCode?: SeeditDirectoryCode;
  directoryRevision?: number;
  onUnsubscribe?: (address: string) => void;
}

const SubscribeButton = ({ address, directoryCode, directoryRevision, onUnsubscribe }: subscribeButtonProps) => {
  const { subscribed, toggleSubscription } = useCommunitySubscription({ address, directoryCode, directoryRevision, onUnsubscribe });
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInAuthorView = isAuthorView(location.pathname);
  const isInProfileView = isProfileView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  if (subscribed === undefined) return null;

  const communityPageString = subscribed ? `${t('leave')}` : `${t('join')}`;
  const authorPageString = '+ friends'; // TODO: add functionality once implemented in backend

  const handleSubscribe = () => {
    if (isInAuthorView) return; // TODO: remove once implemented in backend
    void toggleSubscription();
  };

  return (
    <span
      className={`${isInProfileView && !isInPendingPostView ? styles.hidden : ''} ${styles.subscribeButton} ${subscribed ? styles.leaveButton : styles.joinButton}`}
      onClick={handleSubscribe}
    >
      {isInAuthorView ? authorPageString : communityPageString}
    </span>
  );
};

export default SubscribeButton;
