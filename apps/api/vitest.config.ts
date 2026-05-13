import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'dist/**',
        'node_modules/**',
        '**/*.module.ts',
        'prisma/**',
      ],
    },
    testTimeout: 5000,
  },
})
