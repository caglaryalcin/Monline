import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const coverageProviderPath = fileURLToPath(
  new URL(
    "../web/node_modules/@vitest/coverage-v8/dist/index.js",
    import.meta.url,
  ),
);

export default {
  test: {
    root: rootDir,
    include: ["tests/domain/**/*.test.js", "tests/domain/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "custom",
      customProviderModule: coverageProviderPath,
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      all: true,
      include: [
        "src/domain/lib/totp.js",
        "src/domain/lib/date-helpers.js",
        "src/domain/lib/pure/**/*.js",
      ],
      exclude: ["tests/**"],
    },
  },
};
