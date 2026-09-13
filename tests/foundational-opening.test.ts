import { describe, expect, it } from "vitest";
import { FOUNDATIONAL_ATTRIBUTION, FOUNDATIONAL_PHRASES, FOUNDATIONAL_QUOTE, FOUNDATIONAL_SESSION_KEY, foundationalFrame, FoundationalOpeningSession, OPENING_DURATION, REDUCED_OPENING_DURATION } from "../src/ui/foundationalOpeningModel";

describe("Foundational opening's bounded presentation model", () => {
  it("preserves the exact historical English quote, punctuation, and attribution", () => {
    expect(FOUNDATIONAL_QUOTE).toBe("“Mindful System x Ai wasn’t trained to conquer ordinary challenges, but to remain steady when the rules change — and to respond by never losing to its own heart in any competition.”");
    expect(FOUNDATIONAL_PHRASES.join(" ")).toBe(FOUNDATIONAL_QUOTE);
    expect(FOUNDATIONAL_ATTRIBUTION).toBe("— Pnat, 2025");
  });
  it("starts plain white and forms phrases without hiding the complete source from assistive technology", () => {
    expect(foundationalFrame(0, false)).toMatchObject({ phase: "white", paperDarkness: 0, paperOpacity: 1, identityOpacity: 0, worldUiOpacity: 0 });
    expect(foundationalFrame(0, false).phrases).toEqual([0, 0, 0, 0, 0, 0]);
    expect(foundationalFrame(700, false).phrases[0]).toBe(1);
    expect(foundationalFrame(700, false).phrases[5]).toBe(0);
  });
  it("holds the fully readable quote and attribution before distilling into identity", () => {
    expect(foundationalFrame(2400, false)).toMatchObject({ phase: "quote", quoteOpacity: 1, attributionOpacity: 1, paperDarkness: 0 });
    expect(foundationalFrame(2400, false).phrases.every((opacity) => opacity === 1)).toBe(true);
    expect(foundationalFrame(4950, false)).toMatchObject({ phase: "identity", quoteOpacity: 0, identityOpacity: 1 });
  });
  it("reveals the existing world and completes at six seconds", () => {
    expect(foundationalFrame(5800, false).worldUiOpacity).toBeGreaterThan(0);
    expect(foundationalFrame(OPENING_DURATION, false)).toMatchObject({ complete: true, paperOpacity: 0, identityOpacity: 0, worldUiOpacity: 1 });
  });
  it("has no animated interpolation in the abbreviated reduced-motion presentation", () => {
    expect(foundationalFrame(0, true)).toMatchObject({ phase: "quote", quoteOpacity: 1, attributionOpacity: 1 });
    expect(foundationalFrame(1900, true)).toMatchObject({ phase: "identity", quoteOpacity: 0, identityOpacity: 1, paperDarkness: 0 });
    expect(foundationalFrame(REDUCED_OPENING_DURATION, true).complete).toBe(true);
  });
  it("keeps every interpolation bounded with no repeating animation", () => {
    for (const reduced of [false, true]) for (const time of [-100, 0, 251, 1500, 3000, 4200, 4800, 5700, 6000, 60000]) {
      const frame = foundationalFrame(time, reduced);
      for (const value of [...frame.phrases, frame.quoteOpacity, frame.attributionOpacity, frame.identityOpacity, frame.paperDarkness, frame.paperOpacity, frame.worldUiOpacity]) {
        expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("Session-only opening preference", () => {
  it("writes only one flag on completion/skip and recognizes a subsequent page instance", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const first = new FoundationalOpeningSession(() => storage);
    expect(first.hasSeen()).toBe(false); expect(data.size).toBe(0);
    first.markSeen(); expect(first.hasSeen()).toBe(true);
    expect([...data]).toEqual([[FOUNDATIONAL_SESSION_KEY, "seen"]]);
    expect(new FoundationalOpeningSession(() => storage).hasSeen()).toBe(true);
  });
  it("fails safely when access to sessionStorage itself is denied", () => {
    const session = new FoundationalOpeningSession(() => { throw new Error("SecurityError"); });
    expect(session.hasSeen()).toBe(false);
    expect(() => session.markSeen()).not.toThrow();
    expect(session.hasSeen()).toBe(true);
  });
  it("fails safely when storage quota is unavailable", () => {
    const session = new FoundationalOpeningSession(() => ({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } }));
    session.markSeen(); expect(session.hasSeen()).toBe(true);
  });
});
