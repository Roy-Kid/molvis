import type { MolvisApp as Molvis } from "../../app";
import type { HitResult, MenuItem } from "../../mode/types";
import type { MolvisContextMenu } from "./context_menu";
import { contextMenuRegistry } from "./registry";

export interface ContextMenuHostOptions {
  /** Clicks on these targets do not dismiss the menu (e.g. ViewPanel chrome). */
  ignoreCloseTargets?: () => Iterable<EventTarget>;
}

export interface ContextMenuShowOptions {
  hit?: HitResult | null;
}

/**
 * Single owner of floating context-menu lifecycle: mount, resolve, wrap,
 * registry mutual exclusion, and document-level dismiss listeners.
 * Mode controllers and ViewPanel compose this; they do not reimplement it.
 */
export class ContextMenuHost {
  private menu: MolvisContextMenu | null = null;
  private isVisible_ = false;
  private onCloseCallback: (() => void) | null = null;

  private readonly boundHandleDocumentClick: (e: MouseEvent) => void;
  private readonly boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor(
    private readonly app: Molvis,
    private readonly menuId: string,
    private readonly options: ContextMenuHostOptions = {},
  ) {
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  get isVisible(): boolean {
    return this.isVisible_;
  }

  public setOnCloseCallback(callback: (() => void) | null): void {
    this.onCloseCallback = callback;
  }

  /**
   * Show the menu at (x, y). Returns true if it became visible with ≥1 item.
   */
  public show(
    x: number,
    y: number,
    items: readonly MenuItem[],
    options?: ContextMenuShowOptions,
  ): boolean {
    if (this.app.config.ui?.showContextMenu === false) {
      return false;
    }

    const resolved = this.app.resolveContextMenuItems({
      menuId: this.menuId,
      hit: options?.hit ?? null,
      items,
    });
    if (resolved.length === 0) {
      return false;
    }

    if (!this.ensureMenu()) {
      return false;
    }
    if (!this.menu) return false;

    contextMenuRegistry.activate(this.menuId, () => this.hide());
    this.menu.show(x, y, this.wrapMenuItems(resolved));
    this.isVisible_ = true;

    // Delay so the opening click does not immediately dismiss.
    setTimeout(() => {
      if (this.isVisible_) {
        this.addDocumentListeners();
      }
    }, 0);

    return true;
  }

  public hide(): void {
    this.removeDocumentListeners();

    if (this.menu) {
      this.menu.hide();
    }

    const wasVisible = this.isVisible_;
    this.isVisible_ = false;
    contextMenuRegistry.deactivate(this.menuId);

    if (wasVisible && this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * If visible, hide and return false. Otherwise show and return show's result.
   */
  public toggle(
    x: number,
    y: number,
    items: readonly MenuItem[],
    options?: ContextMenuShowOptions,
  ): boolean {
    if (this.isVisible_) {
      this.hide();
      return false;
    }
    return this.show(x, y, items, options);
  }

  public dispose(): void {
    this.removeDocumentListeners();
    contextMenuRegistry.deactivate(this.menuId);
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
    this.isVisible_ = false;
  }

  private ensureMenu(): boolean {
    if (this.menu?.isConnected) {
      return true;
    }

    const existing = document.getElementById(
      this.menuId,
    ) as MolvisContextMenu | null;
    if (existing) {
      this.menu = existing;
      return true;
    }

    const menu = document.createElement(
      "molvis-context-menu",
    ) as MolvisContextMenu;
    menu.id = this.menuId;
    this.app.uiContainer.appendChild(menu);
    this.menu = menu;
    return true;
  }

  private wrapMenuItems(items: MenuItem[]): MenuItem[] {
    return items.map((item) => {
      if (item.type === "folder") {
        return { ...item, items: this.wrapMenuItems(item.items) };
      }
      if (item.type !== "button") {
        return item;
      }

      const originalAction = item.action;
      return {
        ...item,
        action: () => {
          try {
            originalAction();
          } finally {
            this.hide();
          }
        },
      };
    });
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!this.isVisible_ || !this.menu) return;

    const path = e.composedPath();
    if (path.includes(this.menu)) return;

    const ignore = this.options.ignoreCloseTargets?.() ?? [];
    for (const target of ignore) {
      if (path.includes(target)) return;
    }

    this.hide();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible_) return;
    if (e.key !== "Escape") return;
    this.hide();
    e.stopPropagation();
    e.preventDefault();
  }

  private addDocumentListeners(): void {
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
