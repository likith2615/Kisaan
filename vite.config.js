import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest lets us write our own service worker (needed for push events)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      manifest: {
        id: '/kisan-saathi',
        name: 'Kisan Saathi - Farmer Procurement Portal',
        short_name: 'KisanSaathi',
        description: 'Book mandi slots, track crop procurement, receive MSP payment directly. Government of India.',
        theme_color: '#046A38',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/?source=pwa',
        prefer_related_applications: false,
        categories: ['agriculture', 'productivity', 'government'],
        lang: 'en-IN',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        screenshots: [
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ],
        // Push notification permissions pre-declared
        permissions: ['notifications', 'push']
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },

      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      }
    }),
  ],

  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  define: {
    // Expose VAPID public key to frontend
    '__VAPID_PUBLIC_KEY__': JSON.stringify(
      process.env.VITE_VAPID_PUBLIC_KEY ||
      'BATxs7rXeFG9CkF9CSIfq7OQGTYGY51s5c3bRBUI85a7iQtEHlS5ZRbhJxdg0WgcnOks9FnxQqHxZ_M84ZD7YHw'
    )
  }
});
