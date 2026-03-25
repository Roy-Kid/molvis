import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  TransparentSelectionModifier as CoreTransparentSelectionModifier,
  Molvis,
} from "@molvis/core";
import type React from "react";

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
  const apply = (value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    modifier.opacity = Math.max(0.02, Math.min(1.0, num));
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

      <div className="space-y-2">
        <Label className="text-xs">Transparency</Label>
        <Input
          type="number"
          min={0}
          max={0.98}
          step={0.05}
          defaultValue={1 - modifier.opacity}
          onBlur={(e) => {
            const t = Number(e.target.value);
            if (!Number.isFinite(t)) return;
            apply(String(1 - t));
          }}
          className="h-7 px-2 text-xs"
        />
      </div>
    </div>
  );
};
