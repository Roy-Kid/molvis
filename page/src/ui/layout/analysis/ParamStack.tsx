import type React from "react";

/** Label-over-control stack for narrow analysis sidebars. */
export function ParamStack({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-micro text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
