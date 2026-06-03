import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/pokemon-tcg/',
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    port: 5174,
  },
  test: {
    environment: 'node',
  },
})
