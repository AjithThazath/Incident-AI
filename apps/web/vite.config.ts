import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "."), // ← add back, but explicit
  plugins: [react()],
  resolve: {
    alias: {
      "@incidentiq/shared-types": path.resolve(
        __dirname,
        "../../libs/shared-types/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, "."), path.resolve(__dirname, "../../")],
    },
    proxy: {
      "/api": {
        target: `${process.env.API_BASE_URL}`,
        changeOrigin: true,
      },
      "/copilotkit": {
        target: `${process.env.API_BASE_URL}`,
        // These are critical for streaming:
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Disable buffering for SSE
            proxyRes.headers["cache-control"] = "no-cache";
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
    },
  },
  build: {
    outDir: "../../dist/apps/web",
    emptyOutDir: true,
  },
});
