import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { BarChart } from "../../src/charts/bar_chart";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { callsTo, createFakePlotly, type FakePlotly } from "./_fake_plotly";

describe("BarChart", () => {
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

  it("mounts one bar trace per series via react", async () => {
    const chart = new BarChart(container, {
      series: [
        { id: "succ", points: [{ x: "Mon", y: 3 }] },
        { id: "fail", points: [{ x: "Mon", y: 1 }] },
      ],
    });
    await chart.ready();
    expect(callsTo(fake.calls, "react")).toHaveLength(1);
    expect(fake.traceCount(container)).toBe(2);
    chart.dispose();
  });

  it("forwards barmode + hovermode on the layout", async () => {
    const chart = new BarChart(container, {
      series: [{ id: "a", points: [{ x: 0, y: 1 }] }],
      mode: "stack",
      hovermode: "x unified",
    });
    await chart.ready();
    const layout = fake.lastLayout(container) ?? {};
    expect(layout.barmode).toBe("stack");
    expect(layout.hovermode).toBe("x unified");
    chart.dispose();
  });

  it("xAxis.dtype reaches plotly as xaxis.type", async () => {
    const chart = new BarChart(container, {
      series: [{ id: "a", points: [{ x: "2024-01-01", y: 1 }] }],
      xAxis: { dtype: "date" },
    });
    await chart.ready();
    const layout = fake.lastLayout(container) ?? {};
    expect((layout.xaxis as Record<string, unknown>).type).toBe("date");
    chart.dispose();
  });

  it("onBarClick fires with seriesId + index", async () => {
    const chart = new BarChart(container, {
      series: [
        { id: "succ", points: [{ x: "Mon", y: 3 }] },
        { id: "fail", points: [{ x: "Mon", y: 1 }] },
      ],
    });
    await chart.ready();
    const received: Array<{ seriesId: string; index: number }> = [];
    chart.onBarClick((e) =>
      received.push({ seriesId: e.seriesId, index: e.index }),
    );
    fake.fireClick(container, [
      { curveNumber: 1, pointIndex: 0, x: "Mon", y: 1 },
    ]);
    expect(received).toEqual([{ seriesId: "fail", index: 0 }]);
    chart.dispose();
  });

  it("update() re-renders with new series via react", async () => {
    const chart = new BarChart(container, {
      series: [{ id: "a", points: [{ x: 0, y: 1 }] }],
    });
    await chart.ready();
    await chart.update({
      series: [
        { id: "a", points: [{ x: 0, y: 1 }] },
        { id: "b", points: [{ x: 0, y: 2 }] },
      ],
    });
    expect(callsTo(fake.calls, "react")).toHaveLength(2);
    expect(fake.traceCount(container)).toBe(2);
    chart.dispose();
  });

  it("dispose() purges plotly + detaches click listener", async () => {
    const chart = new BarChart(container, {
      series: [{ id: "a", points: [{ x: 0, y: 1 }] }],
    });
    await chart.ready();
    let count = 0;
    chart.onBarClick(() => count++);
    chart.dispose();
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 0, x: 0, y: 1 }]);
    expect(count).toBe(0);
    expect(callsTo(fake.calls, "purge")).toHaveLength(1);
  });
});
