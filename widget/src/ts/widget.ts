import { Logger } from "tslog";
import { Molvis, mountMolvis } from "@molvis/core/src/app";
import type { AnyModel } from "@anywidget/types";
import { JsonRpcHandler } from "./jsonrpc";

const logger = new Logger({ name: "molvis-widget" });

export class MolvisWidget {
  private model: AnyModel;
  private app: Molvis | null = null;
  private jsonRpcHandler: JsonRpcHandler | null = null;
  private isInitialized = false;
  private sessionId: number;
  private widgetContainer: HTMLElement | null = null;
  private attachedElement: HTMLElement | null = null;
  private isAttached = false;

  // Static widget instance management
  private static widgets = new Map<number, MolvisWidget>();
  private static attachedElements = new Map<number, HTMLElement>();

  constructor(model: AnyModel) {
    this.model = model;
    this.sessionId = model.get("session_id");
    
    // Add this instance to static tracking
    MolvisWidget.widgets.set(this.sessionId, this);
    
    logger.info("MolvisWidget instance created", { sessionId: this.sessionId });
  }

  // Static methods for widget instance management
  static getInstance(sessionId: number): MolvisWidget | undefined {
    return this.widgets.get(sessionId);
  }

  static getAllInstances(): Map<number, MolvisWidget> {
    return new Map(this.widgets);
  }

  static getInstanceCount(): number {
    return this.widgets.size;
  }

  static clearAllInstances(): void {
    for (const [sessionId, widget] of this.widgets) {
      try {
        widget.dispose();
        this.widgets.delete(sessionId);
      } catch (error) {
        // Handle error silently
      }
    }
    
    // Clear attached elements
    this.attachedElements.clear();
  }

  static clearAllContent(): void {
    for (const [sessionId, widget] of this.widgets) {
      try {
        if (widget.app) {
          widget.app.execute("clear", {});
        }
      } catch (error) {
        // Handle error silently
      }
    }
  }

  public initialize(): void {
    if (this.isInitialized) {
      return;
    }
    try {
      this.initializeMolvisCore();
      this.isInitialized = true;
    } catch (error) {
      logger.error("Failed to initialize MolvisWidget", { sessionId: this.sessionId, error });
      throw error;
    }
  }

  private initializeMolvisCore(): void {
    try {
      const widgetWidth = this.model.get("width");
      const widgetHeight = this.model.get("height");

      // Create widget container
      this.widgetContainer = document.createElement("div");
      this.widgetContainer.id = `molvis-widget-${this.sessionId}`;
      this.widgetContainer.style.cssText = `
        width: ${widgetWidth}px;
        height: ${widgetHeight}px;
        position: relative;
        overflow: hidden;
      `;

      // Initialize Molvis core
      this.app = mountMolvis(this.widgetContainer, {
        displayWidth: widgetWidth,
        displayHeight: widgetHeight,
        fitContainer: true,
        autoRenderResolution: true,
        pixelRatio: window.devicePixelRatio || 1,
        showUI: true,
        uiComponents: {
          showModeIndicator: true,
          showViewIndicator: true,
          showInfoPanel: true,
          showFrameIndicator: true,
        }
      });

      // Initialize JSON-RPC handler
      this.jsonRpcHandler = new JsonRpcHandler(this.app);

      // Bind event listeners
      this.model.on("msg:custom", this.handleCustomMessage);
      this.model.on("change:width", this.resize);
      this.model.on("change:height", this.resize);

      logger.info("Molvis core initialized successfully", { sessionId: this.sessionId });
    } catch (error) {
      logger.error("Failed to initialize Molvis core", { sessionId: this.sessionId, error });
    }
  }

  public handleCustomMessage = async (msg: string, buffers: DataView[] = []) => {
    if (!this.jsonRpcHandler) {
      logger.error("JSON-RPC handler not initialized", { sessionId: this.sessionId });
      return;
    }

    try {
      const cmd = JSON.parse(msg);
      const response = await this.jsonRpcHandler.execute(cmd, buffers);
      this.model.send("msg:custom", JSON.stringify(response));
    } catch (error) {
      logger.error("Error handling custom message", { sessionId: this.sessionId, error });
      
      // Send error response back
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : String(error)}`
        }
      };
      this.model.send("msg:custom", JSON.stringify(errorResponse));
    }
  };

  public attach = (el: HTMLElement) => {
    if (!this.isInitialized) {
      this.initialize();
    }

    // If already attached to same element, return early
    if (this.attachedElement === el && this.isAttached) {
      return;
    }
    
    // If previously attached to different element, detach first
    if (this.attachedElement && this.attachedElement !== el) {
      this.detach(this.attachedElement);
    }
    
    // Set element styles
    el.style.width = "100%";
    el.style.height = "100%";
    
    // Start molvis if not running
    if (this.app && !this.app.isRunning) {
      this.app.start();
    }
    
    // Attach to new element
    if (this.widgetContainer) {
      el.appendChild(this.widgetContainer);
    }
    
    this.attachedElement = el;
    this.isAttached = true;
    
    // Update static tracking
    MolvisWidget.attachedElements.set(this.sessionId, el);
    
    this.resize();
  };

  public detach = (el: HTMLElement) => {
    // Check if really attached to this element
    if (this.attachedElement !== el || !this.isAttached) {
      return;
    }
    
    // Check if element really contains widget
    if (this.widgetContainer && el.contains(this.widgetContainer)) {
      el.removeChild(this.widgetContainer);
    }
    
    this.attachedElement = null;
    this.isAttached = false;
    
    // Update static tracking
    MolvisWidget.attachedElements.delete(this.sessionId);
  };

  public start = () => {
    if (this.app && !this.app.isRunning) {
      this.app.start();
    }
  };

  public stop = () => {
    if (this.app && this.app.isRunning) {
      this.app.stop();
    }
  };

  public dispose = () => {
    // Clean up all event listeners
    this.model.off("msg:custom", this.handleCustomMessage);
    this.model.off("change:width", this.resize);
    this.model.off("change:height", this.resize);
    
    // Stop molvis
    this.stop();
    
    // Detach if still attached
    if (this.attachedElement && this.isAttached) {
      this.detach(this.attachedElement);
    }
    
    // Remove from static tracking
    MolvisWidget.widgets.delete(this.sessionId);
    MolvisWidget.attachedElements.delete(this.sessionId);
    
    logger.info("MolvisWidget disposed", { sessionId: this.sessionId });
  };

  public resize = () => {
    if (!this.widgetContainer || !this.app) {
      return;
    }

    const newWidth = this.model.get("width");
    const newHeight = this.model.get("height");
    
    this.widgetContainer.style.width = `${newWidth}px`;
    this.widgetContainer.style.height = `${newHeight}px`;
    
    try {
      this.app.setSize(newWidth, newHeight);
    } catch (error) {
      logger.error("Failed to resize Molvis core", { sessionId: this.sessionId, error });
    }
  }
}
