import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import type { Molvis } from "@molvis/core";
import type React from "react";
import { useState } from "react";
import { RdfPanel } from "../modes/select/RdfPanel";
import { useSelectionSnapshot } from "../modes/select/useSelectionSnapshot";
import { DataInspectorPanel } from "./DataInspectorPanel";
import { HistogramPanel } from "./HistogramPanel";

interface LeftSidebarProps {
  app: Molvis | null;
}

type AnalysisMethod = "rdf" | "msd";

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ app }) => {
  const snapshot = useSelectionSnapshot(app);
  const [analysisMethod, setAnalysisMethod] = useState<AnalysisMethod>("rdf");

  return (
    <div className="h-full w-full bg-background flex flex-col border-r">
      <Tabs defaultValue="data" className="h-full flex flex-col">
        <div className="shrink-0 border-b bg-muted/10">
          <TabsList className="w-full rounded-none h-7 bg-transparent">
            <TabsTrigger value="data" className="text-[9px] uppercase h-5">
              Data
            </TabsTrigger>
            <TabsTrigger value="histogram" className="text-[9px] uppercase h-5">
              Hist
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-[9px] uppercase h-5">
              Analysis
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="data" className="flex-1 min-h-0 mt-0">
          <DataInspectorPanel app={app} />
        </TabsContent>

        <TabsContent value="histogram" className="flex-1 min-h-0 mt-0">
          <HistogramPanel app={app} />
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="min-h-full">
              <SidebarSection
                title="Analysis"
                subtitle={
                  analysisMethod === "rdf"
                    ? "Radial distribution function"
                    : "Mean square displacement"
                }
                badge={analysisMethod.toUpperCase()}
                defaultOpen={true}
                className="border-b-0"
              >
                <div className="grid grid-cols-[72px_1fr] gap-2 items-center">
                  <span className="text-[11px] text-muted-foreground">
                    Method
                  </span>
                  <Select
                    value={analysisMethod}
                    onValueChange={(value) => {
                      if (value === "rdf" || value === "msd") {
                        setAnalysisMethod(value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rdf" className="text-xs">
                        RDF
                      </SelectItem>
                      <SelectItem value="msd" className="text-xs">
                        MSD (Coming Soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {analysisMethod === "rdf" ? (
                  <RdfPanel app={app} snapshot={snapshot} />
                ) : (
                  <div className="rounded border bg-muted/10 p-2 text-[11px] text-muted-foreground">
                    MSD is not wired yet. Switch back to RDF to run analysis
                    now.
                  </div>
                )}
              </SidebarSection>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
