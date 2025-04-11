import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    title: "molvis dev",
    meta: {
      charset: {
        charset: 'UTF-8',
      },
      viewport: 'width=device-width, initial-scale=1.0',
    }
  },
  source: {
    entry: {
        index: "./index.ts"
    }
  }
});
