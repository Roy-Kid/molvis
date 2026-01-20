// rslib.config.ts
import { defineConfig } from "@rslib/core";

export default defineConfig({
	lib: [
		// Extension host (Node.js)
		{
			format: "cjs",
			bundle: true,
			autoExtension: false,
			source: {
				entry: {
					extension: "./src/extension.ts",
				},
				define: {
					__WASM_INLINE__: 'false',
				}
			},
			output: {
				target: "node",
				distPath: {
					root: "out",
				},
				filename: {
					js: "extension.js",
				},
				sourceMap: {
					js: "source-map",
				},
				externals: {
					vscode: "commonjs vscode",
				},
			},
		},
		// Webview (Browser)
		{
			format: "esm",
			bundle: true,
			autoExtension: false,
			source: {
				entry: {
					"webview/index": "./src/webview/index.ts",
				},
				define: {
					__WASM_INLINE__: 'false',
				}
			},
			output: {
				target: "web",
				distPath: {
					root: "out",
				},
				filename: {
					js: "[name].js",
				},
				sourceMap: {
					js: "source-map",
				},
				// Explicitly set externals to empty object to bundle everything
				externals: {},
			},
		}
	],

	tools: {
		rspack(config, { addRules, prependPlugins }) {
			// For webview target, completely disable externals
			if (config.output?.filename?.toString().includes("webview")) {
				config.externalsPresets = {};
				config.externals = [];
			}

			addRules([
				{
					test: /\.wasm$/,
					type: "asset/inline",
				},
			]);
		},
	},
});
