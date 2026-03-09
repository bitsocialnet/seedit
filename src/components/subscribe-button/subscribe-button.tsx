import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubscribe } from '@bitsocialnet/bitsocial-react-hooks';
import styles from './subscribe-button.module.css';
import { isAuthorView, isProfileView, isPendingPostView } from '../../lib/utils/view-utils';

interface subscribeButtonProps {
  address: string | undefined;
  onUnsubscribe?: (address: string) => void;
}

const SubscribeButton = ({ address, onUnsubscribe }: subscribeButtonProps) => {
  const { subscribe, subscribed, unsubscribe } = useSubscribe({ subplebbitAddress: address });
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInAuthorView = isAuthorView(location.pathname);
  const isInProfileView = isProfileView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const subplebbitPageString = subscribed ? `${t('leave')}` : `${t('join')}`;
  const authorPageString = '+ friends'; // TODO: add functionality once implemented in backend

  const handleSubscribe = () => {
    if (isInAuthorView) return; // TODO: remove once implemented in backend

    if (subscribed === false) {
      subscribe();
    } else if (subscribed === true) {
      unsubscribe();
      if (onUnsubscribe && address) {
        onUnsubscribe(address);
      }
    }
  };

  return (
    <span
      className={`${isInProfileView && !isInPendingPostView ? styles.hidden : ''} ${styles.subscribeButton} ${subscribed ? styles.leaveButton : styles.joinButton}`}
      onClick={handleSubscribe}
    >
      {isInAuthorView ? authorPageString : subplebbitPageString}
    </span>
  );
};

export default SubscribeButton;
