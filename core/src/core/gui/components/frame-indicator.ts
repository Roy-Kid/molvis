import { BaseGuiComponent } from "../component";
import type { MolvisApp } from "../../app";
import type { Frame } from "../../../structure/frame";

export class FrameIndicator extends BaseGuiComponent {
  private _app: MolvisApp;
  private _frameLabel!: HTMLInputElement;
  private _frameTotal!: HTMLSpanElement;
  private _bars: HTMLDivElement[] = [];
  private _barContainer!: HTMLDivElement;

  constructor(app: MolvisApp) {
    super("div", "frame-indicator");
    this._app = app;
    this._buildUi();
    this._setupEventListeners();
  }

  public updateFrame(current: number, total: number): void {
    this._updateBars(total);
    this._updateHighlight(current);
    this._updateLabels(current, total);
    this._updateVisibility(total);
  }

  private _buildUi(): void {
    this.applyStyles({
      width: "100%",
      padding: "4px",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
      color: "white",
      fontSize: "12px",
      pointerEvents: "auto",
      marginTop: "auto", // Push to bottom if in flex column
    });

    // Create bar container
    this._barContainer = document.createElement("div");
    Object.assign(this._barContainer.style, {
      flex: "1",
      display: "flex",
      justifyContent: "space-between",
      height: "10px",
      alignItems: "flex-end",
      pointerEvents: "auto",
      cursor: "pointer",
    });
    this._element.appendChild(this._barContainer);

    // Create frame input
    this._frameLabel = document.createElement("input");
    this._frameLabel.type = "number";
    this._frameLabel.value = "1";
    Object.assign(this._frameLabel.style, {
      width: "40px",
      marginLeft: "8px",
      background: "transparent",
      border: "1px solid #666",
      color: "white",
      pointerEvents: "auto",
      fontSize: "12px",
      padding: "2px",
    });

    // Create total label
    this._frameTotal = document.createElement("span");
    this._frameTotal.style.marginLeft = "4px";

    this._element.appendChild(this._frameLabel);
    this._element.appendChild(document.createTextNode(" / "));
    this._element.appendChild(this._frameTotal);

    this.hide(); // Hidden by default
  }

  private _setupEventListeners(): void {
    let dragging = false;

    const setFrame = (idx: number) => {
      // Use type assertion if system is not typed in Molvis yet
      const system = (this._app as any).system;
      if (!system) return;

      const clampedIdx = Math.max(0, Math.min(idx, system.n_frames - 1));
      system.set_frame(clampedIdx);
      const frame = system.current_frame;
      this._renderFrame(frame);
      this.updateFrame(clampedIdx, system.n_frames);
    };

    const updateFromEvent = (ev: PointerEvent) => {
      const rect = this._barContainer.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      const idx = Math.floor(ratio * this._bars.length);
      setFrame(idx);
    };

    this._barContainer.addEventListener("pointerdown", (ev) => {
      dragging = true;
      updateFromEvent(ev as PointerEvent);
    });

    this._barContainer.addEventListener("pointermove", (ev) => {
      if (dragging) updateFromEvent(ev as PointerEvent);
    });

    window.addEventListener("pointerup", () => {
      dragging = false;
    });

    this._frameLabel.addEventListener("change", () => {
      const idx = Number.parseInt(this._frameLabel.value) - 1;
      setFrame(idx);
    });
  }

  private _updateBars(total: number): void {
    if (this._bars.length !== total) {
      // Remove old bars
      for (const bar of this._bars) {
        bar.remove();
      }
      this._bars = [];

      // Create new bars
      for (let i = 0; i < total; i++) {
        const bar = document.createElement("div");
        Object.assign(bar.style, {
          width: "2px",
          margin: "0",
          height: "8px",
          background: "white",
          opacity: "0.5",
          transition: "height 0.1s",
        });
        bar.dataset.index = String(i);

        bar.addEventListener("pointerenter", () => {
          bar.style.height = "12px";
        });

        bar.addEventListener("pointerleave", () => {
          bar.style.height = "8px";
          // Re-apply highlight for current frame
          const system = (this._app as any).system;
          if (system && system.current_frame_index === i) {
            bar.style.height = "12px";
          }
        });

        this._barContainer.appendChild(bar);
        this._bars.push(bar);
      }
    }
  }

  private _updateHighlight(current: number): void {
    this._bars.forEach((bar, i) => {
      bar.style.height = i === current ? "12px" : "8px";
      bar.style.opacity = i === current ? "1.0" : "0.5";
    });
  }

  private _updateLabels(current: number, total: number): void {
    this._frameLabel.value = String(current + 1);
    this._frameTotal.textContent = String(total);
  }

  private _updateVisibility(total: number): void {
    if (total > 1) {
      this.show();
      this._element.style.display = "flex"; // Restore flex display
    } else {
      this.hide();
    }
  }

  private _renderFrame(frame: Frame): void {
    this._app.world.clear();
    void this._app.executor.execute("draw_frame", { frame, options: { atoms: {}, bonds: {} } });
  }
}
