import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/quizrush-ws": {
        target: `ws://127.0.0.1:${process.env.REALTIME_PORT ?? 8787}`,
        ws: true,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("error", () => undefined);
        }
      }
    }
  }
});
