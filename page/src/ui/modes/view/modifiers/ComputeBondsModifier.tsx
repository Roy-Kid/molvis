import type {
  BondCriterion,
  ComputeBondsModifier as CoreModifier,
  Molvis,
} from "@molvis/core";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Props {
  modifier: CoreModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const ComputeBondsModifier: React.FC<Props> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const triggerUpdate = () => {
    app?.applyPipeline({ fullRebuild: true });
    onUpdate();
  };

  const updateNumber = (
    key: "cutoff" | "tolerance" | "minDistance",
    value: string,
  ) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      throw new Error(`Compute Bonds: ${key} must be a number`);
    }
    modifier[key] = numeric;
    triggerUpdate();
  };

  const isCovalent = modifier.criterion === "covalent";

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Criterion</Label>
        <Select
          value={modifier.criterion}
          onValueChange={(v) => {
            modifier.criterion = v as BondCriterion;
            triggerUpdate();
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="covalent">Covalent radii</SelectItem>
            <SelectItem value="distance">Fixed distance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {isCovalent ? (
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs font-semibold">Tolerance</Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {modifier.tolerance.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Bond when d ≤ (rᵢ + rⱼ) × tolerance
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="range"
              min={0.8}
              max={1.6}
              step={0.01}
              value={modifier.tolerance}
              onChange={(e) => updateNumber("tolerance", e.target.value)}
              className="h-6"
            />
            <Input
              type="number"
              step="0.05"
              value={modifier.tolerance}
              onChange={(e) => updateNumber("tolerance", e.target.value)}
              className="w-16 h-7 px-2 text-xs"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Cutoff (Å)</Label>
          <div className="text-[10px] text-muted-foreground">
            Bond when d ≤ cutoff
          </div>
          <Input
            type="number"
            min="0.1"
            step="0.1"
            value={modifier.cutoff}
            onChange={(e) => updateNumber("cutoff", e.target.value)}
            className="h-7 px-2 text-xs"
          />
        </div>
      )}

      <Separator />

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          Min distance (Å)
        </Label>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={modifier.minDistance}
          onChange={(e) => updateNumber("minDistance", e.target.value)}
          className="h-7 px-2 text-xs"
        />
      </div>
    </div>
  );
};
