import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    title: "molvis dev",
    meta: {
      charset: {
        charset: 'UTF-8',
      },
      viewport: 'width=device-width, initial-scale=1.0',
    },
    template: './examples/index.html'
  },
  source: {
    entry: {
      index: "./examples/demo_frame.ts"
    },
    define: {
      __WASM_INLINE__: JSON.stringify(false),
    },
  }
});
