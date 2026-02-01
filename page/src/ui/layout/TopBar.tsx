import React from 'react';
import { Molvis } from '@molvis/core';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MousePointer2, 
  Edit3, 
  Move, 
  Undo2, 
  Redo2, 
  Video,
  Ruler,
  Scan
} from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { SettingsDialog } from './SettingsDialog';
import { ExportDialog } from './ExportDialog';

interface TopBarProps {
  app: Molvis | null;
  currentMode: string;
  onModeChange: (mode: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ app, currentMode, onModeChange }) => {
  
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  React.useEffect(() => {
    if (!app) return;

    // Initial state
    setCanUndo(app.commandManager.canUndo());
    setCanRedo(app.commandManager.canRedo());

    const updateHistory = (state: { canUndo: boolean, canRedo: boolean }) => {
        setCanUndo(state.canUndo);
        setCanRedo(state.canRedo);
    };

    app.events.on('history-change', updateHistory);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) {
                app.commandManager.redo();
            } else {
                app.commandManager.undo();
            }
            e.preventDefault();
            e.stopPropagation();
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        app.events.off('history-change', updateHistory);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [app]);

  const handleUndo = () => {
      if (app) app.commandManager.undo();
  };

  const handleRedo = () => {
      if (app) app.commandManager.redo();
  };

  const handleResetCamera = () => {
      if (app && app.world) {
          app.world.resetCamera();
      }
  };

  return (
    <div className="h-12 border-b bg-background flex items-center px-4 gap-4 shrink-0 justify-between">
        {/* Left Side: Logo & Tabs */}
        <div className="flex items-center gap-4">
            {/* App Menu / Logo */}
            <div className="flex items-center gap-2 font-bold text-lg">
                <span>MolVis</span>
            </div>

            {/* Mode Switcher */}
            <Tabs value={currentMode} onValueChange={(val) => {
                console.log("[TopBar] Switching mode to:", val);
                onModeChange(val);
            }} className="w-[500px]">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="view" className="flex gap-2 items-center">
                        <Video className="h-4 w-4" /> View
                    </TabsTrigger>
                    <TabsTrigger value="select" className="flex gap-2 items-center">
                        <MousePointer2 className="h-4 w-4" /> Select
                    </TabsTrigger>
                    <TabsTrigger value="edit" className="flex gap-2 items-center">
                        <Edit3 className="h-4 w-4" /> Edit
                    </TabsTrigger>
                    <TabsTrigger value="manipulate" className="flex gap-2 items-center">
                        <Move className="h-4 w-4" /> Manip
                    </TabsTrigger>
                    <TabsTrigger value="measure" className="flex gap-2 items-center">
                        <Ruler className="h-4 w-4" /> Measure
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>

        {/* Right Side: Toolbar and Settings */}
        <div className="flex items-center gap-2">
            {/* Action Toolbar */}
            <div className="flex items-center gap-1">
                <ExportDialog app={app} />
                <Separator orientation="vertical" className="h-6 mx-2" />

                <Button variant="ghost" size="icon" onClick={handleUndo} title="Undo" disabled={!canUndo}>
                    <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRedo} title="Redo" disabled={!canRedo}>
                    <Redo2 className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6 mx-2" />
                <Button variant="ghost" size="icon" onClick={handleResetCamera} title="Reset Camera">
                    <Scan className="h-4 w-4" />
                </Button>
            </div>
            
            <Separator orientation="vertical" className="h-6 mx-2" />
            
            {/* Settings Dialog Button */}
            <SettingsDialog app={app} />
        </div>
    </div>
  );
};
