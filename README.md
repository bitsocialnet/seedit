[![Build Status](https://img.shields.io/github/actions/workflow/status/bitsocialhq/seedit/test.yml?branch=master)](https://github.com/bitsocialhq/seedit/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/bitsocialhq/seedit)](https://github.com/bitsocialhq/seedit/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--2.0--only-red.svg)](https://github.com/bitsocialhq/seedit/blob/master/LICENSE)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

<img src="https://github.com/plebeius-eth/assets/blob/main/seedit-logo.png" width="302" height="111">

_Telegram group for this repo https://t.me/seeditreact_

# Seedit

Seedit is a serverless, adminless, decentralized and open-source (old)reddit alternative built on the [Bitsocial protocol](https://bitsocial.net). Like reddit, anyone can create a seedit community, It features a similar homepage structure as reddit, but with a crucial difference: **anyone can create and own communities, and multiple communities can compete for each default community slot**.

- Seedit web version: https://seedit.app — or, using Brave/IPFS Companion: https://seedit.eth

### Downloads
- Seedit desktop version (full p2p bitsocial node, seeds automatically): available for Mac/Windows/Linux, [download link in the release page](https://github.com/bitsocialhq/seedit/releases/latest)
- Seedit mobile version: available for Android, [download link in the release page](https://github.com/bitsocialhq/seedit/releases/latest)

<br />

<img src="https://github.com/plebeius-eth/assets/blob/main/seedit-screenshot.jpg" width="849">

## How to create a community
To run a community, you can choose between two options:

1. If you prefer to use a **GUI**, download the desktop version of the Seedit client, available for Windows, MacOS and Linux: [latest release](https://github.com/bitsocialhq/seedit/releases/latest). Create a community using using the familiar old.reddit-like UI, and modify its settings to your liking. The app runs an IPFS node, meaning you have to keep it running to have your board online.
2. If you prefer to use a **command line interface**, install bitsocial-cli, available for Windows, MacOS and Linux: [latest release](https://github.com/bitsocialhq/bitsocial-cli/releases/latest). Follow the instructions in the readme of the repo. When running the daemon for the first time, it will output WebUI links you can use to manage your community with the ease of the GUI.

Peers can connect to your bitsocial community using any bitsocial client, such as Seedit or [5chan](https://github.com/bitsocialhq/5chan). They only need the community address, which is not stored in any central database, as bitsocial is a pure peer-to-peer protocol.

### How to add a community to the default list (s/all)
The default list of communities, used on s/all on Seedit, is bitsocial's [default-multisub.json list](https://github.com/bitsocialhq/lists/blob/master/default-multisub.json). You can open a pull request in that repo to add your community to the list.

## To run locally

1. Install Node v22 (Download from https://nodejs.org)
2. Install Yarn: `npm install -g yarn`
3. Install [Portless](https://github.com/vercel-labs/portless): `npm install -g portless`
4. `yarn install --frozen-lockfile` to install Seedit dependencies
5. `yarn start` to run the web client

The dev server runs at http://seedit.localhost:1355 via [Portless](https://port1355.dev/), which gives each Bitsocial project a stable, named URL instead of a random port. To bypass Portless and use a plain Vite dev server: `PORTLESS=0 yarn start`

### Scripts:

- Web client: `yarn start` (http://seedit.localhost:1355)
- Electron client (must start web client first): `yarn electron`
- Electron client and don't delete data: `yarn electron:no-delete-data`
- Web client and electron client: `yarn electron:start`
- Web client and electron client and don't delete data: `yarn electron:start:no-delete-data`

### Build:

The linux/windows/mac/android build scripts are in https://github.com/bitsocialhq/seedit/blob/master/.github/workflows/release.yml
