import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

// Configuration for JavaScript build
const jsConfig = defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'lib.js',
    chunkFileNames: '[name]-[hash].js',
    sourcemap: true,
  },
  plugins: [],
  external: [
    'ts-morph',
    'commander',
    'inquirer',
    'chalk',
    'ora',
    'cosmiconfig',
    'zod',
    'glob',
    'fast-glob',
    'minimatch',
    'fs',
    'fs/promises',
    'path',
    'url',
    'child_process',
    'os',
    'crypto',
    'util',
    'stream',
    'events',
    'readline',
    'tty',
    'process',
    /^node:/,
  ],
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});

// Configuration for TypeScript declarations build
const dtsConfig = defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'lib.d.ts',
    chunkFileNames: '[name].d.ts',
    sourcemap: true,
  },
  plugins: [
    dts({
      emitDtsOnly: true,
    }),
  ],
  external: [
    'ts-morph',
    'commander',
    'inquirer',
    'chalk',
    'ora',
    'cosmiconfig',
    'zod',
    'glob',
    'fast-glob',
    'minimatch',
    'fs',
    'fs/promises',
    'path',
    'url',
    'child_process',
    'os',
    'crypto',
    'util',
    'stream',
    'events',
    'readline',
    'tty',
    'process',
    /^node:/,
  ],
});

export default [jsConfig, dtsConfig];
