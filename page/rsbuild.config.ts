import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
  html: {
    title: 'MolVis page',
    meta: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0'
    }
  },
});
