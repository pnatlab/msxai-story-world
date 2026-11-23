import { describe, expect, it } from "vitest";
import { workspaceMotion } from "../src/mss/workspaceMotion";

describe("MSS workspace motion", () => {
  it("settles the single arrival pulse without opening the workspace", () => {
    expect(workspaceMotion(0, 0, undefined, false)).toMatchObject({ pulse: 0, reveal: 0, done: false, needsFrame: true });
    expect(workspaceMotion(475, 0, undefined, false).pulse).toBeCloseTo(1);
    expect(workspaceMotion(950, 0, undefined, false)).toEqual({ pulse: 0, reveal: 0, done: false, needsFrame: false });
  });

  it("reveals only with an invitation, finishes once, and supports an immediate cut", () => {
    expect(workspaceMotion(1340, 0, 1000, false)).toEqual({ pulse: 0, reveal: .5, done: false, needsFrame: true });
    expect(workspaceMotion(1680, 0, 1000, false)).toEqual({ pulse: 0, reveal: 1, done: true, needsFrame: false });
    expect(workspaceMotion(1000, 0, 1000, true)).toEqual({ pulse: 0, reveal: 1, done: true, needsFrame: false });
    expect(workspaceMotion(475, 0, undefined, true)).toEqual({ pulse: 0, reveal: 0, done: false, needsFrame: false });
  });
});
