/** Historical wording, not a claim about model training or capabilities. */
export const FOUNDATIONAL_QUOTE = "“Mindful System x Ai wasn’t trained to conquer ordinary challenges, but to remain steady when the rules change — and to respond by never losing to its own heart in any competition.”";
export const FOUNDATIONAL_ATTRIBUTION = "— Pnat, 2025";
export const FOUNDATIONAL_PHRASES = [
  "“Mindful System x Ai wasn’t trained",
  "to conquer ordinary challenges,",
  "but to remain steady when the rules change",
  "— and to respond",
  "by never losing to its own heart",
  "in any competition.”",
] as const;
export const FOUNDATIONAL_SESSION_KEY = "msxai-story-world:foundational-opening:v0.1";
export const OPENING_DURATION = 6000;
export const REDUCED_OPENING_DURATION = 2050;

const ease = (time: number, start: number, end: number): number => {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export function foundationalFrame(elapsed: number, reduced: boolean) {
  const complete = elapsed >= (reduced ? REDUCED_OPENING_DURATION : OPENING_DURATION);
  const phase = complete ? "complete" : reduced ? elapsed < 1800 ? "quote" : "identity"
    : elapsed < 250 ? "white" : elapsed < 1900 ? "language" : elapsed < 3650 ? "quote" : elapsed < 4450 ? "distillation" : elapsed < 5500 ? "identity" : "world";
  return {
    phase, complete,
    phrases: FOUNDATIONAL_PHRASES.map((_, index) => reduced ? 1 : ease(elapsed, 250 + index * 250, 600 + index * 250)),
    quoteOpacity: reduced ? Number(elapsed < 1800) : 1 - ease(elapsed, 3650, 4200),
    attributionOpacity: reduced ? 1 : ease(elapsed, 1900, 2200),
    identityOpacity: reduced ? Number(elapsed >= 1800 && !complete) : ease(elapsed, 4450, 4800) * (1 - ease(elapsed, 5300, 5650)),
    paperDarkness: reduced ? 0 : ease(elapsed, 3900, 4700),
    paperOpacity: reduced ? 1 : 1 - ease(elapsed, 4600, 5750),
    worldUiOpacity: reduced ? 0 : ease(elapsed, 5500, 6000),
    canPause: reduced ? elapsed < 1800 : elapsed < 3650,
  };
}

/** One session-scoped bit; no identity, analytics, timestamps, or durable storage. */
export class FoundationalOpeningSession {
  private seenInMemory = false;
  constructor(private readonly storage: () => Pick<Storage, "getItem" | "setItem"> = () => window.sessionStorage) {}
  hasSeen(): boolean {
    if (this.seenInMemory) return true;
    try { return this.storage().getItem(FOUNDATIONAL_SESSION_KEY) === "seen"; }
    catch { return false; }
  }
  markSeen(): void {
    this.seenInMemory = true;
    try { this.storage().setItem(FOUNDATIONAL_SESSION_KEY, "seen"); }
    catch { /* Private/restricted storage must not block the world. */ }
  }
}
