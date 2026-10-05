import { useParams } from 'react-router-dom';
import NotFound from '../../components/not-found';
import { isDirectoryCode } from '../../lib/utils/directory-codes';
import About from './about';

const DirectoryAbout = () => {
  const { directoryCode } = useParams();

  return directoryCode && !isDirectoryCode(directoryCode) ? <NotFound /> : <About />;
};

export default DirectoryAbout;
