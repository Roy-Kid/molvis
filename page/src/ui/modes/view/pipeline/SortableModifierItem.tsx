import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Modifier } from "@molvis/core";
import { GripVertical, Trash2 } from "lucide-react";

interface SortableModifierItemProps {
  modifier: Modifier;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

export function SortableModifierItem({
  modifier,
  selected,
  onSelect,
  onToggle,
  onRemove,
}: SortableModifierItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: modifier.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 border-b last:border-0 text-sm select-none ${selected ? "bg-accent/80" : "bg-background hover:bg-accent/30"} ${isDragging ? "opacity-50" : ""}`}
      onClick={onSelect}
      {...attributes}
    >
      <div
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex items-center justify-center">
        <Checkbox
          checked={modifier.enabled}
          onCheckedChange={() => onToggle()}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
      </div>

      <span className="flex-1 font-medium truncate cursor-default">
        {modifier.name}
      </span>

      <div className="flex items-center gap-1">
        {modifier.name !== "Data Source" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
