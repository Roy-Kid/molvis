import type { AnyModel, Render } from "@anywidget/types";
import { Logger } from "tslog";
// import { preventEventPropagation } from "./utils";
import "./style.css";

const logger = new Logger({ name: "molvis-widget-ts" });

interface WidgetModel {
  width: number;
  height: number;
}

function preventEventPropagation(element: HTMLElement) {
  const stopPropagation = (e) => e.stopPropagation();
  ["click", "keydown", "keyup", "keypress"].forEach((eventType) => {
    element.addEventListener(eventType, stopPropagation, false);
  });
}

import { Molvis } from "molvis";

class MolvisWidget {
  private canvas: HTMLCanvasElement;
  private molvis: Molvis;

  constructor(model: AnyModel<WidgetModel>) {

    const width = model.get("width");
    const height = model.get("height");

    this.canvas = document.createElement("canvas");
    this.canvas.id = "molvis-canvas";
    this.canvas.width = width;
    this.canvas.height = height;
    this.molvis = new Molvis(this.canvas);
    model.on("msg:custom", this.handle_custom_message);
  }

  public handle_custom_message = (msg: any, buffers: DataView[] = []) => {
    const cmd = JSON.parse(msg);
    const response = this.molvis.exec_cmd(cmd, buffers);
    console.log("response", response);
  };

  public render = (el: HTMLElement) => {
    el.appendChild(this.canvas);
    this.resize();
  };

  public rerender = (model: AnyModel<WidgetModel>) => {

    const width = model.get("width");
    const height = model.get("height");
    this.canvas.width = width;
    this.canvas.height = height;
    this.resize();
  }

  public start = () => {
    this.molvis.render();
  };

  public resize = () => {
    this.molvis.resize();
  };
}

export default () => {
  let extraState: { molvis?: MolvisWidget } = {};

  return {
    initialize({ model }: { model: AnyModel<WidgetModel> }) {
      extraState.molvis = new MolvisWidget(model);
      extraState.molvis.start();
      return () => {
        extraState.molvis = undefined;
      }
    },
    render({ model, el }: { model: AnyModel<WidgetModel>; el: HTMLElement }) {

      preventEventPropagation(el);
      
      const vscodeBackgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background');
      if (vscodeBackgroundColor) {
        el.style.backgroundColor = vscodeBackgroundColor.trim();
      }
      if (!extraState.molvis) logger.fatal("molvis not initialized");
      else {
        if (el.querySelector("#molvis-canvas")) {
          extraState.molvis.rerender(model);
        } else {
          extraState.molvis.render(el);
        }
      }
      return () => {
      }
    },
  };
};
