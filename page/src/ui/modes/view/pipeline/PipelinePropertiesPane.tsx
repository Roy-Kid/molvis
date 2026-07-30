import type { Modifier, Molvis } from "@molvis/stage";
import type React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModifierProperties } from "../ModifierProperties";

interface PipelinePropertiesPaneProps {
  app: Molvis | null;
  selectedModifier: Modifier | undefined;
  allModifiers: readonly Modifier[];
  propertiesHeight: number;
  propertiesMaxHeight: number;
  isResizing: boolean;
  onResizeStart: (event: React.PointerEvent) => void;
  onResizeBy: (delta: number) => void;
  onUpdate: () => void;
}

export function PipelinePropertiesPane({
  app,
  selectedModifier,
  allModifiers,
  propertiesHeight,
  propertiesMaxHeight,
  isResizing,
  onResizeStart,
  onResizeBy,
  onUpdate,
}: PipelinePropertiesPaneProps) {
  return (
    <>
      <hr
        aria-label="Resize modifier properties"
        aria-orientation="horizontal"
        aria-valuemin={100}
        aria-valuemax={Math.round(propertiesMaxHeight)}
        aria-valuenow={Math.round(propertiesHeight)}
        tabIndex={0}
        className={`pipeline-resize-handle relative z-10 -mt-px h-1 shrink-0 touch-none cursor-row-resize border-0 bg-border transition-colors duration-(--motion-fast) ease-standard after:absolute after:inset-x-0 after:-inset-y-2 hover:bg-accent/50 ${isResizing ? "bg-accent" : ""}`}
        onPointerDown={onResizeStart}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onResizeBy(16);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            onResizeBy(-16);
          }
        }}
      />

      <div
        style={{ height: propertiesHeight }}
        className="shrink-0 bg-background flex flex-col border-t"
      >
        {selectedModifier ? (
          <ScrollArea className="flex-1">
            <ModifierProperties
              modifier={selectedModifier}
              allModifiers={allModifiers}
              app={app}
              onUpdate={onUpdate}
            />
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-micro text-muted-foreground bg-muted/10 px-2 text-center">
            Select an item to view properties
          </div>
        )}
      </div>
    </>
  );
}
