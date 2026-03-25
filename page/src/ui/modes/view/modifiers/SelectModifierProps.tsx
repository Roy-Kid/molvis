import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type {
  SelectModifier as CoreSelectModifier,
  Molvis,
} from "@molvis/core";
import type React from "react";

interface ModifierProps {
  modifier: CoreSelectModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const SelectModifierProps: React.FC<ModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const handleToggleHighlight = (checked: boolean) => {
    modifier.highlight = checked;
    onUpdate();
    void app?.applyPipeline({ fullRebuild: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <Label>ID</Label>
        <span className="font-mono text-muted-foreground">{modifier.id}</span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <Label>Selection</Label>
        <span className="font-mono text-muted-foreground">
          {modifier.selectionSummary}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <Label>Mode</Label>
        <span className="font-mono text-muted-foreground">{modifier.mode}</span>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Show Highlight</Label>
        <Checkbox
          checked={modifier.highlight}
          onCheckedChange={(checked) => handleToggleHighlight(checked === true)}
        />
      </div>
    </div>
  );
};
