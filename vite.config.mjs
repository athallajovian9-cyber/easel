// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // 디자인 폴더의 /assets/(사진)와 겹치지 않게 앱 파일은 /_app/ 아래로
  base: "/_app/",
  build: { outDir: "../dist", emptyOutDir: true },
});
