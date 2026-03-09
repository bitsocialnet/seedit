import { useCallback, useEffect, useRef, useState } from 'react';
import { FloatingFocusManager, useClick, useDismiss, useFloating, useId, useInteractions, useRole } from '@floating-ui/react';
import { Challenge as ChallengeType, useComment, useAccount } from '@bitsocialnet/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import useChallengesStore from '../../stores/use-challenges-store';
import useTheme from '../../hooks/use-theme';
import styles from './challenge-modal.module.css';
import { getPublicationPreview, getPublicationType, getVotePreview } from '../../lib/utils/challenge-utils';

interface ChallengeHeaderProps {
  publicationType: string | null;
  votePreview: string;
  parentCid?: string;
  parentAddress?: string;
  publicationContent: string;
  subplebbit?: string;
}

const useParentAddress = (parentCid?: string) => {
  const parentComment = useComment({ commentCid: parentCid, onlyIfCached: true });
  return parentComment?.author?.shortAddress;
};

const ChallengeHeader = ({ publicationType, votePreview, parentCid, parentAddress, publicationContent, subplebbit }: ChallengeHeaderProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.title}>{t('challenge_from', { subplebbit })}</div>
      <div className={styles.subTitle}>
        {publicationType === 'vote' && votePreview + ' '}
        {parentCid
          ? t('challenge_for_reply', { parentAddress, publicationContent, interpolation: { escapeValue: false } })
          : t('challenge_for_post', { publicationContent, interpolation: { escapeValue: false } })}
      </div>
    </>
  );
};

interface RegularChallengeContentProps {
  challenge: ChallengeType;
  closeModal: () => void;
}

const RegularChallengeContent = ({ challenge, closeModal }: RegularChallengeContentProps) => {
  const { t } = useTranslation();
  const account = useAccount();
  const [theme] = useTheme();
  const challenges = challenge?.[0]?.challenges;
  const publicationTarget = challenge?.[2];
  const publicationType = getPublicationType(challenge?.[1]);
  const publicationContent = publicationType === 'vote' ? getPublicationPreview(publicationTarget) : getPublicationPreview(challenge?.[1]);
  const votePreview = getVotePreview(challenge?.[1]);

  const { parentCid, shortSubplebbitAddress, subplebbitAddress } = challenge?.[1] || {};
  const parentAddress = useParentAddress(parentCid);

  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showIframeConfirmation, setShowIframeConfirmation] = useState(true);
  const [iframeUrlState, setIframeUrl] = useState<string>('');
  const [iframeOrigin, setIframeOrigin] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentChallenge = challenges?.[currentChallengeIndex];
  const isTextChallenge = currentChallenge?.type === 'text/plain';
  const isImageChallenge = currentChallenge?.type === 'image/png';
  const isIframeChallenge = currentChallenge?.type === 'url/iframe';

  const isValidAnswer = (index: number) => {
    return !!answers[index] && answers[index].trim() !== '';
  };

  const onAnswersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswers((prevAnswers) => {
      const updatedAnswers = [...prevAnswers];
      updatedAnswers[currentChallengeIndex] = e.target.value;
      return updatedAnswers;
    });
  };

  const onSubmit = useCallback(() => {
    challenge[1].publishChallengeAnswers(answers);
    setAnswers([]);
    closeModal();
  }, [challenge, answers, closeModal]);

  const onIframeClose = useCallback(() => {
    // Submit empty string as answer for iframe challenges
    challenge[1].publishChallengeAnswers(['']);
    closeModal();
  }, [challenge, closeModal]);

  const onEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (!isValidAnswer(currentChallengeIndex)) return;
    if (challenges?.[currentChallengeIndex + 1]) {
      setCurrentChallengeIndex((prev) => prev + 1);
    } else {
      onSubmit();
    }
  };

  // Get URL for iframe challenge confirmation (hostname only for whitelisted sites, full URL otherwise)
  const getChallengeUrl = () => {
    try {
      const iframeUrl = currentChallenge?.challenge;
      if (!iframeUrl) return '';
      const url = new URL(iframeUrl);

      // Whitelist mintpass.org - only show hostname for trusted sites
      if (url.hostname === 'mintpass.org') {
        return url.hostname;
      }

      // For other sites, show full URL for transparency
      return url.href;
    } catch {
      return '';
    }
  };

  const handleLoadIframe = () => {
    const iframeUrl = currentChallenge?.challenge;
    if (!iframeUrl) return;

    const rawUserAddress = account?.author?.address?.trim();
    const requiresUserAddress = iframeUrl.includes('{userAddress}');

    if (requiresUserAddress && !rawUserAddress) {
      alert(
        t('iframe_challenge_missing_user_address', {
          defaultValue: 'Error: Unable to load challenge without your address. Please sign in and try again.',
        }),
      );
      return;
    }

    const encodedAddress = rawUserAddress ? encodeURIComponent(rawUserAddress) : undefined;
    const replacedUrl = requiresUserAddress && encodedAddress ? iframeUrl.replace(/\{userAddress\}/g, encodedAddress) : iframeUrl;

    try {
      const validatedUrl = new URL(replacedUrl);

      if (validatedUrl.protocol !== 'https:') {
        throw new Error('Only HTTPS iframe challenges are supported');
      }

      validatedUrl.pathname = validatedUrl.pathname.replace(/\/{2,}/g, '/');
      validatedUrl.searchParams.set('theme', theme);

      const finalUrl = validatedUrl.toString();
      setIframeUrl(finalUrl);
      setIframeOrigin(validatedUrl.origin);
      setShowIframeConfirmation(false);
    } catch (error) {
      console.error('Invalid iframe challenge URL', { error });
      alert('Error: Invalid URL for authentication challenge');
      closeModal();
    }
  };

  const sendThemeToIframe = useCallback(() => {
    if (!iframeRef.current) {
      return;
    }

    try {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: 'plebbit-theme',
          theme: theme,
          source: 'plebbit-seedit',
        },
        iframeOrigin,
      );
    } catch (error) {
      console.warn('Could not send theme to iframe:', error);
    }
  }, [iframeOrigin, theme]);

  const handleIframeLoad = () => {
    sendThemeToIframe();
  };

  useEffect(() => {
    if (iframeRef.current && iframeUrlState && iframeOrigin && !showIframeConfirmation) {
      sendThemeToIframe();
    }
  }, [iframeOrigin, iframeUrlState, sendThemeToIframe, showIframeConfirmation]);

  useEffect(() => {
    const onEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isIframeChallenge) {
          onIframeClose();
        } else {
          closeModal();
        }
      }
    };
    document.addEventListener('keydown', onEscapeKey);
    return () => document.removeEventListener('keydown', onEscapeKey);
  }, [isIframeChallenge, onIframeClose, closeModal]);

  const subplebbit = shortSubplebbitAddress || subplebbitAddress;

  // Render iframe challenge
  if (isIframeChallenge) {
    return (
      <>
        <ChallengeHeader
          publicationType={publicationType ?? null}
          votePreview={votePreview}
          parentCid={parentCid}
          parentAddress={parentAddress}
          publicationContent={publicationContent}
          subplebbit={subplebbit}
        />

        {showIframeConfirmation ? (
          <>
            <div className={styles.challengeMediaWrapper}>
              <div className={`${styles.challengeMedia} ${styles.iframeChallengeWarning}`}>
                {t('iframe_challenge_open_confirmation', {
                  subplebbit,
                  url: decodeURIComponent(getChallengeUrl()),
                  defaultValue: `s/${subplebbit} challenge wants to open ${decodeURIComponent(getChallengeUrl())}`,
                })}
              </div>
            </div>
            <div className={styles.challengeFooter}>
              <span className={styles.buttons}>
                <button onClick={handleLoadIframe}>{t('open', { defaultValue: 'open' })}</button>
                <button onClick={closeModal}>{t('cancel')}</button>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className={`${styles.challengeMediaWrapper} ${styles.iframeWrapper}`}>
              <iframe
                ref={iframeRef}
                src={iframeUrlState}
                sandbox='allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation'
                onLoad={handleIframeLoad}
                className={styles.iframe}
                title={t('challenge_iframe', { defaultValue: 'Challenge authentication' })}
              />
            </div>
            <div className={`${styles.challengeFooter} ${styles.iframeFooter}`}>
              <div className={styles.iframeInstruction}>
                {t('iframe_challenge_keep_open', { defaultValue: 'Complete the challenge in the box above. Keep this window open until done.' })}
              </div>
              <div className={styles.iframeCloseButton}>
                <button onClick={onIframeClose}>{t('done', { defaultValue: 'done' })}</button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // Render regular text/image challenges
  return (
    <>
      <ChallengeHeader
        publicationType={publicationType ?? null}
        votePreview={votePreview}
        parentCid={parentCid}
        parentAddress={parentAddress}
        publicationContent={publicationContent}
        subplebbit={subplebbit}
      />
      <div className={styles.challengeMediaWrapper}>
        {isTextChallenge && <div className={styles.challengeMedia}>{currentChallenge?.challenge}</div>}
        {isImageChallenge && <img alt={t('loading')} className={styles.challengeMedia} src={`data:image/png;base64,${currentChallenge?.challenge}`} />}
      </div>
      <div>
        <input
          onKeyDown={onEnterKey}
          onChange={onAnswersChange}
          value={answers[currentChallengeIndex] || ''}
          className={styles.challengeInput}
          autoCorrect='off'
          autoComplete='off'
          spellCheck='false'
        />
      </div>
      <div className={styles.challengeFooter}>
        <div className={styles.counter}>{t('challenge_counter', { index: currentChallengeIndex + 1, total: challenges?.length })}</div>
        <span className={styles.buttons}>
          {!challenges?.[currentChallengeIndex + 1] && (
            <button onClick={onSubmit} disabled={!isValidAnswer(currentChallengeIndex)}>
              {t('submit')}
            </button>
          )}
          <button onClick={closeModal}>{t('cancel')}</button>
          {challenges && challenges.length > 1 && (
            <button disabled={!challenges[currentChallengeIndex - 1]} onClick={() => setCurrentChallengeIndex((prev) => prev - 1)}>
              {t('previous')}
            </button>
          )}
          {challenges?.[currentChallengeIndex + 1] && <button onClick={() => setCurrentChallengeIndex((prev) => prev + 1)}>{t('next')}</button>}
        </span>
      </div>
    </>
  );
};

const ChallengeContent = ({ challenge, closeModal }: { challenge?: ChallengeType; closeModal: () => void }) => {
  if (challenge) {
    return <RegularChallengeContent challenge={challenge} closeModal={closeModal} />;
  }

  return null;
};

const ChallengeModal = () => {
  const { challenges, removeChallenge } = useChallengesStore();

  const isOpen = !!challenges.length;
  const closeModal = () => {
    removeChallenge();
  };

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: closeModal,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context, { outsidePress: false });
  const role = useRole(context);
  const headingId = useId();
  const { getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      {isOpen && (
        <FloatingFocusManager context={context} modal={false}>
          <div className={styles.modal} ref={refs.setFloating} aria-labelledby={headingId} {...getFloatingProps()}>
            <div className={styles.container}>
              <ChallengeContent challenge={challenges[0]} closeModal={closeModal} />
            </div>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};

export default ChallengeModal;
