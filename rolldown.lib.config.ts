import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "lib.js",
    chunkFileNames: "[name]-[hash].js",
    sourcemap: true
  },
  external: [
    "ts-morph",
    "commander",
    "inquirer",
    "chalk",
    "ora",
    "cosmiconfig",
    "zod",
    "glob",
    "fast-glob",
    "minimatch",
    "fs",
    "fs/promises",
    "path",
    "url",
    "child_process",
    "os",
    "crypto",
    "util",
    "stream",
    "events",
    "readline",
    "tty",
    "process"
  ],
  resolve: {
    extensions: [".ts", ".js", ".json"]
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production")
  }
});