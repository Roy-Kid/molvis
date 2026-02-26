import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Molvis } from "@molvis/core";
import React, { useState } from "react";
import { InspectorTab } from "./InspectorTab";

interface SelectPanelProps {
  app: Molvis | null;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({ app }) => {
  const [expression, setExpression] = useState("");

  const handleSelect = () => {
    if (!app || !expression.trim()) return;
    try {
      app.artist.selectByExpression(expression);
    } catch (e) {
      console.error("Selection failed:", e);
      // Ideally show error toast/status
      app.events.emit("status-message", {
        text: `Selection error: ${(e as Error).message}`,
        type: "error",
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="border-b px-2 py-2 bg-muted/10 shrink-0 font-medium text-sm">
        Selection
      </div>
      
      {/* Expression Selection Section */}
      <div className="p-3 border-b space-y-2">
        <div className="text-xs text-muted-foreground font-medium">
          Select by Expression
        </div>
        <div className="flex gap-2">
          <Input 
            className="h-8 text-xs font-mono"
            placeholder="e.g. element == 'C' && x > 0"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSelect()}
          />
          <Button 
            size="sm" 
            className="h-8 px-3 text-xs"
            onClick={handleSelect}
            disabled={!expression.trim()}
          >
            Select
          </Button>
        </div>
      </div>

      <div className="border-b px-2 py-2 bg-muted/10 shrink-0 font-medium text-sm mt-1">
        Inspector
      </div>
      <div className="flex-1 overflow-auto">
        <InspectorTab app={app} />
      </div>
    </div>
  );
};
