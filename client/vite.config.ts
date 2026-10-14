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
        // Fixed names for what the page loads; the server makes browsers
        // check for a newer copy each time. The parts loaded later are
        // named by their content, so they can be kept forever.
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
