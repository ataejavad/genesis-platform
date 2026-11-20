import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    // no calls to the EU VIES service from tests (tests pass their own fetch)
    env: { VIES_DISABLED: "1" },
    // next build copies the repo into .next/standalone; never run those copies
    exclude: ["**/node_modules/**", ".next/**"],
  },
});
