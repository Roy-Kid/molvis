import { Logger } from "tslog";
import { Molvis } from "@molvis/core/src/app";
import type { ModelType } from "./types";
import { JsonRpcHandler } from "./jsonrpc";

const logger = new Logger({ name: "molvis-widget" });

export class MolvisWidget {

  private widgetContainer: HTMLElement;

  private molvis: Molvis;
  private _model: ModelType;
  private jrpc_handler: JsonRpcHandler;
  private session_id: number;

  constructor(model: ModelType) {

    this.session_id = model.get("session_id");
    
    const widgetWidth = model.get("width");
    const widgetHeight = model.get("height");

    // Create widget container
    this.widgetContainer = document.createElement("div");
    this.widgetContainer.id = `molvis-widget-${this.session_id}`;
    this.widgetContainer.style.cssText = `
      width: ${widgetWidth}px;
      height: ${widgetHeight}px;
      position: relative;
      overflow: hidden;
    `;

    // Initialize Molvis with clear size parameters
    this.molvis = new Molvis(this.widgetContainer, {
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
    
    // Ensure UI components are on top of canvas
    this._ensureUILayer();
    
    this._model = model;
    this.jrpc_handler = new JsonRpcHandler(this.molvis);
    model.on("msg:custom", this.handle_custom_message);
    
    // Listen for size changes
    model.on("change:width", this.resize);
    model.on("change:height", this.resize);
  }

  private _ensureUILayer(): void {
    // Ensure UI container is on top of canvas
    const uiContainer = this.widgetContainer.querySelector('.molvis-ui');
    if (uiContainer) {
      (uiContainer as HTMLElement).style.zIndex = '1000';
      (uiContainer as HTMLElement).style.pointerEvents = 'none';
    }
    
    // Ensure mode indicator and other UI elements are clickable
    const modeIndicator = this.widgetContainer.querySelector('.mode-indicator');
    if (modeIndicator) {
      (modeIndicator as HTMLElement).style.pointerEvents = 'auto';
      (modeIndicator as HTMLElement).style.zIndex = '1001';
    }
    
    const viewIndicator = this.widgetContainer.querySelector('.view-indicator');
    if (viewIndicator) {
      (viewIndicator as HTMLElement).style.pointerEvents = 'auto';
      (viewIndicator as HTMLElement).style.zIndex = '1001';
    }
    
    const infoPanel = this.widgetContainer.querySelector('.info-panel');
    if (infoPanel) {
      (infoPanel as HTMLElement).style.pointerEvents = 'auto';
      (infoPanel as HTMLElement).style.zIndex = '1001';
    }
  }

  public handle_custom_message = async (msg: string, buffers: DataView[] = []) => {
    const cmd = JSON.parse(msg);
    const response = await this.jrpc_handler.execute(cmd, buffers);
    this._model.send("msg:custom", JSON.stringify(response));
  };

  public attach = (el: HTMLElement) => {
    if (el.contains(this.widgetContainer)) {
      this.detach(el);
    }
    el.style.width = "100%";
    el.style.height = "100%";
    if (!this.molvis.isRunning) {
      this.molvis.start();
    }
    
    el.appendChild(this.widgetContainer);
    this.resize();
    this._ensureUILayer(); // Re-ensure UI layer after attachment
  };

  public detach = (el: HTMLElement) => {
    el.removeChild(this.widgetContainer);
  };

  public start = () => {
    this.molvis.start();
  };

  public stop = () => {
    this.molvis.stop();
  };

  public resize = () => {
    const newWidth = this._model.get("width");
    const newHeight = this._model.get("height");
    
    // 更新widget容器尺寸
    this.widgetContainer.style.width = `${newWidth}px`;
    this.widgetContainer.style.height = `${newHeight}px`;
    
    // 更新Molvis显示尺寸
    this.molvis.setSize(newWidth, newHeight);
    
    // Re-ensure UI layer after resize
    this._ensureUILayer();
    
    console.log(`Widget resized to: ${newWidth}x${newHeight}`);
    console.log(`Display size: ${JSON.stringify(this.molvis.displaySize)}`);
    console.log(`Render resolution: ${JSON.stringify(this.molvis.renderResolution)}`);
  };
}
