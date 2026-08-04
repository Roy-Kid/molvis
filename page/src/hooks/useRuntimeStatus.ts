import type { Molvis } from "@molvis/stage";
import { useEffect, useState } from "react";
import { useSelectedAtoms } from "@/hooks/useSelectedAtoms";

export interface RuntimeStatus {
  fps: number | null;
  frameIndex: number;
  frameCount: number;
  atomCount: number;
  selectedCount: number;
}

/**
 * Right status-bar region: stable scene / runtime facts (FPS, frame, atoms,
 * selection count). Values stay blank/zero until the engine is ready.
 */
export function useRuntimeStatus(app: Molvis | null): RuntimeStatus {
  const selectedAtoms = useSelectedAtoms(app);
  const [fps, setFps] = useState<number | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [atomCount, setAtomCount] = useState(0);

  useEffect(() => {
    if (!app) {
      setFps(null);
      setFrameIndex(0);
      setFrameCount(0);
      setAtomCount(0);
      return;
    }

    const syncFrameStats = () => {
      const traj = app.system.trajectory;
      setFrameIndex(traj.currentIndex);
      setFrameCount(traj.length);
      const atoms = app.system.frame?.getBlock("atoms");
      setAtomCount(atoms?.nrows() ?? 0);
    };

    syncFrameStats();

    const handleFps = (value: number) => {
      setFps(Number.isFinite(value) ? value : null);
    };

    const handleFrame = (index: number) => {
      setFrameIndex(index);
      const atoms = app.system.frame?.getBlock("atoms");
      setAtomCount(atoms?.nrows() ?? 0);
    };

    const handleTrajectory = () => {
      syncFrameStats();
    };

    const handleRendered = () => {
      const atoms = app.system.frame?.getBlock("atoms");
      setAtomCount(atoms?.nrows() ?? 0);
    };

    app.events.on("fps-change", handleFps);
    app.events.on("frame-change", handleFrame);
    app.events.on("trajectory-change", handleTrajectory);
    app.events.on("frame-rendered", handleRendered);

    return () => {
      app.events.off("fps-change", handleFps);
      app.events.off("frame-change", handleFrame);
      app.events.off("trajectory-change", handleTrajectory);
      app.events.off("frame-rendered", handleRendered);
    };
  }, [app]);

  return {
    fps,
    frameIndex,
    frameCount,
    atomCount,
    selectedCount: selectedAtoms.length,
  };
}
