import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setAccount, useAccount, useResolvedAuthorAddress } from '@bitsocial/bitsocial-react-hooks';
import { getDisplayAddress } from '../lib/utils/address-utils';

export type CryptoAddressTone = 'error' | 'pending' | 'success' | 'neutral';

/**
 * A .bso name for the account: checked by resolving it to the account's signer, and saved only once it does.
 * Both interfaces' settings pages use it.
 */
const useCryptoAddressSetting = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const [cryptoAddress, setCryptoAddress] = useState<string>(account?.author?.shortAddress?.includes('.') ? account.author.shortAddress : '');
  const [status, setStatus] = useState<{ text: string; tone: CryptoAddressTone }>({ text: t('crypto_address_verification'), tone: 'neutral' });
  const [saved, setSaved] = useState(false);

  const author = { ...account?.author, address: cryptoAddress };
  const { resolvedAddress, state, error, chainProvider } = useResolvedAuthorAddress({ author, cache: false });
  const signerAddress: string | undefined = account?.signer?.address;

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const check = () => {
    if (!cryptoAddress || !cryptoAddress.includes('.')) {
      alert(t('enter_crypto_address'));
      return;
    }
    if (state === 'failed') {
      setStatus({
        text: error instanceof Error ? `failed to resolve crypto address, error: ${error.message}` : 'cannot resolve crypto address, unknown error',
        tone: 'error',
      });
    } else if (state === 'resolving') {
      setStatus({ text: `resolving from ${chainProvider?.urls}`, tone: 'pending' });
    } else if (resolvedAddress && resolvedAddress === signerAddress) {
      setStatus({ text: t('crypto_address_yours'), tone: 'success' });
    } else if (resolvedAddress && resolvedAddress !== signerAddress) {
      setStatus({ text: t('crypto_address_not_yours'), tone: 'error' });
    } else {
      setStatus({ text: t('crypto_address_verification'), tone: 'neutral' });
    }
  };

  const save = async () => {
    if (!cryptoAddress || !cryptoAddress.includes('.')) {
      alert(t('enter_crypto_address'));
    } else if (cryptoAddress === getDisplayAddress(account?.author?.address)) {
      flashSaved();
    } else if (resolvedAddress && resolvedAddress !== signerAddress) {
      alert(t('crypto_address_not_yours'));
    } else if (!resolvedAddress) {
      alert(t('crypto_address_not_resolved'));
    } else {
      try {
        await setAccount({ ...account, author: { ...account?.author, address: cryptoAddress } });
        flashSaved();
        setCryptoAddress('');
      } catch (error) {
        if (error instanceof Error) {
          alert(error.message);
          console.log(error);
        } else {
          console.error('An unknown error occurred:', error);
        }
      }
      setStatus({ text: t('crypto_address_verification'), tone: 'neutral' });
    }
  };

  return { cryptoAddress, setCryptoAddress, status, check, save, saved, signerAddress };
};

export default useCryptoAddressSetting;
