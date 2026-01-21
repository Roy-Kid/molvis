import type { MolvisApp } from "../core/app";
import type { MolvisConfig } from "../core/config";
import { MOLVIS_UI_CSS } from "./styles";
import { InfoPanel } from "./info_panel";
import { ModePanel } from "./mode_panel";
import { PerfPanel } from "./perf_panel";
import { ViewPanel } from "./view_panel";

/**
 * GUIManager - manages all UI overlay components
 */
export class GUIManager {
    private container: HTMLElement;
    private app: MolvisApp;
    private config: MolvisConfig;
    private uiOverlay: HTMLElement | null = null;

    // Components
    private infoPanel: InfoPanel | null = null;
    private modePanel: ModePanel | null = null;
    private viewPanel: ViewPanel | null = null;
    private perfPanel: PerfPanel | null = null;

    constructor(
        container: HTMLElement,
        app: MolvisApp,
        config: MolvisConfig
    ) {
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

        if (this.uiOverlay) {
            this.uiOverlay.remove();
            this.uiOverlay = null;
        }
    }

    /**
     * Inject CSS styles into document head
     */
    private injectStyles(): void {
        const styleId = 'molvis-ui-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = MOLVIS_UI_CSS;
        document.head.appendChild(style);
    }

    /**
     * Create UI overlay container
     */
    private createOverlay(): void {
        this.uiOverlay = document.createElement('div');
        this.uiOverlay.id = 'molvis-ui-overlay';
        this.uiOverlay.className = 'molvis-ui-overlay';
        this.container.appendChild(this.uiOverlay);
    }

    /**
     * Initialize all UI components
     */
    private initComponents(): void {
        if (!this.uiOverlay) return;

        const components = this.config.uiComponents;
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

        // PerfPanel (bottom-right)
        if (components.showPerfPanel) {
            this.perfPanel = new PerfPanel(this.app);
            this.perfPanel.mount(this.uiOverlay);
        }

        // PipelinePanel (right side) - Removed, handled by React UI
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        this.app.events.on('info-text-change', this.handleInfoChange.bind(this));
        this.app.events.on('mode-change', this.handleModeChange.bind(this));
        this.app.events.on('fps-change', this.handleFpsChange.bind(this));
    }

    /**
     * Remove event listeners
     */
    private removeEventListeners(): void {
        this.app.events.off('info-text-change', this.handleInfoChange.bind(this));
        this.app.events.off('mode-change', this.handleModeChange.bind(this));
        this.app.events.off('fps-change', this.handleFpsChange.bind(this));
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
    private handleModeChange(mode: string): void {
        if (this.modePanel) {
            this.modePanel.update(mode as any);
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
}
