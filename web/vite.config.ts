/**
 * @fileoverview Vite 开发 / 构建配置。
 */

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/** 聊天前端 Vite 配置（含 `/api` 代理到 agent server） */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    // host: true,
    port: 5174,
    proxy: {
      "/api": "http://localhost:3002",
    },
  },
});
