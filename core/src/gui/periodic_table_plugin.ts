import { VERSION } from "tweakpane";

export interface PeriodicTableParams {
  view: "periodic-table";
  value: string;
  label?: string;
}

const ELEMENTS = [
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
  "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
];

const PeriodicTablePlugin: any = {
  id: "periodic-table",
  type: "blade",
  core: VERSION,
  accept(params: any) {
    if (params.view === "periodic-table" && typeof params.value === "string") {
      return { params: { view: "periodic-table", value: params.value, label: params.label } };
    }
    return null;
  },
  controller(args: any) {
    const doc = args.document;
    const container = doc.createElement("div");
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(9, 1fr)";
    container.style.gap = "2px";

    const ctrl: any = {
      value: { rawValue: args.params.value, emitter: { on() {}, emit() {} } },
      view: { element: container },
      blade: args.blade,
      viewProps: args.viewProps,
    };

    ELEMENTS.forEach((el) => {
      const btn = doc.createElement("button");
      btn.textContent = el;
      btn.addEventListener("click", () => {
        ctrl.value.rawValue = el;
        if (ctrl.value.emitter.emit) {
          ctrl.value.emitter.emit("change", { rawValue: el });
        }
      });
      container.appendChild(btn);
    });

    return ctrl;
  },
};

export { PeriodicTablePlugin };
