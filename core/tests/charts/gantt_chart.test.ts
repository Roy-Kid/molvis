import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { GanttChart } from "../../src/charts/gantt_chart";
import { __setPlotlyForTesting } from "../../src/charts/plotly_loader";
import { callsTo, createFakePlotly, type FakePlotly } from "./_fake_plotly";

const COLORS = {
  running: "#3b82f6",
  succeeded: "#10b981",
  failed: "#ef4444",
};

describe("GanttChart", () => {
  let fake: FakePlotly;
  let container: HTMLDivElement;

  beforeEach(() => {
    fake = createFakePlotly();
    __setPlotlyForTesting(fake.module);
    container = document.createElement("div");
    container.style.width = "600px";
    container.style.height = "300px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    __setPlotlyForTesting(null);
  });

  it("mounts one trace per status group", async () => {
    const chart = new GanttChart(container, {
      tasks: [
        {
          id: "r1",
          label: "run-1",
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T00:05:00Z"),
          statusGroup: "succeeded",
        },
        {
          id: "r2",
          label: "run-2",
          start: new Date("2024-01-01T00:01:00Z"),
          end: new Date("2024-01-01T00:06:00Z"),
          statusGroup: "failed",
        },
        {
          id: "r3",
          label: "run-3",
          start: new Date("2024-01-01T00:02:00Z"),
          end: new Date("2024-01-01T00:07:00Z"),
          statusGroup: "succeeded",
        },
      ],
      statusColors: COLORS,
    });
    await chart.ready();
    expect(callsTo(fake.calls, "react")).toHaveLength(1);
    expect(fake.traceCount(container)).toBe(2);
    chart.dispose();
  });

  it("respects statusOrder in trace ordering", async () => {
    const chart = new GanttChart(container, {
      tasks: [
        {
          id: "r1",
          label: "run-1",
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T00:05:00Z"),
          statusGroup: "succeeded",
        },
        {
          id: "r2",
          label: "run-2",
          start: new Date("2024-01-01T00:01:00Z"),
          end: new Date("2024-01-01T00:06:00Z"),
          statusGroup: "running",
        },
      ],
      statusColors: COLORS,
      statusLabels: { running: "Running", succeeded: "Done" },
      statusOrder: ["running", "succeeded"],
    });
    await chart.ready();
    const traces = (callsTo(fake.calls, "react")[0].args[1] ?? []) as Array<{
      name: string;
    }>;
    expect(traces.map((t) => t.name)).toEqual(["Running", "Done"]);
    chart.dispose();
  });

  it("onTaskClick decodes the (start,end,null) triplet back to a task", async () => {
    const chart = new GanttChart(container, {
      tasks: [
        {
          id: "r1",
          label: "run-1",
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T00:05:00Z"),
          statusGroup: "succeeded",
          customdata: { kind: "run" },
        },
        {
          id: "r2",
          label: "run-2",
          start: new Date("2024-01-01T00:01:00Z"),
          end: new Date("2024-01-01T00:06:00Z"),
          statusGroup: "succeeded",
        },
      ],
      statusColors: COLORS,
    });
    await chart.ready();
    const received: Array<{ taskId: string; customdata?: unknown }> = [];
    chart.onTaskClick((e) =>
      received.push({ taskId: e.taskId, customdata: e.customdata }),
    );
    // Click on the second segment of trace 0 → triplet offset 3-5 = task 1.
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 4, x: 0, y: 0 }]);
    expect(received).toEqual([{ taskId: "r2", customdata: undefined }]);
    // Click on the first segment of task 1 still resolves to task 0.
    received.length = 0;
    fake.fireClick(container, [{ curveNumber: 0, pointIndex: 1, x: 0, y: 0 }]);
    expect(received).toEqual([{ taskId: "r1", customdata: { kind: "run" } }]);
    chart.dispose();
  });

  it("falls back to gray for unknown status groups", async () => {
    const chart = new GanttChart(container, {
      tasks: [
        {
          id: "r1",
          label: "run-1",
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T00:05:00Z"),
          statusGroup: "weird",
        },
      ],
      statusColors: {},
    });
    await chart.ready();
    const traces = (callsTo(fake.calls, "react")[0].args[1] ?? []) as Array<{
      line: { color: string };
    }>;
    expect(traces[0].line.color).toBe("#a3a3a3");
    chart.dispose();
  });

  it("height scales with the number of unique row labels", async () => {
    const chart = new GanttChart(container, {
      tasks: Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        label: `run-${i}`,
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-01T00:05:00Z"),
        statusGroup: "succeeded" as const,
      })),
      statusColors: COLORS,
      rowHeight: 30,
    });
    await chart.ready();
    const layout = fake.lastLayout(container) ?? {};
    expect(layout.height).toBe(30 * 10 + 90);
    chart.dispose();
  });
});
