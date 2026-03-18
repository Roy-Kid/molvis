import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  type Molvis,
  type MolvisConfig,
  type LabelMode,
  HideHydrogensModifier,
  REPRESENTATIONS,
} from "@molvis/core";
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
  representationName: string;
  hideHydrogens: boolean;
  labelMode: LabelMode;
  labelTemplate: string;
  labelFontSize: number;
  backgroundColor: string;
  globalOpacity: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const BG_PRESETS = [
  { label: "Black", value: "#000000" },
  { label: "Dark Gray", value: "#1a1a2e" },
  { label: "Gray", value: "#808080" },
  { label: "White", value: "#ffffff" },
] as const;

function findHideHydrogensMod(
  app: Molvis,
): HideHydrogensModifier | undefined {
  for (const mod of app.modifierPipeline.getModifiers()) {
    if (mod instanceof HideHydrogensModifier) return mod;
  }
  return undefined;
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
    const hMod = findHideHydrogensMod(app);
    const labelCfg = app.artist.labelRenderer.config;
    const cc = app.scene.clearColor;
    const bgHex = rgbToHex(cc.r, cc.g, cc.b);
    setState({
      ui: { ...app.config.ui },
      grid: { ...app.settings.getGrid() },
      graphics: { ...app.settings.getGraphics() },
      representationName: app.styleManager.getRepresentation().name,
      hideHydrogens: hMod?.hideHydrogens ?? false,
      labelMode: labelCfg.mode,
      labelTemplate: labelCfg.template,
      labelFontSize: labelCfg.fontSize,
      backgroundColor: bgHex,
      globalOpacity: app.artist.globalOpacity,
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

  const showViewPanel = requireValue(
    state.ui.showViewPanel,
    "ui.showViewPanel",
  );
  const showPerfPanel = requireValue(
    state.ui.showPerfPanel,
    "ui.showPerfPanel",
  );
  const showTrajPanel = requireValue(
    state.ui.showTrajPanel,
    "ui.showTrajPanel",
  );
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

  const handleGlobalOpacity = (value: number) => {
    if (!app) return;
    app.artist.setGlobalOpacity(value);
    setState((prev) => (prev ? { ...prev, globalOpacity: value } : prev));
  };

  const handleBackgroundColor = (hex: string) => {
    if (!app) return;
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    app.scene.clearColor.set(r, g, b, 1);
    setState((prev) => (prev ? { ...prev, backgroundColor: hex } : prev));
  };

  const rebuildLabels = (
    mode: LabelMode,
    template: string,
    fontSize: number,
  ) => {
    if (!app) return;
    const lr = app.artist.labelRenderer;
    lr.setConfig({ mode, template, fontSize });

    if (mode === "none") {
      lr.clearLabels();
      return;
    }

    const frame = app.system.frame;
    const atoms = frame?.getBlock("atoms");
    if (!atoms || atoms.nrows() === 0) {
      lr.clearLabels();
      return;
    }

    const x = atoms.getColumnF32("x");
    const y = atoms.getColumnF32("y");
    const z = atoms.getColumnF32("z");
    const elements = atoms.getColumnStrings("element");
    if (!x || !y || !z || !elements) return;

    const selectedIndices =
      mode === "selected"
        ? app.world.selectionManager.getSelectedAtomIds()
        : undefined;

    lr.build(
      { count: atoms.nrows(), x, y, z, elements },
      selectedIndices,
    );
  };

  const handleLabelModeChange = (mode: LabelMode) => {
    setState((prev) => (prev ? { ...prev, labelMode: mode } : prev));
    rebuildLabels(mode, state.labelTemplate, state.labelFontSize);
  };

  const handleLabelTemplateChange = (template: string) => {
    setState((prev) => (prev ? { ...prev, labelTemplate: template } : prev));
    rebuildLabels(state.labelMode, template, state.labelFontSize);
  };

  const handleLabelFontSizeChange = (size: number) => {
    setState((prev) => (prev ? { ...prev, labelFontSize: size } : prev));
    rebuildLabels(state.labelMode, state.labelTemplate, size);
  };

  const handleHideHydrogens = (checked: boolean) => {
    if (!app) return;
    let mod = findHideHydrogensMod(app);
    if (!mod) {
      mod = new HideHydrogensModifier();
      app.modifierPipeline.addModifier(mod);
    }
    mod.hideHydrogens = checked;
    setState((prev) => (prev ? { ...prev, hideHydrogens: checked } : prev));
    app.applyPipeline({ fullRebuild: true });
  };

  const handleRepresentationChange = (name: string) => {
    if (!app) return;
    app.setRepresentation(name);
    setState((prev) => (prev ? { ...prev, representationName: name } : prev));
  };

  return (
    <div className="flex flex-col gap-2.5 p-2.5 h-full overflow-y-auto">
      <div className="space-y-1.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Representation
        </h4>
        <Select
          value={state.representationName}
          onValueChange={handleRepresentationChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPRESENTATIONS.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Visibility
        </h4>

        <div className="flex items-center justify-between">
          <Label htmlFor="hide-hydrogens">Hide Hydrogens</Label>
          <Switch
            id="hide-hydrogens"
            checked={state.hideHydrogens}
            onCheckedChange={handleHideHydrogens}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">
            Opacity ({Math.round(state.globalOpacity * 100)}%)
          </Label>
          <Slider
            min={0.05}
            max={1}
            step={0.05}
            value={[state.globalOpacity]}
            onValueChange={([v]) => handleGlobalOpacity(v)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Labels
        </h4>

        <div className="space-y-1">
          <Label className="text-xs">Show Labels</Label>
          <Select
            value={state.labelMode}
            onValueChange={(v) => handleLabelModeChange(v as LabelMode)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="all">All Atoms</SelectItem>
              <SelectItem value="selected">Selected Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.labelMode !== "none" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select
                value={state.labelTemplate}
                onValueChange={handleLabelTemplateChange}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="{element}">Element</SelectItem>
                  <SelectItem value="{atomId}">Atom Index</SelectItem>
                  <SelectItem value="{element} {atomId}">
                    Element + Index
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                Font Size ({state.labelFontSize}px)
              </Label>
              <Slider
                min={8}
                max={24}
                step={1}
                value={[state.labelFontSize]}
                onValueChange={([v]) => handleLabelFontSizeChange(v)}
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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

      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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

      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Background
        </h4>

        <div className="flex items-center gap-2">
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`w-6 h-6 rounded border-2 transition-colors ${
                state.backgroundColor === preset.value
                  ? "border-blue-500"
                  : "border-muted"
              }`}
              style={{ backgroundColor: preset.value }}
              title={preset.label}
              onClick={() => handleBackgroundColor(preset.value)}
            />
          ))}
          <input
            type="color"
            value={state.backgroundColor}
            onChange={(e) => handleBackgroundColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
            title="Custom color"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
