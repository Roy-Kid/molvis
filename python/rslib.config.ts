import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@rslib/core";
import type { Compiler } from "@rspack/core";

/**
 * Rspack plugin that inlines WASM binaries as base64 into the JS bundle.
 *
 * anywidget loads the ESM module from a blob/data URL, so `import.meta.url`
 * doesn't resolve to the package directory. The default `fetch()`-based WASM
 * loading therefore receives an empty response.  This plugin replaces the
 * fetch call with an inline base64-decoded buffer so the WASM loads without
 * any network request.
 */
class InlineWasmPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapAsync(
      "InlineWasmPlugin",
      (_compilation, callback) => {
        const outputPath = compiler.outputPath;
        const wasmDir = path.join(outputPath, "static", "wasm");

        if (!fs.existsSync(wasmDir)) {
          callback();
          return;
        }

        const wasmFiles = fs
          .readdirSync(wasmDir)
          .filter((f) => f.endsWith(".wasm"));

        if (wasmFiles.length === 0) {
          callback();
          return;
        }

        const wasmBuffer = fs.readFileSync(path.join(wasmDir, wasmFiles[0]));
        const base64 = wasmBuffer.toString("base64");

        const jsFiles = fs
          .readdirSync(outputPath)
          .filter((f) => f.endsWith(".js"));

        const fetchPattern =
          'var req = fetch(__webpack_require__.p + "static/wasm/" + wasmModuleHash.slice(0, 8) + ".module.wasm")';
        const inlineReplacement = [
          `var _b64 = "${base64}"`,
          "var _raw = atob(_b64)",
          "var _u8 = new Uint8Array(_raw.length)",
          "for (var _i = 0; _i < _raw.length; _i++) _u8[_i] = _raw.charCodeAt(_i)",
          'var req = Promise.resolve(new Response(_u8, { headers: { "Content-Type": "application/wasm" } }))',
        ].join("; ");

        for (const jsFile of jsFiles) {
          const jsPath = path.join(outputPath, jsFile);
          const content = fs.readFileSync(jsPath, "utf8");
          if (!content.includes(fetchPattern)) continue;
          fs.writeFileSync(
            jsPath,
            content.replace(fetchPattern, inlineReplacement),
          );
        }

        // Clean up the now-unnecessary WASM files
        fs.rmSync(path.join(outputPath, "static"), { recursive: true });

        callback();
      },
    );
  }
}

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: true,
      autoExtension: false,
      syntax: "esnext",
      source: {
        entry: { index: "./src/ts/index.ts" },
        define: {
          __WASM_INLINE__: JSON.stringify(true),
        },
      },
      resolve: {
        alias: {
          "@molvis/core": path.resolve(
            import.meta.dirname,
            "../core/src/index.ts",
          ),
        },
      },
      output: {
        target: "web",
        externals: ["@rslib/core"],
        distPath: { root: "src/molvis/dist" },
      },
    },
  ],
  tools: {
    rspack(config) {
      config.experiments = {
        ...(config.experiments || {}),
        outputModule: true,
        asyncWebAssembly: true,
      };
      config.output = {
        ...(config.output || {}),
        module: true,
        library: { type: "module" },
      };
      config.plugins = [...(config.plugins || []), new InlineWasmPlugin()];
    },
  },
});
