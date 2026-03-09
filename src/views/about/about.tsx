import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import useIsMobile from '../../hooks/use-is-mobile';
import Sidebar, { Footer } from '../../components/sidebar';
import styles from './about.module.css';
import { useAccount, useComment, useSubplebbit } from '@plebbit/plebbit-react-hooks';
import { Capacitor } from '@capacitor/core';
import { isHomeAboutView } from '../../lib/utils/view-utils';
import { useEffect } from 'react';

const isAndroid = Capacitor.getPlatform() === 'android';

export const FAQ = () => {
  const account = useAccount();
  const isMobile = useIsMobile();
  const location = useLocation();
  const isInHomeAboutView = isHomeAboutView(location.pathname);

  return (
    <>
      <div className={styles.about}>
        <ul className={isMobile ? styles.tocMobile : styles.toc}>
          <li>
            <HashLink to='/about#newUsers'>New Users:</HashLink>
          </li>
          <li>
            <HashLink to='/about#whatIsSeedit'>What is Seedit and how does it work?</HashLink>
          </li>
          <li>
            <HashLink to='/about#createCommunity'>How do I create my own community?</HashLink>
          </li>
          <li>
            <HashLink to='/about#defaultList'>How can others find my community?</HashLink>
          </li>
          <li>
            <HashLink to='/about#search'>How do I search for a post?</HashLink>
          </li>
          <li>
            <HashLink to='/about#registerUsername'>Can I register a username?</HashLink>
          </li>
          {isInHomeAboutView && isMobile && (
            <li>
              <HashLink to='/about#usefulLinks'>Useful links</HashLink>
            </li>
          )}
        </ul>
        <h3 id='newUsers' style={{ marginTop: '0' }}>
          New Users:
        </h3>
        <p>
          Welcome! Your account was created automatically and it's stored locally on your device (
          {window.electronApi?.isElectron ? 'on this desktop app' : isAndroid ? 'on this mobile app' : `on this web app, ${window.location.hostname}`}, not on a server).
          You can back up your account in the <Link to='/settings#exportAccount'>preferences</Link>. There are no global rules or admins on Seedit, each community has its
          own rules and moderators, so please be sure to read the rules of the community you are joining. You can connect peer-to-peer to any community by using the
          search bar, or you can check out the <Link to='/communities/vote'>default community list</Link>.
        </p>
        <hr />
        <h3 id='whatIsSeedit'>What is Seedit and how does it work?</h3>
        <p>
          Seedit is a serverless, adminless, decentralized reddit alternative. Seedit is a client (interface) for the Plebbit protocol, which is a decentralized social
          network to create and fully own unstoppable communities. To learn more about Plebbit and its clients, please visit{' '}
          <a href='https://plebbit.com' target='_blank' rel='noopener noreferrer'>
            plebbit.com
          </a>
          .<br />
          <br />
          The main difference between Seedit and other reddit-like websites is that Seedit is fully decentralized. Each community is fully independent and decides how/if
          to moderate its own content, as there are no global rules or admins on Seedit. Each community acts as its own server, with its own data, and users connect to it
          peer-to-peer. This means that it's not possible to know how many users or communities Seedit has as a whole, since anyone can create their own community at any
          time, and not share its address with anyone.
          <br />
          <br />
          Unlike other "decentralized" websites, Seedit does not rely on blockchain technology or federated servers. Instead, it uses a distributed database (
          <a href='https://ipfs.tech' target='_blank' rel='noopener noreferrer'>
            IPFS
          </a>
          , similar to BitTorrent) to store the content of each community. This means that Seedit does not have to rely on the slow and expensive blockchain to store the
          content of each community, and it can be much faster and cheaper, scaling to millions of communities and users.
          <br />
          <br />
          Seedit is free and open source software under GPL-2.0 license, you can check the source code{' '}
          <a href='https://github.com/bitsocialnet/seedit' target='_blank' rel='noopener noreferrer'>
            here
          </a>
          .
        </p>
        <hr />
        <h3 id='createCommunity'>How do I create my own community?</h3>
        <p>
          If you're comfortable with the command line, you can use{' '}
          <a href='https://github.com/bitsocialnet/bitsocial-cli' target='_blank' rel='noopener noreferrer'>
            bitsocial-cli
          </a>{' '}
          to create your own community. Otherwise, you can download{' '}
          <a href='https://github.com/bitsocialnet/seedit/releases/latest' target='_blank' rel='noopener noreferrer'>
            Seedit desktop
          </a>
          , which automatically runs a full node and lets you create communities with the ease of a reddit-like graphical user interface. You can also open a remote
          connection to an <HashLink to='/settings/plebbit-options#plebbitRpc'>RPC node</HashLink> to create communities even on web and on mobile devices. In the near
          future, we plan to include a public RPC connection turned on by default, so you can create communities on any device without running your own node.
        </p>
        <hr />
        <h3 id='defaultList'>How can others find my community?</h3>
        <p>
          In the near future, it will be possible to submit your community to the <Link to='/communities/vote'>default community list</Link> by clicking on the "submit
          your community" button in the sidebar.{' '}
          <a href='https://www.coingecko.com/en/coins/plebbit' target='_blank' rel='noopener noreferrer'>
            Plebbit ($PLEB)
          </a>{' '}
          token holders will be able to vote on which communities to list in the default community list. If your community gets enough upvotes, it will be listed in the
          default community list, and all Seedit users will be able to see it in the default community list.
          <br />
          <br />
          Additionally, if a user of your community posts in it, your community address will be visible to others in the user's profile page. This means that even if your
          community is not listed in the default community list, if your community is popular enough, other users will be able to find it through the post history in the
          profile pages of the users of your community.
        </p>
        <hr />
        <h3 id='search'>How do I search for a post?</h3>
        <p>
          In the near future, it will be possible to progressively search for posts in a feed, by constantly looking for new posts in the p2p network (this search might
          be slow). As there are no servers, it's impossible to recreate a centralized search engine that will search for posts across the entire p2p network. However, we
          expect to see third party archiver websites that will allow you to search for posts that have already been discovered by other users across the plebbit network.
        </p>
        <hr />
        <h3 id='registerUsername'>Can I register a username?</h3>
        <p>
          You can set a display name for your account in the <Link to='/settings#displayName'>preferences</Link>. Your account address (u/{account?.author?.shortAddress})
          is generated randomly from a cryptographic hash of your public key, similarly to how a bitcoin address is generated. You can{' '}
          <HashLink to='/settings#cryptoAddress'>change your account address</HashLink> to a unique readable name you own, by resolving it with a decentralized domain
          name service such as{' '}
          <a href='https://ens.domains/' target='_blank' rel='noopener noreferrer'>
            ENS
          </a>{' '}
          or{' '}
          <a href='https://v1.sns.id/' target='_blank' rel='noopener noreferrer'>
            SNS
          </a>
          .
        </p>
      </div>
      {isInHomeAboutView && isMobile && (
        <>
          <hr />
          <div id='usefulLinks' className={styles.aboutFooter}>
            <Footer />
          </div>
        </>
      )}
    </>
  );
};

const About = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const { commentCid, subplebbitAddress } = useParams();

  const subplebbit = useSubplebbit({ subplebbitAddress });
  const comment = useComment({ commentCid: commentCid as string, onlyIfCached: true });

  useEffect(() => {
    if (!isMobile && location.pathname.endsWith('/about') && !isInHomeAboutView) {
      const newPath = location.pathname.replace(/\/about$/, '');
      navigate(newPath || '/');
    }
  }, [isMobile, location.pathname, navigate, isInHomeAboutView]);

  return (
    <div className={styles.content}>
      {isMobile ? (
        isInHomeAboutView ? (
          <>
            <Sidebar comment={comment} subplebbit={subplebbit} />
          </>
        ) : (
          <Sidebar comment={comment} subplebbit={subplebbit} />
        )
      ) : (
        <>
          <Sidebar />
          <FAQ />
        </>
      )}
    </div>
  );
};

export default About;
