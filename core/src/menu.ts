import type { EventState, Scene, Vector2 } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  type Vector2WithInfo,
} from "@babylonjs/gui";

export interface ContextMenuItem {
  label: string;
  callback: () => void;
  icon?: string;
}

export class ContextMenu {
  private scene: Scene;
  private advancedTexture: AdvancedDynamicTexture;
  private container: Rectangle;
  private panel: StackPanel;
  private items: ContextMenuItem[] = [];
  private isVisible = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "ContextMenu",
      true,
      this.scene,
    );

    // Create container for the menu
    this.container = new Rectangle("contextMenuContainer");
    this.container.width = "200px";
    this.container.background = "#333333";
    this.container.color = "#ffffff";
    this.container.cornerRadius = 5;
    this.container.thickness = 1;
    this.container.isVisible = false;
    this.container.zIndex = 1000;
    this.advancedTexture.addControl(this.container);

    // Create stack panel for menu items
    this.panel = new StackPanel("contextMenuPanel");
    this.panel.isVertical = true;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.addControl(this.panel);

    // Handle click outside to close menu
    this.advancedTexture.rootContainer.onPointerDownObservable.add(() => {
      if (this.isVisible) {
        this.hide();
      }
    });

    // Prevent closing when clicking on the menu itself
    this.container.onPointerDownObservable.add(
      (evt: Vector2WithInfo, evtState: EventState) => {
        evtState.skipNextObservers = true;
      },
    );

    // Prevent default context menu
    window.addEventListener("contextmenu", (evt) => {
      if (this.scene.isReady()) {
        evt.preventDefault();
      }
    });
  }

  /**
   * Add items to the context menu
   * @param items Array of menu items to add
   */
  public setItems(items: ContextMenuItem[]): void {
    this.items = items;
    this.rebuildMenu();
  }

  /**
   * Add a single item to the context menu
   * @param item Menu item to add
   */
  public addItem(item: ContextMenuItem): void {
    this.items.push(item);
    this.rebuildMenu();
  }

  /**
   * Show the context menu at the specified position
   * @param position Screen position to show the menu
   */
  public show(position: Vector2): void {
    // Position the menu at cursor
    this.container.left = position.x + "px";
    this.container.top = position.y + "px";
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.isVisible = true;
    this.isVisible = true;
  }

  /**
   * Hide the context menu
   */
  public hide(): void {
    this.container.isVisible = false;
    this.isVisible = false;
  }

  /**
   * Rebuild the menu with current items
   */
  private rebuildMenu(): void {
    // Clear existing items
    this.panel.children.slice().forEach((control) => {
      this.panel.removeControl(control);
    });

    // Add new items
    this.items.forEach((item, index) => {
      const button = this.createMenuItem(item, index === this.items.length - 1);
      this.panel.addControl(button);
    });

    // Adjust container height based on number of items
    this.container.height = this.items.length * 40 + "px";
  }

  /**
   * Create a menu item button
   */
  private createMenuItem(item: ContextMenuItem, isLast: boolean): Button {
    const button = Button.CreateSimpleButton(`menuItem_${item.label}`, "");
    button.height = "40px";
    button.thickness = 0;
    button.cornerRadius = 0;
    button.color = "white";
    button.background = "#333333";
    button.paddingLeft = "10px";
    button.paddingRight = "10px";
    button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    // Add hover effect
    button.onPointerEnterObservable.add(() => {
      button.background = "#555555";
    });
    button.onPointerOutObservable.add(() => {
      button.background = "#333333";
    });

    // Add text
    const textBlock = new TextBlock();
    textBlock.text = item.label;
    textBlock.color = "white";
    textBlock.fontSize = 14;
    textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    button.addControl(textBlock);

    // Add icon if provided
    if (item.icon) {
      // Here you could add an image control with the icon
      // This would require additional code to handle icon positioning
    }

    // Add separator except for last item
    if (!isLast) {
      const separator = new Rectangle("separator");
      separator.height = "1px";
      separator.background = "#444444";
      separator.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.panel.addControl(separator);
    }

    // Add click handler - CRITICAL FIX: This was missing in the return statement
    button.onPointerUpObservable.add(() => {
      item.callback();
      this.hide();
    });

    return button;
  }

  /**
   * if menu is open
   */
  public isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Dispose the context menu and its resources
   */
  public dispose(): void {
    this.advancedTexture.dispose();
  }
}
