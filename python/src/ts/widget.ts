import { Frame } from "@molcrafts/molrs";
import { Logger } from "tslog";
import { MolvisApp, type MolvisApp as Molvis } from "@molvis/core-internal/app";
import { DEFAULT_CONFIG } from "./config";
import { JsonRpcRouter } from "./jsonrpc";
import type { MolvisModel } from "./types";

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

  private readonly host: HTMLDivElement;
  private readonly views = new Set<MolvisViewHandle>();
  private activeView: MolvisViewHandle | null = null;
  private width: number;
  private height: number;
  private disposed = false;

  constructor(sessionKey: string, width: number, height: number) {
    this.sessionKey = sessionKey;
    this.width = width;
    this.height = height;
    this.host = createHostContainer(width, height);
    this.app = new MolvisApp(this.host, {
      ...DEFAULT_CONFIG,
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
      } else if (this.app.isRunning) {
        this.app.stop();
      }
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

    if (this.host.parentElement && this.host.parentElement !== view.mountPoint) {
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
      void this.app.start();
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

export class MolvisSessionRegistry {
  private static runtimes = new Map<string, MolvisSessionRuntime>();
  private static retainCount = new Map<string, number>();

  public static getOrCreate(
    sessionKey: string,
    width: number,
    height: number,
  ): MolvisSessionRuntime {
    const existing = this.runtimes.get(sessionKey);
    if (existing) {
      return existing;
    }

    const runtime = new MolvisSessionRuntime(sessionKey, width, height);
    this.runtimes.set(sessionKey, runtime);
    return runtime;
  }

  public static retain(sessionKey: string): void {
    this.retainCount.set(sessionKey, (this.retainCount.get(sessionKey) ?? 0) + 1);
  }

  public static release(sessionKey: string): void {
    const next = (this.retainCount.get(sessionKey) ?? 1) - 1;
    if (next > 0) {
      this.retainCount.set(sessionKey, next);
      return;
    }

    this.retainCount.delete(sessionKey);
    const runtime = this.runtimes.get(sessionKey);
    runtime?.dispose();
    this.runtimes.delete(sessionKey);
  }

  public static getSessionCount(): number {
    return this.runtimes.size;
  }

  public static listSessions(): string[] {
    return Array.from(this.runtimes.keys()).sort();
  }

  public static clearAllSessions(): void {
    for (const [key, runtime] of this.runtimes) {
      runtime.dispose();
      this.retainCount.delete(key);
    }
    this.runtimes.clear();
  }

  public static clearAllContent(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.clear();
    }
  }
}

class MolvisViewHandle {
  public readonly mountPoint: HTMLDivElement;
  public readonly controller: MolvisModelController;

  private readonly placeholder: HTMLDivElement;

  constructor(controller: MolvisModelController, el: HTMLElement) {
    this.controller = controller;
    this.mountPoint = document.createElement("div");
    this.mountPoint.className = "molvis-session-view";
    this.mountPoint.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 120px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #f7fafc, #edf2f7);
      border: 1px solid #d7dee8;
      border-radius: 12px;
    `;

    this.placeholder = document.createElement("div");
    this.placeholder.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 10px;
      padding: 16px;
      color: #334155;
      text-align: center;
      font: 500 13px/1.5 ui-sans-serif, system-ui, sans-serif;
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Activate session here";
    button.style.cssText = `
      border: 0;
      border-radius: 999px;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 14px;
      font: 600 12px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    `;
    button.addEventListener("click", () => {
      this.controller.runtime.activateView(this);
    });

    this.placeholder.appendChild(document.createElement("div"));
    this.placeholder.appendChild(button);
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
    this.mountPoint.style.borderColor = "#0f172a";
    this.mountPoint.style.background = "#ffffff";
  }

  public setInactive(reason = "This cell shares a live Molvis session with another output."): void {
    const label = this.placeholder.firstElementChild;
    if (label) {
      label.textContent = reason;
    }
    if (!this.mountPoint.contains(this.placeholder)) {
      this.mountPoint.replaceChildren(this.placeholder);
    }
    this.mountPoint.style.borderColor = "#d7dee8";
    this.mountPoint.style.background =
      "linear-gradient(135deg, #f7fafc, #edf2f7)";
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
    );
    MolvisSessionRegistry.retain(this.sessionKey);
    this.router = new JsonRpcRouter(this.runtime);
    this.model.on("msg:custom", this.handleCustomMessage);
    this.model.on("change:width", this.handleSizeChange);
    this.model.on("change:height", this.handleSizeChange);
    this.syncReadyFlag();
  }

  public get width(): number {
    return this.model.get("width") ?? 800;
  }

  public get height(): number {
    return this.model.get("height") ?? 600;
  }

  public render(el: HTMLElement): () => void {
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
    MolvisSessionRegistry.release(this.sessionKey);
  }

  private resolveSessionKey(model: MolvisModel): string {
    const session = model.get("session");
    if (session && session.length > 0) {
      return session;
    }
    const name = model.get("name");
    if (name && name.length > 0) {
      return name;
    }
    return `scene_${model.get("session_id")}`;
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
    const response = await this.router.execute(message, buffers);
    this.model.send(response.content, undefined, response.buffers ?? []);
  };
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
