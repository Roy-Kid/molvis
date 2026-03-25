import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExpressionSelectionModifier,
  type Modifier,
  SelectModifier,
} from "@molvis/core";
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from "lucide-react";

interface SortableModifierItemProps {
  modifier: Modifier;
  selected: boolean;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onToggleExpand: () => void;
}

function getDisplayName(modifier: Modifier): string {
  if (modifier instanceof SelectModifier) {
    return `${modifier.id} · ${modifier.selectionSummary}`;
  }
  if (modifier instanceof ExpressionSelectionModifier) {
    const expr = modifier.expression;
    return `${modifier.id} · ${expr || "empty"}`;
  }
  return modifier.name;
}

export function SortableModifierItem({
  modifier,
  selected,
  depth,
  hasChildren,
  isExpanded,
  onSelect,
  onToggle,
  onRemove,
  onToggleExpand,
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
    paddingLeft: `${depth * 20 + 8}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 pr-2 border-b last:border-0 text-sm select-none ${selected ? "bg-accent/80" : "bg-background hover:bg-accent/30"} ${isDragging ? "opacity-50" : ""}`}
      onClick={onSelect}
      {...attributes}
    >
      {hasChildren ? (
        <button
          type="button"
          className="flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}

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
        {getDisplayName(modifier)}
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
