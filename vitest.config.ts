import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    // next build copies the repo into .next/standalone; never run those copies
    exclude: ["**/node_modules/**", ".next/**"],
  },
});
