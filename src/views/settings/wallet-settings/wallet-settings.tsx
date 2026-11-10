import { Fragment, useState } from 'react';
import { Account, setAccount, useAccount } from '@bitsocial/bitsocial-react-hooks';
import styles from './wallet-settings.module.css';
import { Trans, useTranslation } from 'react-i18next';
import InfoTooltip from '../../../components/info-tooltip';

interface Wallet {
  chainTicker: string;
  address: string;
  timestamp: number;
  signature: string;
  // The chain ticker this row is saved under in the account, if it has been saved.
  savedChainTicker?: string;
}

const getWalletMessageToSign = (authorAddress: string, timestamp: number): string => {
  const messageToSign = {
    domainSeparator: 'pkc-author-wallet',
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
      savedChainTicker: chainTicker,
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

  const getMissingWalletField = (wallet: Wallet): string | undefined => {
    if (!wallet.chainTicker) return 'chain ticker';
    if (!wallet.address) return 'address';
    if (!wallet.timestamp) return 'timestamp';
    if (!wallet.signature) return 'signature';
    return undefined;
  };

  const updateWallets = (walletsToUpdate: Wallet[]) => {
    const wallets: { [key: string]: { address: string; timestamp: number; signature: { signature: string; type: string } } } = {};
    walletsToUpdate.forEach((wallet) => {
      if (!getMissingWalletField(wallet)) {
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
    return setAccount({ ...account, author: { ...account.author, wallets } });
  };

  const alertSaveError = (error: unknown) => alert(error instanceof Error ? error.message : String(error));

  const handleRemove = async (index: number) => {
    const removedWallet = walletsArray[index];
    const removeRow = () => setWalletsArray((wallets) => wallets.filter((wallet) => wallet !== removedWallet));
    if (!removedWallet.savedChainTicker) return removeRow();
    // Remove only this wallet's saved entry; the other rows may hold unsaved or incomplete edits.
    const wallets = { ...account.author.wallets };
    delete wallets[removedWallet.savedChainTicker];
    try {
      await setAccount({ ...account, author: { ...account.author, wallets } });
      removeRow();
    } catch (error) {
      alertSaveError(error);
    }
  };

  const handleSave = async () => {
    // updateWallets skips incomplete wallets, so saving one would drop it (or the saved wallet it replaces).
    const incompleteIndex = walletsArray.findIndex((wallet) => getMissingWalletField(wallet));
    if (incompleteIndex !== -1) {
      alert(`${t('wallet_number', { index: incompleteIndex + 1 })}: missing ${getMissingWalletField(walletsArray[incompleteIndex])}`);
      return;
    }
    // Wallets are saved by chain ticker, so a duplicate would overwrite the other wallet.
    const chainTickers = new Set<string>();
    const duplicateIndex = walletsArray.findIndex(({ chainTicker }) => {
      if (chainTickers.has(chainTicker)) return true;
      chainTickers.add(chainTicker);
      return false;
    });
    if (duplicateIndex !== -1) {
      alert(`${t('wallet_number', { index: duplicateIndex + 1 })}: duplicate chain ticker ${walletsArray[duplicateIndex].chainTicker}`);
      return;
    }
    const savedWallets = new Set(walletsArray);
    try {
      await updateWallets(walletsArray);
      setWalletsArray((wallets) => wallets.map((wallet) => (savedWallets.has(wallet) ? { ...wallet, savedChainTicker: wallet.chainTicker } : wallet)));
      alert(t('saved'));
    } catch (error) {
      alertSaveError(error);
    }
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
