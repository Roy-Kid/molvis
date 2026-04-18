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

          <div className="p-1.5 border-t">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full border border-dashed text-muted-foreground"
                  title="Add modifier"
                  aria-label="Add modifier"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="min-w-[160px] max-w-[220px]"
              >
                {ModifierRegistry.getAvailableModifiers().map((entry) => (
                  <DropdownMenuItem
                    key={entry.name}
                    className="text-xs"
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
