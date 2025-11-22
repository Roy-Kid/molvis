import { BaseGuiComponent } from "../component";

export class InfoPanel extends BaseGuiComponent {
  constructor() {
    super("div", "info-panel");
    this.applyStyles({
      padding: "8px 12px",
      fontSize: "14px",
      color: "white",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      background: "rgba(0, 0, 0, 0.6)",
      borderRadius: "4px",
      pointerEvents: "auto",
      maxWidth: "100%",
      boxSizing: "border-box",
    });
  }

  public updateText(text: string): void {
    this._element.textContent = text;
    if (text) {
      this.show();
    } else {
      this.hide();
    }
  }
}
