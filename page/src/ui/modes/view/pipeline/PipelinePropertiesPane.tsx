import { ScrollArea } from "@/components/ui/scroll-area";
import type { Modifier, Molvis } from "@molvis/core";
import type React from "react";
import { ModifierProperties } from "../ModifierProperties";

interface PipelinePropertiesPaneProps {
  app: Molvis | null;
  selectedModifier: Modifier | undefined;
  propertiesHeight: number;
  isResizing: boolean;
  onResizeStart: (event: React.MouseEvent) => void;
  onUpdate: () => void;
}

export function PipelinePropertiesPane({
  app,
  selectedModifier,
  propertiesHeight,
  isResizing,
  onResizeStart,
  onUpdate,
}: PipelinePropertiesPaneProps) {
  return (
    <>
      <div
        className={`h-1 hover:h-1.5 transition-all bg-border hover:bg-primary/50 cursor-row-resize shrink-0 z-10 -mt-[2px] ${isResizing ? "bg-primary h-1.5" : ""}`}
        onMouseDown={onResizeStart}
      />

      <div
        style={{ height: propertiesHeight }}
        className="shrink-0 bg-background flex flex-col border-t transition-[height] duration-0 ease-linear"
      >
        {selectedModifier ? (
          <ScrollArea className="flex-1">
            <ModifierProperties
              modifier={selectedModifier}
              app={app}
              onUpdate={onUpdate}
            />
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground bg-muted/10">
            Select an item to view properties
          </div>
        )}
      </div>
    </>
  );
}
