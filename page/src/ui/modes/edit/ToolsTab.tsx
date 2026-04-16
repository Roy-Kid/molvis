import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ModeType, type Molvis } from "@molvis/core";
import { Atom, Link2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface ToolsTabProps {
  app: Molvis | null;
}

interface EditModeState {
  type: ModeType.Edit;
  element: string;
  bondOrder: number;
}

function isEditModeState(mode: unknown): mode is EditModeState {
  if (!mode || typeof mode !== "object") return false;
  const candidate = mode as Partial<EditModeState>;
  return (
    candidate.type === ModeType.Edit &&
    typeof candidate.element === "string" &&
    typeof candidate.bondOrder === "number"
  );
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

const BOND_ORDERS: Array<{ value: number; glyph: string; label: string }> = [
  { value: 1, glyph: "—", label: "Single bond" },
  { value: 2, glyph: "=", label: "Double bond" },
  { value: 3, glyph: "≡", label: "Triple bond" },
];

export const ToolsTab: React.FC<ToolsTabProps> = ({ app }) => {
  const [activeElement, setActiveElement] = useState<string>("C");
  const [activeBondOrder, setActiveBondOrder] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  useEffect(() => {
    if (!app) return;

    const updateState = () => {
      const mode = app.mode;
      if (isEditModeState(mode)) {
        setIsEditMode(true);
        setActiveElement(mode.element);
        setActiveBondOrder(mode.bondOrder);
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
    if (isEditModeState(mode)) {
      if (updates.element) {
        mode.element = updates.element;
        setActiveElement(updates.element);
      }
      if (updates.bondOrder) {
        mode.bondOrder = updates.bondOrder;
        setActiveBondOrder(updates.bondOrder);
      }
    }
  };

  if (!app || !isEditMode) return null;

  return (
    <div className="flex flex-col gap-2 p-2 pointer-events-auto">
      {/* Element */}
      <div className="flex items-center gap-1.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground shrink-0"
          title="Active element"
        >
          <Atom className="h-3.5 w-3.5" />
        </div>
        <Select
          value={activeElement}
          onValueChange={(val) => updateEditMode({ element: val })}
        >
          <SelectTrigger
            className="h-7 flex-1 min-w-0 px-2 text-xs"
            title="Active element"
            aria-label="Active element"
          >
            <SelectValue placeholder="C" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_ELEMENTS.map((el) => (
              <SelectItem key={el} value={el}>
                <span className="font-mono font-medium tabular-nums">{el}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bond order */}
      <div className="flex items-center gap-1.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground shrink-0"
          title="Bond order"
        >
          <Link2 className="h-3.5 w-3.5" />
        </div>
        <div className="grid grid-cols-3 gap-1 flex-1">
          {BOND_ORDERS.map(({ value, glyph, label }) => {
            const active = activeBondOrder === value;
            return (
              <Button
                key={value}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 px-0 font-mono text-base leading-none",
                  active && "ring-1 ring-ring",
                )}
                onClick={() => updateEditMode({ bondOrder: value })}
                title={label}
                aria-label={label}
                aria-pressed={active}
              >
                {glyph}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
