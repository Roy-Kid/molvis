import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import { ExpressionSelectionModifier, type Molvis } from "@molvis/core";
import { Check, Lasso } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { InspectorTab } from "./InspectorTab";
import { useSelectionSnapshot } from "./useSelectionSnapshot";

interface SelectPanelProps {
  app: Molvis | null;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({ app }) => {
  const [expression, setExpression] = useState("");
  const [fenceActive, setFenceActive] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const snapshot = useSelectionSnapshot(app);

  useEffect(() => {
    if (!app) return;

    const unsubFence = app.events.on("fence-select-change", (active: boolean) =>
      setFenceActive(active),
    );

    const unsubPending = app.events.on(
      "pending-selection-change",
      ({ atomKeys, bondKeys }) => {
        setPendingCount(atomKeys.length + bondKeys.length);
      },
    );

    return () => {
      unsubFence();
      unsubPending();
    };
  }, [app]);

  const handleSelect = useCallback(() => {
    if (!app) return;

    // Expression takes priority if entered
    if (expression.trim()) {
      try {
        app.modifierPipeline.addModifier(
          new ExpressionSelectionModifier(
            `expr-sel-${Date.now()}`,
            expression.trim(),
          ),
        );
        void app.applyPipeline({ fullRebuild: true });
        app.events.emit("status-message", {
          text: "Expression selection added to pipeline",
          type: "info",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        app.events.emit("status-message", {
          text: `Selection error: ${msg}`,
          type: "error",
        });
      }
      return;
    }

    // Otherwise commit pending manual selection
    app.confirmPendingSelection();
  }, [app, expression]);

  const canSelect = expression.trim() || pendingCount > 0;

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
            title="Expression"
            subtitle="Select atoms by expression"
            defaultOpen={true}
          >
            <Input
              className="h-7 text-xs font-mono"
              placeholder="element == 'C' && x > 0"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSelect()}
            />
          </SidebarSection>

          <SidebarSection
            title="Manual"
            subtitle="Click or fence to highlight, then confirm"
            defaultOpen={true}
          >
            <div className="space-y-2 pt-1">
              <div className="text-[10px] leading-4 text-muted-foreground">
                {fenceActive
                  ? "Draw a closed region on the canvas. Shift adds, Ctrl/Cmd removes."
                  : pendingCount > 0
                    ? `${pendingCount} pending. Click Select to confirm, or keep adding with Ctrl/Cmd.`
                    : "Click atoms/bonds to highlight. Ctrl/Cmd toggles. Use Fence for area selection."}
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
            subtitle="Selected atom & bond attributes"
            defaultOpen={true}
            className="border-b-0"
          >
            <InspectorTab app={app} compact={true} snapshot={snapshot} />
          </SidebarSection>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-2">
        <Button
          size="sm"
          className="h-8 w-full text-[11px] gap-1.5"
          disabled={!canSelect}
          onClick={handleSelect}
        >
          <Check className="h-3.5 w-3.5" />
          Select
          {pendingCount > 0 && !expression.trim() && ` (${pendingCount})`}
        </Button>
      </div>
    </div>
  );
};
