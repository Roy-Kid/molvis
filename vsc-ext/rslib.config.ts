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
			autoExternal: false,
			source: {
				entry: {
					index: "./src/webview/index.ts",
				},
				tsconfigPath: "./tsconfig.json",
				define: {
					__WASM_INLINE__: JSON.stringify(true),
				},
			},
			output: {
				target: "web",
				distPath: {
					root: "out/webview",
				},
				filename: {
					js: "index.js",
				},
				sourceMap: {
					js: "source-map",
				},
			},
		},
	],

	tools: {
		rspack(config, { addRules }) {
			addRules([
				{
					test: /\.wasm$/,
					type: "asset/inline",
				},
			]);
		},
	},
});
