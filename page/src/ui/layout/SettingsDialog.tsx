import type { Molvis } from "@molvis/stage";
import {
  Camera,
  Grid3x3,
  Monitor,
  Palette,
  Puzzle,
  Server,
  Settings,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { cn } from "@/lib/utils";
import { PluginsSection } from "@/plugins";
import { AppearanceSection } from "./AppearanceSection";
import { BackendSection } from "./BackendSection";
import { CameraSection } from "./CameraSection";
import { GraphicsSection } from "./GraphicsSection";
import { GridSection } from "./GridSection";

interface SettingsDialogProps {
  app: Molvis | null;
}

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const CORE_CATEGORIES: SettingsCategory[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="size-3.5" aria-hidden />,
  },
  {
    id: "graphics",
    label: "Graphics",
    icon: <Monitor className="size-3.5" aria-hidden />,
  },
  {
    id: "grid",
    label: "Grid",
    icon: <Grid3x3 className="size-3.5" aria-hidden />,
  },
  {
    id: "camera",
    label: "Camera",
    icon: <Camera className="size-3.5" aria-hidden />,
  },
  {
    id: "backend",
    label: "Backend",
    icon: <Server className="size-3.5" aria-hidden />,
  },
  {
    id: "plugins",
    label: "Plugins",
    icon: <Puzzle className="size-3.5" aria-hidden />,
  },
];

/**
 * Settings dialog: left category rail + continuous right-hand page.
 * Clicking a category scrolls the page to that section; scroll position
 * updates the active category (scroll-spy).
 */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({ app }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(CORE_CATEGORIES[0].id);
  /** Suppress scroll-spy briefly after a nav click so active state stays put. */
  const navLockUntil = useRef(0);

  // Host settings only — plugin settings must not inject into native chrome.
  // Use the command palette for plugin actions.
  const categories = CORE_CATEGORIES;
  const categoryIds = useMemo(() => CORE_CATEGORIES.map((c) => c.id), []);

  const scrollToCategory = useCallback((id: string) => {
    const root = scrollRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(
      `[data-settings-section="${id}"]`,
    );
    if (!target) return;

    setActiveId(id);
    navLockUntil.current = performance.now() + 450;

    const top =
      target.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop;
    root.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }, []);

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const nodes = categoryIds
      .map((id) =>
        root.querySelector<HTMLElement>(`[data-settings-section="${id}"]`),
      )
      .filter((el): el is HTMLElement => el != null);

    if (nodes.length === 0) return;

    const updateActive = () => {
      if (performance.now() < navLockUntil.current) return;

      const rootTop = root.getBoundingClientRect().top;
      // Prefer the last section whose top has crossed ~1/4 of the pane.
      const threshold = rootTop + root.clientHeight * 0.28;
      let current = nodes[0].dataset.settingsSection ?? nodes[0].id;

      for (const node of nodes) {
        const top = node.getBoundingClientRect().top;
        if (top <= threshold) {
          current = node.dataset.settingsSection ?? node.id;
        } else {
          break;
        }
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };

    updateActive();
    root.addEventListener("scroll", updateActive, { passive: true });
    return () => root.removeEventListener("scroll", updateActive);
  }, [categoryIds]);

  return (
    <Dialog modal={false}>
      <DialogTrigger asChild>
        <ViewerIconAction icon={<Settings />} label="Settings" />
      </DialogTrigger>
      <DialogContent
        className={cn(
          "flex h-[min(85vh,40rem)] w-full flex-col gap-0 overflow-hidden p-0",
          "max-w-[min(46rem,calc(100vw-2rem))] sm:max-w-[min(46rem,calc(100vw-2rem))]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-3.5 pr-12">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Category rail */}
          <nav
            aria-label="Settings categories"
            className="flex w-[9.5rem] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/70 bg-panel/40 p-2 sm:w-44"
          >
            {categories.map((cat) => {
              const isActive = activeId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-control border-l-2 px-2.5 py-1.5 text-left text-micro transition-colors duration-(--motion-fast) ease-standard",
                    isActive
                      ? "border-accent bg-accent/12 font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-interactive hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0",
                      isActive ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {cat.icon}
                  </span>
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Continuous settings page */}
          <div
            ref={scrollRef}
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="space-y-0 px-5 py-4 sm:px-6">
              <div className="border-b border-border/60 py-5 first:pt-1">
                <AppearanceSection app={app} sectionId="appearance" />
              </div>
              <div className="border-b border-border/60 py-5">
                <GraphicsSection app={app} sectionId="graphics" />
              </div>
              <div className="border-b border-border/60 py-5">
                <GridSection app={app} sectionId="grid" />
              </div>
              <div className="border-b border-border/60 py-5">
                <CameraSection app={app} sectionId="camera" />
              </div>
              <div className="border-b border-border/60 py-5">
                <BackendSection sectionId="backend" />
              </div>
              <div className="py-5 last:pb-8">
                <PluginsSection sectionId="plugins" />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
