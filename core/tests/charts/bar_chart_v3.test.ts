import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { BarChart } from "../../src/charts/bar_chart";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { type FakePlotly, callsTo, createFakePlotly } from "./_fake_plotly";

describe("BarChart layout extensions", () => {
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

  it("type=line with mode=stack tracks the cumulative bar total", async () => {
    const chart = new BarChart(container, {
      mode: "stack",
      series: [
        {
          id: "succ",
          points: [
            { x: "Mon", y: 3 },
            { x: "Tue", y: 5 },
          ],
        },
        {
          id: "fail",
          points: [
            { x: "Mon", y: 1 },
            { x: "Tue", y: 2 },
          ],
        },
        {
          id: "started",
          type: "line",
          points: [
            { x: "Mon", y: 99 },
            { x: "Tue", y: 99 },
          ],
        },
      ],
    });
    await chart.ready();
    const traces = callsTo(fake.calls, "react")[0].args[1] as Array<{
      type: string;
      y: unknown;
    }>;
    const line = traces.find((t) => t.type === "scatter");
    expect(line).toBeTruthy();
    // Stacked total = 3+1=4 and 5+2=7; the line's raw values (99,99) are
    // replaced by the cumulative bar total so the overlay floats *on top*
    // of the stack instead of inside it.
    expect(line?.y).toEqual([4, 7]);
  });

  it("bargap + legend + modebarRemove + axis extras flow into plotly layout", async () => {
    const chart = new BarChart(container, {
      series: [{ id: "a", points: [{ x: "A", y: 1 }] }],
      bargap: 0.05,
      showLegend: true,
      legend: { orientation: "h", y: -0.3, x: 0, font: { size: 10 } },
      modebar: true,
      modebarRemove: ["lasso2d", "select2d"],
      xAxis: { tickformat: "%H:00", nticks: 12 },
      yAxis: {
        label: "runs",
        rangemode: "nonnegative",
        automargin: true,
        tickfont: { size: 11 },
      },
    });
    await chart.ready();
    const layout = fake.lastLayout(container) ?? {};
    expect(layout.bargap).toBe(0.05);
    expect((layout.legend as Record<string, unknown>).orientation).toBe("h");
    expect((layout.legend as Record<string, unknown>).y).toBe(-0.3);
    const xAxis = layout.xaxis as Record<string, unknown>;
    const yAxis = layout.yaxis as Record<string, unknown>;
    expect(xAxis.tickformat).toBe("%H:00");
    expect(xAxis.nticks).toBe(12);
    expect(yAxis.rangemode).toBe("nonnegative");
    expect(yAxis.automargin).toBe(true);
    expect((yAxis.tickfont as Record<string, unknown>).size).toBe(11);
    const reactCall = callsTo(fake.calls, "react")[0];
    const cfg = reactCall.args[3] as Record<string, unknown>;
    expect(cfg.modeBarButtonsToRemove).toEqual(["lasso2d", "select2d"]);
    chart.dispose();
  });
});
