import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExpressionSelectionModifier as CoreExpressionModifier, type Molvis } from "@molvis/core";
import React, { useState } from "react";

interface ModifierProps {
  modifier: CoreExpressionModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const ExpressionSelectionModifier: React.FC<ModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const [expression, setExpression] = useState(modifier.expression);
  const [name, setName] = useState(modifier.selectionName || "");

  const handleApply = () => {
    if (!app) return;
    modifier.expression = expression;
    modifier.selectionName = name || undefined;
    app.applyPipeline();
    onUpdate();
  };

  return (
    <div className="space-y-4">
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
        <p className="text-[10px] text-muted-foreground">
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
        <p className="text-[10px] text-muted-foreground">
          Save selection for later use
        </p>
      </div>
    </div>
  );
};
