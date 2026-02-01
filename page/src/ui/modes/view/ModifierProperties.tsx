import React from 'react';
import type { Modifier, Molvis } from '@molvis/core';
import { DataSourceModifier } from './modifiers/DataSourceModifier';

interface ModifierPropertiesProps {
  modifier: Modifier;
  app: Molvis | null;
  onUpdate: () => void;
}

const MODIFIER_COMPONENTS: Record<string, React.FC<any>> = {
  'Data Source': DataSourceModifier,
};

export const ModifierProperties: React.FC<ModifierPropertiesProps> = ({ modifier, app, onUpdate }) => {
  const Component = MODIFIER_COMPONENTS[modifier.name];

  if (!Component) {
    return (
      <div className="p-4 bg-muted/20 border-t text-sm text-muted-foreground text-center">
        No properties available for {modifier.name}.
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/20 border-t">
      <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {modifier.name} Parameters
          </h4>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {modifier.category}
          </span>
      </div>
      <Component modifier={modifier} app={app} onUpdate={onUpdate} />
    </div>
  );
};
