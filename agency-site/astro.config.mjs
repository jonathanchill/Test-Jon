// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const site = process.env.PUBLIC_SITE_URL || 'https://oppositenumber.ai';

export default defineConfig({
  site,
  trailingSlash: 'never',
  integrations: [sitemap({ filter: (page) => !page.includes('/thanks') && !page.includes('/appointment-thanks') && !page.includes('/404') })],
  vite: { plugins: [tailwindcss()] },
  build: { format: 'file' },
  prefetch: { prefetchAll: true },
});
