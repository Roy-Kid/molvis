import type { MenuItem } from "../../mode/types";
import { MolvisElement } from "../base";

/**
 * MolvisButton - Clickable button menu item
 */
export class MolvisButton extends MolvisElement {
  private _data: MenuItem | null = null;
  private _rendered = false;

  set data(item: MenuItem) {
    this._data = item;
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  connectedCallback() {
    // Don't render if already rendered via data setter
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  protected override render(): void {
    this.injectSharedStyles();

    const style = document.createElement("style");
    style.textContent = `
            :host {
                display: block;
            }
            
            .button {
                padding: 6px 12px;
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s;
            }
            
            .button:hover {
                background: var(--hover-color);
            }
        `;
    this.root.appendChild(style);

    const button = document.createElement("div");
    button.className = "button";
    button.textContent = this._data?.title || "";

    button.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent click-through to canvas
      if (this._data?.action) {
        this._data.action();
      }
    });

    this.root.appendChild(button);
  }
}
