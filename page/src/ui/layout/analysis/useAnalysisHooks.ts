import type { Molvis } from "@molcrafts/molvis-stage";
import { useEffect, useState } from "react";

export function useTrajectoryLength(app: Molvis | null): number {
  const [length, setLength] = useState(
    () => app?.system.trajectory.indexedLength ?? 0,
  );
  useEffect(() => {
    if (!app) {
      setLength(0);
      return;
    }
    const sync = () => {
      const traj = app.system.trajectory;
      setLength(traj.length ?? traj.indexedLength);
    };
    sync();
    const offChange = app.events.on("trajectory-change", sync);
    const offLen = app.events.on("length-changed", sync);
    const offDone = app.events.on("index-complete", sync);
    return () => {
      offChange();
      offLen();
      offDone();
    };
  }, [app]);
  return length;
}
