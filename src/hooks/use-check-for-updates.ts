import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { version as packageVersion } from '../../package.json';

const commitRef = import.meta.env.VITE_COMMIT_REF;
const isAndroid = Capacitor.getPlatform() === 'android';

/** Compares this build with the latest release (and development commit, on development builds) and tells the user. */
const useCheckForUpdates = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const checkForUpdates = async () => {
    try {
      setLoading(true);
      const packageRes = await fetch('https://raw.githubusercontent.com/bitsocialnet/seedit/master/package.json', { cache: 'no-cache' });
      const packageData = await packageRes.json();
      let updateAvailable = false;

      if (packageVersion !== packageData.version) {
        const newVersionText = t('new_stable_version', { newVersion: packageData.version, oldVersion: packageVersion });
        const updateActionText = window.electronApi?.isElectron
          ? t('download_latest_desktop', { link: 'https://github.com/bitsocialnet/seedit/releases/latest', interpolation: { escapeValue: false } })
          : isAndroid
            ? t('download_latest_android')
            : t('refresh_to_update');
        if (isAndroid) {
          if (window.confirm(newVersionText + ' ' + updateActionText)) {
            window.open(`https://github.com/bitsocialnet/seedit/releases/download/v${packageData.version}/seedit-${packageData.version}.apk`, '_blank', 'noreferrer');
          }
        } else {
          alert(newVersionText + ' ' + updateActionText);
        }
        updateAvailable = true;
      }

      if (commitRef && commitRef.length > 0) {
        const commitRes = await fetch('https://api.github.com/repos/bitsocialnet/seedit/commits?per_page=1&sha=development', { cache: 'no-cache' });
        const commitData = await commitRes.json();

        const latestCommitHash = commitData[0].sha;

        if (latestCommitHash.trim() !== commitRef.trim()) {
          const newVersionText =
            t('new_development_version', { newCommit: latestCommitHash.slice(0, 7), oldCommit: commitRef.slice(0, 7) }) + ' ' + t('refresh_to_update');
          alert(newVersionText);
          updateAvailable = true;
        }
      }

      if (!updateAvailable) {
        alert(
          commitRef
            ? `${t('latest_development_version', { commit: commitRef.slice(0, 7), link: 'https://seedit.eth.limo/#/', interpolation: { escapeValue: false } })}`
            : `${t('latest_stable_version', { version: packageVersion })}`,
        );
      }
    } catch (error) {
      alert('Failed to fetch latest version info: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return { checkForUpdates, loading };
};

export default useCheckForUpdates;
