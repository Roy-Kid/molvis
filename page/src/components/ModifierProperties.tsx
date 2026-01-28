import React from 'react';
import type { Modifier, Molvis } from '@molvis/core';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp } from "lucide-react";

interface ModifierPropertiesProps {
  modifier: Modifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const ModifierProperties: React.FC<ModifierPropertiesProps> = ({ modifier, app, onUpdate }) => {
  const handleChange = (key: string, value: any) => {
    (modifier as any)[key] = value;
    onUpdate();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;

    try {
       const text = await file.text();
       const ext = file.name.split('.').pop() || 'pdb';
       
       // Dynamic import to avoid circular deps if any, or just standard import usage
       const { readFrame, ArrayFrameSource } = await import('@molvis/core');
       
       console.log(`Reading file ${file.name} as ${ext}`);
       // Support XYZ/PDB. If error, catch it.
       let frame;
       console.log(`[ModifierProperties] calling readFrame for ${file.name} (ext: ${ext})`);
       try {
          frame = readFrame(text, ext);
          console.log(`[ModifierProperties] readFrame returned:`, frame);
       } catch (err) {
          console.error("Parse error", err);
          if (app && app.events) {
              app.events.emit('status-message', {
                  text: `Failed to parse file: ${(err as Error).message}`,
                  type: 'error'
              });
          }
          return;
       }

       if (frame) {
          // Update Modifier State
          (modifier as any).sourceType = 'file';
          (modifier as any).filename = file.name;
          
          if ('setFrame' in modifier && typeof (modifier as any).setFrame === 'function') {
             (modifier as any).setFrame(frame);
          }
          
          onUpdate();

          // We don't need to manually create ArrayFrameSource anymore.
          // We just trigger a pipeline update.
          // App.computeFrame(0, dummySource) will call pipeline.compute -> modifier.apply -> returns new frame.
          
          // However, App.computeFrame needs A source. We can use the existing empty one or current one.
          // Since we changed the internal state of a modifier, calling re-compute should be enough.
          
           app.setMode('view');
           
           // Force re-compute
           const pipeline = (app as any).modifierPipeline;
           if (pipeline) {
                // We pass a dummy frame because DataSourceModifier will ignore it
                const { Frame, ArrayFrameSource } = await import('@molvis/core');
                const dummySource = new ArrayFrameSource([new Frame()]);
                
                const computed = await (app as any).computeFrame(0, dummySource);
               (app as any).renderFrame(computed);
               
               // Force UI update to show new stats
               onUpdate();
           }
           
           (app as any).frameCount = 1; 
       }
    } catch (e) {
       console.error("Upload failed", e);
       if (app && app.events) {
          app.events.emit('status-message', {
              text: `Error: ${(e as Error).message}`,
              type: 'error'
          });
       }
    } finally {
       // Reset value to allow re-selection of same file
       e.target.value = '';
    }
  };

  const handleCreateEmpty = async () => {
     if (!app) return;
     const { Frame, ArrayFrameSource } = await import('@molvis/core');
     
     // Empty frame
     const frame = new Frame(); 
     
     (modifier as any).sourceType = 'empty';
     (modifier as any).filename = '';
     
     if ('setFrame' in modifier && typeof (modifier as any).setFrame === 'function') {
         (modifier as any).setFrame(frame);
     }
     
     onUpdate();

     app.setMode('edit');
     
     // Trigger re-compute
     const pipeline = (app as any).modifierPipeline;
     if (pipeline) {
        const dummySource = new ArrayFrameSource([new Frame()]);
        const computed = await (app as any).computeFrame(0, dummySource);
        (app as any).renderFrame(computed);
     }
  };

  // Helper to render specific fields based on modifier type
  // In a real app, this would be data-driven or schema-driven
  const renderFields = () => {
    if (modifier.name === 'Data Source') {
        const sourceType = (modifier as any).sourceType || 'empty';
        const filename = (modifier as any).filename || '';

        return (
            <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs">Source Type</Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {sourceType === 'file' ? (
                            <span className="font-mono text-foreground">{filename}</span>
                        ) : (
                            <span>Empty / Editable</span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <input 
                           type="file" 
                           className="absolute inset-0 opacity-0 cursor-pointer"
                           onChange={handleFileUpload}
                           accept=".pdb,.xyz"
                        />
                        <Button variant="outline" size="sm" className="w-full gap-2">
                            <FileUp className="h-3 w-3" /> Load File
                        </Button>
                    </div>
                    
                    <Button variant="secondary" size="sm" onClick={handleCreateEmpty}>
                        Create Empty
                    </Button>
                </div>

                {sourceType === 'file' && (
                    <div className="text-[10px] text-muted-foreground mt-2">
                        Supported formats: PDB, XYZ
                    </div>
                )}

                {/* Frame Statistics */}
                <div className="mt-4 pt-4 border-t space-y-2">
                    <Label className="text-xs font-semibold">Current Frame Stats</Label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Atoms:</div>
                        <div className="font-mono text-foreground text-right">
                            {app?.system?.frame?.get_block('atoms')?.nrows() ?? 0}
                        </div>
                        
                        <div>Bonds:</div>
                        <div className="font-mono text-foreground text-right">
                             {app?.system?.frame?.get_block('bonds')?.nrows() ?? 0}
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    if (modifier.name === 'Draw Atoms') {
      const handleRadiusChange = (val: number) => {
          handleChange('radius', val);
          if (app && (app as any).styleManager) {
              (app as any).styleManager.setAtomRadiusScale(val);
              // Trigger re-render of current frame if available
              if ((app as any).renderFrame && (app as any).system.frame) {
                  (app as any).renderFrame((app as any).system.frame);
              }
          }
      };

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
            <Label>Radius Scale ({(modifier as any).radius})</Label>
            <Slider 
              min={0.1} max={2.0} step={0.1}
              value={[(modifier as any).radius]}
              onValueChange={([val]) => handleRadiusChange(val)}
            />
          </div>
        </div>
      );
    }
    
    if (modifier.name === 'Draw Bonds') {
      const handleRadiusChange = (val: number) => {
          handleChange('radius', val);
          if (app && (app as any).styleManager) {
              (app as any).styleManager.setBondRadiusScale(val);
               if ((app as any).renderFrame && (app as any).system.frame) {
                  (app as any).renderFrame((app as any).system.frame);
              }
          }
      };

      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Radius Scale ({(modifier as any).radius})</Label>
            <Slider 
              min={0.1} max={2.0} step={0.1}
              value={[(modifier as any).radius]}
              onValueChange={([val]) => handleRadiusChange(val)}
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
      <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {modifier.name} Parameters
          </h4>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {modifier.category}
          </span>
      </div>
      {renderFields()}
    </div>
  );
};
