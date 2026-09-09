import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/msxai-story-world/" : "/",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
}));
