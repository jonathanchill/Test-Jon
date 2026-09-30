import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// The GitHub repository name. The site is served from
// https://<username>.github.io/<REPO_NAME>/ so every asset path must start
// with /<REPO_NAME>/. Change this one value if the repo is renamed.
export const REPO_NAME = 'Test-Jon';

const base = process.env.VITE_BASE ?? `/${REPO_NAME}/`;

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'French practice',
        short_name: 'Français',
        description: 'Drills built from lesson notes: grammar, vocabulary, listening.',
        lang: 'en-GB',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The whole app, content included, is in these files; precache them all.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt}'],
        // A hash URL never reaches the server, but a refresh of /Test-Jon/ must
        // be served from the cache when offline.
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
