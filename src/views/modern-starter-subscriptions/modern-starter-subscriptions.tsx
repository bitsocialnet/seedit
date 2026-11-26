import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useStarterSubscriptions } from '../../hooks/use-starter-subscriptions';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import ModernCommunityAvatar from '../../components/modern-community-avatar';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import styles from './modern-starter-subscriptions.module.css';

type StarterSubscriptionsState = ReturnType<typeof useStarterSubscriptions>;

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const Review = ({ initialSelectedAddresses, state }: { initialSelectedAddresses: string[]; state: StarterSubscriptionsState }) => {
  const { t } = useTranslation();
  const { list, subscriptions, delta, loading, error, saveError, saving, canReview, addSelected, keepCurrent, replacePrevious } = state;
  const subscribedSet = new Set(subscriptions);
  const newAddressSet = new Set(delta.addedAddresses);
  const [selectedAddresses, setSelectedAddresses] = useState(() => new Set(initialSelectedAddresses));
  const isBusy = saving || loading || !canReview;

  const toggleAddress = (address: string) => {
    setSelectedAddresses((current) => {
      const next = new Set(current);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.heading}>{capitalize(t('starter_communities'))}</h1>
        <p className={styles.explanation}>{t('starter_communities_explanation')}</p>
        <p className={styles.revision}>{capitalize(t('starter_list_revision', { revision: list.revision }))}</p>
      </header>

      {error && <p className={styles.notice}>{t('starter_list_offline_fallback')}</p>}
      {saveError && (
        <p className={`${styles.notice} ${styles.noticeError}`} role='alert'>
          {capitalize(t('failed'))}: {saveError.message}
        </p>
      )}
      {delta.removedAddresses.length > 0 && (
        <section className={styles.notice} aria-label={t('removed_starter_communities')}>
          <p>{t('removed_starter_communities')}</p>
          <ul className={styles.removed}>
            {delta.removedAddresses.map((address) => (
              <li key={address}>s/{getDisplayAddress(address)}</li>
            ))}
          </ul>
        </section>
      )}

      <ul className={styles.list} aria-busy={loading}>
        {list.communities.map((community) => {
          const subscribed = subscribedSet.has(community.address);
          const displayAddress = getDisplayAddress(community.address);
          return (
            <li key={community.address}>
              <label className={styles.row}>
                <input
                  type='checkbox'
                  checked={subscribed || selectedAddresses.has(community.address)}
                  disabled={subscribed || saving}
                  onChange={() => toggleAddress(community.address)}
                />
                <ModernCommunityAvatar address={community.address} size='medium' />
                <span className={styles.body}>
                  <span className={styles.identity}>
                    <Link to={getCommunityPath(community.address)} className={styles.title}>
                      {community.title || `s/${displayAddress}`}
                    </Link>
                    {community.title && <span className={styles.address}>s/{displayAddress}</span>}
                    {newAddressSet.has(community.address) && <span className={`${styles.badge} ${modernStyles.sentenceCase}`}>{t('new')}</span>}
                  </span>
                  {community.description && <span className={styles.description}>{community.description}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <button type='button' className={modernStyles.primaryButton} disabled={isBusy} onClick={() => void addSelected([...selectedAddresses])}>
          <span className={modernStyles.sentenceCase}>{saving ? `${t('saving')}…` : t('add_selected_communities')}</span>
        </button>
        <button type='button' className={modernStyles.secondaryButton} disabled={isBusy} onClick={() => void keepCurrent()}>
          <span className={modernStyles.sentenceCase}>{t('keep_current_subscriptions')}</span>
        </button>
        <button type='button' className={modernStyles.secondaryButton} disabled={isBusy} onClick={() => void replacePrevious()}>
          <span className={modernStyles.sentenceCase}>{t('use_latest_starter_set')}</span>
        </button>
      </div>
      <p className={styles.safety}>{t('starter_replacement_safety')}</p>
    </>
  );
};

/** The communities new accounts join by default, with what changed since the account last chose, to review and join. */
const ModernStarterSubscriptions = () => {
  const { t } = useTranslation();
  const state = useStarterSubscriptions();
  const subscribedSet = new Set(state.subscriptions);
  const initialSelectedAddresses = state.delta.addedAddresses.filter((address) => !subscribedSet.has(address));
  // a new list revision or a different set of new communities starts the selection over
  const selectionKey = JSON.stringify([state.list.revision, initialSelectedAddresses]);

  const title = capitalize(t('starter_communities'));
  useEffect(() => {
    document.title = `${title} - Seedit`;
  }, [title]);

  return (
    <ModernColumns>
      <Review key={selectionKey} initialSelectedAddresses={initialSelectedAddresses} state={state} />
    </ModernColumns>
  );
};

export default ModernStarterSubscriptions;
