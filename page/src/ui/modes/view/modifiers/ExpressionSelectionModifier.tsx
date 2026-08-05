import type {
  ExpressionSelectionModifier as CoreExpressionModifier,
  Molvis,
} from "@molcrafts/molvis-stage";
import type React from "react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyPipelineOperation } from "@/hooks/useApplyPipelineOperation";

interface ModifierProps {
  modifier: CoreExpressionModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

const PIPELINE_COPY = {
  running: "Applying the selection expression…",
  success: "Selection expression applied",
  error: "Could not apply the selection expression",
};

export const ExpressionSelectionModifier: React.FC<ModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const [expression, setExpression] = useState(modifier.expression);
  const [name, setName] = useState(modifier.selectionName || "");
  const { applyPipeline, pipelineRunning } = useApplyPipelineOperation(
    app,
    onUpdate,
    PIPELINE_COPY,
  );

  const handleApply = () => {
    if (!app || pipelineRunning) return;
    modifier.expression = expression;
    modifier.selectionName = name || undefined;
    applyPipeline();
  };

  return (
    <fieldset
      disabled={!app || pipelineRunning}
      aria-busy={pipelineRunning}
      className="m-0 min-w-0 space-y-4 border-0 p-0"
    >
      <div className="grid gap-2">
        <Label htmlFor="expr-input">Expression</Label>
        <Input
          id="expr-input"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="e.g. element == 'C' && x > 0"
          className="font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleApply();
              e.currentTarget.blur();
            }
          }}
          onBlur={handleApply}
        />
        <p className="text-micro text-muted-foreground">
          Variables: x, y, z, element, id, index
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name-input">Selection Name (Optional)</Label>
        <Input
          id="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. mySelection"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleApply();
              e.currentTarget.blur();
            }
          }}
          onBlur={handleApply}
        />
        <p className="text-micro text-muted-foreground">
          Save selection for later use
        </p>
      </div>
    </fieldset>
  );
};
