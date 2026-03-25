import type { Molvis } from "@molvis/core";
import type React from "react";

interface MeasurePanelProps {
  app: Molvis | null;
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({ app: _app }) => {
  return (
    <div className="h-full p-2.5 space-y-2 text-xs">
      <div className="text-xs font-semibold tracking-wide uppercase">
        Measure
      </div>
      <div className="rounded border bg-muted/10 p-2 text-muted-foreground space-y-1">
        <div>2 atoms: distance</div>
        <div>3 atoms: angle</div>
        <div>4 atoms: dihedral</div>
      </div>
    </div>
  );
};
