import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Molvis } from "@molvis/core";
import { Edit3, MousePointer2, Move, Ruler, Video } from "lucide-react";
import type React from "react";
import { EditPanel } from "../modes/edit/EditPanel";
import { ManipulatePanel } from "../modes/manipulate/ManipulatePanel";
import { MeasurePanel } from "../modes/measure/MeasurePanel";
import { SelectPanel } from "../modes/select/SelectPanel";
import { ViewPanel } from "../modes/view/ViewPanel";

interface RightSidebarProps {
  app: Molvis | null;
  currentMode: string;
  onModeChange: (mode: string) => void;
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
  { value: "manipulate", label: "Manip", icon: Move },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  app,
  currentMode,
  onModeChange,
}) => {
  const renderPanel = () => {
    switch (currentMode) {
      case "view":
        return <ViewPanel app={app} />;
      case "select":
        return <SelectPanel app={app} />;
      case "edit":
        return <EditPanel app={app} />;
      case "manipulate":
        return <ManipulatePanel app={app} />;
      case "measure":
        return <MeasurePanel app={app} />;
      default:
        return (
          <div className="p-3 text-center text-muted-foreground text-xs">
            Unknown mode: {currentMode}
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full bg-background flex flex-col border-l">
      <div className="border-b px-1.5 py-1 bg-muted/15 shrink-0">
        <div className="grid grid-cols-5 gap-0.5">
          {MODE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentMode === item.value;
            return (
              <Button
                key={item.value}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onModeChange(item.value)}
                className={cn(
                  "h-7 w-full px-0",
                  active && "font-semibold",
                )}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">{renderPanel()}</div>
    </div>
  );
};
