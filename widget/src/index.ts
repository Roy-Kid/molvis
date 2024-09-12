import type { AnyModel, Render } from "@anywidget/types";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-widget-ts" });

interface WidgetModel {
  _width?: number;
  _height?: number;
}

import { Molvis } from "molvis";
import "./style.css";

class MolvisWidget {

  molvis: Molvis;

  constructor(canvas: HTMLCanvasElement, model: AnyModel<WidgetModel>) {

    this.molvis = new Molvis(canvas);

    model.on("change:_width", (_, width) => this.on_resize(null, { width }));
    model.on("change:_height", (_, height) => this.on_resize(null, { height }));

    model.on("msg:custom", this.on_custom_message);
  }

  start() {
    this.molvis.render();
  }

  stop() {    
  }

  on_resize = (_: unknown, new_size: { width?: number; height?: number }) => {
    const canvas = this.molvis.canvas;
    if (!canvas) throw new Error("on_resize called before canvas ready");

    logger.silly("on_resize", new_size);

    const MIN_WIDTH = 200;
    const MIN_HEIGHT = 200;

    if (new_size.width) {
      const newWidth = Math.max(new_size.width, MIN_WIDTH);
      canvas.style.width = `${newWidth}px`;
      canvas.style.minWidth = "none";
      canvas.style.maxWidth = "none";
    } else {
      canvas.style.width = "";
      canvas.style.minWidth = "";
      canvas.style.maxWidth = "";
    }

    if (new_size.height) {
      const newHeight = Math.max(new_size.height, MIN_HEIGHT);
      canvas.style.height = `${newHeight}px`;
      canvas.style.minHeight = "none";
      canvas.style.maxHeight = "none";
    } else {
      canvas.style.height = "";
      canvas.style.minHeight = "";
      canvas.style.maxHeight = "";
    }
  };

  on_custom_message = (msg: any, buffers: DataView[]) => {
      logger.info("on_custom_message", msg, buffers);
      this.molvis.exec_cmd(msg, buffers);
  };
}

const render: Render<WidgetModel> = ({ model, el }) => {

  // if canvas with id not found, create a new canvas
  let canvas = document.querySelector(".molvis-widget") as HTMLCanvasElement;
  if (canvas !== null) {
    logger.silly("canvas not found, creating new canvas");
    canvas = document.createElement("canvas") as HTMLCanvasElement;
    el.classList.add("molvis-widget");
    el.appendChild(canvas);
  } else {
    logger.silly("canvas found");
    canvas = document.querySelector(".molvis-widget") as HTMLCanvasElement;
  }

  let widget = new MolvisWidget(canvas, model);
  widget.start();
  return () => widget.stop();
};

function error_boundary<Fn extends (...args: any[]) => any>(f: Fn): Fn {
  const wrapper = (...args: any[]) => {
    try {
      return f(...args);
    } catch (e) {
      const el = document.querySelector(".molvis-widget");
      if (el) {
        el.innerHTML = `<div class="error">${e}</div>`;
      }
    }
  };

  return wrapper as any;
}

export default { render: error_boundary(render) };
