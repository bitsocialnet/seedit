import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isProfilingBuild = process.env.REACT_PERF_PROFILE === '1';

export default defineConfig({
  test: {
    // These fixtures use node:test and run in the dedicated Jev helper workflow.
    exclude: [...configDefaults.exclude, 'scripts/jev/tests/**'],
  },
  plugins: [
    react({
      babel: {
        plugins: [
          [
            'babel-plugin-react-compiler',
            {
              verbose: true,
            },
          ],
        ],
      },
    }),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
      include: ['crypto', 'stream', 'util', 'buffer', 'events'],
    }),
    VitePWA({
      disable: isProfilingBuild || process.env.REACT_PERF_RUN === '1',
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 20000000,
      },
      srcDir: 'src',
      filename: 'sw.ts',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      // index.html links public/manifest.json, and a browser only reads the first
      // manifest link, so generating a second one here would be dead weight.
      manifest: false,
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/_(.*)/],
        maximumFileSizeToCacheInBytes: 6000000,
        runtimeCaching: [
          // Fix index.html not refreshing on new versions
          {
            urlPattern: ({ url }) => url.pathname === '/' || url.pathname === '/index.html',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'html-cache',
            },
          },
          // PNG caching
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.png'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
              },
            },
          },
          // Add additional asset caching
          {
            urlPattern: /\.(?:js|css|woff2?|svg|gif|jpg|jpeg)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          // Google Fonts caching
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      ...(isProfilingBuild ? [{ find: /^react-dom\/client$/, replacement: 'react-dom/profiling' }] : []),
      {
        find: /^@\//,
        replacement: `${resolve(__dirname, 'src')}/`,
      },
      {
        // bitsocial-react-hooks imports zustand/shallow's deprecated default export and
        // passes it as a store equality fn, so its console.warn fires on every comparator
        // call (~1000/s while feeds stream). Redirect to an unwrapped re-export.
        find: 'zustand/shallow',
        replacement: resolve(__dirname, 'src/lib/zustand-shallow-shim.ts'),
      },
      {
        find: 'node-fetch',
        replacement: 'isomorphic-fetch',
      },
      {
        find: 'assert',
        replacement: 'assert',
      },
      {
        find: 'stream',
        replacement: 'stream-browserify',
      },
      {
        find: 'crypto',
        replacement: 'crypto-browserify',
      },
      {
        find: 'buffer',
        replacement: 'buffer',
      },
      {
        find: 'util/',
        replacement: 'util',
      },
      {
        find: 'util',
        replacement: 'util',
      },
    ],
  },
  server: {
    port: 3000,
    open: process.env.REACT_PERF_RUN === '1' || process.env.PORTLESS_URL ? false : true,
    watch: {
      usePolling: true,
    },
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Use 'build' to match what electron/main.js expects (../build/index.html)
    outDir: isProfilingBuild ? 'build-profile' : 'build',
    emptyOutDir: true,
    sourcemap: isProfilingBuild || process.env.GENERATE_SOURCEMAP === 'true',
    ...(isProfilingBuild ? { minify: false } : {}),
    target: process.env.ELECTRON ? 'electron-renderer' : 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|react-i18next|i18next|i18next-browser-languagedetector|i18next-http-backend)[\\/]/.test(id)) {
            return 'vendor';
          }
        },
      },
    },
  },
  base: process.env.PUBLIC_URL || '/',
  optimizeDeps: {
    include: ['ethers', 'assert', 'buffer', 'process', 'util', 'stream-browserify', 'isomorphic-fetch', 'workbox-core', 'workbox-precaching'],
  },
  define: {
    'process.env.VITE_COMMIT_REF': JSON.stringify(process.env.COMMIT_REF),
    global: 'globalThis',
    __dirname: '""',
  },
});
