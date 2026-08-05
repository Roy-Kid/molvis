import type { Molvis } from "@molcrafts/molvis-stage";
import { Code2, Edit3, MousePointer2, Move, Ruler, Video } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
 * Mode tabs = built-in modes **plus** plugin modes from
 * `api.modes.register(..., { tab, panel })`. Plugin modes extend the same
 * strip as View/Select/… — not a separate overlay with a Back button.
 */
export const StructureInspector: React.FC<StructureInspectorProps> = ({
  app,
  currentMode,
  onModeChange,
  headerAction,
}) => {
  const pluginTabs = usePluginModeTabs();

  const modeItems = useMemo(() => {
    const pluginItems = pluginTabs.map((tab) => ({
      value: tab.mode,
      label: tab.label,
      icon: null as React.ComponentType<{ className?: string }> | null,
      customIcon: tab.icon as React.ReactNode | undefined,
      order: tab.order ?? 100,
    }));
    const builtin = BUILTIN_MODE_ITEMS.map((item) => ({
      ...item,
      customIcon: undefined as React.ReactNode | undefined,
    }));
    return [...builtin, ...pluginItems].sort((a, b) => a.order - b.order);
  }, [pluginTabs]);

  // Controlled value must match a trigger; fall back if mode unregistered.
  const tabValue = useMemo(() => {
    if (modeItems.some((m) => m.value === currentMode)) return currentMode;
    return "view";
  }, [currentMode, modeItems]);

  const colCount = Math.min(Math.max(modeItems.length, 1), 10);

  const handlePointerDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".molvis-sketch-container")) return;
    event.stopPropagation();
  };

  return (
    <section
      aria-label="Viewer tools"
      className="flex h-full min-h-0 w-full flex-col bg-background"
      onPointerDown={handlePointerDown}
    >
      <Tabs
        value={tabValue}
        onValueChange={onModeChange}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <div className="flex h-7 shrink-0 items-center gap-0.5 px-1">
          <TabsList
            variant="line"
            aria-label="Viewer modes"
            className="grid h-full min-w-0 flex-1 gap-0 rounded-none border-0 bg-transparent p-0"
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
            }}
          >
            {modeItems.map((item) => {
              const BuiltinIcon = item.icon;
              return (
                <Tooltip key={item.value}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={item.value}
                      aria-label={`${item.label} tool`}
                      disabled={app === null}
                      className={cn(
                        "h-full min-w-0 rounded-none border-0 bg-transparent px-0 shadow-none",
                        // Active mode: accent green icon (no fill card).
                        "text-muted-foreground hover:text-foreground",
                        "data-[state=active]:bg-transparent data-[state=active]:text-accent",
                        "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
                        "group-data-[variant=line]/tabs-list:data-[state=active]:text-accent",
                        // Hairline underline in accent when selected.
                        "after:bottom-0 after:bg-accent",
                      )}
                    >
                      {item.customIcon ? (
                        <span
                          className="flex size-4 items-center justify-center [&_svg]:size-4"
                          aria-hidden
                        >
                          {item.customIcon}
                        </span>
                      ) : BuiltinIcon ? (
                        <BuiltinIcon aria-hidden="true" />
                      ) : (
                        <Code2 aria-hidden="true" className="size-4" />
                      )}
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

        {/*
          overflow-hidden + flex column so mode bodies get a bounded height
          and can split list/properties. overflow-y-auto here broke the chain
          (children with h-full never constrained → no adaptive split).
        */}
        <TabsContent
          value="view"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <ViewPanel app={app} />
        </TabsContent>
        <TabsContent
          value="select"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SelectPanel app={app} />
          </div>
        </TabsContent>
        <TabsContent
          value="edit"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EditPanel app={app} />
          </div>
        </TabsContent>
        <TabsContent
          value="measure"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MeasurePanel app={app} />
          </div>
        </TabsContent>
        <TabsContent
          value="manipulate"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ManipulatePanel app={app} />
          </div>
        </TabsContent>

        {pluginTabs.map((tab) => (
          <TabsContent
            key={tab.mode}
            value={tab.mode}
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <PluginModePane app={app} mode={tab.mode} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
};

/** Per-plugin-mode body; keeps hooks valid under a stable component identity. */
function PluginModePane({ app, mode }: { app: Molvis | null; mode: string }) {
  const panels = usePluginModePanels(mode);

  if (panels.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No tools for this mode.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {panels.map((panel) => {
        const Panel = panel.render;
        return (
          <div
            key={panel.id}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {/* Mode tab already names the workbench — no extra section chrome. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Panel app={app} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
