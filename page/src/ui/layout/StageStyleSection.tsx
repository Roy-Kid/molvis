import {
  ClassicTheme,
  ModernTheme,
  type Molvis,
  REPRESENTATIONS,
  type RepresentationId,
  VividTheme,
} from "@molcrafts/molvis-stage";
import {
  Atom,
  Circle,
  CircleDot,
  Disc,
  GitBranch,
  Hexagon,
  Layers2,
  Orbit,
  Pencil,
  Sparkles,
  Square,
  Waypoints,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { usePipelineOperation } from "@/components/viewer/PipelineOperationProvider";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { cn } from "@/lib/utils";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface StageStyleSectionProps {
  app: Molvis | null;
  sectionId?: string;
}

/**
 * Icons are presentation-only; tooltips use RepresentationStyle.name.
 * Bubble vs spacefill must not share a glyph — they are different radius modes.
 */
const REPR_ICONS: Record<
  RepresentationId,
  React.ComponentType<{ className?: string }>
> = {
  "ball-and-stick": CircleDot,
  flat: Circle,
  "ball-and-tube": Layers2,
  tube: Waypoints,
  "metal-tube": Atom,
  wireframe: Hexagon,
  /** Soft, inflated spheres (theme radii × scale). */
  bubble: Orbit,
  /** Hard VDW spheres packing the molecular surface. */
  spacefill: Disc,
  skeletal: GitBranch,
  graph: Square,
};

const MOL_THEMES = [
  {
    id: "vivid",
    label: "Vivid",
    Icon: Sparkles,
    make: () => new VividTheme(),
  },
  {
    id: "classic",
    label: "Classic",
    Icon: CircleDot,
    make: () => new ClassicTheme(),
  },
  {
    id: "modern",
    label: "Modern",
    Icon: Layers2,
    make: () => new ModernTheme(),
  },
] as const;

const BG_PRESETS = [
  { label: "Black", value: "#000000" },
  { label: "Babylon", value: "#33334d" },
  { label: "Gray", value: "#808080" },
  { label: "White", value: "#ffffff" },
] as const;

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Stage rendering style: representation, element palette, outline, background.
 * Icon-first controls; full names live in tooltips / aria-labels.
 */
export const StageStyleSection: React.FC<StageStyleSectionProps> = ({
  app,
  sectionId,
}) => {
  const { run, running } = usePipelineOperation();
  const [reprId, setReprId] = useState<RepresentationId>(
    () => app?.styleManager.getRepresentation().id ?? "ball-and-stick",
  );
  const [outline, setOutline] = useState(
    () => app?.styleManager.getRepresentation().outlineEnabled ?? false,
  );
  const [molTheme, setMolTheme] = useState(
    () => app?.styleManager.getTheme().name.toLowerCase() ?? "vivid",
  );
  const [bg, setBg] = useState<string | null>(null);

  useEffect(() => {
    if (!app) {
      setBg(null);
      return;
    }
    const current = app.styleManager.getRepresentation();
    setReprId(current.id);
    setOutline(current.outlineEnabled);
    setMolTheme(app.styleManager.getTheme().name.toLowerCase());
    const cc = app.scene.clearColor;
    setBg(rgbToHex(cc.r, cc.g, cc.b));

    const onRepr = (repr: (typeof REPRESENTATIONS)[number]) => {
      setReprId(repr.id);
      setOutline(repr.outlineEnabled);
    };
    app.events.on("representation-change", onRepr);
    return () => {
      app.events.off("representation-change", onRepr);
    };
  }, [app]);

  const representation = REPRESENTATIONS.find((r) => r.id === reprId);

  const onBg = (hex: string) => {
    if (!app) return;
    app.setBackgroundColor(hex);
    setBg(hex);
  };

  return (
    <SettingsSection id={sectionId} title="Style">
      {!app ? (
        <p className="text-micro text-muted-foreground">Viewer not ready.</p>
      ) : (
        <fieldset
          disabled={running}
          aria-busy={running}
          className="m-0 space-y-3 border-0 p-0"
        >
          <SettingsRow
            label="Repr"
            tooltip="Choose how the molecular structure is rendered."
          >
            <fieldset
              className="flex flex-wrap items-center justify-end gap-0.5"
              aria-label="Representation"
            >
              {REPRESENTATIONS.map((r) => {
                const Icon = REPR_ICONS[r.id] ?? Circle;
                return (
                  <ViewerIconAction
                    key={r.id}
                    icon={<Icon className="size-3.5" />}
                    label={r.name}
                    selected={reprId === r.id}
                    disabled={running}
                    onClick={() => {
                      setReprId(r.id);
                      setOutline(r.outlineEnabled);
                      void run(() => app.setRepresentation(r.id), {
                        running: "…",
                        success: r.name,
                        error: "Failed",
                      });
                    }}
                  />
                );
              })}
            </fieldset>
          </SettingsRow>

          {representation?.outlineConfigurable ? (
            <SettingsRow
              label="Outline"
              tooltip="Toggle outlines for the current representation."
            >
              <ViewerIconAction
                icon={<Pencil className="size-3.5" />}
                label={outline ? "Outline on" : "Outline off"}
                selected={outline}
                disabled={running}
                onClick={() => {
                  const next = !outline;
                  setOutline(next);
                  void run(() => app.setRepresentationOutline(next), {
                    running: "…",
                    success: next ? "Outline on" : "Outline off",
                    error: "Failed",
                  });
                }}
              />
            </SettingsRow>
          ) : null}

          <SettingsRow
            label="Palette"
            tooltip="Choose the element color palette."
          >
            <fieldset
              className="flex flex-wrap items-center justify-end gap-0.5"
              aria-label="Element palette"
            >
              {MOL_THEMES.map((t) => (
                <ViewerIconAction
                  key={t.id}
                  icon={<t.Icon className="size-3.5" />}
                  label={t.label}
                  selected={molTheme === t.id}
                  disabled={running}
                  onClick={() => {
                    setMolTheme(t.id);
                    void run(
                      () => {
                        app.setTheme(t.make());
                      },
                      {
                        running: "…",
                        success: t.label,
                        error: "Failed",
                      },
                    );
                  }}
                />
              ))}
            </fieldset>
          </SettingsRow>

          {bg ? (
            <SettingsRow
              label="BG"
              tooltip="Choose the 3D scene background color."
            >
              <fieldset
                className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0"
                aria-label="Scene background"
              >
                <legend className="sr-only">Scene background</legend>
                {BG_PRESETS.map((p) => {
                  const selected = bg.toLowerCase() === p.value.toLowerCase();
                  return (
                    <button
                      key={p.value}
                      type="button"
                      className={cn(
                        "size-7 shrink-0 rounded-sm transition-[box-shadow] duration-(--motion-fast) ease-standard",
                        selected
                          ? "ring-2 ring-accent ring-offset-1 ring-offset-background"
                          : "hover:ring-1 hover:ring-border",
                      )}
                      style={{ backgroundColor: p.value }}
                      aria-label={`${p.label} ${p.value}`}
                      aria-pressed={selected}
                      title={p.label}
                      onClick={() => onBg(p.value)}
                    />
                  );
                })}
                <label
                  className={cn(
                    "relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-sm transition-[box-shadow] duration-(--motion-fast) ease-standard",
                    !BG_PRESETS.some(
                      (p) => p.value.toLowerCase() === bg.toLowerCase(),
                    )
                      ? "ring-2 ring-accent ring-offset-1 ring-offset-background"
                      : "hover:ring-1 hover:ring-border",
                  )}
                  style={{ backgroundColor: bg }}
                  title="Custom"
                >
                  <input
                    type="color"
                    value={bg}
                    onChange={(e) => onBg(e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label="Custom background"
                  />
                </label>
              </fieldset>
            </SettingsRow>
          ) : null}
        </fieldset>
      )}
    </SettingsSection>
  );
};
