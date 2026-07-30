import type { Molvis } from "@molvis/stage";
import type React from "react";
import { useEffect, useState } from "react";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface GridSectionProps {
  app: Molvis | null;
  sectionId?: string;
}

interface GridState {
  enabled: boolean;
  opacity: number;
  size: number;
}

export const GridSection: React.FC<GridSectionProps> = ({ app, sectionId }) => {
  const [state, setState] = useState<GridState | null>(null);

  useEffect(() => {
    if (!app) {
      setState(null);
      return;
    }
    const grid = app.settings.getGrid();
    setState({
      enabled: grid.enabled ?? false,
      opacity: grid.opacity ?? 0.3,
      size: grid.size ?? 100,
    });
  }, [app]);

  const onEnabled = (c: boolean) => {
    if (!app) return;
    setState((prev) => (prev ? { ...prev, enabled: c } : prev));
    app.settings.setGrid({ ...app.settings.getGrid(), enabled: c });
  };

  const onOpacity = (v: number) => {
    if (!app) return;
    setState((prev) => (prev ? { ...prev, opacity: v } : prev));
    app.settings.setGrid({ ...app.settings.getGrid(), opacity: v });
  };

  const onSize = (v: number) => {
    if (!app) return;
    setState((prev) => (prev ? { ...prev, size: v } : prev));
    app.settings.setGrid({ ...app.settings.getGrid(), size: v });
  };

  return (
    <SettingsSection
      id={sectionId}
      title="Grid"
      description="Reference ground plane under the structure."
    >
      {!app || !state ? (
        <p className="text-micro text-muted-foreground">
          Grid settings will appear once the viewer initializes.
        </p>
      ) : (
        <>
          <SettingsRow label="Show Grid">
            <Switch
              aria-label="Show grid"
              checked={state.enabled}
              onCheckedChange={onEnabled}
            />
          </SettingsRow>
          {state.enabled ? (
            <>
              <SettingsRow label="Opacity">
                <NumberField
                  aria-label="Grid opacity"
                  value={state.opacity}
                  min={0}
                  max={1}
                  step={0.1}
                  onChange={onOpacity}
                />
              </SettingsRow>
              <SettingsRow label="Size">
                <NumberField
                  aria-label="Grid size"
                  value={state.size}
                  min={10}
                  max={500}
                  step={10}
                  onChange={onSize}
                />
              </SettingsRow>
            </>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
};
