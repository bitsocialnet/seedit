import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { Capacitor } from '@capacitor/core';
import useIsMobile from '../../hooks/use-is-mobile';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { DIRECTORY_INDEX_PATH } from '../../lib/utils/community-route-utils';
import pageStyles from '../static-page';
import styles from './faq.module.css';

const isAndroid = Capacitor.getPlatform() === 'android';

// the sidebar passes its Footer here on the mobile home about page so the version links render below the FAQ
type FAQProps = { footer?: ReactNode };

const FAQ = ({ footer }: FAQProps) => {
  const account = useAccount();
  const isMobile = useIsMobile();

  return (
    <>
      <div className={pageStyles.about}>
        <nav className={isMobile ? pageStyles.tocMobile : pageStyles.toc} aria-label='About page contents'>
          <strong>On this page</strong>
          <ul>
            <li>
              <HashLink to='/about#newUsers'>Getting started</HashLink>
            </li>
            <li>
              <HashLink to='/about#whatIsSeedit'>What is Seedit?</HashLink>
            </li>
            <li>
              <HashLink to='/about#createCommunity'>How do I create a community?</HashLink>
            </li>
            <li>
              <HashLink to='/about#defaultList'>How can people find my community?</HashLink>
            </li>
            <li>
              <HashLink to='/about#search'>How do I search for posts?</HashLink>
            </li>
            <li>
              <HashLink to='/about#registerUsername'>Can I choose a readable account name?</HashLink>
            </li>
            {footer && (
              <li>
                <HashLink to='/about#usefulLinks'>Useful links</HashLink>
              </li>
            )}
          </ul>
        </nav>
        <h3 id='newUsers' style={{ marginTop: '0' }}>
          Getting started
        </h3>
        <p>
          Seedit created your account automatically and stores it locally on this device—
          {window.electronApi?.isElectron ? 'in the desktop app' : isAndroid ? 'in the mobile app' : `in this web app at ${window.location.hostname}`}—rather than on a
          central account server. <Link to='/settings#exportAccount'>Back up your account</Link> so you can restore it if you change devices or lose this app's local
          data.
        </p>
        <ul className={styles.gettingStartedList}>
          <li>Browse the communities in the top bar, or enter an exact community address in the search box.</li>
          <li>Join the communities you want to see in your home feed.</li>
          <li>Read each community's rules before posting. Communities are independently operated and can set their own rules and moderators.</li>
        </ul>
        <hr />
        <h3 id='whatIsSeedit'>What is Seedit?</h3>
        <p>
          Seedit is an old.reddit-style app for{' '}
          <a href='https://bitsocial.net' target='_blank' rel='noopener noreferrer'>
            Bitsocial
          </a>
          , a peer-to-peer protocol for independently owned communities. Seedit does not use one central server to host every community or account. Each community
          publishes its own data, sets its own rules, and is reached through its address.
        </p>
        <p>
          Bitsocial distributes community data through peer-to-peer networking and{' '}
          <a href='https://ipfs.tech' target='_blank' rel='noopener noreferrer'>
            IPFS
          </a>
          . Posts and comments are not stored on a blockchain. Optional readable <code>.bso</code> addresses use ENS, as explained below.
        </p>
        <p>
          There is no central index of every Bitsocial community or user. Anyone can create a community and share its address privately or publicly. Seedit is free and
          open source software under the GPL-3.0-or-later license; you can{' '}
          <a href='https://github.com/bitsocialnet/seedit' target='_blank' rel='noopener noreferrer'>
            view its source code on GitHub
          </a>
          .
        </p>
        <hr />
        <h3 id='createCommunity'>How do I create a community?</h3>
        <p>
          The simplest option is{' '}
          <a href='https://github.com/bitsocialnet/seedit/releases/latest' target='_blank' rel='noopener noreferrer'>
            Seedit desktop
          </a>
          , which runs a full node and provides a graphical community editor. You can also run{' '}
          <a href='https://github.com/bitsocialnet/bitsocial-cli' target='_blank' rel='noopener noreferrer'>
            bitsocial-cli
          </a>
          . On the web or mobile app, creating and managing a community requires a <HashLink to='/settings/advanced#fullNodeRpc'>connection to a full node</HashLink>.
        </p>
        <hr />
        <h3 id='defaultList'>How can people find my community?</h3>
        <p>
          Share its exact address. People can paste that address into Seedit's search box, and links to posts keep using the same address. Community addresses also appear
          with posts and in user profiles, so people can follow them back to the community.
        </p>
        <p>
          Seedit also has default communities and short <code>s/</code> directory routes for public discovery. You can{' '}
          <Link to={DIRECTORY_INDEX_PATH}>inspect the current directories and their candidates</Link>; voting is not open yet. During this bootstrap period, proposals for
          the default community list are made through{' '}
          <a href='https://github.com/bitsocialnet/lists' target='_blank' rel='noopener noreferrer'>
            bitsocialnet/lists
          </a>
          .
        </p>
        <hr />
        <h3 id='search'>How do I search for posts?</h3>
        <p>
          On any feed, select the search box and choose <strong>Search a post in this feed</strong>. Seedit searches the posts available through that feed. It cannot
          search every community on the Bitsocial network at once because there is no central, network-wide post index.
        </p>
        <hr />
        <h3 id='registerUsername'>Can I choose a readable account name?</h3>
        <p>
          You can set a <Link to='/settings#displayName'>display name</Link>, but your account still has an underlying address such as u/
          {getDisplayAddress(account?.author?.shortAddress || '')}. For a unique readable address, you can{' '}
          <HashLink to='/settings#cryptoAddress'>connect an ENS name you own</HashLink>. Seedit displays the configured <code>.eth</code> name with a <code>.bso</code>{' '}
          ending. Register and manage the underlying name through{' '}
          <a href='https://ens.domains/' target='_blank' rel='noopener noreferrer'>
            ENS
          </a>
          .
        </p>
      </div>
      {footer && (
        <>
          <hr />
          <div id='usefulLinks' className={styles.aboutFooter}>
            {footer}
          </div>
        </>
      )}
    </>
  );
};

export default FAQ;
