import type { MolvisApp } from "../app";
import type { MolvisConfig } from "../config";
import type { Trajectory } from "../system/trajectory";
import type { ModeType } from "../mode";
import { InfoPanel } from "./panels/info_panel";
import { ModePanel } from "./panels/mode_panel";
import { PerfPanel } from "./panels/perf_panel";
import { MolvisTrajectoryPanel } from "./panels/trajectory_panel";
import { ViewPanel } from "./panels/view_panel";
import { MOLVIS_UI_CSS } from "./styles";

/**
 * GUIManager - manages all UI overlay components
 */
export class GUIManager {
  private container: HTMLElement;
  private app: MolvisApp;
  private config: MolvisConfig;
  private uiOverlay: HTMLElement | null = null;
  private layoutObserver: ResizeObserver | null = null;

  // Components
  private infoPanel: InfoPanel | null = null;
  private modePanel: ModePanel | null = null;
  private viewPanel: ViewPanel | null = null;
  private perfPanel: PerfPanel | null = null;
  private trajectoryPanel: MolvisTrajectoryPanel | null = null;

  // Playback state
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private playbackSpeed = 100; // ms per frame

  constructor(container: HTMLElement, app: MolvisApp, config: MolvisConfig) {
    this.container = container;
    this.app = app;
    this.config = config;
  }

  /**
   * Mount GUI to DOM
   */
  public mount(): void {
    if (!this.config || this.config.showUI === false) {
      return;
    }

    // Register custom element first
    if (!customElements.get("molvis-trajectory-panel")) {
      customElements.define("molvis-trajectory-panel", MolvisTrajectoryPanel);
    }

    this.injectStyles();
    this.createOverlay();
    this.initComponents();
    this.setupEventListeners();
  }

  /**
   * Unmount GUI from DOM
   */
  public unmount(): void {
    this.removeEventListeners();
    this.stopPlayback();

    if (this.infoPanel) {
      this.infoPanel.unmount();
      this.infoPanel = null;
    }

    if (this.modePanel) {
      this.modePanel.unmount();
      this.modePanel = null;
    }

    if (this.viewPanel) {
      this.viewPanel.unmount();
      this.viewPanel = null;
    }

    if (this.perfPanel) {
      this.perfPanel.unmount();
      this.perfPanel = null;
    }

    if (this.trajectoryPanel) {
      this.trajectoryPanel.remove();
      this.trajectoryPanel = null;
    }

    if (this.uiOverlay) {
      this.uiOverlay.remove();
      this.uiOverlay = null;
    }

    if (this.layoutObserver) {
      this.layoutObserver.disconnect();
      this.layoutObserver = null;
    }
  }

  /**
   * Inject CSS styles into document head
   */
  private injectStyles(): void {
    const styleId = "molvis-ui-styles";
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = MOLVIS_UI_CSS;
    document.head.appendChild(style);
  }

  /**
   * Create UI overlay container
   */
  private createOverlay(): void {
    this.uiOverlay = document.createElement("div");
    this.uiOverlay.id = "molvis-ui-overlay";
    this.uiOverlay.className = "molvis-ui-overlay";
    this.container.appendChild(this.uiOverlay);
  }

  /**
   * Initialize all UI components
   */
  private initComponents(): void {
    if (!this.uiOverlay) return;

    const components = this.config.ui;
    if (!components) return;

    // InfoPanel (bottom-left)
    if (components.showInfoPanel) {
      this.infoPanel = new InfoPanel(this.app);
      this.infoPanel.mount(this.uiOverlay);
    }

    // ModePanel (top-right)
    if (components.showModePanel) {
      this.modePanel = new ModePanel(this.app);
      this.modePanel.mount(this.uiOverlay);
    }

    // ViewPanel (top-left)
    if (components.showViewPanel) {
      this.viewPanel = new ViewPanel(this.app);
      this.viewPanel.mount(this.uiOverlay);
    }

    if (components.showPerfPanel) {
      this.perfPanel = new PerfPanel(this.app);
      this.perfPanel.mount(this.uiOverlay);
    }

    // TrajectoryPanel (bottom-center, auto-show)
    if (components.showTrajPanel) {
      this.trajectoryPanel = document.createElement(
        "molvis-trajectory-panel",
      ) as MolvisTrajectoryPanel;
      this.uiOverlay.appendChild(this.trajectoryPanel);

      // Sync initial trajectory state immediately so single-frame datasets stay hidden.
      this.trajectoryPanel.length = this.app.system.trajectory.length;
      this.trajectoryPanel.current = this.app.system.trajectory.currentIndex;
      this.trajectoryPanel.playing = false;
      this.updateTrajectoryPanelLayout();

      // Bind panel events
      this.trajectoryPanel.addEventListener("seek", (e: Event) => {
        this.app.seekFrame((e as CustomEvent).detail);
      });

      this.trajectoryPanel.addEventListener("prev", () => {
        this.app.prevFrame();
      });

      this.trajectoryPanel.addEventListener("next", () => {
        this.app.nextFrame();
      });

      this.trajectoryPanel.addEventListener("play", () => {
        this.startPlayback();
      });

      this.trajectoryPanel.addEventListener("pause", () => {
        this.stopPlayback();
      });
    }

    this.setupLayoutObserver();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.app.events.on("info-text-change", this.handleInfoChange.bind(this));
    this.app.events.on("mode-change", this.handleModeChange.bind(this));
    this.app.events.on("fps-change", this.handleFpsChange.bind(this));

    this.app.events.on(
      "trajectory-change",
      this.handleTrajectoryChange.bind(this),
    );
    this.app.events.on("frame-change", this.handleFrameChange.bind(this));
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    this.app.events.off("info-text-change", this.handleInfoChange.bind(this));
    this.app.events.off("mode-change", this.handleModeChange.bind(this));
    this.app.events.off("fps-change", this.handleFpsChange.bind(this));

    this.app.events.off(
      "trajectory-change",
      this.handleTrajectoryChange.bind(this),
    );
    this.app.events.off("frame-change", this.handleFrameChange.bind(this));
  }

  /**
   * Handle info text change event
   */
  private handleInfoChange(text: string): void {
    if (this.infoPanel) {
      this.infoPanel.update(text);
    }
  }

  /**
   * Handle mode change event
   */
  private handleModeChange(mode: ModeType): void {
    if (this.modePanel) {
      this.modePanel.update(mode);
    }
  }

  /**
   * Handle fps change event
   */
  private handleFpsChange(fps: number): void {
    if (this.perfPanel) {
      this.perfPanel.update(fps);
    }
  }

  private handleTrajectoryChange(traj: Trajectory): void {
    if (this.trajectoryPanel) {
      this.trajectoryPanel.length = traj.length;
      this.updateTrajectoryPanelLayout();
      this.stopPlayback(); // Stop ensuring no weirdness
    }
  }

  private handleFrameChange(index: number): void {
    if (this.trajectoryPanel) {
      this.trajectoryPanel.current = index;
    }
  }

  private setupLayoutObserver(): void {
    if (!this.uiOverlay) return;
    if (!this.trajectoryPanel) return;
    if (this.layoutObserver) {
      this.layoutObserver.disconnect();
      this.layoutObserver = null;
    }

    this.layoutObserver = new ResizeObserver(() => {
      this.updateTrajectoryPanelLayout();
    });
    this.layoutObserver.observe(this.uiOverlay);
  }

  private updateTrajectoryPanelLayout(): void {
    if (!this.trajectoryPanel) return;

    const width = this.app.canvas.clientWidth || this.uiOverlay?.clientWidth || 0;
    const height = this.app.canvas.clientHeight || this.uiOverlay?.clientHeight || 0;
    this.trajectoryPanel.setViewportSize(width, height);
  }

  private startPlayback() {
    if (this.playbackInterval) return;

    if (this.trajectoryPanel) {
      this.trajectoryPanel.playing = true;
    }
    this.playbackInterval = setInterval(() => {
      const sys = this.app.system;
      if (sys.trajectory.currentIndex >= sys.trajectory.length - 1) {
        // Loop or stop? Let's loop
        this.app.seekFrame(0);
      } else {
        this.app.nextFrame();
      }
    }, this.playbackSpeed);
  }

  private stopPlayback() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    if (this.trajectoryPanel) {
      this.trajectoryPanel.playing = false;
    }
  }
}
