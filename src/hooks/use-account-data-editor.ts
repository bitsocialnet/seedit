import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccount, useAccount } from '@bitsocial/bitsocial-react-hooks';
import stringify from 'json-stringify-pretty-compact';
import { getEditableAccountData } from '../lib/utils/account-data-utils';

/** The account's editable data as JSON, edited as a draft and saved back to the account; both interfaces' editors use it. */
const useAccountDataEditor = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const [error, setError] = useState<Error | undefined>(undefined);

  const accountJson = stringify({ account: getEditableAccountData(account) });

  // edits belong to the account JSON they started from; a changed account JSON replaces them
  const [draft, setDraft] = useState<{ accountJson: string; text: string }>();
  const text = draft?.accountJson === accountJson ? draft.text : accountJson;
  const setText = (value: string) => {
    setDraft({ accountJson, text: value });
    if (error) setError(undefined);
  };

  /** Saves the draft and reloads into the settings, since the P2P client starts with the account. */
  const save = async () => {
    try {
      setError(undefined);
      const editorAccount = JSON.parse(text).account;
      await setAccount(editorAccount);
      alert(`Saved ${editorAccount.name}`);
      navigate('/settings');
      window.location.reload();
    } catch (caught) {
      if (caught instanceof Error) {
        setError(caught);
        alert(caught.message);
        console.log(caught);
      } else {
        setError(new Error('An unknown error occurred'));
        console.error('An unknown error occurred:', caught);
      }
    }
  };

  return { text, setText, isDirty: text !== accountJson, reset: () => setText(accountJson), save, error };
};

export default useAccountDataEditor;
