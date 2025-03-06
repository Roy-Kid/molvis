import type { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  Slider,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { Logger } from "tslog";
import type { System } from "./system";
import type { World } from "./world";

const logger = new Logger({ name: "molvis-gui" });

interface GuiOptions {
  useFrameIndicator: boolean;
}

class GuiManager {
  private _world: World;
  private _system: System;

  private _rootTexture: AdvancedDynamicTexture;
  private _infoPanel: TextBlock;
  private _frameIndicator: FrameIndicator;

  constructor(world: World, system: System, guiOptions: GuiOptions) {
    this._world = world;
    this._system = system;

    this._rootTexture = this._createRootTexture(world.scene);
    this._infoPanel = this._createInfoPanel();

    this._frameIndicator = new FrameIndicator(this._rootTexture, this._system);
    this._frameIndicator.visible = guiOptions.useFrameIndicator;
  }

  private _createRootTexture(scene: Scene): AdvancedDynamicTexture {
    const texture = AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene,
    );
    texture.rootContainer.scaleX = window.devicePixelRatio;
    texture.rootContainer.scaleY = window.devicePixelRatio;
    return texture;
  }

  private _createInfoPanel(): TextBlock {
    const textBlock = new TextBlock("info_panel");
    textBlock.color = "white";
    textBlock.fontSize = 32;
    textBlock.top = "46%";
    textBlock.left = "3%";
    textBlock.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_LEFT;
    this._rootTexture.addControl(textBlock);
    return textBlock;
  }

  public updateInfoText(text: string): void {
    this._infoPanel.text = text;
  }

  public updateFrameIndicator(currentIndex: number, totalFrames: number): void {
    this._frameIndicator.update(currentIndex, totalFrames);
  }

  public get rootTexture(): AdvancedDynamicTexture {
    return this._rootTexture;
  }
}

class FrameIndicator {
  private _container: StackPanel;

  constructor(texture: AdvancedDynamicTexture, system: System) {
    const panel = new StackPanel();
    panel.isVertical = false;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.height = "40px";
    panel.paddingBottom = "10px";

    const header = new TextBlock();
    header.text = "";
    header.height = "30px";
    header.color = "white";
    panel.addControl(header);

    const slider = new Slider();
    slider.minimum = 0;
    slider.maximum = system.n_frames;
    slider.value = 0;
    slider.isVertical = false;
    slider.height = "20px";
    slider.width = "200px";
    slider.onValueChangedObservable.add((value) => {
      header.text = `${value} / ${system.n_frames}`;
      system.set_frame(value);
    });
    panel.addControl(slider);
    this._container = panel;
    texture.addControl(panel);
  }

  get visible(): boolean {
    return this._container.isVisible;
  }

  set visible(value: boolean) {
    this._container.isVisible = value;
  }

  public update(currentIndex: number, totalFrames: number): void {
    const header = this._container.children[0] as TextBlock;
    const slider = this._container.children[1] as Slider;
    slider.maximum = totalFrames;
    slider.value = currentIndex;
    header.text = `${currentIndex} / ${totalFrames}`;
  }
}

export { GuiManager };
export type { GuiOptions };
