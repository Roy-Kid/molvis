import type { Molvis } from "@molvis/stage";
import type React from "react";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface AppearanceSectionProps {
  app: Molvis | null;
  sectionId?: string;
}

/**
 * Scene clearColor presets — high contrast, named chips (not tiny swatches).
 * Babylon = Scene default Color4(0.2, 0.2, 0.3, 1) → #33334d.
 */
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

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  app,
  sectionId,
}) => {
  const { theme, setTheme } = useTheme();
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);

  useEffect(() => {
    if (!app) {
      setBackgroundColor(null);
      return;
    }
    const cc = app.scene.clearColor;
    setBackgroundColor(rgbToHex(cc.r, cc.g, cc.b));
  }, [app]);

  const onBgColor = (hex: string) => {
    if (!app) return;
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    app.scene.clearColor.set(r, g, b, 1);
    setBackgroundColor(hex);
  };

  return (
    <SettingsSection
      id={sectionId}
      title="Appearance"
      description="Chrome theme and the 3D scene background."
    >
      <SettingsRow label="Theme">
        <fieldset
          className="inline-flex m-0 rounded-control border border-border p-0.5"
          aria-label="Theme"
        >
          <legend className="sr-only">Theme</legend>
          {(
            [
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "h-6 min-w-12 px-2 text-micro rounded-[calc(var(--radius-control)-2px)] transition-colors duration-(--motion-fast) ease-standard",
                theme === opt.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-interactive hover:text-foreground",
              )}
              aria-pressed={theme === opt.id}
              onClick={() => setTheme(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </fieldset>
      </SettingsRow>

      {!app || backgroundColor === null ? (
        <p className="text-micro text-muted-foreground">
          Scene background will appear once the viewer initializes.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="text-micro text-muted-foreground">Background</div>
          <fieldset
            className="m-0 grid grid-cols-2 gap-1.5 border-0 p-0 sm:grid-cols-3"
            aria-label="Scene background"
          >
            <legend className="sr-only">Scene background</legend>
            {BG_PRESETS.map((p) => {
              const selected =
                backgroundColor.toLowerCase() === p.value.toLowerCase();
              return (
                <button
                  key={p.value}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-control border px-2 py-1.5 text-left transition-colors duration-(--motion-fast) ease-standard",
                    selected
                      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                      : "border-border/80 hover:bg-interactive",
                  )}
                  aria-label={`Background ${p.label} ${p.value}`}
                  aria-pressed={selected}
                  title={`${p.label} (${p.value})`}
                  onClick={() => onBgColor(p.value)}
                >
                  <span
                    className={cn(
                      "h-5 w-5 shrink-0 rounded-control border border-black/20 shadow-sm dark:border-white/25",
                    )}
                    style={{ backgroundColor: p.value }}
                    aria-hidden
                  />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-micro font-medium text-foreground">
                      {p.label}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {p.value}
                    </span>
                  </span>
                </button>
              );
            })}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-control border border-border/80 px-2 py-1.5 text-left transition-colors duration-(--motion-fast) ease-standard hover:bg-interactive",
                !BG_PRESETS.some(
                  (p) =>
                    p.value.toLowerCase() === backgroundColor.toLowerCase(),
                ) && "border-accent bg-accent/10 ring-1 ring-accent/30",
              )}
            >
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => onBgColor(e.target.value)}
                className="h-5 w-5 shrink-0 cursor-pointer rounded-control border-0 p-0"
                aria-label="Custom background color"
              />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-micro font-medium text-foreground">
                  Custom
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {backgroundColor.toLowerCase()}
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      )}
    </SettingsSection>
  );
};
