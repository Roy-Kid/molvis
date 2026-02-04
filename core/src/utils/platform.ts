/**
 * Platform detection utilities
 */

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

/**
 * Check if the appropriate modifier key is pressed for the current platform.
 * - Ctrl on Windows/Linux
 * - Meta (Command) on macOS
 */
export function isCtrlOrMeta(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  if (isMac) {
    return event.metaKey;
  }
  return event.ctrlKey;
}

/**
 * Get the display name for the modifier key
 */
export function getModifierName(): string {
  return isMac ? "Cmd" : "Ctrl";
}
