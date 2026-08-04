import type { Molvis } from "@molvis/stage";
import type React from "react";
import { useEffect, useState } from "react";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface GraphicsSectionProps {
  app: Molvis | null;
  sectionId?: string;
}

interface GraphicsState {
  fxaa: boolean;
  ssao: boolean;
  hardwareScaling: number;
}

export const GraphicsSection: React.FC<GraphicsSectionProps> = ({
  app,
  sectionId,
}) => {
  const [state, setState] = useState<GraphicsState | null>(null);

  useEffect(() => {
    if (!app) {
      setState(null);
      return;
    }
    const gfx = app.settings.getGraphics();
    setState({
      fxaa: gfx.fxaa ?? true,
      ssao: gfx.ssao ?? false,
      hardwareScaling: gfx.hardwareScaling ?? 1.0,
    });
  }, [app]);

  const onFxaa = (c: boolean) => {
    if (!app) return;
    setState((prev) => (prev ? { ...prev, fxaa: c } : prev));
    app.settings.setGraphics({ ...app.settings.getGraphics(), fxaa: c });
  };

  const onSsao = (c: boolean) => {
    if (!app) return;
    setState((prev) => (prev ? { ...prev, ssao: c } : prev));
    app.settings.setGraphics({ ...app.settings.getGraphics(), ssao: c });
  };

  const onHwScaling = (v: number) => {
    if (!app) return;
    setState((prev) => (prev ? { ...prev, hardwareScaling: v } : prev));
    app.settings.setGraphics({
      ...app.settings.getGraphics(),
      hardwareScaling: v,
    });
  };

  return (
    <SettingsSection id={sectionId} title="Graphics">
      {!app || !state ? (
        <p className="text-micro text-muted-foreground">Viewer not ready.</p>
      ) : (
        <>
          <SettingsRow
            label="FXAA"
            tooltip="Smooth jagged edges with fast approximate anti-aliasing."
          >
            <Switch
              aria-label="Enable FXAA"
              checked={state.fxaa}
              onCheckedChange={onFxaa}
            />
          </SettingsRow>
          <SettingsRow
            label="SSAO"
            tooltip="Add contact shadows with ambient occlusion."
          >
            <Switch
              aria-label="SSAO"
              checked={state.ssao}
              onCheckedChange={onSsao}
            />
          </SettingsRow>
          <SettingsRow
            label="Scale"
            tooltip="Adjust render resolution relative to the display."
          >
            <NumberField
              aria-label="Render scale"
              value={state.hardwareScaling}
              min={0.5}
              max={2}
              step={0.1}
              onChange={onHwScaling}
            />
          </SettingsRow>
        </>
      )}
    </SettingsSection>
  );
};
