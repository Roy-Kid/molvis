import type { Molvis } from "@molvis/core";
import type React from "react";
import { ToolsTab } from "./ToolsTab";

interface EditPanelProps {
  app: Molvis | null;
}

export const EditPanel: React.FC<EditPanelProps> = ({ app }) => {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="h-9 border-b px-2.5 bg-muted/10 shrink-0 font-semibold text-xs tracking-wide uppercase flex items-center">
        Editor Tools
      </div>
      <div className="flex-1 overflow-auto">
        <ToolsTab app={app} />
      </div>
    </div>
  );
};
