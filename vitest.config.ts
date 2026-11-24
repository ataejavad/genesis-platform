import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    // no calls to the EU VIES service or the radar's news feeds from tests (tests pass their own fetch / feed)
    env: { VIES_DISABLED: "1", NEWS_FEED_PROVIDER: "mock" },
    // next build copies the repo into .next/standalone; never run those copies
    exclude: ["**/node_modules/**", ".next/**"],
  },
});
