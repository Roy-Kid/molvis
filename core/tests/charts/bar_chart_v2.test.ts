import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { BarChart } from "../../src/charts/bar_chart";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { type FakePlotly, callsTo, createFakePlotly } from "./_fake_plotly";

describe("BarChart orientation + mixed-type extensions", () => {
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

  it("horizontal orientation swaps (x,y) on the traces", async () => {
    const chart = new BarChart(container, {
      series: [
        {
          id: "a",
          points: [
            { x: "A", y: 1 },
            { x: "B", y: 2 },
          ],
        },
      ],
      orientation: "h",
    });
    await chart.ready();
    const trace = (
      callsTo(fake.calls, "react")[0].args[1] as Array<{
        x: unknown;
        y: unknown;
        orientation: string;
      }>
    )[0];
    expect(trace.orientation).toBe("h");
    expect(trace.x).toEqual([1, 2]);
    expect(trace.y).toEqual(["A", "B"]);
    chart.dispose();
  });

  it("series.type=line emits a scatter trace instead of a bar", async () => {
    const chart = new BarChart(container, {
      series: [
        { id: "bar", points: [{ x: 0, y: 1 }] },
        { id: "line", type: "line", points: [{ x: 0, y: 5 }] },
      ],
    });
    await chart.ready();
    const traces = callsTo(fake.calls, "react")[0].args[1] as Array<{
      type: string;
      mode?: string;
    }>;
    expect(traces[0].type).toBe("bar");
    expect(traces[1].type).toBe("scatter");
    expect(traces[1].mode).toBe("lines+markers");
    chart.dispose();
  });

  it("customdata round-trips through onBarClick", async () => {
    const chart = new BarChart(container, {
      series: [
        {
          id: "a",
          points: [{ x: "A", y: 1, customdata: { kind: "foo" } }],
        },
      ],
    });
    await chart.ready();
    const received: Array<{ customdata?: unknown }> = [];
    chart.onBarClick((e) => received.push({ customdata: e.customdata }));
    fake.fireClick(container, [
      {
        curveNumber: 0,
        pointIndex: 0,
        x: "A",
        y: 1,
        customdata: { kind: "foo" },
      },
    ]);
    expect(received).toEqual([{ customdata: { kind: "foo" } }]);
    chart.dispose();
  });
});
