import { Logger } from "tslog";
import { Molvis } from "molvis";
import type { ModelType } from "./types";

const logger = new Logger({ name: "molvis-widget-ts" });

export class MolvisWidget {
  private canvas: HTMLCanvasElement;
  private molvis: Molvis;
  private model: ModelType;

  constructor(model: ModelType) {
    const width = model.get("width");
    const height = model.get("height");

    this.canvas = document.createElement("canvas");
    this.canvas.id = `molvis-canvas${model.get("id")}`;
    this.canvas.width = width;
    this.canvas.height = height;
    this.molvis = new Molvis(this.canvas);
    this.model = model;
    
    logger.info(`MolvisWidget created with id: ${model.get("id")}`);
    model.on("msg:custom", this.handle_custom_message);
  }

  public handle_custom_message = (msg: string, buffers: DataView[] = []) => {
    const cmd = JSON.parse(msg);
    try {
      const response = this.molvis.exec_cmd(cmd, buffers);
      this.model.send(response);
    } catch (e) {
      this.model.send({ error: e.message });
    }
  };

  public attach_to = (el: HTMLElement) => {
    const canvas = el.querySelector(`#molvis-canvas${this.model.get("id")}`);
    if (!canvas) {
      el.appendChild(this.canvas);
      logger.info(`MolvisWidget ${this.canvas} attached`);
    }
    this.resize();
  };

  public detach_from = (el: HTMLElement) => {
    const canvas = el.querySelector(`#molvis-canvas${this.model.get("id")}`);
    if (canvas) {
      el.removeChild(canvas);
      logger.info(`MolvisWidget ${this.canvas} detached`);
    }
  };

  public start = () => {
    this.molvis.render();
  };

  public resize = () => {
    this.molvis.resize();
  };
} 