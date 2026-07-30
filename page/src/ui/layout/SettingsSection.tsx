import type React from "react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  /** Anchor id for left-nav scroll targets (optional). */
  id?: string;
  title: string;
  /** Short helper under the title (trust notes, how-to, etc.). */
  description?: React.ReactNode;
  /** Right of the title (status badge, count, …). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Functional group inside the Settings dialog — consistent title chrome and
 * density with the rest of the viewer inspector.
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  title,
  description,
  trailing,
  children,
  className,
}) => {
  return (
    <section
      id={id}
      className={cn("scroll-mt-3 space-y-3", className)}
      data-settings-section={id}
    >
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {trailing}
        </div>
        {description ? (
          <p className="text-micro text-muted-foreground leading-snug max-w-prose">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
};

/** One labeled control row used across settings sections. */
export const SettingsRow: React.FC<{
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, children, className }) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 min-h-control-compact rounded-control px-0.5",
        className,
      )}
    >
      <label
        htmlFor={htmlFor}
        className="text-micro text-muted-foreground shrink-0"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
        {children}
      </div>
    </div>
  );
};
