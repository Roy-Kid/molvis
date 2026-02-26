import { DataSourceModifier } from "./data_source_modifier";
import { SliceModifier } from "../modifiers/SliceModifier";
import { WrapPBCModifier } from "../modifiers/WrapPBCModifier";
import { ExpressionSelectionModifier } from "../modifiers/ExpressionSelectionModifier";
import { HideSelectionModifier } from "../modifiers/HideSelectionModifier";
import type { Modifier } from "./modifier";

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
    ModifierRegistry.entries.push({ name, category, factory });
  }

  static getAvailableModifiers(): ReadonlyArray<RegistryEntry> {
    return ModifierRegistry.entries;
  }

  // Pre-register core modifiers
  static initialize() {
    ModifierRegistry.register(
      "Data Source",
      "Data",
      () => new DataSourceModifier(),
    );
    ModifierRegistry.register(
      "Slice",
      "Selection Insensitive", // Use correct category string or check enum
      () => new SliceModifier(),
    );
    ModifierRegistry.register(
      "Wrap PBC",
      "Selection Insensitive",
      () => new WrapPBCModifier(`wrap-pbc-${Date.now()}`),
    );
    ModifierRegistry.register(
      "Expression Select",
      "Selection Sensitive",
      () => new ExpressionSelectionModifier(`expr-sel-${Date.now()}`, ""),
    );
    ModifierRegistry.register(
      "Hide Selection",
      "Selection Sensitive",
      () => new HideSelectionModifier(),
    );
  }
}

// Initialize immediately
ModifierRegistry.initialize();
