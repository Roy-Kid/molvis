export class MolvisTrajectoryPanel extends HTMLElement {
  static get observedAttributes() {
    return ["length", "current", "playing"];
  }

  private shadow: ShadowRoot;
  private slider: HTMLInputElement;
  private currentLabel: HTMLSpanElement;
  private totalLabel: HTMLSpanElement;
  private playBtn: HTMLButtonElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(20, 20, 20, 0.85);
                    backdrop-filter: blur(8px);
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    z-index: 2000;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    transition: opacity 0.3s, transform 0.3s;
                    pointer-events: auto; /* Ensure events are captured */
                }

                :host([hidden]) {
                    display: none;
                }

                input[type=range] {
                    -webkit-appearance: none;
                    width: 200px;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 2px;
                    outline: none;
                }

                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 14px;
                    height: 14px;
                    background: #fff;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: transform 0.1s;
                }

                input[type=range]::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                }

                .controls {
                    display: flex;
                    gap: 4px;
                }

                button {
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.8);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                button:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                }

                .frame-info {
                    font-size: 12px;
                    font-variant-numeric: tabular-nums;
                    min-width: 60px;
                    text-align: center;
                }

                svg {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }
            </style>
            
            <div class="controls">
                <button id="prevBtn" title="Previous Frame (Q)">
                    <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                </button>
                <button id="playBtn" title="Play/Pause (Space)">
                    <svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <svg id="pauseIcon" viewBox="0 0 24 24" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                <button id="nextBtn" title="Next Frame (E)">
                    <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                </button>
            </div>

            <input type="range" id="slider" min="0" max="0" value="0" step="1">

            <div class="frame-info">
                <span id="current">0</span> / <span id="total">0</span>
            </div>
        `;

    this.slider = this.shadow.getElementById("slider") as HTMLInputElement;
    this.currentLabel = this.shadow.getElementById(
      "current",
    ) as HTMLSpanElement;
    this.totalLabel = this.shadow.getElementById("total") as HTMLSpanElement;
    this.playBtn = this.shadow.getElementById("playBtn") as HTMLButtonElement;

    this.bindEvents();
  }

  private bindEvents() {
    this.slider.addEventListener("input", () => {
      const val = Number.parseInt(this.slider.value, 10);
      this.dispatchEvent(new CustomEvent("seek", { detail: val }));
    });

    this.shadow.getElementById("prevBtn")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("prev"));
    });

    this.shadow.getElementById("nextBtn")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("next"));
    });

    this.playBtn.addEventListener("click", () => {
      const isPlaying = this.hasAttribute("playing");
      this.dispatchEvent(new CustomEvent(isPlaying ? "pause" : "play"));
    });

    // Stop propagation to prevent canvas interaction
    const stopPropagation = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const events = [
      "pointerdown",
      "pointermove",
      "pointerup",
      "mousedown",
      "mousemove",
      "mouseup",
      "touchstart",
      "touchmove",
      "touchend",
      "click",
      "contextmenu",
      "wheel",
    ];
    for (const evt of events) {
      this.addEventListener(evt, stopPropagation);
    }
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === "length") {
      const len = Number.parseInt(newValue, 10);
      this.slider.max = (len - 1).toString();
      this.totalLabel.textContent = newValue;
      // Hide if 0 or 1 frame
      if (len <= 1) {
        this.setAttribute("hidden", "");
      } else {
        this.removeAttribute("hidden");
      }
    } else if (name === "current") {
      this.slider.value = newValue;
      this.currentLabel.textContent = newValue;
    } else if (name === "playing") {
      const isPlaying = newValue !== null;
      const playIcon = this.shadow.getElementById("playIcon") as HTMLElement;
      const pauseIcon = this.shadow.getElementById("pauseIcon") as HTMLElement;

      if (isPlaying) {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
      } else {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
      }
    }
  }

  get length(): number {
    return Number.parseInt(this.getAttribute("length") || "0", 10);
  }

  set length(val: number) {
    this.setAttribute("length", val.toString());
  }

  get current(): number {
    return Number.parseInt(this.getAttribute("current") || "0", 10);
  }

  set current(val: number) {
    this.setAttribute("current", val.toString());
  }

  get playing(): boolean {
    return this.hasAttribute("playing");
  }

  set playing(val: boolean) {
    if (val) {
      this.setAttribute("playing", "");
    } else {
      this.removeAttribute("playing");
    }
  }
}
