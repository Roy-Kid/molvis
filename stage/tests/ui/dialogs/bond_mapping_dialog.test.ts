import { afterEach, beforeAll, describe, expect, it } from "@rstest/core";
import { MolvisBondMappingDialog } from "../../../src/ui/dialogs/bond_mapping_dialog";

const TAG = "molvis-bond-mapping-dialog";

describe("MolvisBondMappingDialog", () => {
  beforeAll(() => {
    if (!customElements.get(TAG)) {
      customElements.define(TAG, MolvisBondMappingDialog);
    }
  });

  afterEach(() => {
    for (const node of document.querySelectorAll(TAG)) node.remove();
  });

  function mount(): MolvisBondMappingDialog {
    const el = document.createElement(TAG) as MolvisBondMappingDialog;
    document.body.append(el);
    return el;
  }

  function select(
    el: MolvisBondMappingDialog,
    label: string,
  ): HTMLSelectElement {
    const found = el.shadowRoot?.querySelector<HTMLSelectElement>(
      `select[aria-label^="${label}"]`,
    );
    if (!found) throw new Error(`no ${label} select`);
    return found;
  }

  function button(
    el: MolvisBondMappingDialog,
    text: string,
  ): HTMLButtonElement {
    const all = [
      ...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ];
    const found = all.find((b) => b.textContent === text);
    if (!found) throw new Error(`no "${text}" button`);
    return found;
  }

  it("resolves with the picked endpoint columns", async () => {
    const el = mount();
    const decision = el.open("bonds.dump.local", ["c_1", "c_2", "c_3"]);
    select(el, "atomj").value = "c_3";
    button(el, "Map bonds").click();
    await expect(decision).resolves.toEqual({
      atomiSource: "c_1",
      atomjSource: "c_3",
      offset: 0,
    });
  });

  it("defaults to the first two candidates and shows the filename", () => {
    const el = mount();
    void el.open("overlay.dump.local", ["c_1", "c_2", "c_3"]);
    expect(select(el, "atomi").value).toBe("c_1");
    expect(select(el, "atomj").value).toBe("c_2");
    expect(el.shadowRoot?.querySelector(".file")?.textContent).toBe(
      "overlay.dump.local",
    );
  });

  it("resolves null when the load is cancelled", async () => {
    const el = mount();
    const decision = el.open("bonds.dump.local", ["c_1", "c_2"]);
    button(el, "Cancel load").click();
    await expect(decision).resolves.toBe(null);
    expect(el.hidden).toBe(true);
  });

  it("resolves null on Escape", async () => {
    const el = mount();
    const decision = el.open("bonds.dump.local", ["c_1", "c_2"]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(decision).resolves.toBe(null);
  });

  it("refuses one column for both endpoints", () => {
    const el = mount();
    void el.open("bonds.dump.local", ["c_1", "c_2"]);
    const confirm = button(el, "Map bonds");
    expect(confirm.disabled).toBe(false);

    const atomj = select(el, "atomj");
    atomj.value = "c_1";
    atomj.dispatchEvent(new Event("change"));
    expect(confirm.disabled).toBe(true);
  });

  it("cancels a pending prompt when a second load opens it", async () => {
    const el = mount();
    const first = el.open("first.dump.local", ["c_1", "c_2"]);
    const second = el.open("second.dump.local", ["c_1", "c_2"]);
    await expect(first).resolves.toBe(null);
    button(el, "Map bonds").click();
    await expect(second).resolves.toEqual({
      atomiSource: "c_1",
      atomjSource: "c_2",
      offset: 0,
    });
  });
});
