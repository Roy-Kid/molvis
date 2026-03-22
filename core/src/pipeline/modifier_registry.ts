import { AssignColorModifier } from "../modifiers/AssignColorModifier";
import { ColorByPropertyModifier } from "../modifiers/ColorByPropertyModifier";
import { DeleteSelectedModifier } from "../modifiers/DeleteSelectedModifier";
import { ExpressionSelectionModifier } from "../modifiers/ExpressionSelectionModifier";
import { HideHydrogensModifier } from "../modifiers/HideHydrogensModifier";
import { HideSelectionModifier } from "../modifiers/HideSelectionModifier";
import { SliceModifier } from "../modifiers/SliceModifier";
import { TransparentSelectionModifier } from "../modifiers/TransparentSelectionModifier";
import { WrapPBCModifier } from "../modifiers/WrapPBCModifier";
import { DataSourceModifier } from "./data_source_modifier";
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
    ModifierRegistry.register(
      "Color by Property",
      "Selection Insensitive",
      () => new ColorByPropertyModifier(),
    );
    ModifierRegistry.register(
      "Hide Hydrogens",
      "Selection Insensitive",
      () => new HideHydrogensModifier(),
    );
    ModifierRegistry.register(
      "Assign Color",
      "Selection Sensitive",
      () => new AssignColorModifier(),
    );
    ModifierRegistry.register(
      "Transparent",
      "Selection Sensitive",
      () => new TransparentSelectionModifier(),
    );
    ModifierRegistry.register(
      "Delete Selected",
      "Selection Sensitive",
      () => new DeleteSelectedModifier(),
    );
  }
}

// Initialize immediately
ModifierRegistry.initialize();
