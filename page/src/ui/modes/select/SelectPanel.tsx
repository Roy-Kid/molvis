import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataInspectorPanel } from "@/ui/layout/DataInspectorPanel";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import { ExpressionSelectionModifier, type Molvis } from "@molvis/core";
import { Lasso } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

    const unsubFence = app.events.on("fence-select-change", (active: boolean) =>
      setFenceActive(active),
    );

    return () => {
      unsubFence();
    };
  }, [app]);

  const handleExpressionSelect = useCallback(() => {
    if (!app || !expression.trim()) return;
    try {
      app.modifierPipeline.addModifier(
        new ExpressionSelectionModifier(
          `expr-sel-${Date.now()}`,
          expression.trim(),
        ),
      );
      void app.applyPipeline({ fullRebuild: true });
      app.events.emit("status-message", {
        text: "Expression selection applied",
        type: "info",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      app.events.emit("status-message", {
        text: `Selection error: ${msg}`,
        type: "error",
      });
    }
  }, [app, expression]);

  const selectedAtomIdsSet = useMemo(
    () => new Set(snapshot.atomIds),
    [snapshot.atomIds],
  );

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

      <SidebarSection
        title="Expression"
        subtitle="Select atoms by expression"
        defaultOpen={true}
        className="shrink-0"
      >
        <Input
          className="h-7 text-xs font-mono"
          placeholder="element == 'C' && x > 0"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExpressionSelect()}
        />
      </SidebarSection>

      <SidebarSection
        title="Manual"
        subtitle="Click or fence to highlight, then confirm"
        defaultOpen={true}
        className="shrink-0"
      >
        <div className="space-y-2 pt-1">
          <div className="text-[10px] leading-4 text-muted-foreground">
            {fenceActive
              ? "Draw a closed region on the canvas. Shift adds, Ctrl/Cmd removes."
              : "Click atoms/bonds to select. Ctrl/Cmd toggles. Use Fence for area selection."}
          </div>
          <Button
            size="sm"
            variant={fenceActive ? "secondary" : "outline"}
            className={`h-7 w-full px-2${fenceActive ? " ring-1 ring-ring" : ""}`}
            onClick={() => {
              if (fenceActive) {
                app?.exitFenceSelect();
              } else {
                app?.enterFenceSelect();
              }
            }}
            title={
              fenceActive ? "Cancel fence selection" : "Start fence selection"
            }
            aria-label="Fence selection"
            aria-pressed={fenceActive}
          >
            <Lasso className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarSection>

      <div className="flex-1 min-h-0 border-t">
        <DataInspectorPanel
          app={app}
          filterAtomIds={selectedAtomIdsSet}
          filterRevision={snapshot.revision}
          compact
        />
      </div>
    </div>
  );
};
