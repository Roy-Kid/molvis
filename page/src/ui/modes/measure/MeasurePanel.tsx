import { SidebarSection } from "@/ui/layout/SidebarSection";
import type { Molvis } from "@molvis/core";
import type React from "react";

interface MeasurePanelProps {
  app: Molvis | null;
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({ app: _app }) => {
  return (
    <div className="h-full flex flex-col">
      <SidebarSection title="Measure" subtitle="Pick atoms on the canvas">
        <div className="rounded border bg-muted/10 px-2 py-1 text-[10px] text-muted-foreground leading-4 space-y-0.5">
          <div>2 atoms — distance</div>
          <div>3 atoms — angle</div>
          <div>4 atoms — dihedral</div>
        </div>
      </SidebarSection>
    </div>
  );
};
