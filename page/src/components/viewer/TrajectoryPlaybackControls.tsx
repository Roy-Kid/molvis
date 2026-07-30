import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ViewerIconAction } from "./ViewerIconAction";

interface TrajectoryPlaybackControlsProps {
  compact: boolean;
  isPlaying: boolean;
  disabled?: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onFirstFrame: () => void;
  onPreviousFrame: () => void;
  onTogglePlayback: () => void;
  onNextFrame: () => void;
  onLastFrame: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10] as const;

export function TrajectoryPlaybackControls({
  compact,
  isPlaying,
  disabled = false,
  speed,
  onSpeedChange,
  onFirstFrame,
  onPreviousFrame,
  onTogglePlayback,
  onNextFrame,
  onLastFrame,
}: TrajectoryPlaybackControlsProps) {
  return (
    <>
      {!compact && (
        <Select
          disabled={disabled}
          value={String(speed)}
          onValueChange={(value) => onSpeedChange(Number(value))}
        >
          <SelectTrigger
            aria-label="Trajectory playback speed"
            className="h-control-compact w-14 text-micro shrink-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map((speedOption) => (
              <SelectItem
                key={speedOption}
                value={String(speedOption)}
                className="text-xs"
              >
                {speedOption}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {!compact && (
          <ViewerIconAction
            icon={<SkipBack />}
            label="First frame"
            disabled={disabled}
            onClick={onFirstFrame}
          />
        )}
        <ViewerIconAction
          icon={<StepBack />}
          label="Previous frame"
          disabled={disabled}
          onClick={onPreviousFrame}
        />
        <ViewerIconAction
          icon={isPlaying ? <Pause /> : <Play />}
          label={isPlaying ? "Pause trajectory" : "Play trajectory"}
          disabled={disabled && !isPlaying}
          onClick={onTogglePlayback}
        />
        <ViewerIconAction
          icon={<StepForward />}
          label="Next frame"
          disabled={disabled}
          onClick={onNextFrame}
        />
        {!compact && (
          <ViewerIconAction
            icon={<SkipForward />}
            label="Last frame"
            disabled={disabled}
            onClick={onLastFrame}
          />
        )}
      </div>
    </>
  );
}
