import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite/Vitest doesn't read tsconfig.json's "paths" on its own — mirror
    // the @/* -> src/* alias here so tests can use it too. Anchored to
    // "@/" (not bare "@") so scoped packages like @clack/prompts are
    // never accidentally matched.
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/`,
      },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
