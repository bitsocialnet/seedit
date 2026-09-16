[![Build Status](https://img.shields.io/github/actions/workflow/status/bitsocialnet/seedit/test.yml?branch=master)](https://github.com/bitsocialnet/seedit/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/bitsocialnet/seedit)](https://github.com/bitsocialnet/seedit/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](https://github.com/bitsocialnet/seedit/blob/master/LICENSE)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

<p>
  <img src="public/assets/sprout/sprout.png" alt="" height="72" align="middle">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/sprout/seedit-text-dark.svg">
    <img src="public/assets/sprout/seedit-text-light.svg" alt="Seedit" height="44" align="middle">
  </picture>
</p>

_Telegram group for this repo https://t.me/seeditreact_

# Seedit

Seedit is a serverless, adminless, decentralized and open-source (old)reddit alternative built on the [Bitsocial protocol](https://bitsocial.net). Like reddit, anyone can create a community and browse a front page of the communities they joined. Unlike reddit, **every community is independently owned and hosted by its own peer-to-peer node**, and a subscription points directly at that community's address instead of at a platform account.

## Key Features

### Independently Owned Communities

Seedit has no global administrator and no backend to sign up to. A community is a Bitsocial community run by its owner's own node; the owner controls its content, moderation, rules, and anti-spam challenges. The web app is a static app shell: it loads from any host, and all community data arrives from peers.

Your identity is a local key pair, not an account on a server. Subscriptions, votes, and drafts live in your client and travel with you between Bitsocial clients.

### Contested Short Routes, Durable Subscriptions

Short discovery routes are separate from subscriptions. A route such as `/s/pics` always opens the finalized winner of the `pics` directory, so a valuable short name is not permanently owned by whoever registered it first, and no global administrator hands it out. The topbar therefore shows `pics` regardless of the winner's exact address.

Joining from that route subscribes to the winner's **exact** community address. A later winner change never silently replaces the subscription: Seedit offers to switch, keep both, or keep the current community, and automatic switching is an explicit per-directory preference that leaves an undoable notice. Post permalinks also use exact addresses, so shared links stay durable.

The directory model is designed for decentralized voting. During bootstrap, finalized snapshots are published through [bitsocialnet/lists](https://github.com/bitsocialnet/lists). See the [directory routes architecture decision](docs/architecture/directory-routes.md) for the complete model, including snapshot rules and rejected alternatives.

### The old.reddit Interaction Language

Seedit keeps the interface it is named after: dense feed rows, the familiar voting and metadata order, square legacy controls, small browser-native typography, sort tabs and time filters, a practical sidebar, and light/dark themes built from the same token set. Feeds, comment trees, the inbox, user profiles, moderation queues, and community settings all follow that vocabulary rather than a crypto dashboard. The visual system is documented in [DESIGN.md](DESIGN.md), and the product intent in [PRODUCT.md](PRODUCT.md).

### Search

The search box matches communities from the lists Seedit ships, from your own subscriptions, and from an archive indexer ([seeditarchive.org](https://seeditarchive.org)), merged and deduplicated; the same indexer supplies post and comment results. Old.reddit's advanced-search prefixes work in the query — `community:`, `author:`, `url:`, `site:`, `selftext:`, `nsfw:`, `self:` — and stay in the shareable URL. Indexed search is a convenience layer over a peer-to-peer network: browsing, posting, and voting do not depend on it.

### Seedit Gold

`seedit gold` is a planned yearly supporter subscription. It is **not available yet** — there is nothing to buy, activate, or renew today. When it launches, gold holders will publish without solving a challenge on communities that support the gold challenge, and will be eligible to vote on directory pages. The in-app `/gold` page is the maintained FAQ.

## Downloads

- **Web version**: https://seedit.app — or, using Brave/IPFS Companion: https://seedit.eth
- **Desktop version** (full P2P bitsocial node, seeds automatically): available for Mac/Windows/Linux, [download from the release page](https://github.com/bitsocialnet/seedit/releases/latest)
- **Mobile version**: available for Android, [download from the release page](https://github.com/bitsocialnet/seedit/releases/latest)

## Run Seedit in Your Browser With a Local Node

If you want the full P2P node but prefer opening Seedit in your normal browser instead of using the desktop app, use [bitsocial-cli](https://github.com/bitsocialnet/bitsocial-cli). It runs the Bitsocial/IPFS node and serves a bundled Seedit Web UI locally, so you do not need to run this repository separately.

```sh-session
npm install -g @bitsocial/bitsocial-cli
bitsocial daemon
```

When the daemon starts, it prints a `WebUI (seedit - Similar to old reddit UI)` URL. Open that URL in your browser to use Seedit through your local node. See the [bitsocial-cli daemon docs](https://github.com/bitsocialnet/bitsocial-cli#running-daemon) for details.

## Creating a Community

A community must be created on a bitsocial node, because the node is what hosts and seeds it. There are two ways:

1. **GUI** — download the [desktop version of Seedit](https://github.com/bitsocialnet/seedit/releases/latest) for Windows, macOS, or Linux. It runs its own IPFS node, so you can create a community from the familiar old.reddit-style UI and edit its settings, roles, and challenges in place. The app has to keep running for your community to stay online.
2. **Command line** — install [bitsocial-cli](https://github.com/bitsocialnet/bitsocial-cli) and follow its readme. The daemon prints WebUI links on first run, so you can manage the community you created with the same GUI.

Once created, peers can connect to your community from any bitsocial client, such as Seedit or [5chan](https://github.com/bitsocialnet/5chan), using only the community address. That address is not stored in any central database — bitsocial is a pure peer-to-peer protocol.

## Getting Your Community Discovered

Seedit's versioned default communities are published in Bitsocial's [seedit-default-subscriptions.json list](https://github.com/bitsocialnet/lists/blob/master/seedit-default-subscriptions.json). New accounts subscribe to that list by default; when it changes, existing users review the update and choose which additions to join, and Seedit never removes a manually chosen subscription.

To propose a community, open a pull request in [bitsocialnet/lists](https://github.com/bitsocialnet/lists). A community is a realistic candidate when it is active, well moderated, and close to always reachable — a community is its own server, so its uptime is your node's uptime.

Directory assignment only affects discovery. Even without it, anyone can reach your community at any time through its address, the search box, or a subscription.

## Development

### Prerequisites

- Node.js 22.12.0, pinned in [`.nvmrc`](./.nvmrc)
- Corepack enabled once per machine: `corepack enable`

### Contributor Setup

1. `nvm install && nvm use`
2. `corepack enable` (once per machine)
3. Use plain `yarn install`, `yarn build`, and `yarn test` from then on — never npm, so `yarn.lock` stays valid

### Run Locally

1. `yarn install` to install Seedit dependencies
2. `yarn start` to run the web client

The dev server runs at https://seedit.localhost via [Portless](https://github.com/vercel-labs/portless), which gives each Bitsocial project a stable, named URL instead of a random port, and serves it through an HTTPS proxy on port 443. On non-`master` branches, or when another process already holds the canonical route, `yarn start` automatically uses a branch-scoped `*.seedit.localhost` URL instead of failing, suffixing (`-2`, `-3`, ...) until it finds a free route. To bypass Portless and use plain Vite, run `PORTLESS=0 yarn start`; it probes from port `3000` unless you pin `PORT` yourself.

### Scripts

- **Web client**: `yarn start` (https://seedit.localhost)
- **Electron client** (must start web client first): `yarn electron`
- **Electron client** (don't delete data): `yarn electron:no-delete-data`
- **Web client and electron client**: `yarn electron:start` (forces `PORTLESS=0 PORT=3000` and uses http://localhost:3000)
- **Web client and electron client** (don't delete data): `yarn electron:start:no-delete-data`
- **Android client** (builds, syncs Capacitor, runs on a device or emulator): `yarn android:build`

### Checks

- **Tests**: `yarn test`
- **Lint and module boundaries**: `yarn lint`
- **Types**: `yarn type-check`
- **Build, lint, types, React diagnostics, and runtime performance scenarios**: `yarn agent:verify` (run `yarn perf:install` once first)

Module layering is enforced: `src/views` composes pages, `src/components` holds reusable UI, and `src/hooks`, `src/stores`, `src/lib`, and `src/data` sit below them, with imports flowing one way. `yarn boundaries` (part of `yarn lint`) fails on a violation. See [src/AGENTS.md](src/AGENTS.md) for the rules and [AGENTS.md](AGENTS.md) for the wider contributor workflow.

### Build

The Linux/Windows/macOS/Android build scripts are in [.github/workflows/release.yml](https://github.com/bitsocialnet/seedit/blob/master/.github/workflows/release.yml). Each release also publishes the static web build as `seedit-html-<version>.zip`, together with a signed release manifest that lets you verify the files you downloaded.

## License

Seedit is open-source software (GPL-3.0-or-later) with no owner — anyone can host their own instance on any domain. The operator of any domain is merely hosting the web app and does not own, create, moderate, or control Seedit or any community content, which is stored peer-to-peer and generated by community owners and users.
