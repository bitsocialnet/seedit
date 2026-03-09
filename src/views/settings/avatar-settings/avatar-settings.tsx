import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { setAccount, useAccount, useAuthorAvatar } from '@bitsocialnet/bitsocial-react-hooks';
import styles from './avatar-settings.module.css';
import { Trans, useTranslation } from 'react-i18next';

interface AvatarSettingsProps {
  areSettingsShown?: boolean;
  avatar?: any;
  showSettings?: () => void;
}

const AvatarPreview = ({ areSettingsShown, avatar, showSettings }: AvatarSettingsProps) => {
  const { t } = useTranslation();
  const account = useAccount();
  let author = useMemo(() => ({ ...account?.author, avatar }), [account, avatar]);

  const { imageUrl, state, error } = useAuthorAvatar({ author });

  // if avatar already set, and user hasn't typed anything yet, preview already set author
  if (account?.author?.avatar && !avatar?.chainTicker && !avatar?.address && !avatar?.id && !avatar?.signature) {
    author = account.author;
  }

  // not enough data to preview yet
  if (!author?.avatar?.address && !author?.avatar?.signature) {
    return;
  }

  const stateText = state !== 'succeeded' ? `${state}...` : undefined;

  return (
    <>
      <div className={styles.avatar} onClick={showSettings}>
        {imageUrl && state !== 'initializing' ? (
          <img src={imageUrl} alt='' />
        ) : (
          <span className={styles.emptyAvatar}>{areSettingsShown ? '–' + t('hide') : '+' + t('add')}</span>
        )}
      </div>
      {state !== 'succeeded' && account?.author?.avatar && (
        <div className={styles.state}>
          {stateText} {error?.message}
        </div>
      )}
    </>
  );
};

const AvatarSettings = () => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const account = useAccount();
  const authorAddress = account?.author?.address;
  const [chainTicker, setChainTicker] = useState(account?.author?.avatar?.chainTicker);
  const [tokenAddress, setTokenAddress] = useState(account?.author?.avatar?.address);
  const [tokenId, setTokenId] = useState(account?.author?.avatar?.id);
  const [timestamp, setTimestamp] = useState(account?.author?.avatar?.timestamp);
  const [signature, setSignature] = useState(account?.author?.avatar?.signature?.signature);

  const getNftMessageToSign = (authorAddress: string, timestamp: number, tokenAddress: string, tokenId: string) => {
    let messageToSign: any = {};
    // the property names must be in this order for the signature to match
    // insert props one at a time otherwise babel/webpack will reorder
    messageToSign.domainSeparator = 'plebbit-author-avatar';
    messageToSign.authorAddress = authorAddress;
    messageToSign.timestamp = timestamp;
    messageToSign.tokenAddress = tokenAddress;
    messageToSign.tokenId = String(tokenId); // must be a type string, not number
    // use plain JSON so the user can read what he's signing
    messageToSign = JSON.stringify(messageToSign);
    return messageToSign;
  };

  const [hasCopied, setHasCopied] = useState(false);

  const copyMessageToSign = () => {
    if (!chainTicker) {
      return alert(t('missing_chain_ticker'));
    }
    if (!tokenAddress) {
      return alert(t('missing_token_address'));
    }
    if (!tokenId) {
      return alert(t('missing_token_id'));
    }
    const newTimestamp = Math.floor(Date.now() / 1000);
    const messageToSign = getNftMessageToSign(authorAddress, newTimestamp, tokenAddress, tokenId);
    // update timestamp every time the user gets a new message to sign
    setTimestamp(newTimestamp);
    navigator.clipboard.writeText(messageToSign);
    setHasCopied(true);
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };

  // how to resolve and verify NFT signatures https://github.com/plebbit/plebbit-js/blob/master/docs/nft.md
  const avatar = {
    chainTicker: chainTicker?.toLowerCase() || account?.author?.avatar?.chainTicker,
    timestamp: timestamp || account?.author?.avatar?.timestamp,
    address: tokenAddress || account?.author?.avatar?.address,
    id: tokenId || account?.author?.avatar?.id,
    signature: {
      signature: signature || account?.author?.avatar?.signature?.signature,
      type: 'eip191',
    },
  };

  const save = () => {
    if (!chainTicker) {
      return alert(t('missing_chain_ticker'));
    }
    if (!tokenAddress) {
      return alert(t('missing_token_address'));
    }
    if (!tokenId) {
      return alert(t('missing_token_id'));
    }
    if (!signature) {
      return alert(t('missing_signature'));
    }
    setAccount({ ...account, author: { ...account?.author, avatar } });
    alert(`saved`);
  };

  return (
    <div className={styles.avatarSettings}>
      <AvatarPreview avatar={avatar} showSettings={() => setShowSettings(!showSettings)} areSettingsShown={showSettings} />
      {showSettings && (
        <div className={styles.avatarSettingsForm}>
          <div className={styles.avatarSettingInput}>
            <span className={styles.settingTitle}>{t('chain_ticker')}</span>
            <input
              type='text'
              placeholder='matic'
              autoCorrect='off'
              autoComplete='off'
              spellCheck='false'
              defaultValue={account?.author?.avatar?.chainTicker}
              onChange={(e) => setChainTicker(e.target.value)}
            />
          </div>
          <div className={styles.avatarSettingInput}>
            <span className={styles.settingTitle}>
              <Trans
                i18nKey='token_address_whitelist'
                shouldUnescape={true}
                components={{
                  1: (
                    <Link
                      key='tokenAddressWhitelistLink'
                      to='https://github.com/bitsocialnet/bitsocial-react-hooks/blob/557cc3f40b5933a00553ed9c0bc310d2cd7a3b52/src/hooks/authors/author-avatars.ts#L133'
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  ),
                }}
              />
            </span>
            <input
              type='text'
              placeholder='0x...'
              autoCorrect='off'
              autoComplete='off'
              spellCheck='false'
              defaultValue={account?.author?.avatar?.address}
              onChange={(e) => setTokenAddress(e.target.value)}
            />
          </div>
          <div className={styles.avatarSettingInput}>
            <span className={styles.settingTitle}>{t('token_id')}</span>
            <input
              type='text'
              placeholder='Token ID'
              autoCorrect='off'
              autoComplete='off'
              spellCheck='false'
              defaultValue={account?.author?.avatar?.id}
              onChange={(e) => setTokenId(e.target.value)}
            />
          </div>
          <div className={styles.copyMessage}>
            <Trans
              i18nKey='copy_message_etherscan'
              values={{ copy: hasCopied ? t('copied') : t('copy') }}
              components={{
                1: <button key='copyMessageEtherscanButton' onClick={copyMessageToSign} />,
                // eslint-disable-next-line
                2: <a key='etherscanLink' href='https://etherscan.io/verifiedSignatures' target='_blank' rel='noopener noreferrer' />,
              }}
            />
          </div>
          <div className={styles.avatarSettingInput}>
            <span className={styles.settingTitle}>{t('timestamp')}</span>
            <input
              type='text'
              placeholder='Timestamp'
              autoCorrect='off'
              autoComplete='off'
              spellCheck='false'
              defaultValue={account?.author?.avatar?.timestamp}
              onChange={(e) => setTimestamp(Number(e.target.value))}
            />
          </div>
          <div className={styles.pasteSignature}>
            <span className={styles.settingTitle}>{t('paste_signature')}</span>
            <input
              type='text'
              placeholder='0x...'
              autoCorrect='off'
              autoComplete='off'
              spellCheck='false'
              defaultValue={account?.author?.avatar?.signature?.signature}
              onChange={(e) => setSignature(e.target.value)}
            />
            <button key='saveButton' onClick={save}>
              {t('save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarSettings;
