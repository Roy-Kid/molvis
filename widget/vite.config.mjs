import { defineConfig } from "vite";
import anywidget from "@anywidget/vite";

export default defineConfig({
	build: {
		outDir: "src/molvis/static",
		lib: {
			entry: ["src/molvis/index.ts"],
			formats: ["es"],
		},
		rollupOptions:{
			"output": {
				"inlineDynamicImports": true,
				"entryFileNames": "molvis.js"
			}
		}
	},
    plugins: [anywidget()],
});