// Builds the game into dist/, which the server sends at /client/
// (templates/client.html loads client.js and client.css).
import { defineConfig } from "vite";

export default defineConfig({
  base: "/client/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rolldownOptions: {
      input: { client: "src/main.ts" },
      output: {
        // Fixed names for what the page loads (client.js, client.css); the
        // server makes browsers check for a newer copy each time. The parts
        // loaded later (code, the icons) are named by their content, so
        // they can be kept forever.
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith(".css"))
          ? "[name][extname]" : "chunks/[name]-[hash][extname]",
      },
    },
  },
});
