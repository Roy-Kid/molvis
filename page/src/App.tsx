import React, { useState } from 'react';
import { MolvisContext } from './context';
import MolvisWrapper from './MolvisWrapper';
import type { Molvis } from '@molvis/core';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TimelineControl } from "@/components/TimelineControl";
import { PipelinePanel } from "@/components/PipelinePanel";
import { EditorPanel } from "@/components/EditorPanel";

const App: React.FC = () => {
  const [app, setApp] = useState<Molvis | null>(null);
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
    
    app.events.on('status-message', handleStatus);
    
    return () => {
        window.removeEventListener('error', handleGlobalError);
        window.removeEventListener('unhandledrejection', handleRejection);
        app.events.off('status-message', handleStatus);
    };
  }, [app]);


  React.useEffect(() => {
    if (!app) return;
    
    // Initialize Pipeline
    const initPipeline = async () => {
      if (!app) return;
      
      const { DataSourceModifier } = await import('@molvis/core');
      const pipeline = (app as any).modifierPipeline;
      
      if (pipeline && pipeline.getModifiers().length === 0) {
           console.log("Initializing pipeline...");
           pipeline.addModifier(new DataSourceModifier());
           
           // Draw modifiers are no longer added by default.
           // They can be added manually by the user to override global settings.
           
           // Default to edit mode empty
           app.setMode('edit');
      }
    };
    
    initPipeline();
  }, [app]);


  return (
    <ErrorBoundary>
      <MolvisContext.Provider value={app}>
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">


          {/* Main Layout */}
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Left/Center Area: Viewport + Timeline */}
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

            {/* Right Panel: Tabs */}
            <ResizablePanel 
              defaultSize={25} 
              minSize={20} 
              maxSize={50} 
              collapsible={true}
              collapsedSize={0}
              onCollapse={() => console.log('Right panel collapsed')}
              onExpand={() => console.log('Right panel expanded')}
              className="bg-background flex flex-col min-w-0" // removed fixed min-w to allow collapse
            >
              <Tabs defaultValue="pipeline" className="flex-1 flex flex-col h-full w-full">
                <div className="border-b px-2 py-2 bg-muted/10 shrink-0">
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="rendering">Rendering</TabsTrigger>
                    <TabsTrigger value="props">Props</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="pipeline" className="h-full m-0 border-0">
                    <PipelinePanel app={app} />
                  </TabsContent>

                  <TabsContent value="editor" className="h-full m-0 border-0">
                    <ScrollArea className="h-full">
                       <EditorPanel app={app} />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="rendering" className="h-full m-0 border-0">
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        <h3 className="font-medium text-sm mb-4">Rendering Settings</h3>
                        {/* TODO: Add rendering controls */}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="props" className="h-full m-0 border-0">
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        <h3 className="font-medium text-sm mb-4">Object Properties</h3>
                        {/* TODO: Add properties controls */}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
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