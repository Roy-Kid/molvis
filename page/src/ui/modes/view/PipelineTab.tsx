import React, { useEffect, useState } from 'react';
import { Molvis, ModifierPipeline, PipelineEvents, ModifierRegistry, type Modifier } from '@molvis/core';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { ModifierProperties } from "./ModifierProperties";

import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PipelineTabProps {
  app: Molvis | null;
}

// Sortable Item Component
interface SortableItemProps {
  modifier: Modifier;
  selected: boolean;
  onSelect: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onRemove: (e: React.MouseEvent) => void;
}

const SortableModifierItem = ({ modifier, selected, onSelect, onToggle, onRemove }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: modifier.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 border-b last:border-0 text-sm select-none ${selected ? 'bg-accent/80' : 'bg-background hover:bg-accent/30'} ${isDragging ? 'opacity-50' : ''}`}
      onClick={onSelect}
      {...attributes}
    >
      <div {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
         <GripVertical className="h-4 w-4" />
      </div>
      
      <div className="flex items-center justify-center">
         <Checkbox 
            checked={modifier.enabled} 
            onCheckedChange={(_checked) => {
                // We handle toggle externally to avoid event bubbling issues
            }}
            onClick={(e) => {
                e.stopPropagation(); // prevent selection
                onToggle(e);
            }}
         />
      </div>

      <span className="flex-1 font-medium truncate cursor-default">
        {modifier.name}
      </span>

      <div className="flex items-center gap-1">
        {modifier.name !== 'Data Source' && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(e);
                }}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        )}
      </div>
    </div>
  );
};

export const PipelineTab: React.FC<PipelineTabProps> = ({ app }) => {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Resize state
  const [propertiesHeight, setPropertiesHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = React.useCallback((e: React.MouseEvent) => {
      setIsResizing(true);
      e.preventDefault();
  }, []);

  useEffect(() => {
      if (!isResizing) return;

      const handleMouseMove = (e: MouseEvent) => {
          // Calculate new height based on mouse position from bottom of window
          const newHeight = window.innerHeight - e.clientY;
          // Clamp height (min 100px, max 80% of window)
          const clamped = Math.max(100, Math.min(newHeight, window.innerHeight * 0.8));
          setPropertiesHeight(clamped);
      };

      const handleMouseUp = () => {
          setIsResizing(false);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizing]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync with pipeline state
  useEffect(() => {
    if (!app) return;
    
    const pipeline = (app as any).modifierPipeline as ModifierPipeline;
    if (!pipeline) return;

    const updateModifiers = () => {
      setModifiers([...pipeline.getModifiers()]);
    };

    updateModifiers();

    const onUpdate = () => updateModifiers();
    pipeline.on(PipelineEvents.MODIFIER_ADDED, onUpdate);
    pipeline.on(PipelineEvents.MODIFIER_REMOVED, onUpdate);
    pipeline.on(PipelineEvents.MODIFIER_REORDERED, onUpdate);
    pipeline.on(PipelineEvents.PIPELINE_CLEARED, onUpdate);
    // Also listen to COMPUTED if we want to redraw? pipeline emits computed after run.
    
    return () => {
      pipeline.off(PipelineEvents.MODIFIER_ADDED, onUpdate);
      pipeline.off(PipelineEvents.MODIFIER_REMOVED, onUpdate);
      pipeline.off(PipelineEvents.MODIFIER_REORDERED, onUpdate);
      pipeline.off(PipelineEvents.PIPELINE_CLEARED, onUpdate);
    };
  }, [app]);

  const handleAddModifier = (factory: () => Modifier) => {
    if (!app) return;
    const pipeline = (app as any).modifierPipeline as ModifierPipeline;
    const modifier = factory();
    pipeline.addModifier(modifier);
    setSelectedId(modifier.id);
  };

  const handleRemoveModifier = (id: string, _e: React.MouseEvent) => {
    if (!app) return;
    const pipeline = (app as any).modifierPipeline as ModifierPipeline;
    pipeline.removeModifier(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleToggleModifier = (modifier: Modifier, _e: React.MouseEvent) => {
    modifier.enabled = !modifier.enabled;
    setModifiers([...modifiers]); // Force local update
    // Trigger re-render of scene if needed?
    // App should observe pipeline changes. 
    // Ideally modification triggers pipeline re-run.
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      if (!app) return;
      const pipeline = (app as any).modifierPipeline as ModifierPipeline;
      
      const oldIndex = modifiers.findIndex(m => m.id === active.id);
      const newIndex = modifiers.findIndex(m => m.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
          // Optimistic UI update
          setModifiers((items) => arrayMove(items, oldIndex, newIndex));
          // Perform actual move
          pipeline.reorderModifier(active.id as string, newIndex);
      }
    }
  };

  const selectedModifier = modifiers.find(m => m.id === selectedId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0">
         {/* Table Header / Source Row */}
         <div className="border-b bg-muted/40 p-2 text-xs font-semibold text-muted-foreground flex items-center gap-3">
             <div className="w-4 ml-6"></div> {/* Spacer for checkbox alginment with sort handle? */}
             <span>Pipeline Elements</span>
         </div>
         
         <ScrollArea className="flex-1 bg-background">
             <div className="flex flex-col">
                {/* Draggable Modifiers */}
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={modifiers.map(m => m.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {modifiers.map((mod) => (
                            <SortableModifierItem 
                                key={mod.id}
                                modifier={mod}
                                selected={selectedId === mod.id}
                                onSelect={() => setSelectedId(mod.id)}
                                onToggle={(e) => handleToggleModifier(mod, e)}
                                onRemove={(e) => handleRemoveModifier(mod.id, e)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                {/* Add Button at bottom of list */}
                 <div className="p-2">
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full border border-dashed text-muted-foreground gap-2">
                        <Plus className="h-3 w-3" /> Add Modifier
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-[200px]">
                        {ModifierRegistry.getAvailableModifiers().map((entry) => (
                        <DropdownMenuItem key={entry.name} onClick={() => handleAddModifier(entry.factory)}>
                            {entry.name}
                        </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
             </div>
         </ScrollArea>
      </div>

      {/* Resize Handle */}
      <div 
         className={`h-1 hover:h-1.5 transition-all bg-border hover:bg-primary/50 cursor-row-resize shrink-0 z-10 -mt-[2px] ${isResizing ? 'bg-primary h-1.5' : ''}`}
         onMouseDown={startResizing}
      />

      {/* Properties Panel (Split view style) */}
      <div 
          style={{ height: propertiesHeight }}
          className="shrink-0 bg-background flex flex-col border-t transition-[height] duration-0 ease-linear"
      >
        {selectedModifier ? (
             <ScrollArea className="flex-1">
                <ModifierProperties 
                    modifier={selectedModifier} 
                    app={app}
                    onUpdate={() => setModifiers([...modifiers])} 
                />
             </ScrollArea>
        ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground bg-muted/10">
                Select an item to view properties
            </div>
        )}
      </div>
    </div>
  );
};
