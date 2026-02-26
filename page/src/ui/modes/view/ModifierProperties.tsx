import {
  DataSourceModifier as CoreDataSourceModifier,
  SliceModifier as CoreSliceModifier,
  ExpressionSelectionModifier as CoreExpressionSelectionModifier,
  HideSelectionModifier as CoreHideModifier,
  type Modifier,
  type Molvis,
} from "@molvis/core";
import { HideSelectionModifier } from "./modifiers/HideSelectionModifier";
import type React from "react";
import { DataSourceModifier } from "./modifiers/DataSourceModifier";
import { SliceModifier } from "./modifiers/SliceModifier";
import { ExpressionSelectionModifier } from "./modifiers/ExpressionSelectionModifier";

interface ModifierPropertiesProps {
  modifier: Modifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const ModifierProperties: React.FC<ModifierPropertiesProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  let content: React.ReactNode = (
    <div className="p-4 bg-muted/20 border-t text-sm text-muted-foreground text-center">
      No properties available for {modifier.name}.
    </div>
  );

  if (modifier instanceof CoreDataSourceModifier) {
    content = <DataSourceModifier modifier={modifier} app={app} onUpdate={onUpdate} />;
  } else if (modifier instanceof CoreSliceModifier) {
    content = <SliceModifier modifier={modifier} app={app} onUpdate={onUpdate} />;
  } else if (modifier instanceof CoreExpressionSelectionModifier) {
    content = <ExpressionSelectionModifier modifier={modifier} app={app} onUpdate={onUpdate} />;
  } else if (modifier instanceof CoreHideModifier) {
    content = <HideSelectionModifier modifier={modifier} app={app} onUpdate={onUpdate} />;
  }

  return (
    <div className="p-4 bg-muted/20 border-t">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {modifier.name} Parameters
        </h4>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
          {modifier.category}
        </span>
      </div>
      {content}
    </div>
  );
};
