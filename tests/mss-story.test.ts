import { describe, expect, it } from "vitest";
import { CHAPTER_STOPS, clampProgress, frameAt, phaseAt } from "../src/mss/story";

describe("MSS scroll mapping", () => {
  it("clamps invalid or out-of-range scroll without indexing past the last chapter", () => {
    expect([NaN, -1, 0, .249, .25, .499, .5, .749, .75, 1, 2].map(phaseAt))
      .toEqual([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3]);
    expect(clampProgress(Infinity)).toBe(0);
  });

  it("keeps chapter shortcuts inside the four available phases", () => {
    expect(CHAPTER_STOPS.map(phaseAt)).toEqual([0, 1, 2, 3]);
    expect(frameAt(.364, false)).toBe(.364);
  });

  it("holds a single still per chapter with Reduced Motion in either direction", () => {
    const forward = [0, .21, .3, .4, .52, .73, .76, 1];
    const frames = forward.map(progress => frameAt(progress, true));
    expect(new Set(frames).size).toBe(4);
    expect([...forward].reverse().map(progress => frameAt(progress, true))).toEqual([...frames].reverse());
    expect(frames.map(phaseAt)).toEqual(forward.map(phaseAt));
  });
});
