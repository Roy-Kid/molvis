import {
  type Frame,
  type Molvis,
  type MolvisConfig,
  type MolvisSetting,
  Trajectory,
  TrajectoryReader,
  defaultMolvisConfig,
  mountMolvis,
  readFrame,
} from "@molvis/core";
import type React from "react";
import { useEffect, useRef } from "react";

interface MolvisWrapperProps {
  onMount?: (app: Molvis) => void;
}

type RuntimeInitPayload = {
  config?: unknown;
  settings?: unknown;
};

declare global {
  interface Window {
    __MOLVIS_VSCODE_INIT__?: RuntimeInitPayload;
  }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function applyMolvisSettings(
  app: Molvis,
  settings: Partial<MolvisSetting>,
): void {
  if (typeof settings.cameraPanSpeed === "number") {
    app.settings.setCameraPanSpeed(settings.cameraPanSpeed);
  }
  if (typeof settings.cameraRotateSpeed === "number") {
    app.settings.setCameraRotateSpeed(settings.cameraRotateSpeed);
  }
  if (typeof settings.cameraZoomSpeed === "number") {
    app.settings.setCameraZoomSpeed(settings.cameraZoomSpeed);
  }
  if (typeof settings.cameraInertia === "number") {
    app.settings.setCameraInertia(settings.cameraInertia);
  }
  if (typeof settings.cameraPanInertia === "number") {
    app.settings.setCameraPanInertia(settings.cameraPanInertia);
  }
  if (typeof settings.cameraMinRadius === "number") {
    app.settings.setCameraMinRadius(settings.cameraMinRadius);
  }
  if (
    settings.cameraMaxRadius === null ||
    typeof settings.cameraMaxRadius === "number"
  ) {
    app.settings.setCameraMaxRadius(settings.cameraMaxRadius);
  }
  if (settings.grid && typeof settings.grid === "object") {
    app.settings.setGrid(
      settings.grid as Parameters<typeof app.settings.setGrid>[0],
    );
  }
  if (settings.graphics && typeof settings.graphics === "object") {
    app.settings.setGraphics(
      settings.graphics as Parameters<typeof app.settings.setGraphics>[0],
    );
  }
}

/**
 * Mounts a MolVis core instance into a full-size container and handles cleanup.
 */
const MolvisWrapper: React.FC<MolvisWrapperProps> = ({ onMount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const molvisRef = useRef<Molvis | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const baseConfig: MolvisConfig = {
      showUI: true,
      useRightHandedSystem: true,
      ui: {
        showModePanel: false,
        showViewPanel: true,
        showInfoPanel: true,
        showPerfPanel: true,
        showTrajPanel: false,
        showContextMenu: true,
      },
    };
    const runtimeConfig = asObject(window.__MOLVIS_VSCODE_INIT__?.config);
    const config = defaultMolvisConfig({
      ...baseConfig,
      ...(runtimeConfig as Partial<MolvisConfig>),
    });

    const baseSettings: Partial<MolvisSetting> = {
      grid: {
        enabled: false,
        size: 100,
        opacity: 0.5,
      },
      graphics: {
        hardwareScaling: 1.0,
        fxaa: true,
        dof: false,
      },
    };
    const runtimeSettings = asObject(window.__MOLVIS_VSCODE_INIT__?.settings) as
      | Partial<MolvisSetting>
      | undefined;
    const settings: Partial<MolvisSetting> = {
      ...baseSettings,
      ...runtimeSettings,
      grid: {
        ...baseSettings.grid,
        ...(runtimeSettings?.grid ?? {}),
      },
      graphics: {
        ...baseSettings.graphics,
        ...(runtimeSettings?.graphics ?? {}),
      },
    };

    molvisRef.current = mountMolvis(containerRef.current, config, settings);
    molvisRef.current.start();
    if (onMount) {
      onMount(molvisRef.current);
    }

    const resizeObserver = new ResizeObserver(() => {
      molvisRef.current?.resize();
    });
    resizeObserver.observe(containerRef.current);

    const handleHostMessage = (
      event: MessageEvent<{
        type?: string;
        config?: unknown;
        settings?: unknown;
      }>,
    ) => {
      const payload = event.data;
      if (!payload || typeof payload !== "object") {
        return;
      }
      if (payload.type !== "init" && payload.type !== "applySettings") {
        return;
      }
      if (!molvisRef.current) {
        return;
      }

      const nextConfig = asObject(payload.config);
      if (nextConfig) {
        molvisRef.current.setConfig(nextConfig as Partial<MolvisConfig>);
      }

      const nextSettings = asObject(payload.settings) as
        | Partial<MolvisSetting>
        | undefined;
      if (nextSettings) {
        applyMolvisSettings(molvisRef.current, nextSettings);
      }
    };
    window.addEventListener("message", handleHostMessage);

    const container = containerRef.current;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (!file || !molvisRef.current) return;
      try {
        const content = await file.text();
        const app = molvisRef.current;
        if (file.name.toLowerCase().endsWith(".xyz")) {
          const reader = new TrajectoryReader(content);
          const frames: Frame[] = [];
          for (let i = 0; i < reader.getFrameCount(); i++) {
            frames.push(reader.readFrame(i));
          }
          app.setTrajectory(new Trajectory(frames));
          reader.free();
        } else {
          const frame = readFrame(content, file.name);
          app.setTrajectory(new Trajectory([frame]));
        }
        app.setMode("view");
        app.world.resetCamera();
      } catch (err) {
        console.error("Failed to load dropped file:", err);
      }
    };
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      resizeObserver.disconnect();
      window.removeEventListener("message", handleHostMessage);
      if (molvisRef.current) {
        molvisRef.current.destroy();
        molvisRef.current = null;
      }
    };
  }, [onMount]);

  return (
    <div
      ref={containerRef}
      className="molvis-container"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#000",
        border: "none",
        zIndex: 0,
        pointerEvents: "auto",
      }}
    />
  );
};

export default MolvisWrapper;
