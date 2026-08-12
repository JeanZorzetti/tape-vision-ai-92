import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  webServer: {
    // The Vercel adapter's build output isn't servable via `astro preview`. `astro dev`
    // would work for pages, but it injects the dev toolbar (pollutes DOM assertions
    // like h1 counts) and never generates the sitemap (a build-time-only artifact).
    // These smoke tests never hit /api/*, so serving the real static build output is
    // both correct and simplest.
    command: 'npm run build && npm run preview:static',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4321',
  },
});
