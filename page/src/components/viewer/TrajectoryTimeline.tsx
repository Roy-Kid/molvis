import type { Molvis } from "@molvis/stage";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { ViewerAction } from "@/components/viewer/ViewerAction";
import { ViewerOperationState } from "@/components/viewer/ViewerOperationState";
import { useViewerOperation } from "@/hooks/useViewerOperation";
import { TrajectoryPlaybackControls } from "./TrajectoryPlaybackControls";

interface TrajectoryTimelineProps {
  app: Molvis | null;
  totalFrames?: number;
  /**
   * Narrow layout: drop the speed selector and the first/last jump buttons so
   * the scrubber slider keeps a usable width. Play + step controls remain.
   */
  compact?: boolean;
}

const BASE_FPS = 30;
const SEEK_COPY = {
  running: "Loading trajectory frame…",
  success: "Trajectory frame ready",
  error: "Could not load the trajectory frame",
};

export const TrajectoryTimeline: React.FC<TrajectoryTimelineProps> = ({
  app,
  totalFrames = 1,
  compact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const requestRef = useRef<number | null>(null);
  const currentFrameRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const speedRef = useRef(1);
  const seekOperation = useViewerOperation();

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!app) return;

    setCurrentFrame(app.system.trajectory.currentIndex);

    const handleFrameChange = (index: number) => {
      setCurrentFrame((prev) => (prev === index ? prev : index));
    };

    const handleTrajectoryChange = () => {
      setCurrentFrame(app.system.trajectory.currentIndex);
    };

    app.events.on("frame-change", handleFrameChange);
    app.events.on("trajectory-change", handleTrajectoryChange);
    return () => {
      app.events.off("frame-change", handleFrameChange);
      app.events.off("trajectory-change", handleTrajectoryChange);
    };
  }, [app]);

  const updateFrame = useCallback(
    (newFrame: number, feedbackMode: "all" | "errors" = "all") => {
      if (!app || totalFrames <= 0) return;
      const frame = Math.max(0, Math.min(newFrame, totalFrames - 1));
      void seekOperation
        .run(() => app.seekFrame(frame), SEEK_COPY, {
          feedbackMode,
          paintRunning: feedbackMode === "all",
          successDurationMs: 900,
        })
        .then((result) => {
          if (
            !result.ok &&
            !(
              result.error instanceof Error &&
              result.error.message ===
                "Another viewer operation is already running"
            )
          ) {
            setIsPlaying(false);
          }
        });
    },
    [app, totalFrames, seekOperation.run],
  );

  const animate = useCallback(
    (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const deltaTime = time - lastTimeRef.current;
      const interval = 1000 / BASE_FPS / speedRef.current;

      if (deltaTime >= interval) {
        const next =
          currentFrameRef.current + 1 >= totalFrames
            ? 0
            : currentFrameRef.current + 1;
        updateFrame(next, "errors");
        lastTimeRef.current = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    },
    [totalFrames, updateFrame],
  );

  useEffect(() => {
    if (isPlaying && totalFrames > 1) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = null;
    }
    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, totalFrames, animate]);

  useEffect(() => {
    if (totalFrames <= 0) {
      setCurrentFrame(0);
      setIsPlaying(false);
      return;
    }
    setCurrentFrame((prev) => Math.max(0, Math.min(prev, totalFrames - 1)));
  }, [totalFrames]);

  const togglePlay = () => {
    if (totalFrames <= 1) return;
    setIsPlaying((prev) => !prev);
  };
  const stepForward = () => {
    setIsPlaying(false);
    updateFrame(currentFrame + 1);
  };
  const stepBack = () => {
    setIsPlaying(false);
    updateFrame(currentFrame - 1);
  };
  const goToStart = () => {
    setIsPlaying(false);
    updateFrame(0);
  };
  const goToEnd = () => {
    setIsPlaying(false);
    updateFrame(totalFrames - 1);
  };

  const handleSliderChange = (vals: number[]) => {
    const [value] = vals;
    if (value === undefined) return;
    setIsPlaying(false);
    updateFrame(value);
  };

  return (
    <div
      aria-busy={isPlaying || seekOperation.running}
      className="relative flex h-full w-full min-w-0 items-center gap-1 bg-transparent px-1"
    >
      {seekOperation.feedback && (
        <div className="absolute right-1 bottom-full z-40 mb-1 w-overlay-viewport max-w-dialog-sm">
          <ViewerOperationState
            {...seekOperation.feedback}
            action={
              seekOperation.feedback.phase === "error" ? (
                <ViewerAction
                  purpose="dismiss"
                  onClick={() => void seekOperation.retry()}
                >
                  Retry
                </ViewerAction>
              ) : undefined
            }
          />
        </div>
      )}
      {/* Progress Bar Area (Left) */}
      <div className="flex-1 px-1 min-w-0">
        <Slider
          aria-label="Trajectory frame"
          value={[currentFrame]}
          max={totalFrames - 1}
          step={1}
          disabled={!app || seekOperation.running}
          onValueChange={handleSliderChange}
          className="cursor-pointer"
        />
      </div>

      {/* Counter (Middle) */}
      <div className="font-mono text-micro text-muted-foreground shrink-0 w-12 text-right tabular-nums">
        {currentFrame}/{totalFrames}
      </div>

      <TrajectoryPlaybackControls
        compact={compact}
        isPlaying={isPlaying}
        disabled={!app || seekOperation.running}
        speed={speed}
        onSpeedChange={setSpeed}
        onFirstFrame={goToStart}
        onPreviousFrame={stepBack}
        onTogglePlayback={togglePlay}
        onNextFrame={stepForward}
        onLastFrame={goToEnd}
      />
    </div>
  );
};
