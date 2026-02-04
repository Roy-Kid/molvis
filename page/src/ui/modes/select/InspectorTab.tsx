import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  type Molvis,
  type SelectionState,
  parseSelectionKey,
} from "@molvis/core";
import { Plus, Trash2, X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface InspectorTabProps {
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

export const InspectorTab: React.FC<InspectorTabProps> = ({ app }) => {
  const [selection, setSelection] = useState<SelectionState>({
    atoms: new Set(),
    bonds: new Set(),
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // New Attribute Inputs
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (!app) return;

    const manager = (app as any).world?.selectionManager;
    if (!manager) return;

    // Initial state
    setSelection({ ...manager.getState() });

    // Subscribe
    const handler = (state: SelectionState) => {
      setSelection({
        atoms: new Set(state.atoms),
        bonds: new Set(state.bonds),
      });
    };

    manager.on(handler);
    return () => {
      manager.off?.(handler);
    };
  }, [app]);

  // Derived Selection Data
  const atomIds = React.useMemo(() => {
    if (!app) return [];
    const ids: number[] = [];
    selection.atoms.forEach((key) => {
      const ref = parseSelectionKey(key);
      // Verify it's an atom from primary scene (mesh 0 for now)
      if (ref) {
        const meta = app.world.sceneIndex.getMeta(ref.meshId, ref.subIndex);
        if (meta && meta.type === "atom") {
          ids.push(meta.atomId);
        }
      }
    });
    return ids;
  }, [selection, app]);

  // Collect Attributes
  const attributes = React.useMemo(() => {
    if (!app || atomIds.length === 0) return {};

    const attrs: Record<string, { value: any; mixed: boolean }> = {};
    const allKeys = new Set<string>();

    // 1. Gather keys
    allKeys.add("element"); // Always show
    atomIds.forEach((id) => {
      const registry = app.world.sceneIndex.metaRegistry;
      if (registry) {
        const edit = registry.atoms.edits.get(id);
        if (edit) {
          Object.keys(edit).forEach((k) => {
            if (k !== "type" && k !== "atomId" && k !== "position")
              allKeys.add(k);
          });
        }
      }
    });

    // 2. Determine values
    allKeys.forEach((key) => {
      let commonVal: any = undefined;
      const first = true;
      let mixed = false;

      // Re-verify mixed status properly
      if (atomIds.length > 0) {
        const val0 = app.world.sceneIndex.getAttribute("atom", atomIds[0], key);
        for (let i = 1; i < atomIds.length; i++) {
          if (
            app.world.sceneIndex.getAttribute("atom", atomIds[i], key) !== val0
          ) {
            mixed = true;
            break;
          }
        }
        commonVal = val0;
      }

      attrs[key] = {
        value: mixed ? undefined : commonVal,
        mixed,
      };
    });

    return attrs;
  }, [atomIds, app, refreshTrigger]);

  const handleUpdate = (key: string, value: string) => {
    if (!app) return;

    // Auto convert number if it looks like one
    let finalVal: any = value;
    const num = Number(value);
    if (!Number.isNaN(num) && value.trim() !== "") {
      finalVal = num;
    }

    app.execute("set_attribute", {
      type: "atom",
      ids: atomIds,
      key,
      value: finalVal,
    });

    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    handleUpdate(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  if (selection.atoms.size === 0 && selection.bonds.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center select-none">
        <div className="mb-2 rounded-full bg-muted/20 p-3">
          <svg
            className=" w-6 h-6 text-muted-foreground/50"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </div>
        <p>No selection</p>
        <p className="text-xs mt-1 opacity-50">Select atoms to inspect</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="text-sm font-semibold leading-none">
              Selection Inspector
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5">
              {selection.atoms.size} atom{selection.atoms.size !== 1 ? "s" : ""}
              , {selection.bonds.size} bond
              {selection.bonds.size !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Attributes List */}
        {atomIds.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(attributes).map(([key, info]) => {
                const isElement = key === "element";

                return (
                  <div
                    key={key}
                    className="grid grid-cols-[80px_1fr] items-center gap-3"
                  >
                    <Label
                      className={cn(
                        "text-xs font-medium truncate text-muted-foreground",
                        isElement && "text-foreground font-semibold",
                      )}
                      title={key}
                    >
                      {key}
                    </Label>

                    {isElement ? (
                      <Select
                        value={info.mixed ? "" : (info.value as string)}
                        onValueChange={(val) => handleUpdate(key, val)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue
                            placeholder={
                              info.mixed ? "<Multiple>" : "Select element"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_ELEMENTS.map((el) => (
                            <SelectItem key={el} value={el} className="text-xs">
                              {el}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="relative group">
                        <Input
                          className="h-8 text-xs font-mono bg-transparent hover:bg-muted/10 focus:bg-background transition-colors pr-7"
                          value={info.mixed ? "" : (info.value ?? "")}
                          placeholder={info.mixed ? "<mixed>" : "Value"}
                          onChange={(e) => handleUpdate(key, e.target.value)}
                        />
                        {/* Optional: delete button for custom attributes could go here */}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compact Add Attribute */}
        {atomIds.length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-3 px-1">
              Add Property
            </div>
            <div className="flex items-center gap-2 bg-muted/10 p-1.5 rounded-md border border-transparent focus-within:border-ring/20 focus-within:bg-muted/20 transition-all">
              <Input
                className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 min-w-0"
                placeholder="Name"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <div className="w-[1px] h-4 bg-border shrink-0" />
              <Input
                className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 min-w-0"
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 hover:bg-primary hover:text-primary-foreground rounded-sm"
                onClick={handleAdd}
                disabled={!newKey.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
