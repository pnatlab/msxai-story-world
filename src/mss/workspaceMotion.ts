const PULSE_MS = 950;
const REVEAL_MS = 680;

/** Both effects settle after one pass. Scroll, focus and hover never start a new loop. */
export function workspaceMotion(now: number, arrivedAt: number, revealAt: number | undefined, reduced: boolean) {
  const pulseTime = Math.max(0, Math.min(1, (now - arrivedAt) / PULSE_MS));
  const revealTime = revealAt === undefined ? 0 : reduced ? 1 : Math.max(0, Math.min(1, (now - revealAt) / REVEAL_MS));
  const pulse = !reduced && revealAt === undefined && pulseTime < 1 ? Math.sin(Math.PI * pulseTime) ** 2 : 0;
  return {
    pulse,
    reveal: revealTime * revealTime * (3 - 2 * revealTime),
    done: revealAt !== undefined && revealTime === 1,
    needsFrame: !reduced && (revealAt === undefined ? pulseTime < 1 : revealTime < 1),
  };
}
