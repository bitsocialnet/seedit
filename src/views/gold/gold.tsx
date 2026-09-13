import { Link } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import useIsMobile from '../../hooks/use-is-mobile';
import Sidebar from '../../components/sidebar';
import { DIRECTORY_INDEX_PATH } from '../../lib/utils/community-route-utils';
// the gold page is a FAQ with gold accents, so it reuses the shared static-page chrome
import pageStyles from '../../components/static-page';
import styles from './gold.module.css';

export const GoldFaq = () => {
  const isMobile = useIsMobile();

  return (
    <div className={pageStyles.about}>
      <div className={styles.notice}>
        <span className={styles.goldName}>seedit gold</span> is a planned yearly supporter subscription. It is <strong>not available yet</strong>: there is nothing to
        buy, activate, or renew today. When it launches, gold holders will publish without solving a challenge on communities that support the gold challenge, and will be
        eligible to vote on <Link to={DIRECTORY_INDEX_PATH}>directory pages</Link>. Checkout will be crypto only.
      </div>
      <ul className={isMobile ? pageStyles.tocMobile : pageStyles.toc}>
        <li>
          <HashLink to='/gold#whatIsGold'>What is seedit gold?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#available'>Is it available now?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#publishing'>How does frictionless publishing work?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#directoryVoting'>What is directory vote eligibility?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#whatItIsNot'>What does gold not do?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#pricing'>How much will it cost?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#payment'>How will payment work?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#nft'>How does the NFT work?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#proceeds'>Where do the proceeds go?</HashLink>
        </li>
        <li>
          <HashLink to='/gold#needGold'>Do I need it to browse or post?</HashLink>
        </li>
      </ul>
      <h3 id='whatIsGold' style={{ marginTop: '0' }}>
        What is seedit gold?
      </h3>
      <p>
        Seedit gold is an upcoming supporter subscription for people who want to fund Seedit directly. When it launches, it will unlock two things: publishing without
        solving a challenge on communities that support the gold challenge, and eligibility to vote on the{' '}
        <Link to={DIRECTORY_INDEX_PATH}>community directory pages</Link> that decide Seedit's default community list.
      </p>
      <hr />
      <h3 id='available'>Is it available now?</h3>
      <p>
        No. This page exists so the future seedit gold route is already in place and the idea is documented, but there is no purchase, activation, or renewal flow yet.
        Nothing on Seedit is gated behind gold today.
      </p>
      <hr />
      <h3 id='publishing'>How does frictionless publishing work?</h3>
      <p>
        Seedit has no servers and no admins, so communities protect themselves from spam by asking publishers to solve a challenge before a post or reply is accepted,
        such as a captcha or a similar verification. Community owners choose which challenges their community uses. On communities that enable the gold challenge, a valid
        gold subscription is accepted in place of solving that challenge, so publishing goes through without the extra step.
        <br />
        <br />
        This is a per-community setting, not a global bypass. A community that does not enable the gold challenge keeps asking every publisher, gold holders included.
      </p>
      <hr />
      <h3 id='directoryVoting'>What is directory vote eligibility?</h3>
      <p>
        Seedit's <Link to={DIRECTORY_INDEX_PATH}>default community list</Link> is curated through public directory pages, where communities can be voted toward being
        listed or removed. When gold launches, holding it will make an account eligible to vote on those directory pages. Directory voting is meant as a governance
        signal, not a final override: the direction is to keep it aligned with BSO holders and existing safeguards rather than handing control to subscribers.
      </p>
      <hr />
      <h3 id='whatItIsNot'>What does gold not do?</h3>
      <p>
        Gold does not grant moderation powers, community ownership, or any way to ignore the rules of a community you post in. It does not bypass bans or moderation
        decisions, and it does not give a vote more weight inside a community's own feed. Each community still sets and enforces its own rules, and your account remains
        yours: gold is attached to the address you buy it with and changes nothing about how your account is stored on your device.
      </p>
      <hr />
      <h3 id='pricing'>How much will it cost?</h3>
      <p>
        The planned pricing is a simple structure: $30 for 1 year, or $60 for 3 years. That is about $1.67 per month at the 3 year rate, or less than a single 20oz bottle
        of soda. Pricing is not final until gold actually launches.
      </p>
      <hr />
      <h3 id='payment'>How will payment work?</h3>
      <p>Seedit gold will be sold through a crypto-only checkout when it becomes available. Credit cards, PayPal, and other fiat payment methods will not be accepted.</p>
      <hr />
      <h3 id='nft'>How does the NFT work?</h3>
      <p>
        Seedit gold will be an NFT under the hood, powered by the open source{' '}
        <a href='https://github.com/bitsocialnet/mintpass' target='_blank' rel='noopener noreferrer'>
          MintPass
        </a>{' '}
        service. The gold challenge will only accept NFTs minted within the last year, so an NFT older than one year counts as expired until it is renewed or replaced.
        Because the credential lives on chain rather than being tied to an IP address, VPNs, proxies, and changing networks do not affect it.
      </p>
      <hr />
      <h3 id='proceeds'>Where do the proceeds go?</h3>
      <p>
        Net proceeds from seedit gold are intended to support the continued development and operation of Seedit, including compensating core contributors and covering
        infrastructure and other project costs. Any future allocation to buying or burning BSO will be disclosed separately before it takes effect. Purchases will create
        public on-chain transactions, so assume the wallet activity of a purchase can be seen by anyone.
      </p>
      <hr />
      <h3 id='needGold'>Do I need it to browse or post?</h3>
      <p>
        No. Seedit is free and open source, and it stays that way. You can browse, subscribe, vote, and post without gold. Gold is for supporting Seedit and for the two
        specific benefits above. If you just want to get started, read the <Link to='/about'>FAQ</Link> instead.
      </p>
    </div>
  );
};

const Gold = () => {
  const isMobile = useIsMobile();

  return (
    <div className={pageStyles.content}>
      {!isMobile && <Sidebar />}
      <GoldFaq />
    </div>
  );
};

export default Gold;
