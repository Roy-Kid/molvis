import type { MolvisApp } from "../../core/app";
import type { ModeType } from "../../mode";
import type { GUIComponent } from "../types";

/**
 * ModePanel - displays current mode
 * Position: top-right
 * Shows: "View" or "Edit" based on current mode
 */
export class ModePanel implements GUIComponent {
  public element: HTMLElement;
  constructor(_app: MolvisApp) {
    this.element = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "molvis-panel molvis-mode-panel";
    panel.textContent = "View"; // Default
    return panel;
  }

  public mount(container: HTMLElement): void {
    container.appendChild(this.element);
  }

  public unmount(): void {
    this.element.remove();
  }

  public update(mode: ModeType): void {
    // Capitalize first letter and show only current mode
    const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
    this.element.textContent = modeName;
  }

  public show(): void {
    this.element.style.display = "block";
  }

  public hide(): void {
    this.element.style.display = "none";
  }
}
