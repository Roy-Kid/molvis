import type { ArcRotateCamera } from "@babylonjs/core";
import type { MolvisApp } from "./app";

/**
 * User settings that can be adjusted at runtime
 */
export interface MolvisSetting {
    // Camera Controls
    cameraPanSpeed: number;
    cameraRotateSpeed: number;
    cameraZoomSpeed: number;
    cameraInertia: number;

    // Camera Limits
    cameraMinRadius: number;
    cameraMaxRadius: number | null;

    // Lighting
    lighting: LightingSettings;
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
    cameraPanSpeed: 1000,
    cameraRotateSpeed: 1000,
    cameraZoomSpeed: 50,
    cameraInertia: 0.9,
    cameraMinRadius: 1,
    cameraMaxRadius: null,
    lighting: {
        lightDir: [0.5, 0.5, -1.0],
        ambient: 0.4,
        diffuse: 0.8,
        specular: 0.01,
        specularPower: 4
    }
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
        this.values = { ...this.defaults, ...initialSetting };
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

    /**
     * Reset all settings to defaults
     */
    reset(): void {
        this.setCameraPanSpeed(this.defaults.cameraPanSpeed);
        this.setCameraRotateSpeed(this.defaults.cameraRotateSpeed);
        this.setCameraZoomSpeed(this.defaults.cameraZoomSpeed);
        this.setCameraInertia(this.defaults.cameraInertia);
        this.setCameraMinRadius(this.defaults.cameraMinRadius);
        this.setCameraMaxRadius(this.defaults.cameraMaxRadius);
        // Reset lighting to default
        this.values.lighting = { ...this.defaults.lighting };
    }

    private applyAll(): void {
        this.setCameraPanSpeed(this.values.cameraPanSpeed);
        this.setCameraRotateSpeed(this.values.cameraRotateSpeed);
        this.setCameraZoomSpeed(this.values.cameraZoomSpeed);
        this.setCameraInertia(this.values.cameraInertia);
        this.setCameraMinRadius(this.values.cameraMinRadius);
        this.setCameraMaxRadius(this.values.cameraMaxRadius);
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
