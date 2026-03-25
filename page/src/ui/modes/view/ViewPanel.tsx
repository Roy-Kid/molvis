import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Molvis } from "@molvis/core";
import type React from "react";
import { PipelineTab } from "./PipelineTab";
import { RenderTab } from "./RenderTab";

interface ViewPanelProps {
  app: Molvis | null;
}

export const ViewPanel: React.FC<ViewPanelProps> = ({ app }) => {
  return (
    <Tabs
      defaultValue="pipeline"
      className="flex-1 flex flex-col h-full w-full"
    >
      <div className="border-b px-1.5 py-1 bg-muted/10 shrink-0">
        <TabsList className="w-full grid grid-cols-2 h-6 p-0.5">
          <TabsTrigger value="pipeline" className="text-[10px] px-1 py-0">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="render" className="text-[10px] px-1 py-0">
            Render
          </TabsTrigger>
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
