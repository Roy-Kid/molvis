/**
 * User settings that can be adjusted at runtime
 */
export interface MolvisUserConfig {
    // Camera Controls
    cameraPanSpeed: number;
    cameraRotateSpeed: number;
    cameraZoomSpeed: number;
    cameraInertia: number;

    // Camera Limits
    cameraMinRadius: number;
    cameraMaxRadius: number;
}

/**
 * Default user settings
 */
export const DEFAULT_USER_CONFIG: MolvisUserConfig = {
    cameraPanSpeed: 0.8,
    cameraRotateSpeed: 0.8,
    cameraZoomSpeed: 1.2,
    cameraInertia: 0.0,
    cameraMinRadius: 0.1,
    cameraMaxRadius: 1000
};

/**
 * Settings manager for runtime user preferences
 */
export class Settings {
    private values: MolvisUserConfig;
    private defaults: MolvisUserConfig;
    private listeners: Map<keyof MolvisUserConfig, Set<(value: any) => void>>;

    constructor(initialConfig?: Partial<MolvisUserConfig>) {
        this.defaults = { ...DEFAULT_USER_CONFIG };
        this.values = { ...this.defaults, ...initialConfig };
        this.listeners = new Map();
    }

    /**
     * Get a setting value
     */
    get<K extends keyof MolvisUserConfig>(key: K): MolvisUserConfig[K] {
        return this.values[key];
    }

    /**
     * Set a single setting value
     */
    set<K extends keyof MolvisUserConfig>(key: K, value: MolvisUserConfig[K]): void {
        this.values[key] = value;
        this.notify(key, value);
    }

    /**
     * Update multiple settings at once
     */
    update(config: Partial<MolvisUserConfig>): void {
        Object.entries(config).forEach(([key, value]) => {
            this.set(key as keyof MolvisUserConfig, value);
        });
    }

    /**
     * Get all current settings
     */
    getAll(): MolvisUserConfig {
        return { ...this.values };
    }

    /**
     * Reset all settings to defaults
     */
    reset(): void {
        this.values = { ...this.defaults };
        Object.keys(this.values).forEach(key => {
            this.notify(key as keyof MolvisUserConfig, this.values[key as keyof MolvisUserConfig]);
        });
    }

    /**
     * Reset a specific setting to default
     */
    resetKey<K extends keyof MolvisUserConfig>(key: K): void {
        this.set(key, this.defaults[key]);
    }

    /**
     * Listen for changes to a specific setting
     * Returns an unsubscribe function
     */
    onChange<K extends keyof MolvisUserConfig>(
        key: K,
        callback: (value: MolvisUserConfig[K]) => void
    ): () => void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }

    /**
     * Notify all listeners of a setting change
     */
    private notify<K extends keyof MolvisUserConfig>(key: K, value: MolvisUserConfig[K]): void {
        this.listeners.get(key)?.forEach(callback => callback(value));
    }
}
