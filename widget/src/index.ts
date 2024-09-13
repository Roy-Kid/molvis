import type { AnyModel, Render } from "@anywidget/types";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-widget-ts" });

interface WidgetModel {
  _width: number;
  _height: number;
  ready: boolean;
}

import { Molvis } from "molvis";
import "./style.css";

class MolvisWidget {

  private _model: AnyModel<WidgetModel>;
  private _molvis: Molvis;

  constructor(canvas: HTMLCanvasElement, model: AnyModel<WidgetModel>) {
    this._model = model;
    this._molvis = new Molvis(canvas);

    model.on("msg:custom", this.handle_custom_message);
  }

  public handle_custom_message = (msg: any, buffers: DataView[]) => {
    logger.info("Received custom message", msg);
    logger.info(typeof msg.atoms.props);
    const cmd = JSON.parse(msg);
    const response = this._molvis.controller.exec_cmd(cmd, buffers);
    logger.info("Response", response);
  }

  public start() {
    this._molvis.render();
    this._model.set("ready", true);
    this._model.save_changes();
  }

}

const render: Render<WidgetModel> = ({ model, el }) => {
  
  // if canvas already exists, skip it
  let canvas = document.getElementById("molvis-canvas") as HTMLCanvasElement;
  if (canvas === null) {
    let domElement = document.createElement("div");
    el.appendChild(domElement);
    // To scope styles to just elements added by this widget, adding a class to the root el.
    el.classList.add("molvis-widget");
    canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.id = "molvis-canvas";
    el.appendChild(canvas);
    // Stop propagation of mouse and keyboard events from the viewer to jupyter notebook
    // to avoid conflicts with the notebook's keyboard shortcuts
    preventEventPropagation(domElement);
    // domElement.style.cssText = "position: relative; width: 600px; height: 400px;";
    const width = model.get("_width")
    const height = model.get("_height");
    domElement.style.width = width ? `${width}px` : "100%";
    domElement.style.height = height ? `${height}px` : "100%";
  }
  const molvisWidget = new MolvisWidget(canvas!, model);
  molvisWidget.start();
};

const preventEventPropagation = (element: HTMLElement) => {
  const stopPropagation = (e: Event) => e.stopPropagation();
  ["click", "keydown", "keyup", "keypress"].forEach((eventType) => {
    element.addEventListener(eventType, stopPropagation, false);
  });
}

export default { render };
