import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import type { Molvis } from "@molvis/core";

interface TimelineControlProps {
  app: Molvis | null;
  totalFrames?: number;
}

export const TimelineControl: React.FC<TimelineControlProps> = ({ app, totalFrames = 1 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const fps = 30; // Target FPS

  // Sync with app state if available
  useEffect(() => {
    if (!app) return;
    
    // Listen for frame changes from app (if externally controlled)
    const handleFrameChange = (event: any) => {
        if (event.current !== currentFrame) {
            setCurrentFrame(event.current);
        }
    };
    app.events.on('frame-change', handleFrameChange);
    return () => {
        app.events.off('frame-change', handleFrameChange);
    };
  }, [app]);

  const updateFrame = useCallback((newFrame: number) => {
    if (!app) return;
    const frame = Math.max(0, Math.min(newFrame, totalFrames - 1));
    setCurrentFrame(frame);
    app.currentFrame = frame; // Update core state
    
    // Trigger render (in a real scenario, this would compute and render)
    // For now, we just log/simulate or if app has correct pipeline set up:
    // app.computeFrame(frame).then(f => app.renderFrame(f)); 
    // Since we don't have a full trajectory in the demo, this is mostly UI state.
  }, [app, totalFrames]);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === undefined) {
      lastTimeRef.current = time;
    }
    const deltaTime = time - lastTimeRef.current;

    if (deltaTime >= 1000 / fps) {
      setCurrentFrame(prev => {
        const next = prev + 1;
        if (next >= totalFrames) {
           // Loop or stop
           return 0; 
        }
        // Sync with app
        if (app) app.currentFrame = next;
        return next;
      });
      lastTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [app, fps, totalFrames]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const stepForward = () => { setIsPlaying(false); updateFrame(currentFrame + 1); };
  const stepBack = () => { setIsPlaying(false); updateFrame(currentFrame - 1); };
  const goToStart = () => { setIsPlaying(false); updateFrame(0); };
  const goToEnd = () => { setIsPlaying(false); updateFrame(totalFrames - 1); };

  const handleSliderChange = (vals: number[]) => {
      setIsPlaying(false);
      updateFrame(vals[0]);
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
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToStart} title="First Frame">
                <SkipBack className="h-3.5 w-3.5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stepBack} title="Prev Frame">
                <StepBack className="h-3.5 w-3.5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stepForward} title="Next Frame">
                <StepForward className="h-3.5 w-3.5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToEnd} title="Last Frame">
                <SkipForward className="h-3.5 w-3.5" />
             </Button>
       </div>
    </div>
  );
};
