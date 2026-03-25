import type { Molvis } from "@molvis/core";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

/**
 * Tracks UI-facing runtime state mirrored from Molvis event streams.
 */
export function useMolvisUiState(app: Molvis | null): {
  currentMode: string;
  setCurrentMode: Dispatch<SetStateAction<string>>;
  trajectoryLength: number;
} {
  const [currentMode, setCurrentMode] = useState<string>("view");
  const [trajectoryLength, setTrajectoryLength] = useState<number>(1);

  useEffect(() => {
    if (!app) {
      return;
    }

    if (app.mode) {
      setCurrentMode(app.mode.type);
    }
    setTrajectoryLength(app.system.trajectory.length);

    const handleModeChange = (mode: string) => {
      setCurrentMode(mode);
    };

    const handleTrajectoryChange = (
      trajectory: Molvis["system"]["trajectory"],
    ) => {
      setTrajectoryLength(trajectory.length);
    };

    app.events.on("mode-change", handleModeChange);
    app.events.on("trajectory-change", handleTrajectoryChange);

    return () => {
      app.events.off("mode-change", handleModeChange);
      app.events.off("trajectory-change", handleTrajectoryChange);
    };
  }, [app]);

  return { currentMode, setCurrentMode, trajectoryLength };
}
