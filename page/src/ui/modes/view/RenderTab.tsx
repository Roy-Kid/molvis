import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import { type Molvis, REPRESENTATIONS } from "@molvis/core";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface RenderTabProps {
  app: Molvis | null;
}

interface RenderState {
  representationName: string;
  atomDiameterScale: number;
  bondDiameterScale: number;
  boxVisible: boolean;
  boxColor: string;
  boxThicknessScale: number;
  backgroundColor: string;
  gridEnabled: boolean;
  gridOpacity: number;
  gridSize: number;
  fxaa: boolean;
  hardwareScaling: number;
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

/** Compact number input that applies on blur or Enter. */
function NumberField({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    let v = Number(draft);
    if (Number.isNaN(v)) v = value;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (step !== undefined) v = Math.round(v / step) * step;
    onChange(v);
    setDraft(String(v));
  };

  return (
    <Input
      type="number"
      className="h-6 w-16 px-1.5 text-xs tabular-nums shrink-0"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

const Row = ({
  label,
  children,
}: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-1.5">
    <Label className="text-[10px] text-muted-foreground truncate min-w-0">
      {label}
    </Label>
    <div className="shrink-0">{children}</div>
  </div>
);

export const RenderTab: React.FC<RenderTabProps> = ({ app }) => {
  const [state, setState] = useState<RenderState | null>(null);

  useEffect(() => {
    if (!app) return;
    const repr = app.styleManager.getRepresentation();
    const cc = app.scene.clearColor;
    const grid = app.settings.getGrid();
    const gfx = app.settings.getGraphics();
    setState({
      representationName: repr.name,
      atomDiameterScale: repr.atomRadiusScale,
      bondDiameterScale: repr.bondRadiusScale,
      boxVisible: !!app.scene.getMeshByName("sim_box")?.isEnabled(),
      boxColor: app.styleManager.getTheme().boxColor ?? "#ffffff",
      boxThicknessScale: 1.0,
      backgroundColor: rgbToHex(cc.r, cc.g, cc.b),
      gridEnabled: grid.enabled ?? false,
      gridOpacity: grid.opacity ?? 0.3,
      gridSize: grid.size ?? 100,
      fxaa: gfx.fxaa ?? true,
      hardwareScaling: gfx.hardwareScaling ?? 1.0,
    });
  }, [app]);

  const set = useCallback(
    <K extends keyof RenderState>(key: K, value: RenderState[K]) => {
      setState((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  if (!state || !app) return null;

  const onRepresentation = (name: string) => {
    app.setRepresentation(name);
    const repr = app.styleManager.getRepresentation();
    set("representationName", name);
    set("atomDiameterScale", repr.atomRadiusScale);
    set("bondDiameterScale", repr.bondRadiusScale);
  };

  const onAtomScale = (v: number) => {
    app.styleManager.setAtomRadiusScale(v);
    set("atomDiameterScale", v);
    app.applyPipeline({ fullRebuild: true });
  };

  const onBondScale = (v: number) => {
    app.styleManager.setBondRadiusScale(v);
    set("bondDiameterScale", v);
    app.applyPipeline({ fullRebuild: true });
  };

  const onBoxVisible = (c: boolean) => {
    const m = app.scene.getMeshByName("sim_box");
    if (m) m.setEnabled(c);
    set("boxVisible", c);
  };

  const onBoxColor = (hex: string) => {
    const m = app.scene.getMeshByName("sim_box");
    if (m) {
      const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
      const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
      const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
      for (const child of m.getChildren()) {
        // biome-ignore lint/suspicious/noExplicitAny: BabylonJS child nodes don't expose .material in the Node base type
        const mat = (child as any).material;
        if (mat?.diffuseColor) mat.diffuseColor.set(r, g, b);
      }
    }
    set("boxColor", hex);
  };

  const onBoxThickness = (v: number) => {
    const m = app.scene.getMeshByName("sim_box");
    // biome-ignore lint/suspicious/noExplicitAny: _userThicknessScale is an internal BabylonJS mesh property
    if (m) (m as any)._userThicknessScale = v;
    set("boxThicknessScale", v);
  };

  const onBgColor = (hex: string) => {
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    app.scene.clearColor.set(r, g, b, 1);
    set("backgroundColor", hex);
  };

  const onGridEnabled = (c: boolean) => {
    set("gridEnabled", c);
    app.settings.setGrid({ ...app.settings.getGrid(), enabled: c });
  };

  const onGridOpacity = (v: number) => {
    set("gridOpacity", v);
    app.settings.setGrid({ ...app.settings.getGrid(), opacity: v });
  };

  const onGridSize = (v: number) => {
    set("gridSize", v);
    app.settings.setGrid({ ...app.settings.getGrid(), size: v });
  };

  const onFxaa = (c: boolean) => {
    set("fxaa", c);
    app.settings.setGraphics({ ...app.settings.getGraphics(), fxaa: c });
  };

  const onHwScaling = (v: number) => {
    set("hardwareScaling", v);
    app.settings.setGraphics({
      ...app.settings.getGraphics(),
      hardwareScaling: v,
    });
  };

  return (
    <div className="flex flex-col">
      <SidebarSection title="Representation">
        <Select
          value={state.representationName}
          onValueChange={onRepresentation}
        >
          <SelectTrigger
            className="h-7 w-full text-xs"
            aria-label="Representation"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPRESENTATIONS.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                <span className="text-xs">{r.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Row label="Atoms">
          <NumberField
            value={state.atomDiameterScale}
            min={0.1}
            max={3}
            step={0.05}
            onChange={onAtomScale}
          />
        </Row>
        <Row label="Bonds">
          <NumberField
            value={state.bondDiameterScale}
            min={0}
            max={3}
            step={0.05}
            onChange={onBondScale}
          />
        </Row>
      </SidebarSection>

      <SidebarSection title="Simulation Box">
        <Row label="Show">
          <Switch checked={state.boxVisible} onCheckedChange={onBoxVisible} />
        </Row>
        {state.boxVisible && (
          <>
            <Row label="Color">
              <input
                type="color"
                value={state.boxColor}
                onChange={(e) => onBoxColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                aria-label="Box color"
              />
            </Row>
            <Row label="Width">
              <NumberField
                value={state.boxThicknessScale}
                min={0.5}
                max={5}
                step={0.1}
                onChange={onBoxThickness}
              />
            </Row>
          </>
        )}
      </SidebarSection>

      <SidebarSection title="Background">
        <div className="flex items-center gap-1.5 flex-wrap">
          {BG_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`w-5 h-5 rounded border-2 shrink-0 ${
                state.backgroundColor === p.value
                  ? "border-blue-500"
                  : "border-muted"
              }`}
              style={{ backgroundColor: p.value }}
              title={p.label}
              aria-label={`Background ${p.label}`}
              onClick={() => onBgColor(p.value)}
            />
          ))}
          <input
            type="color"
            value={state.backgroundColor}
            onChange={(e) => onBgColor(e.target.value)}
            className="w-5 h-5 rounded cursor-pointer border-0 p-0 shrink-0"
            aria-label="Custom background color"
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Grid" defaultOpen={false}>
        <Row label="Show">
          <Switch checked={state.gridEnabled} onCheckedChange={onGridEnabled} />
        </Row>
        {state.gridEnabled && (
          <>
            <Row label="Opacity">
              <NumberField
                value={state.gridOpacity}
                min={0}
                max={1}
                step={0.1}
                onChange={onGridOpacity}
              />
            </Row>
            <Row label="Size">
              <NumberField
                value={state.gridSize}
                min={10}
                max={500}
                step={10}
                onChange={onGridSize}
              />
            </Row>
          </>
        )}
      </SidebarSection>

      <SidebarSection title="Graphics" defaultOpen={false}>
        <Row label="FXAA">
          <Switch checked={state.fxaa} onCheckedChange={onFxaa} />
        </Row>
        <Row label="HW Scale">
          <NumberField
            value={state.hardwareScaling}
            min={0.5}
            max={2}
            step={0.1}
            onChange={onHwScaling}
          />
        </Row>
      </SidebarSection>
    </div>
  );
};
