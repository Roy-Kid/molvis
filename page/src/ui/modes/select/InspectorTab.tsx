import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  type Molvis,
  type SelectionState,
  parseSelectionKey,
} from "@molvis/core";
import React, { useEffect, useMemo, useState } from "react";
import type { SelectionSnapshot } from "./useSelectionSnapshot";

interface InspectorTabProps {
  app: Molvis | null;
  compact?: boolean;
  snapshot?: SelectionSnapshot;
}

interface AttributeRow {
  atomId: number;
  element: string;
  x: string;
  y: string;
  z: string;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "—";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  return String(value);
}

export const InspectorTab: React.FC<InspectorTabProps> = ({
  app,
  compact = false,
  snapshot: externalSnapshot,
}) => {
  const [internalSelection, setInternalSelection] = useState<SelectionState>({
    atoms: new Set(),
    bonds: new Set(),
  });

  useEffect(() => {
    if (externalSnapshot || !app) return;

    const manager = app.world.selectionManager;
    const handler = (state: SelectionState) => {
      setInternalSelection({
        atoms: new Set(state.atoms),
        bonds: new Set(state.bonds),
      });
    };

    handler(manager.getState());
    return manager.on("selection-change", handler);
  }, [app, externalSnapshot]);

  const selection = useMemo<SelectionState>(() => {
    if (externalSnapshot) {
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

  const atomIds = useMemo(() => {
    if (!app) {
      return [];
    }

    const ids = new Set<number>();
    for (const key of selection.atoms) {
      const ref = parseSelectionKey(key);
      if (!ref) continue;
      const meta = app.world.sceneIndex.getMeta(ref.meshId, ref.subIndex);
      if (meta?.type === "atom") {
        ids.add(meta.atomId);
      }
    }

    return [...ids].sort((a, b) => a - b);
  }, [selection, app]);

  const rows = useMemo<AttributeRow[]>(() => {
    if (!app || atomIds.length === 0) {
      return [];
    }

    return atomIds.map((atomId) => ({
      atomId,
      element: formatValue(
        app.world.sceneIndex.getAttribute("atom", atomId, "element"),
      ),
      x: formatValue(app.world.sceneIndex.getAttribute("atom", atomId, "x")),
      y: formatValue(app.world.sceneIndex.getAttribute("atom", atomId, "y")),
      z: formatValue(app.world.sceneIndex.getAttribute("atom", atomId, "z")),
    }));
  }, [app, atomIds]);

  if (selection.atoms.size === 0 && selection.bonds.size === 0) {
    return (
      <div
        className={cn(
          "rounded border bg-muted/10 text-center text-muted-foreground",
          compact ? "p-2 text-[11px] leading-4" : "p-4 text-sm",
        )}
      >
        No selection.
      </div>
    );
  }

  const content = (
    <div className={cn("space-y-2", compact ? "p-0" : "p-4")}>
      <div className="flex items-center justify-between rounded border bg-muted/10 px-2 py-1 text-[10px] text-muted-foreground">
        <span>
          {selection.atoms.size} atom{selection.atoms.size !== 1 ? "s" : ""} /{" "}
          {selection.bonds.size} bond{selection.bonds.size !== 1 ? "s" : ""}
        </span>
        {rows.length > 0 && (
          <span className="font-mono">
            {rows[0].atomId}
            {rows.length > 1 ? ` … ${rows[rows.length - 1].atomId}` : ""}
          </span>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="rounded border bg-background">
          <div className="grid grid-cols-[54px_40px_1fr] gap-2 border-b px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <div>Atom</div>
            <div>El</div>
            <div className="font-mono">x y z</div>
          </div>
          <div className="divide-y">
            {rows.map((row) => (
              <div
                key={row.atomId}
                className="grid grid-cols-[54px_40px_1fr] items-center gap-2 px-2 py-1.5"
              >
                <div
                  className="truncate font-mono text-[11px] text-muted-foreground"
                  title={String(row.atomId)}
                >
                  #{row.atomId}
                </div>
                <div
                  className="truncate text-[11px] font-semibold text-foreground"
                  title={row.element}
                >
                  {row.element}
                </div>
                <div
                  className="truncate font-mono text-[11px] text-foreground"
                  title={`${row.x} ${row.y} ${row.z}`}
                >
                  {row.x} {row.y} {row.z}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded border bg-muted/10 px-2 py-1.5 text-[11px] text-muted-foreground">
          Bond metadata is not listed here yet.
        </div>
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return <ScrollArea className="h-full">{content}</ScrollArea>;
};
