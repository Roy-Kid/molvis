import { defineConfig } from "vite";
import anywidget from "@anywidget/vite";

export default defineConfig({
	build: {
		outDir: "src/static",
		lib: {
			entry: ["src/index.ts"],
			formats: ["es"],
		},
	},
    plugins: [anywidget()],
});