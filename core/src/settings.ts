import type { ArcRotateCamera } from "@babylonjs/core";
import type { MolvisApp } from "./app";

/**
 * User settings that can be adjusted at runtime
 */
// Grid configuration
export interface GridConfig {
  enabled?: boolean;
  mainColor?: string;
  lineColor?: string;
  opacity?: number;
  majorUnitFrequency?: number;
  minorUnitVisibility?: number;
  size?: number;
}

// Graphics configuration
export interface GraphicsConfig {
  shadows?: boolean;
  postProcessing?: boolean;
  ssao?: boolean;
  bloom?: boolean;
  ssr?: boolean;
  dof?: boolean;
  fxaa?: boolean;
  hardwareScaling?: number;
}

/**
 * User settings that can be adjusted at runtime
 */
export interface MolvisSetting {
  // Camera Controls
  cameraPanSpeed: number;
  cameraRotateSpeed: number;
  cameraZoomSpeed: number;
  cameraInertia: number;
  cameraPanInertia: number;

  // Camera Limits
  cameraMinRadius: number;
  cameraMaxRadius: number | null;

  // Lighting
  lighting: LightingSettings;

  // Rendering
  grid: GridConfig; // Settings usually hold concrete values
  graphics: GraphicsConfig;
}

export interface LightingSettings {
  lightDir: [number, number, number];
  ambient: number;
  diffuse: number;
  specular: number;
  specularPower: number;
}

/**
 * Default user settings
 */
export const DEFAULT_SETTING: MolvisSetting = {
  cameraPanSpeed: 500,
  cameraRotateSpeed: 500,
  cameraZoomSpeed: 10,
  cameraInertia: 0.0,
  cameraPanInertia: 0.0,
  cameraMinRadius: 1,
  cameraMaxRadius: null,
  lighting: {
    lightDir: [0.5, 0.5, -1.0],
    ambient: 0.4,
    diffuse: 0.4,
    specular: 0.0,
    specularPower: 4,
  },
  grid: {
    enabled: false,
    mainColor: "#888888",
    lineColor: "#444444",
    opacity: 0.5,
    majorUnitFrequency: 10,
    minorUnitVisibility: 0.5,
    size: 1000,
  },
  graphics: {
    shadows: false,
    postProcessing: false,
    ssao: false,
    bloom: false,
    ssr: false,
    dof: false,
    fxaa: true, // Low-cost AA
    hardwareScaling: 1.0, // 1.0 = native DPR, <1 faster/blurrier, >1 sharper/slower
  },
};

/**
 * Settings manager for runtime user preferences
 */
export class Settings {
  private values: MolvisSetting;
  private defaults: MolvisSetting;
  private app: MolvisApp;

  constructor(app: MolvisApp, initialSetting?: Partial<MolvisSetting>) {
    this.app = app;
    this.defaults = { ...DEFAULT_SETTING };
    // Use helper to ensure deep merge of nested properties
    this.values = defaultMolvisSettings(initialSetting);
    this.applyAll();
  }

  /**
   * Set camera pan speed (maps to panningSensibility)
   */
  setCameraPanSpeed(speed: number): void {
    const next = this.sanitizePositive(speed, this.defaults.cameraPanSpeed);
    this.values.cameraPanSpeed = next;
    this.camera.panningSensibility = next;
  }

  /**
   * Set camera rotate speed (maps to angularSensibilityX/Y)
   */
  setCameraRotateSpeed(speed: number): void {
    const next = this.sanitizePositive(speed, this.defaults.cameraRotateSpeed);
    this.values.cameraRotateSpeed = next;
    this.camera.angularSensibilityX = next;
    this.camera.angularSensibilityY = next;
  }

  /**
   * Set camera zoom speed (maps to wheelPrecision)
   */
  setCameraZoomSpeed(speed: number): void {
    const next = this.sanitizePositive(speed, this.defaults.cameraZoomSpeed);
    this.values.cameraZoomSpeed = next;
    this.camera.wheelPrecision = next;
  }

  /**
   * Set camera inertia
   */
  setCameraInertia(inertia: number): void {
    const next = this.sanitizeInertia(inertia, this.defaults.cameraInertia);
    this.values.cameraInertia = next;
    this.camera.inertia = next;
  }

  setCameraPanInertia(inertia: number): void {
    const next = this.sanitizeInertia(inertia, this.defaults.cameraPanInertia);
    this.values.cameraPanInertia = next;
    this.camera.panningInertia = next;
  }

  /**
   * Set camera minimum radius
   */
  setCameraMinRadius(radius: number): void {
    this.values.cameraMinRadius = radius;
    this.camera.lowerRadiusLimit = radius;
  }

  /**
   * Set camera maximum radius
   */
  setCameraMaxRadius(radius: number | null): void {
    this.values.cameraMaxRadius = radius;
    this.camera.upperRadiusLimit = radius;
  }

  /**
   * Get camera pan speed (panningSensibility)
   */
  getCameraPanSpeed(): number {
    return this.values.cameraPanSpeed;
  }

  /**
   * Get camera rotate speed (angularSensibilityX/Y)
   */
  getCameraRotateSpeed(): number {
    return this.values.cameraRotateSpeed;
  }

  /**
   * Get camera zoom speed (wheelPrecision)
   */
  getCameraZoomSpeed(): number {
    return this.values.cameraZoomSpeed;
  }

  /**
   * Get camera inertia
   */
  getCameraInertia(): number {
    return this.values.cameraInertia;
  }

  getCameraPanInertia(): number {
    return this.values.cameraPanInertia;
  }

  /**
   * Get camera minimum radius
   */
  getCameraMinRadius(): number {
    return this.values.cameraMinRadius;
  }

  /**
   * Get camera maximum radius
   */
  getCameraMaxRadius(): number | null {
    return this.values.cameraMaxRadius;
  }

  /**
   * Get lighting settings
   */
  getLighting(): LightingSettings {
    return this.values.lighting;
  }

  getGrid(): GridConfig {
    return this.values.grid;
  }

  getGraphics(): GraphicsConfig {
    return this.values.graphics;
  }

  /**
   * Update Grid Settings
   */
  setGrid(config: Partial<GridConfig>): void {
    this.values.grid = { ...this.values.grid, ...config };

    // Notify Grid
    if (this.app.world?.grid) {
      this.app.world.grid.update(this.values.grid);
    }
  }

  /**
   * Update Graphics Settings
   */
  setGraphics(config: Partial<GraphicsConfig>): void {
    this.values.graphics = { ...this.values.graphics, ...config };

    // Notify World
    if (this.app.world) {
      this.app.world.applyGraphicsSettings(this.values.graphics);
    }
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this.setCameraPanSpeed(this.defaults.cameraPanSpeed);
    this.setCameraRotateSpeed(this.defaults.cameraRotateSpeed);
    this.setCameraZoomSpeed(this.defaults.cameraZoomSpeed);
    this.setCameraInertia(this.defaults.cameraInertia);
    this.setCameraPanInertia(this.defaults.cameraPanInertia);
    this.setCameraMinRadius(this.defaults.cameraMinRadius);
    this.setCameraMaxRadius(this.defaults.cameraMaxRadius);
    // Reset lighting to default
    this.values.lighting = { ...this.defaults.lighting };
    this.setGrid(this.defaults.grid);
    this.setGraphics(this.defaults.graphics);
  }

  private applyAll(): void {
    this.setCameraPanSpeed(this.values.cameraPanSpeed);
    this.setCameraRotateSpeed(this.values.cameraRotateSpeed);
    this.setCameraZoomSpeed(this.values.cameraZoomSpeed);
    this.setCameraInertia(this.values.cameraInertia);
    this.setCameraPanInertia(this.values.cameraPanInertia);
    this.setCameraMinRadius(this.values.cameraMinRadius);
    this.setCameraMaxRadius(this.values.cameraMaxRadius);
    // Lighting is applied by World reading settings, no direct setter on World for now?
    // Actually lighting is likely set once or needs update method.
    // For Grid and Graphics we call the setters to trigger updates.
    this.setGrid(this.values.grid);
    this.setGraphics(this.values.graphics);
  }

  private get camera(): ArcRotateCamera {
    return this.app.world.camera;
  }

  private sanitizePositive(value: number, fallback: number): number {
    // if (!Number.isFinite(value)) return fallback;
    if (value <= 0) return fallback;
    return value;
  }

  private sanitizeInertia(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
}

/**
 * Configure default settings (merge partial with defaults)
 */
export function defaultMolvisSettings(
  settings: Partial<MolvisSetting> = {},
): MolvisSetting {
  // Deep merge not implemented here, shallow merge of top keys.
  // For nested objects like lighting, grid, graphics we need to be careful.
  // Ideally we would do a deeper merge.
  const base = { ...DEFAULT_SETTING };
  if (settings.lighting)
    base.lighting = { ...base.lighting, ...settings.lighting };
  if (settings.grid) base.grid = { ...base.grid, ...settings.grid };
  if (settings.graphics)
    base.graphics = { ...base.graphics, ...settings.graphics };

  // Copy other scalar props
  if (settings.cameraPanSpeed !== undefined)
    base.cameraPanSpeed = settings.cameraPanSpeed;
  if (settings.cameraRotateSpeed !== undefined)
    base.cameraRotateSpeed = settings.cameraRotateSpeed;
  if (settings.cameraZoomSpeed !== undefined)
    base.cameraZoomSpeed = settings.cameraZoomSpeed;
  if (settings.cameraInertia !== undefined)
    base.cameraInertia = settings.cameraInertia;
  if (settings.cameraPanInertia !== undefined)
    base.cameraPanInertia = settings.cameraPanInertia;
  if (settings.cameraMinRadius !== undefined)
    base.cameraMinRadius = settings.cameraMinRadius;
  if (settings.cameraMaxRadius !== undefined)
    base.cameraMaxRadius = settings.cameraMaxRadius;

  return base;
}
