import React from 'react';
import { Molvis } from '@molvis/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PipelineTab } from './PipelineTab';
import { RenderTab } from './RenderTab';

interface ViewPanelProps {
  app: Molvis | null;
}

export const ViewPanel: React.FC<ViewPanelProps> = ({ app }) => {
  return (
    <Tabs defaultValue="pipeline" className="flex-1 flex flex-col h-full w-full">
      <div className="border-b px-2 py-2 bg-muted/10 shrink-0">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="render">Render</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="pipeline" className="h-full m-0 border-0">
            <PipelineTab app={app} />
        </TabsContent>

        <TabsContent value="render" className="h-full m-0 border-0">
          <ScrollArea className="h-full">
             <RenderTab app={app} />
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  );
};
