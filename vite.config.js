import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',

  // Multiple entry points: public-facing app + admin panel
  build: {
    outDir: 'assets',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        app:   resolve(__dirname, 'src/main.jsx'),
        admin: resolve(__dirname, 'src/admin.jsx'),
      },
      output: {
        entryFileNames:  'js/[name].[hash].js',
        chunkFileNames:  'js/[name].[hash].js',
        assetFileNames:  'css/[name].[hash][extname]',
        // Manual chunks for code splitting
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-charts':   ['recharts'],
          'vendor-motion':   ['framer-motion'],
          'vendor-zustand':  ['zustand'],
          'vendor-query':    ['@tanstack/react-query'],
        },
      },
    },
    // Target modern browsers
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },

  // Dev server proxies to local WP
  server: {
    port: 3000,
    proxy: {
      '/wp-json': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
      '@store':      resolve(__dirname, 'src/store'),
      '@utils':      resolve(__dirname, 'src/utils'),
    },
  },

  // Expose env vars to React
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
});
