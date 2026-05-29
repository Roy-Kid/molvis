import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { ScatterChart } from "../../src/charts/scatter_chart";
import { callsTo, createFakePlotly, type FakePlotly } from "./_fake_plotly";

describe("ScatterChart", () => {
  let fake: FakePlotly;
  let container: HTMLDivElement;

  beforeEach(() => {
    fake = createFakePlotly();
    __setPlotlyForTesting(fake.module);
    container = document.createElement("div");
    container.style.width = "400px";
    container.style.height = "300px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    __setPlotlyForTesting(null);
  });

  it("renders with two traces (points + highlight overlay)", async () => {
    const chart = new ScatterChart(container, {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      xAxis: { label: "PC1" },
      yAxis: { label: "PC2" },
    });
    await chart.ready();
    expect(callsTo(fake.calls, "react")).toHaveLength(1);
    expect(fake.traceCount(container)).toBe(2);
    chart.dispose();
  });

  it("setHighlight restyles trace 1 with the selected point's coordinates", async () => {
    const chart = new ScatterChart(container, {
      points: [
        { x: 10, y: 100 },
        { x: 20, y: 200 },
        { x: 30, y: 300 },
      ],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
    });
    await chart.ready();
    await chart.setHighlight(2);
    const restyles = callsTo(fake.calls, "restyle");
    expect(restyles).toHaveLength(1);
    expect(restyles[0].args[1]).toEqual({ x: [[30]], y: [[300]] });
    expect(restyles[0].args[2]).toEqual([1]);
    chart.dispose();
  });

  it("setHighlight(null) hides the overlay (empty x/y on trace 1)", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 0, y: 0 }],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
      highlight: { index: 0 },
    });
    await chart.ready();
    await chart.setHighlight(null);
    const restyles = callsTo(fake.calls, "restyle");
    expect(restyles).toHaveLength(1);
    expect(restyles[0].args[1]).toEqual({ x: [[]], y: [[]] });
    expect(restyles[0].args[2]).toEqual([1]);
    chart.dispose();
  });

  it("update() re-renders via react with merged config", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 0, y: 0 }],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
    });
    await chart.ready();
    await chart.update({
      points: [
        { x: 5, y: 5 },
        { x: 6, y: 6 },
      ],
    });
    expect(callsTo(fake.calls, "react")).toHaveLength(2);
    chart.dispose();
  });

  it("onPointClick fires with customdata", async () => {
    const chart = new ScatterChart(container, {
      points: [
        { x: 0, y: 0, customdata: 42 },
        { x: 1, y: 1, customdata: 99 },
      ],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
    });
    await chart.ready();
    const received: Array<{ index: number; customdata: unknown }> = [];
    chart.onPointClick((e) => {
      received.push({ index: e.index, customdata: e.customdata });
    });
    fake.fireClick(container, [
      { curveNumber: 0, pointIndex: 1, x: 1, y: 1, customdata: 99 },
    ]);
    expect(received).toEqual([{ index: 1, customdata: 99 }]);
    chart.dispose();
  });

  it("ignores clicks on the highlight overlay trace", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 0, y: 0 }],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
    });
    await chart.ready();
    let calls = 0;
    chart.onPointClick(() => calls++);
    fake.fireClick(container, [{ curveNumber: 1, pointIndex: 0, x: 0, y: 0 }]);
    expect(calls).toBe(0);
    chart.dispose();
  });

  it("dispose() purges and detaches click listeners", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 0, y: 0 }],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
    });
    await chart.ready();
    let count = 0;
    chart.onPointClick(() => count++);
    chart.dispose();
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 0, x: 0, y: 0 }]);
    expect(count).toBe(0);
    expect(callsTo(fake.calls, "purge")).toHaveLength(1);
  });

  it("highlight overlay starts hidden when config.highlight is omitted", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 1, y: 2 }],
      xAxis: { label: "x" },
      yAxis: { label: "y" },
    });
    await chart.ready();
    const reacts = callsTo(fake.calls, "react");
    const traces = reacts[0].args[1] as Array<{
      x: number[];
      y: number[];
      name: string;
    }>;
    const highlight = traces.find((t) => t.name === "highlight");
    expect(highlight).toBeDefined();
    expect(highlight?.x).toEqual([]);
    expect(highlight?.y).toEqual([]);
    chart.dispose();
  });
});
