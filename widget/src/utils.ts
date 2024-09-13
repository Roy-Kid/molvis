const preventEventPropagation = (element: HTMLElement) => {
    const stopPropagation = (e: Event) => e.stopPropagation();
    ["click", "keydown", "keyup", "keypress"].forEach((eventType) => {
      element.addEventListener(eventType, stopPropagation, false);
    });
  };

export { preventEventPropagation };