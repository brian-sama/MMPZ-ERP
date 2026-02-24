import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['logo.jpg'],
    //   manifest: {
    //     name: 'MMPZ M&E System',
    //     short_name: 'MMPZ',
    //     description: 'Monitoring and Evaluation System',
    //     theme_color: '#6B21A8',
    //     background_color: '#F9FAFB',
    //     display: 'standalone',
    //     icons: [
    //       {
    //         src: '/logo.jpg',
    //         sizes: '192x192',
    //         type: 'image/jpeg'
    //       },
    //       {
    //         src: '/logo.jpg',
    //         sizes: '512x512',
    //         type: 'image/jpeg'
    //       }
    //     ]
    //   },
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,webp}']
    //   }
    // })
  ],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
