// Sets webpack's runtime publicPath from a host-injected global so that
// async chunks (JS) and the molrs WASM module are fetched from the actual
// kernel-served origin — not the document's own origin (which in a VSCode
// notebook webview is `vscode-webview://…`, where the kernel routes do
// not exist and return 401).
//
// Imported FIRST from `index.tsx` so this runs before any module that
// might trigger an async chunk load.

declare let __webpack_public_path__: string;

interface AssetBaseWindow {
  __MOLVIS_ASSET_BASE__?: string;
}

if (typeof window !== "undefined") {
  const base = (window as unknown as AssetBaseWindow).__MOLVIS_ASSET_BASE__;
  if (base) {
    __webpack_public_path__ = base.endsWith("/") ? base : `${base}/`;
  }
}
