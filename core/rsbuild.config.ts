import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
        index: "./tests/index.ts"
    }
  }
});
