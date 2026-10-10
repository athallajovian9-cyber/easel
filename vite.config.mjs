// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // App files go under /_app/ so they do not collide with the design folder's /assets/ (images)
  base: "/_app/",
  build: { outDir: "../dist", emptyOutDir: true },
});
