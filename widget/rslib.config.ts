import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'esnext'
    },
  ],
  source: {
    entry: {
      index: './src/ts/index.ts'
    },
    // 设置 define flag：widget 使用内联 wasm
    define: {
      __WASM_INLINE__: JSON.stringify(true),
    },
  },
  output: {
    target: 'web',
    distPath: {
      root: 'src/molvis/dist'
    }
  },
  tools: {
    rspack(config, { addRules }) {
      addRules([
        {
          test: /\.wasm$/,
          type: 'asset/inline'
        },
      ]);
    },
  }
});
