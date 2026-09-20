/**
 * Hide predicate for notebook off-screen pause.
 * A 0-area box is a splitter layout frame, not a hide.
 */
export function isViewportHidden(entry: {
  isIntersecting: boolean;
  boundingClientRect: { width: number; height: number };
}): boolean {
  if (entry.isIntersecting) return false;
  const { width, height } = entry.boundingClientRect;
  return width > 0 && height > 0;
}
