import React from 'react';
import { Molvis } from '@molvis/core';
import { InspectorTab } from './InspectorTab';

interface SelectPanelProps {
  app: Molvis | null;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({ app }) => {
  return (
    <div className="flex flex-col h-full w-full">
        <div className="border-b px-2 py-2 bg-muted/10 shrink-0 font-medium text-sm">
            Selection Inspector
        </div>
        <div className="flex-1 overflow-auto">
            <InspectorTab app={app} />
        </div>
    </div>
  );
};
