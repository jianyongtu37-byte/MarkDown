import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Markdown知识库',
        short_name: '知识库',
        description: '一个简洁高效的Markdown文档管理系统',
        theme_color: '#f54e00',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // 强制新 SW 立即激活，不等待旧 SW 控制的标签页关闭
        skipWaiting: true,
        clientsClaim: true,
        // 清理旧版本遗留的预缓存
        cleanupOutdatedCaches: true,
        // 不缓存 API 请求 — 认证接口被 SW 缓存会导致过期 token/旧 401 响应被复用
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*$/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
