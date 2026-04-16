import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Molvis } from "@molvis/core";
import { FlaskConical, Pencil } from "lucide-react";
import type React from "react";
import { BuilderTab } from "./BuilderTab";
import { ToolsTab } from "./ToolsTab";

interface EditPanelProps {
  app: Molvis | null;
}

export const EditPanel: React.FC<EditPanelProps> = ({ app }) => {
  return (
    <Tabs defaultValue="draw" className="flex-1 flex flex-col h-full w-full">
      <div className="border-b px-1.5 py-1 bg-muted/15 shrink-0">
        <TabsList className="w-full grid grid-cols-2 h-7 p-0.5">
          <TabsTrigger
            value="draw"
            className="h-6 px-0"
            title="Draw atoms & bonds directly on the canvas"
            aria-label="Draw"
          >
            <Pencil className="h-3.5 w-3.5" />
          </TabsTrigger>
          <TabsTrigger
            value="builder"
            className="h-6 px-0"
            title="Build from SMILES or 2D sketch"
            aria-label="Builder"
          >
            <FlaskConical className="h-3.5 w-3.5" />
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="draw" className="h-full m-0 border-0">
          <ToolsTab app={app} />
        </TabsContent>

        <TabsContent value="builder" className="h-full m-0 border-0">
          <BuilderTab app={app} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
