import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'prepology_logo.png'],
      manifest: {
        name: 'Prepology - SAT Prep Platform',
        short_name: 'Prepology',
        description: 'A comprehensive SAT prep platform with real question bank integration, adaptive practice, and detailed rationale feedback.',
        theme_color: '#0b0f1a',
        background_color: '#0b0f1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/prepology_logo.png',
            sizes: '500x500',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/questions-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/questions\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'prepology-questions',
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/questions-'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'prepology-questions-chunk',
            },
          },
        ],
      },
    }),
  ],
});
