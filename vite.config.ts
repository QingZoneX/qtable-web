import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version?: string }
const qtableUiVersion = packageMetadata.version || 'unknown'

// Plugin to fix UMD module compatibility issues
function fixUmdModules() {
  return {
    name: 'fix-umd-modules',
    transform(code: string, id: string) {
      // Fix lottie-web UMD export
      if (id.includes('lottie-web') && id.includes('lottie.js')) {
        // Add default export for UMD module
        return code + '\nexport default globalThis.lottie || module.exports;';
      }
      // Fix VisActor global environment
      if (id.includes('@visactor') && id.includes('global.js')) {
        // Ensure globalThis is properly set
        return code.replace(
          /global\s*=\s*typeof\s+globalThis\s*!==\s*['"]undefined['"]\s*\?\s*globalThis\s*:\s*global\s*\|\|\s*self/g,
          'global = typeof globalThis !== "undefined" ? globalThis : (typeof global !== "undefined" ? global : (typeof window !== "undefined" ? window : self))'
        );
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development';
  const processEnvShim = `({ NODE_ENV: ${JSON.stringify(nodeEnv)} })`;
  const processShim = `({ env: ${processEnvShim} })`;

  return {
    plugins: [
      tailwindcss(),
      react(),
      fixUmdModules(),
    ],
    define: {
      '__QTABLE_UI_VERSION__': JSON.stringify(qtableUiVersion),
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      'process.env': processEnvShim,
      process: processShim,
    },
    build: {
    // Enable source maps for debugging (disable in production if needed)
    sourcemap: false,
    
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split vendor chunks by library size and update frequency
          if (id.includes('node_modules')) {
            // VTable/VChart share a dependency-injection based VRender runtime.
            // They must be evaluated from one chunk; otherwise Rollup may split
            // a browser contribution from its VGlobal singleton and Grid fails
            // during canvas initialisation (reading `optimizeVisible`).
            if (id.includes('@visactor/')) {
              return 'visactor-vendor';
            }
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Ant Design
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd-vendor';
            }
            // GraphQL
            if (id.includes('@apollo') || id.includes('graphql')) {
              return 'graphql-vendor';
            }
            // Utilities
            if (id.includes('dayjs') || id.includes('yjs') || id.includes('zustand')) {
              return 'utils';
            }
            // Drag and Drop
            if (id.includes('@dnd-kit')) {
              return 'dnd';
            }
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // Increase chunk size warning limit (we're intentionally splitting)
    chunkSizeWarningLimit: 1000,
    
    // Minification (use terser for better compatibility with rolldown)
    minify: 'terser',
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Assets inline limit (reduce initial load)
    assetsInlineLimit: 4096,
  },
  
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      '@apollo/client',
      '@apollo/client/react',
      'dayjs',
      'zustand',
      'yjs',
      'eventemitter3', // Fix CommonJS compatibility issue
      'gifuct-js', // Fix GIF module compatibility issue
      'lottie-web', // Fix Lottie module compatibility issue
      'react-grid-layout', // Fix process.env usage in dev pre-bundling
    ],
    // Don't exclude VisActor - let Vite pre-bundle them properly
    exclude: [],
  },
  
  // Server configuration for development
  server: {
    // Enable CORS for API calls
    cors: true,
    
    // Disable caching in development for real-time updates
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: 'ws://localhost:9000',
        ws: true,
      },
      '/auth': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/oauth': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
    strictPort: true,
    // Note: preview mode doesn't support proxy like dev server
    // For CORS issues, either:
    // 1. Configure backend CORS headers (recommended for production)
    // 2. Use a reverse proxy (nginx) in front of both services
    // 3. Use dev mode with proxy for testing: npm run dev
    cors: true, // Enable CORS for preview mode
    headers: {
      // Add security headers
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  };
})
