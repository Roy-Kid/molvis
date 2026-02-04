import type { Molvis } from "@molvis/core";
import type { HitResult, MenuItem } from "../../mode/types";
import type { MolvisContextMenu } from "../menus/context_menu";

/**
 * Base class for mode-specific context menu controllers.
 * Each mode creates its own controller instance with mode-specific logic.
 *
 * Event flow:
 * 1. Right-click event arrives at mode
 * 2. Mode calls contextMenuController.handleRightClick()
 * 3. Controller decides whether to show menu (via shouldShowMenu)
 * 4. If yes: builds menu items, shows menu, returns true (consumed)
 * 5. If no: returns false, mode handles the event
 */
export abstract class ContextMenuController {
  private menu: MolvisContextMenu | null = null;
  private isVisible = false;
  private onCloseCallback: (() => void) | null = null;

  // Bound event handlers for proper removal
  private boundHandleDocumentClick: (e: MouseEvent) => void;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor(
    protected app: Molvis,
    private containerId: string,
  ) {
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Decide if menu should be shown for this event.
   * Override in subclasses to implement mode-specific logic.
   */
  protected abstract shouldShowMenu(
    hit: HitResult | null,
    isDragging: boolean,
  ): boolean;

  /**
   * Build menu items for the current context.
   * Override in subclasses to provide mode-specific menu items.
   */
  protected abstract buildMenuItems(hit: HitResult | null): MenuItem[];

  /**
   * Handle right-click event.
   * Returns true if event was consumed (menu shown), false otherwise.
   * @param ev Mouse event from Babylon.js (IMouseEvent)
   */
  public handleRightClick(
    ev: MouseEvent,
    hit: HitResult | null,
    isDragging: boolean,
  ): boolean {
    // If menu is already open, close it
    if (this.isVisible) {
      this.hide();
      return true; // Consume the event
    }

    // Check if we should show menu
    if (!this.shouldShowMenu(hit, isDragging)) {
      return false; // Don't consume, let mode handle it
    }

    // Global override from config
    if (this.app.config.ui?.showContextMenu === false) {
      return false;
    }

    // Prevent default context menu
    ev.preventDefault();

    // Build and show menu
    const items = this.buildMenuItems(hit);
    if (items.length > 0) {
      this.show(ev.clientX, ev.clientY, items);
      return true; // Consumed
    }

    return false; // No items, don't consume
  }

  /**
   * Show the context menu at the specified position
   */
  public show(x: number, y: number, items: MenuItem[]): void {
    // Build menu if needed
    if (!this.menu) {
      this.buildContainer();
    }

    if (!this.menu) return;

    // Show (the component handles clearing and rendering items)
    this.menu.show(x, y, items);
    this.isVisible = true;

    // Add document listeners to handle click outside and ESC
    setTimeout(() => {
      this.addDocumentListeners();
    }, 0);
  }

  /**
   * Hide the context menu
   */
  public hide(): void {
    this.removeDocumentListeners();

    if (this.menu) {
      this.menu.hide();
    }

    const wasVisible = this.isVisible;
    this.isVisible = false;

    // Notify callback if menu was visible and is now closed
    if (wasVisible && this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * Check if menu is currently visible
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Set callback to be called when menu is closed
   */
  public setOnCloseCallback(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * Dispose of the menu and clean up resources
   */
  public dispose(): void {
    this.removeDocumentListeners();
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }

  // Private methods

  private buildContainer(): void {
    // Check if container already exists
    const existingMenu = document.getElementById(
      this.containerId,
    ) as MolvisContextMenu;

    if (existingMenu) {
      this.menu = existingMenu;
    } else {
      // Create new menu container
      this.menu = document.createElement(
        "molvis-context-menu",
      ) as MolvisContextMenu;
      this.menu.id = this.containerId;

      // Mount to UI overlay container
      this.app.uiContainer.appendChild(this.menu);
    }
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!this.isVisible || !this.menu) return;

    // Check if click is inside the menu
    const rect = this.menu.getBoundingClientRect();
    const clickInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!clickInside) {
      this.hide();
      // Don't prevent default or stop propagation - let the click go through
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.key === "Escape") {
      this.hide();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  private addDocumentListeners(): void {
    // Use 'click' instead of 'mousedown' to handle both left and right clicks
    document.addEventListener("click", this.boundHandleDocumentClick, true);
    document.addEventListener(
      "contextmenu",
      this.boundHandleDocumentClick,
      true,
    );
    document.addEventListener("keydown", this.boundHandleKeyDown, true);
  }

  private removeDocumentListeners(): void {
    document.removeEventListener("click", this.boundHandleDocumentClick, true);
    document.removeEventListener(
      "contextmenu",
      this.boundHandleDocumentClick,
      true,
    );
    document.removeEventListener("keydown", this.boundHandleKeyDown, true);
  }
}
