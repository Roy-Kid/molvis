import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface SidebarSectionProps {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
  className,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("border-b", className)}>
      <button
        type="button"
        className="w-full px-2 py-1 text-left flex items-center justify-between gap-1.5 hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide uppercase leading-none">
            {title}
          </div>
          {subtitle && (
            <div className="text-[9px] text-muted-foreground truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badge && (
            <span className="px-1 py-0 rounded border bg-muted/30 text-[9px] text-muted-foreground">
              {badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
        </div>
      </button>

      {open && <div className="px-2 pb-1.5 space-y-1.5">{children}</div>}
    </section>
  );
};
