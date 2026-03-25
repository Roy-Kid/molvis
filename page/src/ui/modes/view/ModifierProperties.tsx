import {
  AssignColorModifier as CoreAssignColorModifier,
  ColorByPropertyModifier as CoreColorByPropertyModifier,
  DataSourceModifier as CoreDataSourceModifier,
  ExpressionSelectionModifier as CoreExpressionSelectionModifier,
  HideSelectionModifier as CoreHideModifier,
  SelectModifier as CoreSelectModifier,
  SliceModifier as CoreSliceModifier,
  TransparentSelectionModifier as CoreTransparentSelectionModifier,
  type Modifier,
  type Molvis,
  isSelectionProducer,
} from "@molvis/core";
import type React from "react";
import { AssignColorModifier } from "./modifiers/AssignColorModifier";
import { ColorByPropertyModifier } from "./modifiers/ColorByPropertyModifier";
import { DataSourceModifier } from "./modifiers/DataSourceModifier";
import { ExpressionSelectionModifier } from "./modifiers/ExpressionSelectionModifier";
import { HideSelectionModifier } from "./modifiers/HideSelectionModifier";
import { SelectModifierProps } from "./modifiers/SelectModifierProps";
import { SliceModifier } from "./modifiers/SliceModifier";
import { TransparentSelectionModifier } from "./modifiers/TransparentSelectionModifier";
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
    modifier.category === "selection-sensitive" &&
    !isSelectionProducer(modifier);

  let content: React.ReactNode = (
    <div className="p-4 bg-muted/20 border-t text-sm text-muted-foreground text-center">
      No properties available for {modifier.name}.
    </div>
  );

  if (modifier instanceof CoreDataSourceModifier) {
    content = (
      <DataSourceModifier modifier={modifier} app={app} onUpdate={onUpdate} />
    );
  } else if (modifier instanceof CoreSliceModifier) {
    content = (
      <SliceModifier modifier={modifier} app={app} onUpdate={onUpdate} />
    );
  } else if (modifier instanceof CoreExpressionSelectionModifier) {
    content = (
      <ExpressionSelectionModifier
        modifier={modifier}
        app={app}
        onUpdate={onUpdate}
      />
    );
  } else if (modifier instanceof CoreHideModifier) {
    content = (
      <HideSelectionModifier
        modifier={modifier}
        app={app}
        onUpdate={onUpdate}
      />
    );
  } else if (modifier instanceof CoreColorByPropertyModifier) {
    content = (
      <ColorByPropertyModifier
        modifier={modifier}
        app={app}
        onUpdate={onUpdate}
      />
    );
  } else if (modifier instanceof CoreAssignColorModifier) {
    content = (
      <AssignColorModifier modifier={modifier} app={app} onUpdate={onUpdate} />
    );
  } else if (modifier instanceof CoreTransparentSelectionModifier) {
    content = (
      <TransparentSelectionModifier
        modifier={modifier}
        app={app}
        onUpdate={onUpdate}
      />
    );
  } else if (modifier instanceof CoreSelectModifier) {
    content = (
      <SelectModifierProps modifier={modifier} app={app} onUpdate={onUpdate} />
    );
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
