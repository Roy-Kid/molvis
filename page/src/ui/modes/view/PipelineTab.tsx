import type { Molvis } from "@molvis/stage";
import type React from "react";
import { DeleteConfirmDialog } from "./pipeline/DeleteConfirmDialog";
import { PipelineList } from "./pipeline/PipelineList";
import { PipelinePropertiesPane } from "./pipeline/PipelinePropertiesPane";
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
    propertiesMaxHeight,
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
  } = usePipelineTabState(app);

  return (
    <fieldset
      disabled={!app || pipelineRunning}
      aria-busy={pipelineRunning}
      className="m-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-0 p-0"
    >
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
        propertiesMaxHeight={propertiesMaxHeight}
        isResizing={isResizing}
        onResizeStart={startResizing}
        onResizeBy={resizePropertiesBy}
        onUpdate={refreshModifiers}
      />

      {pendingDelete && (
        <DeleteConfirmDialog
          open={true}
          modifier={pendingDelete.modifier}
          descendants={pendingDelete.descendants}
          busy={pipelineRunning}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </fieldset>
  );
};
