import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Molvis } from "@molvis/core";
import type React from "react";
import { BuilderTab } from "./BuilderTab";
import { ToolsTab } from "./ToolsTab";

interface EditPanelProps {
  app: Molvis | null;
}

export const EditPanel: React.FC<EditPanelProps> = ({ app }) => {
  return (
    <Tabs defaultValue="draw" className="flex-1 flex flex-col h-full w-full">
      <div className="border-b px-1.5 py-1 bg-muted/10 shrink-0">
        <TabsList className="w-full grid grid-cols-2 h-6 p-0.5">
          <TabsTrigger value="draw" className="text-[10px] px-1 py-0">
            Draw
          </TabsTrigger>
          <TabsTrigger value="builder" className="text-[10px] px-1 py-0">
            Builder
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="draw" className="h-full m-0 border-0">
          <ToolsTab app={app} />
        </TabsContent>

        <TabsContent value="builder" className="h-full m-0 border-0">
          <ScrollArea className="h-full">
            <BuilderTab app={app} />
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  );
};
