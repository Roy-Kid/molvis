import type { MolvisApp } from "../app";
import type { ResolvedMolvisOptions } from "../options";
import { ModeIndicator } from "./components/mode-indicator";
import { ViewIndicator } from "./components/view-indicator";
import { InfoPanel } from "./components/info-panel";
import { FrameIndicator } from "./components/frame-indicator";
import { createLogger } from "../../utils/logger";

const logger = createLogger("molvis-gui");

export class GuiManager {
    private _app: MolvisApp;
    private _overlay: HTMLElement;
    private _options: ResolvedMolvisOptions;
    private _layers: Map<string, HTMLElement> = new Map();

    // Component instances
    private _modeIndicator!: ModeIndicator;
    private _viewIndicator!: ViewIndicator;
    private _infoPanel!: InfoPanel;
    private _frameIndicator!: FrameIndicator;

    constructor(app: MolvisApp, overlay: HTMLElement, options: ResolvedMolvisOptions) {
        this._app = app;
        this._overlay = overlay;
        this._options = options;

        // Don't override position - it's already set to absolute in app.ts
        // Just ensure pointer-events is none for the overlay itself
        this._overlay.style.pointerEvents = 'none';

        this._initializeComponents();
    }

    private _initializeComponents(): void {
        const opts = this._options.uiComponents;

        // Mode Indicator - Top Left
        const modeLayer = this.createLayer('mode-indicator', {
            position: 'absolute',
            top: '2%',
            left: '2%',
            pointerEvents: 'auto',
        });
        this._modeIndicator = new ModeIndicator();
        this._modeIndicator.mount(modeLayer);

        // View Indicator - Top Right
        const viewLayer = this.createLayer('view-indicator', {
            position: 'absolute',
            top: '2%',
            right: '2%',
            pointerEvents: 'auto',
        });
        this._viewIndicator = new ViewIndicator();
        this._viewIndicator.mount(viewLayer);

        // Info Panel - Bottom Left
        const infoLayer = this.createLayer('info-panel', {
            position: 'absolute',
            bottom: '10%',
            left: '2%',
            pointerEvents: 'auto',
        });
        this._infoPanel = new InfoPanel();
        this._infoPanel.mount(infoLayer);

        // Frame Indicator - Bottom (full width)
        const frameLayer = this.createLayer('frame-indicator', {
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            pointerEvents: 'auto',
        });
        this._frameIndicator = new FrameIndicator(this._app);
        this._frameIndicator.mount(frameLayer);

        // Apply initial visibility
        this.enableLayer('mode-indicator', opts.showModeIndicator);
        this.enableLayer('view-indicator', opts.showViewIndicator);
        this.enableLayer('info-panel', opts.showInfoPanel);
        this.enableLayer('frame-indicator', opts.showFrameIndicator);
    }

    public initializeDefaultStates(): void {
        // Initialize with current mode
        if (this._app.mode?.currentModeName) {
            this._modeIndicator.updateMode(this._app.mode.currentModeName);
        } else {
            this._modeIndicator.updateMode("edit");
        }

        // Initialize with current view mode
        try {
            const isOrthographic = this._app.world.isOrthographic();
            this._viewIndicator.updateView(isOrthographic);
        } catch (error) {
            logger.warn('Failed to get orthographic state:', error);
            this._viewIndicator.updateView(false);
        }

        // Initialize frame indicator
        try {
            if ((this._app as any).system) {
                this._frameIndicator.updateFrame(
                    (this._app as any).system.current_frame_index,
                    (this._app as any).system.n_frames
                );
            } else {
                this._frameIndicator.updateFrame(0, 1);
            }
        } catch (error) {
            logger.warn('Failed to initialize frame indicator:', error);
            this._frameIndicator.updateFrame(0, 1);
        }

    }

    // Public API methods
    public updateMode(mode: string): void {
        this._modeIndicator.updateMode(mode);
    }

    public updateView(isOrthographic: boolean): void {
        this._viewIndicator.updateView(isOrthographic);
    }

    public updateInfoText(text: string): void {
        this._infoPanel.updateText(text);
    }

    public updateFrameIndicator(current: number, total: number): void {
        this._frameIndicator.updateFrame(current, total);
    }

    // Layer management
    public createLayer(id: string, styles: Partial<CSSStyleDeclaration> = {}): HTMLElement {
        const layer = document.createElement('div');
        layer.className = `ui-layer ${id}`;
        layer.dataset.layerId = id;
        Object.assign(layer.style, styles);
        this._overlay.appendChild(layer);
        this._layers.set(id, layer);
        return layer;
    }

    public getLayer(id: string): HTMLElement | undefined {
        return this._layers.get(id);
    }

    public enableLayer(id: string, enabled: boolean): void {
        const layer = this._layers.get(id);
        if (layer) {
            layer.style.display = enabled ? 'block' : 'none';
        }
    }

    public dispose(): void {
        this._modeIndicator.dispose();
        this._viewIndicator.dispose();
        this._infoPanel.dispose();
        this._frameIndicator.dispose();

        for (const layer of this._layers.values()) {
            if (layer.parentElement) {
                layer.parentElement.removeChild(layer);
            }
        }
        this._layers.clear();
    }
}
