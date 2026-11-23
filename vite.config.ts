import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import { constants } from 'zlib'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    BUILD_TIME: JSON.stringify(new Date())
  },
  plugins: [
    vue(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 5120,
      deleteOriginFile: false,
      compressionOptions: {
        level: 9
      }
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 5120,
      deleteOriginFile: false,
      compressionOptions: {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11
        }
      }
    })
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/') || id.includes('node_modules/vue-router/')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/xlsx-js-style')) {
            return 'xlsx-vendor'
          }
          if (id.includes('node_modules/decimal.js') || id.includes('node_modules/papaparse') || id.includes('node_modules/js-yaml')) {
            return 'data-vendor'
          }
          if (id.includes('node_modules/marked')) {
            return 'ui-vendor'
          }
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    assetsInlineLimit: 8192,
    reportCompressedSize: true,
    sourcemap: false
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'decimal.js',
      'papaparse',
      'js-yaml',
      'marked',
      'xlsx',
      'xlsx-js-style'
    ]
  },
  server: {
    hmr: true,
    host: '0.0.0.0',
    /**
     * 本地开发时把 /api/2027/* 代理到比赛系统，避免每次都要部署后才能调试
     * 上传页（UploadSystem2027）与管理后台（Admin2027）。
     *
     * 两种目标模式：
     * 1) 默认：直连线上官网的 /api/2027/ 前缀（生产架构中 2027 已无独立域名，
     *    只能经官网域名的 /api/2027/ 访问）。此时路径保持原样，由线上 Nginx 完成映射。
     * 2) 本地比赛系统：设置 MWCUP_2027_ORIGIN=http://127.0.0.1:7227 后，按生产
     *    Nginx 的规则在本地完成路径映射（download/musics/manage_logout 例外）。
     */
    proxy: (() => {
      const env = loadEnv(mode, process.cwd(), '')
      const localOrigin = env.MWCUP_2027_ORIGIN || process.env.MWCUP_2027_ORIGIN
      const target = localOrigin || 'https://mwcup.marioforever.net'
      return {
        '/api/2027': {
          target,
          changeOrigin: true,
          secure: true,
          // 指向本地 uvicorn 时，按生产规则映射路径；指向线上则原样转发
          rewrite: localOrigin
            ? (path: string) => {
              if (path.startsWith('/api/2027/download/')) return path.replace('/api/2027', '')
              if (path.startsWith('/api/2027/musics/')) return path.replace('/api/2027', '')
              if (path === '/api/2027/manage_logout') return '/manage_logout'
              return path.replace('/api/2027', '/api')
            }
            : undefined
        }
      }
    })()
  }
}))
