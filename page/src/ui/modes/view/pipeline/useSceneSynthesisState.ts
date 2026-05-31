import type { Molvis } from "@molvis/core";
import { useEffect, useState } from "react";

/**
 * Bump a counter on every `frame-rendered` so a consuming component re-reads
 * the scene-synthesis post-compute state — notably the per-source RMSD exposed
 * on the synthesized frame's meta as `synthesis_rmsd:<id>`, populated during
 * pipeline compute. The pipeline / frame owns the state; this hook only forces
 * a refresh when it may have changed.
 *
 * @returns A tick counter; read it in a dependency array to re-derive values.
 */
export function useSceneSynthesisState(app: Molvis | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!app) return;
    const bump = () => setTick((t) => t + 1);
    app.events.on("frame-rendered", bump);
    return () => {
      app.events.off("frame-rendered", bump);
    };
  }, [app]);
  return tick;
}
