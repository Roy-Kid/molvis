import { Checkbox } from "@/components/ui/checkbox";
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
import type {
  ColormapName,
  ColorByPropertyModifier as CoreModifier,
  Molvis,
} from "@molvis/core";
import { COLORMAP_NAMES } from "@molvis/core";
import type React from "react";

interface Props {
  modifier: CoreModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const ColorByPropertyModifier: React.FC<Props> = ({
  modifier,
  app,
  onUpdate,
}) => {
  // Populate UI-facing metadata from the current frame
  const frame = app?.system?.frame ?? null;
  if (frame) {
    modifier.inspect(frame);
  }

  const triggerUpdate = () => {
    app?.applyPipeline({ fullRebuild: true });
    onUpdate();
  };

  const columns = modifier.availableColumns;
  const isNumeric =
    modifier.columnName &&
    columns.some(
      (c) =>
        c.name === modifier.columnName &&
        (c.dtype === "f32" ||
          c.dtype === "f64" ||
          c.dtype === "u32" ||
          c.dtype === "u8"),
    );

  const detected = modifier.detectedRange;
  const hasManualRange = modifier.range !== null;

  return (
    <div className="space-y-4 text-xs">
      {/* Column selector */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Column</Label>
        <Select
          value={modifier.columnName || "__none__"}
          onValueChange={(v) => {
            modifier.columnName = v === "__none__" ? "" : v;
            modifier.range = null;
            triggerUpdate();
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select column..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">(default colors)</span>
            </SelectItem>
            {columns.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                <span className="font-mono">{col.name}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {col.dtype}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Colormap selector — only for numeric columns */}
      {modifier.columnName && isNumeric && (
        <>
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Colormap</Label>
            <Select
              value={modifier.colormap}
              onValueChange={(v) => {
                modifier.colormap = v as ColormapName;
                triggerUpdate();
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLORMAP_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Range controls */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Range</Label>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground">
                  Auto
                </Label>
                <Checkbox
                  checked={!hasManualRange}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      modifier.range = null;
                    } else {
                      modifier.range = detected ?? { min: 0, max: 1 };
                    }
                    triggerUpdate();
                  }}
                />
              </div>
            </div>

            {detected && (
              <div className="text-[10px] text-muted-foreground font-mono">
                Detected: [{detected.min.toFixed(3)}, {detected.max.toFixed(3)}]
              </div>
            )}

            {hasManualRange && modifier.range && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Min
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={modifier.range.min}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && modifier.range) {
                        modifier.range = { ...modifier.range, min: v };
                        triggerUpdate();
                      }
                    }}
                    className="h-7 px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Max
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={modifier.range.max}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && modifier.range) {
                        modifier.range = { ...modifier.range, max: v };
                        triggerUpdate();
                      }
                    }}
                    className="h-7 px-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Clamp toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Clamp out-of-range</Label>
            <Checkbox
              checked={modifier.clampOutOfRange}
              onCheckedChange={(checked) => {
                modifier.clampOutOfRange = checked === true;
                triggerUpdate();
              }}
            />
          </div>
        </>
      )}

      {/* Info for categorical columns */}
      {modifier.columnName && !isNumeric && (
        <>
          <Separator />
          <div className="text-[10px] text-muted-foreground">
            Categorical column — colors assigned automatically per unique value.
          </div>
        </>
      )}
    </div>
  );
};
