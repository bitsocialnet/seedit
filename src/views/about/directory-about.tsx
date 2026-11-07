import { useParams } from 'react-router-dom';
import NotFound from '../../components/not-found';
import { isDirectoryCode, isWellFormedDirectoryCode } from '../../lib/utils/directory-codes';
import { useDirectoryRegistry } from '../../hooks/use-directory-registry';
import About from './about';

const DirectoryAbout = () => {
  const { directoryCode } = useParams();
  const { codes, settled } = useDirectoryRegistry();
  // A code may belong to a directory published after this build; wait for the published codes before calling it unknown.
  const isUnknownDirectory = directoryCode && !isDirectoryCode(directoryCode, codes) && (settled || !isWellFormedDirectoryCode(directoryCode));

  return isUnknownDirectory ? <NotFound /> : <About />;
};

export default DirectoryAbout;
