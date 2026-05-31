import type { Molvis } from "@molvis/core";
import { useEffect, useState } from "react";

/**
 * Bump a counter on every `frame-rendered` so a consuming component re-reads
 * the combine modifier's post-compute state (notably `rmsdByBranch`, which is
 * populated during pipeline compute). The modifier instance owns the state;
 * this hook only forces a refresh when it may have changed.
 */
export function useCombineSystemsState(app: Molvis | null): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!app) return;
    const bump = () => setTick((t) => t + 1);
    app.events.on("frame-rendered", bump);
    return () => {
      app.events.off("frame-rendered", bump);
    };
  }, [app]);
}
