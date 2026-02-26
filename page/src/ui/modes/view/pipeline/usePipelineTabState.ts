import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  HideSelectionModifier,
  type Modifier,
  type Molvis,
  PipelineEvents,
  parseSelectionKey,
} from "@molvis/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";

const DEFAULT_PROPERTIES_HEIGHT = 250;
const MIN_PROPERTIES_HEIGHT = 100;
const MAX_PROPERTIES_RATIO = 0.8;

interface PipelineState {
  modifiers: Modifier[];
  selectedId: string | null;
  selectedModifier: Modifier | undefined;
  propertiesHeight: number;
  isResizing: boolean;
  setSelectedId: (id: string | null) => void;
  startResizing: (event: React.MouseEvent) => void;
  handleAddModifier: (factory: () => Modifier) => void;
  handleRemoveModifier: (id: string) => void;
  handleToggleModifier: (modifier: Modifier) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  refreshModifiers: () => void;
}

function getSelectedAtomIndices(app: Molvis): number[] {
  const atomIndices = new Set<number>();
  const selection = app.world.selectionManager.getState();
  for (const key of selection.atoms) {
    const ref = parseSelectionKey(key);
    if (!ref) {
      continue;
    }
    const meta = app.world.sceneIndex.getMeta(ref.meshId, ref.subIndex);
    if (meta?.type !== "atom") {
      continue;
    }
    atomIndices.add(meta.atomId);
  }
  return [...atomIndices];
}

export function usePipelineTabState(app: Molvis | null): PipelineState {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [propertiesHeight, setPropertiesHeight] = useState(
    DEFAULT_PROPERTIES_HEIGHT,
  );
  const [isResizing, setIsResizing] = useState(false);

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
    pipeline.on(PipelineEvents.PIPELINE_CLEARED, refreshModifiers);

    return () => {
      pipeline.off(PipelineEvents.MODIFIER_ADDED, refreshModifiers);
      pipeline.off(PipelineEvents.MODIFIER_REMOVED, refreshModifiers);
      pipeline.off(PipelineEvents.MODIFIER_REORDERED, refreshModifiers);
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
  }, [modifiers, selectedId]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextHeight = window.innerHeight - event.clientY;
      const clampedHeight = Math.max(
        MIN_PROPERTIES_HEIGHT,
        Math.min(nextHeight, window.innerHeight * MAX_PROPERTIES_RATIO),
      );
      setPropertiesHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = useCallback((event: React.MouseEvent) => {
    setIsResizing(true);
    event.preventDefault();
  }, []);

  const handleAddModifier = useCallback(
    (factory: () => Modifier) => {
      if (!app) {
        return;
      }

      const pipeline = app.modifierPipeline;
      const modifier = factory();

      if (modifier instanceof HideSelectionModifier) {
        const selectedAtomIndices = getSelectedAtomIndices(app);
        if (selectedAtomIndices.length > 0) {
          modifier.hideIndices(selectedAtomIndices);
          app.world.selectionManager.clearSelection();
        }
      }

      pipeline.addModifier(modifier);
      setSelectedId(modifier.id);
      void app.applyPipeline({ fullRebuild: true });
    },
    [app],
  );

  const handleRemoveModifier = useCallback(
    (id: string) => {
      if (!app) {
        return;
      }
      app.modifierPipeline.removeModifier(id);
      setSelectedId((prevSelectedId) =>
        prevSelectedId === id ? null : prevSelectedId,
      );
      void app.applyPipeline({ fullRebuild: true });
    },
    [app],
  );

  const handleToggleModifier = useCallback(
    (modifier: Modifier) => {
      modifier.enabled = !modifier.enabled;
      setModifiers((current) => [...current]);
      if (!app) {
        return;
      }
      void app.applyPipeline({ fullRebuild: true });
    },
    [app],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!app || !over || active.id === over.id) {
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

      setModifiers((current) => arrayMove(current, oldIndex, newIndex));
      app.modifierPipeline.reorderModifier(active.id as string, newIndex);
      void app.applyPipeline({ fullRebuild: true });
    },
    [app, modifiers],
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
    isResizing,
    setSelectedId,
    startResizing,
    handleAddModifier,
    handleRemoveModifier,
    handleToggleModifier,
    handleDragEnd,
    refreshModifiers,
  };
}
