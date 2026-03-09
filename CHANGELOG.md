## [0.5.10](https://github.com/plebbit/seedit/compare/v0.5.9...v0.5.10) (2025-09-26)


### Bug Fixes

* **electron:** keep module-scoped Tray ref and destroy before reassign ([a33d708](https://github.com/plebbit/seedit/commit/a33d708e069c59bc52f6fc76c2e0291e27280c66))


### Performance Improvements

* **linux:** avoid GTK mixups by sanitizing env and skipping tray on Wayland ([e5e6aa4](https://github.com/plebbit/seedit/commit/e5e6aa4bf73c973b305e954f83ba168b195f4683))



## [0.5.9](https://github.com/plebbit/seedit/compare/v0.5.8...v0.5.9) (2025-08-19)


### Bug Fixes

* **challenge settings:** prevent uncontrolled input error in number fields ([818408c](https://github.com/plebbit/seedit/commit/818408c7d92afd14e05f2921c04c05b4a0c0a4b9))
* missing error displays in json editors ([06b9598](https://github.com/plebbit/seedit/commit/06b959855476d056d820cc5d9b519a80b9b84e7e))
* **posts:** handle whitespace-only post titles properly ([1f69dc9](https://github.com/plebbit/seedit/commit/1f69dc940591baa83d0f9a5d40110fa48ed63782))


### Performance Improvements

* **electron:** reduce prod logging + IPFS noise across OS; disable devtools in release; arch-aware mac builds ([c9f3ba8](https://github.com/plebbit/seedit/commit/c9f3ba88225461f788989c09915b8f2da6321c02))



## [0.5.8](https://github.com/plebbit/seedit/compare/v0.5.7...v0.5.8) (2025-08-09)


### Bug Fixes

* **android:** implement cross-platform account export ([b0b06db](https://github.com/plebbit/seedit/commit/b0b06db8c55b3e6bb6c1148acbc61d7ddf6c2d2c))
* edit comment state would get stuck at pending ([4251325](https://github.com/plebbit/seedit/commit/4251325b2a131bd64e5b8e8c8f1df20d7c20f581))
* resolve Android CI build failure with Google Services plugin ([a5373aa](https://github.com/plebbit/seedit/commit/a5373aa9baa44233cde6e9ec02e1b8c95917bcb1))
* resolve Android export dialog and permission issues ([01d7e1c](https://github.com/plebbit/seedit/commit/01d7e1c209d9899ea13502d70f6cf75786b5ec2c))
* revert Google Services to working config and remove hardcoded Java path ([f7df22a](https://github.com/plebbit/seedit/commit/f7df22a504e241d8d47af849a6b59937f5a3ca4e))



## [0.5.7](https://github.com/plebbit/seedit/compare/v0.5.6...v0.5.7) (2025-08-06)


### Bug Fixes

* **account editor:** page reload was missing when saving account edit, as well as auto navigate back to settings ([b6ee58f](https://github.com/plebbit/seedit/commit/b6ee58fe0a4872c2421f32500265a636d529b346))
* correct SNS v1 URLs ([f863aab](https://github.com/plebbit/seedit/commit/f863aab91209b009f9d25db5d2d29fe65c1fe1f5))
* **embeds:** make iframe width fix truly Safari-specific ([1badab4](https://github.com/plebbit/seedit/commit/1badab4a68e00eb916a5672ee63e89d5a16232a4))
* **embeds:** Safari iframe sizing in media previews ([c983de5](https://github.com/plebbit/seedit/commit/c983de555032e0a9760c0344a98054c5800a32cb))
* implement bidirectional sync between subplebbit form and JSON editor ([3d29e1f](https://github.com/plebbit/seedit/commit/3d29e1fa7fecfec5af1ae583021e9bc25d2089fb))
* improve PWA update detection and HTML caching strategy ([f3dd292](https://github.com/plebbit/seedit/commit/f3dd2926b78906ba20d72b3a4599c6d5180c0bf7))
* **inbox page:** prevent crash when iterating over undefined replies in context view ([5a459b5](https://github.com/plebbit/seedit/commit/5a459b5e4abda91402c786a05cdc965f99693752))
* **profile:** redirect to not-found when accessing profile routes with no comments ([2555711](https://github.com/plebbit/seedit/commit/255571173996d40cdfd86e13c239b111503c3fbe))
* react-scan was included in production builds ([a60142f](https://github.com/plebbit/seedit/commit/a60142f49330f08b313cbedfe4e9d9b71ee211c8))
* resolve Electron performance issues by ensuring Node.js version consistency in CI ([614fb42](https://github.com/plebbit/seedit/commit/614fb427bf21392245943e76b962711edf68a56b))
* **subplebbit data editor:** remove challenges field, it's read-only ([fdbced7](https://github.com/plebbit/seedit/commit/fdbced7311edb103a39f5dead0e40c4f56af840a))
* **subplebbit feed:** feed footer would show "loading..." incorrectly ([12df367](https://github.com/plebbit/seedit/commit/12df367ab93cc5dd99ef62c5c447b2c6a8f85bf6))
* **subplebbit settings:** clicking error wouldn't copy full error ([a526c0c](https://github.com/plebbit/seedit/commit/a526c0cc2f296290ab549fc0047e0b71f42b7d78))
* **subplebbit settings:** Improve offline handling ([ea9b12c](https://github.com/plebbit/seedit/commit/ea9b12cecac095673253bb6763acea3157635e90))
* **subplebbit:** sub with no posts could appear offline ([9be49c0](https://github.com/plebbit/seedit/commit/9be49c0a92edf206a34b4f009a921cba16201c99))
* **thumbnails:** some video duration overlays didn't render properly on safari and firefox ([b40eb9e](https://github.com/plebbit/seedit/commit/b40eb9e76552cbdab209c1e7c0ea3766b216b416))


### Features

* add domain-based libp2p client configuration ([6e6faa2](https://github.com/plebbit/seedit/commit/6e6faa23fdc082491290fd00709aaaf8305994fd))
* add info tooltips ([d21b5dd](https://github.com/plebbit/seedit/commit/d21b5ddb5b68bce9612b01f49c059e8f8c6b0a23))
* **moderation:** implement comment purging ([8f97434](https://github.com/plebbit/seedit/commit/8f974349e6e4ae61866c1bdb86200714f88f52bb))
* **subplebbit settings:** add json editor ([0f4058e](https://github.com/plebbit/seedit/commit/0f4058ea13b45aa8a5414627c8dd80cf63bc422d))
* **subplebbit settings:** enable editing via pubsub ([8e1ec8a](https://github.com/plebbit/seedit/commit/8e1ec8ac3d9bcb260ed1405cfbfc6b8e5f773d4d))


### Performance Improvements

* **feed:** replace individual window resize listeners with shared store ([843d796](https://github.com/plebbit/seedit/commit/843d7967cd97225128402d8449b466a3e2729472))
* optimize home feed rendering performance ([9842779](https://github.com/plebbit/seedit/commit/9842779de65d27d300445107c26bdb478c0a7663))
* replace direct store access with cached hooks ([6515e8c](https://github.com/plebbit/seedit/commit/6515e8c9bb28ed5086df67e89f0343f7ff75c9fb))
* **topbar:** memoize to prevent unnecessary rerenders ([afb1231](https://github.com/plebbit/seedit/commit/afb12315d1ee2c15d0a9df6b6cca48bca5a7ce2f))



## [0.5.6](https://github.com/plebbit/seedit/compare/v0.5.5...v0.5.6) (2025-06-18)


### Bug Fixes

* add missing text encoding dependencies for Electron build ([7f13a10](https://github.com/plebbit/seedit/commit/7f13a10f11acfd0453b5425d5c2a5332e4284e60))
* **inbox:** "full comments" button would count 0 posts incorrectly ([27233d0](https://github.com/plebbit/seedit/commit/27233d0e9a45b60ebb03c59ae287f52828ee8b5a))


### Features

* **account settings:** add granular export options for account backup ([633f0e6](https://github.com/plebbit/seedit/commit/633f0e66bb8c199224e26032e966b9050ae34c04))
* **account settings:** auto-adjust plebbit options on account import ([489a296](https://github.com/plebbit/seedit/commit/489a296179fe603b5903d99c28b093918b164e87))



## [0.5.5](https://github.com/plebbit/seedit/compare/v0.5.4...v0.5.5) (2025-06-13)


### Bug Fixes

* **electron:** add missing file uploader IPC channels ([63bb2ad](https://github.com/plebbit/seedit/commit/63bb2adc82959555c4dfd016dec6d155c1049155))
* **settings:** account data editor could fail to load for some users ([c413989](https://github.com/plebbit/seedit/commit/c41398935bf73f2057fd2b84b7f544b7cb317ba6))
* **vite.config.js:** increase PWA cache limit ([29b4d8c](https://github.com/plebbit/seedit/commit/29b4d8cd4c34d5c73df514b904f9382bb9bfcd6e))


### Features

* upgrade electron, add CSP to fix security warning ([77f6041](https://github.com/plebbit/seedit/commit/77f6041f04a75115aed4df3807e3a5cba6efb6ea))



## [0.5.4](https://github.com/plebbit/seedit/compare/v0.5.3...v0.5.4) (2025-06-09)


### Bug Fixes

* **account data editor:** immutable fields were included in the editor ([075f5cc](https://github.com/plebbit/seedit/commit/075f5cc80a1dc4f6aa85d8a6e3cadaed244d72ce))
* **account settings:** changing account didn't change fields in UI ([af48dcc](https://github.com/plebbit/seedit/commit/af48dccc02a825b6e6a5257baaba6b0ac4fcaf76))
* **post content:** trailing punctuation could prevent internal plebbit links from getting parsed ([fdf7bf6](https://github.com/plebbit/seedit/commit/fdf7bf60a70092e8493d777bf79f100e61bb3323))
* **post page:** deleted replies with no children would be rendered needlessly ([333cb38](https://github.com/plebbit/seedit/commit/333cb38b3efe5e3a76180fe0076f9c498a1d006c))
* **wallet settings:** removing a wallet didn't work ([7554d9d](https://github.com/plebbit/seedit/commit/7554d9dbdecf65251e1e888e5145626f41cf2cbe))


### Features

* **feed:** yearly feed suggestions and optimized loading for suggestions past 25 loaded posts ([a8155f1](https://github.com/plebbit/seedit/commit/a8155f1d931f1174dc405283c9f13ca6c4704178))
* **wallet settings:** add timestamp field ([f4cf9d3](https://github.com/plebbit/seedit/commit/f4cf9d38979d97610b1021471b1d6bcb368ede2c))



## [0.5.3](https://github.com/plebbit/seedit/compare/v0.5.2...v0.5.3) (2025-06-01)


### Bug Fixes

* **android:** resolve fullscreen overlay preventing user interaction ([4e69723](https://github.com/plebbit/seedit/commit/4e69723129dcf1a505b5b0cf65624e9c6629186b))
* **post page:** component would retain scrolling position incorrectly when navigating within itself ([415a56c](https://github.com/plebbit/seedit/commit/415a56c32dd32624ccbb50a710c32c50c5aa90e2))
* **post:** title could display some markdown syntax ([3eaf3c5](https://github.com/plebbit/seedit/commit/3eaf3c5eaf49ae46bb68a97015ccb5edcfba8189))


### Features

* **android:** add new seedit icon ([2a3c3a3](https://github.com/plebbit/seedit/commit/2a3c3a355b7b9a5c72e98fb7d5eda13f96ecf126))



## [0.5.2](https://github.com/plebbit/seedit/compare/v0.5.1...v0.5.2) (2025-05-31)


### Bug Fixes

* **author page:** posts were incorrectly ranked ([ca48aef](https://github.com/plebbit/seedit/commit/ca48aef8e041a5169ed3e66ae4b23d7dbbfd5f0e))
* **electron:** "share" button couldn't copy link to clipboard ([5dddd9e](https://github.com/plebbit/seedit/commit/5dddd9ee460686cf5d554759193383a0d31a9171))
* **post:** share links could be broken for posts that failed to publish ([b35edac](https://github.com/plebbit/seedit/commit/b35edac0d433eb5bd4c79565e0803cb8d4b1c740))
* push notifications didn't work properly ([5ee8fdb](https://github.com/plebbit/seedit/commit/5ee8fdbccc8ce53760b8e4bb06dee24644ba606c))
* **thumbnail:** gifs were stuck on playing endlessly on chromium-based browsers ([d0bc190](https://github.com/plebbit/seedit/commit/d0bc190bfdbc20b86d16de8561bba43d06c46f50))


### Features

* **communities page:** filter by nsfw communities by clicking the "18+" label, filter in each ([5e3bf59](https://github.com/plebbit/seedit/commit/5e3bf59387024a3f902735ca563d0abd4a012e75))
* **nsfw filter:** ask user whether to auto-subscribe to nsfw subs when disabling filter ([1808275](https://github.com/plebbit/seedit/commit/1808275d8acc467bf1939f51930df04e1f04448e))
* **post:** replace seedit links typed in post content with internal links so the user doesn't have to leave the app ([c37dc52](https://github.com/plebbit/seedit/commit/c37dc52cecf051231278e94db8d2d14e17b1b62d))
* update app icon, favicon ([c8dd7ec](https://github.com/plebbit/seedit/commit/c8dd7ec7005b3e974c88f2d1329113972b3b9e14))


### Performance Improvements

* **build:** optimize bundle chunking and PWA caching ([1094545](https://github.com/plebbit/seedit/commit/1094545e0d66f5e1d535374764b89cf9591a9fef))



## [0.5.1](https://github.com/plebbit/seedit/compare/v0.5.0...v0.5.1) (2025-05-21)


### Bug Fixes

* **account settings:** private key was visible in UI ([73fd0a5](https://github.com/plebbit/seedit/commit/73fd0a5329402178119c8af8259759b4f3ea710e))
* auto-subscribe logic could fail to run on certain views ([72136bb](https://github.com/plebbit/seedit/commit/72136bbf131a72e770dcdbfcdd32454b5e0d1ae6))
* **dark mode:** inputs and buttons didn't use the browser dark mode theme ([8acb9db](https://github.com/plebbit/seedit/commit/8acb9dbc27016c58cf3adfc07e19ac7015178c20))
* **electron:** add CJS wrapper for after-all-artifact-build hook ([4ac3c02](https://github.com/plebbit/seedit/commit/4ac3c02dff00a52274f9aeef2630d269919f9279))
* **electron:** client would assume the user is connected to full node ([2bc92cc](https://github.com/plebbit/seedit/commit/2bc92cc6f03bfeec08c0eb4b7e0c391c5c9dd312))
* **electron:** resolve preload script module errors and ensure proper bundling ([9a3481c](https://github.com/plebbit/seedit/commit/9a3481cbdb23ae42f1c64a706510373e00616fb0))
* **feed:** thumbnails could get stuck when navigating ([35f0456](https://github.com/plebbit/seedit/commit/35f04569f26bdc97e8450ab01003c8103a847128))
* **markdown:** blockquotes could appear behind thumbnail ([699e675](https://github.com/plebbit/seedit/commit/699e6751c9d30f0d914667043ac3d12902291dfe))
* **markdown:** code blocks had wrong spacing ([15e68b1](https://github.com/plebbit/seedit/commit/15e68b133515ce6c3d050ee768eb5113fd9a3892))
* **markdown:** empty lines (using special md syntax) didn't render with same spacing as normal breaks ([51e225e](https://github.com/plebbit/seedit/commit/51e225e967e4d36420309e613d45e7b5a0ee5019))
* **package.json:** downgrade bonfida/spl-name-service, it prevented the electron apps from opening ([7df0760](https://github.com/plebbit/seedit/commit/7df0760bd57576f0dacb349991e9fd03322539e8))
* **post:** some content could overflow ([195391b](https://github.com/plebbit/seedit/commit/195391b26a8f0d66b578e60fa6a5c97236de95d3))
* **replies:** floated image thumbnails weren't clickable when wrapped by markdown content ([ffdceb2](https://github.com/plebbit/seedit/commit/ffdceb24f969b30114a02ef59d414900f211f142))
* **replies:** thumbnail icons would disappear when clicked ([9cdf5bf](https://github.com/plebbit/seedit/commit/9cdf5bfbd4a46d96999cb22c1567a8b176d75b51))
* **search bar:** dropdown item wasn't clickable on mobile, search bar wouldn't unfocus after searching ([0dd5a55](https://github.com/plebbit/seedit/commit/0dd5a559225db0a4d85485cbfc4deb8ea3d069bb))
* **settings:** crypto wallets hashlink was missing ([d7845bd](https://github.com/plebbit/seedit/commit/d7845bd001d4b4b16f665046b28dff10c681badc))
* **settings:** spellcheck was enabled on certain fields, fix wrong placeholder ([fda2449](https://github.com/plebbit/seedit/commit/fda24499cbd38da97a4905dfbca831d021b1db32))
* **submit page:** preview of embeds had wrong width ([8082e6a](https://github.com/plebbit/seedit/commit/8082e6a4669980f3f6799ec7c36f6a5fb5fb32db))
* **subplebbit settings:** navigating away from view could reset fields ([4948bcb](https://github.com/plebbit/seedit/commit/4948bcbbfdb3d7bf7b6a1449470c8902ed5a3dd8))
* **subplebbit settings:** not owner alert could display for owners, missing state string, missing subplebbit error display ([a9e7d3b](https://github.com/plebbit/seedit/commit/a9e7d3bd35f37b5118b9d4452c6ef613424529b7))
* **subplebbit:** could temporarily show "no posts" in subplebbit with 1 post just published by user ([d3b68bb](https://github.com/plebbit/seedit/commit/d3b68bbd26a5252901f43574c98ce66bb3bb866e))
* **subplebbits list:** "my communities" list was numbered incorrectly ([961204a](https://github.com/plebbit/seedit/commit/961204a5133bc9f059f1242470e4e31e51d5501e))
* **subscriptions list:** message was missing when no subs are found ([9219029](https://github.com/plebbit/seedit/commit/9219029ac2460a2ac33925f38d99d395de609ce7))
* **subscriptions:** don't immediately remove sub from subscriptions page to let the user re-subscribe ([16b800e](https://github.com/plebbit/seedit/commit/16b800e9018a8bd9d9f7e31516ff330a04119a62))
* **useFeed:** update filter option structure per API change ([020af7a](https://github.com/plebbit/seedit/commit/020af7abe7fd021622135f7033bdac09243126a8))


### Features

* add better errors with button to display full error stack ([1856d99](https://github.com/plebbit/seedit/commit/1856d99a2136dcd2181874cbbcbffe8dcd2b34c1))
* add push notifications to web browser, android app, desktop app ([f08a10a](https://github.com/plebbit/seedit/commit/f08a10a2b347d30076f310edd42ff3bf70fdbd75))
* clicking error copies full error object to the clipboard ([63a5911](https://github.com/plebbit/seedit/commit/63a59115d061c476ee4a2b4c942ba7fcb01ee435))
* **create subplebbit:** automatically set user's own address as owner ([7beb47e](https://github.com/plebbit/seedit/commit/7beb47e09486d2f27feb6c5081a03da28b2e32ea))
* **markdown:** add headers ([8a86655](https://github.com/plebbit/seedit/commit/8a86655324872ae2479c504b2a1f0380811140e8))
* **post page:** add error message from post in reply section ([bc8fb76](https://github.com/plebbit/seedit/commit/bc8fb76f7412e597b61e9c461d54f17db9f6d85f))
* **search bar:** add autocomplete dropdown ([b62f699](https://github.com/plebbit/seedit/commit/b62f699d198d8a7df7937ab1fc62b28dabb3394f))
* **search bar:** add default communities to autocomplete dropdown ([e8251ff](https://github.com/plebbit/seedit/commit/e8251ffd04928130a8b9d63c8c8bfef04c639363))
* **settings:** add account data code editor page ([29c1470](https://github.com/plebbit/seedit/commit/29c147040781edcf875be61a0c27f7dd17f28ac0))
* **settings:** add custom options for thumbnails, media previews, video player ([9742578](https://github.com/plebbit/seedit/commit/974257841b44f6fe4489c08f28dcb03c4cb7e16f))



# [0.4.0](https://github.com/plebbit/seedit/compare/v0.3.0...v0.4.0) (2025-04-16)


### Bug Fixes

* **account bar:** selecting account would not close dropdown ([87e5a03](https://github.com/plebbit/seedit/commit/87e5a030c417c50bfa67728b5e02ab8b7e7b1a4b))
* button image didn't appear instantly when moving the mouse over button ([137f470](https://github.com/plebbit/seedit/commit/137f470b5b23a5b46695c2762c5e64223e0e7877))
* **challenge modal:** user could submit empty answer ([5d0f4f9](https://github.com/plebbit/seedit/commit/5d0f4f958ce217fc8a9cb36782714a33024f1187))
* **electron:** bundle main process to resolve ESM issues in Linux AppImage ([ec989f5](https://github.com/plebbit/seedit/commit/ec989f5e9c040aa8144fced78342138ec56f1c94))
* **electron:** bundle main process to resolve ESM issues in Linux AppImage ([7e7a039](https://github.com/plebbit/seedit/commit/7e7a039f1ea008dcdcd4561fc17c72246b3f3e09))
* **electron:** migrate Electron files to CommonJS for cross-platform compatibility ([6444fb5](https://github.com/plebbit/seedit/commit/6444fb5b063db02cfb9308949ae2cf2b18ccd2df))
* **electron:** replace electron-is-dev with app.isPackaged ([8f7d8e3](https://github.com/plebbit/seedit/commit/8f7d8e32c6905a72a8d772359a5b4b6d50e37b1a))
* **embed:** on tablets, media could appear too small in width ([b1c3b62](https://github.com/plebbit/seedit/commit/b1c3b6232a6ddd095708d6ad668ba84469db8cf9))
* **feed:** newly published post wouldn't appear instantly in feed ([5303825](https://github.com/plebbit/seedit/commit/53038254f5b203f8d31ec0720b9512960ecff5d7))
* **feed:** selecting "controversial" sort would 404 ([456e8b4](https://github.com/plebbit/seedit/commit/456e8b466e9d0b588da92e843f4496975701fb88))
* fix electron ([82022fa](https://github.com/plebbit/seedit/commit/82022fa13c6831b7a2e9f0ddc02ce3ace3aa6fbd))
* **header:** clicking header avatar should always redirect to homepage ([593fd89](https://github.com/plebbit/seedit/commit/593fd8981801adfae8caebe0e046aca7b55c4302))
* **header:** fix mobile submit link ([7b02354](https://github.com/plebbit/seedit/commit/7b023540151b7f62fcd75700888d1d6796cdf23e))
* **header:** preload seedit logo text, so it switches to dark version immediately when changing theme ([5a87391](https://github.com/plebbit/seedit/commit/5a873915b37857f70f1f55d457adc9385fd6a2e6))
* **header:** some titles and links were bugged ([22e676e](https://github.com/plebbit/seedit/commit/22e676e539178f73510c0a2dfa35e8ba8127a47e))
* **header:** subplebbit address could fail to appear as title while subplebbits loads ([88da3f5](https://github.com/plebbit/seedit/commit/88da3f594bd1786d4d49cd4ec7fb05694894e081))
* **home:** no subscriptions message wasn't showing, after removing all subscriptions ([4e8db71](https://github.com/plebbit/seedit/commit/4e8db715418bced0cebabc0b5fad3242d6868f73))
* **inbox:** "show parent" button didn't work ([fa438fd](https://github.com/plebbit/seedit/commit/fa438fd9487b31414d1c236aa16a807878d48738))
* **media:** expanded media could appear behind sidebar, on tablet screen size ([afcacc7](https://github.com/plebbit/seedit/commit/afcacc7ef49faf2c3493f58f18730c82271490e0))
* **package.json:** downgrade typescript to fix linter warning ([d812d9c](https://github.com/plebbit/seedit/commit/d812d9c9de1c9953f93e8a63cf99906bb3926b6e))
* **pending post:** join button wasn't rendering in sidebar ([909186f](https://github.com/plebbit/seedit/commit/909186f10fe33d4f9559825863c32ecb4467acd5))
* **post:** context and permalink views wouldn't load comments properly ([f5172b0](https://github.com/plebbit/seedit/commit/f5172b04dda5d8899c4bf0fd245972e1582d2893))
* **post:** post context view should automatically scroll to post ([39c6f50](https://github.com/plebbit/seedit/commit/39c6f50bdcc407907e82e6f5112d0e754a4d6708))
* **post:** post without content nor link could have redundant padding from empty expando ([797f6ff](https://github.com/plebbit/seedit/commit/797f6ff70892531246f73e011c6ed204adedcaae))
* **profile page:** comments could appear after failing to load ([70ea094](https://github.com/plebbit/seedit/commit/70ea09411ccf63e95d51244b505f099ac495f2e2))
* **profile page:** links to user profiles from comments view were broken ([645638b](https://github.com/plebbit/seedit/commit/645638b10fad19adabcfe19c4851d77dce9ba401))
* **routing:** applying invalid sort types or time filter names should redirect to not found page ([f642aa6](https://github.com/plebbit/seedit/commit/f642aa659b819879d61b1b09398504a5b9c6b815))
* **submit page:** don't render subplebbit address dropdown if no matches are found ([b2f71a6](https://github.com/plebbit/seedit/commit/b2f71a69f036dc113d81f70a7949b7c1496d82d8))
* **submit page:** fields would unnecessarily reset when navigating away from page ([03383d7](https://github.com/plebbit/seedit/commit/03383d7231d471e6e035fb4d2a6629736c38a0c4))
* **thumbnail:** show link icon if media 404'd ([972b819](https://github.com/plebbit/seedit/commit/972b819f56b194013b23909b3253afaeade11773))
* **topbar:** position "more" link at rightmost end of the topbar ([f164ae1](https://github.com/plebbit/seedit/commit/f164ae1a692eb365937d699c2db2ebde943b421e))


### Features

* add domain view ([83a02f3](https://github.com/plebbit/seedit/commit/83a02f3471c0a7bdedd4001a1a0086b2f7fbe5a6))
* add filters dropdown from topbar, for easy access on mobile ([787bb6b](https://github.com/plebbit/seedit/commit/787bb6b982459f025e01336a1286e18f4e79e4da))
* **comment edit:** if the user manually types "edit: " at the end of an edit, parse it as comment.edit.reason ([10b4ea8](https://github.com/plebbit/seedit/commit/10b4ea84eb09ca1e5896db2ba082269ecc2c5d72))
* **embeds:** add PDF support for direct links and pdf file upload ([ee37b49](https://github.com/plebbit/seedit/commit/ee37b49d886c7d5bb08e5539268b7acf03bf8c34))
* **markdown:** add code blocks ([7921ca5](https://github.com/plebbit/seedit/commit/7921ca523ede481e708413c460cd1cee1af4db2a))
* **markdown:** add spoiler text ([ef1dd0f](https://github.com/plebbit/seedit/commit/ef1dd0f9910bb1001a32d89ff647aa4b6b166955))
* **profile:** add post karma count to account bar, start post count with 1 like on reddit ([8f48a92](https://github.com/plebbit/seedit/commit/8f48a925cd123999f9e5b36a0bb53a0303d6d29e))
* **search bar:** add function to search for posts in the feed ([d0bf172](https://github.com/plebbit/seedit/commit/d0bf1721f8eb7d84d0539f2459c11765bda3e395))
* **search bar:** search posts in current feed by query, highlight post titles matching result ([d4fc8bb](https://github.com/plebbit/seedit/commit/d4fc8bb822c7e889c70f032fab1a22f78d97c8fb))
* **settings:** add "content options" page, add option to hide all default subs from topbar ([32a643e](https://github.com/plebbit/seedit/commit/32a643e21ce63f1d294c82b832c11b7d5bae1a29))
* **submit forms:** add "preview" button to let the user quickly check how the markdown will render ([bf118e7](https://github.com/plebbit/seedit/commit/bf118e7ac8cffcda89d2ae72ac15f40b274a8d72))
* **submit page:** add formatting help ([c5b952f](https://github.com/plebbit/seedit/commit/c5b952ff37a6b3a1790fc7639eef440af760a907))
* **submit page:** add media file upload ([dc43aeb](https://github.com/plebbit/seedit/commit/dc43aeb9932dd98cd21ee8499db38ae8526fd975))
* **subplebbit settings:** add formatting help ([a4333aa](https://github.com/plebbit/seedit/commit/a4333aa1c39d8a4123fab5c5134d91d4396691ef))
* **time filter:** remember time filter selection during session ([1b4b5cf](https://github.com/plebbit/seedit/commit/1b4b5cf213df73e0217ec7c7f28dc9b226a1c21e))
* **topbar:** show subscriptions before other addresses ([f59c58a](https://github.com/plebbit/seedit/commit/f59c58af337a3e2f7ccc6631b023790d53bce947))


### Performance Improvements

* **expando:** lazy load Embed component for iframe embeds ([8c854f4](https://github.com/plebbit/seedit/commit/8c854f4a02a89564932ecc248ba50d8a46efa571))



# [0.3.0](https://github.com/plebbit/seedit/compare/v0.2.5...v0.3.0) (2025-03-17)


### Bug Fixes

* **account bar:** new account could display u/undefined for a split second ([2904187](https://github.com/plebbit/seedit/commit/2904187c75e63b7b8a5c2a0bfe8d23ce3d664113))
* **account settings:** creating new account didn't automatically switch to it ([e2c5e38](https://github.com/plebbit/seedit/commit/e2c5e389f4357645978dacaf0c7f975af043d67d))
* **account settings:** importing an account file would not automatically select the imported account ([dd2d15c](https://github.com/plebbit/seedit/commit/dd2d15c440a478be3068780c9a10c182dcff6b0d))
* **author page:** page could look empty without "no posts" notice ([12fabd0](https://github.com/plebbit/seedit/commit/12fabd08d71169882b23b2cce5df936e08e8f7cf))
* **avatar settings:** timestamp default value was missing ([27f54a0](https://github.com/plebbit/seedit/commit/27f54a049bba670cfdbeeb434d9aab851d113c8a))
* **challenge modal:** user could submit empty answer ([f952044](https://github.com/plebbit/seedit/commit/f9520447e094151ac9082c0f71b18c44f199fb8f))
* **challenge settings:** changing exclude options would add invalid types causing saving error ([3f26a04](https://github.com/plebbit/seedit/commit/3f26a04ed44f9044f34c265d1a58055883fea12d))
* **feed:** invalid sortType should navigate to "not found" page ([ef84811](https://github.com/plebbit/seedit/commit/ef84811e5963fab93a54082655f07d34dc9dcd9c))
* **home:** feed could show no subscriptions alert for a split second ([9c2ec09](https://github.com/plebbit/seedit/commit/9c2ec095950d206245709cd3ccd556b3b74161d8))
* **label:** remove left padding for first visible label in array ([336fc67](https://github.com/plebbit/seedit/commit/336fc6726da0fdf9efd64965a7b14d6dfbeffda3))
* **label:** spacing was off ([763d744](https://github.com/plebbit/seedit/commit/763d7446656b0feeb1e40812d93ddfd20968c943))
* **mobile:** dropdown items should have enough padding on mobile to make it easy for the user to tap on them ([6ebdeb7](https://github.com/plebbit/seedit/commit/6ebdeb78d59a75b49146214a5a99672b19ed61eb))
* **moderation:** mod reason couldn't be removed ([c5fb295](https://github.com/plebbit/seedit/commit/c5fb2956592c8627da27139ec6a55a7db457888d))
* **offline indicator:** sub could be marked as offline even if online, consider it offline if it doesn't update for 2 hours instead of 1 hour ([a8fb2e6](https://github.com/plebbit/seedit/commit/a8fb2e6bda6d1de24f9d34613d848b5b85be2659))
* **pending post:** invalid pending post index would break the view, redirect to not found instead ([3a9d89b](https://github.com/plebbit/seedit/commit/3a9d89b2df704446a7ea4463faf8040a73ae467f))
* **pending post:** page could redirect to "not found" if pending post failed ([12daa03](https://github.com/plebbit/seedit/commit/12daa0314603d9c7b83b413c1f54f7c67482714c))
* **pending post:** pending post would appear in profile page instead of post page ([14e0fb8](https://github.com/plebbit/seedit/commit/14e0fb80251e5dc11f1ccc4fbcaa140c00de0dc0))
* **post page:** "there doesn't seem to be anything here" could appear while replies were still loading ([809d651](https://github.com/plebbit/seedit/commit/809d6515a21ef2a96234de36b513f14a04cb200b))
* **post:** post content wouldn't be expanded by default in pending post page ([f84a6ce](https://github.com/plebbit/seedit/commit/f84a6cea8dc1aba93e89270cf8e92f0720c2f9d7))
* **post:** post rank number could appear in profile page ([d0a4316](https://github.com/plebbit/seedit/commit/d0a4316e0ca649ef9b29142f84283e5d7283f73e))
* **post:** undistinguish mod post by default, unless stickied ([b858f17](https://github.com/plebbit/seedit/commit/b858f17aaadbc9eab799749343af906cebc11f4b))
* **replies:** replies published by account could appear at the bottom of the reply section by default ([d0765c3](https://github.com/plebbit/seedit/commit/d0765c3b4e4e518aac10c7fb41de44ab29fa9d53))
* **search bar:** use gpu acceleration for popup animation ([5b75d44](https://github.com/plebbit/seedit/commit/5b75d4478fed693eba67b5aed6e824c6a1f56efb))
* **settings:** saving plebbit options could return api schema error ([e7ec01b](https://github.com/plebbit/seedit/commit/e7ec01baad304d355cc56b4cb656365f1d332cb7))
* **sidebar:** blocking or unblocking sub wouldn't reset feed ([67d2ca8](https://github.com/plebbit/seedit/commit/67d2ca86a7bbfcd10aa7ed0921f4fb4cfbf41629))
* **sidebar:** subplebbit title and description could render as empty strings ([eb560db](https://github.com/plebbit/seedit/commit/eb560db870249a7bd7107241113138b72f2d9428))
* **subplebbit settings:** error wouldn't show after attempting to save changes incorrectly ([2e2d8ca](https://github.com/plebbit/seedit/commit/2e2d8ca351280389ab152cc709555baefa3420e7))
* **subplebbit settings:** excluding more than one user address from challenges didn't work ([30da6c7](https://github.com/plebbit/seedit/commit/30da6c770d95773a66047b5769896afc426f1287))
* **subplebbit settings:** removing exiting logo couldn't work because of API schema error ([4c1ad1d](https://github.com/plebbit/seedit/commit/4c1ad1d022d300e5a18bdb18978b3ed676d39381))
* **subplebbit settings:** reset previous error when saving ([550ddb1](https://github.com/plebbit/seedit/commit/550ddb18854f87b79af10c2fe95442d4db3667b3))
* **subplebbit settings:** reset previous error when saving ([f6241c5](https://github.com/plebbit/seedit/commit/f6241c5ddad556435cc77458c2587a563ccac5cd))
* **subplebbit sidebar:** moderators list could be empty ([0b83991](https://github.com/plebbit/seedit/commit/0b8399153870b861e7bf0de5a775259e67166ea8))
* **subplebbits list:** remove categories, subplebbits should be sorted by rank (via future pubsub voting) ([533b6ec](https://github.com/plebbit/seedit/commit/533b6ec30b1353a2bd8562ee2a68389af133a787))
* **user page:** account age was imprecise ([92b19c4](https://github.com/plebbit/seedit/commit/92b19c472f4202a28c44cc050bd5e0943ac0bb03))


### Features

* auto subscribe new accounts to specific default subplebbits ([fa24e73](https://github.com/plebbit/seedit/commit/fa24e73c6cfd65ff8b1e1da6284d8ffd9935bc8b))
* auto-subscribe to newly created communities ([c077685](https://github.com/plebbit/seedit/commit/c0776854f9bcdef01f24161905c7e95cf95b1017))
* **challenge modal:** close with escape key ([66a766b](https://github.com/plebbit/seedit/commit/66a766bbbbf90e62e279829fe953ff69346c310d))
* **embed:** add support for soundcloud albums ([fb18e3d](https://github.com/plebbit/seedit/commit/fb18e3d95446d5bd4fcca544bec78ed6281ad78d))
* **embed:** add support to youtube shorts, invidious instances ([02d061d](https://github.com/plebbit/seedit/commit/02d061da17b25e292f851aaa0720a85561c68a55))
* **footer:** display "loading feed" and then "looking for more posts" because it's more user-friendly, moving the mouse over displays the backend state ([c471317](https://github.com/plebbit/seedit/commit/c47131788d9dfdea48b18dd508c05de23a131e18))
* **home:** only include posts from subplebbits the user is subscribed to ([824f05c](https://github.com/plebbit/seedit/commit/824f05c140975294f825b946bba7febcde4c597a))
* **home:** show message linking to p/all when user has 0 subscriptions ([afa1e3f](https://github.com/plebbit/seedit/commit/afa1e3ffae1334902df07e3d6295d67bc23efc80))
* **post edit:** mark comment as "nsfw" ([c3691e8](https://github.com/plebbit/seedit/commit/c3691e8c5f168af75469edf1888ca587d8d3a74d))
* **post page:** show "are you over 18?" warning if post is from sub tagged as nsfw ([a2d3e22](https://github.com/plebbit/seedit/commit/a2d3e22372631b72a5f170917c671c7a2ba5a7d8))
* **post:** add video duration in thumbnail ([ab9ca95](https://github.com/plebbit/seedit/commit/ab9ca95faaa923f51f7e5cc37f06713f72700293))
* **replies:** add sorting by new, old or top ([97c990e](https://github.com/plebbit/seedit/commit/97c990ef1719f16b5b44f8f810dfef704dfab33b))
* **replies:** implement "best" sorting algo from reddit, instead of simply "top" (by score), ensure stickied comments always appear at the top ([31058ca](https://github.com/plebbit/seedit/commit/31058cabb96cd32790910663612976e7dd7aabb3))
* **replies:** sort account replies by new for 30 mins after page visit ([6117b82](https://github.com/plebbit/seedit/commit/6117b82432dab05c123810568dfcfe9f6205c3ea))
* **sidebar:** display moderator/owner/admin status of account, if any ([2a9eb26](https://github.com/plebbit/seedit/commit/2a9eb260a31ce335ea30b7919246d0c6c618426f))
* **subplebbit settings:** let user change default challenge when creating a sub ([76fe6a9](https://github.com/plebbit/seedit/commit/76fe6a9f0be881fdba397e40e32a6c82355726bd))
* **subplebbit sidebar:** add link to read-only subplebbit settings ([2a34ec6](https://github.com/plebbit/seedit/commit/2a34ec62639eb0abbedcdcf0069eae055c6c3c0d))
* **subplebbits list:** add infobar for filtering by tag, undo, prevent filtering by invalid tag ([9051bfa](https://github.com/plebbit/seedit/commit/9051bfa4373e485f10f701d2823908d723284801))
* **subplebbits list:** add nsfw label to nsfw-tagged subs ([f18dad4](https://github.com/plebbit/seedit/commit/f18dad4736db53770c1a0fb696efcb89010a19ba))
* **subplebbit:** show unblock button in feed for sub that was blocked by user ([3b7739f](https://github.com/plebbit/seedit/commit/3b7739f0ce2624e37ba438b27e118a53022a5b39))


### Performance Improvements

* **feed:** debounce state string to prevent unnecessary rerenders ([9b86e34](https://github.com/plebbit/seedit/commit/9b86e349fa6c6173329f266713f4ed69f450977d))
* **home feed:** reduce footer rerenders ([c510345](https://github.com/plebbit/seedit/commit/c510345ca35bae15908373bed2677537409a52b0))
* remove unnecessary API fetching ([cd09fe0](https://github.com/plebbit/seedit/commit/cd09fe0cc3aa70e471fa92650d6bc8c359b41038))
* **topbar:** optimize scroll up/down animation with GPU acceleration ([fbd46cb](https://github.com/plebbit/seedit/commit/fbd46cb6abdecc59d31d7ed0e7b7782f65cd0679))


### Reverts

* Revert "add http domain to let users test an insecure plebbit rpc" ([afdc02a](https://github.com/plebbit/seedit/commit/afdc02ac96818832b481dfa62a95248c67ecc574))



## [0.2.5](https://github.com/plebbit/seedit/compare/v0.2.4...v0.2.5) (2024-12-19)


### Bug Fixes

* **feed post:** gif thumbnail could break persistently ([2e86b3f](https://github.com/plebbit/seedit/commit/2e86b3f2afe6d94a093f4e14320ae95f1bb50332))
* **header:** special page title goes on top of header tabs, unlike a community's title ([61e7c1d](https://github.com/plebbit/seedit/commit/61e7c1d92c4d8925253513d34275bfc5d1188f57))
* **post:** format score with abbreviation ([6ce7fa9](https://github.com/plebbit/seedit/commit/6ce7fa9c365189fd4c47c98a0af033052e68f4a7))
* **post:** subscribe button wrapped incorrectly ([9d20cc8](https://github.com/plebbit/seedit/commit/9d20cc81d0f0a346ad2976f521fe008467c7e99e))
* **profile:** keep showing the welcome info bar for the first few visits ([d313a68](https://github.com/plebbit/seedit/commit/d313a68003d78a03be5e1bd66dd370341e0b51ff))
* **settings:** "check for update" button didn't include apk case, now it can download the latest apk ([8399174](https://github.com/plebbit/seedit/commit/8399174914ce5dcf8d5cb60868efbb21cac7d58b))
* **spoiler:** spoiler could appear bugged for posts with no content nor link, black background was too large ([6ac1777](https://github.com/plebbit/seedit/commit/6ac1777475d17327f31b6b6900e5f05a74b45490))
* **submit page:** could return error 'publishCommentOptions.content is an empty string' ([589f4bf](https://github.com/plebbit/seedit/commit/589f4bf073a2e088f6d15a0c336fdc8ca9e8d726))


### Features

* add blur for nsfw media or spoilers ([2829e50](https://github.com/plebbit/seedit/commit/2829e50d06155b37c2f762ec6030eb31dcca2bf2))
* add p/mod feed for communities the user is moderating ([6ec4f57](https://github.com/plebbit/seedit/commit/6ec4f57894928e7ddabe3d27bad1a4279dd3b3dd))
* **feed:** add numbered row to count posts ([84b1013](https://github.com/plebbit/seedit/commit/84b1013c894dff2a8d26bed8fb0f3b1d4d69df5b))
* **post:** add nsfw label and thumbnail ([a1b64f4](https://github.com/plebbit/seedit/commit/a1b64f4296955c6bde4157e1cf5426eebd1c073d))
* **post:** add spoiler thumbnail ([851e0e8](https://github.com/plebbit/seedit/commit/851e0e8039e82312377a00ebd35186b49d862b55))
* **post:** align all posts by fixed thumbnail width and using thumbnail icons for links without media or text-only posts ([72d77fa](https://github.com/plebbit/seedit/commit/72d77fa365efd7fc9be0e74feb9c0f2144e7f37a))
* **reply:** add colored "submitter" "[S]" next to user name if reply author is also the post author ([59f1f1b](https://github.com/plebbit/seedit/commit/59f1f1b572fb1f53d70458800c8497fd4bbc9f09))
* **settings:** add nsfw filters and filtering community by nsfw tag ([5a078e7](https://github.com/plebbit/seedit/commit/5a078e772de0fcd7e91f2f220771cbf1ece16e9b))
* **subplebbit:** show "are you over 18?" alert on communities tagged as nsfw ([76a6fc6](https://github.com/plebbit/seedit/commit/76a6fc69b5bc650222de7a68130c766de2eb8f37))


### Performance Improvements

* **index.html:** preload UI assets and CSS ([79423c3](https://github.com/plebbit/seedit/commit/79423c31d710c45f4cfcdfb0908fe1a16c1d4cbf))
* **media:** fix thumbnails getting stuck due to incorrect memoization ([9ff01c3](https://github.com/plebbit/seedit/commit/9ff01c33c6fa04c5d9c70e7c37aa5b035a8cd8bb))



## [0.2.4](https://github.com/plebbit/seedit/compare/v0.2.3...v0.2.4) (2024-12-09)


### Bug Fixes

* **electron:** auto restart script more reliable ([97221d6](https://github.com/plebbit/seedit/commit/97221d665d128b04eeb6a6847e1e94e29332f9f7))
* **electron:** ipfs proxy should have error status code ([c66d454](https://github.com/plebbit/seedit/commit/c66d45437356befee8296af4b361c253c486ce26))
* **subplebbit settings:** editing subplebbit challenge wouldn't work, fix loading state of settings, remove useless challenge setting when creating a sub, improve translations ([654b427](https://github.com/plebbit/seedit/commit/654b4277d8dfc91b8501eaffd3549c1580f72fa7))



## [0.2.3](https://github.com/plebbit/seedit/compare/v0.2.2...v0.2.3) (2024-12-06)


### Bug Fixes

* **avatar settings:** add timestamp field to let users add existing signature ([4263b44](https://github.com/plebbit/seedit/commit/4263b44458d42bf7e3748d314d48923f67bdea2d))
* **ellipsis animation:** dots could appear cut off and cause displacement changing width of string ([448673d](https://github.com/plebbit/seedit/commit/448673dd5b54f9ca1f08b4fab03a08a8cf698e0f))
* **feed:** posts could change position causing displacement ([ecf6a7b](https://github.com/plebbit/seedit/commit/ecf6a7b39da12442270d8de2fb4a27093fbb599c))
* **header:** seedit logo should show in subs without their own logo ([61c9f30](https://github.com/plebbit/seedit/commit/61c9f3061839d9112085001a4c7933d05a2b1961))
* **markdown:** links in post content would not open new tab ([4d30ad1](https://github.com/plebbit/seedit/commit/4d30ad14fbe906b011c2a66ac31654a76f0d1651))
* only show data path setting on electron ([8db2c15](https://github.com/plebbit/seedit/commit/8db2c15f4a33b1d603aea758c7c89e583361f33f))
* **plebbit options:** schema error prevented to save ([dc3dddf](https://github.com/plebbit/seedit/commit/dc3dddf410376874470c5e897189f67d280d1b44))
* **post page:** loading text could cause horizontal scroll on mobile ([580a598](https://github.com/plebbit/seedit/commit/580a5989df55c613e5a8f0c6cf2336ba230af298))
* **post:** editing comment content didn't work ([540d4c7](https://github.com/plebbit/seedit/commit/540d4c7f9b619255fb5e2b5ad97cca980e733089))
* **reply form:** only show offline info message if the user clicks on textarea ([221dab8](https://github.com/plebbit/seedit/commit/221dab8e83f75290e2073a0775350568649b9dd5))
* **reply:** pending edit label appeared cut off ([a02ed8f](https://github.com/plebbit/seedit/commit/a02ed8f1163ca311a6137c3001a7d2402184d2cc))
* **settings:** crypto address setting would show error for an already set address ([9f73a49](https://github.com/plebbit/seedit/commit/9f73a49822fe7c3808f241777913af45fba88f87))
* **sidebar:** moderator tools wouldn't appear in post page for sub owner who is not mod ([faf1718](https://github.com/plebbit/seedit/commit/faf171848eff5530f8cb11f22aa76e77bced2d50))


### Features

* **electron:** add http routers to electron ([69726e1](https://github.com/plebbit/seedit/commit/69726e1b97ca90f34c2d06ff1709bdb207a2e93d))
* **post:** updated design for deleted/removed replies to be more like old.reddit ([6beb8b3](https://github.com/plebbit/seedit/commit/6beb8b30a2616154a5d6f779c38efe473497780b))
* **settings:** add http routers setting to plebbit options ([cfe004c](https://github.com/plebbit/seedit/commit/cfe004cf07614f523fe5788d508bc23dc7218ef3))
* **settings:** add option to hide avatars from replies ([b8ebef0](https://github.com/plebbit/seedit/commit/b8ebef0c6e11055bafdf059c0bae20f80499fbf0))



## [0.2.2](https://github.com/plebbit/seedit/compare/v0.2.1...v0.2.2) (2024-11-11)


### Bug Fixes

* **post:** content would not appear if link is webpage ([a2516b5](https://github.com/plebbit/seedit/commit/a2516b59122c41cf333102aa97de2c882ac2ee9f))
* **post:** expand button didn't appear for text with webpage link ([80fcc58](https://github.com/plebbit/seedit/commit/80fcc5870dc14f61ada7054bd5b22ee8cebb8d73))
* **sidebar:** 0 score would show up as '•' ([5785e0b](https://github.com/plebbit/seedit/commit/5785e0bbe16006ef342bc936bbc353f49ee01018))


### Features

* **home:** improve design of "show more posts" button in feed footer ([e5fd224](https://github.com/plebbit/seedit/commit/e5fd22488f05e76d03aa5dbb04bd1b366680c8df))



## [0.2.1](https://github.com/plebbit/seedit/compare/v0.2.0...v0.2.1) (2024-11-10)


### Bug Fixes

* **moderation:** update to use new API schema ([5e1902f](https://github.com/plebbit/seedit/commit/5e1902fab3d5bf5c5fa27413e231f756025b51c2))
* **post:** expand button would appear for webpage thumbnails ([fddea3e](https://github.com/plebbit/seedit/commit/fddea3e5c13979ee9f18375702bfb611a650aa72))
* **post:** thumbnails would get stuck when navigating ([b3b39f1](https://github.com/plebbit/seedit/commit/b3b39f19fbf4f402ce8a57a79cc4861c654e19b2))



# [0.2.0](https://github.com/plebbit/seedit/compare/v0.1.17...v0.2.0) (2024-11-08)


### Bug Fixes

* **profile:** return 'not found' for non-existent pending comments ([9eacdc5](https://github.com/plebbit/seedit/commit/9eacdc583acce0932c3178be85173164c163ea15))


### Features

* **subplebbit:** show published comments instantly in feed ([4b715c5](https://github.com/plebbit/seedit/commit/4b715c52ab403557966acfa0e0a28117d4df1013))



## [0.1.17](https://github.com/plebbit/seedit/compare/v0.1.16...v0.1.17) (2024-10-29)


### Bug Fixes

* **header:** sort buttons were displaced on android ([59d0c60](https://github.com/plebbit/seedit/commit/59d0c60aabbf13cc6a9569f5a5bca3d3efd8fb88))
* **home:** auto time filter didn't show posts from last visit ([aaa34b7](https://github.com/plebbit/seedit/commit/aaa34b797bb4f24a6e88b4880b8bbab11047e260))
* last visit time filter could show 'not found' page ([5d859cb](https://github.com/plebbit/seedit/commit/5d859cb0fb1130add0b6147e3565cd17b2ecb77a))
* **release.yml:** wrong java version prevented apk build ([f87bb1f](https://github.com/plebbit/seedit/commit/f87bb1fbe058ed8dc1ab9d58f42ab60c84b8b19d))
* **router:** a link could include '%23' instead of '#' ([ae87561](https://github.com/plebbit/seedit/commit/ae875616527bd96a813b92b81c35c48313f32a4f))
* **search bar:** fix overflow of text behind button, button resolution ([c5406f2](https://github.com/plebbit/seedit/commit/c5406f2a9b0281059286f5b1bd3fe24cee2b1154))


### Features

* **homepage:** add about page for FAQs and welcoming users ([1a245b5](https://github.com/plebbit/seedit/commit/1a245b5164092df671af57811aa7fdc1ba534848))
* **profile page:** clicking "(edit)" next to display name redirects to setting and highlights it ([aa242c3](https://github.com/plebbit/seedit/commit/aa242c3dfa3332a5a4620645c59c8a4a478dc3ae))
* **profile:** on first access, link to useful preferences and highlight them ([557db8c](https://github.com/plebbit/seedit/commit/557db8c2291d64fe7a37876af00be8338018d03e))



## [0.1.16](https://github.com/plebbit/seedit/compare/v0.1.15...v0.1.16) (2024-10-23)


### Bug Fixes

* **android:** icon was too big ([6f3b721](https://github.com/plebbit/seedit/commit/6f3b72148d6422d0b3c083d12ed0ed1a61e92e17))
* **electron:** "ipfs warning" without error message would appear after closing the desktop app ([faa33f0](https://github.com/plebbit/seedit/commit/faa33f08bfe0d26c6028a6a2a80c4aec12e9b53e))
* **electron:** isElectron flag was missing ([3a39eda](https://github.com/plebbit/seedit/commit/3a39eda7e6ef8b1d04bbec17ef1fea07d9aa1d2c))
* **embed:** reddit links have to include '/comments/' to be embeddable ([1dd2a4c](https://github.com/plebbit/seedit/commit/1dd2a4c2fd82c724dfc85bb9ab905065155c3606))
* **package.json:** add resolution for skia-canvas ([0d23bdb](https://github.com/plebbit/seedit/commit/0d23bdb1bb5dd6d3d4421b0cc44eea7e0158bab3))
* **post:** confirm dialog for delete button wasn't working ([4aa54a5](https://github.com/plebbit/seedit/commit/4aa54a5c0c866e922f657ee5d1a22257abecf4de))
* **post:** don't show author edit reason if post is deleted or removed ([6017ac2](https://github.com/plebbit/seedit/commit/6017ac24194938ae67c8cd30d1ce7f77cbccbfd6))
* **post:** reason field for author edit didn't work ([808a388](https://github.com/plebbit/seedit/commit/808a3889bde3d0ac179bcab3f532dd3223c37b27))
* **post:** score should show '•' if backend state is not 'succeeded' ([a438daf](https://github.com/plebbit/seedit/commit/a438daf71f3910608ad953536897052a3388b3d5))
* **post:** score should show "?" while loading ([7f8dc16](https://github.com/plebbit/seedit/commit/7f8dc1696b82d1b6052d5aeabae5c82cc92372d4))
* **post:** webpage thumbnail was rendered as image from direct link ([9678613](https://github.com/plebbit/seedit/commit/9678613ff3b25f917c292bcb08b8d7e9198e000f))
* **reply:** permalink button could be clicked while post is pending ([ccdacfe](https://github.com/plebbit/seedit/commit/ccdacfea32cd59472ddc4d62d2f3c4064588fbff))
* **submit page:** don't link to subplebbit page from title unless the selected address is valid ([4d6ea70](https://github.com/plebbit/seedit/commit/4d6ea7091a675ddf6bbd84526752a7447699c0bd))
* **submit page:** dropdown would stay opened and focused after selecting sub with keyboard ([8ffa0d4](https://github.com/plebbit/seedit/commit/8ffa0d4fd0e9f26b2093d8d622655184434cc06e))
* **submit page:** hitting enter key wouldn't select address in dropdown ([bb92bd0](https://github.com/plebbit/seedit/commit/bb92bd0107105c0178b214b610305aabb0cfef5b))
* subplebbit description showed too much space between lines ([906bb31](https://github.com/plebbit/seedit/commit/906bb31d12d4c2d72db586a3ff38b429a470d1a0))
* **subplebbits:** online/offline status of each sub would reload from scratch each time it was viewed ([b90d0fb](https://github.com/plebbit/seedit/commit/b90d0fbf385da311705ed10b4bd38768b964ef5b))


### Features

* **account settings:** alert user account is stored locally and specify location ([d328c5c](https://github.com/plebbit/seedit/commit/d328c5c2772050a523e3485b3c31153edd1d08e7))
* **embed:** add support for youtube playlists, music.youtube links ([c4d93fb](https://github.com/plebbit/seedit/commit/c4d93fbf31312ac0cc404dc76476f5529c739a76))
* **feat:** add automatic last visit time filter ([6823232](https://github.com/plebbit/seedit/commit/6823232a9c4ca4aaa99f316bfffc77d3eda6dd9b))
* **feed:** show alert to help user change time filter if there aren't enough posts ([35febb2](https://github.com/plebbit/seedit/commit/35febb2ee25c1b5e1603d657b743d7492b57a262))
* **post:** add client-side thumbnail fetching for webpage links from sites with CORS access ([b3bbb9c](https://github.com/plebbit/seedit/commit/b3bbb9c04d88a75d2956d606a8023bf6120964e9))
* **profile:** add info message about account, on first access ([6ddb4d7](https://github.com/plebbit/seedit/commit/6ddb4d7928d57b8e4d8292ba4b7993a33849eb0f))
* **profile:** show info bar about newly created account on profile first access ([9b701a5](https://github.com/plebbit/seedit/commit/9b701a559f9ee2457f01dbc0d784bff446c69865))
* **reply form:** alert user the subplebbit might be offline before publishing reply ([58218a7](https://github.com/plebbit/seedit/commit/58218a7a0c0a5e708a300323ae3259a61ab8dec2))
* **sidebar:** add info next to red dot for offline subs without last update timestamp ([5da4c02](https://github.com/plebbit/seedit/commit/5da4c02bc35acc95aaa9257d5512545ff85d34a7))
* **submit page:** alert user if selected subplebbit might be offline ([7e565ab](https://github.com/plebbit/seedit/commit/7e565ab9fced4d105b0c0f28fa8db5defe579d59))
* **subplebbit:** inform user about time filter if active ([352a74f](https://github.com/plebbit/seedit/commit/352a74f24c9cc599a5a9ec06bdff398e11d92e43))


### Performance Improvements

* **gifs:** cache first frame so gifs don't reload all the time when navigating ([e1c02cd](https://github.com/plebbit/seedit/commit/e1c02cdf8f60c9373c87f0fdac0b40d31e9255d1))
* **post:** optimize post history resource consumption with memoization, virtualization, pagination, routing ([9434a17](https://github.com/plebbit/seedit/commit/9434a175397c9b442a2b38089ed5852a15770736))



## [0.1.15](https://github.com/plebbit/seedit/compare/v0.1.14...v0.1.15) (2024-09-09)


### Bug Fixes

* **electron:** download url redirect status code changed ([bb94bdf](https://github.com/plebbit/seedit/commit/bb94bdf5f67b8d048bddffaebad94b452a1e8b1c))
* hiding/blocking comments wouldn't work because useBlock takes cid, not address ([e459132](https://github.com/plebbit/seedit/commit/e4591320a43f1f2ea74b315d251f33ff9f572989))
* **import account:** reload after import to ensure rpc starts ([a5f5d24](https://github.com/plebbit/seedit/commit/a5f5d24624e7b668f0cb6a06b2aa3b0830f93870))
* **offline indicator:** change last online check from 30 to 60 minutes for a better estimate ([dbb91bf](https://github.com/plebbit/seedit/commit/dbb91bf16c1eb7d23db07f2016f504b1b543ad03))
* **topbar:** always show 'my communities' link ([5a96239](https://github.com/plebbit/seedit/commit/5a96239053cf1ac64d240c4fa9e5091c9f4b98f6))


### Features

* add 'new posts' button to refresh feed and scroll to the top ([0077df0](https://github.com/plebbit/seedit/commit/0077df01a125c885cddbf136aa9446948ca082c4))
* **profile:** add 'hidden' tab and feed for blocked comments ([911fa76](https://github.com/plebbit/seedit/commit/911fa767c5295bfdcc3b7d222352d1f9a2138609))
* **public:** add redirect.html ([2ad3879](https://github.com/plebbit/seedit/commit/2ad3879fd2a87054dbb2842798247f34cdc3e860))
* **search bar:** alert 'invalid subplebbit address' if the user forgot to type the tld ([f4798f3](https://github.com/plebbit/seedit/commit/f4798f304c52572495dc64d8ce7d495b676e170f))
* **settings:** add functionality to plebbit options settings ([fe49694](https://github.com/plebbit/seedit/commit/fe49694458272f56eff7446255ffaf8e69f6ff6c))
* **subplebbit settings:** when first creating a sub, show the captcha challenge already set as default ([ea7853b](https://github.com/plebbit/seedit/commit/ea7853be63a9f7604ce579d7469ad09885b2ebc8))
* **subplebbit:** display error near state string in feed ([a40442d](https://github.com/plebbit/seedit/commit/a40442d785eed15563dd9865e5bdd1720d80aee8))


### Performance Improvements

* **profile:** too many comments could load at the same time ([2295599](https://github.com/plebbit/seedit/commit/2295599a20e8ff3477849f6a1996617484fd291e))



## [0.1.14](https://github.com/plebbit/seedit/compare/v0.1.13...v0.1.14) (2024-05-22)


### Bug Fixes

* **loading state:** position was bugged on post page and it wouldn't render on state 'failed' ([f40665d](https://github.com/plebbit/seedit/commit/f40665dc5cec28cdc859c5dc1f83f1aa6adecb1c))


### Features

* add plebchan mascot to 'page not found' ([bb8ed53](https://github.com/plebbit/seedit/commit/bb8ed53105eeade01ca13b54cc0cddafd05bfa78))
* **app:** return 'not found' for invalid pending comment indexes, subplebbit addresses and CIDs ([bc84faf](https://github.com/plebbit/seedit/commit/bc84faf43968f7c15fd2d9ce55e72d0b2bb1d6c8))
* change default communities order to respect category (plebbit, interests, random, projects, international) ([5b05e2a](https://github.com/plebbit/seedit/commit/5b05e2a547f10956d85aa080f037b1ad603ac4e7))
* exclude nsfw communities from the default list (hide nsfw posts in home) ([e978654](https://github.com/plebbit/seedit/commit/e978654dbf00bc30523c172240a75c879ead162e))



## [0.1.13](https://github.com/plebbit/seedit/compare/v0.1.12...v0.1.13) (2024-05-06)


### Bug Fixes

* **embed:** pass origin to youtube because popular videos won't load without it ([4d60d9b](https://github.com/plebbit/seedit/commit/4d60d9b576a35c5a28960b2afd9c237f6797b97c))
* **index.html:** add no-referrer meta tag to resolve CORP-related media access issues ([dcd06d3](https://github.com/plebbit/seedit/commit/dcd06d3fc1921a523b05c4bd1740456a09b7b97c))
* **loading ellipsis:** was not aligned to text bottom ([f184bb6](https://github.com/plebbit/seedit/commit/f184bb67ee80c48811aa049953840a063389947a))
* **subplebbit settings:** edits didn't work ([3cb5229](https://github.com/plebbit/seedit/commit/3cb52299410ca8319d974adc3c6a54fd7065b468))


### Features

* **subplebbit:** show 'no posts' loading state if sub was just created, not yet published and there are no posts yet (owner can already post) ([de5e999](https://github.com/plebbit/seedit/commit/de5e9997ad649d0c4586510503ba492ba436570c))



## [0.1.12](https://github.com/plebbit/seedit/compare/v0.1.11...v0.1.12) (2024-05-04)


### Bug Fixes

* **subplebbit settings:** stupid typo prevented edit from working ([6f67c26](https://github.com/plebbit/seedit/commit/6f67c263d00e1379843121a319cb6aa7c565ed3c))


### Features

* **loading ellipsis:** improve animation ([e8fafad](https://github.com/plebbit/seedit/commit/e8fafad27b2b5da7964c3bf866c1337aa30e0aa6))
* **submit page:** add spoiler option ([e4a50fe](https://github.com/plebbit/seedit/commit/e4a50feec7e6abb179daba9bddca63bc6516ddfc))


### Performance Improvements

* **use-default-subplebbits:** memoize subscriptions ([8470300](https://github.com/plebbit/seedit/commit/8470300a0fad1d6a982c414f95ca725f993ea9e4))



## [0.1.11](https://github.com/plebbit/seedit/compare/v0.1.10...v0.1.11) (2024-04-27)


### Bug Fixes

* creating a sub wouldn't work if fields were defined ([2a4f057](https://github.com/plebbit/seedit/commit/2a4f057059d2922ebb53d1193c5baa614406eb56))
* **embed:** detect uppercase extension in link ([18a63df](https://github.com/plebbit/seedit/commit/18a63df59de35fc3fb3bee4dea6174ba6bb8c2c6))
* **home:** remove feed render delay for subscriptions ([c383d90](https://github.com/plebbit/seedit/commit/c383d90c5f711fcb83d02cbf99e9a10f6f50ac4f))
* **reply:** default vote count to 1 ([ae3b28f](https://github.com/plebbit/seedit/commit/ae3b28f39e9019d9893691b9ae994d393ad71ea7))
* the position of subscribe buttons in p/all feed is bugged on narrow screen ([7dd6846](https://github.com/plebbit/seedit/commit/7dd6846cdb5518113b8993a1e359e684f7696bf0))
* **topbar:** last sub in the list was covered by the 'more' button ([ce3ed14](https://github.com/plebbit/seedit/commit/ce3ed1447ef71fe1b4f49f6f80898e879d469f74))


### Features

* **electron:** add window.plebbitRpcAuthKey ([328e3a0](https://github.com/plebbit/seedit/commit/328e3a09e94d4925c872c1f4568da84b388a8f7b))
* **embed:** add soundcloud embeds ([4058df5](https://github.com/plebbit/seedit/commit/4058df5b25177d786c2b88ae73753dc0c39bdb5e))
* **reply:** add support for audio embeds, prefer hostname as link to show instead of full link ([d457a50](https://github.com/plebbit/seedit/commit/d457a506f43d96256779e3d56432b80ebedaa15c))
* **settings:** add plebbit options ([5ab14bf](https://github.com/plebbit/seedit/commit/5ab14bff0a20757bcb55deb019aa6aebe0dfade8))
* **settings:** add plebbit options route ([25ff98e](https://github.com/plebbit/seedit/commit/25ff98e09543195e9f5f5a30026d3ffc187a5871))
* **topbar:** add 'own communities' button in dropdown ([0cf89c2](https://github.com/plebbit/seedit/commit/0cf89c2d39f52a9474e0853ebbe1b9dbc5361efd))


### Performance Improvements

* **app:** improve mobile design rensponsiveness ([6fe43e4](https://github.com/plebbit/seedit/commit/6fe43e43dcd34564438fc235121d7e8f6ed872d4))
* **media utils:** optimize loading of media and link preview ([177a994](https://github.com/plebbit/seedit/commit/177a994502e1bc4dd4534e62d643d19212158093))



## [0.1.10](https://github.com/plebbit/seedit/compare/v0.1.9...v0.1.10) (2024-03-27)


### Bug Fixes

* **home:** 'no communities found' would appear while loading multisub ([a281a6f](https://github.com/plebbit/seedit/commit/a281a6fa7d050136c9249f62f8af4a53c99c9084))
* **pending post:** don't expand media for visibility of the publishing state ([3dc5940](https://github.com/plebbit/seedit/commit/3dc5940824584580a2fb3237511a80b29254ed4a))
* **post page:** locked post state was missing in yellow banner alert ([6041aa1](https://github.com/plebbit/seedit/commit/6041aa102e0ff35503eb639b04e4e429f1aad694))
* **post page:** reply form wouldn't appear until replies loaded, but the user can reply already ([e276763](https://github.com/plebbit/seedit/commit/e276763a3d0370242ae20d2a04ae17d0f5ddccb5))
* **post:** remove avatars from posts in feed, they are distracting and don't look good ([929b648](https://github.com/plebbit/seedit/commit/929b648edd675ae50ac34c2154c5712dc9a0fa88))
* **post:** video thumbnails were not showing on mobile, without preload ([51cceae](https://github.com/plebbit/seedit/commit/51cceae2d823dc7559519bd4f7642ebf4cb0d95f))
* **reply:** upvoting a reply of score 1 would keep its score at 1 ([ce765b1](https://github.com/plebbit/seedit/commit/ce765b1d1e7fdd9585e0bec7372ee7fa1da1bd9c))
* **subplebbit:** a community blocked by the user would show 'no posts', show 'you blocked this community' instead ([e018205](https://github.com/plebbit/seedit/commit/e0182057dd674ba41fcff93517036727297031aa))
* **subplebbit:** a subplebbit address with emojis in it would cause bugs in the sub, such as broken links ([5552285](https://github.com/plebbit/seedit/commit/55522854a3c7ec03d100c369bac4822ea2937476))
* **wallet settings:** signature shouldn't include wallet address, only plebbit author address ([c45d2d3](https://github.com/plebbit/seedit/commit/c45d2d3e8c551817fff896d1712a4e500e32d924))


### Features

* **home:** optimize home feed content by limiting number of posts per sub ([e8a136b](https://github.com/plebbit/seedit/commit/e8a136bd25d2e88180e9e1eb4ceaf9ff6ab62d57))
* **media utils:** add embed support for custom youtube links, eg from invidious instances ([4e07055](https://github.com/plebbit/seedit/commit/4e070551c588a5ec1fef2f48d48744cd2d936296))
* **media utils:** add support for Next.js image links ([791e1ce](https://github.com/plebbit/seedit/commit/791e1ce422be3b8e5d931be6cecde626b5c087fa))
* **media utils:** detect GIFs as separate type from image ([7ad0953](https://github.com/plebbit/seedit/commit/7ad0953d8719324264d29f38d89a6cd4e55017e2))
* **thumbnails:** render the first frame of gifs so they don't autoplay in the feed ([7d8a80b](https://github.com/plebbit/seedit/commit/7d8a80b1f9aca5dcfc752e3f3ae2dec881cf3647))


### Performance Improvements

* **media utils:** cache check for invidious yt links ([7bf9c85](https://github.com/plebbit/seedit/commit/7bf9c857a505121d8fc9c8cbd12c4d6901637172))



## [0.1.9](https://github.com/plebbit/seedit/compare/v0.1.8...v0.1.9) (2024-03-20)


### Bug Fixes

* **mod menu:** ban days input was too long on firefox ([3f780a5](https://github.com/plebbit/seedit/commit/3f780a54ba64e9aaca563cc53bf7bae21a89eeed))
* **subplebbit settings:** creating a subplebbit would clear all fields even when failing to create ([81de00d](https://github.com/plebbit/seedit/commit/81de00d10be047f95294f373c737fc206790c6cd))



## [0.1.8](https://github.com/plebbit/seedit/compare/v0.1.7...v0.1.8) (2024-03-14)


### Bug Fixes

* **comment edit form:** author edit wasn't instant ([38baa01](https://github.com/plebbit/seedit/commit/38baa0123410cf1540b20f432b14152dde03582d))
* **delete button:** deleting own post wasn't instant ([db801ab](https://github.com/plebbit/seedit/commit/db801ab9842bd72a10625c6bd22d92256c049c83))
* **inbox:** show parent buttons were clickable outside of their space ([13b7b94](https://github.com/plebbit/seedit/commit/13b7b94a534c79dc49b8a8ff895d9fcdd285beb8))
* **markdown:** replies had incorrect white-space and double returns needed margin on posts ([ed02146](https://github.com/plebbit/seedit/commit/ed02146103bf3f5ec44e84338cd2cdd7e272ae1f))
* **post:** clicking near the 'comments' button would add the dotted border ([400b4f2](https://github.com/plebbit/seedit/commit/400b4f2f43a506e4da90b7506c7c4aad2bacbafa))
* **post:** dotted border for last visited post shouldn't appear in post page ([121cf3d](https://github.com/plebbit/seedit/commit/121cf3da976641dc140a87cf5aaf74b421fca0f0))
* **posts:** limit display name character count ([ff4a97b](https://github.com/plebbit/seedit/commit/ff4a97b9b4e4ece27b98be84edcb4b05608642a6))
* **reply:** spoiler styling couldn't be clicked ([29b5f72](https://github.com/plebbit/seedit/commit/29b5f72b241b184b787201d738febebf1edcda24))
* **search bar:** disable autocapitalize, autocorrect, autocomplete, spellcheck ([8eebb0f](https://github.com/plebbit/seedit/commit/8eebb0ff1bfc945fa9ac47bc313559e1c0e7aa7f))
* **submit page:** rules box would appear for sub with rules defined but empty ([358d6c8](https://github.com/plebbit/seedit/commit/358d6c87bf16a9a3f56be93c5797b1e670730723))
* **submit page:** some fields would update incorrectly or return 'option is an empty string' error ([24ab3c9](https://github.com/plebbit/seedit/commit/24ab3c9ca1b57ef9c72b5eb0132be63429a9feab))


### Features

* **address settings:** update setting for sol addresses, with guide on how to set up ([430c597](https://github.com/plebbit/seedit/commit/430c5970761e3e3fd0af03ce230a543cea6be3ab))
* **context:** allow any number as post context, always showing the top level reply ([b9d050c](https://github.com/plebbit/seedit/commit/b9d050c87c45b2e1c541a4ac45e7f23b6e5490f7))
* **mod menu:** community moderators can ban their users ([22beb4e](https://github.com/plebbit/seedit/commit/22beb4e0ea6a2c300422fa8a21b5f230af985ec0))
* **post page:** hide reply form and display 'loading comments...' while the post is loading ([a068691](https://github.com/plebbit/seedit/commit/a06869196d236f51ab8bfffae46bdf08aefd95df))
* **scripts:** add old versions to folders e.g. seedit.eth.limo/0.1.1 ([a384e7b](https://github.com/plebbit/seedit/commit/a384e7b845f6a6071f7cf0cfab3347d82c8d2528))
* **settings:** add link to nft whitelist ([f174602](https://github.com/plebbit/seedit/commit/f174602c81bab926ece3adb45c3fd14338c2f953))
* **settings:** users can add crypto wallets to their plebbit account ([75b25e7](https://github.com/plebbit/seedit/commit/75b25e74cd6dba73aae7b3385669c5a80b2c2c75))
* **subplebbit settings:** add info on how to set up .sol crypto domain as sub address ([5f54bbe](https://github.com/plebbit/seedit/commit/5f54bbe07ad6bf5acd8c6ff02da3e976a0730be0))



## [0.1.7](https://github.com/plebbit/seedit/compare/v0.1.6...v0.1.7) (2024-03-06)


### Bug Fixes

* disable buttons for comments that are failed, remove duplicate label from reply ([6e341e3](https://github.com/plebbit/seedit/commit/6e341e33fc5b57dae7eb7d6858a5159e20e054d6))


### Features

* **app:** redirect to link with hash on first load ([365b40d](https://github.com/plebbit/seedit/commit/365b40d3626a40131b7b0d722a3d9e0e6ab9359b))
* **post:** if post is removed, show locked info banner ([2490bc3](https://github.com/plebbit/seedit/commit/2490bc35f452e2231afea94edac14a9280bf430d))



## [0.1.6](https://github.com/plebbit/seedit/compare/v0.1.5...v0.1.6) (2024-03-03)


### Bug Fixes

* **account settings:** removed unnecessary reload when switching account, allow to delete last account (refreshing creates a new one) ([51f7dba](https://github.com/plebbit/seedit/commit/51f7dbadae5f385216d97b60d65c6ceb5ea0f765))
* **author sidebar:** hide +friends button until functionality is implemented ([83ea30d](https://github.com/plebbit/seedit/commit/83ea30d8e7ab06b70a98efaba6b8c756a8b89aa9))
* **challenge modal:** special characters couldn't get rendered in post content preview ([9d2c01d](https://github.com/plebbit/seedit/commit/9d2c01d12fff752422581988a05d779a76719c86))
* **comment tools:** don't show 'report' button if the user is the author ([96fd888](https://github.com/plebbit/seedit/commit/96fd888194a6f019e3deedf2b251142c11823fa5))
* don't reset time filter when changing sort in feeds ([e2de559](https://github.com/plebbit/seedit/commit/e2de55987cc02ecee94a0c57c4954d31a478ef27))
* **embed:** twitter embed width would glitch ([0c415fa](https://github.com/plebbit/seedit/commit/0c415fa94d5c83bb7c0a66b76f15347347c0c477))
* **embed:** videos on mobile had wrong width ([c560dd7](https://github.com/plebbit/seedit/commit/c560dd7d962f77639d6037a6289a86167ed7c439))
* **expando:** clicking on video would redirect to external link ([ff52a9a](https://github.com/plebbit/seedit/commit/ff52a9a05e50770133a18648d8683242281cf0ad))
* hide buttons that aren't functional yet (save, crosspost, embed, report) ([265f6c1](https://github.com/plebbit/seedit/commit/265f6c1df0f62e566a68d5fa26741c0ad219f56c))
* loading avatar should have empty space ([4e8142c](https://github.com/plebbit/seedit/commit/4e8142cd2196e57c0d17fe6a5c7d164f5f143118))
* **mod menu:** close modal when saving, instead of waiting for publishing ([929514f](https://github.com/plebbit/seedit/commit/929514ffde1ace70bb50cbddd15470797423c690))
* **post:** display title as dash if it's empty ([712779d](https://github.com/plebbit/seedit/commit/712779d30e01d4ead71166d7544992cce6db8619))
* **post:** dotted border for last visited post should only persist in the same window ([0a67399](https://github.com/plebbit/seedit/commit/0a673991236fa8a1314746ccc2ada42ff83a3e33))
* **post:** font size would bug out with overflowing title ([5890b92](https://github.com/plebbit/seedit/commit/5890b92888af1c5cc5c685f80be695ebc53b0dc1))
* **profile:** hide 'saved' and 'hidden' tabs until functional ([ad5f73f](https://github.com/plebbit/seedit/commit/ad5f73f0de618b46dc2f7c262d22526ddd131659))
* **reply form:** couldn't reply from inbox page because subplebbit address wasn't defined ([c31b7eb](https://github.com/plebbit/seedit/commit/c31b7eb52fee9aad04d2f6666b071b40031eb502))
* **settings:** display name setting wouldn't reset on account change ([b961626](https://github.com/plebbit/seedit/commit/b9616264f8584992e5c3e9c27e32ce971a8111b5))
* **sidebar:** 'created by u/' link shouldn't be a link because it has no cid ([1e73aee](https://github.com/plebbit/seedit/commit/1e73aee41ec50d38016c2b09b28677f87dfaef72))
* **sidebar:** hide 'about moderation team' button, not functional yet ([f887dc2](https://github.com/plebbit/seedit/commit/f887dc273d0520f9c88da08bb3ba179e555573a1))
* **sidebar:** show moderation tools to sub owner without role ([15921ef](https://github.com/plebbit/seedit/commit/15921ef75c4cb5296710748c21a904b1c4224813))
* **submit:** address wasn't selected when clicking it in the dropdown ([c55cd75](https://github.com/plebbit/seedit/commit/c55cd75a70da7f47d326ce1449327a989583a3f5))
* **subplebbit settings:** don't add empty exclude group when adding challenge ([2465a8b](https://github.com/plebbit/seedit/commit/2465a8bcf9b74949d3bbc2b9cf0e47095d4d3ffd))
* **subplebbit settings:** read only address would overflow if too long ([f02c71f](https://github.com/plebbit/seedit/commit/f02c71f5e1095bfd5bca31e184daa37fa1bc26f7))
* **subplebbit settings:** read only description needed word wrap ([6fdecce](https://github.com/plebbit/seedit/commit/6fdecce49730c9ca59a277aa8974f0721b557b2b))
* **subplebbit settings:** read only exclude setting wasn't displayed properly ([2f81578](https://github.com/plebbit/seedit/commit/2f815785fa707f5a7d38f56730d2ffa39bd18fef))
* **subplebbit settings:** reset store, challenges setting would not update on subplebbitAddress change ([e0862a8](https://github.com/plebbit/seedit/commit/e0862a85ff5a1a6732bc698924dcab16c3153078))
* **subplebbit settings:** when adding an exclude group for challenges, the roles should not be checked by default ([7dc0297](https://github.com/plebbit/seedit/commit/7dc0297983f6beed2094f0c5c1fa324a81a04685))
* **subplebbit:** scroll position wasn't retained ([f74ce22](https://github.com/plebbit/seedit/commit/f74ce2274542353e6d8d026eb1101e946642fc16))
* **subplebbits:** show subplebbit run in local node in mod/admin/owner tabs regardless of role ([32a6c01](https://github.com/plebbit/seedit/commit/32a6c01b8b27995d8decb64cbf723f49f28ed8b6))


### Features

* add 'edit content' functionality to edit button for replies and posts, show asterisk in date with timestamp title ([5055fde](https://github.com/plebbit/seedit/commit/5055fde320db05699c4e83066998bd5abdc74252))
* add 'not found' page for invalid links ([e8ee496](https://github.com/plebbit/seedit/commit/e8ee4963da7e7656ca1312aee3c598b0d9e3ffce))
* add 'pending edit' and 'failed edit' labels for mod and author edits ([3bf9ead](https://github.com/plebbit/seedit/commit/3bf9ead33ecaf5cf11907b88dad4aad9d01c534c))
* add "delete" button for user's posts ([1918ee9](https://github.com/plebbit/seedit/commit/1918ee96ee378c980ea7b3c33241cea258013774))
* add author edit reason, spoiler ([11cc1a4](https://github.com/plebbit/seedit/commit/11cc1a430fc98429a2a2e52b4e1ed339f317f26c))
* add mod edit reason to posts and replies ([dd6744a](https://github.com/plebbit/seedit/commit/dd6744ab7003792c1c66daf60b43731f068d1562))
* add spoiler styling as black overlay above post or reply content ([d9e5086](https://github.com/plebbit/seedit/commit/d9e508602ec5e75d1eaf71171168a9d692cd0f41))
* **communities:** add markdown to each sub expandable description ([486710c](https://github.com/plebbit/seedit/commit/486710c9e29d90b06e81a03003a1f35358657084))
* **feed:** add dotted border to last visited post ([6e5d644](https://github.com/plebbit/seedit/commit/6e5d6445a16becaad21a805521d60c4e065b1785))
* **header:** add 'all' title to p/all header ([6273029](https://github.com/plebbit/seedit/commit/6273029a1c803756d1f9502366bb18da5c507db4))
* hide media of removed posts and replies, blur title and media in feed for mods ([dbbe9b0](https://github.com/plebbit/seedit/commit/dbbe9b0dcd90f3e93471e0f645c4d8f9a28ba758))
* implement community creation on desktop app (p2p full node) ([b724894](https://github.com/plebbit/seedit/commit/b72489424f8edb2259944de5319b283fe9e3960a))
* **inbox:** add functionality to "show parent" button in comment replies ([3443445](https://github.com/plebbit/seedit/commit/3443445a6ffe0dfb5851e18a562735bb62a6ec55))
* **markdown:** add same markdown styling and rules as reddit ([83c2b3c](https://github.com/plebbit/seedit/commit/83c2b3c702222e51ea06b0611d6bc91ff16790ee))
* **post:** add '+' subscribe button to posts in p/all ([5699739](https://github.com/plebbit/seedit/commit/569973947cc21a54ed2c43896d93aed843d52062))
* **post:** add small profile nft avatar next to username ([da6e474](https://github.com/plebbit/seedit/commit/da6e474a6ef0bde4a6c909a6743f20c29932cf76))
* **post:** show "[deleted]" as content if user deletes his own post ([26ae8ea](https://github.com/plebbit/seedit/commit/26ae8ea33a8c57e0d6c248cd6bfbacb0a85dccd8))
* **reply form:** add formatting help table for markdown ([1c73e70](https://github.com/plebbit/seedit/commit/1c73e7063d5a0a5740986960df8a5abe428c4d8e))
* **reply:** add deleted (by author) styling, hide media ([d3e8b89](https://github.com/plebbit/seedit/commit/d3e8b89aba68ea2bafc816ac6f528a54a17468e1))
* **reply:** display nft profile picture if set ([14c2cec](https://github.com/plebbit/seedit/commit/14c2cec5650e444ddf6db254b7c9232298114534))
* **settings:** add 'check for updates' button ([1acab82](https://github.com/plebbit/seedit/commit/1acab82b994c1b383a291599f072d8e0c2e9d3f2))
* **settings:** add 'contribute to github' link to translations setting ([5804c7d](https://github.com/plebbit/seedit/commit/5804c7d88b8f5de09f01cd82fe2595c93bf6157a))
* **settings:** add button to copy full account address ([306919c](https://github.com/plebbit/seedit/commit/306919ca3ba2d58591728b844f7ab4e88635c3a3))
* **settings:** add double confirm when deleting account, red color ([5afcf5c](https://github.com/plebbit/seedit/commit/5afcf5c21a886d5f60a7a4b36e8d1b4eab899c8b))
* **settings:** add link to ipfs stats on desktop full node, version info ([d833a89](https://github.com/plebbit/seedit/commit/d833a89fc43777690396e8c02900fc9ad78e5343))
* **settings:** add profile avatar setting ([4b90287](https://github.com/plebbit/seedit/commit/4b902871b92043920e3cff64536d88af53cb4ad2))
* show avatar in profile page sidebar ([d3e85ab](https://github.com/plebbit/seedit/commit/d3e85ab214d5a052a9d58825f40b09e092491ea1))
* **submit:** add markdown preview for post content ([5c5273f](https://github.com/plebbit/seedit/commit/5c5273fc17421d4d5f6b9b636d0f5170b85af392))
* **submit:** add media preview to url field ([2d6e7dd](https://github.com/plebbit/seedit/commit/2d6e7ddb381e31befcf546cd542fa0db2761cfa1))
* **subplebbit settings:** add delete community button ([615bd0d](https://github.com/plebbit/seedit/commit/615bd0d00c09efbe08c5701c3160bc5c2d45a7ee))
* **subplebbit settings:** add markdown preview for description ([30caa7e](https://github.com/plebbit/seedit/commit/30caa7e7abe71cca1bcde0e0953d36da060ffc9f))
* **topbar:** add create community button to 'my communities' dropdown, so it's easier to find on mobile ([55a30e8](https://github.com/plebbit/seedit/commit/55a30e87c17834e558b638467285670c839affda))
* **topbar:** add link to default communities in "my communities" dropdown, rename "edit" link to "more" ([09a7e63](https://github.com/plebbit/seedit/commit/09a7e63dc48b1b172582a64a64e8723cfc1c793b))


### Performance Improvements

* **inbox:** memoize filters to avoid recalculation at every render ([f6caf90](https://github.com/plebbit/seedit/commit/f6caf90d8d2d2dff0db5fe9db697d81bbd5b3d00))
* **markdown:** only render links in content if its length is less than 10000, to avoid lag ([0edca2a](https://github.com/plebbit/seedit/commit/0edca2aad90821e1757ee451d53967eadb8552e2))
* **media utils:** memoize link media info ([caa5390](https://github.com/plebbit/seedit/commit/caa5390d995530208e1e1bd3e330ac46379c31bb))
* **post page:** optimize load time ([369360c](https://github.com/plebbit/seedit/commit/369360ca0c17d79d1eba28c40445c53a034b7a5f))
* **reply form:** faster replying by passing cid and sub address without having to load the post; fix no sub address error ([3b40538](https://github.com/plebbit/seedit/commit/3b40538b84089714352613b53aa973a39096da6a))
* **settings:** remove unnecessary useEffect from crypto address and displayName functions ([a2ade9f](https://github.com/plebbit/seedit/commit/a2ade9fc65bf4b3193c4c4ed660ead7152870ee5))
* **settings:** use default value and inline fallback for dynamic strings, instead of useEffect ([1c4883e](https://github.com/plebbit/seedit/commit/1c4883e83f2d7e543c2b97cda2e26cb9eb72a5cd))


### Reverts

* Revert "Update subplebbit-settings.tsx" ([d16c354](https://github.com/plebbit/seedit/commit/d16c35423eecdd0c26bdb03924b84b22428556b1))



## [0.1.5](https://github.com/plebbit/seedit/compare/v0.1.4...v0.1.5) (2024-02-04)


### Bug Fixes

* **electron:** make sure repo is migrated when starting ipfs ([e3804e3](https://github.com/plebbit/seedit/commit/e3804e353330601a7cb19d91b29333444514ab24))
* **submit:** don't spellcheck and autocorrect in url input and community address input ([65ea473](https://github.com/plebbit/seedit/commit/65ea473dcadf78eb4af14b4082c15bb3dbc0dec7))
* **subplebbit settings:** in challenge exclude, non-actions were incorrectly checked by their counterparts ([0b193ad](https://github.com/plebbit/seedit/commit/0b193ad5664f0e6389a6d488e0523bab638c9078))


### Features

* add 'continue this thread' nested replies limit ([d4f66ac](https://github.com/plebbit/seedit/commit/d4f66ac3a17a376a1b987725fe6976c11132af24))
* add service worker (PWA) ([8c7ebf2](https://github.com/plebbit/seedit/commit/8c7ebf231a2010258c89922400eff7f829976afb))
* **android:** add android build script ([f58827a](https://github.com/plebbit/seedit/commit/f58827a0aa441b33a6e051a3159dce112738c7af))
* **author sidebar:** show avatar if set ([3574546](https://github.com/plebbit/seedit/commit/3574546c539ac567467bb1233e175d937b728467))
* implement text challenge modal ([bf8b575](https://github.com/plebbit/seedit/commit/bf8b575d334b02c99e75880670c886504f4c187b))
* **inbox:** add functionality to 'context' button, highlighting reply in single comment thread ([7537cba](https://github.com/plebbit/seedit/commit/7537cbaa6dd117535cd736441eea606f3432fdfd))
* **post:** add single comment's thread view ([a605bdd](https://github.com/plebbit/seedit/commit/a605bdd77e696ca92c3a6e055c09514a6226b85f))
* **submit:** add arrow keys control to community address dropdown items ([aea68e6](https://github.com/plebbit/seedit/commit/aea68e66eb08a687fe26796cab820a0948e5163e))
* update app icon design ([b3a37d5](https://github.com/plebbit/seedit/commit/b3a37d541e116e7f9feb2577fc28c833111ac9fa))



## [0.1.4](https://github.com/plebbit/seedit/compare/v0.1.3...v0.1.4) (2024-01-30)


### Bug Fixes

* **account settings:** prevent deleting last account, reload page when changing active account ([14fde38](https://github.com/plebbit/seedit/commit/14fde3833a1be67b4db232e682848c172e40ea3f))
* **home:** some text would be cut on mobile, padding-right was needed ([e599393](https://github.com/plebbit/seedit/commit/e59939375785e654c7bacefecc1ef3b44c031488))
* **index.html:** disable auto zoom on safari mobile ([497b8d6](https://github.com/plebbit/seedit/commit/497b8d6d34dba0f96952e0687c9c1c4b80bcfe4b))
* **markdown:** add regex to fix newlines in list items separated by empty lines ([b65e9aa](https://github.com/plebbit/seedit/commit/b65e9aa153b50f6743d03946cc4ca199c8f494ac))
* **markdown:** remove regex, adopting conventional markdown rules ([337373f](https://github.com/plebbit/seedit/commit/337373fdf5ebc1d7a9e2b416c36967842ae24c1b))
* **markdown:** use regex and a custom remark plugin to correctly style quotes and lists ([361a479](https://github.com/plebbit/seedit/commit/361a479111098f592e4ffd214d950f31fd69b9be))
* **media utils:** add m.youtube ([c81d240](https://github.com/plebbit/seedit/commit/c81d240b90f80844d87bf313bd369cd88dcfb285))
* **post:** author address wouldn't underline on mouse over ([cfcda0f](https://github.com/plebbit/seedit/commit/cfcda0f4ee83fad59eed01b8cd4eba356750096c))
* **post:** fix virtuoso zero-sized element error ([b2cbacc](https://github.com/plebbit/seedit/commit/b2cbacc3b4d08f27ae94ff0e3fe992fd61bc09ca))
* **sidebar:** don't render rules if they are an empty array ([ad91dd7](https://github.com/plebbit/seedit/commit/ad91dd7432e45dfe991245c6f2da04e11a57358a))
* **submit:** show suggested communities if subs are less than 5, update translation, fix state ([c56b944](https://github.com/plebbit/seedit/commit/c56b944e99b55941f1d4bd4785c80dde03b37f48))
* **subplebbits:** don't show offline label if updatedAt is undefined ([9d0bd81](https://github.com/plebbit/seedit/commit/9d0bd81584e0fd2c4ffa34b742e6b4e283e42f63))
* **subplebbit:** selecting the time filter would bug the header title and topbar ([90f9d35](https://github.com/plebbit/seedit/commit/90f9d3546c4fcd1d03fdcdcd3e8c5b7b26e13c35))
* **time utils:** show 1 minute if 1.x minutes ([8f941c1](https://github.com/plebbit/seedit/commit/8f941c14db882c53c54bf09ee1d3393d18a7e88b))
* **topbar:** subscriptions were showing in default sub list ([dbd2f34](https://github.com/plebbit/seedit/commit/dbd2f348fbcf7009f6e0abacb7eb30423e32adf7))
* unescape html encoded tags in i18next trans element ([76065a8](https://github.com/plebbit/seedit/commit/76065a80c0dd94e62967a7b6d0158bc0450e53be))


### Features

* add mobile about page to home, p/all ([e1e28b9](https://github.com/plebbit/seedit/commit/e1e28b94909149ecd9ebd92e7241a93918f74cd7))
* add offline/online title to indicator ([8a56bf1](https://github.com/plebbit/seedit/commit/8a56bf1f15ec5ae4480042166ced77062d7e630f))
* **edit menu:** implemented instant author edits to delete post, mark as spoiler ([33d1e6b](https://github.com/plebbit/seedit/commit/33d1e6bc93dc1af6fdbac707ff777eb77e63cbc5))
* **electron:** improve navigation labels ([32dd697](https://github.com/plebbit/seedit/commit/32dd69789cb9578234cecbaaa4b696861867d306))
* **home:** default time filter to 1 week to avoid showing old posts ([16b0f39](https://github.com/plebbit/seedit/commit/16b0f39491317b8be501d5ad69eddffa6f2c63ee))
* **home:** implement last visit time filter, automatically selected ([5f651fc](https://github.com/plebbit/seedit/commit/5f651fcffbacb6699fccc5df33f63fa489cd4fe2))
* implement markdown, styled, in posts, replies and sidebars ([5e61fd6](https://github.com/plebbit/seedit/commit/5e61fd6a8717de338011275840629dc8b9c82468))
* **label:** add removed and deleted labels, don't hide post when deleting to allow other edits ([5314d10](https://github.com/plebbit/seedit/commit/5314d10b935165ed6cc082d068e6e8484f89b391))
* **mod menu:** allow multiple instant edits ([f887972](https://github.com/plebbit/seedit/commit/f8879724646e62b5e4520d44a8f80a41b81933ef))
* **mod menu:** show mod menu for single replies, put it last in tools for quicker access ([3c1da1c](https://github.com/plebbit/seedit/commit/3c1da1cfee6328054f5aff3d2ee34e3a46f3bde6))
* **sidebar:** add desktop app banner ([4266964](https://github.com/plebbit/seedit/commit/4266964323d8804005be4f8b18c0caa7bea3a928))
* **sidebar:** add dev version commit ref with link to the commit ([052aad9](https://github.com/plebbit/seedit/commit/052aad9bff2a67599e70cf40646a6ef99ddf733d))
* **sidebar:** add download links for the desktop client ([2578249](https://github.com/plebbit/seedit/commit/2578249e3049bbbf9d45bae176f2c7199a90625e))
* **sidebar:** add footer with version and link to release ([218840f](https://github.com/plebbit/seedit/commit/218840fd0b4b05349a01a444904232a6311ecb0f))
* **sidebar:** add moderation tools and community settings link ([7b1ebf7](https://github.com/plebbit/seedit/commit/7b1ebf7eecafff97d2cdf88dd318233b07109b18))
* **sidebar:** detect OS for 'download app' button in footer ([103a209](https://github.com/plebbit/seedit/commit/103a20959444676903cb02145c27618d1f826418))
* **sidebar:** version footer links to specific version changelog ([cf6f7d9](https://github.com/plebbit/seedit/commit/cf6f7d99470ff4b0f9154a4c5fe965cecf929fc8))
* **submit:** 'submit to' page title links to subplebbit, passing link element to translation ([8fd70b6](https://github.com/plebbit/seedit/commit/8fd70b67134181081abe48c746becd8535b35301))
* **submit:** suggest random communities when subscriptions are zero ([9ed7c42](https://github.com/plebbit/seedit/commit/9ed7c420883eb52add96c6ee2387a9d0f59e9621))
* **subplebbit settings:** add challenges UI from API ([d2f9249](https://github.com/plebbit/seedit/commit/d2f924981e2cabf7800410dcb7ced4ce444fb50c))
* **subplebbit settings:** add combinations for exclude from challenge settings ([1e93bad](https://github.com/plebbit/seedit/commit/1e93bad0476260acc9e36e4965e35bd4d297a83e))
* **subplebbit settings:** add exceptions setting to challenges ([416f097](https://github.com/plebbit/seedit/commit/416f097f681ed00901edadbca2c8dbc1713aaee1))
* **subplebbit settings:** add functional setting for adding/removing moderators and changing roles ([4680021](https://github.com/plebbit/seedit/commit/46800212c8eef703d4fcf45c2ef70b2c67a4e58d))
* **subplebbit settings:** add functional settings for subplebbit title, description, address, avatar, rules, settings json ([0d3622f](https://github.com/plebbit/seedit/commit/0d3622f823444544e666dd96546051ee65d557dc))
* **subplebbit settings:** add functionality to add and remove challenges, include challenge details and exclude values ([dc36065](https://github.com/plebbit/seedit/commit/dc36065635fec96f00d9fd544352860b9c3f15a1))
* **subplebbit settings:** add info banners for required admin role and desktop app ([118ba4a](https://github.com/plebbit/seedit/commit/118ba4a03768e0d85dd40f51e99fc7b36fbc9bbb))
* **subplebbit settings:** add logo preview ([7a451df](https://github.com/plebbit/seedit/commit/7a451df71902a7fd600b35d42e27b519f2c2b795))
* **subplebbit settings:** add negative action exclusion types for challenges ([afe9746](https://github.com/plebbit/seedit/commit/afe9746635f4f2aa97d72aa397ff582a1a7e3a93))
* **subplebbit settings:** add read-only challenge type and description ([87e305f](https://github.com/plebbit/seedit/commit/87e305f1b3726a437bdd553ce0838ad84cccfead))
* **subplebbit settings:** add UI ([5f70b02](https://github.com/plebbit/seedit/commit/5f70b022fb86da530c5dc87a0a18c1006baeb6f8))
* **subplebbit settings:** allow to define custom challenges in default types, using strings as values ([8216994](https://github.com/plebbit/seedit/commit/82169943b26d889bf7553bd9ddb2f119d39e318f))
* **subplebbit settings:** allow to define exceptions for each challenge, defining exclude array ([c2c68be](https://github.com/plebbit/seedit/commit/c2c68bed2f52f6deaa9c6c0b45fb892873dea96c))
* **subplebbit settings:** automatically show settings of a challenge when adding it ([3495fee](https://github.com/plebbit/seedit/commit/3495fee801e8d0b3f86e0b8ed159ace4df577b42))
* **subplebbit settings:** exclude specific user addresses from challenges, minimum user karma ([592a889](https://github.com/plebbit/seedit/commit/592a8893d04b148ced67a7237cad8052afd70e95))
* **subplebbit settings:** exclude users from challenge by account age, and by free actions per hour ([52533e8](https://github.com/plebbit/seedit/commit/52533e8b801207b9366477c22e7b346461d9f94e))
* **subplebbits:** add 'all' tab to 'my communities' ([d408cc5](https://github.com/plebbit/seedit/commit/d408cc511398fa4519e0000bd214a1f70cfb5941))
* **subplebbits:** add 'passed' and 'rejected' tabs to vote page ([fcdb478](https://github.com/plebbit/seedit/commit/fcdb4784a0294c2ff2cc7a3ca1ac6fad66858250))
* **subplebbits:** add avatars to communities page ([10a4b46](https://github.com/plebbit/seedit/commit/10a4b4662c33460cd4d8232c246bf607438b138d))
* **subplebbits:** add default subs view, subscriptions view ([b9efbc9](https://github.com/plebbit/seedit/commit/b9efbc940bfc5aee235aab8b99769f2af28a86fe))
* **subplebbits:** add filtering by user role in 'my communities' tab, routes ([7dfc053](https://github.com/plebbit/seedit/commit/7dfc05395bd200a480ec8ae705ddebb565a6ec40))
* **subplebbits:** add flair for user role if any ([9cb27c1](https://github.com/plebbit/seedit/commit/9cb27c103c33fecba62a8a6fa3a492feb344e671))
* **subplebbits:** link to communities, show empty subscriptions view to user, empty moderating subs page ([a485bc9](https://github.com/plebbit/seedit/commit/a485bc98e38b791f45455a2da862898fa3278fa8))
* **time filter:** default to 1m for new users ([8166d0f](https://github.com/plebbit/seedit/commit/8166d0fcd2dc40fe8781016737839d1fc0fa27ff))
* **topbar:** add 'edit subscriptions' button ([e14fe49](https://github.com/plebbit/seedit/commit/e14fe49b9cd99f532de13e0b3fa6911d4dbd1ca3))
* **topbar:** show 'edit subscriptions' button in 'my communities' dropdown ([3b13281](https://github.com/plebbit/seedit/commit/3b13281704b5932d1bbaed31fa499c9a4ea4675a))


### Performance Improvements

* **inbox:** improve loading of notification details ([11ddd46](https://github.com/plebbit/seedit/commit/11ddd46aad70b75f6f0ecf0756f8a5d777b897fb))



## [0.1.3](https://github.com/plebbit/seedit/compare/v0.1.2...v0.1.3) (2024-01-05)


### Bug Fixes

* **author sidebar:** handle nullish values in karma calculation to prevent NaN ([faed873](https://github.com/plebbit/seedit/commit/faed8736a876bd9281b081f489a82f49137d55ef))
* **author sidebar:** undefined ([85e3930](https://github.com/plebbit/seedit/commit/85e3930a84752af7d46284b3a7ad1efa1b4c3b21))
* **embed:** remove noreferrer for youtube-nocookie because it prevented some videos from loading ([8d0e73b](https://github.com/plebbit/seedit/commit/8d0e73bc0c32af10348caa7c7abe7d8af38d68f1))
* **header:** add missing translation ([b094523](https://github.com/plebbit/seedit/commit/b094523cd5351669e4693d685a64bf00b8f47a17))
* **header:** correct height on mobile submit page ([a68b009](https://github.com/plebbit/seedit/commit/a68b009f3e0e47a17628ef1384eeb858d36244f6))
* **language settings:** trigger page refresh at language change because some strings get stuck ([0304b5c](https://github.com/plebbit/seedit/commit/0304b5cde5013d8a3e576226c3fc1864ba0f89c9))
* **media utils:** use 0.jpg instead of sddefault for youtube thumbnails, some wouldn't load the specific sd res ([8bcded4](https://github.com/plebbit/seedit/commit/8bcded4237cb58d9fa997f274d909c2f8dd7b6db))
* **mod menu:** don't show locked option for replies, they can't be locked ([4ad46b6](https://github.com/plebbit/seedit/commit/4ad46b6c14ae308924fd13e1ab128c1b3856a37b))
* **submit:** limit input resizing to fit in UI ([b794ea7](https://github.com/plebbit/seedit/commit/b794ea74da9445ac750e8c24f307f0fe008733d1))
* **submit:** set min height/width of input elements ([a6a1795](https://github.com/plebbit/seedit/commit/a6a17952adcc687bc518e41436308efb37ece204))


### Features

* add subplebbits component and header ([69f3d20](https://github.com/plebbit/seedit/commit/69f3d2019f43a6ca7ed74946d99ebf164a282973))
* **comment tools:** show mod if mod, else show report, move some buttons to menus only on mobile, show them on desktop ([b62831b](https://github.com/plebbit/seedit/commit/b62831b3588359b6f89df20c6dac9d7cb9fdf19b))
* **inbox:** add red info text for no notifications found ([5d4ca28](https://github.com/plebbit/seedit/commit/5d4ca287d57728d7f35f39c8894862315716cd3c))
* **post:** add locked post info banner ([d5a9472](https://github.com/plebbit/seedit/commit/d5a94723c8714f435eff5f0665606b582e1d7c0d))
* **post:** implement instant edits ([0a9b154](https://github.com/plebbit/seedit/commit/0a9b154aec286bbd25c74d5dc4d5917264f1b32a))
* **reply:** add pinned replies ('stickied comment') ([f04ef91](https://github.com/plebbit/seedit/commit/f04ef913d9f38d294edbcf89f253fa2d016ffbed))
* **reply:** implement instant edits ([38cb7d9](https://github.com/plebbit/seedit/commit/38cb7d9b6287a0f7882bb95ced72c47d29afc8b5))
* **sidebar:** add community settings button ([dbbba07](https://github.com/plebbit/seedit/commit/dbbba0732f2f35292e7ae338d2574c4d2b62f1ed))
* **subplebbit settings:** add initial UI ([f4634b6](https://github.com/plebbit/seedit/commit/f4634b645538e1e4619fcc75140839253067bfdc))
* **subplebbits:** add 'my communities' routes and tabs ([79c8682](https://github.com/plebbit/seedit/commit/79c86822c337e3a719def664b93d4fd4ce32b350))
* **subplebbits:** add initial UI ([12306a6](https://github.com/plebbit/seedit/commit/12306a68164b3fd50fe58532ce6e7340812a4c34))
* **subplebbits:** add online indicator ([e24aa06](https://github.com/plebbit/seedit/commit/e24aa066dac2c232de99451f0e5301ba2607947c))
* **subplebbits:** add page title ([1eb75fa](https://github.com/plebbit/seedit/commit/1eb75fa92a6e025ecf07bde021fd1a06e9f480bf))
* **subplebbits:** add responsive design, vote buttons, preferences button ([e1d1682](https://github.com/plebbit/seedit/commit/e1d168297cd891099d51498c86ab82ca9dd901cf))
* **subplebbits:** add settings route, header title ([91be80f](https://github.com/plebbit/seedit/commit/91be80f3e5135af244fd0a7a921301c8a786d75d))



## [0.1.2](https://github.com/plebbit/seedit/compare/v0.1.1...v0.1.2) (2023-12-25)


### Bug Fixes

* **comment tools:** close menu when option is clicked, use dropdown styling ([486e0b4](https://github.com/plebbit/seedit/commit/486e0b4e8f90fc46a547b3c97a19ec0c509f6bc6))
* **hide menu:** only close menu when hiding post ([00072bb](https://github.com/plebbit/seedit/commit/00072bb4cc2cd9541a78a97e6bbc2c356bf577dc))
* **post:** link to pending page if cid is undefined ([10ddcfe](https://github.com/plebbit/seedit/commit/10ddcfe567f784643695e687614c6817d7e4e5fb))
* **post:** set width of voting column taking into account high vote counts ([8448206](https://github.com/plebbit/seedit/commit/844820690efed4ef66726dccfad029fc26be1b57))
* **reply:** don't show long subplebbit addresses, shorten them instead ([f1c8249](https://github.com/plebbit/seedit/commit/f1c82494f18dbf2a77f3cb38d9905dcf61379903))
* **share menu:** add 'link copied' text with timeout and don't close the menu ([67ac476](https://github.com/plebbit/seedit/commit/67ac476129e24c5f593488b67d35621c3698e550))
* **share menu:** don't open for pending comments, fix share link div ([c0edbf6](https://github.com/plebbit/seedit/commit/c0edbf6633e3f06a63496520b60e8e17e7dfc5cf))
* **share menu:** remove browser outline ([ba5eca3](https://github.com/plebbit/seedit/commit/ba5eca3a411b0537ca94f1683452cad3e5b5d6e8))
* **share menu:** remove focus outline on open ([686c5b1](https://github.com/plebbit/seedit/commit/686c5b165621ab7a2e52046f574481df60d238c1))
* **sidebar:** fix undefined submit link in pending page ([e9d9fc5](https://github.com/plebbit/seedit/commit/e9d9fc5ec7b7a4d2dd0f43e3d2a2d4730135af7c))
* **sidebar:** hide title section on pending page ([853d88a](https://github.com/plebbit/seedit/commit/853d88a0b9b0b9d2438e7d4dd01caba1c2731576))
* **submit:** subplebbit address wasn't selected by autocomplete ([87fee93](https://github.com/plebbit/seedit/commit/87fee93ebf89a6daecf1ecbb7969c3b9b974a9a3))
* **topbar:** fix z-index, dropdown was behind account bar ([2573be4](https://github.com/plebbit/seedit/commit/2573be40a652e5d04470120044a17af3a6d6400f))


### Features

* add pending post view ([f451bbe](https://github.com/plebbit/seedit/commit/f451bbe744003820b1655d16d892a04daaa8f901))
* **comment tools:** add share menu with share link and links to other clients ([560a90a](https://github.com/plebbit/seedit/commit/560a90aff11024cbbb87a268b1839b34b3bae1b4))
* **comment tools:** clicking on pending comment tools links to its pending page ([0a0d96c](https://github.com/plebbit/seedit/commit/0a0d96c5acf3fbb61deb0ba42aaa53a444f3c247))
* **header:** add inbox header tabs ([1bdfe44](https://github.com/plebbit/seedit/commit/1bdfe447b897c20a58bff70f0bd0d5a1490b8663))
* **header:** add pending page header ([02199c0](https://github.com/plebbit/seedit/commit/02199c0a9046058b06031a12cc83edf9016a98e4))
* **hide menu:** show on replies and collapse reply if blocked ([f31f2b8](https://github.com/plebbit/seedit/commit/f31f2b8dbea0404a70d13e9257e41702b1eb4b7e))
* **inbox:** add filters for "comment replies", "post replies", unread ([ffcfe37](https://github.com/plebbit/seedit/commit/ffcfe37ce6ddb90e53dba7499d2007a57cc7e70c))
* **post:** redirect to post view when cid is received for pending post ([ef1b385](https://github.com/plebbit/seedit/commit/ef1b38570929f69cb8d2bb5627a2039ef4609665))
* **profile:** add functional sort by new or old ([7314db2](https://github.com/plebbit/seedit/commit/7314db28bc795c458106780ee5f7ac884e33f6f4))
* **reply:** add inbox reply design for notifications ([e7daa04](https://github.com/plebbit/seedit/commit/e7daa0488662a743cda4e4a3941df85a2829f65e))
* **search bar:** automatically focus search bar when clicked from account bar ([6ab2ce8](https://github.com/plebbit/seedit/commit/6ab2ce8c99502b70ec5333075c8dd51005c93a38))
* **sidebar:** tell user to create a community with plebbit-cli ([c484783](https://github.com/plebbit/seedit/commit/c484783a207101f75570aa7ff0203c60a2f52fa6))


### Performance Improvements

* **inbox:** filter with useCallback, don't memo result ([9f46922](https://github.com/plebbit/seedit/commit/9f46922c482cff4a6a5762370f2eab9f755d76da))
* **profile:** memoize sorting of comments ([0374c14](https://github.com/plebbit/seedit/commit/0374c1404c903cf39120a4a256e238be233aaf29))



## [0.1.1](https://github.com/plebbit/seedit/compare/v0.1.0...v0.1.1) (2023-12-20)


### Bug Fixes

* **account settings:** do not remove signer ([a3408cc](https://github.com/plebbit/seedit/commit/a3408cc0d92761bd8125d03ae051ea3cb181e3a8))
* **electron:** don't spam user with ipfs errors ([795d390](https://github.com/plebbit/seedit/commit/795d39098a972630064e8a8df22a9ab01b1dec89))
* **post:** fix state string placement ([efa6fef](https://github.com/plebbit/seedit/commit/efa6fef58ab3eb7abc6c0f2525283438b26476d5))
* **profile settings:** signer can be undefined ([b93a72e](https://github.com/plebbit/seedit/commit/b93a72ebb5e4f698ebe720fd12169cfeb2c874f9))
* **reply:** show parent of pending reply ([81efaa7](https://github.com/plebbit/seedit/commit/81efaa76954f79ba46add059ebeadbdad5bdc643))


### Features

* **reply form:** allow posting replies with a link and no content ([158aefe](https://github.com/plebbit/seedit/commit/158aefe13cd49a5cd4aa262a8ec6f68c6983cddc))



# [0.1.0](https://github.com/plebbit/seedit/compare/b902094f009e39db9176b70d07eddf427e4e655e...v0.1.0) (2023-12-18)


### Bug Fixes

* accidental global styling rule ([beadb2c](https://github.com/plebbit/seedit/commit/beadb2cc97a9ca9e8cceeeb4b271fdb64426db84))
* **account bar:** hide submit button on desktop ([8e80474](https://github.com/plebbit/seedit/commit/8e80474303625e0180dd8656eb5ae19067889dd8))
* **account bar:** link to subplebbit-specific submit route ([13f50a7](https://github.com/plebbit/seedit/commit/13f50a74945fe58042d90bb9650164e3121612ef))
* **account bar:** search bar text overlapped icon ([c21dd56](https://github.com/plebbit/seedit/commit/c21dd5606fb1af18570b43a318d25647e288462a))
* **author sidebar:** don't render karma as NaN ([15e8e8b](https://github.com/plebbit/seedit/commit/15e8e8b4aa3b1e85c9b9aa94cb63d72a984e0271))
* **author sidebar:** don't show friends and block if it's the user's own profile ([f928a33](https://github.com/plebbit/seedit/commit/f928a33899d009cf1c98da0a07835f557e3e5966))
* **author:** fix loading string and add ellipsis animation ([78498f7](https://github.com/plebbit/seedit/commit/78498f7b2086150008ac31ac029760718e92a8c6))
* **author:** remove unnecessary redirect to profile ([5491460](https://github.com/plebbit/seedit/commit/54914600ce537de727eccd6e9bf5be50f3ea9728))
* **comment tools:** fix mod tools publishing logic ([17b5913](https://github.com/plebbit/seedit/commit/17b59135a9bd274882a70960caa3d53cdedb334e))
* **comments buttons:** add media rule for mobile ([3164fef](https://github.com/plebbit/seedit/commit/3164fefbcc748a635b3c59b977dfbbe2e653b511))
* **comments buttons:** fix flexbox positioning ([7ee59b9](https://github.com/plebbit/seedit/commit/7ee59b99519bedfc809077aab0e2fff9b9f63565))
* **comments:** wrong useeffect logic ([06d79d8](https://github.com/plebbit/seedit/commit/06d79d8d77ba49b186cd31fd9c7fda65a77d89fd))
* **embed:** wrong srcdoc class syntax prevented some embeds from loading ([f6f0089](https://github.com/plebbit/seedit/commit/f6f0089413897df853f7464faaa7e7ea7094b087))
* **expando:** add line breaks ([4618e6e](https://github.com/plebbit/seedit/commit/4618e6ee02d8b58e25a1ca5b601750c1ca56ea1b))
* **feed post:** add pluralization of reply count ([8ffbe69](https://github.com/plebbit/seedit/commit/8ffbe69866f0c461bc909d8b0215a99c2a5bc388))
* **feed post:** add try block for link hostname ([6f274ed](https://github.com/plebbit/seedit/commit/6f274ed53fe2410df8f1b4751358022380608f3c))
* **feed post:** don't render link url if it's undefined ([7440fe0](https://github.com/plebbit/seedit/commit/7440fe06d9d9acd38ad9bab65e2fa3e960bd4629))
* **feed post:** enable external embed links ([fc9a865](https://github.com/plebbit/seedit/commit/fc9a865958f75219012ab37b10c9ab716c9a1453))
* **feed post:** only show hostname of links ([2147c96](https://github.com/plebbit/seedit/commit/2147c96a9beb3221c8a08ab92f9559a4c10f0538))
* **feed post:** remove 'thumbnail' alt onError for img elements, prettify ([959d5b3](https://github.com/plebbit/seedit/commit/959d5b3f3f1418542a27d668027fa37b28dc0eb7))
* **feed post:** remove www in links ([04b6fc2](https://github.com/plebbit/seedit/commit/04b6fc2bb520cd5d4a9f4d7944c8e902f4942799))
* **feed post:** use Comment type from API in props interface ([1618108](https://github.com/plebbit/seedit/commit/1618108f6f3ef6db2d9b1a8a893375bf81ebdf14))
* **feed post:** use subplebbit.shortAddress instead of slice ([0fd9fbb](https://github.com/plebbit/seedit/commit/0fd9fbb845e6b139d2360510de337bf887f6b4fd))
* **header:** add functionality to profile view buttons ([be3a555](https://github.com/plebbit/seedit/commit/be3a555ff355097623c3997be182d98586f3bc6a))
* **header:** add responsiveness ([0d433ca](https://github.com/plebbit/seedit/commit/0d433caebeec929e7787eceefcfaa82c789c5c6b))
* **header:** adjust mobile positioning ([d1cf663](https://github.com/plebbit/seedit/commit/d1cf663bcd0e7d3c670302cd0ca34207d9c58099))
* **header:** auto select hot short at first load ([bf8add3](https://github.com/plebbit/seedit/commit/bf8add3106a7c6021b36b97ef427de0c0ebbd504))
* **header:** consistent mobile height and padding ([4b63130](https://github.com/plebbit/seedit/commit/4b631308099dcd19546215e9ea1cbcc6a4d9af05))
* **header:** don't select sort type in mobile about page ([6194130](https://github.com/plebbit/seedit/commit/6194130d72ee487e3192621bcca42eecbab93a42))
* **header:** fix buttons positioning, header title size, container height on mobile ([6a69f4e](https://github.com/plebbit/seedit/commit/6a69f4e9e85143277daabac70f86631cde455b48))
* **header:** fix padding, cursor ([908f001](https://github.com/plebbit/seedit/commit/908f001a20a48c4549876c2a4bc52fc06227622c))
* **header:** fix styling z-index, positioning on different languages ([f1e4ed9](https://github.com/plebbit/seedit/commit/f1e4ed9804505c42747507d5cff5c2e27a0363cd))
* **header:** remove "top" sort ([777d4ee](https://github.com/plebbit/seedit/commit/777d4eee707d33686cee2f6e94beb62feafa0737))
* **header:** use transform for pixel decimals ([9aa9d4e](https://github.com/plebbit/seedit/commit/9aa9d4ed0a67c6ab4a5403f7696ccb095aa87c82))
* **header:** wrong assets url for desktop ([9c27746](https://github.com/plebbit/seedit/commit/9c277460b2d55220c00d4f7bd1879cd241cb4a03))
* **home:** add event.preventDefault() for links, adjust styling ([7c1962a](https://github.com/plebbit/seedit/commit/7c1962ad6b25603b924a778aac95c16184cc2009))
* **home:** delay feed rendering until all subscription addresses are fetched, virtuoso seemed to glitch ([7dfa624](https://github.com/plebbit/seedit/commit/7dfa6240e8bdd658376c52fefdf2c29969a23c8a))
* **home:** set max width for statestring for wrap ([df6ad98](https://github.com/plebbit/seedit/commit/df6ad98b2b1e426bb6dd3e022811ec3b2abbc216))
* **label:** wrap for padding, add failed label to feed posts and pending posts, darker colors for dark mode ([1816c30](https://github.com/plebbit/seedit/commit/1816c30a136e3b2f2388e29b4fc8b28fe25e3052))
* **loading ellipsis:** sometimes would display misaligned ([d599b49](https://github.com/plebbit/seedit/commit/d599b49ba8cfd716bd706cfe7f8cd3a7ce95d165))
* **post tools:** cid was rendered as label ([68e1d0b](https://github.com/plebbit/seedit/commit/68e1d0bd2d3c807a93d027ff2a68da861766c5e3))
* **post tools:** default replycount to zero if isNaN ([bab7092](https://github.com/plebbit/seedit/commit/bab7092f5052270e657cf25521a0b59a67f81df8))
* **post tools:** disable reply button for pending replies ([d959093](https://github.com/plebbit/seedit/commit/d959093be0669907d1f1c913204e1c9a815a42f9))
* **post tools:** fix labels spacing ([b32a553](https://github.com/plebbit/seedit/commit/b32a55375dc78a4197b87b327e50c406516fd83f))
* **post tools:** hide reply button on pending reply ([32b557d](https://github.com/plebbit/seedit/commit/32b557dc6117f37231fb66550f3b4fa82a9f084f))
* **post:** add undefined type to cid to show pending label ([8363bd9](https://github.com/plebbit/seedit/commit/8363bd97a914ca6e95abd142534bfea8d197394b))
* **post:** clicking on post title should only link to post page ([3c4d5f4](https://github.com/plebbit/seedit/commit/3c4d5f4c6981aa335f405dd86df7aa8f776ef24e))
* **post:** displayName should link to user, using full address ([96fd07e](https://github.com/plebbit/seedit/commit/96fd07e4bcaaf79d65c59a7bcf13b5aa4079a4cc))
* **post:** don't display "posted to p/" info in subplebbit view ([aa867f4](https://github.com/plebbit/seedit/commit/aa867f470573a285e7ef78f974f54c47514bbae0))
* **post:** fix isInPostView including pending view ([b1acbae](https://github.com/plebbit/seedit/commit/b1acbaefe2e5f5c9949564e3a5d131223ea052d3))
* **post:** fix overflow for verified address css animation ([ec19e72](https://github.com/plebbit/seedit/commit/ec19e7288ba2ad25be177756b1370af3aa346579))
* **post:** fix undefined ([84e836a](https://github.com/plebbit/seedit/commit/84e836a6ddb18d9aac995ae152a1537b47731f6a))
* **post:** fix undefined ([63310c7](https://github.com/plebbit/seedit/commit/63310c74989765bb3a47493ce13d77afaaae995b))
* **post:** footer isn't needed ([17f4533](https://github.com/plebbit/seedit/commit/17f453347d137a9965fddfccb9327740bc2db32a))
* **post:** handle undefined in document title ([16bcb7a](https://github.com/plebbit/seedit/commit/16bcb7a838f9d490332b51ece84b246804af7123))
* **post:** handle undefined values with empty strings ([d7fb21e](https://github.com/plebbit/seedit/commit/d7fb21e7a5ee9c66cf8c4b45872ef1372889e5e7))
* **post:** max title length is 300 chars not 90 ([c95672d](https://github.com/plebbit/seedit/commit/c95672d31b38287835dfc4c44418770f66fc0a48))
* **post:** overflow clip bugs out on webkit ([eb2f293](https://github.com/plebbit/seedit/commit/eb2f293e92105949ae4005e188dd404ad1713100))
* **post:** remove pending reply count ([c882679](https://github.com/plebbit/seedit/commit/c8826796daa5e60e222cf11a34a6893b1ccc1c38))
* **post:** remove unnecessary margin, might glitch virtuoso ([29d22ec](https://github.com/plebbit/seedit/commit/29d22ec0cd2a6475a9a8d200922d149e8b38f91a))
* **post:** state typo caused wrong expando behavior ([9cfa43d](https://github.com/plebbit/seedit/commit/9cfa43d100ff8880c55b3480c8baed9bcf6c45c2))
* **post:** unset overflow on webkit because it adds unwanted margin ([31dc1d2](https://github.com/plebbit/seedit/commit/31dc1d2a0c2be146ac90f974a83ba83a925fc2e3))
* **profile sidebar:** check length of object keys to render conditionally, render 'no posts', prettify ([afa2d61](https://github.com/plebbit/seedit/commit/afa2d610c595d7cb2b05b90c8917625be6516c88))
* **profile sidebar:** default account age to date now, conditionally render mod list ([fd6f4a8](https://github.com/plebbit/seedit/commit/fd6f4a8c5b8ee64917c3ef6470a4aeccca291118))
* **reply form:** textarea overflowed on mobile ([3285e7d](https://github.com/plebbit/seedit/commit/3285e7dd2faf567a250c049703ba6f465a5b8802))
* **reply:** enable author page link, fix undefined ([b4e0722](https://github.com/plebbit/seedit/commit/b4e072249452ba6c5f549f9e7ba823e476b17aec))
* **reply:** ensure failed label only renders if state is failed ([8983b70](https://github.com/plebbit/seedit/commit/8983b702343e3ca4b797f2a2085ec1dd2d396549))
* **reply:** key is better as string of index and cid ([200e5ba](https://github.com/plebbit/seedit/commit/200e5ba1793fb6681977b0b767f65ea090cd4f96))
* **reply:** missing prop ([8681a7e](https://github.com/plebbit/seedit/commit/8681a7e3d797ff5efd7660de09ec5238d0319ece))
* **reply:** only show state string if state is pending ([71c239f](https://github.com/plebbit/seedit/commit/71c239fa1d7208cb573443393f5eb3ccbebcb68b))
* **search bar:** fix warning ([7c465f5](https://github.com/plebbit/seedit/commit/7c465f5d9a5633365b67222b96df70a065e8712c))
* **settings:** adjust logic to check if crypto address is resolved to another account, fix styling ([c1e6731](https://github.com/plebbit/seedit/commit/c1e673116315589b6fb51f7952b74ff7541b9e9f))
* **settings:** handle createAccount async to switch automatically to new account ([f875f27](https://github.com/plebbit/seedit/commit/f875f2784481543ee2899d795b5f873a0f4fcb8e))
* **settings:** misplaced media rule ([fe62aa3](https://github.com/plebbit/seedit/commit/fe62aa3ec3d81cc67a483cac3821ddfc7c64f86b))
* **settings:** wrong account value for alert ([483dbdc](https://github.com/plebbit/seedit/commit/483dbdca57dd898817c37af64964dabc153a2d46))
* **sidebar:** adjust margin if sub has no title ([f0f6d1a](https://github.com/plebbit/seedit/commit/f0f6d1a06540bc34395283947419d935abcf11e9))
* **sidebar:** prevent linking to inexistent route ([b61a15d](https://github.com/plebbit/seedit/commit/b61a15d554bd2b9b79cd422b56881c0e35d4d298))
* **sidebar:** react fragment caused key warning ([78ddf0c](https://github.com/plebbit/seedit/commit/78ddf0c5a84ff6e5cf57b037f30852592edd9e3e))
* **sidebar:** use short address for sub creator, only consider owner as creator ([beae439](https://github.com/plebbit/seedit/commit/beae43934cc429e4706ca36e0d446a52fb1e8483))
* **sort buttons:** add media rule for mobile ([310a215](https://github.com/plebbit/seedit/commit/310a215dbaf30e69aeb7a54dc1c6c496c77d5e3d))
* **sticky header:** don't run sticky menu animation on mobile overscroll behavior ([cfef4d9](https://github.com/plebbit/seedit/commit/cfef4d94703661378899fc43d8d00d932dd9001c))
* **sticky header:** fix overscroll behavior bug, remove debug logs ([8192504](https://github.com/plebbit/seedit/commit/81925047966941dd1e768df35a10c1bc65e0b8aa))
* **sticky header:** hide on desktop ([2a64d4a](https://github.com/plebbit/seedit/commit/2a64d4acbb0639829a53e7e30dbf425330057bea))
* **style:** body background color defaulted to light on dark mode when scrolling fast ([bb0291e](https://github.com/plebbit/seedit/commit/bb0291e686aeeb3b2573b904188d6496be0fe583))
* **submit:** default selected subplebbit title if not found, add margin ([d88f6e3](https://github.com/plebbit/seedit/commit/d88f6e36488b4c966404f17494efc0bd0bfd0b14))
* **submit:** define subplebbitAddress store if automatically filled ([960a2ea](https://github.com/plebbit/seedit/commit/960a2ead2f3b27aa758d37aa140f46b996f14989))
* **submit:** fix type and empty strings instead of undefined ([d3f4ada](https://github.com/plebbit/seedit/commit/d3f4ada96e38aae20a2f7475cb6b8792309d8a39))
* **submit:** handle async state of publishComment ([452029f](https://github.com/plebbit/seedit/commit/452029f7e5ddbf42e8cc111f0bd4e394fe8a042f))
* **submit:** improve logic ([a6d864d](https://github.com/plebbit/seedit/commit/a6d864d9687e08ec1461063827264927ac5c960a))
* **submit:** scroll to top at first load ([e72d6ab](https://github.com/plebbit/seedit/commit/e72d6ab4c109e04068c82aaaf864c651d2ad0435))
* **submit:** selecting a sub address should show its rules ([b54f00a](https://github.com/plebbit/seedit/commit/b54f00ace4a8f991d738749b3d6eb72bbd342a4f))
* **submit:** selecting a sub address shouldn't link to it, hide overflow ([d9c24ad](https://github.com/plebbit/seedit/commit/d9c24ad157a323ff6aba29c83825abcbd8df2728))
* **submit:** selecting a subscription wouldn't show its rules ([f9f622a](https://github.com/plebbit/seedit/commit/f9f622ac6ebbd0314fe784e5600a42711f1bc77c))
* **submit:** use onChange for publishComment store, fix undefined, fix dropdown conditional rendering ([8cb421b](https://github.com/plebbit/seedit/commit/8cb421b56ecc72a8194ad4a68328d260d86f2cf5))
* **subplebbit:** don't render ellipsis for failed string ([a14a93d](https://github.com/plebbit/seedit/commit/a14a93da03aa18ebb6a82d706ec3229d2759c23d))
* **subplebbit:** state string should wrap next to sidebar ([4f07474](https://github.com/plebbit/seedit/commit/4f07474f7081817a97d18700eb0ee233a3d013a2))
* **themes:** don't style placeholder, it bugs out in different browsers ([e66280c](https://github.com/plebbit/seedit/commit/e66280c02f0dfee081da1ae802781f423eccd635))
* **time filter:** close dropdown when choice is selected ([fc29c1e](https://github.com/plebbit/seedit/commit/fc29c1e9bdc87ce9c930eb68990db82ffc53e071))
* **time filter:** wrong ref ([b0418f4](https://github.com/plebbit/seedit/commit/b0418f45282cbc487f024fc565d57a076d468047))
* **topbar:** classname typo ([46e12a5](https://github.com/plebbit/seedit/commit/46e12a578f267e386ae1f068bc33a9e5cc92d556))
* **topbar:** clicking a subscription should close the dropdown ([805b42a](https://github.com/plebbit/seedit/commit/805b42a923c279bcce9e0b89a78bf32003727590))
* **topbar:** close dropdown when choice is selected ([c956f98](https://github.com/plebbit/seedit/commit/c956f980770160d496f74edc657354af85e09188))
* **topbar:** hide scrollbar on chromium and webkit ([e7e696f](https://github.com/plebbit/seedit/commit/e7e696f1832d96b605f9ae382c9119fb1768b99b))
* **topbar:** highlight home button only in homepage ([70be116](https://github.com/plebbit/seedit/commit/70be116798d2cc0d5c8187fdc4a3de083e228191))
* **topbar:** prevent clicking the subs dropdown if there are no subs ([1e6fdff](https://github.com/plebbit/seedit/commit/1e6fdfff27383c555e64b7aa172cebfdf0fff3fe))
* **topbar:** subscriptions didn't highlight on hover ([5d2b20d](https://github.com/plebbit/seedit/commit/5d2b20d3b228789fe42570367dfbd8bfb6464bc3))
* **topbar:** tell user if subscriptions are empty ([8a3b139](https://github.com/plebbit/seedit/commit/8a3b139c55525ae37eb601c629f4185f3b225b9e))
* **topbar:** use shortAddress from API for subscriptions ([1648107](https://github.com/plebbit/seedit/commit/16481074f34df85d1ab943f533c358120e2fe160))
* **topbar:** wrong ref ([53d031e](https://github.com/plebbit/seedit/commit/53d031e72b5272967c118456f4fa52e89d1fc4e9))
* **topbar:** wrong z-index ([dc8e7da](https://github.com/plebbit/seedit/commit/dc8e7da5867335eca9e56073fdd9176a65f03636))
* **use-theme:** forgot to default to light theme, not dark ([3140f82](https://github.com/plebbit/seedit/commit/3140f829bd4f772cdcf457583ec04a7ef42f4893))
* **utils:** remove broken bitchute patternThumbnailUrl ([28705cf](https://github.com/plebbit/seedit/commit/28705cf25d493846732ee3b1b23de4f285c5d31e))
* **utils:** remove unnecessary log ([cff13e5](https://github.com/plebbit/seedit/commit/cff13e5572c069de83de76feb843f48a42733307))
* **view utils:** check timefilterkey when detecting home view ([f1204a7](https://github.com/plebbit/seedit/commit/f1204a77f122c9fe2fab0a8213da52b031c7ec90))


### Features

* **about:** add about view for sidebar on mobile ([b1c4b9b](https://github.com/plebbit/seedit/commit/b1c4b9ba84986b8f16674afa8eb82d73b7da8030))
* **about:** add post-specific about page with post stats ([eaa4d75](https://github.com/plebbit/seedit/commit/eaa4d7513ebd99cf9b5841103cc3d67066cafa89))
* **account bar:** add dropdown with arrow next to username, username is link to user page ([ca939cf](https://github.com/plebbit/seedit/commit/ca939cf42c0ada83eb0c59941cf2d617d893f023))
* **account bar:** add functionality to search bar ([cf7584b](https://github.com/plebbit/seedit/commit/cf7584b42c00138ef48da70a76c5f9aa50e4b746))
* **account bar:** add search bar to connect to a sub ([cc9a040](https://github.com/plebbit/seedit/commit/cc9a040d7c5ec3a0633a729941ab7bc352a7df04))
* **account bar:** change submit link depending on location ([bc2dae7](https://github.com/plebbit/seedit/commit/bc2dae703a4947f364438a416ba5a897fcba1cfb))
* **account bar:** clicking the language name switches the language, for testing ([12afc82](https://github.com/plebbit/seedit/commit/12afc828fd8bbc419da01c5106a2b49d63f3dd36))
* **account settings:** export or import account as json file ([e533317](https://github.com/plebbit/seedit/commit/e5333178a1b34c52c61ad9252152dc0e22ec29a0))
* add complete p/all view ([cd5b617](https://github.com/plebbit/seedit/commit/cd5b617124d28f5ebf3aacd09173f2157a16e924))
* add functional author page ([3c3a4f5](https://github.com/plebbit/seedit/commit/3c3a4f5e767ff618cdb17e7a148930e913f19e81))
* add inbox view, to be tested with publishing ([e90115b](https://github.com/plebbit/seedit/commit/e90115b7486b23a5fb65bed8a03150cabebe1bf5))
* add profile view ([5cd1c03](https://github.com/plebbit/seedit/commit/5cd1c03cc55cdfaf8a56e5402f0db0f31d1f16ca))
* **app:** add routes, comments view, topbar as layout route to prevent it from rerendering ([2cda0dc](https://github.com/plebbit/seedit/commit/2cda0dcdcff62cc0efe4d69b599f50ba31dcb639))
* **app:** update routes ([330c88c](https://github.com/plebbit/seedit/commit/330c88c50d3429608068c636d60bdec66ca271ae))
* **author sidebar:** add author address ([ae319cf](https://github.com/plebbit/seedit/commit/ae319cfe5a3c7a1b4a91395dc0736868741f2d41))
* **author sidebar:** add author post karma estimation ([73c9902](https://github.com/plebbit/seedit/commit/73c99029a46a7a62c6e1763ca9870b63efd3af69))
* **author sidebar:** add block/unblock user ([b79c725](https://github.com/plebbit/seedit/commit/b79c725a477611298e644e44ad2b0d0d275b47a5))
* **author sidebar:** add moderating list for authors, user displayName ([2154e35](https://github.com/plebbit/seedit/commit/2154e3582372d94036e1e7a971fa8cfa9d9aa40d))
* **author sidebar:** add subscribe (friends) button ([0d65f58](https://github.com/plebbit/seedit/commit/0d65f58da7fb46bf1bc2214606fd9fe16b1bb237))
* **author sidebar:** add to author and profile mobile views on top of posts, remove about tab ([1e07ce2](https://github.com/plebbit/seedit/commit/1e07ce2ff99be8acbcc9c507a0da5e450c8ba9d4))
* **author:** add 'comments' (replies) and 'submitted' (posts) tabs and feeds ([9bfa9fe](https://github.com/plebbit/seedit/commit/9bfa9fe2ef27e0305d5947174faf00e3c2427396))
* **author:** add single reply rendering ([bf964c5](https://github.com/plebbit/seedit/commit/bf964c56a6f1ba8cf9ab410dc6cd946f9bc0666b))
* **author:** redirect to profile if author is account ([422ef01](https://github.com/plebbit/seedit/commit/422ef01a9680fd608f9af41daa55594957791c1b))
* **challenge modal:** add functional challenge modal ([d3e8e44](https://github.com/plebbit/seedit/commit/d3e8e44023bb7d76b59d47074b226aa450e43a43))
* **challenge modal:** add title and subtitle to identify post and community ([14cbeb3](https://github.com/plebbit/seedit/commit/14cbeb3825b30b418d4339e2b4fcadcefb3f9dc9))
* **challenge modal:** preview publication content also for votes ([304c313](https://github.com/plebbit/seedit/commit/304c3136b667598ea466762101a3b96345fac29d))
* **comment tools:** add hide tools ([533412f](https://github.com/plebbit/seedit/commit/533412f5174bc03433827ef5b4c2e4f3041dea83))
* **comment tools:** make permalink and context buttons partly functional by linking to the post ([7198e0b](https://github.com/plebbit/seedit/commit/7198e0b5f39afae058c8df95f1f3fa5b1727d4aa))
* **comments:** add comments view ([179d2f5](https://github.com/plebbit/seedit/commit/179d2f54fd12752c26c0065eb3bc2e6c0aa99962))
* **comments:** add replies including nested and reply media ([bf296b6](https://github.com/plebbit/seedit/commit/bf296b64d1ca3c6b5b769fe483afe9f1846331bd))
* **comments:** add textarea section ([832001b](https://github.com/plebbit/seedit/commit/832001bed29058692574298748b8f6c24c0b0407))
* **comments:** add thread op in comments with expanded media and text, no thumbnail ([f140750](https://github.com/plebbit/seedit/commit/f1407502986d4612d9beb91630d65ccb642d8493))
* **electron:** add electron ([b6d5285](https://github.com/plebbit/seedit/commit/b6d5285e2077af67334489374b24dbddaee6596e))
* **feed post:** add audio embed ([2fe0309](https://github.com/plebbit/seedit/commit/2fe03093478ea2c401d2012b4dfab5122f4ba462))
* **feed post:** add buttons ([cac7d19](https://github.com/plebbit/seedit/commit/cac7d19e6d56eb49777586174cafcd8ee40ab535))
* **feed post:** add expandos for posts text content and related buttons ([86331eb](https://github.com/plebbit/seedit/commit/86331eb99abc41dbb0feb80e5753cd36570e17c9))
* **feed post:** add flair ([9e26af4](https://github.com/plebbit/seedit/commit/9e26af485f3535a0d4e3fba77bf66cf992027a2d))
* **feed post:** add iframe embeds ([88c2e1d](https://github.com/plebbit/seedit/commit/88c2e1dc77d4b8b125bffb985bea5d5efc3f559e))
* **feed post:** add images and videos with dimensions from API and wrapper ([1419306](https://github.com/plebbit/seedit/commit/141930615e87e18abd96924a5de2c99c96ec95f5))
* **feed post:** add link contents after scroll optimization ([ac046d5](https://github.com/plebbit/seedit/commit/ac046d511ea9629456a090fd92d6512600992e6d))
* **feed post:** add posts to homepage, initial design, optimized scrolling for virtuoso ([452e06d](https://github.com/plebbit/seedit/commit/452e06dfce8d130779259268dcb83ce0aab50f11))
* **feed post:** translate post UI ([0d08489](https://github.com/plebbit/seedit/commit/0d084891a01861453ff31d9ed95923276930c598))
* **feed post:** translate timestamp ([ef6091c](https://github.com/plebbit/seedit/commit/ef6091ca6cea714d6a0f1b5b29b744baa1b0aa69))
* **header:** add account bar with username ([4e8843b](https://github.com/plebbit/seedit/commit/4e8843ba06d6a1750e2c08ede856b9ecfcd1e463))
* **header:** add horizontal scrolling for overflowing tabs on mobile ([6f08efe](https://github.com/plebbit/seedit/commit/6f08efe5628fccf7f3148573560482e4f32d8317))
* **header:** add settings header, add settings view util ([a3bd954](https://github.com/plebbit/seedit/commit/a3bd954f7fa0510fa34a64266a885bb0d754b7ba))
* **header:** add subscribe button for mobile ([5c0306e](https://github.com/plebbit/seedit/commit/5c0306e23dae600926368de650a4f85f83bcc170))
* **header:** clicking subplebbit avatar takes to subplebbit home ([50a570f](https://github.com/plebbit/seedit/commit/50a570ffbbcf17a6c3006e5529cc49585a528ef9))
* **header:** implement profile view like subplebbit, showing avatar instead of logo ([ad0a955](https://github.com/plebbit/seedit/commit/ad0a955b91fdc68f2f07aec8f581f50af5e3f7f4))
* **header:** subplebbit avatar replaces seedit logo ([0c87e13](https://github.com/plebbit/seedit/commit/0c87e130b1cc8206a7bf0643e469cd15712d8644))
* **header:** use author nft avatar instead of app logo ([91795cf](https://github.com/plebbit/seedit/commit/91795cf32ba9fb55a3b40b5249a2d34ef79305a9))
* **home:** add loading state string for feed ([a3777df](https://github.com/plebbit/seedit/commit/a3777dfd7bc952d698c4d368f2d4774449445582))
* **home:** add sidebar ([138feb1](https://github.com/plebbit/seedit/commit/138feb18e8ed1f82be984fab317efb082d688350))
* **home:** add subscriptions to feed ([4425676](https://github.com/plebbit/seedit/commit/4425676207d9d743e944692f30b9eee2bcaae66c))
* **home:** add top bar with sub lists ([7bb6e48](https://github.com/plebbit/seedit/commit/7bb6e48c90b513852059a06b228192d47f3276af))
* **home:** added header with logo and sort types ([b902094](https://github.com/plebbit/seedit/commit/b902094f009e39db9176b70d07eddf427e4e655e))
* **hooks:** add use-challenges ([1dd1d8c](https://github.com/plebbit/seedit/commit/1dd1d8ca874c282ca11d4182465ed9eaf63c0a61))
* **inbox:** add unread overlay and initial view styling ([82ae452](https://github.com/plebbit/seedit/commit/82ae452e9dd973e14d19e9dd21419f2c8273c657))
* **label:** add failed label for replies, improve position ([9885553](https://github.com/plebbit/seedit/commit/98855537fc2e4ac23b957ef3a6609406ec20becb))
* **pending post:** add pending post component and route ([5ff9d30](https://github.com/plebbit/seedit/commit/5ff9d30821b280c96e8987838c827bc0ef1dccca))
* **pending post:** add state string ([07145fa](https://github.com/plebbit/seedit/commit/07145fa3e1330068a769c9e90e5bb01dfd85414a))
* **post tools label:** add spoiler label next to post tools buttons ([64087f6](https://github.com/plebbit/seedit/commit/64087f611f0d1d86d703c702e0dace2dbc9fc28a))
* **post tools:** add functional mod tools ([8d80863](https://github.com/plebbit/seedit/commit/8d80863991695ce4232175db12deace3b666f259))
* **post tools:** add functional share button ([ea1a201](https://github.com/plebbit/seedit/commit/ea1a201493e883b3e342da30da9deb342422974b))
* **post tools:** add pending label ([ea6202e](https://github.com/plebbit/seedit/commit/ea6202ededc9b775955675843aa9c9d369f6579f))
* **post:** add displayName to post cards ([f149c0d](https://github.com/plebbit/seedit/commit/f149c0d00f7decf88b157fe73d9c953b6cd2a923))
* **post:** add functional upvote and downvote ([c2d2540](https://github.com/plebbit/seedit/commit/c2d25409c0a87311558214ba5c779495b47e8369))
* **post:** add hidden post ([5dd66e7](https://github.com/plebbit/seedit/commit/5dd66e78ce44ed74c7ed4f4afd62a7d2b7c5e273))
* **post:** add loading state string ([f6d3a70](https://github.com/plebbit/seedit/commit/f6d3a70c7a7cecaa44c9c6fcf169fce5e6bb3ace))
* **post:** add moderator role to post card with colors ([56befbf](https://github.com/plebbit/seedit/commit/56befbf4e9b0493e58459ada56930c12c7ffd8e6))
* **post:** add pinned style and "announcement" tag ([f41fe07](https://github.com/plebbit/seedit/commit/f41fe071e4807a9ca012fa034c7b6480584c0d2b))
* **post:** add spoiler to reply form, rename translations, ([4d6d8c0](https://github.com/plebbit/seedit/commit/4d6d8c0ce8aa4b19f40c4e714245f8b00d46e6c1))
* **post:** add url field, fields placeholders, translated ([1f8dc0e](https://github.com/plebbit/seedit/commit/1f8dc0ef957f345cfdbe7a487d02639a06fd9387))
* **post:** clear textarea after publishing a reply ([fb4987a](https://github.com/plebbit/seedit/commit/fb4987a33b87570fff249044dcd90bb8013f5e67))
* **post:** clicking on post title in comments view redirects to link if defined ([362c8fb](https://github.com/plebbit/seedit/commit/362c8fbce3ce53c6a81478457286f5b93ee7ee11))
* **post:** clicking on post title redirects to link if defined, else to the post page ([035d0d9](https://github.com/plebbit/seedit/commit/035d0d9ab08240c00173f8f6123b5bcc1d55acf0))
* **profile settings:** return with alert if crypto address input doesn't include tld ([bda0937](https://github.com/plebbit/seedit/commit/bda0937f6b0b675a40b7380987576b18b166c312))
* **profile:** add 'comments' (replies) and 'submitted' (posts) tabs and feeds ([7a339fe](https://github.com/plebbit/seedit/commit/7a339feb1e5071b666bed91868c5ea78b60e7cae))
* **profile:** add lastVirtuosoState ([d51183f](https://github.com/plebbit/seedit/commit/d51183f709c2296a3b0ed1251db04ca1a6828a53))
* **profile:** add replies to overview feed with parent link ([f71b749](https://github.com/plebbit/seedit/commit/f71b74947c3e7f8228f0586808a4e64366792a82))
* **profile:** add sidebar, about page, styling, header link ([3c919d7](https://github.com/plebbit/seedit/commit/3c919d74ecdaed2d2da6e07efbd2d56d17d05870))
* **profile:** add upvoted and downvoted views ([af2c6b6](https://github.com/plebbit/seedit/commit/af2c6b6e4de6e2e8dd815dbf6641857959ddb5e2))
* **reply form:** add functional reply form component with dynamic rendering for replies of replies ([90499a3](https://github.com/plebbit/seedit/commit/90499a3bc8473cf3439e1ab509cb2958219246b9))
* **reply form:** add options button to show or hide spoiler and url fields ([a4a93a8](https://github.com/plebbit/seedit/commit/a4a93a8ce3dd815015dac6cf42285288dae75710))
* **reply form:** automatically focus the textarea when replying to a reply ([9e104b0](https://github.com/plebbit/seedit/commit/9e104b0ce1c52e62fbc038ae75f8884027be5ed6))
* **reply:** add depth to pending replies ([470a5d6](https://github.com/plebbit/seedit/commit/470a5d624d25fcc832b9d1e8b8bf99abc127ca9f))
* **reply:** add flairs ([8c6f597](https://github.com/plebbit/seedit/commit/8c6f597e87c87e77063bee8ba9322c1ded72c7c1))
* **reply:** add functional upvote and downvote, ensure they don't run for pending comments ([7e4e579](https://github.com/plebbit/seedit/commit/7e4e57965a7d7790aedda9cfc33ae237eb0c5722))
* **reply:** add mod roles and colors to reply card ([4311491](https://github.com/plebbit/seedit/commit/4311491793ad737c8d017e991131e5b90dc5b31b))
* **reply:** add state string to pending replies ([0bb9cfb](https://github.com/plebbit/seedit/commit/0bb9cfba9a5e1c054c891394006d9c8c7d944e74))
* **reply:** click to enlarge effect for images, right/left click difference (route/media link), conditionally rendered expand button and text link for iframe/webpage types ([d729e2d](https://github.com/plebbit/seedit/commit/d729e2d2dee66d917b167ecd2820b03d38402be0))
* **reply:** collapse replies and show children counter ([755efd6](https://github.com/plebbit/seedit/commit/755efd665a78411fd60e2b57f8f75050a9863ad1))
* **reply:** display link embedded in reply above its content, keep embed button ([49d1a32](https://github.com/plebbit/seedit/commit/49d1a32dfb618210788cf715199bb20da9eddd02))
* **reply:** if removed, change the content to "[removed]" ([5d34625](https://github.com/plebbit/seedit/commit/5d346254bf44a5021d819edbf22d0da93545eb7f))
* **reply:** implement vote score, translated ([7873689](https://github.com/plebbit/seedit/commit/7873689ef70661485e0f306e22f637145146cd97))
* **reply:** show cid for reference, and add u/ to user address for consistency ([6d0cbd2](https://github.com/plebbit/seedit/commit/6d0cbd29deb9f1568531fd9875bb8b87884c9516))
* **reply:** use single reply layout for author page, with full comments button and link to OP ([ce74a60](https://github.com/plebbit/seedit/commit/ce74a60708cd726266c0aea13a17d8a21cb04ba7))
* **search bar:** on mobile, hide when clicking outside of it ([dbb1da1](https://github.com/plebbit/seedit/commit/dbb1da194f6a40c005f2a5ca0ddd5d093e5d0ab3))
* **search bar:** show animated expando box when clicking search bar for multiple search functions ([9780f05](https://github.com/plebbit/seedit/commit/9780f0529b3e33349b76c46b7a100ed190f69978))
* **settings:** add functional crypto address setting with resolve check ([1e1fd24](https://github.com/plebbit/seedit/commit/1e1fd245c30b268311710aca1342df3a6232ad35))
* **settings:** add functional settings ([a1e5914](https://github.com/plebbit/seedit/commit/a1e59141b8a316212c25331bd8592d87e6926320))
* **settings:** add functionality to username setting ([c4edf32](https://github.com/plebbit/seedit/commit/c4edf32ca1eb730c74de35f73bf256fe9cca90d7))
* **sidebar:** add block community button ([f4caa56](https://github.com/plebbit/seedit/commit/f4caa56d9b249e0c19c07f2c5ba91b707894fcc8))
* **sidebar:** add create community button ([390680a](https://github.com/plebbit/seedit/commit/390680aaa564c1a7bcc4186f46355bc48004c1b7))
* **sidebar:** add moderators list ([e6b2cc3](https://github.com/plebbit/seedit/commit/e6b2cc32d4c0df24c8dc804b20197d4e89de60cf))
* **sidebar:** add post-specific sidebar with stats ([708b3bb](https://github.com/plebbit/seedit/commit/708b3bb8c8baa788b9cf819b581cc5027a3c7b1f))
* **sidebar:** add rules list ([0c698ba](https://github.com/plebbit/seedit/commit/0c698ba2ce4deab45a3af479dc9006dfe320be25))
* **sidebar:** add search bar for feed filtering ([f1fd4fb](https://github.com/plebbit/seedit/commit/f1fd4fb7c8e7f4e25f33ba06591d37e34371840f))
* **sidebar:** add sidebar ([3e1ab75](https://github.com/plebbit/seedit/commit/3e1ab752aace4ea9f255e550e41da487106f7739))
* **sidebar:** add submit a new post button, move create community button next to it ([eaf46eb](https://github.com/plebbit/seedit/commit/eaf46eb35b46ae66964bec90b9d9aa17eb729c87))
* **sidebar:** tell user if owner role is unset ([004e394](https://github.com/plebbit/seedit/commit/004e394767e8ad317ef145115d24d972f6ed940a))
* **sort dropdown:** add sort UI to author and profile ([4ac0d44](https://github.com/plebbit/seedit/commit/4ac0d4437e4baa1564f3e0d429042e0306dbb21d))
* **sticky header:** add functionality to account select element ([8b1d9f9](https://github.com/plebbit/seedit/commit/8b1d9f96abca76e092832b1cc197291286f6683a))
* **sticky header:** add new design and functionality ([8c12813](https://github.com/plebbit/seedit/commit/8c12813fcf300c1fa38dd4c940d03e619439fcb6))
* **sticky header:** add sorttype navigation, improve styling ([dd5751b](https://github.com/plebbit/seedit/commit/dd5751b66f8c447b22e47375009fec166f7f242a))
* **sticky header:** add sticky menu with animation ([6e93f03](https://github.com/plebbit/seedit/commit/6e93f037de96c3469f8bc559fffe6050e20e6814))
* **sticky header:** disappear when near the top of the page ([02fe2d0](https://github.com/plebbit/seedit/commit/02fe2d0833c937868ef59a7a9a0b8a510300abc1))
* **sticky header:** hide at first load ([6e642e7](https://github.com/plebbit/seedit/commit/6e642e7c51637e241194a623f2fa35081cb2f06c))
* **sticky header:** only show on mobile ([d44289d](https://github.com/plebbit/seedit/commit/d44289df81117bf553b0f869e8a933a69289d534))
* **submit:** add publishing functionality ([a1a2c47](https://github.com/plebbit/seedit/commit/a1a2c470d1ae85c590158d35a53ea20437960e86))
* **submit:** add submit form UI ([5e232e4](https://github.com/plebbit/seedit/commit/5e232e4542c6831d8163d0396e8b553ef7c6cc13))
* **submit:** add submit route, component, button ([b4f5a4a](https://github.com/plebbit/seedit/commit/b4f5a4a01d2c21d8e50d93643ffcac2a62b5f16c))
* **submit:** add subscriptions list to quickly select a sub to post to ([57593b5](https://github.com/plebbit/seedit/commit/57593b564b4b8789a8db7968508d3c4395f5d646))
* **submit:** auto select current sub address ([6edf456](https://github.com/plebbit/seedit/commit/6edf456a035ac315728e5a8fe709fc2f57158bd1))
* **submit:** show subplebbit rules if any as the user types a valid subplebbit address ([42b4bce](https://github.com/plebbit/seedit/commit/42b4bcec5df5b9bddf4a9def69a94de860256c07))
* **submit:** typing sub address shows a dropdown with possible matches of default sub addresses ([fe82d0a](https://github.com/plebbit/seedit/commit/fe82d0a79c11155f334099be17ea8211685ecbd3))
* **subplebbit:** add feed sorting ([6187438](https://github.com/plebbit/seedit/commit/61874382cf013f517695337edaa605ed2bac1ece))
* **subplebbit:** add route and component ([7ae14c4](https://github.com/plebbit/seedit/commit/7ae14c4344fe8bb0d5b41d344c6b454e841d73b0))
* **subplebbit:** add subplebbit feed, enable links to it ([c48cd07](https://github.com/plebbit/seedit/commit/c48cd07d9360c9be6797dbdfd87b9c6acdc558d4))
* **subscribe button:** add functional join/leave button ([e6fd214](https://github.com/plebbit/seedit/commit/e6fd214424ba98f64c6ee58e2b99e99b306546cf))
* **thread:** add loading state string for replies ([619ef97](https://github.com/plebbit/seedit/commit/619ef97ef38c8d8dd37574b3576d6dd625040ec2))
* **time filter:** add time filter UI ([52998e1](https://github.com/plebbit/seedit/commit/52998e1f8d7fb823fd1f460809f87ccdf18dfa1d))
* **time utils:** differentiate between 'time ago' adding function for formatted time duration ([f6aa70b](https://github.com/plebbit/seedit/commit/f6aa70be9d4e0ded63d0e4c8b7bf8d5bf59bba5f))
* **topbar:** add scrollable sub list ([8cee962](https://github.com/plebbit/seedit/commit/8cee9629fc388d1f5c1f4f132d65abe1859ae949))
* **topbar:** display subplebbit addresses from defaults and subs with proper formatting ([647a7ed](https://github.com/plebbit/seedit/commit/647a7ed7d6698ae0fd6b21d989cbba4eadd01db4))
* **topbar:** get sort label translation and display it as dropdown title ([3f053a6](https://github.com/plebbit/seedit/commit/3f053a670359fefffe8bb740a46a6010910e097a))
* **translations:** add ar, es, hi, ja, pt, zh ([cfa8993](https://github.com/plebbit/seedit/commit/cfa89934902e88e467bb977f3306557333aee9d3))
* **translations:** add English and Italian ([a4217a8](https://github.com/plebbit/seedit/commit/a4217a803aa4f591845a5cc1a2e8e6af75b5e43c))
* **translations:** add most spoken languages for a total of 35 ([37d895f](https://github.com/plebbit/seedit/commit/37d895f66185703df9724c9cea332d8f86ec6c17))
* **translations:** add select element for many translations ([862abf1](https://github.com/plebbit/seedit/commit/862abf1b9108fee1521ae3052ce03c457c6f27c8))
* **use-current-view:** add isPendingView ([3e33f50](https://github.com/plebbit/seedit/commit/3e33f501c95048f99e235eea9819fb9be1122bfc))
* **use-pending-replycount:** implement useAccountComments with filter to get total reply count including pending replies ([050dfcc](https://github.com/plebbit/seedit/commit/050dfcce758c47ba123fc082eaef56823e8a9219))
* **use-reply:** implement replying to a post ([34d380e](https://github.com/plebbit/seedit/commit/34d380ecc6a5e9f23d26063751b3598beeec1fdd))
* **use-time-filter:** implement time filters ([3ec7555](https://github.com/plebbit/seedit/commit/3ec75553282270360e0538d3cad646ce174a7339))
* **user utils:** find subplebbit creator for sidebar 'created by' ([c09bae3](https://github.com/plebbit/seedit/commit/c09bae351cd77d70bfdb0817231afac8e19ec9a3))
* **utils:** add alert for failed challenge verification ([a5e8580](https://github.com/plebbit/seedit/commit/a5e8580b2e03c14a9bc8c9486ff0de0ef32adac0))
* **utils:** add isValidENS, isValidIPFS, isValidURL ([99bc823](https://github.com/plebbit/seedit/commit/99bc8230eaaad7a780f9b5899d057acdaac28c52))


### Performance Improvements

* **addresses utils:** use object instead of array for useDefaultAndSubscriptionsSubplebbits ([8ed60f9](https://github.com/plebbit/seedit/commit/8ed60f95d8a1e022b0668b82edb99c8b646e7598))
* **app:** use route outlet for home layout ([e607fa7](https://github.com/plebbit/seedit/commit/e607fa7b33f545ab2863be82923c9cbf5a009f70))
* **comments:** avoid unmounting home by rendering comments as modal in it, so the feed is already loaded when navigating back to it ([dfa4383](https://github.com/plebbit/seedit/commit/dfa4383520b09d9bdf7ba882ae7225b50aec1df1))
* **comments:** memoize isCommentsModalOpen ([0d50537](https://github.com/plebbit/seedit/commit/0d50537fe871f5bb2407242c2664b834e8bb9786))
* **expando:** refactor, only load videos and audios when expanded ([e8d7a22](https://github.com/plebbit/seedit/commit/e8d7a220334af2f9738d0f796f4ad658c7a54d89))
* **feed post:** fix img source impacted scroll performance ([a7fd5dd](https://github.com/plebbit/seedit/commit/a7fd5dd36b9efdad439be474e225e8ca4e87d77a))
* **feed post:** fix virtuoso scrolling smoothness removing all margin and adding render optimizations ([319dd23](https://github.com/plebbit/seedit/commit/319dd23919adeaea5a609ac818827bc8c2b58a72))
* **home:** add overscan to virtuoso ([725a2e4](https://github.com/plebbit/seedit/commit/725a2e42a4f41726df21a342a20401ad03d80038))
* **home:** double increaseViewportBy in Virtuoso so it's harder to reach the bottom of the loaded posts on low resource ([06f5226](https://github.com/plebbit/seedit/commit/06f5226cd6ab1cd80188ee8a6dbc08fdfe34e2c7))
* **home:** when navigating, render comments view instantly by conditionally rendering virtuoso in home ([12c90c7](https://github.com/plebbit/seedit/commit/12c90c702c4a184d5ff4d8a4a01ddef7cbe6b85b))
* **media:** use else if statements instead of dynamic jsx object ([6da0790](https://github.com/plebbit/seedit/commit/6da0790367e75afb4584f41ad11325c0e255fe2d))
* **post:** use verified addresses with css effect to avoid virtuoso glitch ([c739801](https://github.com/plebbit/seedit/commit/c7398014b29fe00f5135e785a34d09c07161713e))
* **profile settings:** better state management ([fcd2d6c](https://github.com/plebbit/seedit/commit/fcd2d6c7d7954c44559d446d5c4f785640ca60ea))
* **profile settings:** pre-load address resolve, only show status when clicking check, reset state after clicking save ([b7e059b](https://github.com/plebbit/seedit/commit/b7e059b469555acd7e7e2f976d22a8832840b508))
* reduce calls of bitsocial-react-hooks ([c1514a9](https://github.com/plebbit/seedit/commit/c1514a98829156713ca0498ab2fcfe80fefed538))
* **sidebar:** use components instead of variables for conditional rendering ([7f73939](https://github.com/plebbit/seedit/commit/7f73939906f6680597b0284d8dbf63f3bb9e205d))
* **use-default-subplebbits:** cache hook for faster navigation ([1fc9fce](https://github.com/plebbit/seedit/commit/1fc9fce32006611d9e9ba9e448eaee7ec520a9c4))
* **use-default-subplebbits:** optimize cache ([9673b08](https://github.com/plebbit/seedit/commit/9673b08a0dd53b790c3ef60ff60ffb492efe7ba5))
* **use-default-subplebbits:** switch to multisub.json and return cache for faster navigation ([35846f7](https://github.com/plebbit/seedit/commit/35846f766fc84aaa98c4912b9a143d6244ae93f2))


### Reverts

* Revert "chore(package.json): upgrade bitsocial-react-hooks" ([2307bc2](https://github.com/plebbit/seedit/commit/2307bc23c7a46e148bc682c263fa7cb36e4cc7d5))
* Revert "chore(translations): translate "settings", rename account_bar_preferences to settings" ([d79f5dd](https://github.com/plebbit/seedit/commit/d79f5ddf98ab19306219748081b479b266521110))
* Revert "style(header): remove wiki button, because of inconsistent UI and not enough space" ([e940379](https://github.com/plebbit/seedit/commit/e94037990f6ed35b2ed6cf3fc3ab4894904892c2))
* Revert "style: convert all css modules to scss" ([f1dfafe](https://github.com/plebbit/seedit/commit/f1dfafeb5e7d8b0fa6af273639e18181cc3236c8))



