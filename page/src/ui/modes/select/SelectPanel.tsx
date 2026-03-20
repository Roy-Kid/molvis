import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import { ExpressionSelectionModifier, type Molvis } from "@molvis/core";
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

  const addExpressionSelection = (
    nextExpression: string,
    message = "Expression selection added to pipeline",
  ) => {
    if (!app || !nextExpression.trim()) return;
    try {
      app.modifierPipeline.addModifier(
        new ExpressionSelectionModifier(
          `expr-sel-${Date.now()}`,
          nextExpression.trim(),
        ),
      );
      void app.applyPipeline({ fullRebuild: true });
      app.events.emit("status-message", {
        text: message,
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

  const handleSelect = () => {
    addExpressionSelection(expression);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-7 px-2 border-b bg-muted/15 shrink-0 flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-wide uppercase">
          Select
        </div>
        <div className="text-[9px] text-muted-foreground tabular-nums">
          {snapshot.atomCount}a / {snapshot.bondCount}b
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="min-h-full">
          <SidebarSection
            title="Expression Selection"
            subtitle="Add expression selection modifiers"
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
          </SidebarSection>

          <SidebarSection
            title="Manual Selection"
            subtitle="Select directly in the canvas"
            defaultOpen={true}
          >
            <div className="space-y-2 pt-1">
              <div className="text-[10px] leading-4 text-muted-foreground">
                {fenceActive
                  ? "Fence mode is active. Draw a closed region on the canvas and release to select. Shift adds, Cmd on macOS / Ctrl elsewhere removes."
                  : "Click atoms or bonds in the canvas to select. Cmd on macOS / Ctrl elsewhere toggles the current selection."}
              </div>
              <Button
                size="sm"
                variant={fenceActive ? "default" : "outline"}
                className="h-7 w-full px-2 text-[11px] gap-1"
                onClick={() => {
                  if (fenceActive) {
                    app?.exitFenceSelect();
                  } else {
                    app?.enterFenceSelect();
                  }
                }}
              >
                <Lasso className="h-3 w-3" />
                {fenceActive ? "Cancel Fence" : "Fence"}
              </Button>
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
