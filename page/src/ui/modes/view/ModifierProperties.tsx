import {
  isSelectionProducer,
  type Modifier,
  ModifierCapability,
  type Molvis,
  primaryCapabilityLabel,
} from "@molvis/stage";
import type React from "react";
import { modifierUsesLeftConfig, resolveModifierPanel } from "@/plugins";
import { ParentSelector } from "./pipeline/ParentSelector";

interface ModifierPropertiesProps {
  modifier: Modifier;
  allModifiers: readonly Modifier[];
  app: Molvis | null;
  onUpdate: () => void;
}

export const ModifierProperties: React.FC<ModifierPropertiesProps> = ({
  modifier,
  allModifiers,
  app,
  onUpdate,
}) => {
  const showParentSelector =
    modifier.capabilities.has(ModifierCapability.ConsumesSelection) &&
    !isSelectionProducer(modifier);

  // Complex visual modifiers edit on the left dedicated config page.
  if (modifierUsesLeftConfig(modifier)) {
    return (
      <div className="p-2 bg-muted/20 border-t">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-micro font-semibold uppercase tracking-wide text-muted-foreground truncate min-w-0">
            {modifier.name}
          </h4>
          <span className="shrink-0 text-micro bg-muted px-1 py-0 rounded-control text-muted-foreground">
            {primaryCapabilityLabel(modifier.capabilities) ?? "modifier"}
          </span>
        </div>
        <p className="text-micro text-muted-foreground text-center px-1">
          Configured in the left panel. Select this step again if the left panel
          is closed.
        </p>
      </div>
    );
  }

  const Panel = resolveModifierPanel(modifier);
  const content: React.ReactNode = Panel ? (
    <Panel modifier={modifier} app={app} onUpdate={onUpdate} />
  ) : (
    <div className="p-2 bg-muted/20 border-t text-micro text-muted-foreground text-center">
      No properties available for {modifier.name}.
    </div>
  );

  return (
    <div className="p-2 bg-muted/20 border-t">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-micro font-semibold uppercase tracking-wide text-muted-foreground truncate min-w-0">
          {modifier.name}
        </h4>
        <span className="shrink-0 text-micro bg-muted px-1 py-0 rounded-control text-muted-foreground">
          {primaryCapabilityLabel(modifier.capabilities) ?? "modifier"}
        </span>
      </div>
      {showParentSelector && (
        <ParentSelector
          modifier={modifier}
          allModifiers={allModifiers}
          app={app}
          onUpdate={onUpdate}
        />
      )}
      {content}
    </div>
  );
};
