import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  DataSourceModifier,
  isSelectionProducer,
  isTopologyChanging,
  type Modifier,
  ModifierCapability,
  type Molvis,
  nextModifierId,
  PipelineEvents,
  SelectModifier,
} from "@molvis/stage";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePipelineOperation } from "@/components/viewer/PipelineOperationProvider";
import { modifierUsesLeftConfig } from "@/plugins";
import { useLeftShellOptional } from "@/ui/layout/LeftShellContext";
import { getSelectedAtomIndices } from "../modifiers/selectionUtils";
import { getDescendants } from "./tree_utils";

const DEFAULT_PROPERTIES_HEIGHT = 250;
const MIN_PROPERTIES_HEIGHT = 100;
const MAX_PROPERTIES_RATIO = 0.8;

interface PendingDelete {
  modifier: Modifier;
  descendants: Modifier[];
}

interface PipelineState {
  modifiers: Modifier[];
  selectedId: string | null;
  selectedModifier: Modifier | undefined;
  propertiesHeight: number;
  propertiesMaxHeight: number;
  isResizing: boolean;
  expandedIds: Set<string>;
  pendingDelete: PendingDelete | null;
  pipelineRunning: boolean;
  setSelectedId: (id: string | null) => void;
  startResizing: (event: React.PointerEvent) => void;
  resizePropertiesBy: (delta: number) => void;
  handleAddModifier: (factory: () => Modifier) => void;
  handleRemoveModifier: (id: string) => void;
  handleToggleModifier: (modifier: Modifier) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleToggleExpand: (id: string) => void;
  handleConfirmDelete: () => void;
  handleCancelDelete: () => void;
  refreshModifiers: () => void;
}

const ADD_COPY = {
  running: "Adding the pipeline step…",
  success: "Pipeline step added",
  error: "Could not add the pipeline step",
};

const REMOVE_COPY = {
  running: "Removing the pipeline step…",
  success: "Pipeline step removed",
  error: "Could not remove the pipeline step",
};

const UPDATE_COPY = {
  running: "Recomputing the pipeline…",
  success: "Pipeline updated",
  error: "Could not recompute the pipeline",
};

const REORDER_COPY = {
  running: "Reordering the pipeline…",
  success: "Pipeline reordered",
  error: "Could not reorder the pipeline",
};

export function usePipelineTabState(app: Molvis | null): PipelineState {
  const { run, running: pipelineRunning } = usePipelineOperation();
  const leftShell = useLeftShellOptional();
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSelectedIdState(id);
      if (!id || !app || !leftShell) return;
      const mod = app.modifierPipeline.getModifiers().find((m) => m.id === id);
      if (mod && modifierUsesLeftConfig(mod)) {
        leftShell.openLeftForModifier(id);
      }
    },
    [app, leftShell],
  );
  const [propertiesHeight, setPropertiesHeight] = useState(
    DEFAULT_PROPERTIES_HEIGHT,
  );
  const [isResizing, setIsResizing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );

  const refreshModifiers = useCallback(() => {
    if (!app) {
      setModifiers([]);
      return;
    }
    setModifiers([...app.modifierPipeline.getModifiers()]);
  }, [app]);

  useEffect(() => {
    if (!app) {
      return;
    }

    refreshModifiers();

    const pipeline = app.modifierPipeline;
    pipeline.on(PipelineEvents.MODIFIER_ADDED, refreshModifiers);
    pipeline.on(PipelineEvents.MODIFIER_REMOVED, refreshModifiers);
    pipeline.on(PipelineEvents.MODIFIER_REORDERED, refreshModifiers);
    pipeline.on(PipelineEvents.MODIFIER_SCOPE_CHANGED, refreshModifiers);
    pipeline.on(PipelineEvents.MODIFIER_OWNER_CHANGED, refreshModifiers);
    pipeline.on(PipelineEvents.PIPELINE_CLEARED, refreshModifiers);

    return () => {
      pipeline.off(PipelineEvents.MODIFIER_ADDED, refreshModifiers);
      pipeline.off(PipelineEvents.MODIFIER_REMOVED, refreshModifiers);
      pipeline.off(PipelineEvents.MODIFIER_REORDERED, refreshModifiers);
      pipeline.off(PipelineEvents.MODIFIER_SCOPE_CHANGED, refreshModifiers);
      pipeline.off(PipelineEvents.MODIFIER_OWNER_CHANGED, refreshModifiers);
      pipeline.off(PipelineEvents.PIPELINE_CLEARED, refreshModifiers);
    };
  }, [app, refreshModifiers]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (!modifiers.some((modifier) => modifier.id === selectedId)) {
      setSelectedId(null);
    }
  }, [modifiers, selectedId, setSelectedId]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextHeight = window.innerHeight - event.clientY;
      const clampedHeight = Math.max(
        MIN_PROPERTIES_HEIGHT,
        Math.min(nextHeight, window.innerHeight * MAX_PROPERTIES_RATIO),
      );
      setPropertiesHeight(clampedHeight);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isResizing]);

  const startResizing = useCallback((event: React.PointerEvent) => {
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const resizePropertiesBy = useCallback((delta: number) => {
    setPropertiesHeight((current) =>
      Math.max(
        MIN_PROPERTIES_HEIGHT,
        Math.min(current + delta, window.innerHeight * MAX_PROPERTIES_RATIO),
      ),
    );
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAddModifier = useCallback(
    (factory: () => Modifier) => {
      if (!app || pipelineRunning) {
        return;
      }

      const pipeline = app.modifierPipeline;
      const modifier = factory();

      const consumesSelection = modifier.capabilities.has(
        ModifierCapability.ConsumesSelection,
      );
      const isSelProducer = isSelectionProducer(modifier);
      const isTopChange = isTopologyChanging(modifier);

      // For selection-consuming, non-producer, non-topology modifiers:
      // attach to an existing SelectModifier if one exists, otherwise auto-create
      if (consumesSelection && !isSelProducer && !isTopChange) {
        // Find the last selection-producing modifier in the pipeline
        const existingScope = [...pipeline.getModifiers()]
          .reverse()
          .find((m) => isSelectionProducer(m));

        if (existingScope) {
          // Reuse existing SelectModifier as selection scope.
          modifier.selectionScopeId = existingScope.id;
          setExpandedIds((prev) => new Set([...prev, existingScope.id]));
        } else {
          // No select modifier exists — auto-create one from current selection
          const selectedAtomIndices = getSelectedAtomIndices(app);
          if (selectedAtomIndices.length > 0) {
            const selectMod = new SelectModifier(
              nextModifierId("select"),
              selectedAtomIndices,
              "replace",
              [],
            );
            selectMod.highlight = false;
            pipeline.addModifier(selectMod);
            modifier.selectionScopeId = selectMod.id;
            setExpandedIds((prev) => new Set([...prev, selectMod.id]));
          }
        }
      }

      pipeline.addModifier(modifier);
      setSelectedId(modifier.id);
      // setSelectedId already opens left config when applicable
      void run(() => app.applyPipeline({ fullRebuild: true }), ADD_COPY);
    },
    [app, pipelineRunning, run, setSelectedId],
  );

  const handleRemoveModifier = useCallback(
    (id: string) => {
      if (!app || pipelineRunning) {
        return;
      }
      const mod = modifiers.find((m) => m.id === id);
      if (!mod) {
        return;
      }

      const descendants = getDescendants(id, modifiers);
      if (descendants.length > 0) {
        setPendingDelete({ modifier: mod, descendants });
        return;
      }

      // DataSources need the lifecycle path (dispose WASM, re-derive
      // system trajectory). Plain modifiers go straight through pipeline.
      if (mod instanceof DataSourceModifier) {
        void run(() => app.removeDataSource(id), REMOVE_COPY);
      } else {
        app.modifierPipeline.removeModifier(id);
        void run(() => app.applyPipeline({ fullRebuild: true }), REMOVE_COPY);
      }
      setSelectedIdState((prev) => (prev === id ? null : prev));
    },
    [app, modifiers, pipelineRunning, run],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!app || !pendingDelete || pipelineRunning) {
      return;
    }
    const target = pendingDelete.modifier;
    if (target instanceof DataSourceModifier) {
      void run(() => app.removeDataSource(target.id), REMOVE_COPY);
    } else {
      app.modifierPipeline.removeModifier(target.id);
      void run(() => app.applyPipeline({ fullRebuild: true }), REMOVE_COPY);
    }
    setSelectedId(null);
    setPendingDelete(null);
  }, [app, pendingDelete, pipelineRunning, run, setSelectedId]);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const handleToggleModifier = useCallback(
    (modifier: Modifier) => {
      if (pipelineRunning) return;
      modifier.enabled = !modifier.enabled;
      setModifiers((current) => [...current]);
      if (!app) {
        return;
      }
      void run(() => app.applyPipeline({ fullRebuild: true }), UPDATE_COPY);
    },
    [app, pipelineRunning, run],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!app || pipelineRunning || !over || active.id === over.id) {
        return;
      }

      const oldIndex = modifiers.findIndex(
        (modifier) => modifier.id === active.id,
      );
      const newIndex = modifiers.findIndex(
        (modifier) => modifier.id === over.id,
      );

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const activeModifier = modifiers[oldIndex];
      const overModifier = modifiers[newIndex];
      const activeIsSource = activeModifier instanceof DataSourceModifier;
      const overIsSource = overModifier instanceof DataSourceModifier;
      if (activeIsSource !== overIsSource) return;

      setModifiers((current) => arrayMove(current, oldIndex, newIndex));
      app.modifierPipeline.reorderModifier(active.id as string, newIndex);
      void run(() => app.applyPipeline({ fullRebuild: true }), REORDER_COPY);
    },
    [app, modifiers, pipelineRunning, run],
  );

  const selectedModifier = useMemo(
    () => modifiers.find((modifier) => modifier.id === selectedId),
    [modifiers, selectedId],
  );

  return {
    modifiers,
    selectedId,
    selectedModifier,
    propertiesHeight,
    propertiesMaxHeight: window.innerHeight * MAX_PROPERTIES_RATIO,
    isResizing,
    expandedIds,
    pendingDelete,
    pipelineRunning,
    setSelectedId,
    startResizing,
    resizePropertiesBy,
    handleAddModifier,
    handleRemoveModifier,
    handleToggleModifier,
    handleDragEnd,
    handleToggleExpand,
    handleConfirmDelete,
    handleCancelDelete,
    refreshModifiers,
  };
}
