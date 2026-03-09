import { Fragment, useState } from 'react';
import { Account, setAccount, useAccount } from '@bitsocialnet/bitsocial-react-hooks';
import styles from './wallet-settings.module.css';
import { Trans, useTranslation } from 'react-i18next';
import InfoTooltip from '../../../components/info-tooltip';

interface Wallet {
  chainTicker: string;
  address: string;
  timestamp: number;
  signature: string;
}

const getWalletMessageToSign = (authorAddress: string, timestamp: number): string => {
  const messageToSign = {
    domainSeparator: 'plebbit-author-wallet',
    authorAddress,
    timestamp,
  };
  return JSON.stringify(messageToSign);
};

const CryptoWalletsForm = ({ account }: { account: Account | undefined }) => {
  const { t } = useTranslation();

  if (!account) {
    throw Error('CryptoWalletsForm account prop must be defined');
  }
  const authorAddress = account?.author?.address;
  const defaultWalletObject: Wallet = { chainTicker: '', address: '', timestamp: 0, signature: '' };

  const walletsFromAccount = Object.keys(account?.author?.wallets || {}).map(
    (chainTicker): Wallet => ({
      chainTicker,
      address: account.author.wallets[chainTicker].address,
      timestamp: account.author.wallets[chainTicker].timestamp,
      signature: account.author.wallets[chainTicker].signature.signature,
    }),
  );

  const defaultWalletsArray: Wallet[] = walletsFromAccount.length ? walletsFromAccount : [];

  const [walletsArray, setWalletsArray] = useState<Wallet[]>(defaultWalletsArray);
  const setWalletsArrayProperty = (index: number, property: keyof Wallet, value: string | number) => {
    const newArray = [...walletsArray];
    newArray[index] = { ...newArray[index], [property]: value };
    setWalletsArray(newArray);
  };

  const [hasCopied, setHasCopied] = useState(false);

  const copyMessageToSign = (wallet: any, index: number) => {
    if (!wallet.chainTicker) {
      return alert('missing chain ticker');
    }
    if (!wallet.address) {
      return alert('missing address');
    }
    const timestamp = wallet.timestamp || Math.floor(Date.now() / 1000);
    const messageToSign = getWalletMessageToSign(authorAddress, timestamp);
    if (timestamp !== wallet.timestamp) {
      setWalletsArrayProperty(index, 'timestamp', timestamp);
    }
    navigator.clipboard.writeText(messageToSign);
    setHasCopied(true);
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };

  const [showWallet, setShowWallet] = useState<boolean[]>(walletsArray.map(() => false));
  const toggleShowWallet = (index: number) => {
    const newShowWallet = [...showWallet];
    newShowWallet[index] = !newShowWallet[index];
    setShowWallet(newShowWallet);
  };

  const updateWallets = (walletsToUpdate: Wallet[]) => {
    const wallets: { [key: string]: { address: string; timestamp: number; signature: { signature: string; type: string } } } = {};
    walletsToUpdate.forEach((wallet) => {
      if (wallet.chainTicker && wallet.address && wallet.signature && wallet.timestamp) {
        wallets[wallet.chainTicker] = {
          address: wallet.address,
          timestamp: wallet.timestamp,
          signature: {
            signature: wallet.signature,
            type: 'eip191',
          },
        };
      }
    });
    setAccount({ ...account, author: { ...account.author, wallets } });
  };

  const handleRemove = (index: number) => {
    const newWalletsArray = walletsArray.filter((_, i) => i !== index);
    setWalletsArray(newWalletsArray);
    updateWallets(newWalletsArray);
  };

  const handleSave = () => {
    updateWallets(walletsArray);
    alert(t('saved'));
  };

  const walletsInputs = walletsArray.map((wallet, index) => (
    <Fragment key={index}>
      <div className={styles.walletTitle}>
        <Trans i18nKey='wallet_number' values={{ index: index + 1 }} />
      </div>
      <div key={index} className={styles.walletBox}>
        <button className={styles.toggleWallet} onClick={() => toggleShowWallet(index)}>
          {showWallet[index] ? t('hide') : t('show')}
        </button>
        <button onClick={() => handleRemove(index)}>{t('remove')}</button>
        <div className={`${showWallet[index] ? styles.show : styles.hide}`}>
          <div className={styles.walletField}>
            <div className={styles.walletFieldTitle}>{t('chain_ticker')}</div>
            <input
              autoCorrect='off'
              autoCapitalize='off'
              spellCheck='false'
              onChange={(e) => setWalletsArrayProperty(index, 'chainTicker', e.target.value)}
              value={wallet.chainTicker}
              placeholder='eth/sol/avax'
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
                1: <button key={`copyMessageEtherscanButton-${index}`} onClick={() => copyMessageToSign(wallet, index)} />,
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
            <button className={styles.save} onClick={handleSave}>
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
        <Trans
          i18nKey='add_wallet'
          components={{ 1: <button key={`addWalletButton-${walletsArray.length}`} onClick={() => setWalletsArray([...walletsArray, defaultWalletObject])} /> }}
        />
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
