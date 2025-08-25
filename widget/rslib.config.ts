import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      source: {
        entry: {
            index: './src/ts/index.ts'
        }
      },
      output: {
        externals: ['@rslib/core']
      }
    },
  ],
  output: {
    target: 'web',
    distPath: {
      root: 'src/molvis/dist'
    }
  }
});