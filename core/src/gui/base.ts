import { Molvis, draw_frame } from "@molvis/core";
import { Pane } from "tweakpane";

// import { Logger } from "tslog";
// const logger = new Logger({ name: "molvis-gui" });

interface GuiOptions {
}

class GuiManager {

  private _app: Molvis;

  private _infoPanel: HTMLElement;
  private _frameIndicator: HTMLDivElement;
  private _framePane: Pane;
  private _frameLabel: HTMLSpanElement;
  private _bars: HTMLDivElement[] = [];

  constructor(app: Molvis) {
    this._app = app;

    this._infoPanel = this._createInfoPanel();
    this._frameIndicator = this._createFrameIndicator();
  }

  private _createInfoPanel() {
    // create a html element for info panel
    let panel = document.createElement("div");
    panel.style.bottom = "3%";
    panel.style.left = "3%";
    panel.style.width = "150px"
    panel.style.height = "40px"
    panel.style.fontSize = "26px";

    panel.style.position = "absolute";
    panel.style.color = "white";

    document.body.appendChild(panel);
    return panel;
  }

  public updateInfoText(text: string): void {
    this._infoPanel.textContent = text;
  }

  private _createFrameIndicator() {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.bottom = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.padding = "4px";
    container.style.background = "rgba(0,0,0,0.5)";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.boxSizing = "border-box";
    container.style.color = "white";
    container.style.fontSize = "12px";
    container.style.zIndex = "1";

    const barContainer = document.createElement("div");
    barContainer.style.flex = "1";
    barContainer.style.display = "flex";
    barContainer.style.height = "10px";
    barContainer.style.alignItems = "flex-end";
    container.appendChild(barContainer);

    const labelInput = document.createElement("input");
    labelInput.type = "number";
    labelInput.value = "1";
    labelInput.style.width = "50px";
    labelInput.style.marginLeft = "8px";
    labelInput.style.background = "transparent";
    labelInput.style.border = "1px solid #666";
    labelInput.style.color = "white";
    container.appendChild(labelInput);

    document.body.appendChild(container);

    let dragging = false;
    const setFrame = (idx: number) => {
      idx = Math.max(0, Math.min(idx, this._bars.length - 1));
      this._app.system.set_frame(idx);
      const frame = this._app.system.current_frame;
      draw_frame(this._app, frame, { atoms: {}, bonds: {}, clean: true });
      this.updateFrameIndicator(idx, this._app.system.n_frames);
    };

    const updateFromEvent = (ev: PointerEvent) => {
      const rect = barContainer.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      const idx = Math.floor(ratio * this._bars.length);
      setFrame(idx);
    };

    barContainer.addEventListener("pointerdown", (ev) => {
      dragging = true;
      updateFromEvent(ev as PointerEvent);
    });
    barContainer.addEventListener("pointermove", (ev) => {
      if (dragging) updateFromEvent(ev as PointerEvent);
    });
    window.addEventListener("pointerup", () => (dragging = false));

    labelInput.addEventListener("change", () => {
      const idx = parseInt(labelInput.value) - 1;
      setFrame(idx);
    });

    container.style.display = "none";

    this._framePane = new Pane({ container });
    this._frameLabel = labelInput;

    return container;
  }

  public updateFrameIndicator(current: number, total: number) {
    if (this._bars.length !== total) {
      this._bars.forEach((b) => b.remove());
      this._bars = [];
      const container = this._frameIndicator.firstElementChild as HTMLDivElement;
      for (let i = 0; i < total; i++) {
        const bar = document.createElement("div");
        bar.style.flex = "1";
        bar.style.margin = "0 1px";
        bar.style.height = "8px";
        bar.style.background = "white";
        bar.style.opacity = "0.5";
        bar.dataset.index = String(i);
        bar.addEventListener("pointerenter", () => {
          bar.style.height = "12px";
        });
        bar.addEventListener("pointerleave", () => {
          if (this._app.system.current_frame_index !== i) {
            bar.style.height = "8px";
          }
        });
        container.appendChild(bar);
        this._bars.push(bar);
      }
    }

    this._bars.forEach((b, i) => {
      b.style.height = i === current ? "12px" : "8px";
    });

    (this._frameLabel as HTMLInputElement).value = String(current + 1);
    if (total > 1) {
      this._frameIndicator.style.display = "flex";
    } else {
      this._frameIndicator.style.display = "none";
    }
  }
}

export { GuiManager };
export type { GuiOptions };
