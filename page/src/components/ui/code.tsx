import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Inline code, following shadcn's typography `inline-code` recipe.
 *
 * It inherits the surrounding semantic type size; surface, radius, spacing,
 * and the mono face come from the viewer token layer.
 */
function Code({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="code"
      className={cn(
        "relative rounded-control bg-muted px-1 font-mono font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Code };
