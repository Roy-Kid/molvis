import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { LineChart } from "../src/line_chart";
import { __setPlotlyForTesting } from "../src/plotly_loader";
import { callsTo, createFakePlotly, type FakePlotly } from "./_fake_plotly";

describe("LineChart layout extensions", () => {
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

  it("hovertemplate / hovermode / showLegend / modebarRemove reach plotly", async () => {
    const chart = new LineChart(container, {
      series: [
        { id: "a", hovertemplate: "%{y:.6g}<extra></extra>" },
        { id: "b" },
      ],
      hovertemplate: "%{y:.3f}<extra></extra>",
      hovermode: "x unified",
      showLegend: true,
      modebar: true,
      modebarRemove: ["lasso2d", "toggleSpikelines"],
    });
    await chart.ready();
    const traces = callsTo(fake.calls, "newPlot")[0].args[1] as Array<{
      hovertemplate?: string;
    }>;
    expect(traces[0].hovertemplate).toBe("%{y:.6g}<extra></extra>");
    expect(traces[1].hovertemplate).toBe("%{y:.3f}<extra></extra>");
    const layout = fake.lastLayout(container) ?? {};
    expect(layout.hovermode).toBe("x unified");
    expect(layout.showlegend).toBe(true);
    const cfg = callsTo(fake.calls, "newPlot")[0].args[3] as Record<
      string,
      unknown
    >;
    expect(cfg.modeBarButtonsToRemove).toEqual(["lasso2d", "toggleSpikelines"]);
    chart.dispose();
  });

  it("series.mode + series.width override defaults", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a", mode: "lines+markers", width: 3 }],
    });
    await chart.ready();
    const traces = callsTo(fake.calls, "newPlot")[0].args[1] as Array<{
      mode: string;
      line: { width: number };
    }>;
    expect(traces[0].mode).toBe("lines+markers");
    expect(traces[0].line.width).toBe(3);
    chart.dispose();
  });
});
