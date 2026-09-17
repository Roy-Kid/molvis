/**
 * Page bootstrap — everything heavy (React shell, engine, wasm) lives behind
 * this module so `page/index.tsx` can paint the loading overlay first. Mirrors
 * `webview/index.ts` → `webview/controller.ts` for Quick look.
 *
 * The page owns its own engine, so the host bridge cannot be attached at
 * mount time — `onAppChange` hands it over once the engine is up, and again
 * with `null` when the page reloads the viewer.
 */

import { bootstrapTheme } from "@/hooks/useTheme";
import { mountMolvisApp } from "@/lib/mount";
import type { WebviewToHostMessage } from "../protocol";
import { attachPageHost, postPageReady } from "../webview/attachPageHost";
import type { StageHostHandle } from "../webview/attachStageHost";
import { installGlobalErrorHandlers } from "../webview/errorBoundary";
import "./main.css";

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewToHostMessage) => void;
};

export interface BootstrapPageOptions {
  /** Called once the React shell is mounted — the host drops its overlay. */
  onReady?: () => void;
  /** Load phase while a host-driven load runs; `null` when it settles. */
  onBusy?: (label: string | null) => void;
}

export function bootstrapPage(
  container: HTMLElement,
  options: BootstrapPageOptions = {},
): void {
  bootstrapTheme();
  document.documentElement.classList.add("dark");

  const host = acquireVsCodeApi();
  installGlobalErrorHandlers(host);

  let bridge: StageHostHandle | null = null;
  const mounted = mountMolvisApp(container, {
    surface: "full",
    useShadowDOM: false,
    onAppChange: (app) => {
      bridge?.dispose();
      bridge = null;
      if (!app) return;
      // Drop handling stays with the page shell (it owns the drop UI and the
      // unsaved-scene prompt), so the bridge contributes load/settings/save
      // only.
      bridge = attachPageHost(app, {
        host,
        enableDrop: false,
        onBusy: options.onBusy,
        // The host owns the surface bit; the shell just applies it.
        onSurface: (surface) => mounted.setOpts({ surface }),
      });
      options.onReady?.();
      // `onAppChange` fires after `app.start()`, so the host may load
      // immediately.
      postPageReady(host);
    },
  });
}
