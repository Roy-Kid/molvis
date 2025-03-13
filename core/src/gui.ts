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

    this._frameIndicator = new FrameIndicator(this._rootTexture, this._world, this._system);
    this._frameIndicator.visible = guiOptions.useFrameIndicator;

    logger.info("GUI manager initialized");
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

  constructor(texture: AdvancedDynamicTexture, world: World, system: System) {
    const panel = new StackPanel();
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.adaptHeightToChildren = true;
    texture.addControl(panel);

    const header = new TextBlock("frame_header");
    header.text = "";
    header.height = "30px";
    header.color = "white";
    panel.addControl(header);

    const slider = new Slider("frame_slider");
    slider.minimum = 1;
    slider.maximum = system.n_frames;
    slider.value = 1;
    slider.height = "20px";
    slider.width = "400px";
    let prev_value = 1;
    slider.onValueChangedObservable.add((value) => {
      let value_num = Number.isNaN(value) ? 1 : value;
      value_num = Math.round(value_num);
      if (value_num !== prev_value) {
        console.log(value);
        header.text = `${value_num} / ${system.n_frames}`;
        system.set_frame(value_num-1);
        world.artist.draw_frame(system.current_frame);
        prev_value = value_num;
      }

    });
    panel.addControl(slider);
    this._container = panel;
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
