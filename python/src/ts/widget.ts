import type { AnyModel } from "@anywidget/types";
import { Molvis, mountMolvis } from "@molvis/core";
import { Logger } from "tslog";
import { DEFAULT_CONFIG } from "./config";
import { JsonRpcHandler } from "./jsonrpc";

const logger = new Logger({ name: "molvis-widget" });

export class MolvisWidget {
  private model: AnyModel;
  private app: Molvis | null = null;
  private jsonRpcHandler: JsonRpcHandler | null = null;
  private _isInitialized = false;
  private _name: string;
  private widgetContainer: HTMLElement | null = null;
  private attachedElement: HTMLElement | null = null;
  private isAttached = false;

  // Static widget instance management - keyed by name
  private static widgets = new Map<string, MolvisWidget>();
  private static attachedElements = new Map<string, HTMLElement>();

  constructor(model: AnyModel) {
    this.model = model;

    // Use name if provided, otherwise generate from session_id
    const name = model.get("name") as string | undefined;
    const sessionId = model.get("session_id") as number;
    this._name = name || `scene_${sessionId}`;

    // Add this instance to static tracking
    MolvisWidget.widgets.set(this._name, this);

    logger.info("MolvisWidget instance created", { name: this._name });
  }

  get name(): string {
    return this._name;
  }

  // Static methods for widget instance management
  static getInstance(name: string): MolvisWidget | undefined {
    return MolvisWidget.widgets.get(name);
  }

  static getInstanceBySessionId(sessionId: number): MolvisWidget | undefined {
    // Fallback lookup by session_id pattern
    return MolvisWidget.widgets.get(`scene_${sessionId}`);
  }

  static getAllInstances(): Map<string, MolvisWidget> {
    return new Map(MolvisWidget.widgets);
  }

  static getInstanceCount(): number {
    return MolvisWidget.widgets.size;
  }

  static listInstances(): string[] {
    return Array.from(MolvisWidget.widgets.keys());
  }

  static clearAllInstances(): void {
    const errors: Array<{ name: string; error: unknown }> = [];

    for (const [name, widget] of MolvisWidget.widgets) {
      try {
        widget.dispose();
      } catch (error) {
        errors.push({ name, error });
        logger.error("Error disposing widget instance", { name, error });
      }
    }

    MolvisWidget.widgets.clear();
    MolvisWidget.attachedElements.clear();

    if (errors.length > 0) {
      logger.warn(`Failed to dispose ${errors.length} widget instance(s)`, { errors });
    }
  }

  static clearAllContent(): void {
    const errors: Array<{ name: string; error: unknown }> = [];

    for (const [name, widget] of MolvisWidget.widgets) {
      try {
        if (widget.app) {
          widget.app.execute("clear", {});
        }
      } catch (error) {
        errors.push({ name, error });
        logger.error("Error clearing widget content", { name, error });
      }
    }

    if (errors.length > 0) {
      logger.warn(`Failed to clear content for ${errors.length} widget instance(s)`, { errors });
    }
  }

  public initialize(): void {
    if (this._isInitialized) {
      return;
    }
    try {
      this.initializeMolvisCore();
      this._isInitialized = true;
    } catch (error) {
      logger.error("Failed to initialize MolvisWidget", { name: this._name, error });
      throw error;
    }
  }

  private initializeMolvisCore(): void {
    try {
      const widgetWidth = this.model.get("width") as number;
      const widgetHeight = this.model.get("height") as number;

      // Create widget container
      this.widgetContainer = document.createElement("div");
      this.widgetContainer.id = `molvis-widget-${this._name}`;
      this.widgetContainer.style.cssText = `
        width: ${widgetWidth}px;
        height: ${widgetHeight}px;
        position: relative;
        overflow: hidden;
      `;

      // Initialize Molvis core with simplified config
      this.app = mountMolvis(this.widgetContainer, {
        ...DEFAULT_CONFIG,
      });

      // Initialize JSON-RPC handler
      this.jsonRpcHandler = new JsonRpcHandler(this.app);

      // Bind event listeners
      if (this.model && typeof this.model.on === "function") {
        this.model.on("msg:custom", this.handleCustomMessage);
        this.model.on("change:width", this.resize);
        this.model.on("change:height", this.resize);
      } else {
        logger.warn("Model does not have 'on' method, event listeners not bound", {
          name: this._name,
          modelType: typeof this.model,
        });
      }

      logger.info("Molvis core initialized successfully", { name: this._name });
    } catch (error) {
      logger.error("Failed to initialize Molvis core", { name: this._name, error });
      throw error;
    }
  }

  public handleCustomMessage = async (msg: string, buffers: DataView[] = []) => {
    if (!this.jsonRpcHandler) {
      logger.error("JSON-RPC handler not initialized", { name: this._name });
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "JSON-RPC handler not initialized",
        },
      };
      this.model.send("msg:custom", JSON.stringify(errorResponse));
      return;
    }

    try {
      const cmd = JSON.parse(msg);

      if (!cmd || typeof cmd !== "object") {
        throw new Error("Invalid request: must be an object");
      }

      if (cmd.jsonrpc !== "2.0") {
        throw new Error("Invalid JSON-RPC version");
      }

      const response = await this.jsonRpcHandler.execute(cmd, buffers);

      if (response) {
        this.model.send("msg:custom", JSON.stringify(response));
      } else {
        logger.warn("JsonRpcHandler returned undefined response", {
          name: this._name,
          method: cmd.method
        });
        const errorResponse = {
          jsonrpc: "2.0",
          id: cmd.id || null,
          error: {
            code: -32603,
            message: "Handler returned undefined response",
          },
        };
        this.model.send("msg:custom", JSON.stringify(errorResponse));
      }
    } catch (error) {
      logger.error("Error handling custom message", {
        name: this._name,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      let requestId: number | null = null;
      try {
        const cmd = JSON.parse(msg);
        requestId = cmd.id || null;
      } catch {
        // Ignore parse errors when extracting ID
      }

      const errorResponse = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
      this.model.send("msg:custom", JSON.stringify(errorResponse));
    }
  };

  public attach = (el: HTMLElement) => {
    if (!this._isInitialized) {
      this.initialize();
    }

    if (this.attachedElement === el && this.isAttached) {
      return;
    }

    if (this.attachedElement && this.attachedElement !== el) {
      this.detach(this.attachedElement);
    }

    el.style.width = "100%";
    el.style.height = "100%";

    // Delegate to core: start rendering
    if (this.app && !this.app.isRunning) {
      this.app.start();
    }

    if (this.widgetContainer) {
      el.appendChild(this.widgetContainer);
    }

    this.attachedElement = el;
    this.isAttached = true;
    MolvisWidget.attachedElements.set(this._name, el);

    this.resize();
  };

  public detach = (el: HTMLElement) => {
    if (this.attachedElement !== el || !this.isAttached) {
      return;
    }

    if (this.widgetContainer && el.contains(this.widgetContainer)) {
      el.removeChild(this.widgetContainer);
    }

    // Delegate to core: stop rendering (but don't destroy)
    if (this.app?.isRunning) {
      this.app.stop();
    }

    this.attachedElement = null;
    this.isAttached = false;
    MolvisWidget.attachedElements.delete(this._name);
  };

  public start = () => {
    if (this.app && !this.app.isRunning) {
      this.app.start();
    }
  };

  public stop = () => {
    if (this.app?.isRunning) {
      this.app.stop();
    }
  };

  public dispose = () => {
    // Clean up event listeners
    if (this.model && typeof this.model.off === "function") {
      this.model.off("msg:custom", this.handleCustomMessage);
      this.model.off("change:width", this.resize);
      this.model.off("change:height", this.resize);
    }

    // Stop and destroy core
    this.stop();
    if (this.app) {
      this.app.destroy();
      this.app = null;
    }

    // Detach if still attached
    if (this.attachedElement && this.isAttached) {
      this.detach(this.attachedElement);
    }

    // Remove from static tracking
    MolvisWidget.widgets.delete(this._name);
    MolvisWidget.attachedElements.delete(this._name);

    this._isInitialized = false;
    logger.info("MolvisWidget disposed", { name: this._name });
  };

  public resize = () => {
    if (!this.widgetContainer || !this.app) {
      return;
    }

    const newWidth = this.model.get("width") as number;
    const newHeight = this.model.get("height") as number;

    this.widgetContainer.style.width = `${newWidth}px`;
    this.widgetContainer.style.height = `${newHeight}px`;

    try {
      this.app.setSize(newWidth, newHeight);
    } catch (error) {
      logger.error("Failed to resize Molvis core", { name: this._name, error });
    }
  };

  get isInitialized(): boolean {
    return this._isInitialized;
  }
}
