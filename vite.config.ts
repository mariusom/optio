import tailwindcss from '@tailwindcss/vite'
import { foldkit } from '@foldkit/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite-plus'

// Deployed to GitHub Pages project site: https://mariusom.github.io/optio/
export default defineConfig({
  base: '/optio/',
  server: { port: 60_001 },
  worker: { format: 'es' },
  plugins: [
    tailwindcss(),
    foldkit(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'optio — ox-alpha experiment',
        short_name: 'optio',
        description: 'Offline Hello World built with FoldKit, LiveStore, Effect RC and Vite+',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,wasm}'],
      },
    }),
  ],
  optimizeDeps: {
    // Required by LiveStore's web adapter (see @livestore/adapter-web README)
    exclude: ['@livestore/wa-sqlite'],
  },
})
