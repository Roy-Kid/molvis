import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Docs: https://rsbuild.rs/config/
export default defineConfig(({ command }) => {
  return {
    server: {
      port: 3000,
    },
    plugins: [pluginReact()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    source: {
      define: {
        // Core expects WASM to be fetched, not inlined as base64 or similar
        __WASM_INLINE__: 'false',
      },
    },
  };
});
