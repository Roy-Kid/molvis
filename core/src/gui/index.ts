import type { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture
} from "@babylonjs/gui";
import { System, World } from "@molvis/core";

// import { Logger } from "tslog";
// const logger = new Logger({ name: "molvis-gui" });

interface GuiOptions {
}

class GuiManager {

  private _system: System;
  private _world: World;

  private _rootTexture: AdvancedDynamicTexture;
  private _infoPanel: HTMLElement;
  // private _contextMenu: ContextMenu;

  // private _frameIndicator: FrameIndicator;

  constructor(system: System, world: World) {
    this._system = system;
    this._world = world;

    this._rootTexture = this._createRootTexture();
    this._infoPanel = this._createInfoPanel();
    // this._contextMenu = this._createContextMenu();

    // this._frameIndicator = this._createFrameIndicator();
    // this._frameIndicator.visible = guiOptions.useFrameIndicator;
  }

  get scene(): Scene {
    return this._world.scene;
  }

  private _createRootTexture(): AdvancedDynamicTexture {
    const texture = AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      this.scene,
    );
    // texture.rootContainer.scaleX = window.devicePixelRatio;
    // texture.rootContainer.scaleY = window.devicePixelRatio;
    return texture;
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

  public get rootTexture(): AdvancedDynamicTexture {
    return this._rootTexture;
  }

  public updateInfoText(text: string): void {
    this._infoPanel.textContent = text;
  }
}

export { GuiManager };
export type { GuiOptions };
