/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Keep PDF.js support files local in development and production; no CDN calls.
function pdfAssets(): Plugin {
  const root = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const directories = ["cmaps", "standard_fonts", "wasm"];
  return {
    name: "monline-pdf-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs/", (request, response, next) => {
        const relative = (request.url ?? "").split("?")[0].replace(/^\//, "");
        if (!/^(cmaps|standard_fonts|wasm)\/[\w.-]+$/.test(relative)) return next();
        const filename = path.join(root, relative);
        if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return next();
        response.setHeader(
          "Content-Type",
          filename.endsWith(".wasm") ? "application/wasm" : "application/octet-stream",
        );
        response.setHeader("Cache-Control", "public, max-age=3600");
        fs.createReadStream(filename).pipe(response);
      });
    },
    generateBundle() {
      for (const directory of directories)
        for (const name of fs.readdirSync(path.join(root, directory))) {
          const filename = path.join(root, directory, name);
          if (fs.statSync(filename).isFile())
            this.emitFile({
              type: "asset",
              fileName: `pdfjs/${directory}/${name}`,
              source: fs.readFileSync(filename),
            });
        }
      this.emitFile({
        type: "asset",
        fileName: "pdfjs/LICENSE",
        source: fs.readFileSync(path.join(root, "LICENSE")),
      });
    },
  };
}

function getVendorPackageName(id: string) {
  const [, modulePath] = id.split("node_modules/");

  if (!modulePath) return null;

  const segments = modulePath.split("/");

  if (segments[0]?.startsWith("@")) {
    return `${segments[0]}-${segments[1] ?? "unknown"}`;
  }

  return segments[0] ?? null;
}

function isScopedPackage(packageName: string, scope: string) {
  return packageName === scope || packageName.startsWith(`${scope}-`);
}

export default defineConfig({
  plugins: [react(), pdfAssets()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      exclude: [
        "node_modules/",
        "src/test/**",
        "src/test/setup.ts",
        "src/main.tsx",
        "src/**/*.d.ts",
        "**/*.config.ts",
        // Pure TypeScript type-only files (no runtime code to instrument)
        "src/types.ts",
        "src/components/settings/smtp/smtp.types.ts",
        "src/components/statistics/statistics.types.ts",
        // Re-export-only module (v8 cannot instrument bare re-exports)
        "src/lib/toast.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target:
          process.env.MONLINE_API_URL || `http://127.0.0.1:${process.env.MONLINE_PORT || "8080"}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../backend/public",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        /**
         * Split heavy third-party code into stable, cacheable chunks.
         * Routes are already lazy-loaded, so the remaining gain comes from
         * grouping vendor families that change at different cadences.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          const packageName = getVendorPackageName(id);

          if (!packageName) return "vendor";
          if (
            packageName === "i18next" ||
            packageName === "react-i18next" ||
            packageName === "i18next-browser-languagedetector"
          ) {
            return "vendor-i18n";
          }
          if (
            packageName === "react" ||
            packageName === "react-dom" ||
            packageName === "scheduler"
          ) {
            return "vendor-react";
          }
          if (
            isScopedPackage(packageName, "@tanstack") ||
            packageName === "seroval" ||
            packageName === "seroval-plugins"
          ) {
            return "vendor-tanstack";
          }
          if (
            isScopedPackage(packageName, "@radix-ui") ||
            packageName === "cmdk" ||
            packageName === "sonner" ||
            packageName === "next-themes" ||
            packageName === "@floating-ui-core" ||
            packageName === "@floating-ui-dom" ||
            packageName === "@floating-ui-react-dom" ||
            packageName === "@floating-ui-utils" ||
            packageName === "react-remove-scroll" ||
            packageName === "react-remove-scroll-bar" ||
            packageName === "react-style-singleton" ||
            packageName === "aria-hidden" ||
            packageName === "use-callback-ref" ||
            packageName === "use-sidecar" ||
            packageName === "get-nonce" ||
            packageName === "dom-helpers" ||
            packageName === "react-transition-group" ||
            packageName === "hoist-non-react-statics"
          ) {
            return "vendor-ui";
          }
          if (
            packageName === "framer-motion" ||
            packageName === "motion" ||
            packageName === "motion-dom" ||
            packageName === "motion-utils"
          ) {
            return "vendor-motion";
          }
          if (
            packageName === "recharts" ||
            packageName === "recharts-scale" ||
            packageName.startsWith("d3-") ||
            packageName === "victory-vendor" ||
            packageName === "react-smooth" ||
            packageName === "fast-equals" ||
            packageName === "lodash" ||
            packageName === "decimal.js-light" ||
            packageName === "internmap"
          ) {
            return "vendor-charts";
          }
          if (
            packageName === "@hello-pangea-dnd" ||
            packageName === "re-resizable" ||
            packageName === "react-redux" ||
            packageName === "redux" ||
            packageName === "eventemitter3" ||
            packageName === "tiny-invariant" ||
            packageName === "tiny-warning" ||
            packageName === "memoize-one" ||
            packageName === "use-memo-one" ||
            packageName === "raf-schd" ||
            packageName === "css-box-model"
          ) {
            return "vendor-interactions";
          }
          if (
            packageName === "react-hook-form" ||
            packageName === "@hookform-resolvers" ||
            packageName === "zod"
          ) {
            return "vendor-forms";
          }
          if (packageName === "lucide-react") return "vendor-icons";
          if (packageName === "xlsx") return "vendor-xlsx";
          if (packageName === "pdfjs-dist") return "vendor-pdf";

          return "vendor";
        },
      },
    },
  },
});
