import { describe, expect, it } from "vitest";
import { APPEARANCE_COPY, DEFAULT_APPEARANCE, MASK_COLORS, OUTFIT_COLORS, type OutfitColor } from "../src/nts/appearance";
import { NtsVisitController } from "../src/nts/visitState";

describe("Visit-local Presence presentation choices", () => {
  it("offers exactly three outfits and two masks with canonical Blue and Lavender defaults", () => {
    expect(OUTFIT_COLORS).toEqual({ blue: "#8ea7ad", white: "#dce5e6", black: "#252b30" });
    expect(MASK_COLORS).toEqual({ lavender: "#c9c3d8", white: "#eaf2f4" });
    expect(DEFAULT_APPEARANCE).toEqual({ outfit: "blue", mask: "lavender" });
  });
  it("switches independently without altering any other visit state", () => {
    const nts = new NtsVisitController(); nts.enter(true); nts.select("s4"); nts.inspect(45);
    const before = nts.getState();
    nts.setOutfit("white"); expect(nts.getState()).toEqual({ ...before, outfit: "white" });
    nts.setMask("white"); expect(nts.getState()).toEqual({ ...before, outfit: "white", mask: "white" });
    nts.setOutfit("black"); expect(nts.getState()).toEqual({ ...before, outfit: "black", mask: "white" });
    nts.setMask("lavender"); expect(nts.getState()).toEqual({ ...before, outfit: "black", mask: "lavender" });
    nts.select("s2"); nts.introduce(); nts.inspect("left"); nts.setDom(true);
    expect(nts.getState()).toMatchObject({ outfit: "black", mask: "lavender" });
  });
  it("retains current-visit choices, rejects repeated entry, and resets only at fresh entry", () => {
    for (const reduced of [false, true]) {
      const nts = new NtsVisitController(); nts.enter(reduced); nts.settle();
      nts.setOutfit("black"); nts.setMask("white");
      expect(nts.enter(reduced)).toBe(false);
      expect(nts.getState()).toMatchObject({ outfit: "black", mask: "white" });
      nts.requestReturn(); nts.finishReturn(); nts.enter(reduced);
      expect(nts.getState()).toMatchObject(DEFAULT_APPEARANCE);
    }
  });
  it("ignores invalid, duplicate, closed, travelling and returning choices", () => {
    const nts = new NtsVisitController(); const closed = nts.getState();
    nts.setOutfit("white"); nts.setMask("white"); expect(nts.getState()).toBe(closed);
    nts.enter(false); const approaching = nts.getState();
    nts.setOutfit("white"); expect(nts.getState()).toBe(approaching);
    nts.settle(); const settled = nts.getState();
    nts.setOutfit("blue"); nts.setMask("lavender"); nts.setOutfit("red" as OutfitColor);
    expect(nts.getState()).toBe(settled);
    nts.requestReturn(); const returning = nts.getState();
    nts.setMask("white"); expect(nts.getState()).toBe(returning);
  });
  it("provides deterministic curated labels in English and Thai", () => {
    expect(APPEARANCE_COPY.en).toMatchObject({ outfit: "Outfit", mask: "Mask", blue: "Blue", white: "White", black: "Black", lavender: "Lavender" });
    expect(APPEARANCE_COPY.th).toMatchObject({ outfit: "ชุด", mask: "หน้ากาก", blue: "ฟ้า", white: "ขาว", black: "ดำ", lavender: "ม่วงอ่อน" });
  });
});
