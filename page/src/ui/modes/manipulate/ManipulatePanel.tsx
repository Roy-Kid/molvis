import React from 'react';
import { Molvis } from '@molvis/core';

interface ManipulatePanelProps {
  app: Molvis | null;
}

export const ManipulatePanel: React.FC<ManipulatePanelProps> = ({ app: _app }) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="font-semibold text-lg">Manipulate Mode</h3>
      <p className="text-sm text-muted-foreground">
        Drag atoms to move them.
      </p>
      <div className="text-xs text-muted-foreground p-2 border rounded bg-muted/20">
         Drag atoms to move them.
      </div>
    </div>
  );
};
