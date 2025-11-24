import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/cli/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'index.js',
    chunkFileNames: '[name]-[hash].js',
    sourcemap: true,
  },
  external: [
    'ts-morph',
    'commander',
    'inquirer',
    'chalk',
    'ora',
    'cosmiconfig',
    'tsx',
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
  transform: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
  },
});
