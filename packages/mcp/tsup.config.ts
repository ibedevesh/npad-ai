import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    config: "src/config.ts",
    "stores/sqlite": "src/stores/sqlite.ts",
    "stores/http": "src/stores/http.ts",
  },
  format: ["esm"],
  target: "node18",
  dts: true,
  clean: true,
  sourcemap: false,
  shims: false,
  external: ["@npad/core", "@modelcontextprotocol/sdk", "better-sqlite3", "zod"],
});
