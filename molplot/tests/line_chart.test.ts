import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { LineChart } from "../src/line_chart";
import { __setPlotlyForTesting } from "../src/plotly_loader";
import { callsTo, createFakePlotly, type FakePlotly } from "./_fake_plotly";

describe("LineChart", () => {
  let fake: FakePlotly;
  let container: HTMLDivElement;

  beforeEach(() => {
    fake = createFakePlotly();
    __setPlotlyForTesting(fake.module);
    container = document.createElement("div");
    container.style.width = "400px";
    container.style.height = "200px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    __setPlotlyForTesting(null);
  });

  it("calls newPlot once on construction with one trace per series", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a" }, { id: "b" }],
      xAxis: { label: "step" },
      yAxis: { label: "loss" },
    });
    await chart.ready();
    expect(callsTo(fake.calls, "newPlot")).toHaveLength(1);
    expect(fake.traceCount(container)).toBe(2);
    chart.dispose();
  });

  it("appendPoint routes to extendTraces with the correct trace index", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "loss" }, { id: "acc" }],
    });
    await chart.ready();
    await chart.appendPoint("acc", { x: 1, y: 0.5 });
    const extends_ = callsTo(fake.calls, "extendTraces");
    expect(extends_).toHaveLength(1);
    expect(extends_[0].args[2]).toEqual([1]); // trace index for "acc"
    expect(extends_[0].args[1]).toEqual({ x: [[1]], y: [[0.5]] });
    chart.dispose();
  });

  it("appendPoints batches multiple samples in one extendTraces call", async () => {
    const chart = new LineChart(container, { series: [{ id: "s" }] });
    await chart.ready();
    await chart.appendPoints("s", [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ]);
    const ext = callsTo(fake.calls, "extendTraces");
    expect(ext).toHaveLength(1);
    expect(ext[0].args[1]).toEqual({ x: [[0, 1, 2]], y: [[1, 2, 3]] });
    chart.dispose();
  });

  it("respects windowSize on append (cap forwarded to plotly)", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "s" }],
      windowSize: 10,
    });
    await chart.ready();
    await chart.appendPoint("s", { x: 0, y: 0 });
    const ext = callsTo(fake.calls, "extendTraces");
    expect(ext[0].args[3]).toBe(10);
    chart.dispose();
  });

  it("setWindow retroactively trims the in-memory buffer past the cap", async () => {
    const chart = new LineChart(container, {
      series: [
        {
          id: "s",
          initialPoints: Array.from({ length: 30 }, (_, i) => ({
            x: i,
            y: i,
          })),
        },
      ],
    });
    await chart.ready();
    await chart.setWindow(5);
    const restyles = callsTo(fake.calls, "restyle");
    expect(restyles).toHaveLength(1);
    const update = restyles[0].args[1] as { x: number[][]; y: number[][] };
    expect(update.x[0]).toHaveLength(5);
    expect(update.x[0]).toEqual([25, 26, 27, 28, 29]);
    chart.dispose();
  });

  it("clear() empties a single series", async () => {
    const chart = new LineChart(container, {
      series: [
        { id: "a", initialPoints: [{ x: 1, y: 1 }] },
        { id: "b", initialPoints: [{ x: 2, y: 2 }] },
      ],
    });
    await chart.ready();
    await chart.clear("a");
    const restyles = callsTo(fake.calls, "restyle");
    expect(restyles).toHaveLength(1);
    expect(restyles[0].args[2]).toEqual([0]);
    chart.dispose();
  });

  it("clear() with no argument empties every series", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a" }, { id: "b" }],
    });
    await chart.ready();
    await chart.clear();
    expect(callsTo(fake.calls, "restyle")).toHaveLength(2);
    chart.dispose();
  });

  it("onPointClick fires registered callback with series id and index", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a" }, { id: "b" }],
    });
    await chart.ready();
    const received: Array<{ seriesId: string; index: number }> = [];
    chart.onPointClick((e) => {
      received.push({ seriesId: e.seriesId, index: e.index });
    });
    fake.fireClick(container, [{ curveNumber: 1, pointIndex: 3, x: 1, y: 2 }]);
    expect(received).toEqual([{ seriesId: "b", index: 3 }]);
    chart.dispose();
  });

  it("onPointClick unsubscribe stops further deliveries", async () => {
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    let count = 0;
    const off = chart.onPointClick(() => {
      count++;
    });
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 0, x: 0, y: 0 }]);
    off();
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 1, x: 1, y: 1 }]);
    expect(count).toBe(1);
    chart.dispose();
  });

  it("setSeries replaces the buffer and restyles that trace only", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a" }, { id: "b" }],
    });
    await chart.ready();
    await chart.setSeries("b", [
      { x: 10, y: 100 },
      { x: 11, y: 110 },
    ]);
    const restyles = callsTo(fake.calls, "restyle");
    expect(restyles).toHaveLength(1);
    expect(restyles[0].args[2]).toEqual([1]);
    expect(restyles[0].args[1]).toEqual({ x: [[10, 11]], y: [[100, 110]] });
    chart.dispose();
  });

  it("dispose() purges and detaches click listeners", async () => {
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    let count = 0;
    chart.onPointClick(() => count++);
    chart.dispose();
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 0, x: 0, y: 0 }]);
    expect(count).toBe(0);
    expect(callsTo(fake.calls, "purge")).toHaveLength(1);
  });

  it("unknown series id throws on append", async () => {
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    await expect(chart.appendPoint("nope", { x: 0, y: 0 })).rejects.toThrow(
      /unknown series/,
    );
    chart.dispose();
  });
});
