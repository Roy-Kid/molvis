import type { AnyModel, Render } from "@anywidget/types";
interface WidgetModel {
    _width?: number;
    _height?: number;
}

import { Molvis } from 'molvis';
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
        console.log(new_size);
        const canvas = this.molvis.canvas;
        if (!canvas) throw new Error("on_resize called before canvas ready");


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
        if (msg?.type === "cmd") {
            console.log("executing command", msg.cmd.params, typeof(msg.cmd.params));
            this.molvis.exec_cmd(msg.cmd, buffers);
        }
    }

}

const render: Render<WidgetModel> = ({ model, el }) => {

    const canvas = document.createElement("canvas");

    el.classList.add("molvis-widget");
    el.appendChild(canvas);

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