import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import {
  type Molvis,
  AssignColorModifier,
  DeleteSelectedModifier,
} from "@molvis/core";
import { Lasso, Palette, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { InspectorTab } from "./InspectorTab";
import { useSelectionSnapshot } from "./useSelectionSnapshot";

interface SelectPanelProps {
  app: Molvis | null;
}

function discoverElements(app: Molvis | null): string[] {
  if (!app) return [];
  const frame = app.system.frame;
  const atoms = frame?.getBlock("atoms");
  if (!atoms) return [];
  const elements = atoms.getColumnStrings("element");
  if (!elements) return [];
  const unique = new Set(elements);
  return Array.from(unique).sort();
}

export const SelectPanel: React.FC<SelectPanelProps> = ({ app }) => {
  const [expression, setExpression] = useState("");
  const [fenceActive, setFenceActive] = useState(false);
  const [assignColor, setAssignColor] = useState("#FF4444");
  const [elements, setElements] = useState<string[]>([]);
  const snapshot = useSelectionSnapshot(app);

  const refreshElements = useCallback(() => {
    setElements(discoverElements(app));
  }, [app]);

  useEffect(() => {
    if (!app) return;
    refreshElements();

    const handler = (active: boolean) => setFenceActive(active);
    app.events.on("fence-select-change", handler);

    const onFrame = () => refreshElements();
    app.events.on("frame-rendered", onFrame);

    return () => {
      app.events.off("fence-select-change", handler);
      app.events.off("frame-rendered", onFrame);
    };
  }, [app, refreshElements]);

  const handleSelect = () => {
    if (!app || !expression.trim()) return;
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

  const handleElementSelect = (element: string) => {
    if (!app) return;
    app.artist.selectByExpression(`element == '${element}'`);
  };

  const handleAssignColor = () => {
    if (!app || snapshot.atomCount === 0) return;
    let mod = findAssignColorMod(app);
    if (!mod) {
      mod = new AssignColorModifier();
      app.modifierPipeline.addModifier(mod);
    }
    const selectedIds = app.world.selectionManager.getSelectedAtomIds();
    mod.addAssignment(selectedIds, assignColor);
    app.applyPipeline({ fullRebuild: true });
  };

  const handleDeleteSelected = () => {
    if (!app || snapshot.atomCount === 0) return;
    let mod = findDeleteSelectedMod(app);
    if (!mod) {
      mod = new DeleteSelectedModifier();
      app.modifierPipeline.addModifier(mod);
    }
    const selectedIds = app.world.selectionManager.getSelectedAtomIds();
    mod.deleteIndices(selectedIds);
    app.world.selectionManager.apply({ type: "clear" });
    app.applyPipeline({ fullRebuild: true });
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

          {/* Quick Element Select */}
          {elements.length > 0 && (
            <SidebarSection
              title="By Element"
              subtitle="Quick select by element type"
              defaultOpen={true}
            >
              <div className="flex flex-wrap gap-1">
                {elements.map((el) => (
                  <Button
                    key={el}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-mono"
                    onClick={() => handleElementSelect(el)}
                  >
                    {el}
                  </Button>
                ))}
              </div>
            </SidebarSection>
          )}

          {/* Actions on Selection */}
          <SidebarSection
            title="Actions"
            subtitle="Apply to selected atoms"
            defaultOpen={true}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={assignColor}
                  onChange={(e) => setAssignColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0 shrink-0"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] gap-1 flex-1"
                  onClick={handleAssignColor}
                  disabled={snapshot.atomCount === 0}
                >
                  <Palette className="h-3 w-3" />
                  Color Selection
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] gap-1 w-full text-red-400 hover:text-red-300"
                onClick={handleDeleteSelected}
                disabled={snapshot.atomCount === 0}
              >
                <Trash2 className="h-3 w-3" />
                Delete Selected
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

function findAssignColorMod(
  app: Molvis,
): AssignColorModifier | undefined {
  for (const mod of app.modifierPipeline.getModifiers()) {
    if (mod instanceof AssignColorModifier) return mod;
  }
  return undefined;
}

function findDeleteSelectedMod(
  app: Molvis,
): DeleteSelectedModifier | undefined {
  for (const mod of app.modifierPipeline.getModifiers()) {
    if (mod instanceof DeleteSelectedModifier) return mod;
  }
  return undefined;
}
