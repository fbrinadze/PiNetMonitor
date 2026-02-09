import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize bundle size - use esbuild for minification (faster and built-in)
    minify: 'esbuild',
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['recharts'],
          'network-vendor': ['axios', 'socket.io-client']
        }
      }
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000
  }
});
