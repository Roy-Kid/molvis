import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Molvis, MolvisConfig } from "@molvis/core";
import type React from "react";
import { useEffect, useState } from "react";

interface RenderTabProps {
  app: Molvis | null;
}

type UIState = NonNullable<MolvisConfig["ui"]>;
type GridState = ReturnType<Molvis["settings"]["getGrid"]>;
type GraphicsState = ReturnType<Molvis["settings"]["getGraphics"]>;

interface RenderState {
  ui: UIState;
  grid: GridState;
  graphics: GraphicsState;
}

function requireValue<T>(value: T | undefined, key: string): T {
  if (value === undefined) {
    throw new Error(`Missing required config key: ${key}`);
  }
  return value;
}

export const RenderTab: React.FC<RenderTabProps> = ({ app }) => {
  const [state, setState] = useState<RenderState | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!app) return;
    if (!app.config.ui) {
      throw new Error("Missing required config key: ui");
    }
    setState({
      ui: { ...app.config.ui },
      grid: { ...app.settings.getGrid() },
      graphics: { ...app.settings.getGraphics() },
    });
    setHasChanges(false);
  }, [app]);

  const updateUI = <K extends keyof UIState>(key: K, value: UIState[K]) => {
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, ui: { ...prev.ui, [key]: value } };
    });
    setHasChanges(true);
  };

  const updateGrid = <K extends keyof GridState>(
    key: K,
    value: GridState[K],
  ) => {
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, grid: { ...prev.grid, [key]: value } };
    });
    setHasChanges(true);
  };

  const updateGraphics = <K extends keyof GraphicsState>(
    key: K,
    value: GraphicsState[K],
  ) => {
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, graphics: { ...prev.graphics, [key]: value } };
    });
    setHasChanges(true);
  };

  const handleApply = () => {
    if (!app || !state) return;
    app.setConfig({
      useRightHandedSystem: true,
      ui: state.ui,
    });
    app.settings.setGrid(state.grid);
    app.settings.setGraphics(state.graphics);
    setHasChanges(false);
  };

  if (!state) {
    return null;
  }

  const showViewPanel = requireValue(state.ui.showViewPanel, "ui.showViewPanel");
  const showPerfPanel = requireValue(state.ui.showPerfPanel, "ui.showPerfPanel");
  const showTrajPanel = requireValue(state.ui.showTrajPanel, "ui.showTrajPanel");
  const gridEnabled = requireValue(state.grid.enabled, "grid.enabled");
  const gridOpacity = requireValue(state.grid.opacity, "grid.opacity");
  const gridSize = requireValue(state.grid.size, "grid.size");
  const gfxShadows = requireValue(state.graphics.shadows, "graphics.shadows");
  const gfxSsao = requireValue(state.graphics.ssao, "graphics.ssao");
  const gfxBloom = requireValue(state.graphics.bloom, "graphics.bloom");
  const gfxFxaa = requireValue(state.graphics.fxaa, "graphics.fxaa");
  const gfxDof = requireValue(state.graphics.dof, "graphics.dof");
  const hwScaling = requireValue(
    state.graphics.hardwareScaling,
    "graphics.hardwareScaling",
  );

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="space-y-4">
        <h4 className="text-sm font-medium leading-none text-muted-foreground">
          User Interface
        </h4>

        <div className="flex items-center justify-between">
          <Label htmlFor="ui-view-panel">View Type (Top-Left)</Label>
          <Switch
            id="ui-view-panel"
            checked={showViewPanel}
            onCheckedChange={(c) => updateUI("showViewPanel", c)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="ui-perf-panel">FPS Counter (Bottom-Right)</Label>
          <Switch
            id="ui-perf-panel"
            checked={showPerfPanel}
            onCheckedChange={(c) => updateUI("showPerfPanel", c)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="ui-traj-panel">Trajectory Controls</Label>
          <Switch
            id="ui-traj-panel"
            checked={showTrajPanel}
            onCheckedChange={(c) => updateUI("showTrajPanel", c)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-medium leading-none text-muted-foreground">
          Grid
        </h4>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-grid">Enabled</Label>
          <Switch
            id="show-grid"
            checked={gridEnabled}
            onCheckedChange={(c) => updateGrid("enabled", c)}
          />
        </div>

        <div className="space-y-2">
          <Label>Opacity ({gridOpacity})</Label>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={[gridOpacity]}
            onValueChange={([v]) => updateGrid("opacity", v)}
          />
        </div>

        <div className="space-y-2">
          <Label>Size ({gridSize})</Label>
          <Slider
            min={10}
            max={500}
            step={10}
            value={[gridSize]}
            onValueChange={([v]) => updateGrid("size", v)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-medium leading-none text-muted-foreground">
          Graphics
        </h4>

        <div className="flex items-center justify-between">
          <Label htmlFor="gfx-shadows">Shadows</Label>
          <Switch
            id="gfx-shadows"
            checked={gfxShadows}
            onCheckedChange={(c) => updateGraphics("shadows", c)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="gfx-ssao">SSAO (Ambient Occlusion)</Label>
          <Switch
            id="gfx-ssao"
            checked={gfxSsao}
            onCheckedChange={(c) => updateGraphics("ssao", c)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="gfx-bloom">Bloom</Label>
          <Switch
            id="gfx-bloom"
            checked={gfxBloom}
            onCheckedChange={(c) => updateGraphics("bloom", c)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="gfx-fxaa">FXAA (Anti-Aliasing)</Label>
          <Switch
            id="gfx-fxaa"
            checked={gfxFxaa}
            onCheckedChange={(c) => updateGraphics("fxaa", c)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="gfx-dof">Depth of Field</Label>
          <Switch
            id="gfx-dof"
            checked={gfxDof}
            onCheckedChange={(c) => updateGraphics("dof", c)}
          />
        </div>

        <div className="space-y-2">
          <Label>Hardware Scaling ({hwScaling})</Label>
          <div className="text-xs text-muted-foreground mb-1">
            Lower is faster, Higher is sharper
          </div>
          <Slider
            min={0.5}
            max={2.0}
            step={0.1}
            value={[hwScaling]}
            onValueChange={([v]) => updateGraphics("hardwareScaling", v)}
          />
        </div>
      </div>

      <Separator />

      <div className="pt-2">
        <Button
          className="w-full"
          onClick={handleApply}
          disabled={!hasChanges}
          variant={hasChanges ? "default" : "secondary"}
        >
          {hasChanges ? "Apply Changes" : "No Changes"}
        </Button>
      </div>
    </div>
  );
};
