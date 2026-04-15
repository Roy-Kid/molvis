import { Frame } from "@molcrafts/molrs";
import { type Molvis, mountMolvis } from "@molvis/core";
import { Logger } from "tslog";
import { DEFAULT_CONFIG } from "./config";
import { JsonRpcRouter } from "./jsonrpc";
import { type MolvisModel, createErrorResponse } from "./types";

const logger = new Logger({ name: "molvis-widget" });

const MODEL_CONTROLLERS = new WeakMap<MolvisModel, MolvisModelController>();

function createHostContainer(width: number, height: number): HTMLDivElement {
  const host = document.createElement("div");
  host.className = "molvis-session-host";
  host.style.cssText = `
    width: ${width}px;
    height: ${height}px;
    position: relative;
    overflow: hidden;
  `;
  return host;
}

export class MolvisSessionRuntime {
  public readonly sessionKey: string;
  public readonly app: Molvis;

  /**
   * Resolves when `app.start()` has completed.  RPC handlers must
   * await this before touching the engine so commands that arrive
   * before the render phase don't fail silently.
   */
  public readonly started: Promise<void>;

  private readonly host: HTMLDivElement;
  private readonly views = new Set<MolvisViewHandle>();
  private activeView: MolvisViewHandle | null = null;
  private width: number;
  private height: number;
  private disposed = false;
  private resolveStarted!: () => void;

  public readonly background: string;

  constructor(
    sessionKey: string,
    width: number,
    height: number,
    background = "",
  ) {
    this.sessionKey = sessionKey;
    this.width = width;
    this.height = height;
    this.background = background;
    this.host = createHostContainer(width, height);
    // Enable canvas alpha only when user requests a non-opaque background
    const needsAlpha =
      background.length >= 9 && background.slice(7, 9).toLowerCase() !== "ff";
    this.app = mountMolvis(this.host, {
      ...DEFAULT_CONFIG,
      canvas: { ...DEFAULT_CONFIG.canvas, alpha: needsAlpha },
    });
    this.started = new Promise<void>((resolve) => {
      this.resolveStarted = resolve;
    });
  }

  public registerView(view: MolvisViewHandle): void {
    this.views.add(view);
    this.activateView(view);
  }

  public unregisterView(view: MolvisViewHandle): void {
    if (!this.views.delete(view)) {
      return;
    }

    view.detachHost();

    if (this.activeView === view) {
      this.activeView = null;
      const fallback = Array.from(this.views).at(-1) ?? null;
      if (fallback) {
        this.activateView(fallback);
      }
      // Don't stop the app — it stays alive for the session.
      // New views will reattach when the widget is re-displayed.
    }
  }

  public activateView(view: MolvisViewHandle): void {
    if (this.disposed) {
      throw new Error(`Session '${this.sessionKey}' has already been disposed`);
    }

    if (!this.views.has(view)) {
      this.views.add(view);
    }

    if (this.activeView === view) {
      this.resize(view.width, view.height);
      view.setActive();
      return;
    }

    if (this.activeView) {
      this.activeView.setInactive();
    }

    if (
      this.host.parentElement &&
      this.host.parentElement !== view.mountPoint
    ) {
      this.host.parentElement.removeChild(this.host);
    }

    this.activeView = view;
    this.resize(view.width, view.height);
    view.attachHost(this.host);
    view.setActive();

    for (const candidate of this.views) {
      if (candidate !== view) {
        candidate.setInactive();
      }
    }

    if (!this.app.isRunning) {
      this.app.start().then(
        () => {
          this.app.world.grid.enable();
          if (this.background) {
            this.app.setBackgroundColor(this.background);
          }
          this.resolveStarted();
        },
        (err) => {
          logger.error("Failed to start MolvisApp", {
            session: this.sessionKey,
            error: err,
          });
          this.resolveStarted();
        },
      );
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.host.style.width = `${width}px`;
    this.host.style.height = `${height}px`;
    this.app.setSize(width, height);
  }

  public owns(controller: MolvisModelController): boolean {
    return this.activeView?.controller === controller;
  }

  public clear(): void {
    this.app.loadFrame(new Frame());
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const view of this.views) {
      view.detachHost();
      view.setInactive("Session disposed");
    }
    this.views.clear();
    this.activeView = null;
    this.app.destroy();
  }
}

const sessionRuntimes = new Map<string, MolvisSessionRuntime>();
const sessionRetainCount = new Map<string, number>();

export const MolvisSessionRegistry = {
  getOrCreate(
    sessionKey: string,
    width: number,
    height: number,
    background = "",
  ): MolvisSessionRuntime {
    const existing = sessionRuntimes.get(sessionKey);
    if (existing && !existing.isDisposed) {
      return existing;
    }
    // Stale disposed entry — clean up before creating fresh runtime.
    if (existing?.isDisposed) {
      sessionRuntimes.delete(sessionKey);
      sessionRetainCount.delete(sessionKey);
    }
    const runtime = new MolvisSessionRuntime(
      sessionKey,
      width,
      height,
      background,
    );
    sessionRuntimes.set(sessionKey, runtime);
    return runtime;
  },

  /**
   * Release a specific runtime instance. If the session has since been
   * replaced with a new runtime (same key, different object), the old
   * runtime is disposed in-place without affecting the new session's
   * retain count.
   */
  releaseRuntime(key: string, runtime: MolvisSessionRuntime): void {
    if (sessionRuntimes.get(key) !== runtime) {
      // This controller was attached to an old runtime that has already been
      // superseded — just ensure the old one is disposed.
      runtime.dispose();
      return;
    }
    const next = (sessionRetainCount.get(key) ?? 1) - 1;
    if (next > 0) {
      sessionRetainCount.set(key, next);
      return;
    }
    sessionRetainCount.delete(key);
    runtime.dispose();
    sessionRuntimes.delete(key);
  },

  /**
   * Dispose and recreate a runtime for the given session key.
   * Used when a widget with the same name is re-created (notebook cell re-run).
   */
  reset(
    sessionKey: string,
    width: number,
    height: number,
    background = "",
  ): MolvisSessionRuntime {
    const old = sessionRuntimes.get(sessionKey);
    if (old) {
      old.dispose();
    }
    sessionRetainCount.delete(sessionKey);
    const runtime = new MolvisSessionRuntime(
      sessionKey,
      width,
      height,
      background,
    );
    sessionRuntimes.set(sessionKey, runtime);
    return runtime;
  },

  retain(sessionKey: string): void {
    sessionRetainCount.set(
      sessionKey,
      (sessionRetainCount.get(sessionKey) ?? 0) + 1,
    );
  },

  release(sessionKey: string): void {
    const next = (sessionRetainCount.get(sessionKey) ?? 1) - 1;
    if (next > 0) {
      sessionRetainCount.set(sessionKey, next);
      return;
    }

    sessionRetainCount.delete(sessionKey);
    const runtime = sessionRuntimes.get(sessionKey);
    runtime?.dispose();
    sessionRuntimes.delete(sessionKey);
  },

  getSessionCount(): number {
    return sessionRuntimes.size;
  },

  listSessions(): string[] {
    return Array.from(sessionRuntimes.keys()).sort();
  },

  clearAllSessions(): void {
    for (const [key, runtime] of sessionRuntimes) {
      runtime.dispose();
      sessionRetainCount.delete(key);
    }
    sessionRuntimes.clear();
  },

  clearAllContent(): void {
    for (const runtime of sessionRuntimes.values()) {
      runtime.clear();
    }
  },
};

class MolvisViewHandle {
  public readonly mountPoint: HTMLDivElement;
  public readonly controller: MolvisModelController;

  private readonly placeholder: HTMLButtonElement;

  constructor(controller: MolvisModelController, el: HTMLElement) {
    this.controller = controller;
    this.mountPoint = document.createElement("div");
    this.mountPoint.className = "molvis-session-view";
    this.mountPoint.style.cssText = `
      width: fit-content;
      min-height: 120px;
      position: relative;
      overflow: hidden;
      background: transparent;
      border: none;
      border-radius: 0;
    `;

    const sceneName = controller.model.get("name") || controller.sessionKey;
    this.placeholder = document.createElement("button");
    this.placeholder.type = "button";
    this.placeholder.textContent = `Activate scene ${sceneName}`;
    this.placeholder.title = sceneName;
    this.placeholder.style.cssText = `
      border: 0;
      border-radius: 999px;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 14px;
      font: 600 12px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    `;
    this.placeholder.addEventListener("click", () => {
      this.controller.runtime.activateView(this);
    });
    this.mountPoint.appendChild(this.placeholder);
    el.appendChild(this.mountPoint);
    this.setInactive();
  }

  public get width(): number {
    return this.controller.width;
  }

  public get height(): number {
    return this.controller.height;
  }

  public attachHost(host: HTMLElement): void {
    this.mountPoint.replaceChildren(host);
  }

  public detachHost(): void {
    if (this.mountPoint.contains(this.placeholder)) {
      return;
    }
    this.mountPoint.replaceChildren(this.placeholder);
  }

  public setActive(): void {
    this.mountPoint.style.width = "fit-content";
    this.mountPoint.style.height = "";
    this.mountPoint.style.border = "none";
    this.mountPoint.style.background = "transparent";
  }

  public setInactive(_reason?: string): void {
    if (!this.mountPoint.contains(this.placeholder)) {
      this.mountPoint.replaceChildren(this.placeholder);
    }
    this.mountPoint.style.width = "fit-content";
    this.mountPoint.style.height = "";
    this.mountPoint.style.border = "none";
    this.mountPoint.style.background = "transparent";
  }

  public dispose(): void {
    this.mountPoint.remove();
  }
}

class MolvisModelController {
  public readonly runtime: MolvisSessionRuntime;
  public readonly model: MolvisModel;
  public readonly sessionKey: string;
  public readonly router: JsonRpcRouter;

  private readonly views = new Set<MolvisViewHandle>();

  constructor(model: MolvisModel) {
    this.model = model;
    this.sessionKey = this.resolveSessionKey(model);
    this.runtime = MolvisSessionRegistry.getOrCreate(
      this.sessionKey,
      this.width,
      this.height,
      model.get("background") ?? "",
    );
    MolvisSessionRegistry.retain(this.sessionKey);
    this.router = new JsonRpcRouter(this.runtime);
    this.model.on("msg:custom", this.handleCustomMessage);
    this.model.on("change:width", this.handleSizeChange);
    this.model.on("change:height", this.handleSizeChange);

    // Signal ready only after the engine has started so Python
    // callers that observe `ready` can safely send commands.
    this.runtime.started.then(() => this.syncReadyFlag());
  }

  public get width(): number {
    return this.model.get("width") ?? 800;
  }

  public get height(): number {
    return this.model.get("height") ?? 600;
  }

  public render(el: HTMLElement): () => void {
    el.style.background = "transparent";
    el.style.width = "fit-content";
    const view = new MolvisViewHandle(this, el);
    this.views.add(view);
    this.runtime.registerView(view);

    return () => {
      this.views.delete(view);
      this.runtime.unregisterView(view);
      view.dispose();
    };
  }

  public dispose(): void {
    this.model.off("msg:custom", this.handleCustomMessage);
    this.model.off("change:width", this.handleSizeChange);
    this.model.off("change:height", this.handleSizeChange);

    for (const view of this.views) {
      this.runtime.unregisterView(view);
      view.dispose();
    }
    this.views.clear();
    MolvisSessionRegistry.releaseRuntime(this.sessionKey, this.runtime);
  }

  private resolveSessionKey(model: MolvisModel): string {
    const name = model.get("name") as string | undefined;
    return name && name.length > 0 ? name : "default";
  }

  private syncReadyFlag(): void {
    try {
      if (!this.model.get("ready")) {
        this.model.set("ready", true);
        this.model.save_changes();
      }
    } catch (error) {
      logger.warn("Failed to synchronize ready flag", {
        session: this.sessionKey,
        error,
      });
    }
  }

  private handleSizeChange = () => {
    if (this.runtime.owns(this)) {
      this.runtime.resize(this.width, this.height);
    }
  };

  private handleCustomMessage = async (
    message: unknown,
    buffers: DataView[] = [],
  ) => {
    try {
      // Wait for the engine to be ready before processing commands.
      await this.runtime.started;
      const response = await this.router.execute(message, buffers);

      // Surface RPC errors to the Python side via synced traitlet
      // so they appear in the notebook cell output.
      if (response.content.error) {
        const err = response.content.error;
        const msg = `[${err.code}] ${err.message}`;
        logger.error("RPC error", { session: this.sessionKey, error: msg });
        this.model.set("_last_error", msg);
        this.model.save_changes();
      }

      this.model.send(response.content, undefined, response.buffers ?? []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Unhandled error in RPC handler", {
        session: this.sessionKey,
        error,
      });

      // Always send a JSON-RPC error response so Python's
      // wait_for_response queue doesn't time out with Empty.
      const requestId =
        typeof message === "object" && message !== null
          ? (((message as Record<string, unknown>).id as number | null) ?? null)
          : null;
      this.model.send(
        createErrorResponse(requestId, -32603, msg),
        undefined,
        [],
      );
    }
  };
}

// Dispose all sessions when the notebook tab is closed or refreshed,
// preventing orphaned WebGL contexts from accumulating across page loads.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    MolvisSessionRegistry.clearAllSessions();
  });
}

export function initializeModel(model: MolvisModel): () => void {
  let controller = MODEL_CONTROLLERS.get(model);
  if (!controller) {
    controller = new MolvisModelController(model);
    MODEL_CONTROLLERS.set(model, controller);
  }

  return () => {
    const current = MODEL_CONTROLLERS.get(model);
    if (!current) {
      return;
    }
    current.dispose();
    MODEL_CONTROLLERS.delete(model);
  };
}

export function renderModel(model: MolvisModel, el: HTMLElement): () => void {
  let controller = MODEL_CONTROLLERS.get(model);
  if (!controller) {
    controller = new MolvisModelController(model);
    MODEL_CONTROLLERS.set(model, controller);
  }

  return controller.render(el);
}
