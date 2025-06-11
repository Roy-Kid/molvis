import { Molvis, draw_frame } from "@molvis/core";

// import { Logger } from "tslog";
// const logger = new Logger({ name: "molvis-gui" });

interface GuiOptions {
}

class GuiManager {

  private _app: Molvis;

  private _infoPanel: HTMLElement;
  private _frameIndicator: HTMLDivElement;
  private _frameSlider: HTMLInputElement;
  private _frameLabel: HTMLSpanElement;

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

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.value = "0";
    slider.step = "1";
    slider.style.flex = "1";
    slider.style.margin = "0 8px";

    slider.addEventListener("input", () => {
      const idx = Number.parseInt(slider.value);
      this._app.system.set_frame(idx);
      const frame = this._app.system.current_frame;
      draw_frame(this._app, frame, { atoms: {}, bonds: {}, clean: true });
      this.updateFrameIndicator(idx, this._app.system.n_frames);
    });

    const label = document.createElement("span");
    label.textContent = "0/0";

    container.appendChild(slider);
    container.appendChild(label);
    container.style.display = "none";

    document.body.appendChild(container);

    this._frameSlider = slider;
    this._frameLabel = label;

    return container;
  }

  public updateFrameIndicator(current: number, total: number) {
    this._frameSlider.max = `${Math.max(total - 1, 0)}`;
    this._frameSlider.value = `${current}`;
    this._frameLabel.textContent = `${current + 1}/${total}`;
    if (total > 1) {
      this._frameIndicator.style.display = "flex";
    } else {
      this._frameIndicator.style.display = "none";
    }
  }
}

export { GuiManager };
export type { GuiOptions };
