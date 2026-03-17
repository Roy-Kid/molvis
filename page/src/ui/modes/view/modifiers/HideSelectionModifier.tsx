import type {
  HideSelectionModifier as CoreHideModifier,
  Molvis,
} from "@molvis/core";
import type React from "react";

interface ModifierProps {
  modifier: CoreHideModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const HideSelectionModifier: React.FC<ModifierProps> = () => {
  return null;
};
