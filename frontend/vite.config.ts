import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Overridable — this machine also runs an unrelated project's Vite dev server on the
    // default 5173 (confirmed live via `ss -ltn`). scripts/demo-setup.sh passes PORT to match
    // its own FRONTEND_PORT (root .env) so backend's CORS_ORIGIN stays in sync.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
