import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: './setup-global-fetch',
    environment: 'node'
    // onConsoleLog: () => false,
  }
})
