export function preventEventPropagation(element: HTMLElement) {
  const stopPropagation = (e: Event) => e.stopPropagation();
  for (const eventType of ["contextmenu", "click", "keydown", "keyup", "keypress"]) {
    element.addEventListener(eventType, stopPropagation, false);
  }
} 