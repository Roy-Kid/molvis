import { SidebarSection } from "@/ui/layout/SidebarSection";
import type { Molvis } from "@molvis/core";
import type React from "react";

interface ManipulatePanelProps {
  app: Molvis | null;
}

export const ManipulatePanel: React.FC<ManipulatePanelProps> = ({
  app: _app,
}) => {
  return (
    <div className="h-full flex flex-col">
      <SidebarSection title="Manipulate" subtitle="Transform selected atoms">
        <div className="rounded border bg-muted/10 px-2 py-1 text-[10px] text-muted-foreground leading-4 space-y-0.5">
          <div>Drag in viewport to move selection</div>
          <div>Ctrl/Cmd + Click in Select mode first to multi-select</div>
        </div>
      </SidebarSection>
    </div>
  );
};
