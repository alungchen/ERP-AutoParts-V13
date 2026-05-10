import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 本機只跑 Vite（未開 wrangler）時，可設成 Cloudflare Pages 網址，讓 /api 轉發到雲端
  const apiProxyTarget = (env.VITE_DEV_API_PROXY || '').trim() || 'http://127.0.0.1:8787';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
