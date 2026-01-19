import { Modifier } from './modifier';
import { DrawBoxModifier, DrawAtomsModifier, DrawBondsModifier } from './rendering_modifiers';

// Type for a modifier factory function
export type ModifierFactory = () => Modifier;

interface RegistryEntry {
    name: string;
    category: string;
    factory: ModifierFactory;
}

export class ModifierRegistry {
    private static entries: RegistryEntry[] = [];

    static register(name: string, category: string, factory: ModifierFactory) {
        this.entries.push({ name, category, factory });
    }

    static getAvailableModifiers(): ReadonlyArray<RegistryEntry> {
        return this.entries;
    }

    // Pre-register core modifiers
    static initialize() {
        this.register('Draw Box', 'Visual', () => new DrawBoxModifier());
        this.register('Draw Atoms', 'Visual', () => new DrawAtomsModifier());
        this.register('Draw Bonds', 'Visual', () => new DrawBondsModifier());
        // Add more here as they are implemented (e.g. Wrap PBC, Select...)
    }
}

// Initialize immediately
ModifierRegistry.initialize();
