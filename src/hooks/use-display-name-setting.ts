import { useState } from 'react';
import { setAccount, useAccount } from '@bitsocial/bitsocial-react-hooks';

/** The account's display name as a draft, saved to the account on request. */
const useDisplayNameSetting = () => {
  const account = useAccount();
  const [displayName, setDisplayName] = useState(account?.author?.displayName || '');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    try {
      await setAccount({ ...account, author: { ...account?.author, displayName } });
      setSaved(true);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
        console.log(error);
      } else {
        console.error('An unknown error occurred:', error);
      }
    }
  };

  return { displayName: displayName || account?.author?.displayName || '', setDisplayName, save, saved };
};

export default useDisplayNameSetting;
