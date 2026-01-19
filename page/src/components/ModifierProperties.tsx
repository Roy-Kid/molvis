import React from 'react';
import type { Modifier } from '@molvis/core';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModifierPropertiesProps {
  modifier: Modifier;
  onUpdate: () => void;
}

export const ModifierProperties: React.FC<ModifierPropertiesProps> = ({ modifier, onUpdate }) => {
  const handleChange = (key: string, value: any) => {
    (modifier as any)[key] = value;
    onUpdate();
  };

  // Helper to render specific fields based on modifier type
  // In a real app, this would be data-driven or schema-driven
  const renderFields = () => {
    if (modifier.name === 'Draw Atoms') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Coloring Scheme</Label>
            <Select 
              value={(modifier as any).coloring} 
              onValueChange={(val) => handleChange('coloring', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="element">Element</SelectItem>
                <SelectItem value="chain">Chain</SelectItem>
                <SelectItem value="uniform">Uniform</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Radius ({(modifier as any).radius})</Label>
            <Slider 
              min={0.05} max={2.0} step={0.05}
              value={[(modifier as any).radius]}
              onValueChange={([val]) => handleChange('radius', val)}
            />
          </div>
        </div>
      );
    }
    
    if (modifier.name === 'Draw Bonds') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Radius ({(modifier as any).radius})</Label>
            <Slider 
              min={0.01} max={0.5} step={0.01}
              value={[(modifier as any).radius]}
              onValueChange={([val]) => handleChange('radius', val)}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
             <div className="flex gap-2">
                <Input 
                  type="color" 
                  className="w-12 h-8 p-1 cursor-pointer" 
                  value={(modifier as any).color}
                  onChange={(e) => handleChange('color', e.target.value)}
                />
                <Input 
                   type="text" 
                   value={(modifier as any).color} 
                   onChange={(e) => handleChange('color', e.target.value)}
                />
             </div>
          </div>
        </div>
      );
    }

    if (modifier.name === 'Draw Box') {
       return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Line Width ({(modifier as any).lineWidth})</Label>
            <Slider 
              min={0.5} max={5.0} step={0.5}
              value={[(modifier as any).lineWidth]}
              onValueChange={([val]) => handleChange('lineWidth', val)}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
             <div className="flex gap-2">
                <Input 
                  type="color" 
                  className="w-12 h-8 p-1 cursor-pointer" 
                  value={(modifier as any).color}
                  onChange={(e) => handleChange('color', e.target.value)}
                />
                 <Input 
                   type="text" 
                   value={(modifier as any).color} 
                   onChange={(e) => handleChange('color', e.target.value)}
                />
             </div>
          </div>
        </div>
      );
    }

    // Default Fallback
    return (
      <div className="text-sm text-muted-foreground">
        No properties available for this modifier.
      </div>
    );
  };

  return (
    <div className="p-4 bg-muted/20 border-t">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {modifier.name} Parameters
      </h4>
      {renderFields()}
    </div>
  );
};
