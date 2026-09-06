import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { foldkit } from "@foldkit/vite-plugin";

export default defineConfig({
  plugins: [tailwindcss(), foldkit()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  optimizeDeps: { include: ["foldkit/brand"] },
  test: {
    include: ["src/**/*.browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
