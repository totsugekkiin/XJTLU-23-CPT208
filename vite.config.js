import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        appMain: resolve(__dirname, "appMain.html"),
        map: resolve(__dirname, "map.html"),
        portfolio: resolve(__dirname, "portfolio.html"),
        locAr: resolve(__dirname, "loc-ar.html"),
      },
    },
  },
});

