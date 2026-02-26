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
import { SortableModifierItem } from "./SortableModifierItem";

interface PipelineListProps {
  modifiers: Modifier[];
  selectedId: string | null;
  onSelectModifier: (id: string) => void;
  onToggleModifier: (modifier: Modifier) => void;
  onRemoveModifier: (id: string) => void;
  onAddModifier: (factory: () => Modifier) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function PipelineList({
  modifiers,
  selectedId,
  onSelectModifier,
  onToggleModifier,
  onRemoveModifier,
  onAddModifier,
  onDragEnd,
}: PipelineListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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
              items={modifiers.map((modifier) => modifier.id)}
              strategy={verticalListSortingStrategy}
            >
              {modifiers.map((modifier) => (
                <SortableModifierItem
                  key={modifier.id}
                  modifier={modifier}
                  selected={selectedId === modifier.id}
                  onSelect={() => onSelectModifier(modifier.id)}
                  onToggle={() => onToggleModifier(modifier)}
                  onRemove={() => onRemoveModifier(modifier.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="p-2">
            <DropdownMenu>
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
