import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Numeric input that holds a string draft while editing and commits a
 * clamped, step-rounded value on blur or Enter. Shared by the View-tab
 * render controls and the Data Source per-component parameters.
 */
export function NumberField({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    let v = Number(draft);
    if (Number.isNaN(v)) v = value;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (step !== undefined) v = Math.round(v / step) * step;
    onChange(v);
    setDraft(String(v));
  };

  return (
    <Input
      type="number"
      className="h-6 w-16 px-1.5 text-xs tabular-nums shrink-0"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}
