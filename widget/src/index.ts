import type { AnyModel, Render } from "@anywidget/types";
import { Logger } from "tslog";
import { preventEventPropagation } from "./utils";
import "./style.css";

const logger = new Logger({ name: "molvis-widget-ts" });

interface WidgetModel {
  _width: number;
  _height: number;
  ready: boolean;
}

import { Molvis } from "molvis";

class MolvisWidget {
  // private _model: AnyModel<WidgetModel>;
  private _canvas: HTMLCanvasElement;
  private _molvis: Molvis;

  constructor(model: AnyModel<WidgetModel>, el: HTMLElement) {
    // this._model = model;
    this._canvas = this.create_canvas();
    this._molvis = new Molvis(this._canvas);
    this.bind_canvas(el);
    model.on("msg:custom", this.handle_custom_message);
  }

  private create_canvas = () => {
    let canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.id = "molvis-canvas";
    return canvas;
  };

  public bind_canvas = (el: HTMLElement) => {
    let container = document.createElement("div");
    container.id = "molvis-container";
    let canvas_wrapper = document.createElement("div");
    canvas_wrapper.id = "molvis-wrapper";
    canvas_wrapper.appendChild(this._canvas);
    preventEventPropagation(canvas_wrapper);
    container.appendChild(canvas_wrapper);
    el.appendChild(container);
  };

  public handle_custom_message = (msg: any, buffers: DataView[] = []) => {
    logger.info("exec", msg);
    const cmd = JSON.parse(msg);
    const response = this._molvis.controller.exec_cmd(cmd, buffers);
    logger.info("response", response);
  };

  public start() {
    this._molvis.render();
  }

  public resize() {
    this._molvis.resize();
  }
}

let molvis_widget: MolvisWidget | undefined = undefined;

const render: Render<WidgetModel> = ({ model, el }) => {
  if (!molvis_widget) {
    molvis_widget = new MolvisWidget(model, el);
    molvis_widget.start();
  } else {
    molvis_widget.bind_canvas(el);
    logger.info("bind canvas");
  }
  model.set("ready", true);
  model.save_changes();
  molvis_widget.resize();
};

export default { render };
