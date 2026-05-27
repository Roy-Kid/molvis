import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { RawChart } from "../../src/charts/raw_chart";
import { type FakePlotly, callsTo, createFakePlotly } from "./_fake_plotly";

describe("RawChart", () => {
  let fake: FakePlotly;
  let container: HTMLDivElement;

  beforeEach(() => {
    fake = createFakePlotly();
    __setPlotlyForTesting(fake.module);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    __setPlotlyForTesting(null);
  });

  it("forwards the raw spec to plotly.react untouched", async () => {
    const data = [{ type: "scatter", x: [1, 2, 3], y: [4, 5, 6] }];
    const layout = { title: { text: "demo" } };
    const chart = new RawChart(container, { data, layout });
    await chart.ready();
    const reacts = callsTo(fake.calls, "react");
    expect(reacts).toHaveLength(1);
    expect(reacts[0].args[1]).toBe(data);
    expect(reacts[0].args[2]).toBe(layout);
    chart.dispose();
  });

  it("update() re-renders via react", async () => {
    const chart = new RawChart(container, {
      data: [{ type: "bar", x: [], y: [] }],
    });
    await chart.ready();
    await chart.update({ data: [{ type: "bar", x: ["A"], y: [1] }] });
    expect(callsTo(fake.calls, "react")).toHaveLength(2);
    chart.dispose();
  });

  it("dispose() purges plotly", async () => {
    const chart = new RawChart(container, { data: [] });
    await chart.ready();
    chart.dispose();
    expect(callsTo(fake.calls, "purge")).toHaveLength(1);
  });
});
