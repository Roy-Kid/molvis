import React, { useEffect, useState } from 'react';
import { Molvis, MolvisConfig } from '@molvis/core';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface RenderTabProps {
  app: Molvis | null;
}

export const RenderTab: React.FC<RenderTabProps> = ({ app }) => {
    // Local buffer for settings (transactional)
    const [config, setConfig] = useState<MolvisConfig>({});
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!app) return;
        // Initial sync
        // We ensure useRightHandedSystem is always true locally too, mirroring wrapper enforcement
        const current = app.config ? { ...app.config } : {};
        current.useRightHandedSystem = true; 
        
        setConfig(current);
        setHasChanges(false);
    }, [app]);

    // Update local buffer only
    const updateLocal = (newConfig: Partial<MolvisConfig>) => {
        setConfig(prev => {
             const merged = { ...prev, ...newConfig };
             if (newConfig.grid && prev.grid) merged.grid = { ...prev.grid, ...newConfig.grid };
             if (newConfig.graphics && prev.graphics) merged.graphics = { ...prev.graphics, ...newConfig.graphics };
             return merged;
        });
        setHasChanges(true);
    };

    const updateGrid = (key: keyof NonNullable<MolvisConfig['grid']>, value: any) => {
        updateLocal({
            grid: {
                ...(config.grid || {}),
                [key]: value
            }
        });
    };

    const updateGraphics = (key: keyof NonNullable<MolvisConfig['graphics']>, value: any) => {
        updateLocal({
            graphics: {
                ...(config.graphics || {}),
                [key]: value
            }
        });
    };

    const updateUI = (key: keyof NonNullable<MolvisConfig['uiComponents']>, value: boolean) => {
        updateLocal({
            uiComponents: {
                ...(config.uiComponents || {}),
                [key]: value
            }
        });
    };
    
    const checkUI = (key: keyof NonNullable<MolvisConfig['uiComponents']>) => {
        return !!config.uiComponents?.[key];
    };
    
    const checkGraphic = (key: keyof NonNullable<MolvisConfig['graphics']>) => {
        return !!config.graphics?.[key];
    };

    const handleApply = () => {
        if (!app) return;
        console.log("[RenderTab] Applying settings:", config);
        
        // Enforce RHS again just in case
        const payload = { ...config, useRightHandedSystem: true };
        
        app.setConfig(payload);
        setHasChanges(false);
        
        // Force a re-render/resize if needed to apply certain gfx settings
        // app.resize(); 
    };

    return (
        <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
            
            {/* UI Settings */}
            <div className="space-y-4">
                 <h4 className="text-sm font-medium leading-none text-muted-foreground">User Interface</h4>
                 
                 <div className="flex items-center justify-between">
                    <Label htmlFor="ui-view-panel">View Type (Top-Left)</Label>
                    <Switch 
                        id="ui-view-panel" 
                        checked={checkUI('showViewPanel')}
                        onCheckedChange={(c) => updateUI('showViewPanel', c)}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="ui-perf-panel">FPS Counter (Bottom-Right)</Label>
                    <Switch 
                        id="ui-perf-panel" 
                        checked={checkUI('showPerfPanel')}
                        onCheckedChange={(c) => updateUI('showPerfPanel', c)}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="ui-traj-panel">Trajectory Controls</Label>
                    <Switch 
                        id="ui-traj-panel" 
                        checked={checkUI('showTrajPanel')}
                        onCheckedChange={(c) => updateUI('showTrajPanel', c)}
                    />
                </div>
            </div>

            <Separator />

            {/* Grid Settings */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium leading-none text-muted-foreground">Grid</h4>
                
                <div className="flex items-center justify-between">
                    <Label htmlFor="show-grid">Enabled</Label>
                    <Switch 
                        id="show-grid" 
                        checked={config.grid?.enabled ?? true}
                        onCheckedChange={(c) => updateGrid('enabled', c)}
                    />
                </div>

                <div className="space-y-2">
                     <Label>Opacity ({config.grid?.opacity ?? 0.5})</Label>
                     <Slider 
                        min={0} max={1} step={0.1}
                        value={[config.grid?.opacity ?? 0.5]}
                        onValueChange={([v]) => updateGrid('opacity', v)}
                     />
                </div>

                 <div className="space-y-2">
                     <Label>Size ({config.grid?.size ?? 100})</Label>
                     <Slider 
                        min={10} max={500} step={10}
                        value={[config.grid?.size ?? 100]}
                        onValueChange={([v]) => updateGrid('size', v)}
                     />
                </div>
            </div>
            
            <Separator />
            
            {/* Graphics Settings */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium leading-none text-muted-foreground">Graphics</h4>
                
                <div className="flex items-center justify-between">
                    <Label htmlFor="gfx-shadows">Shadows</Label>
                    <Switch 
                        id="gfx-shadows" 
                        checked={checkGraphic('shadows')}
                        onCheckedChange={(c) => updateGraphics('shadows', c)}
                    />
                </div>

                 <div className="flex items-center justify-between">
                    <Label htmlFor="gfx-ssao">SSAO (Ambient Occlusion)</Label>
                    <Switch 
                        id="gfx-ssao" 
                        checked={checkGraphic('ssao')}
                        onCheckedChange={(c) => updateGraphics('ssao', c)}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="gfx-bloom">Bloom</Label>
                    <Switch 
                        id="gfx-bloom" 
                        checked={checkGraphic('bloom')}
                        onCheckedChange={(c) => updateGraphics('bloom', c)}
                    />
                </div>
                
                 <div className="flex items-center justify-between">
                    <Label htmlFor="gfx-fxaa">FXAA (Anti-Aliasing)</Label>
                    <Switch 
                        id="gfx-fxaa" 
                        checked={checkGraphic('fxaa')}
                        onCheckedChange={(c) => updateGraphics('fxaa', c)}
                    />
                </div>
                
                <div className="flex items-center justify-between">
                    <Label htmlFor="gfx-dof">Depth of Field</Label>
                    <Switch 
                        id="gfx-dof" 
                        checked={checkGraphic('dof')}
                        onCheckedChange={(c) => updateGraphics('dof', c)}
                    />
                </div>

                 <div className="space-y-2">
                     <Label>Hardware Scaling ({config.graphics?.hardwareScaling ?? 1.0})</Label>
                     <div className="text-xs text-muted-foreground mb-1">Lower is faster, Higher is sharper</div>
                     <Slider 
                        min={0.5} max={2.0} step={0.1}
                        value={[config.graphics?.hardwareScaling ?? 1.0]}
                        onValueChange={([v]) => updateGraphics('hardwareScaling', v)}
                     />
                </div>
            </div>

            <Separator />

            {/* Apply Button */}
            <div className="pt-2">
                <Button 
                    className="w-full" 
                    onClick={handleApply} 
                    disabled={!hasChanges}
                    variant={hasChanges ? "default" : "secondary"}
                >
                    {hasChanges ? "Apply Changes" : "No Changes"}
                </Button>
            </div>
        </div>
    );
};
