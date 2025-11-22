import { BaseGuiComponent } from "../component";

export class ModeIndicator extends BaseGuiComponent {
  private _currentMode = "";

  constructor() {
    super("div", "mode-indicator");
    this.applyStyles({
      padding: "8px 12px",
      background: "rgba(0, 0, 0, 0.6)",
      color: "white",
      borderRadius: "4px",
      fontSize: "14px",
      fontWeight: "bold",
      userSelect: "none",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
      pointerEvents: "auto",
      whiteSpace: "nowrap",
      cursor: "default",
    });
  }

  public updateMode(mode: string): void {
    if (this._currentMode !== mode) {
      this._currentMode = mode;
      this._element.textContent = mode.toUpperCase();
    }
  }
}
