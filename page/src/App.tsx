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

const App: React.FC = () => {
  const [app, setApp] = useState<Molvis | null>(null);

  React.useEffect(() => {
    if (!app) return;
    
    // Demo Data Loading
    const loadDemo = async () => {
      try {
        console.log("Loading demo data...");
        // Core exports AtomBlock as Atom and BondBlock as Bond
        const { Atom, Bond, Frame, ArrayFrameSource, DrawAtomsModifier, DrawBondsModifier, DrawBoxModifier } = await import('@molvis/core');
        
        // Water
        const atomBlockWater = new Atom(
          [0.0, 0.75695, -0.75695],
          [-0.06556, 0.52032, 0.52032],
          [0.0, 0.0, 0.0],
          ["O", "H", "H"],
        );
        const bondBlockWater = new Bond([0, 0], [1, 2], [1, 1]);
        const frame = new Frame(atomBlockWater, bondBlockWater);
        
        // Create source and populate pipeline
        const source = new ArrayFrameSource([frame]);
        
        const pipeline = (app as any).modifierPipeline;
        if (pipeline) {
             pipeline.clear();
             pipeline.addModifier(new DrawAtomsModifier());
             pipeline.addModifier(new DrawBondsModifier());
             pipeline.addModifier(new DrawBoxModifier());
        
             // Compute and render
             const computedFrame = await (app as any).computeFrame(0, source);
             (app as any).renderFrame(computedFrame);
        }

        console.log("Demo data loaded");
      } catch (e) {
        console.error("Failed to load demo data", e);
      }
    };
    
    loadDemo();
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
              
              {/* Timeline Control Bar */}
              <div className="h-14 border-t bg-muted/20 shrink-0 z-10">
                 <TimelineControl app={app} totalFrames={100} />
              </div>
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
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="rendering">Rendering</TabsTrigger>
                    <TabsTrigger value="props">Props</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="pipeline" className="h-full m-0 border-0">
                    <PipelinePanel app={app} />
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
          <div className="h-6 border-t bg-muted/60 flex items-center px-2 text-[10px] text-muted-foreground shrink-0">
            Ready
          </div>
        </div>
      </MolvisContext.Provider>
    </ErrorBoundary>
  );
};

export default App;