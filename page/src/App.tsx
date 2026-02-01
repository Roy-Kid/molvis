import React, { useState } from 'react';
import { MolvisContext } from './context';
import MolvisWrapper from './MolvisWrapper';
import type { Molvis } from '@molvis/core';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TimelineControl } from "@/components/TimelineControl";
import { TopBar } from './ui/layout/TopBar';
import { RightSidebar } from './ui/layout/RightSidebar';

const App: React.FC = () => {
  const [app, setApp] = useState<Molvis | null>(null);
  const [currentMode, setCurrentMode] = useState<string>('view');
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [statusType, setStatusType] = useState<"info" | "error">("info");

  React.useEffect(() => {
    // Global error listener
    const handleGlobalError = (event: ErrorEvent) => {
        setStatusMessage(`Error: ${event.message}`);
        setStatusType("error");
    };

    // Global poll rejection listener
    const handleRejection = (event: PromiseRejectionEvent) => {
        let msg = "Unknown error";
        if (event.reason instanceof Error) {
            msg = event.reason.message;
        } else if (typeof event.reason === 'string') {
            msg = event.reason;
        }
        setStatusMessage(`Async Error: ${msg}`);
        setStatusType("error");
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);

    if (!app) return;
    
    // Status message listener
    const handleStatus = (event: any) => {
        setStatusMessage(event.text);
        setStatusType(event.type || "info");
        
        // Auto-clear success/info messages after 5s, keep errors
        if (!event.type || event.type === 'info') {
            setTimeout(() => {
                setStatusMessage("Ready");
            }, 5000);
        }
    };

    const handleModeChange = () => {
        if (app.mode) {
             // Map core modes to UI modes if necessary, or just use mode type string
             // Core modes: view, edit, etc.
             setCurrentMode(app.mode.type);
        }
    };
    
    app.events.on('status-message', handleStatus);
    app.events.on('mode-change', handleModeChange);
    
    return () => {
        window.removeEventListener('error', handleGlobalError);
        window.removeEventListener('unhandledrejection', handleRejection);
        app.events.off('status-message', handleStatus);
        app.events.off('mode-change', handleModeChange);
    };
  }, [app]);


  React.useEffect(() => {
    if (!app) return;
    
    const initDemo = async () => {
      // Dynamic imports to avoid issues before wasm init
      const { DataSourceModifier, Frame, Block } = await import('@molvis/core');
      const pipeline = (app as any).modifierPipeline;
      
      if (pipeline && pipeline.getModifiers().length === 0) {
           console.log("Initializing demo scene...");
           
           // Create H2O Frame
           const atomsBlock = new Block();
           atomsBlock.setColumnF32("x", new Float32Array([0.0, 0.757, -0.757]));
           atomsBlock.setColumnF32("y", new Float32Array([0.0, 0.586, 0.586]));
           atomsBlock.setColumnF32("z", new Float32Array([0.0, 0.0, 0.0]));
           atomsBlock.setColumnStrings("element", ["O", "H", "H"]);
        
           const bondsBlock = new Block();
           bondsBlock.setColumnU32("i", new Uint32Array([0, 0]));
           bondsBlock.setColumnU32("j", new Uint32Array([1, 2]));
           bondsBlock.setColumnU8("order", new Uint8Array([1, 1]));
        
           const frame = new Frame();
           frame.insertBlock("atoms", atomsBlock);
           frame.insertBlock("bonds", bondsBlock);

           // Add Data Source Modifier with this frame
           const sourceMod = new DataSourceModifier();
           sourceMod.setFrame(frame);
           sourceMod.sourceType = 'empty';
           sourceMod.filename = 'H2O Demo';
           
           pipeline.addModifier(sourceMod);
           
           // Force render
           if ((app as any).renderFrame) {
               (app as any).renderFrame(frame);
           }
           
           app.setMode('view');
           setCurrentMode('view');
           
           // Reset camera to view the molecule
           setTimeout(() => {
               if ((app as any).camera) (app as any).camera.reset();
           }, 100);
      }
    };
    
    initDemo();
  }, [app]);

  const handleModeSwitch = (mode: string) => {
      console.log("[App] handleModeSwitch called with:", mode);
      if (!app) return;
      try {
          app.setMode(mode);
          // Only update UI if setMode didn't throw
          setCurrentMode(mode);
      } catch (e) {
          console.error("[App] Failed to switch mode:", e);
          setStatusMessage(`Failed to switch mode: ${(e as Error).message}`);
          setStatusType("error");
      }
  };

  return (
    <ErrorBoundary>
      <MolvisContext.Provider value={app}>
        <div 
            className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden"
            onContextMenu={(e) => e.preventDefault()}
        >
          
          <TopBar app={app} currentMode={currentMode} onModeChange={handleModeSwitch} />

          {/* Main Layout */}
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Center Area: Viewport + Timeline */}
            <ResizablePanel defaultSize={75} className="flex flex-col min-w-[300px]">
              <div className="flex-1 relative bg-muted/20 overflow-hidden">
                <MolvisWrapper onMount={setApp} />
              </div>
              
              {/* Timeline Control Bar - Only show if multiple frames */}
              {(app as any)?.frameCount > 1 && (
                  <div className="h-14 border-t bg-muted/20 shrink-0 z-10">
                     <TimelineControl app={app} totalFrames={(app as any)?.frameCount || 1} />
                  </div>
              )}
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel: Context Sensitive */}
            <ResizablePanel 
              defaultSize={25} 
              minSize={20} 
              maxSize={50} 
              collapsible={true}
              collapsedSize={0}
              className="bg-background flex flex-col min-w-0" 
            >
               <RightSidebar app={app} currentMode={currentMode} />
            </ResizablePanel>
          </ResizablePanelGroup>
          
          {/* Bottom Status Bar */}
          <div className={`h-6 border-t bg-muted/60 flex items-center px-2 text-[10px] shrink-0 ${statusType === 'error' ? 'text-red-500 font-bold bg-red-100/10' : 'text-muted-foreground'}`}>
            {statusMessage}
          </div>
        </div>
      </MolvisContext.Provider>
    </ErrorBoundary>
  );
};

export default App;