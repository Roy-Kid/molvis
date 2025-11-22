import { BaseGuiComponent } from "../component";

export class ViewIndicator extends BaseGuiComponent {
  private _isOrthographic = false;

  constructor() {
    super("div", "view-indicator");
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
      cursor: "pointer",
    });
    this._element.textContent = "PERSP";
  }

  public updateView(isOrthographic: boolean): void {
    if (this._isOrthographic !== isOrthographic) {
      this._isOrthographic = isOrthographic;
      this._element.textContent = isOrthographic ? "ORTHO" : "PERSP";
    }
  }
}
