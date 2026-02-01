import React from 'react';
import { Molvis } from '@molvis/core';
import { ToolsTab } from './ToolsTab';

interface EditPanelProps {
  app: Molvis | null;
}

export const EditPanel: React.FC<EditPanelProps> = ({ app }) => {
  return (
    <div className="flex flex-col h-full w-full">
        <div className="border-b px-2 py-2 bg-muted/10 shrink-0 font-medium text-sm">
            Editor Tools
        </div>
        <div className="flex-1 overflow-auto">
            <ToolsTab app={app} />
        </div>
    </div>
  );
};
