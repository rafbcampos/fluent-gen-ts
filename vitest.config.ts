import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'vitest-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/rolldown.config.ts',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.generated/**',
        '.generated/**',
        '**/generated/**',
        '.vitepress/**',
        '**/types.ts',
        '.prettierrc.js',
        'test-repo',
        'scripts',
        'test-temp',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
