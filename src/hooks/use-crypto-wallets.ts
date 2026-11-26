import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Account, setAccount } from '@bitsocial/bitsocial-react-hooks';
import { getWalletMessageToSign, verifyAuthorWallet } from '@bitsocial/bitsocial-react-hooks/author-wallet-proof';

export interface CryptoWallet {
  chainTicker: string;
  address: string;
  timestamp: number;
  signature: string;
  /** The chain ticker this row is saved under in the account, if it has been saved. */
  savedChainTicker?: string;
}

const EMPTY_WALLET: CryptoWallet = { chainTicker: '', address: '', timestamp: 0, signature: '' };

const toWalletEntry = (wallet: CryptoWallet) => ({ address: wallet.address, timestamp: wallet.timestamp, signature: { signature: wallet.signature, type: 'eip191' } });

const getAccountWallets = (account: Account): CryptoWallet[] =>
  Object.keys(account?.author?.wallets || {}).map((chainTicker) => ({
    chainTicker,
    address: account.author.wallets[chainTicker].address,
    timestamp: account.author.wallets[chainTicker].timestamp,
    signature: account.author.wallets[chainTicker].signature.signature,
    savedChainTicker: chainTicker,
  }));

const getMissingWalletField = (wallet: CryptoWallet): string | undefined => {
  if (!wallet.chainTicker) return 'chain ticker';
  if (!wallet.address) return 'address';
  if (!wallet.timestamp) return 'timestamp';
  if (!wallet.signature) return 'signature';
  return undefined;
};

const alertSaveError = (error: unknown) => alert(error instanceof Error ? error.message : String(error));

/**
 * Crypto wallets linked to the account, each proven by a BSIP-22 signed message, as drafts saved to the account on
 * request. Communities can check a linked wallet's holdings. Both interfaces' settings pages use it.
 */
const useCryptoWallets = (account: Account) => {
  const { t } = useTranslation();
  // BSIP-22 proofs name the account's key address, which stays the same when author.address is a name.
  const authorPublicKey: string = account?.signer?.address;
  const [wallets, setWallets] = useState<CryptoWallet[]>(() => getAccountWallets(account));
  const [hasCopied, setHasCopied] = useState(false);
  // Writes start from the account, which updates only after setAccount resolves, so a write started meanwhile could undo the pending one.
  const [isWriting, setIsWriting] = useState(false);

  const setWalletProperty = (index: number, property: keyof CryptoWallet, value: string | number) =>
    setWallets((current) => current.map((wallet, walletIndex) => (walletIndex === index ? { ...wallet, [property]: value } : wallet)));

  // pkc-js refuses to publish while any wallet has an invalid proof, so one is never saved.
  const getInvalidWalletReason = (wallet: CryptoWallet): string | undefined => {
    const result = verifyAuthorWallet(toWalletEntry(wallet), authorPublicKey);
    return result.outcome === 'invalid' ? result.reason : undefined;
  };

  /** A wallet saved before BSIP-22 was signed over an older message and must be signed again. */
  const mustSignAgain = (wallet: CryptoWallet) =>
    wallet.savedChainTicker !== undefined && verifyAuthorWallet(account.author.wallets[wallet.savedChainTicker], authorPublicKey).outcome === 'invalid';

  // Rows are removed by identity, so each added row needs its own object.
  const addWallet = () => setWallets((current) => [...current, { ...EMPTY_WALLET }]);

  const removeWallet = async (index: number) => {
    const removedWallet = wallets[index];
    const removeRow = () => setWallets((current) => current.filter((wallet) => wallet !== removedWallet));
    if (!removedWallet.savedChainTicker) return removeRow();
    // Remove only this wallet's saved entry; the other rows may hold unsaved or incomplete edits.
    const accountWallets = { ...account.author.wallets };
    delete accountWallets[removedWallet.savedChainTicker];
    setIsWriting(true);
    try {
      await setAccount({ ...account, author: { ...account.author, wallets: accountWallets } });
      removeRow();
    } catch (error) {
      alertSaveError(error);
    }
    setIsWriting(false);
  };

  /** Saves every wallet once all are complete, unique by chain ticker, and validly signed; resolves true once saved. */
  const save = async (): Promise<boolean> => {
    // incomplete wallets cannot be saved, so saving one would drop it (or the saved wallet it replaces)
    const incompleteIndex = wallets.findIndex((wallet) => getMissingWalletField(wallet));
    if (incompleteIndex !== -1) {
      alert(`${t('wallet_number', { index: incompleteIndex + 1 })}: missing ${getMissingWalletField(wallets[incompleteIndex])}`);
      return false;
    }
    // Wallets are saved by chain ticker, so a duplicate would overwrite the other wallet.
    const chainTickers = new Set<string>();
    const duplicateIndex = wallets.findIndex(({ chainTicker }) => {
      if (chainTickers.has(chainTicker)) return true;
      chainTickers.add(chainTicker);
      return false;
    });
    if (duplicateIndex !== -1) {
      alert(`${t('wallet_number', { index: duplicateIndex + 1 })}: duplicate chain ticker ${wallets[duplicateIndex].chainTicker}`);
      return false;
    }
    const invalidIndex = wallets.findIndex((wallet) => getInvalidWalletReason(wallet));
    if (invalidIndex !== -1) {
      alert(`${t('wallet_number', { index: invalidIndex + 1 })}: ${getInvalidWalletReason(wallets[invalidIndex])}`);
      return false;
    }
    const savedWallets = new Set(wallets);
    const accountWallets: Record<string, ReturnType<typeof toWalletEntry>> = {};
    for (const wallet of wallets) accountWallets[wallet.chainTicker] = toWalletEntry(wallet);
    setIsWriting(true);
    let saved = false;
    try {
      await setAccount({ ...account, author: { ...account.author, wallets: accountWallets } });
      setWallets((current) => current.map((wallet) => (savedWallets.has(wallet) ? { ...wallet, savedChainTicker: wallet.chainTicker } : wallet)));
      saved = true;
    } catch (error) {
      alertSaveError(error);
    }
    setIsWriting(false);
    return saved;
  };

  /** Copies the BSIP-22 message the wallet signs, stamping the wallet with the time it was made. */
  const copyMessageToSign = (index: number) => {
    const wallet = wallets[index];
    if (!wallet.chainTicker) return alert('missing chain ticker');
    if (!wallet.address) return alert('missing address');
    const timestamp = wallet.timestamp || Math.floor(Date.now() / 1000);
    if (timestamp !== wallet.timestamp) setWalletProperty(index, 'timestamp', timestamp);
    navigator.clipboard.writeText(getWalletMessageToSign(authorPublicKey, wallet.address, timestamp));
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return { wallets, setWalletProperty, addWallet, removeWallet, save, isWriting, mustSignAgain, copyMessageToSign, hasCopied };
};

export default useCryptoWallets;
