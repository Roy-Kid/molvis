import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import type { Molvis } from "@molvis/core";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { canEncodeVideo, exportFramesToVideo } from "./gif-encode";

interface CameraTrajectoryOverlayProps {
  app: Molvis | null;
}

/** Compact labeled control row, matching the sidebar's dense layout. */
const Row = ({
  label,
  children,
}: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <Label className="text-[10px] text-muted-foreground">{label}</Label>
    <div className="shrink-0">{children}</div>
  </div>
);

/**
 * Camera-trajectory editor + preview, shown as a floating panel in the
 * fullscreen (canvas-only) view. Fullscreen is the "compose a shot" mode, so
 * the turntable controls live here rather than in the sidebar.
 *
 * Preview drives the dedicated animation camera; the panel stops any running
 * preview on unmount, so leaving fullscreen always restores the user's
 * interactive view.
 */
export const CameraTrajectoryOverlay: React.FC<
  CameraTrajectoryOverlayProps
> = ({ app }) => {
  const [duration, setDuration] = useState(8);
  const [revolutions, setRevolutions] = useState(1);
  const [fps, setFps] = useState(30);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Stop any running preview when the panel unmounts (i.e. on leaving
  // fullscreen), so the animation camera never lingers as the active view.
  useEffect(() => {
    return () => {
      app?.world.cameraAnimator.stop();
    };
  }, [app]);

  const onPreviewToggle = useCallback(() => {
    if (!app) return;
    const animator = app.world.cameraAnimator;
    if (previewing) {
      animator.stop();
      setPreviewing(false);
      return;
    }
    animator.play(animator.buildTurntable({ duration, revolutions }));
    setPreviewing(true);
  }, [app, previewing, duration, revolutions]);

  const onExport = useCallback(async () => {
    if (!app || exporting) return;
    if (previewing) {
      app.world.cameraAnimator.stop();
      setPreviewing(false);
    }
    setExporting(true);
    try {
      const frames = await app.exportTurntable({ duration, fps, revolutions });
      await exportFramesToVideo(frames, { fps });
    } finally {
      setExporting(false);
    }
  }, [app, exporting, previewing, duration, fps, revolutions]);

  if (!app) return null;

  return (
    <div className="absolute top-2 left-2 z-20 w-44 rounded-md border bg-background/70 backdrop-blur-sm p-2 flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold text-foreground/80">
        Camera Trajectory
      </div>
      <Row label="Duration (s)">
        <NumberField
          value={duration}
          min={1}
          max={60}
          step={1}
          onChange={setDuration}
        />
      </Row>
      <Row label="Revolutions">
        <NumberField
          value={revolutions}
          min={1}
          max={10}
          step={1}
          onChange={setRevolutions}
        />
      </Row>
      <Row label="Export FPS">
        <NumberField value={fps} min={5} max={60} step={1} onChange={setFps} />
      </Row>
      <div className="flex items-center gap-1.5 pt-0.5">
        <Button
          size="sm"
          variant={previewing ? "secondary" : "outline"}
          className="h-7 flex-1 text-xs"
          onClick={onPreviewToggle}
          disabled={exporting}
        >
          {previewing ? "Stop" : "Preview"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          onClick={onExport}
          disabled={exporting || !canEncodeVideo()}
        >
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </div>
      {!canEncodeVideo() && (
        <p className="text-[10px] text-muted-foreground">
          Video export unavailable in this browser.
        </p>
      )}
    </div>
  );
};
