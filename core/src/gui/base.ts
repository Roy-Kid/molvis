import { Molvis } from "@molvis/core";

// import { Logger } from "tslog";
// const logger = new Logger({ name: "molvis-gui" });

interface GuiOptions {
}

class GuiManager {

  private _app: Molvis;

  private _infoPanel: HTMLElement;

  constructor(app: Molvis) {
    this._app = app;

    this._infoPanel = this._createInfoPanel();
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
}

export { GuiManager };
export type { GuiOptions };
