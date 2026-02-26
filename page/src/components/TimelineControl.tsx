import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Molvis } from "@molvis/core";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TimelineControlProps {
  app: Molvis | null;
  totalFrames?: number;
}

const FRAME_INTERVAL_MS = 1000 / 30;

export const TimelineControl: React.FC<TimelineControlProps> = ({
  app,
  totalFrames = 1,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const requestRef = useRef<number | null>(null);
  const currentFrameRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

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
    (newFrame: number) => {
      if (!app || totalFrames <= 0) return;
      const frame = Math.max(0, Math.min(newFrame, totalFrames - 1));
      app.seekFrame(frame);
    },
    [app, totalFrames],
  );

  const animate = useCallback(
    (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const deltaTime = time - lastTimeRef.current;

      if (deltaTime >= FRAME_INTERVAL_MS) {
        const next =
          currentFrameRef.current + 1 >= totalFrames
            ? 0
            : currentFrameRef.current + 1;
        updateFrame(next);
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
    <div className="flex items-center w-full h-full bg-background border-t px-2 gap-4">
      {/* Progress Bar Area (Left) */}
      <div className="flex-1 px-2">
        <Slider
          value={[currentFrame]}
          max={totalFrames - 1}
          step={1}
          onValueChange={handleSliderChange}
          className="cursor-pointer"
        />
      </div>

      {/* Counter (Middle) */}
      <div className="font-mono text-xs text-muted-foreground shrink-0 w-20 text-right tabular-nums">
        {currentFrame} / {totalFrames}
      </div>

      {/* Controls Area (Right) */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goToStart}
          title="First Frame"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={stepBack}
          title="Prev Frame"
        >
          <StepBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={togglePlay}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={stepForward}
          title="Next Frame"
        >
          <StepForward className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goToEnd}
          title="Last Frame"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
