import type { Molvis } from "@molvis/stage";
import { Edit3, MousePointer2, Move, Ruler, Video } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePluginModePanels, usePluginModeTabs } from "@/plugins";
import { EditPanel } from "@/ui/modes/edit/EditPanel";
import { ManipulatePanel } from "@/ui/modes/manipulate/ManipulatePanel";
import { MeasurePanel } from "@/ui/modes/measure/MeasurePanel";
import { SelectPanel } from "@/ui/modes/select/SelectPanel";
import { ViewPanel } from "@/ui/modes/view/ViewPanel";

export interface StructureInspectorProps {
  app: Molvis | null;
  currentMode: string;
  onModeChange: (mode: string) => void;
  headerAction?: React.ReactNode;
}

const BUILTIN_MODE_ITEMS: Array<{
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  order: number;
}> = [
  { value: "view", label: "View", icon: Video, order: 0 },
  { value: "select", label: "Select", icon: MousePointer2, order: 10 },
  { value: "edit", label: "Edit", icon: Edit3, order: 20 },
  { value: "measure", label: "Measure", icon: Ruler, order: 30 },
  { value: "manipulate", label: "Manipulate", icon: Move, order: 40 },
];

/**
 * Right-side tool inspector.
 *
 * Tab strip is **built-in modes only**. Plugin modes are activated from the
 * command palette (Ctrl/Cmd+Shift+P) and render in this panel without adding
 * chrome to the native tab strip.
 */
export const StructureInspector: React.FC<StructureInspectorProps> = ({
  app,
  currentMode,
  onModeChange,
  headerAction,
}) => {
  const pluginTabs = usePluginModeTabs();
  const pluginPanels = usePluginModePanels(currentMode);

  const isBuiltin = BUILTIN_MODE_ITEMS.some((m) => m.value === currentMode);
  const pluginModeLabel = useMemo(() => {
    if (isBuiltin) return null;
    return (
      pluginTabs.find((t) => t.mode === currentMode)?.label ??
      currentMode.replace(/^plugin\./, "")
    );
  }, [isBuiltin, pluginTabs, currentMode]);

  const colCount = Math.min(Math.max(BUILTIN_MODE_ITEMS.length, 1), 8);

  const handlePointerDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".molvis-sketch-container")) return;
    event.stopPropagation();
  };

  // Plugin workbench: no plugin tabs in the strip — full panel + back.
  if (!isBuiltin) {
    return (
      <section
        aria-label="Plugin tools"
        className="flex h-full min-h-0 w-full flex-col bg-background"
        onPointerDown={handlePointerDown}
      >
        <div className="flex h-toolbar shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
          <div className="min-w-0 flex-1 truncate text-xs font-semibold tracking-tight">
            {pluginModeLabel}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-control px-2 py-1 text-micro text-muted-foreground hover:bg-interactive hover:text-foreground"
            onClick={() => onModeChange("view")}
          >
            Back
          </button>
          {headerAction}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {pluginPanels.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No tools for this mode. Use the command palette (
              <kbd className="rounded border border-border/60 px-1 font-mono">
                Ctrl/⌘+Shift+P
              </kbd>
              ).
            </div>
          ) : (
            pluginPanels.map((panel) => {
              const Panel = panel.render;
              return (
                <div
                  key={panel.id}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {panel.title ? (
                    <div className="shrink-0 border-b border-border/50 px-2 py-1.5 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                      {panel.title}
                    </div>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <Panel app={app} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Viewer tools"
      className="flex h-full min-h-0 w-full flex-col bg-background"
      onPointerDown={handlePointerDown}
    >
      <Tabs
        value={currentMode}
        onValueChange={onModeChange}
        className="h-full min-h-0 gap-0"
      >
        <div className="flex h-toolbar shrink-0 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
          <TabsList
            variant="line"
            aria-label="Viewer modes"
            className="grid h-full min-w-0 flex-1 gap-0 rounded-none p-0"
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
            }}
          >
            {BUILTIN_MODE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.value}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={item.value}
                      aria-label={`${item.label} tool`}
                      disabled={app === null}
                      className="h-full min-w-0 rounded-none px-0 after:bottom-0"
                    >
                      <Icon aria-hidden="true" />
                      <span className="sr-only">{item.label}</span>
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </TabsList>
          {headerAction}
        </div>

        <TabsContent value="view" className="min-h-0 overflow-y-auto">
          <ViewPanel app={app} />
        </TabsContent>
        <TabsContent value="select" className="min-h-0 overflow-y-auto">
          <SelectPanel app={app} />
        </TabsContent>
        <TabsContent value="edit" className="min-h-0 overflow-y-auto">
          <EditPanel app={app} />
        </TabsContent>
        <TabsContent value="measure" className="min-h-0 overflow-y-auto">
          <MeasurePanel app={app} />
        </TabsContent>
        <TabsContent value="manipulate" className="min-h-0 overflow-y-auto">
          <ManipulatePanel app={app} />
        </TabsContent>
      </Tabs>
    </section>
  );
};
