import { HideSelectionModifier as CoreHideModifier, type Molvis } from "@molvis/core";
import React from "react";

interface ModifierProps {
  modifier: CoreHideModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const HideSelectionModifier: React.FC<ModifierProps> = () => {
  return null;
};
