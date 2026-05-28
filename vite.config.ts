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
  test: {
    environment: 'node',
  },
})
