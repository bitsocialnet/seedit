import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import reactScan from '@react-scan/vite-plugin-react-scan';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export default defineConfig({
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
    // Only include React Scan in development mode - never in production builds
    !isProduction &&
      reactScan({
        showToolbar: true,
        playSound: true,
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
      manifest: {
        name: 'Seedit',
        short_name: 'Seedit',
        description: 'A serverless, adminless, decentralized reddit alternative',
        theme_color: '#ffffff',
        background_color: '#ffffee',
        display: 'standalone',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
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
    alias: {
      '@': resolve(__dirname, 'src'),
      'node-fetch': 'isomorphic-fetch',
      assert: 'assert',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
      'util/': 'util',
      util: 'util',
    },
  },
  server: {
    port: 3000,
    open: process.env.PORT ? 'http://seedit.localhost:1355/' : true,
    watch: {
      usePolling: true,
    },
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Use 'build' to match what electron/main.js expects (../build/index.html)
    outDir: 'build',
    emptyOutDir: true,
    sourcemap: process.env.GENERATE_SOURCEMAP === 'true',
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
