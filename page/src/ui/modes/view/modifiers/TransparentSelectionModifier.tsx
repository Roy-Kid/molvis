import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type {
  Molvis,
  TransparentSelectionModifier as CoreTransparentSelectionModifier,
} from "@molvis/core";
import type React from "react";
import { getSelectedAtomIndices } from "./selectionUtils";

interface ModifierProps {
  modifier: CoreTransparentSelectionModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const TransparentSelectionModifier: React.FC<ModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const handleCaptureSelection = () => {
    if (!app) return;
    modifier.setIndices(getSelectedAtomIndices(app));
    onUpdate();
    void app.applyPipeline({ fullRebuild: true });
  };

  const handleOpacityChange = (opacity: number) => {
    modifier.opacity = opacity;
    onUpdate();
    void app?.applyPipeline({ fullRebuild: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <Label>Captured Atoms</Label>
        <span className="font-mono text-muted-foreground">
          {modifier.selectedCount}
        </span>
      </div>

      <div className="space-y-2">
        <Label>Opacity ({Math.round(modifier.opacity * 100)}%)</Label>
        <Slider
          min={0.05}
          max={1}
          step={0.05}
          value={[modifier.opacity]}
          onValueChange={([value]) => handleOpacityChange(value)}
        />
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={handleCaptureSelection}
        disabled={!app}
      >
        Use Current Selection
      </Button>
    </div>
  );
};
