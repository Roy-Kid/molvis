import {
  ColorByPropertyModifier as CoreColorByPropertyModifier,
  type CombineSystemsModifier as CoreCombineSystemsModifier,
  type Modifier,
  type Molvis,
} from "@molvis/core";
import { AlertCircle } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  buildSourceLegend,
  formatRmsd,
  getReferenceableBranches,
} from "./combine_systems_logic";
import { useCombineSystemsState } from "./useCombineSystemsState";

interface Props {
  modifier: CoreCombineSystemsModifier;
  allModifiers: readonly Modifier[];
  app: Molvis | null;
  onUpdate: () => void;
}

const SOURCE_ID_COLUMN = "source_id";

export const CombineSystemsModifier: React.FC<Props> = ({
  modifier,
  allModifiers,
  app,
  onUpdate,
}) => {
  // Re-read rmsdByBranch after each pipeline compute.
  useCombineSystemsState(app);
  const [error, setError] = useState<string | null>(null);

  const branches = getReferenceableBranches(modifier.id, allModifiers, []);
  const referenced = modifier.referencedIds;
  const alignment = modifier.alignment;

  const triggerUpdate = () => {
    void app?.applyPipeline({ fullRebuild: true });
    onUpdate();
  };

  const setReferences = (ids: string[]) => {
    if (!app) return;
    const ok = app.modifierPipeline.setReferences(modifier.id, ids);
    if (!ok) {
      setError("Reference rejected (cycle or invalid branch)");
      return;
    }
    setError(null);
    triggerUpdate();
  };

  const toggleBranch = (id: string, checked: boolean) => {
    const next = checked
      ? [...referenced, id]
      : referenced.filter((r) => r !== id);
    setReferences(next);
  };

  const colorBySource = allModifiers.find(
    (m): m is CoreColorByPropertyModifier =>
      m instanceof CoreColorByPropertyModifier &&
      m.columnName === SOURCE_ID_COLUMN &&
      m.categorical,
  );

  const toggleColorBySource = (checked: boolean) => {
    if (!app) return;
    if (checked) {
      const mod = new CoreColorByPropertyModifier();
      mod.columnName = SOURCE_ID_COLUMN;
      mod.categorical = true;
      app.modifierPipeline.addModifier(mod);
    } else if (colorBySource) {
      app.modifierPipeline.removeModifier(colorBySource.id);
    }
    triggerUpdate();
  };

  const legend = buildSourceLegend(referenced);

  return (
    <div className="px-2 pb-1.5 space-y-1.5 text-xs">
      {/* Branch picker */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
          Sources
        </div>
        {branches.length === 0 ? (
          <div className="text-[10px] text-muted-foreground">
            Load ≥2 data sources to combine
          </div>
        ) : (
          branches.map((b) => (
            <div key={b.id} className="flex items-center gap-1.5">
              <Checkbox
                checked={referenced.includes(b.id)}
                onCheckedChange={(c) => toggleBranch(b.id, c === true)}
              />
              <span className="flex-1 min-w-0 truncate">{b.name}</span>
              <span className="text-[9px] text-muted-foreground font-mono">
                {b.id}
              </span>
            </div>
          ))
        )}
        {error && (
          <div className="flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>

      <Separator />

      {/* Alignment */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Checkbox
            checked={alignment.enabled}
            onCheckedChange={(c) => {
              modifier.alignment = { ...alignment, enabled: c === true };
              triggerUpdate();
            }}
          />
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            Align to reference
          </span>
        </div>

        {alignment.enabled && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
                Ref
              </span>
              <Select
                value={alignment.referenceId ?? referenced[0] ?? ""}
                onValueChange={(v) => {
                  modifier.alignment = { ...alignment, referenceId: v };
                  triggerUpdate();
                }}
              >
                <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                  <SelectValue placeholder="Reference branch" />
                </SelectTrigger>
                <SelectContent>
                  {referenced.map((id) => (
                    <SelectItem key={id} value={id}>
                      <span className="font-mono">{id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={alignment.massWeight}
                onCheckedChange={(c) => {
                  modifier.alignment = {
                    ...alignment,
                    massWeight: c === true,
                  };
                  triggerUpdate();
                }}
              />
              <span className="text-[10px] text-muted-foreground">
                Mass-weighted
              </span>
            </div>

            {/* RMSD-to-reference readout */}
            <div className="space-y-0.5">
              {referenced.map((id) => {
                const isRef = id === (alignment.referenceId ?? referenced[0]);
                const rmsd = isRef ? null : (modifier.rmsdByBranch[id] ?? null);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground"
                  >
                    <span className="flex-1 min-w-0 truncate font-mono">
                      {id}
                    </span>
                    <span className="font-mono">{formatRmsd(rmsd)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Color by source */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Checkbox
            checked={colorBySource !== undefined}
            onCheckedChange={(c) => toggleColorBySource(c === true)}
          />
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            Color by source
          </span>
        </div>
        {legend.length > 0 && (
          <div className="space-y-0.5">
            {legend.map((entry) => (
              <div key={entry.label} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {entry.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
