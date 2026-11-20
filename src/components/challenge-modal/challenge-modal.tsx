import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { FloatingFocusManager, useClick, useDismiss, useFloating, useId, useInteractions, useRole } from '@floating-ui/react';
import { Challenge as ChallengeType, useComment, useAccount } from '@bitsocial/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import useChallengesStore from '../../stores/use-challenges-store';
import useTheme from '../../hooks/use-theme';
import styles from './challenge-modal.module.css';
import { getPublicationPreview, getPublicationType, getVotePreview } from '../../lib/utils/challenge-utils';
import { getDisplayAddress } from '../../lib/utils/address-utils';

interface ChallengeHeaderProps {
  publicationType: string | null;
  votePreview: string;
  parentCid?: string;
  parentAddress?: string;
  publicationContent: string;
  communityShortAddress?: string;
}

const useParentAddress = (parentCid?: string) => {
  const parentComment = useComment({ commentCid: parentCid, onlyIfCached: true });
  return parentComment?.author?.shortAddress;
};

const ChallengeHeader = ({ publicationType, votePreview, parentCid, parentAddress, publicationContent, communityShortAddress }: ChallengeHeaderProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.title}>{t('challenge_from', { community: communityShortAddress })}</div>
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
  abandonModal: () => void;
}

const TRUSTED_IFRAME_HOSTNAMES = new Set(['mintpass.org', 'spamblocker.bitsocial.net']);

const getIframeSessionId = (challengeUrl: string) => {
  try {
    return new URL(challengeUrl).pathname.match(/\/iframe\/([^/?#]+)/)?.[1] ?? '';
  } catch {
    return '';
  }
};

type PendingChallenge = { challenge?: string; type?: string; caseInsensitive?: boolean };
type ChallengeEntries = [challengeIndex: string, challenge: PendingChallenge][];

// A CHALLENGE keys the pending challenges by challenge index (the position in community.challenges)
// and leaves out pre-answered ones, so keys can be sparse ("1", "3"). Show them in numeric order.
const getChallengeEntries = (challenges: unknown): ChallengeEntries =>
  challenges && typeof challenges === 'object' ? (Object.entries(challenges) as ChallengeEntries).sort(([a], [b]) => Number(a) - Number(b)) : [];

// Answer every key of the CHALLENGE; an unanswered challenge gets '' rather than a missing key.
const getAnswersByChallengeIndex = (challengeEntries: ChallengeEntries, answers: string[]) =>
  Object.fromEntries(challengeEntries.map(([challengeIndex], position) => [challengeIndex, answers[position] ?? '']));

// An iframe posts positional answers: the first answers the challenge shown, further ones the challenges after it.
const withIframeAnswers = (answers: string[], position: number, iframeAnswers: string[]) => {
  const updatedAnswers = [...answers];
  (iframeAnswers.length ? iframeAnswers : ['']).forEach((answer, offset) => {
    updatedAnswers[position + offset] = answer;
  });
  return updatedAnswers;
};

const RegularChallengeContent = ({ challenge, closeModal, abandonModal }: RegularChallengeContentProps) => {
  const { t } = useTranslation();
  const account = useAccount();
  const [theme] = useTheme();
  const challenges = challenge?.[0]?.challenges;
  const challengeEntries = useMemo(() => getChallengeEntries(challenges), [challenges]);
  const publicationTarget = challenge?.[2];
  const publicationType = getPublicationType(challenge?.[1]);
  const publicationContent = publicationType === 'vote' ? getPublicationPreview(publicationTarget) : getPublicationPreview(challenge?.[1]);
  const votePreview = getVotePreview(challenge?.[1]);

  const publication = challenge?.[1] as NonNullable<ChallengeType[1]> | undefined;
  const { parentCid, shortCommunityAddress, communityAddress } = publication || {};
  const parentAddress = getDisplayAddress(useParentAddress(parentCid) || '');

  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showIframeConfirmation, setShowIframeConfirmation] = useState(true);
  const [iframeUrlState, setIframeUrl] = useState<string>('');
  const [iframeOrigin, setIframeOrigin] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handledIframeAutoCompleteRef = useRef(false);
  const onIframeAutoComplete = useEffectEvent((challengeAnswers: string[]) => {
    challenge[1].publishChallengeAnswers(getAnswersByChallengeIndex(challengeEntries, withIframeAnswers(answers, currentChallengeIndex, challengeAnswers)));
    closeModal();
  });

  const currentChallenge = challengeEntries[currentChallengeIndex]?.[1];
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
    challenge[1].publishChallengeAnswers(getAnswersByChallengeIndex(challengeEntries, answers));
    setAnswers([]);
    closeModal();
  }, [challenge, challengeEntries, answers, closeModal]);

  const onIframeDone = useCallback(() => {
    // Submit empty string as answer for iframe challenges
    challenge[1].publishChallengeAnswers(getAnswersByChallengeIndex(challengeEntries, withIframeAnswers(answers, currentChallengeIndex, [''])));
    closeModal();
  }, [challenge, challengeEntries, answers, currentChallengeIndex, closeModal]);

  const onEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (!isValidAnswer(currentChallengeIndex)) return;
    if (challengeEntries[currentChallengeIndex + 1]) {
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

      // Show only the hostname for trusted challenge providers.
      if (TRUSTED_IFRAME_HOSTNAMES.has(url.hostname)) {
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
      abandonModal();
    }
  };

  const sendThemeToIframe = useCallback(() => {
    if (!iframeRef.current) {
      return;
    }

    try {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: 'bitsocial-theme',
          theme,
          source: 'bitsocial-seedit',
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
    const expectedSessionId = getIframeSessionId(iframeUrlState);
    if (!iframeOrigin || !expectedSessionId || showIframeConfirmation) {
      handledIframeAutoCompleteRef.current = false;
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== iframeOrigin || handledIframeAutoCompleteRef.current) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || (data as { type?: string }).type !== 'challengeAnswer') return;
      const challengeAnswers = (data as { challengeAnswers?: unknown }).challengeAnswers;
      const sessionId = (data as { sessionId?: unknown }).sessionId;
      if (!Array.isArray(challengeAnswers) || sessionId !== expectedSessionId) return;

      const stringAnswers = challengeAnswers.filter((answer): answer is string => typeof answer === 'string');
      handledIframeAutoCompleteRef.current = true;
      onIframeAutoComplete(stringAnswers);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeOrigin, iframeUrlState, showIframeConfirmation]);

  const communityShortAddress = getDisplayAddress(shortCommunityAddress || communityAddress || '');

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
          communityShortAddress={communityShortAddress}
        />

        {showIframeConfirmation ? (
          <>
            <div className={styles.challengeMediaWrapper}>
              <div className={`${styles.challengeMedia} ${styles.iframeChallengeWarning}`}>
                {t('iframe_challenge_open_confirmation', {
                  community: communityShortAddress,
                  url: decodeURIComponent(getChallengeUrl()),
                  defaultValue: `s/${communityShortAddress} challenge wants to open ${decodeURIComponent(getChallengeUrl())}`,
                })}
              </div>
            </div>
            <div className={styles.challengeFooter}>
              <span className={styles.buttons}>
                <button type='button' onClick={handleLoadIframe}>
                  {t('open', { defaultValue: 'open' })}
                </button>
                <button type='button' onClick={abandonModal}>
                  {t('cancel')}
                </button>
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
                <button type='button' onClick={onIframeDone}>
                  {t('done', { defaultValue: 'done' })}
                </button>
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
        communityShortAddress={communityShortAddress}
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
        <div className={styles.counter}>{t('challenge_counter', { index: currentChallengeIndex + 1, total: challengeEntries.length })}</div>
        <span className={styles.buttons}>
          {!challengeEntries[currentChallengeIndex + 1] && (
            <button type='button' onClick={onSubmit} disabled={!isValidAnswer(currentChallengeIndex)}>
              {t('submit')}
            </button>
          )}
          <button type='button' onClick={abandonModal}>
            {t('cancel')}
          </button>
          {challengeEntries.length > 1 && (
            <button type='button' disabled={!challengeEntries[currentChallengeIndex - 1]} onClick={() => setCurrentChallengeIndex((prev) => prev - 1)}>
              {t('previous')}
            </button>
          )}
          {challengeEntries[currentChallengeIndex + 1] && (
            <button type='button' onClick={() => setCurrentChallengeIndex((prev) => prev + 1)}>
              {t('next')}
            </button>
          )}
        </span>
      </div>
    </>
  );
};

const ChallengeContent = ({ challenge, closeModal, abandonModal }: { challenge?: ChallengeType; closeModal: () => void; abandonModal: () => void }) => {
  if (challenge) {
    return <RegularChallengeContent challenge={challenge} closeModal={closeModal} abandonModal={abandonModal} />;
  }

  return null;
};

const ChallengeModal = () => {
  const { challenges, removeChallenge, abandonCurrentChallenge } = useChallengesStore();

  const isOpen = !!challenges.length;
  const closeModal = () => removeChallenge();
  const abandonModal = () => {
    void abandonCurrentChallenge();
  };
  const currentChallenge = challenges[0];

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) abandonModal();
    },
  });
  const click = useClick(context);
  const dismiss = useDismiss(context, { outsidePress: false });
  const role = useRole(context);
  const headingId = useId();
  const { getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      {isOpen && currentChallenge && (
        <FloatingFocusManager context={context} modal={false}>
          <div className={styles.modal} ref={refs.setFloating} aria-labelledby={headingId} {...getFloatingProps()}>
            <div className={styles.container}>
              <ChallengeContent key={currentChallenge.id} challenge={currentChallenge.challenge} closeModal={closeModal} abandonModal={abandonModal} />
            </div>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};

export default ChallengeModal;
