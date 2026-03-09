import packageJson from '../../../package.json';

const { version } = packageJson;
const commitRef = import.meta.env.VITE_COMMIT_REF;

const VersionWithCommit = () => {
  return (
    <a
      href={commitRef ? `https://github.com/bitsocialnet/seedit/commit/${commitRef}` : `https://github.com/bitsocialnet/seedit/releases/tag/v${version}`}
      target='_blank'
      rel='noopener noreferrer'
    >
      v{commitRef ? `${version}#${commitRef.slice(0, 7)}` : version}
    </a>
  );
};

const Version = () => {
  return (
    <a href={`https://github.com/bitsocialnet/seedit/releases/tag/v${version}`} target='_blank' rel='noopener noreferrer'>
      v{version}
    </a>
  );
};

export { Version, VersionWithCommit };
