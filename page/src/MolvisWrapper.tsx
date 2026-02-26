import { type Molvis, defaultMolvisConfig, mountMolvis } from "@molvis/core";
import type React from "react";
import { useEffect, useRef } from "react";

interface MolvisWrapperProps {
  onMount?: (app: Molvis) => void;
}

/**
 * Mounts a MolVis core instance into a full-size container and handles cleanup.
 */
const MolvisWrapper: React.FC<MolvisWrapperProps> = ({ onMount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const molvisRef = useRef<Molvis | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const config = defaultMolvisConfig({
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
    });

    const settings = {
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

    molvisRef.current = mountMolvis(containerRef.current, config, settings);
    molvisRef.current.start();
    if (onMount) {
      onMount(molvisRef.current);
    }

    const resizeObserver = new ResizeObserver(() => {
      molvisRef.current?.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
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
