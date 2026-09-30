import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Em desenvolvimento, /api é encaminhado para a API local (em produção é a Netlify Function).
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Recharts e as bibliotecas de exportação ficam em chunks carregados sob pedido.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
});
