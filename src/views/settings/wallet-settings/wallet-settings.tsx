import { Fragment, useState } from 'react';
import { Account, useAccount } from '@bitsocial/bitsocial-react-hooks';
import useCryptoWallets from '../../../hooks/use-crypto-wallets';
import styles from './wallet-settings.module.css';
import { Trans, useTranslation } from 'react-i18next';
import InfoTooltip from '../../../components/info-tooltip';

const CryptoWalletsForm = ({ account }: { account: Account }) => {
  const { t } = useTranslation();

  const {
    wallets: walletsArray,
    setWalletProperty: setWalletsArrayProperty,
    addWallet,
    removeWallet: handleRemove,
    save,
    isWriting,
    mustSignAgain,
    copyMessageToSign,
    hasCopied,
  } = useCryptoWallets(account);

  const [showWallet, setShowWallet] = useState<boolean[]>(walletsArray.map(() => false));
  const toggleShowWallet = (index: number) => {
    const newShowWallet = [...showWallet];
    newShowWallet[index] = !newShowWallet[index];
    setShowWallet(newShowWallet);
  };

  const handleSave = async () => {
    if (await save()) alert(t('saved'));
  };

  const walletsInputs = walletsArray.map((wallet, index) => (
    <Fragment key={index}>
      <div className={styles.walletTitle}>
        <Trans i18nKey='wallet_number' values={{ index: index + 1 }} />
      </div>
      <div key={index} className={styles.walletBox}>
        {mustSignAgain(wallet) && <div className={styles.signAgain}>{t('wallet_sign_again')}</div>}
        <button className={styles.toggleWallet} onClick={() => toggleShowWallet(index)}>
          {showWallet[index] ? t('hide') : t('show')}
        </button>
        <button disabled={isWriting} onClick={() => void handleRemove(index)}>
          {t('remove')}
        </button>
        <div className={`${showWallet[index] ? styles.show : styles.hide}`}>
          <div className={styles.walletField}>
            <div className={styles.walletFieldTitle}>{t('chain_ticker')}</div>
            <input
              autoCorrect='off'
              autoCapitalize='off'
              spellCheck='false'
              onChange={(e) => setWalletsArrayProperty(index, 'chainTicker', e.target.value)}
              value={wallet.chainTicker}
              placeholder='eth'
            />
          </div>
          <div className={styles.walletField}>
            <div className={styles.walletFieldTitle}>{t('wallet_address')}</div>
            <input
              autoCorrect='off'
              autoCapitalize='off'
              spellCheck='false'
              onChange={(e) => setWalletsArrayProperty(index, 'address', e.target.value)}
              value={wallet.address}
              placeholder='0x...'
            />
          </div>
          <div className={`${styles.walletField} ${styles.copyMessage}`}>
            <Trans
              i18nKey='copy_message_etherscan'
              values={{ copy: hasCopied ? t('copied') : t('copy') }}
              components={{
                1: <button key={`copyMessageEtherscanButton-${index}`} onClick={() => copyMessageToSign(index)} />,
                // eslint-disable-next-line
                2: <a key={`etherscanLink-${index}`} href='https://etherscan.io/verifiedSignatures' target='_blank' rel='noopener noreferrer' />,
              }}
            />
          </div>
          <div className={styles.walletField}>
            <div className={styles.walletFieldTitle}>{t('timestamp')}</div>
            <input
              type='text'
              placeholder='Timestamp'
              autoCorrect='off'
              autoComplete='off'
              spellCheck='false'
              value={wallet.timestamp || ''}
              onChange={(e) => setWalletsArrayProperty(index, 'timestamp', Number(e.target.value))}
            />
          </div>
          <div className={styles.walletField}>
            <div className={styles.walletFieldTitle}>{t('paste_signature')}</div>
            <input
              autoCorrect='off'
              autoCapitalize='off'
              spellCheck='false'
              onChange={(e) => setWalletsArrayProperty(index, 'signature', e.target.value)}
              value={wallet.signature}
              placeholder='0x...'
            />
            <button className={styles.save} disabled={isWriting} onClick={() => void handleSave()}>
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </Fragment>
  ));

  return (
    <>
      <div className={styles.addWallet}>
        <Trans i18nKey='add_wallet' components={{ 1: <button key={`addWalletButton-${walletsArray.length}`} onClick={addWallet} /> }} />
        <InfoTooltip
          content={`Link crypto wallets to your account by proving ownership through signed messages. Communities can verify your token/NFT holdings to grant posting privileges or special access.`}
        />
      </div>
      {walletsInputs}
    </>
  );
};

const WalletSettings = () => {
  const account = useAccount();
  return account && <CryptoWalletsForm account={account} />;
};

export default WalletSettings;
