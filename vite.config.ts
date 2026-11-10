import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  // Keep Rust output visible alongside the frontend server.
  clearScreen: false,
  // Keep this port in sync with the Tauri devUrl.
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    ...(host ? { hmr: { protocol: "ws" as const, host, port: 1421 } } : {}),
    watch: {
      // Cargo handles native source changes.
      ignored: ["**/src-tauri/**", "**/.artifacts/**", "**/releases/**"],
    },
  },
}));
