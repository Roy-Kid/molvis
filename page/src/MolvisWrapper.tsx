import { type Molvis, defaultMolvisConfig, mountMolvis } from "@molvis/core";
import type React from "react";
import { useEffect, useRef } from "react";

// Molvis wrapper: create / destroy core instance. Pure rendering area.
interface MolvisWrapperProps {
  onMount?: (app: Molvis) => void;
}

const MolvisWrapper: React.FC<MolvisWrapperProps> = ({ onMount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const molvisRef = useRef<Molvis | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log("[MolvisWrapper] Mounting...");

    const config = defaultMolvisConfig({
      showUI: true,
      useRightHandedSystem: true,
      ui: {
        showModePanel: false, // We use our own top bar
        showViewPanel: true, // Default off in page wrapper? Or true? Original was true.
        showInfoPanel: true,
        showPerfPanel: true, // Default off, user can enable
        showTrajPanel: false, // Default off
        showContextMenu: true, // Enable/Disable right-click menu
      },
    });

    const settings = {
      grid: {
        enabled: false, // Default off
        size: 100,
        opacity: 0.5,
      },
      graphics: {
        hardwareScaling: 1.0,
        fxaa: true,
        dof: false, // Depth of Field default off
      },
    };

    try {
      molvisRef.current = mountMolvis(containerRef.current, config, settings);
      console.log("[MolvisWrapper] Mounted successfully", molvisRef.current);
      molvisRef.current.start();
      if (onMount) {
        onMount(molvisRef.current);
      }
    } catch (e) {
      console.error("Failed to mount Molvis:", e);
    }

    let resizeTimeout: number;
    const resizeObserver = new ResizeObserver((entries) => {
      // Debounce resize to avoid flickering during rapid layout changes
      if (resizeTimeout) window.cancelAnimationFrame(resizeTimeout);

      resizeTimeout = window.requestAnimationFrame(() => {
        for (const _entry of entries) {
          if (molvisRef.current) {
            molvisRef.current.resize();
          }
        }
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      console.log("[MolvisWrapper] Unmounting...");
      resizeObserver.disconnect();
      if (molvisRef.current) {
        try {
          molvisRef.current.destroy();
        } catch (e) {
          console.error("[MolvisWrapper] Destroy failed", e);
        }
        molvisRef.current = null;
      }
    };
  }, []);

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
