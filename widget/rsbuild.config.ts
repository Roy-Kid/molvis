import { defineConfig } from '@rsbuild/core';

export default defineConfig({
    source: {
        entry: {
            index: './src/ts/index.ts'
        }
    },
    dev: {
        hmr: true,
        watchFiles: {
            paths: ['./src/ts/**/*', '../core/src/**/*'],
            type: 'reload-page'
        },
    },
    output: {
        distPath: {
            root: 'dist',
            js: 'index.js'
        }
    }
});