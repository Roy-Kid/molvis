import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import type { Molvis } from "@molvis/core";
import { Lasso } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { InspectorTab } from "./InspectorTab";
import { useSelectionSnapshot } from "./useSelectionSnapshot";

interface SelectPanelProps {
  app: Molvis | null;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({ app }) => {
  const [expression, setExpression] = useState("");
  const [fenceActive, setFenceActive] = useState(false);
  const snapshot = useSelectionSnapshot(app);

  useEffect(() => {
    if (!app) return;
    const handler = (active: boolean) => setFenceActive(active);
    app.events.on("fence-select-change", handler);
    return () => {
      app.events.off("fence-select-change", handler);
    };
  }, [app]);

  const handleSelect = () => {
    if (!app || !expression.trim()) {
      return;
    }

    try {
      app.artist.selectByExpression(expression);
      app.events.emit("status-message", {
        text: "Expression selection updated",
        type: "info",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      app.events.emit("status-message", {
        text: `Selection error: ${message}`,
        type: "error",
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 px-2.5 border-b bg-muted/15 shrink-0 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide uppercase">
          Select Workbench
        </div>
        <div className="text-[10px] text-muted-foreground">
          {snapshot.atomCount} atom{snapshot.atomCount !== 1 ? "s" : ""}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="min-h-full">
          <SidebarSection
            title="Selection"
            subtitle="Expression query"
            badge={`${snapshot.atomCount}/${snapshot.bondCount}`}
            defaultOpen={true}
          >
            <div className="flex gap-1.5">
              <Input
                className="h-7 text-xs font-mono"
                placeholder="element == 'C' && x > 0"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSelect()}
              />
              <Button
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={handleSelect}
                disabled={!expression.trim()}
              >
                Select
              </Button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant={fenceActive ? "default" : "outline"}
                className="h-7 px-2 text-[11px] gap-1"
                onClick={() => {
                  if (fenceActive) {
                    app?.exitFenceSelect();
                  } else {
                    app?.enterFenceSelect();
                  }
                }}
              >
                <Lasso className="h-3 w-3" />
                {fenceActive ? "Drawing..." : "Fence Select"}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {fenceActive
                  ? "Draw on canvas, release to select"
                  : "Ctrl+Click to toggle"}
              </span>
            </div>
          </SidebarSection>

          <SidebarSection
            title="Inspector"
            subtitle="Selected atom attributes"
            defaultOpen={true}
            className="border-b-0"
          >
            <InspectorTab app={app} compact={true} snapshot={snapshot} />
          </SidebarSection>
        </div>
      </ScrollArea>
    </div>
  );
};
