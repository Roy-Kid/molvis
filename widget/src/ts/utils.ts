export function preventEventPropagation(element: HTMLElement) {
  const stopPropagation = (e: Event) => e.stopPropagation();
  ["contextmenu", "click", "keydown", "keyup", "keypress"].forEach(
    (eventType) => {
      element.addEventListener(eventType, stopPropagation, false);
    }
  );
} 