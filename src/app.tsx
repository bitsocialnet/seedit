import { ComponentType, lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { initializeNotificationSystem } from './lib/push';
import useTheme from './hooks/use-theme';
import { useAutoSubscribe } from './hooks/use-auto-subscribe';
import { useBrowserPureP2PAccountUpgrade } from './hooks/use-browser-pure-p2p-account-upgrade';
import useCanonicalCommunityRoute from './hooks/use-canonical-community-route';
import All from './views/all';
import Author from './views/author';
import Domain from './views/domain';
import Home from './views/home';
import NotFound from './views/not-found';
import PostPage from './views/post';
import Profile from './views/profile';
import CommunityView from './views/community';
import AccountBar from './components/account-bar/';
import ChallengeModal from './components/challenge-modal';
import Header from './components/header';
import LoadingEllipsis from './components/loading-ellipsis';
import { preloadMarkdown } from './components/markdown';
import NotificationHandler from './components/notification-handler';
import SiteFooter from './components/site-footer';
import DirectorySubscriptionReconciler from './components/directory-subscription-reconciler';
import ExactCommunityActionRoute from './components/exact-community-action-route';
import StickyHeader from './components/sticky-header';
import TopBar from './components/topbar';
import { DIRECTORY_INDEX_PATH } from './lib/utils/community-route-utils';
import styles from './app.module.css';

initializeNotificationSystem();

const SettingsUpgradeModal = lazy(() => import('./components/settings-upgrade-modal'));
const LazyViewLoading = () => {
  const { t } = useTranslation();
  return (
    <div className={styles.lazyRouteLoading}>
      <LoadingEllipsis string={t('loading')} />
    </div>
  );
};

// Each lazy view gets its own boundary. One around a layout's outlet would also catch eager views
// that suspend (on translations, for example) and commit the layout with an empty page first.
const lazyView = (load: () => Promise<{ default: ComponentType }>) => {
  const View = lazy(load);
  return () => (
    <Suspense fallback={<LazyViewLoading />}>
      <View />
    </Suspense>
  );
};

// the changelog inlines the whole CHANGELOG.md, so it loads as its own chunk instead of weighing down first paint
const Changelog = lazyView(() => import('./views/changelog'));
// Views that visitors rarely land on first load on demand, keeping them out of the JavaScript
// that must download before the first render. Feed and post views stay eager.
const AboutView = lazyView(() => import('./views/about'));
const DirectoryAboutView = lazyView(() => import('./views/about').then((module) => ({ default: module.DirectoryAbout })));
const Gold = lazyView(() => import('./views/gold'));
const Inbox = lazyView(() => import('./views/inbox'));
const Mod = lazyView(() => import('./views/mod'));
const Search = lazyView(() => import('./views/search'));
const Settings = lazyView(() => import('./views/settings'));
const AccountDataEditor = lazyView(() => import('./views/account-data-editor'));
const CommunityDataEditor = lazyView(() => import('./views/community-data-editor'));
const SubmitPage = lazyView(() => import('./views/submit'));
const CommunitySettings = lazyView(() => import('./views/community-settings'));
const Communities = lazyView(() => import('./views/communities'));
const StarterSubscriptions = lazyView(() => import('./views/starter-subscriptions'));

// Landing views render markdown as soon as peer content arrives; start its download now,
// after the startup JavaScript has already loaded.
preloadMarkdown();

const LegacyDirectoryRouteRedirect = () => {
  const location = useLocation();
  const { directoryCode } = useParams();
  const pathname = directoryCode ? `${DIRECTORY_INDEX_PATH}/${encodeURIComponent(directoryCode)}` : DIRECTORY_INDEX_PATH;

  return <Navigate to={{ pathname, search: location.search, hash: location.hash }} replace />;
};

const App = () => {
  useAutoSubscribe();
  useBrowserPureP2PAccountUpgrade();
  useCanonicalCommunityRoute();

  const globalLayout = (
    <>
      <ChallengeModal />
      <NotificationHandler />
      <DirectorySubscriptionReconciler />
      <Suspense fallback={null}>
        <SettingsUpgradeModal />
      </Suspense>
      <Outlet />
      {/* old.reddit shows the same footer on every page, so it lives in the shared layout */}
      <SiteFooter />
    </>
  );

  const pagesLayout = (
    <>
      <TopBar />
      <AccountBar />
      <Header />
      <Outlet />
    </>
  );

  const feedLayout = (
    <>
      <StickyHeader />
      <Header />
      <Outlet />
    </>
  );

  // add theme className to body so it can set the correct body background in index.css
  const [theme] = useTheme();
  useEffect(() => {
    document.body.classList.forEach((className) => document.body.classList.remove(className));
    document.body.classList.add(theme);
  }, [theme]);

  return (
    <div className={`${styles.app} ${theme}`}>
      <div className='asset-preloader'>
        <div className='asset-preloader-seedit-text-light'></div>
        <div className='asset-preloader-seedit-text-dark'></div>
        <div className='asset-preloader-delete-button-hover'></div>
        <div className='asset-preloader-close-x-button-large-hover'></div>
        <div className='asset-preloader-play-button-hover'></div>
        <div className='asset-preloader-text-button-hover'></div>
        <div className='asset-preloader-button-large-hover-dark'></div>
        <div className='asset-preloader-button-large-hover'></div>
        <div className='asset-preloader-button-large-nub-hover-dark'></div>
        <div className='asset-preloader-button-large-nub-hover'></div>
        <div className='asset-preloader-close-button-hover'></div>
        <div className='asset-preloader-all-feed-subscribe-hover'></div>
        <div className='asset-preloader-arrow-upvoted'></div>
        <div className='asset-preloader-arrow-downvoted'></div>
      </div>

      <Routes>
        <Route element={globalLayout}>
          <Route element={pagesLayout}>
            <Route path='/about' element={<AboutView />} />
            <Route path='/changelog' element={<Changelog />} />
            <Route path='/gold' element={<Gold />} />
            <Route path='/submit' element={<SubmitPage />} />

            <Route path='/s/:communityAddress/comments/:commentCid' element={<PostPage />} />
            <Route path='/s/:communityAddress/comments/:commentCid/about' element={<AboutView />} />

            <Route
              path='/s/:communityAddress/submit'
              element={
                <ExactCommunityActionRoute>
                  <SubmitPage />
                </ExactCommunityActionRoute>
              }
            />
            <Route path='/s/:communityAddress/about' element={<AboutView />} />

            <Route path='/settings' element={<Settings />} />
            <Route
              path='/s/:communityAddress/settings'
              element={
                <ExactCommunityActionRoute>
                  <CommunitySettings />
                </ExactCommunityActionRoute>
              }
            />
            <Route
              path='/s/:communityAddress/settings/editor'
              element={
                <ExactCommunityActionRoute>
                  <CommunityDataEditor />
                </ExactCommunityActionRoute>
              }
            />
            <Route path='/settings/advanced' element={<Settings />} />
            <Route path='/settings/p2p-stats' element={<Settings />} />
            <Route path='/settings/content-options' element={<Settings />} />
            {import.meta.env.DEV && <Route path='/settings/debug' element={<Settings />} />}
            <Route path='/settings/account-data' element={<AccountDataEditor />} />

            <Route path='/profile/about' element={<AboutView />} />

            <Route path='/u/:authorAddress/comments/:commentCid/about' element={<AboutView />} />

            <Route path='/inbox' element={<Inbox />} />
            <Route path='/inbox/unread' element={<Inbox />} />
            <Route path='/inbox/commentreplies' element={<Inbox />} />
            <Route path='/inbox/postreplies' element={<Inbox />} />

            <Route path='/communities' element={<Communities />} />
            <Route path='/communities/defaults' element={<StarterSubscriptions />} />
            <Route path='/communities/subscriber' element={<Communities />} />
            <Route path='/communities/moderator' element={<Communities />} />
            <Route path='/communities/admin' element={<Communities />} />
            <Route path='/communities/owner' element={<Communities />} />
            <Route path={DIRECTORY_INDEX_PATH} element={<Communities />} />
            <Route path={`${DIRECTORY_INDEX_PATH}/about`} element={<DirectoryAboutView />} />
            <Route path={`${DIRECTORY_INDEX_PATH}/:directoryCode`} element={<Communities />} />
            <Route path={`${DIRECTORY_INDEX_PATH}/:directoryCode/about`} element={<DirectoryAboutView />} />
            <Route path='/communities/vote' element={<LegacyDirectoryRouteRedirect />} />
            <Route path='/communities/vote/passing' element={<LegacyDirectoryRouteRedirect />} />
            <Route path='/communities/vote/rejecting' element={<LegacyDirectoryRouteRedirect />} />
            <Route path='/communities/vote/:directoryCode' element={<LegacyDirectoryRouteRedirect />} />
            <Route path='/communities/create' element={<CommunitySettings />} />
          </Route>
          <Route element={feedLayout}>
            <Route path='/search' element={<Search />} />

            <Route path='/:sortType?/:timeFilterName?' element={<Home />} />

            <Route path='/s/all/:sortType?/:timeFilterName?' element={<All />} />

            <Route path='/s/mod/:sortType?/:timeFilterName?' element={<Mod />} />

            <Route path='/s/:communityAddress/:sortType?/:timeFilterName?' element={<CommunityView />} />

            <Route path='/domain/:domain/:sortType?/:timeFilterName?' element={<Domain />} />

            <Route path='/profile/:accountCommentIndex' element={<PostPage />} />

            <Route path='/profile' element={<Profile />}>
              <Route index element={<Profile.Overview />} />
              <Route path='upvoted' element={<Profile.VotedComments voteType={1} />} />
              <Route path='downvoted' element={<Profile.VotedComments voteType={-1} />} />
              <Route path='hidden' element={<Profile.HiddenComments />} />
              <Route path='saved' element={<Profile.SavedComments />} />
              <Route path='comments' element={<Profile.Comments />} />
              <Route path='submitted' element={<Profile.Submitted />} />
            </Route>

            <Route path='/u/:authorAddress/comments/:commentCid?/:sortType?/:timeFilterName?' element={<Author />} />
            <Route path='/u/:authorAddress/comments/:commentCid?/comments/:sortType?/:timeFilterName?' element={<Author />} />
            <Route path='/u/:authorAddress/comments/:commentCid?/submitted/:sortType?/:timeFilterName?' element={<Author />} />

            <Route path='*' element={<NotFound />} />
            <Route path='/not-found' element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </div>
  );
};

export default App;
