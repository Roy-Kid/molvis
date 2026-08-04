import type { Molvis } from "@molvis/stage";
import type React from "react";

interface ManipulatePanelProps {
  app: Molvis | null;
}

export const ManipulatePanel: React.FC<ManipulatePanelProps> = ({
  app: _app,
}) => {
  return (
    <section
      className="flex h-full flex-col px-2 py-2"
      aria-label="Manipulate tools"
    >
      <p className="mb-2 text-micro text-muted-foreground">
        Transform selected atoms
      </p>
      <div className="space-y-1 text-micro leading-4 text-muted-foreground">
        <div>Drag in viewport to move selection</div>
        <div>Ctrl/Cmd + Click in Select mode first to multi-select</div>
      </div>
    </section>
  );
};
