import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: false,
  clean: true,
  sourcemap: false,
  external: ["@npad/core", "@npad/mcp", "@inquirer/prompts"],
});
