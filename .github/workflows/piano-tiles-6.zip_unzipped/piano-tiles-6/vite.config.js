import { defineConfig } from "vite";

export default defineConfig({
  root: "public",
  publicDir: "../public",
  base: "./",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
    host: true,       // expose on LAN for vscodroid
    open: false,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "public/index.html",
      },
    },
  },
});
