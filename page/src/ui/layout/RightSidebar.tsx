import type { Molvis } from "@molvis/core";
import type React from "react";
import { EditPanel } from "../modes/edit/EditPanel";
import { ManipulatePanel } from "../modes/manipulate/ManipulatePanel";
import { MeasurePanel } from "../modes/measure/MeasurePanel";
import { SelectPanel } from "../modes/select/SelectPanel";
import { ViewPanel } from "../modes/view/ViewPanel";

interface RightSidebarProps {
  app: Molvis | null;
  currentMode: string;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  app,
  currentMode,
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
          <div className="p-4 text-center text-muted-foreground">
            Unknown Mode
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full bg-background flex flex-col border-l">
      {renderPanel()}
    </div>
  );
};
