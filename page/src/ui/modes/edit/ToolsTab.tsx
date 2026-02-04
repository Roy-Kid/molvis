import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ModeType, type Molvis } from "@molvis/core";
import type React from "react";
import { useEffect, useState } from "react";

interface ToolsTabProps {
  app: Molvis | null;
}

const COMMON_ELEMENTS = [
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Fe",
  "Cu",
  "Zn",
  "Br",
  "I",
];

export const ToolsTab: React.FC<ToolsTabProps> = ({ app }) => {
  const [activeElement, setActiveElement] = useState<string>("C");
  const [activeBondOrder, setActiveBondOrder] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Sync state with EditMode
  useEffect(() => {
    if (!app) return;

    const updateState = () => {
      const mode = app.mode;
      if (mode && mode.type === ModeType.Edit) {
        setIsEditMode(true);
        const editMode = mode as any;
        if (editMode.element) setActiveElement(editMode.element);
        if (editMode.bondOrder) setActiveBondOrder(editMode.bondOrder);
      } else {
        setIsEditMode(false);
      }
    };

    updateState();

    const onModeChange = () => updateState();

    if (app.events && typeof app.events.on === "function") {
      app.events.on("mode-change", onModeChange);
    }

    return () => {
      if (app.events && typeof app.events.off === "function") {
        app.events.off("mode-change", onModeChange);
      }
    };
  }, [app]);

  const updateEditMode = (updates: {
    element?: string;
    bondOrder?: number;
  }) => {
    if (!app) return;

    const mode = app.mode;
    if (mode && mode.type === ModeType.Edit) {
      const editMode = mode as any;
      if (updates.element) {
        editMode.element = updates.element;
        setActiveElement(updates.element);
      }
      if (updates.bondOrder) {
        editMode.bondOrder = updates.bondOrder;
        setActiveBondOrder(updates.bondOrder);
      }
    }
  };

  if (!app || !isEditMode) return null;

  return (
    <div className="flex flex-col gap-6 p-4 h-full pointer-events-auto">
      {/* Element Selection */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Draw Element
        </Label>
        <Select
          value={activeElement}
          onValueChange={(val) => updateEditMode({ element: val })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select element" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_ELEMENTS.map((el) => (
              <SelectItem key={el} value={el}>
                <span className="font-mono font-medium">{el}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bond Order Selection */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bond Order
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((order) => (
            <Button
              key={order}
              variant={activeBondOrder === order ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 font-bold transition-all",
                activeBondOrder === order &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              onClick={() => updateEditMode({ bondOrder: order })}
            >
              {order === 1 ? "Single" : order === 2 ? "Double" : "Triple"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
