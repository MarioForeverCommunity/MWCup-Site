import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  define: {
    BUILD_TIME: JSON.stringify(new Date())
  },
  plugins: [vue()],
  server: {
    hmr: true,
    host: '0.0.0.0'
  },
})
