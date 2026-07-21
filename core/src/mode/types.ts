import type { AbstractMesh } from "@babylonjs/core";
import type { AtomMeta, BondMeta } from "../entity_source";

/**
 * Result of a pick/raycast operation
 */
export type HitResult =
  | {
      type: "atom";
      mesh: AbstractMesh;
      metadata: AtomMeta;
      thinInstanceIndex: number;
    }
  | {
      type: "bond";
      mesh: AbstractMesh;
      metadata: BondMeta;
      thinInstanceIndex: number;
    }
  | {
      type: "empty";
    };

export interface BindingOption {
  text: string;
  value: string | number | boolean;
}

export interface BindingConfig {
  view?: "list" | "checkbox" | "slider";
  label?: string;
  value: string | number | boolean;
  options?: BindingOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface BindingEvent {
  value: string | number | boolean;
}

/**
 * Menu item configuration for context menus.
 * Keep `title` short — canvas menus can be very small.
 */
export type MenuItem =
  | {
      type: "button";
      title: string;
      action: () => void;
      /** Show a check mark (toggle / radio). */
      checked?: boolean;
      /** Non-interactive, muted. */
      disabled?: boolean;
      /** Optional shortcut hint shown on the right (display only). */
      shortcut?: string;
    }
  | {
      type: "separator";
    }
  | {
      type: "folder";
      title: string;
      items: MenuItem[];
      disabled?: boolean;
    }
  | {
      type: "binding";
      bindingConfig: BindingConfig;
      action: (ev: BindingEvent) => void;
    };
