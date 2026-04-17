import type { DatasetExploration, Molvis } from "@molvis/core";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

/**
 * Tracks UI-facing runtime state mirrored from Molvis event streams.
 */
export function useMolvisUiState(app: Molvis | null): {
  currentMode: string;
  setCurrentMode: Dispatch<SetStateAction<string>>;
  trajectoryLength: number;
  exploration: DatasetExploration | null;
  frameLabels: Map<string, Float64Array> | null;
} {
  const [currentMode, setCurrentMode] = useState<string>("view");
  const [trajectoryLength, setTrajectoryLength] = useState<number>(1);
  const [exploration, setExploration] = useState<DatasetExploration | null>(
    null,
  );
  const [frameLabels, setFrameLabels] = useState<Map<
    string,
    Float64Array
  > | null>(null);

  useEffect(() => {
    if (!app) {
      return;
    }

    if (app.mode) {
      setCurrentMode(app.mode.type);
    }
    setTrajectoryLength(app.system.trajectory.length);
    setExploration(app.system.exploration);
    setFrameLabels(app.system.frameLabels);

    const handleModeChange = (mode: string) => {
      setCurrentMode(mode);
    };

    const handleTrajectoryChange = (
      trajectory: Molvis["system"]["trajectory"],
    ) => {
      setTrajectoryLength(trajectory.length);
    };

    const handleExplorationChange = (next: DatasetExploration | null) => {
      setExploration(next);
    };

    const handleFrameLabelsChange = (
      next: Map<string, Float64Array> | null,
    ) => {
      setFrameLabels(next);
    };

    app.events.on("mode-change", handleModeChange);
    app.events.on("trajectory-change", handleTrajectoryChange);
    app.events.on("exploration-change", handleExplorationChange);
    app.events.on("frame-labels-change", handleFrameLabelsChange);

    return () => {
      app.events.off("mode-change", handleModeChange);
      app.events.off("trajectory-change", handleTrajectoryChange);
      app.events.off("exploration-change", handleExplorationChange);
      app.events.off("frame-labels-change", handleFrameLabelsChange);
    };
  }, [app]);

  return {
    currentMode,
    setCurrentMode,
    trajectoryLength,
    exploration,
    frameLabels,
  };
}
