import { useState } from 'react';
import { type Account, setAccount } from '@bitsocial/bitsocial-react-hooks';

export interface CryptoWallet {
  chainTicker: string;
  address: string;
  timestamp: number;
  signature: string;
}

const EMPTY_WALLET: CryptoWallet = { chainTicker: '', address: '', timestamp: 0, signature: '' };

const getWalletMessageToSign = (authorAddress: string, timestamp: number): string => JSON.stringify({ domainSeparator: 'pkc-author-wallet', authorAddress, timestamp });

const getAccountWallets = (account: Account): CryptoWallet[] =>
  Object.keys(account?.author?.wallets || {}).map((chainTicker) => ({
    chainTicker,
    address: account.author.wallets[chainTicker].address,
    timestamp: account.author.wallets[chainTicker].timestamp,
    signature: account.author.wallets[chainTicker].signature.signature,
  }));

/**
 * Crypto wallets linked to the account, each proven by a signed message, as drafts saved to the account on request.
 * Communities can check a linked wallet's holdings. Both interfaces' settings pages use it.
 */
const useCryptoWallets = (account: Account) => {
  const authorAddress: string = account?.author?.address;
  const [wallets, setWallets] = useState<CryptoWallet[]>(() => getAccountWallets(account));
  const [hasCopied, setHasCopied] = useState(false);

  const setWalletProperty = (index: number, property: keyof CryptoWallet, value: string | number) =>
    setWallets((current) => current.map((wallet, walletIndex) => (walletIndex === index ? { ...wallet, [property]: value } : wallet)));

  /** Only complete wallets are saved; a draft missing a field stays in the form. */
  const saveWallets = (walletsToSave: CryptoWallet[]) => {
    const accountWallets: Record<string, { address: string; timestamp: number; signature: { signature: string; type: string } }> = {};
    for (const wallet of walletsToSave) {
      if (wallet.chainTicker && wallet.address && wallet.signature && wallet.timestamp) {
        accountWallets[wallet.chainTicker] = { address: wallet.address, timestamp: wallet.timestamp, signature: { signature: wallet.signature, type: 'eip191' } };
      }
    }
    setAccount({ ...account, author: { ...account.author, wallets: accountWallets } });
  };

  const addWallet = () => setWallets((current) => [...current, EMPTY_WALLET]);

  const removeWallet = (index: number) => {
    const remaining = wallets.filter((_, walletIndex) => walletIndex !== index);
    setWallets(remaining);
    saveWallets(remaining);
  };

  const save = () => saveWallets(wallets);

  /** Copies the message the wallet signs, stamping the wallet with the time it was made. */
  const copyMessageToSign = (index: number) => {
    const wallet = wallets[index];
    if (!wallet.chainTicker) return alert('missing chain ticker');
    if (!wallet.address) return alert('missing address');
    const timestamp = wallet.timestamp || Math.floor(Date.now() / 1000);
    if (timestamp !== wallet.timestamp) setWalletProperty(index, 'timestamp', timestamp);
    navigator.clipboard.writeText(getWalletMessageToSign(authorAddress, timestamp));
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return { wallets, setWalletProperty, addWallet, removeWallet, save, copyMessageToSign, hasCopied };
};

export default useCryptoWallets;
