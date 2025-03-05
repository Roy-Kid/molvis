import { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-gui" });

class GuiManager {
  private _rootTexture: AdvancedDynamicTexture;
  private _infoPanel: TextBlock;
  private _frameIndicator: FrameIndicator;

  constructor(scene: Scene) {
    this._rootTexture = this._createRootTexture(scene);
    this._infoPanel = this._createInfoPanel();
    this._frameIndicator = new FrameIndicator(this._rootTexture);
  }

  private _createRootTexture(scene: Scene): AdvancedDynamicTexture {
    const texture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
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
  private _frameMarkers: Rectangle[] = [];
  private _texture: AdvancedDynamicTexture;
  private _totalFrames: number = 0;
  private _currentIndex: number = 0;

  constructor(rootTexture: AdvancedDynamicTexture) {
    this._texture = rootTexture;
    this._container = this._createContainer();
    this._texture.addControl(this._container);
  }

  private _createContainer(): StackPanel {
    const panel = new StackPanel();
    panel.isVertical = false;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.height = "40px";
    panel.paddingBottom = "10px";
    return panel;
  }

  public update(currentIndex: number, totalFrames: number): void {
    if (totalFrames <= 0) return;

    this._currentIndex = currentIndex;
    this._totalFrames = totalFrames;

    // Clear existing markers
    this._frameMarkers.forEach(marker => {
      this._container.removeControl(marker);
    });
    this._frameMarkers = [];

    const numMarkers = Math.min(totalFrames, 30); // Limit the number of markers for performance
    const markerWidth = 200 / numMarkers;

    for (let i = 0; i < numMarkers; i++) {
      const frameIndex = Math.floor((i / numMarkers) * totalFrames);
      const marker = new Rectangle(`frameMarker_${i}`);
      marker.width = `${markerWidth}px`;
      marker.height = "30px";
      marker.cornerRadius = 5;
      marker.color = "white";
      marker.thickness = 1;
      marker.background = (frameIndex === currentIndex) ? "green" : "gray";

      this._container.addControl(marker);
      this._frameMarkers.push(marker);
    }
  }
}

export { GuiManager };