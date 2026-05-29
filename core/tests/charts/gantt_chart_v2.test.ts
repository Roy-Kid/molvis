import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { GanttChart } from "../../src/charts/gantt_chart";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { callsTo, createFakePlotly, type FakePlotly } from "./_fake_plotly";

const COLORS = { running: "#3b82f6", pending: "#a3a3a3" };

describe("GanttChart per-status opacity + null-gap click guard", () => {
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

  it("statusOpacity is forwarded as trace opacity", async () => {
    const chart = new GanttChart(container, {
      tasks: [
        {
          id: "p",
          label: "queued",
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T00:05:00Z"),
          statusGroup: "pending",
        },
        {
          id: "r",
          label: "running",
          start: new Date("2024-01-01T00:01:00Z"),
          end: new Date("2024-01-01T00:06:00Z"),
          statusGroup: "running",
        },
      ],
      statusColors: COLORS,
      statusOpacity: { pending: 0.55 },
    });
    await chart.ready();
    const traces = callsTo(fake.calls, "react")[0].args[1] as Array<{
      name: string;
      opacity?: number;
    }>;
    const pending = traces.find((t) => t.name === "pending");
    const running = traces.find((t) => t.name === "running");
    expect(pending?.opacity).toBe(0.55);
    expect(running?.opacity).toBeUndefined();
    chart.dispose();
  });

  it("clicks on the null gap between tasks are ignored", async () => {
    const chart = new GanttChart(container, {
      tasks: [
        {
          id: "a",
          label: "a",
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T00:05:00Z"),
          statusGroup: "running",
        },
        {
          id: "b",
          label: "b",
          start: new Date("2024-01-01T00:06:00Z"),
          end: new Date("2024-01-01T00:11:00Z"),
          statusGroup: "running",
        },
      ],
      statusColors: COLORS,
    });
    await chart.ready();
    const received: string[] = [];
    chart.onTaskClick((e) => received.push(e.taskId));
    // Triplet indices: [0,1,2]=a, [3,4,5]=b. Index 2 is the null gap.
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 2, x: 0, y: 0 }]);
    expect(received).toEqual([]);
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 4, x: 0, y: 0 }]);
    expect(received).toEqual(["b"]);
    chart.dispose();
  });
});
