import type { Molvis } from "@molvis/core";
import type React from "react";

interface ManipulatePanelProps {
  app: Molvis | null;
}

export const ManipulatePanel: React.FC<ManipulatePanelProps> = ({
  app: _app,
}) => {
  return (
    <div className="h-full p-2.5 space-y-2 text-xs">
      <div className="text-xs font-semibold tracking-wide uppercase">
        Manipulate
      </div>
      <div className="rounded border bg-muted/10 p-2 text-muted-foreground space-y-1">
        <div>Drag selected atoms in viewport to move.</div>
        <div>
          Use Ctrl/Cmd + Click in Select mode to build multi-selection first.
        </div>
      </div>
    </div>
  );
};
