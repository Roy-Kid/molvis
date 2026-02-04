import { logger } from "../utils/logger";
import type { Modifier } from "./modifier";

/**
 * Modifier registry for dynamic modifier discovery and instantiation.
 */
export class ModifierRegistry {
  private factories: Map<string, ModifierFactory> = new Map();

  /**
   * Register a modifier factory.
   */
  register(type: string, factory: ModifierFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Unregister a modifier factory.
   */
  unregister(type: string): boolean {
    return this.factories.delete(type);
  }

  /**
   * Create a modifier instance by type.
   */
  create(type: string, params: ModifierParams): Modifier | null {
    const factory = this.factories.get(type);
    if (!factory) {
      logger.warn(`Modifier type '${type}' not registered`);
      return null;
    }
    return factory(params);
  }

  /**
   * Get all registered modifier types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if a modifier type is registered.
   */
  isRegistered(type: string): boolean {
    return this.factories.has(type);
  }
}

/**
 * Factory function for creating modifiers.
 */
export type ModifierFactory = (params: ModifierParams) => Modifier;

/**
 * Generic parameters for modifier creation.
 */
export interface ModifierParams {
  id: string;
  [key: string]: unknown;
}

/**
 * Global modifier registry instance.
 */
export const globalModifierRegistry = new ModifierRegistry();
