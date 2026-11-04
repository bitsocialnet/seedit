import { downloadIpfsClients } from './electron/before-pack.js';

const config = {
  packagerConfig: {
    name: 'seedit',
    executableName: 'seedit',
    appBundleId: 'seedit.desktop',
    icon: './public/icon', // electron-forge adds the correct extension per platform

    // tens of thousands of loose node_modules files make Squirrel's nuget pack take ~14 minutes;
    // native modules, their shared libraries and the kubo binary stay on disk so they can be loaded and spawned
    asar: {
      unpack: '{*.node,*.dll,*.dylib,*.so}',
      unpackDir: 'bin',
    },

    // Exclude unnecessary files from the package
    ignore: [
      /^\/src$/,
      /^\/public$/,
      /^\/android$/,
      /^\/\.github$/,
      /^\/scripts$/,
      /^\/\.git/,
      // exclude the local data dir
      /^\/\.pkc$/,
      // exclude the local codegraph index; its daemon socket cannot be copied
      /^\/\.codegraph$/,
      // exclude agent, tooling, deploy and docs files that only matter during development
      /^\/\.agents$/,
      /^\/\.claude$/,
      /^\/\.codex$/,
      /^\/\.cursor$/,
      /^\/\.firecrawl$/,
      /^\/\.playwright-cli$/,
      /^\/\.react-perf$/,
      /^\/\.vercel$/,
      /^\/\.yarn$/,
      /^\/\.nvmrc$/,
      /^\/\.yarnrc\.yml$/,
      /^\/build-profile$/,
      /^\/dev-dist$/,
      /^\/docs$/,
      /^\/knip\.jsonc$/,
      /^\/react-doctor\.config\.json$/,
      /^\/vercel\.json$/,
      /^\/out$/,
      /^\/dist$/,
      /^\/squashfs-root$/,
      /\.map$/,
      /\.md$/,
      /\.ts$/,
      /tsconfig\.json$/,
      /\.oxfmtrc/,
      /oxlintrc/,
      /vite\.config/,
      /forge\.config/,
      /capacitor\.config/,
      /\.env$/,
      // env files written by tools such as `vercel env pull` can hold tokens
      /\/\.env\.[^/]+$/,
      /\.DS_Store$/,
      /yarn\.lock$/,
      // Exclude build-time scripts from the package
      /electron\/before-pack\.js/,
      // Exclude .bin directories anywhere in node_modules (contain escaping symlinks)
      /node_modules\/.*\/\.bin/,
      /node_modules\/\.bin/,
      /node_modules\/\.cache/,
    ],
  },

  rebuildConfig: {
    force: true,
  },

  hooks: {
    // Download IPFS/Kubo binaries before packaging
    generateAssets: async (forgeConfig, platform, arch) => {
      console.log('Downloading IPFS clients...');
      await downloadIpfsClients({ platform, arch });
      console.log('IPFS clients downloaded.');
    },
  },

  makers: [
    // macOS
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'seedit',
        icon: './public/icon.png',
        format: 'UDZO',
      },
    },
    {
      // on win32 this zip is the portable build: extract it and run seedit.exe, no installer needed
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    // Windows
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'seedit',
        // must be a real multi-size ICO: favicon.ico is PNG data, which makes Squirrel fail with "Unable to set icon"
        setupIcon: './public/icon.ico',
      },
    },
    // Linux
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      config: {
        options: {
          name: 'seedit',
          icon: './public/icon.png',
          categories: ['Network'],
        },
      },
    },
  ],
};

export default config;
