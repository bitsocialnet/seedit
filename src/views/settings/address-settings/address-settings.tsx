import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useCryptoAddressSetting from '../../../hooks/use-crypto-address-setting';
import styles from './address-settings.module.css';
import { getDisplayAddress } from '../../../lib/utils/address-utils';

const AddressSettings = () => {
  const { t } = useTranslation();
  const {
    cryptoAddress,
    setCryptoAddress,
    status,
    check: checkCryptoAddress,
    save: saveCryptoAddress,
    saved: savedCryptoAddress,
    signerAddress,
  } = useCryptoAddressSetting();
  const statusClass = { error: styles.red, pending: styles.yellow, success: styles.green, neutral: '' }[status.tone];

  const [showCryptoAddressInfo, setShowCryptoAddressInfo] = useState(false);

  return (
    <div className={styles.addressSettings}>
      <div className={styles.cryptoAddressSetting}>
        <div className={styles.usernameInput}>
          <input
            type='text'
            placeholder='myaddress.bso'
            autoCorrect='off'
            autoCapitalize='off'
            spellCheck='false'
            value={getDisplayAddress(cryptoAddress)}
            onChange={(e) => setCryptoAddress(e.target.value)}
          />
          <button className={styles.infoButton} onClick={() => setShowCryptoAddressInfo(!showCryptoAddressInfo)}>
            {showCryptoAddressInfo ? 'x' : '?'}
          </button>
          <button className={styles.button} onClick={saveCryptoAddress}>
            {t('save')}
          </button>
          {showCryptoAddressInfo && (
            <div className={styles.cryptoAddressInfo}>
              A <code>.bso</code> address is an ENS name you own, shown by Seedit with a <code>.bso</code> ending instead of <code>.eth</code>. To use one as your account
              name:
              <ol>
                <li>
                  Register a name (e.g. <code>yourname.eth</code>) at{' '}
                  <a href='https://app.ens.domains/' target='_blank' rel='noopener noreferrer'>
                    app.ens.domains
                  </a>
                  .
                </li>
                <li>
                  Open that name on ENS and go to <strong>Records</strong> → <strong>Edit Records</strong>.
                </li>
                <li>
                  Add a <strong>text record</strong> named <code>bitsocial</code> and paste this account&apos;s public key as its value:
                  <br />
                  <code>{signerAddress}</code>
                </li>
                <li>
                  Come back here, type your name ending in <code>.bso</code> (e.g. <code>yourname.bso</code>) in the field above, press <strong>Check</strong> to confirm
                  it points to this account, then press <strong>Save</strong>.
                </li>
              </ol>
            </div>
          )}
          {savedCryptoAddress && <span className={styles.saved}>{t('saved')}</span>}
        </div>
        <div className={styles.checkCryptoAddress}>
          <button className={styles.button} onClick={checkCryptoAddress}>
            {t('check')}
          </button>{' '}
          <span className={statusClass}>{status.text}</span>
        </div>
      </div>
    </div>
  );
};

export default AddressSettings;
