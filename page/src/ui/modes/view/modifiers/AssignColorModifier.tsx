import { Label } from "@/components/ui/label";
import type {
  AssignColorModifier as CoreAssignColorModifier,
  Molvis,
} from "@molvis/core";
import type React from "react";

interface ModifierProps {
  modifier: CoreAssignColorModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const AssignColorModifier: React.FC<ModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const handleColorChange = (color: string) => {
    modifier.setPrimaryColor(color);
    onUpdate();
    void app?.applyPipeline({ fullRebuild: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <Label>Affected Atoms</Label>
        <span className="font-mono text-muted-foreground">
          {modifier.selectedCount}
        </span>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${modifier.id}-assign-color`}>Color</Label>
        <div className="flex items-center gap-2">
          <input
            id={`${modifier.id}-assign-color`}
            type="color"
            value={modifier.primaryColor}
            onChange={(event) => handleColorChange(event.target.value)}
            className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
          />
          <div className="font-mono text-xs text-muted-foreground">
            {modifier.primaryColor.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
};
