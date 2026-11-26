import type { SVGProps } from 'react';

// Small stroke icons for the modern interface. They are decorative: every control that uses one also has a text label
// or an aria-label, so each icon is hidden from assistive technology.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

const createIcon = (paths: React.ReactNode, filled = false) => {
  const Icon = ({ size = 20, ...props }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
      {...props}
    >
      {paths}
    </svg>
  );
  return Icon;
};

export const MenuIcon = createIcon(<path d='M4 6h16M4 12h16M4 18h16' />);
export const CloseIcon = createIcon(<path d='M18 6 6 18M6 6l12 12' />);
export const MoreIcon = createIcon(
  <>
    <circle cx='5' cy='12' r='1.5' fill='currentColor' />
    <circle cx='12' cy='12' r='1.5' fill='currentColor' />
    <circle cx='19' cy='12' r='1.5' fill='currentColor' />
  </>,
);
export const SearchIcon = createIcon(
  <>
    <circle cx='11' cy='11' r='7' />
    <path d='m20 20-3.5-3.5' />
  </>,
);
export const PlusIcon = createIcon(<path d='M12 5v14M5 12h14' />);
export const MinusIcon = createIcon(<path d='M5 12h14' />);
export const HomeIcon = createIcon(<path d='M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' />);
export const GlobeIcon = createIcon(
  <>
    <circle cx='12' cy='12' r='9' />
    <path d='M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' />
  </>,
);
export const CompassIcon = createIcon(
  <>
    <circle cx='12' cy='12' r='9' />
    <path d='m15.5 8.5-2 5-5 2 2-5z' />
  </>,
);
export const InfoIcon = createIcon(
  <>
    <circle cx='12' cy='12' r='9' />
    <path d='M12 11v5M12 8h.01' />
  </>,
);
export const ShieldIcon = createIcon(<path d='M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6z' />);
export const UpvoteIcon = createIcon(<path d='M12 4 4.5 12H9v7.5h6V12h4.5z' />);
export const DownvoteIcon = createIcon(<path d='M12 20l7.5-8H15V4.5H9V12H4.5z' />);
export const CommentIcon = createIcon(<path d='M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.4a8 8 0 1 1 15.1-4.1z' />);
export const ShareIcon = createIcon(<path d='M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M16 7l-4-4-4 4M12 3v12' />);
export const UserIcon = createIcon(
  <>
    <circle cx='12' cy='8' r='4' />
    <path d='M4 21a8 8 0 0 1 16 0' />
  </>,
);
export const SunIcon = createIcon(
  <>
    <circle cx='12' cy='12' r='4' />
    <path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' />
  </>,
);
export const MoonIcon = createIcon(<path d='M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z' />);
export const SettingsIcon = createIcon(
  <>
    <path d='M4 7h9M17 7h3M4 17h3M11 17h9' />
    <circle cx='15' cy='7' r='2' />
    <circle cx='9' cy='17' r='2' />
  </>,
);
export const InboxIcon = createIcon(<path d='M6 9a6 6 0 1 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15.5 6 9M10.3 21a2 2 0 0 0 3.4 0' />);
export const ChevronDownIcon = createIcon(<path d='m6 9 6 6 6-6' />);
export const ClassicIcon = createIcon(<path d='M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5' />);
export const ExternalLinkIcon = createIcon(<path d='M14 3h7v7M10 14 21 3M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5' />);
export const PinIcon = createIcon(<path d='M9 3h6l-1 6 4 4H6l4-4zM12 13v8' />);
export const CardViewIcon = createIcon(
  <>
    <rect x='4' y='3.5' width='16' height='17' rx='2.5' />
    <path d='M4 14.5h16' />
  </>,
);
export const CompactViewIcon = createIcon(
  <>
    <rect x='4' y='4' width='16' height='16' rx='3' />
    <path d='M4 9.33h16M4 14.67h16' />
  </>,
);
export const TextPostIcon = createIcon(<path d='M5 6h14M5 10h14M5 14h14M5 18h9' />);
export const LinkIcon = createIcon(<path d='M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1' />);
export const PlayIcon = createIcon(<path d='M8 5.5v13l10.5-6.5z' />, true);
export const ImageIcon = createIcon(
  <>
    <rect x='3.5' y='4.5' width='17' height='15' rx='2.5' />
    <circle cx='9' cy='10' r='1.5' />
    <path d='m20.5 16-5-5-9 8.5' />
  </>,
);
export const ExpandIcon = createIcon(<path d='M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5' />);
export const CollapseIcon = createIcon(<path d='M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5' />);
export const CheckIcon = createIcon(<path d='m5 12.5 4.5 4.5L19 7.5' />);
