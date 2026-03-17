import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import type { Molvis } from "@molvis/core";
import type React from "react";
import { useState } from "react";
import { RdfPanel } from "../modes/select/RdfPanel";
import { useSelectionSnapshot } from "../modes/select/useSelectionSnapshot";

interface LeftSidebarProps {
  app: Molvis | null;
}

type AnalysisMethod = "rdf" | "msd";

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ app }) => {
  const snapshot = useSelectionSnapshot(app);
  const [analysisMethod, setAnalysisMethod] = useState<AnalysisMethod>("rdf");

  return (
    <div className="h-full w-full bg-background flex flex-col border-r">
      <div className="h-9 px-2.5 border-b bg-muted/15 shrink-0 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide uppercase">
          Analysis
        </div>
        <div className="text-[10px] text-muted-foreground">
          {snapshot.atomCount} atom{snapshot.atomCount !== 1 ? "s" : ""}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
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
              <span className="text-[11px] text-muted-foreground">Method</span>
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
                MSD is not wired yet. Switch back to RDF to run analysis now.
              </div>
            )}
          </SidebarSection>
        </div>
      </ScrollArea>
    </div>
  );
};
