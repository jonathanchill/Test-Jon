import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The GitHub repository name. The site is served from
// https://<username>.github.io/<REPO_NAME>/ so every asset path must start
// with /<REPO_NAME>/. Change this one value if the repo is renamed.
export const REPO_NAME = 'Test-Jon';

export default defineConfig({
  base: process.env.VITE_BASE ?? `/${REPO_NAME}/`,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
