import { useState } from 'react';
import { getShortDisplayAddress } from '../../lib/utils/address-utils';
import styles from './modern-community-avatar.module.css';

const FALLBACK_TONES = 6;

// A stable tone per address, so a community keeps the same fallback color everywhere it appears.
const getFallbackTone = (address: string) => {
  let hash = 0;
  for (let index = 0; index < address.length; index++) hash = (hash * 31 + address.charCodeAt(index)) >>> 0;
  return hash % FALLBACK_TONES;
};

interface ModernCommunityAvatarProps {
  address: string;
  avatarUrl?: string;
  size?: 'small' | 'medium' | 'large';
}

const ModernCommunityAvatar = ({ address, avatarUrl, size = 'small' }: ModernCommunityAvatarProps) => {
  const [failedUrl, setFailedUrl] = useState<string>();
  const showImage = avatarUrl && failedUrl !== avatarUrl;
  const initial = getShortDisplayAddress(address).charAt(0).toUpperCase() || 's';

  return (
    <span className={`${styles.avatar} ${styles[size]} ${showImage ? '' : styles[`tone${getFallbackTone(address)}`]}`} aria-hidden='true'>
      {showImage ? <img src={avatarUrl} alt='' loading='lazy' onError={() => setFailedUrl(avatarUrl)} /> : initial}
    </span>
  );
};

export default ModernCommunityAvatar;
