import type { Molvis } from "@molvis/core";
import type React from "react";
import { DeleteConfirmDialog } from "./pipeline/DeleteConfirmDialog";
import { PipelineList } from "./pipeline/PipelineList";
import { PipelinePropertiesPane } from "./pipeline/PipelinePropertiesPane";
import { SceneSynthesisPanel } from "./pipeline/SceneSynthesisPanel";
import { usePipelineTabState } from "./pipeline/usePipelineTabState";

interface PipelineTabProps {
  app: Molvis | null;
}

export const PipelineTab: React.FC<PipelineTabProps> = ({ app }) => {
  const {
    modifiers,
    selectedId,
    selectedModifier,
    propertiesHeight,
    isResizing,
    expandedIds,
    pendingDelete,
    setSelectedId,
    startResizing,
    handleAddModifier,
    handleRemoveModifier,
    handleToggleModifier,
    handleDragEnd,
    handleToggleExpand,
    handleConfirmDelete,
    handleCancelDelete,
    refreshModifiers,
  } = usePipelineTabState(app);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SceneSynthesisPanel
        app={app}
        modifiers={modifiers}
        onUpdate={refreshModifiers}
      />

      <PipelineList
        app={app}
        modifiers={modifiers}
        selectedId={selectedId}
        expandedIds={expandedIds}
        onSelectModifier={setSelectedId}
        onToggleModifier={handleToggleModifier}
        onRemoveModifier={handleRemoveModifier}
        onAddModifier={handleAddModifier}
        onDragEnd={handleDragEnd}
        onToggleExpand={handleToggleExpand}
      />

      <PipelinePropertiesPane
        app={app}
        selectedModifier={selectedModifier}
        allModifiers={modifiers}
        propertiesHeight={propertiesHeight}
        isResizing={isResizing}
        onResizeStart={startResizing}
        onUpdate={refreshModifiers}
      />

      {pendingDelete && (
        <DeleteConfirmDialog
          open={true}
          modifier={pendingDelete.modifier}
          descendants={pendingDelete.descendants}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};
