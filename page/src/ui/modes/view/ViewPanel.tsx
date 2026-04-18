import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Molvis } from "@molvis/core";
import { Palette, Workflow } from "lucide-react";
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
      <div className="border-b px-1.5 py-1 bg-muted/15 shrink-0">
        <TabsList className="w-full grid grid-cols-2 h-7 p-0.5">
          <TabsTrigger
            value="pipeline"
            className="h-6 px-0"
            title="Modifier pipeline"
            aria-label="Pipeline"
          >
            <Workflow className="h-3.5 w-3.5" />
          </TabsTrigger>
          <TabsTrigger
            value="render"
            className="h-6 px-0"
            title="Rendering settings"
            aria-label="Render"
          >
            <Palette className="h-3.5 w-3.5" />
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
