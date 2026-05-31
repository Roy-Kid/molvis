import {
  ColorByPropertyModifier as CoreColorByPropertyModifier,
  DataSourceModifier,
  type Modifier,
  type Molvis,
  type SceneSynthesisConfig,
} from "@molvis/core";
import type React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import {
  buildSourceLegend,
  formatRmsd,
  selectEnabledDataSources,
} from "../modifiers/scene_synthesis_logic";
import { useSceneSynthesisState } from "./useSceneSynthesisState";

interface Props {
  app: Molvis | null;
  modifiers: readonly Modifier[];
  onUpdate: () => void;
}

const SOURCE_ID_COLUMN = "source_id";

/** Default alignment block when the user first enables alignment. */
const DEFAULT_ALIGNMENT = {
  enabled: true,
  massWeight: false,
  subset: null,
} as const;

/**
 * Scene-level synthesis configuration panel. Edits the pipeline's shared
 * {@link SceneSynthesisConfig} (mode / alignment / reference) plus the
 * color-by-source modifier, then re-runs the pipeline head. Renders only when
 * at least one enabled {@link DataSourceModifier} is present, otherwise null.
 */
export const SceneSynthesisPanel: React.FC<Props> = ({
  app,
  modifiers,
  onUpdate,
}) => {
  // Re-read per-source RMSD after each pipeline compute.
  useSceneSynthesisState(app);

  const sources = selectEnabledDataSources(modifiers);
  if (!app || sources.length === 0) return null;

  const config = app.modifierPipeline.getSynthesisConfig();
  const alignment = config.alignment;
  const sourceIds = sources.map((s) => s.id);
  const referenceId = config.referenceId ?? sourceIds[0] ?? "";

  const triggerUpdate = () => {
    void app.applyPipeline({ fullRebuild: true });
    onUpdate();
  };

  const setConfig = (next: SceneSynthesisConfig) => {
    app.modifierPipeline.setSynthesisConfig(next);
    triggerUpdate();
  };

  const toggleSource = (id: string, checked: boolean) => {
    const ds = modifiers.find(
      (m): m is DataSourceModifier =>
        m instanceof DataSourceModifier && m.id === id,
    );
    if (!ds) return;
    ds.enabled = checked;
    triggerUpdate();
  };

  const colorBySource = modifiers.find(
    (m): m is CoreColorByPropertyModifier =>
      m instanceof CoreColorByPropertyModifier &&
      m.columnName === SOURCE_ID_COLUMN &&
      m.categorical,
  );

  const toggleColorBySource = (checked: boolean) => {
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

  const rmsdFor = (id: string): number | null => {
    if (id === referenceId) return null;
    return app.frame?.getMetaScalar(`synthesis_rmsd:${id}`) ?? null;
  };

  const legend = buildSourceLegend(sourceIds);

  return (
    <SidebarSection title="Sources">
      <div className="px-2 pb-1.5 space-y-1.5 text-xs">
        {/* Data-source checklist */}
        <div className="space-y-1">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <Checkbox
                checked
                onCheckedChange={(c) => toggleSource(s.id, c === true)}
              />
              <span className="flex-1 min-w-0 truncate">{s.name}</span>
              <span className="text-[9px] text-muted-foreground font-mono truncate">
                {s.id}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Mode */}
        <div className="flex items-center gap-1.5">
          <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
            Mode
          </span>
          <Select
            value={config.mode}
            onValueChange={(v) =>
              setConfig({ ...config, mode: v as SceneSynthesisConfig["mode"] })
            }
          >
            <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="extend">extend</SelectItem>
              <SelectItem value="augment">augment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Alignment */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Checkbox
              checked={alignment?.enabled === true}
              onCheckedChange={(c) =>
                setConfig({
                  ...config,
                  alignment:
                    c === true
                      ? { ...(alignment ?? DEFAULT_ALIGNMENT), enabled: true }
                      : alignment
                        ? { ...alignment, enabled: false }
                        : null,
                })
              }
            />
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              Align to reference
            </span>
          </div>

          {alignment?.enabled && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
                  Ref
                </span>
                <Select
                  value={referenceId}
                  onValueChange={(v) =>
                    setConfig({ ...config, referenceId: v })
                  }
                >
                  <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                    <SelectValue placeholder="Reference source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="font-mono">{s.id}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={alignment.massWeight}
                  onCheckedChange={(c) =>
                    setConfig({
                      ...config,
                      alignment: { ...alignment, massWeight: c === true },
                    })
                  }
                />
                <span className="text-[10px] text-muted-foreground">
                  Mass-weighted
                </span>
              </div>

              {/* RMSD-to-reference readout */}
              <div className="space-y-0.5">
                {sourceIds.map((id) => (
                  <div
                    key={id}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground"
                  >
                    <span className="flex-1 min-w-0 truncate font-mono">
                      {id}
                    </span>
                    <span className="font-mono">{formatRmsd(rmsdFor(id))}</span>
                  </div>
                ))}
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
          {colorBySource !== undefined && legend.length > 0 && (
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
    </SidebarSection>
  );
};
