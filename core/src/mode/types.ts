import type { AbstractMesh } from "@babylonjs/core";

/**
 * Result of a pick/raycast operation
 */
export interface HitResult {
    type: "atom" | "bond" | "empty";
    mesh?: AbstractMesh;
    metadata?: any;
    thinInstanceIndex?: number;
}

/**
 * Menu item configuration for context menus
 */
export interface MenuItem {
    type: "button" | "separator" | "folder" | "binding";
    title?: string;
    label?: string;
    action?: (ev?: any) => void;
    items?: MenuItem[];
    // For bindings (dropdowns, sliders, etc.)
    bindingConfig?: any;
}
