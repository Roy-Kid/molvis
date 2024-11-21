import type { AnyModel } from "@anywidget/types";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-widget-ts" });

interface WidgetModel {
  width: number;
  height: number;
  id: number;
}

import { Molvis } from "molvis";

class MolvisWidget {
  private canvas: HTMLCanvasElement;
  private molvis: Molvis;
  private model: AnyModel<WidgetModel>;

  constructor(model: AnyModel<WidgetModel>) {
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

  public handle_custom_message = (msg: any, buffers: DataView[] = []) => {
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
      logger.info(`MolvisWidget ${this.canvas} attached}`);
    }
    this.resize();
  };

  public detach_from = (el: HTMLElement) => {
    const canvas = el.querySelector(`#molvis-canvas${this.model.get("id")}`);
    if (canvas) {
      el.removeChild(canvas);
      logger.info(`MolvisWidget ${this.canvas} detached`);
    }
  }

  public start = () => {
    this.molvis.render();
  };

  public resize = () => {
    this.molvis.resize();
  };
}

function preventEventPropagation(element: HTMLElement) {
  const stopPropagation = (e) => e.stopPropagation();
  ["contextmenu", "click", "keydown", "keyup", "keypress"].forEach(
    (eventType) => {
      element.addEventListener(eventType, stopPropagation, false);
    }
  );
}

export default () => {
  let molvis_instances: Map<number, MolvisWidget> = new Map();

  return {
    initialize({ model }: { model: AnyModel<WidgetModel> }) {
      const model_id = model.get("id");
      if (!molvis_instances.has(model_id)) {
        const app = new MolvisWidget(model);
        app.start();
        molvis_instances.set(model_id, app);
      }
      return () => {
        logger.info(`MolvisWidget destroyed with id: ${model_id}`);
      };  // Called when the widget is destroyed.
    },
    render({ model, el }: { model: AnyModel<WidgetModel>; el: HTMLElement }) {

      preventEventPropagation(el);

      // if host is vscode
      // if (el.parentElement?.classList.contains("vscode-light")) {
      // const vscodeBackgroundColor = getComputedStyle(
      //   document.documentElement
      // ).getPropertyValue("--vscode-editor-background");
      // if (vscodeBackgroundColor) {
      //   el.style.backgroundColor = vscodeBackgroundColor.trim();
      // }

      const model_id = model.get("id");
      const molvis_instance = molvis_instances.get(model_id)!;
      if (molvis_instance) {
        molvis_instance.attach_to(el);
        molvis_instance.resize();
      }
      
      return () => { 
        logger.info(`MolvisWidget view destroyed with id: ${model_id}`);
        molvis_instance.detach_from(el);
      };  // Called when the view is destroyed.
    },
  };
};
