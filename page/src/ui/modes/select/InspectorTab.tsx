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
import { cn } from "@/lib/utils";
import {
  type Molvis,
  type SelectionState,
  parseSelectionKey,
} from "@molvis/core";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { SelectionSnapshot } from "./useSelectionSnapshot";

interface InspectorTabProps {
  app: Molvis | null;
  compact?: boolean;
  /** If provided, skips internal subscription and uses parent snapshot. */
  snapshot?: SelectionSnapshot;
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

export const InspectorTab: React.FC<InspectorTabProps> = ({
  app,
  compact = false,
  snapshot: externalSnapshot,
}) => {
  // Use external snapshot if provided; otherwise maintain own subscription
  const [internalSelection, setInternalSelection] = useState<SelectionState>({
    atoms: new Set(),
    bonds: new Set(),
  });
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    // Skip internal subscription when snapshot is provided by parent
    if (externalSnapshot || !app) return;

    const manager = app.world.selectionManager;
    if (!manager) return;

    const state = manager.getState();
    setInternalSelection(state);

    const handler = (state: SelectionState) => {
      setInternalSelection({
        atoms: new Set(state.atoms),
        bonds: new Set(state.bonds),
      });
    };

    return manager.on("selection-change", handler);
  }, [app, externalSnapshot]);

  // Derive effective selection: from external snapshot or internal state
  const selection = React.useMemo<SelectionState>(() => {
    if (externalSnapshot) {
      // Reconstruct SelectionState-like object from snapshot's atomIds
      // For display purposes we only need atom count / bond count
      return {
        atoms: new Set(
          externalSnapshot.atomIds.map((id) => {
            const key = app?.world.sceneIndex.getSelectionKeyForAtom(id);
            return key ?? String(id);
          }),
        ),
        bonds: new Set<string>(),
      };
    }
    return internalSelection;
  }, [externalSnapshot, internalSelection, app]);

  const atomIds = React.useMemo(() => {
    if (externalSnapshot) return externalSnapshot.atomIds;
    if (!app) return [];
    const ids = new Set<number>();
    for (const key of selection.atoms) {
      const ref = parseSelectionKey(key);
      if (!ref) continue;
      const meta = app.world.sceneIndex.getMeta(ref.meshId, ref.subIndex);
      if (meta?.type === "atom") {
        ids.add(meta.atomId);
      }
    }
    return [...ids];
  }, [selection, app, externalSnapshot]);

  const attributes = React.useMemo(() => {
    if (!app || atomIds.length === 0) return {};

    const attrs: Record<string, { value: unknown; mixed: boolean }> = {};
    const allKeys = new Set<string>();

    allKeys.add("element");
    for (const id of atomIds) {
      const registry = app.world.sceneIndex.metaRegistry;
      const edit = registry?.atoms.edits.get(id);
      if (!edit) continue;
      for (const key of Object.keys(edit)) {
        if (key !== "type" && key !== "atomId" && key !== "position") {
          allKeys.add(key);
        }
      }
    }

    for (const key of allKeys) {
      let commonValue: unknown = undefined;
      let mixed = false;

      const first = app.world.sceneIndex.getAttribute("atom", atomIds[0], key);
      for (let i = 1; i < atomIds.length; i++) {
        if (
          app.world.sceneIndex.getAttribute("atom", atomIds[i], key) !== first
        ) {
          mixed = true;
          break;
        }
      }
      commonValue = first;

      attrs[key] = {
        value: mixed ? undefined : commonValue,
        mixed,
      };
    }

    return attrs;
  }, [atomIds, app]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const [key, info] of Object.entries(attributes)) {
      nextDrafts[key] =
        info.mixed || info.value === undefined || info.value === null
          ? ""
          : String(info.value);
    }
    setDraftValues(nextDrafts);
  }, [attributes]);

  const handleUpdate = (key: string, value: string) => {
    if (!app || atomIds.length === 0) return;

    let finalValue: unknown = value;
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== "") {
      finalValue = numeric;
    }

    app.execute("set_attribute", {
      type: "atom",
      ids: atomIds,
      key,
      value: finalValue,
    });

    setSelection((prev) => ({
      atoms: new Set(prev.atoms),
      bonds: new Set(prev.bonds),
    }));
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    handleUpdate(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  const commitAttribute = (
    key: string,
    info: { value: unknown; mixed: boolean },
  ) => {
    const next = draftValues[key] ?? "";
    const prev =
      info.mixed || info.value === undefined || info.value === null
        ? ""
        : String(info.value);
    if (next === prev) return;
    handleUpdate(key, next);
  };

  if (selection.atoms.size === 0 && selection.bonds.size === 0) {
    return (
      <div
        className={cn(
          "rounded border bg-muted/10 text-muted-foreground text-center",
          compact ? "p-2 text-[11px]" : "p-4 text-sm",
        )}
      >
        No selection. Select atoms to inspect and edit attributes.
      </div>
    );
  }

  const content = (
    <div className={cn("space-y-3", compact ? "p-0" : "p-4")}>
      <div className="rounded border bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground">
        {selection.atoms.size} atom{selection.atoms.size !== 1 ? "s" : ""},{" "}
        {selection.bonds.size} bond{selection.bonds.size !== 1 ? "s" : ""}
      </div>

      {atomIds.length > 0 && (
        <div className="space-y-2">
          <div className="grid gap-2">
            {Object.entries(attributes).map(([key, info]) => {
              const isElement = key === "element";
              return (
                <div
                  key={key}
                  className="grid grid-cols-[78px_1fr] items-center gap-2"
                >
                  <Label
                    className={cn(
                      "text-[11px] truncate text-muted-foreground",
                      isElement && "text-foreground font-semibold",
                    )}
                    title={key}
                  >
                    {key}
                  </Label>

                  {isElement ? (
                    <Select
                      value={info.mixed ? "" : (info.value as string)}
                      onValueChange={(value) => handleUpdate(key, value)}
                    >
                      <SelectTrigger className="h-7 text-xs w-full" size="sm">
                        <SelectValue
                          placeholder={
                            info.mixed ? "<multiple>" : "Select element"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_ELEMENTS.map((element) => (
                          <SelectItem
                            key={element}
                            value={element}
                            className="text-xs"
                          >
                            {element}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-7 text-xs font-mono bg-transparent"
                      value={draftValues[key] ?? ""}
                      placeholder={info.mixed ? "<mixed>" : "Value"}
                      onChange={(event) =>
                        setDraftValues((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                      onBlur={() => commitAttribute(key, info)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitAttribute(key, info);
                          (event.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded border bg-background px-1.5 py-1 flex items-center gap-1">
            <Input
              className="h-6 text-[11px] border-0 shadow-none focus-visible:ring-0 px-1.5"
              placeholder="property"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
            />
            <Input
              className="h-6 text-[11px] border-0 shadow-none focus-visible:ring-0 px-1.5"
              placeholder="value"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAdd();
                }
              }}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleAdd}
              disabled={!newKey.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return <ScrollArea className="h-full">{content}</ScrollArea>;
};
