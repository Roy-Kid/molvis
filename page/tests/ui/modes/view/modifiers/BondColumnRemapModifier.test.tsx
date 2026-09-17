import type { BondColumnMapping, Molvis } from "@molcrafts/molvis-stage";
import { describe, expect, it } from "@rstest/core";
import { act } from "react";
import { PipelineOperationProvider } from "../../../../../src/components/viewer/PipelineOperationProvider";
import { BondColumnRemapModifier } from "../../../../../src/ui/modes/view/modifiers/BondColumnRemapModifier";
import { mountComponent } from "../../../../react_harness";

/** The mapping a `*.dump.local` overlay lands with, inferred at load. */
const DUMP_LOCAL: BondColumnMapping = {
  atomiSource: "batom1",
  atomjSource: "batom2",
  offset: 0,
};

function fakeModifier(mapping: BondColumnMapping = DUMP_LOCAL) {
  let current = { ...mapping };
  return {
    id: "bond-column-remap",
    sourceOwnerId: "source-1",
    get mapping() {
      return current;
    },
    set mapping(next: BondColumnMapping) {
      current = next;
    },
  };
}

/** No sources and no frame: candidates come only from the live mapping. */
function fakeApp(onApply: () => void) {
  return {
    applyPipeline: async () => {
      onApply();
      return null;
    },
    modifierPipeline: { sources: () => [] },
    system: { frame: null },
  } as unknown as Molvis;
}

async function mountPanel(mapping?: BondColumnMapping) {
  const modifier = fakeModifier(mapping);
  // `usePipelineOperation` runs the apply fire-and-forget, so the test must
  // wait on the call itself. Flushing a fixed number of microtasks races the
  // status-runner chain and fails under load.
  let markApplied: () => void = () => undefined;
  const applied = new Promise<void>((resolve) => {
    markApplied = resolve;
  });
  const mounted = await mountComponent(
    <PipelineOperationProvider>
      <BondColumnRemapModifier
        modifier={modifier as never}
        app={fakeApp(() => markApplied())}
        onUpdate={() => undefined}
      />
    </PipelineOperationProvider>,
  );
  return { mounted, modifier, applied };
}

const field = (host: HTMLElement, label: string) =>
  host.querySelector(`[aria-label="${label}"]`);

describe("TestBondColumnRemapModifier", () => {
  it("offers both endpoint columns and the row offset", async () => {
    const { mounted } = await mountPanel();
    try {
      expect(field(mounted.host, "First bond endpoint column")).not.toBe(null);
      expect(field(mounted.host, "Second bond endpoint column")).not.toBe(null);
      expect(field(mounted.host, "Bond endpoint row offset")).not.toBe(null);
    } finally {
      await mounted.cleanup();
    }
  });

  it("reads back the mapping the load inferred", async () => {
    const { mounted } = await mountPanel();
    try {
      const offset = field(
        mounted.host,
        "Bond endpoint row offset",
      ) as HTMLInputElement;
      expect(offset.value).toBe("0");
      // Radix renders the selected item's text into its trigger.
      expect(mounted.host.textContent).toContain("batom1");
      expect(mounted.host.textContent).toContain("batom2");
    } finally {
      await mounted.cleanup();
    }
  });

  it("writes an edited offset back and re-applies the pipeline", async () => {
    const { mounted, modifier, applied } = await mountPanel();
    try {
      const offset = field(
        mounted.host,
        "Bond endpoint row offset",
      ) as HTMLInputElement;
      await act(async () => {
        // React tracks the DOM value, so a plain assignment is swallowed.
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(offset, "-1");
        offset.dispatchEvent(new Event("input", { bubbles: true }));
      });
      // Typing alone must not commit: every keystroke would otherwise drive a
      // full pipeline rebuild. The panel commits on blur or Enter only.
      expect(modifier.mapping.offset).toBe(0);
      await act(async () => {
        // React delegates `onBlur` at the root via the bubbling `focusout`
        // event; a bare non-bubbling `blur` never reaches the handler.
        offset.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      expect(modifier.mapping.offset).toBe(-1);
      // Endpoints must survive an offset edit — the setter replaces the
      // whole mapping object.
      expect(modifier.mapping.atomiSource).toBe("batom1");
      expect(modifier.mapping.atomjSource).toBe("batom2");
      await act(async () => {
        await applied;
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("warns when both endpoints read one column", async () => {
    const { mounted } = await mountPanel({
      atomiSource: "batom1",
      atomjSource: "batom1",
      offset: 0,
    });
    try {
      expect(mounted.host.textContent).toContain("same column");
    } finally {
      await mounted.cleanup();
    }
  });

  it("stays quiet when the endpoints differ", async () => {
    const { mounted } = await mountPanel();
    try {
      expect(mounted.host.textContent).not.toContain("same column");
    } finally {
      await mounted.cleanup();
    }
  });
});
