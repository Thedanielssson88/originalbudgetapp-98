import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  define: {
    global: 'globalThis',
    'process.env': JSON.stringify(process.env),
    'process.version': JSON.stringify(process.version),
    'process.platform': JSON.stringify(process.platform),
    // Explicitly define environment variables as fallback
    __VITE_STACK_PROJECT_ID__: JSON.stringify(process.env.VITE_STACK_PROJECT_ID || ''),
    __VITE_STACK_PUBLISHABLE_CLIENT_KEY__: JSON.stringify(process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY || ''),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  server: {
    allowedHosts: [
      "localhost",
      "ac727294-c09b-4900-b61d-6d5483af8960-00-80o2hvzlzvkv.worf.replit.dev",
      "originalbudgetapp-98-andreasadaniels.replit.app"
    ],
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),  // Look for .env files in project root
  optimizeDeps: {
    exclude: ['@stackframe/stack'],
    include: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => {
        // Don't externalize @stackframe/stack
        return false;
      }
    }
  },
});
