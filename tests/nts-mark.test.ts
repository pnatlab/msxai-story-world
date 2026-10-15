import { describe, expect, it } from "vitest";
import { NtsVisitController } from "../src/nts/visitState";

describe("Bounded mouse-signature inspection presentation state", () => {
  it("starts outside mark inspection and does not auto-inspect on arrival", () => {
    const nts = new NtsVisitController();
    expect(nts.getState().markInspection).toBe(false);
    nts.enter(false);
    expect(nts.getState()).toMatchObject({ phase: "approaching", markInspection: false });
    nts.settle();
    expect(nts.getState()).toMatchObject({ phase: "settled", markInspection: false });
  });

  it("preserves Presence orientation, memory reading and both color choices on a round-trip", () => {
    const nts = new NtsVisitController(); nts.enter(true);
    nts.select("s4"); nts.inspect(45); nts.setOutfit("black"); nts.setMask("white");
    const before = nts.getState();
    nts.inspectMark(true);
    expect(nts.getState()).toEqual({ ...before, markInspection: true });
    nts.inspectMark(false);
    expect(nts.getState()).toEqual(before);
  });

  it("Escape closes only mark inspection before the existing Presence and memory layers", () => {
    const nts = new NtsVisitController(); nts.enter(true);
    nts.select("s3"); nts.inspect("right"); nts.inspectMark(true);
    expect(nts.escape()).toBe(true);
    expect(nts.getState()).toMatchObject({ phase: "settled", markInspection: false, inspection: "right", reading: true });
    nts.escape();
    expect(nts.getState()).toMatchObject({ phase: "settled", markInspection: false, inspection: false, reading: true });
    nts.escape();
    expect(nts.getState()).toMatchObject({ phase: "settled", markInspection: false, reading: false });
    nts.escape();
    expect(nts.getState()).toMatchObject({ phase: "returning", markInspection: false });
  });

  it("explicit presentation switches clear mark inspection without resetting colors", () => {
    const switches: Array<(nts: NtsVisitController) => void> = [
      nts => nts.select("s2"),
      nts => nts.inspect("left"),
      nts => nts.introduce(),
      nts => nts.setDom(true),
      nts => nts.requestReturn(),
    ];
    for (const switchView of switches) {
      const nts = new NtsVisitController(); nts.enter(true);
      nts.setOutfit("white"); nts.setMask("white"); nts.inspectMark(true);
      expect(nts.getState().markInspection).toBe(true);
      switchView(nts);
      expect(nts.getState()).toMatchObject({ markInspection: false, outfit: "white", mask: "white" });
    }
  });

  it("does not enter mark inspection outside a settled spatial Presence or over its introduction", () => {
    const nts = new NtsVisitController();
    nts.inspectMark(true); expect(nts.getState().markInspection).toBe(false);
    nts.enter(false); nts.inspectMark(true); expect(nts.getState().markInspection).toBe(false);
    nts.settle(); nts.setDom(true); nts.inspectMark(true); expect(nts.getState().markInspection).toBe(false);
    nts.setDom(false); nts.introduce(); nts.inspectMark(true);
    expect(nts.getState()).toMatchObject({ introduction: true, markInspection: false });
    nts.closeIntroduction(); nts.inspectMark(true); expect(nts.getState().markInspection).toBe(true);
    nts.requestReturn(); nts.inspectMark(true); expect(nts.getState().markInspection).toBe(false);
    nts.finishReturn(); nts.inspectMark(true); expect(nts.getState().markInspection).toBe(false);
  });

  it("fresh re-entry resets mark inspection and retains the canonical D.4 entry defaults", () => {
    for (const reduced of [false, true]) {
      const nts = new NtsVisitController(); nts.enter(reduced); nts.settle();
      nts.inspect(-90); nts.setOutfit("black"); nts.setMask("white"); nts.inspectMark(true);
      expect(nts.enter(reduced)).toBe(false);
      expect(nts.getState()).toMatchObject({ markInspection: true, inspection: -90, outfit: "black", mask: "white" });
      nts.requestReturn(); nts.finishReturn(); nts.enter(reduced);
      expect(nts.getState()).toMatchObject({ markInspection: false, inspection: false, outfit: "blue", mask: "lavender", reading: false, memoryId: "s1" });
    }
  });
});
