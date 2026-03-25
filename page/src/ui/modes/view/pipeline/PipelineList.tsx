import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Modifier, ModifierRegistry } from "@molvis/core";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { SortableModifierItem } from "./SortableModifierItem";
import { buildTree, flattenTree } from "./tree_utils";

interface PipelineListProps {
  modifiers: Modifier[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelectModifier: (id: string) => void;
  onToggleModifier: (modifier: Modifier) => void;
  onRemoveModifier: (id: string) => void;
  onAddModifier: (factory: () => Modifier) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onToggleExpand: (id: string) => void;
}

export function PipelineList({
  modifiers,
  selectedId,
  expandedIds,
  onSelectModifier,
  onToggleModifier,
  onRemoveModifier,
  onAddModifier,
  onDragEnd,
  onToggleExpand,
}: PipelineListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const tree = useMemo(() => buildTree(modifiers), [modifiers]);
  const flatNodes = useMemo(
    () => flattenTree(tree, expandedIds),
    [tree, expandedIds],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b bg-muted/40 p-2 text-xs font-semibold text-muted-foreground flex items-center gap-3">
        <div className="w-4 ml-6" />
        <span>Pipeline Elements</span>
      </div>

      <ScrollArea className="flex-1 bg-background">
        <div className="flex flex-col">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={flatNodes.map((n) => n.modifier.id)}
              strategy={verticalListSortingStrategy}
            >
              {flatNodes.map((node) => (
                <SortableModifierItem
                  key={node.modifier.id}
                  modifier={node.modifier}
                  selected={selectedId === node.modifier.id}
                  depth={node.depth}
                  hasChildren={node.children.length > 0}
                  isExpanded={expandedIds.has(node.modifier.id)}
                  onSelect={() => onSelectModifier(node.modifier.id)}
                  onToggle={() => onToggleModifier(node.modifier)}
                  onRemove={() => onRemoveModifier(node.modifier.id)}
                  onToggleExpand={() => onToggleExpand(node.modifier.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="p-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full border border-dashed text-muted-foreground gap-2"
                >
                  <Plus className="h-3 w-3" /> Add Modifier
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-[200px]">
                {ModifierRegistry.getAvailableModifiers().map((entry) => (
                  <DropdownMenuItem
                    key={entry.name}
                    onClick={() => onAddModifier(entry.factory)}
                  >
                    {entry.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
