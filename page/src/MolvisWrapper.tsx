import { loadFileIntoApp } from "@/lib/loadFile";
import {
  type Molvis,
  type MolvisConfig,
  type MolvisSetting,
  defaultMolvisConfig,
  mountMolvis,
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

    const app = mountMolvis(containerRef.current, config, settings);
    molvisRef.current = app;

    app.start().then(() => {
      if (onMount) {
        onMount(app);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      molvisRef.current?.resize();
    });
    resizeObserver.observe(containerRef.current);

    // Pause the render loop when the canvas is offscreen — critical for
    // notebook embeds where multiple cells coexist on the page; each
    // engine would otherwise render at 60fps even when scrolled away.
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const m = molvisRef.current;
          if (!m) continue;
          if (entry.isIntersecting) m.start();
          else m.stop();
        }
      },
      { threshold: 0 },
    );
    visibilityObserver.observe(containerRef.current);

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
        await loadFileIntoApp(molvisRef.current, file);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        molvisRef.current.events.emit("status-message", {
          text: `Failed to load ${file.name}: ${message}`,
          type: "error",
        });
      }
    };
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
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
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
};

export default MolvisWrapper;
