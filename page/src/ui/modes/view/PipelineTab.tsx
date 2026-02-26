import type { Molvis } from "@molvis/core";
import type React from "react";
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
    isResizing,
    setSelectedId,
    startResizing,
    handleAddModifier,
    handleRemoveModifier,
    handleToggleModifier,
    handleDragEnd,
    refreshModifiers,
  } = usePipelineTabState(app);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PipelineList
        modifiers={modifiers}
        selectedId={selectedId}
        onSelectModifier={setSelectedId}
        onToggleModifier={handleToggleModifier}
        onRemoveModifier={handleRemoveModifier}
        onAddModifier={handleAddModifier}
        onDragEnd={handleDragEnd}
      />

      <PipelinePropertiesPane
        app={app}
        selectedModifier={selectedModifier}
        propertiesHeight={propertiesHeight}
        isResizing={isResizing}
        onResizeStart={startResizing}
        onUpdate={refreshModifiers}
      />
    </div>
  );
};
