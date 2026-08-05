import type { Molvis } from "@molcrafts/molvis-stage";
import type React from "react";

interface MeasurePanelProps {
  app: Molvis | null;
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({ app: _app }) => {
  return (
    <section
      className="flex h-full flex-col px-2 py-2"
      aria-label="Measure tools"
    >
      <p className="mb-2 text-micro text-muted-foreground">
        Pick atoms on the canvas
      </p>
      <div className="space-y-1 text-micro leading-4 text-muted-foreground">
        <div>2 atoms — distance</div>
        <div>3 atoms — angle</div>
        <div>4 atoms — dihedral</div>
      </div>
    </section>
  );
};
