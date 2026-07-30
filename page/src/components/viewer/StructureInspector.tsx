import type { Molvis } from "@molvis/stage";
import { Edit3, MousePointer2, Move, Ruler, Video } from "lucide-react";
import type React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const MODE_ITEMS: Array<{
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "view", label: "View", icon: Video },
  { value: "select", label: "Select", icon: MousePointer2 },
  { value: "edit", label: "Edit", icon: Edit3 },
  { value: "measure", label: "Measure", icon: Ruler },
  { value: "manipulate", label: "Manipulate", icon: Move },
];

/**
 * The viewer's right-side tool inspector.
 *
 * The tab strip is the primary mode switcher; each mode owns one inspector
 * panel below it. Pointer events stay inside the shell instead of leaking to
 * the BabylonJS canvas.
 */
export const StructureInspector: React.FC<StructureInspectorProps> = ({
  app,
  currentMode,
  onModeChange,
  headerAction,
}) => {
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
        value={currentMode}
        onValueChange={onModeChange}
        className="h-full min-h-0 gap-0"
      >
        <div className="flex h-toolbar shrink-0 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
          <TabsList
            variant="line"
            aria-label="Viewer modes"
            className="grid h-full min-w-0 flex-1 grid-cols-5 gap-0 rounded-none p-0"
          >
            {MODE_ITEMS.map((item) => {
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
