import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";
import type React from "react";

export const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;
  const nextLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      title={nextLabel}
      aria-label={nextLabel}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
};
