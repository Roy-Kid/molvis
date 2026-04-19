import { createContext, useContext } from "react";

/**
 * Configuration passed to {@link mountMolvisApp} when bootstrapping the
 * page. Standalone mode reads these from URL params; the notebook host
 * passes them inline via `window.MolvisApp.mount(el, opts)`.
 */
export interface MountOpts {
  /** WebSocket URL of the controller (e.g. `ws://localhost:54321/ws`). */
  wsUrl?: string;
  /** Pre-shared token used in the hello frame. */
  token?: string;
  /** Session label sent with hello and used in event routing. */
  session?: string;
  /** When `true`, hide all chrome and render only the canvas. */
  minimal?: boolean;
  /**
   * Opt-in demo seed. `true` seeds a Dopamine molecule on start; `false`
   * or undefined leaves the canvas empty. Defaults on in dev mode so
   * `npm run dev:page` stays interactive; production embeds (VSCode,
   * Python, third-party mounts) never see the demo unless they pass
   * this flag explicitly (or the URL carries `?demo=1`).
   */
  demo?: boolean;
}

const MountOptsContext = createContext<MountOpts>({});

export const MountOptsProvider = MountOptsContext.Provider;

export function useMountOpts(): MountOpts {
  return useContext(MountOptsContext);
}

/** Build {@link MountOpts} from the current `window.location.search`. */
export function readMountOptsFromUrl(): MountOpts {
  const params = new URLSearchParams(window.location.search);
  return {
    wsUrl: params.get("ws_url") ?? undefined,
    token: params.get("token") ?? undefined,
    session: params.get("session") ?? undefined,
    minimal: params.has("minimal"),
    demo: params.has("demo") ? true : undefined,
  };
}
