import type {
  DrawBoxModifier as CoreDrawBoxModifier,
  DrawBoxSpec,
  Molvis,
} from "@molvis/stage";
import type React from "react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApplyPipelineOperation } from "@/hooks/useApplyPipelineOperation";
import { ScalarSliderRow } from "./ScalarSliderRow";

interface DrawBoxModifierProps {
  modifier: CoreDrawBoxModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

const PIPELINE_COPY = {
  running: "Updating the simulation box…",
  success: "Simulation box updated",
  error: "Could not update the simulation box",
};

function defaultManualBox(app: Molvis | null): DrawBoxSpec {
  const box = app?.system?.frame?.box;
  if (box) {
    try {
      const L = box.lengths().toCopy() as Float64Array;
      const o = box.origin().toCopy() as Float64Array;
      const p = box.pbc();
      return {
        lengths: [L[0], L[1], L[2]],
        origin: [o[0], o[1], o[2]],
        pbc: [p[0] === 1, p[1] === 1, p[2] === 1],
      };
    } catch {
      /* fall through */
    }
  }
  return {
    lengths: [10, 10, 10],
    origin: [0, 0, 0],
    pbc: [true, true, true],
  };
}

export const DrawBoxModifier: React.FC<DrawBoxModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const [showBox, setShowBox] = useState(
    () => app?.styleManager.getShowBox() ?? true,
  );
  const [boxColor, setBoxColor] = useState(
    () => app?.styleManager.getTheme().boxColor ?? "#ffffff",
  );
  const [manual, setManual] = useState<DrawBoxSpec | null>(
    () => modifier.manualBox,
  );
  const { applyPipeline, pipelineRunning } = useApplyPipelineOperation(
    app,
    onUpdate,
    PIPELINE_COPY,
  );

  useEffect(() => {
    if (!app) return;
    const sync = () => {
      setShowBox(app.styleManager.getShowBox());
      setBoxColor(app.styleManager.getTheme().boxColor ?? "#ffffff");
      setManual(modifier.manualBox);
    };
    sync();
    app.events.on("frame-change", sync);
    return () => {
      app.events.off("frame-change", sync);
    };
  }, [app, modifier]);

  const handleToggleShow = (show: boolean) => {
    if (!app) return;
    setShowBox(show);
    app.styleManager.setShowBox(show);
    applyPipeline({ fullRebuild: true });
  };

  const handleColorChange = (hex: string) => {
    if (!app) return;
    setBoxColor(hex);
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    const m = app.scene.getMeshByName("sim_box");
    if (m) {
      for (const child of m.getChildren()) {
        // biome-ignore lint/suspicious/noExplicitAny: Babylon material color
        const mat = (child as any).material;
        if (mat?.diffuseColor) mat.diffuseColor.set(r, g, b);
      }
    }
    onUpdate();
  };

  const enableManual = (on: boolean) => {
    if (on) {
      const spec = defaultManualBox(app);
      modifier.manualBox = spec;
      setManual(spec);
    } else {
      modifier.manualBox = null;
      setManual(null);
    }
    void applyPipeline({ fullRebuild: true });
  };

  const patchManual = (patch: Partial<DrawBoxSpec>) => {
    const base = manual ?? defaultManualBox(app);
    const next: DrawBoxSpec = {
      lengths: patch.lengths ?? base.lengths,
      origin: patch.origin ?? base.origin,
      pbc: patch.pbc ?? base.pbc,
    };
    modifier.manualBox = next;
    setManual(next);
    onUpdate();
  };

  return (
    <fieldset
      disabled={!app || pipelineRunning}
      aria-busy={pipelineRunning}
      className="m-0 min-w-0 space-y-2 border-0 p-0 text-xs"
    >
      <p className="text-micro text-muted-foreground px-1">
        Draw the simulation cell. Enable <strong>Edit lattice</strong> to write
        a user cell onto the frame (OVITO Edit simulation cell).
      </p>

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-micro text-muted-foreground">Show Box</span>
        <Switch
          aria-label="Show periodic box"
          checked={showBox}
          onCheckedChange={handleToggleShow}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-micro text-muted-foreground">Color</span>
        <input
          type="color"
          value={boxColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-6 h-6 rounded-control cursor-pointer border-0 p-0"
          aria-label="Box color"
        />
      </div>

      <ScalarSliderRow
        label="Edge Thickness"
        value={modifier.thicknessScale}
        min={0.25}
        max={4.0}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onPreview={(v) => {
          modifier.thicknessScale = v;
          onUpdate();
        }}
        onCommit={(v) => {
          modifier.thicknessScale = v;
          applyPipeline();
        }}
      />

      <div className="flex items-center justify-between gap-2 px-1 pt-1 border-t border-border/50">
        <span className="text-micro text-muted-foreground">Edit lattice</span>
        <Switch
          aria-label="Edit simulation cell lattice"
          checked={manual !== null}
          onCheckedChange={enableManual}
        />
      </div>

      {manual && (
        <div className="space-y-2 px-1">
          <div className="grid grid-cols-3 gap-1.5">
            {(["Lx", "Ly", "Lz"] as const).map((label, i) => (
              <div key={label} className="space-y-1">
                <Label className="text-micro">{label} (Å)</Label>
                <Input
                  type="number"
                  step={0.1}
                  min={0.1}
                  className="h-8 text-xs"
                  value={manual.lengths[i]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v <= 0) return;
                    const lengths: [number, number, number] = [
                      ...manual.lengths,
                    ];
                    lengths[i] = v;
                    patchManual({ lengths });
                  }}
                  onBlur={() => void applyPipeline({ fullRebuild: true })}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["Ox", "Oy", "Oz"] as const).map((label, i) => (
              <div key={label} className="space-y-1">
                <Label className="text-micro">{label} (Å)</Label>
                <Input
                  type="number"
                  step={0.1}
                  className="h-8 text-xs"
                  value={manual.origin[i]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const origin: [number, number, number] = [...manual.origin];
                    origin[i] = v;
                    patchManual({ origin });
                  }}
                  onBlur={() => void applyPipeline({ fullRebuild: true })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <div
                key={axis}
                className="flex items-center gap-1 text-micro text-muted-foreground"
              >
                <Switch
                  checked={manual.pbc[i]}
                  onCheckedChange={(on) => {
                    const pbc: [boolean, boolean, boolean] = [...manual.pbc];
                    pbc[i] = on;
                    patchManual({ pbc });
                    void applyPipeline({ fullRebuild: true });
                  }}
                  aria-label={`PBC ${axis}`}
                />
                <span>PBC {axis}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
};
