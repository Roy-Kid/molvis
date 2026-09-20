import type { DatasetExploration, Molvis } from "@molcrafts/molvis-stage";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { TrajectoryExtent } from "@/lib/trajectory-extent";

/**
 * Tracks UI-facing runtime state mirrored from Molvis event streams.
 */
export function useMolvisUiState(app: Molvis | null): {
  currentMode: string;
  setCurrentMode: Dispatch<SetStateAction<string>>;
  trajectoryLength: number;
  trajectoryExtent: TrajectoryExtent;
  frameLabels: Map<string, Float64Array> | null;
  exploration: DatasetExploration | null;
} {
  const [currentMode, setCurrentMode] = useState<string>("view");
  const [trajectoryExtent, setTrajectoryExtent] = useState(
    TrajectoryExtent.empty(),
  );
  const [frameLabels, setFrameLabels] = useState<Map<
    string,
    Float64Array
  > | null>(null);
  const [exploration, setExploration] = useState<DatasetExploration | null>(
    null,
  );

  useEffect(() => {
    if (!app) {
      return;
    }

    if (app.mode) {
      setCurrentMode(app.mode.name);
    }
    setTrajectoryExtent(TrajectoryExtent.fromTrajectory(app.system.trajectory));
    setFrameLabels(app.system.frameLabels);
    setExploration(app.system.exploration);

    const handleModeChange = (mode: string) => {
      setCurrentMode(mode);
    };

    const handleTrajectoryChange = (
      trajectory: Molvis["system"]["trajectory"],
    ) => {
      setTrajectoryExtent(TrajectoryExtent.fromTrajectory(trajectory));
    };

    const handleFrameLabelsChange = (
      labels: Map<string, Float64Array> | null,
    ) => {
      setFrameLabels(labels);
    };

    const handleExplorationChange = (next: DatasetExploration | null) => {
      setExploration(next);
    };

    const offMode = app.events.on("mode-change", handleModeChange);
    const offTraj = app.events.on("trajectory-change", handleTrajectoryChange);
    const syncExtent = () => {
      setTrajectoryExtent(
        TrajectoryExtent.fromTrajectory(app.system.trajectory),
      );
    };
    const offLen = app.events.on("length-changed", syncExtent);
    const offDone = app.events.on("index-complete", syncExtent);
    const offLabels = app.events.on(
      "frame-labels-change",
      handleFrameLabelsChange,
    );
    const offExpl = app.events.on(
      "exploration-change",
      handleExplorationChange,
    );

    return () => {
      offMode();
      offTraj();
      offLen();
      offDone();
      offLabels();
      offExpl();
    };
  }, [app]);

  return {
    currentMode,
    setCurrentMode,
    trajectoryLength: trajectoryExtent.addressableLength,
    trajectoryExtent,
    frameLabels,
    exploration,
  };
}
