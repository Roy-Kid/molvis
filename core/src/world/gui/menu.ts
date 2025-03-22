import { Vector2, Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Control, TextBlock, Rectangle } from '@babylonjs/gui';

export class Menu {
    private container: any;
    private advancedTexture: AdvancedDynamicTexture;
    public isVisible: boolean;
    private infoText: TextBlock;

    constructor(container: any, advancedTexture: AdvancedDynamicTexture) {
        this.container = container;
        this.advancedTexture = advancedTexture;
        this.isVisible = false;


    }

    public show(position: Vector2): void {
        // Position the menu at cursor
        this.container.left = `${position.x - this.advancedTexture.getSize().width / 2}px`;
        this.container.top = `${position.y - this.advancedTexture.getSize().height / 2}px`;
        this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.container.isVisible = true;
        this.isVisible = true;
    }

    public hide(): void {
        this.container.isVisible = false;
        this.isVisible = false;
    }

    public updateInfoText(text: string): void {
        this.infoText.text = text;
    }
}
