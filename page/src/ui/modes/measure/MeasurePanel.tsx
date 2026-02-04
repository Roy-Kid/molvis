import type { Molvis } from "@molvis/core";
import type React from "react";

interface MeasurePanelProps {
  app: Molvis | null;
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({ app: _app }) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="font-semibold text-lg">Measure Mode</h3>
      <p className="text-sm text-muted-foreground">
        Click on atoms to measure distances, angles, and dihedrals.
      </p>
      <div className="text-xs text-muted-foreground p-2 border rounded bg-muted/20">
        • Click 2 atoms for distance
        <br />• Click 3 atoms for angle
        <br />• Click 4 atoms for dihedral
      </div>
    </div>
  );
};
