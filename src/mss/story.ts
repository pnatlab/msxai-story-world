import { PRODUCT_IDENTITIES } from "../world/productIdentity";

export const MSS_COPY = {
  en: {
    visit: "Visit MSS Story",
    return: "Return to Living Ecosystem",
    language: "Language",
    title: "Above the Mist",
    workspace: "Human–AI Workspace",
    scroll: "Scroll to follow the light",
    chapters: "Story chapters",
    phases: [
      ["Before the Light", "Every system begins with an intention."],
      ["Through the Mist", "Understanding begins before the answer."],
      ["The Living System", "Intelligence can assist. Human intention leads."],
      ["After the Light", "Human in control · Replaceable intelligence, replaceable hands."],
    ],
  },
  th: {
    visit: "เข้าสู่เรื่องราว MSS",
    return: "กลับสู่ระบบนิเวศ",
    language: "ภาษา",
    title: "เหนือทะเลหมอก",
    workspace: "พื้นที่ทำงานร่วมระหว่างมนุษย์กับ AI",
    scroll: "เลื่อนเพื่อเดินทางไปกับแสง",
    chapters: "ช่วงของเรื่องราว",
    phases: [
      ["ก่อนแสงแรก", "ทุกระบบเริ่มต้นจากเจตนา"],
      ["ผ่านม่านหมอก", "ความเข้าใจเริ่มต้นก่อนคำตอบ"],
      ["ระบบที่มีชีวิต", "ปัญญาประดิษฐ์ช่วยได้ แต่เจตนาของมนุษย์ยังเป็นผู้นำทาง"],
      ["เมื่อแสงลับไป", "มนุษย์ยังคงกำกับทิศทาง · เปลี่ยนได้ทั้งปัญญาที่ใช้และผู้ช่วยลงมือทำ"],
    ],
  },
} as const;

export const MSS_IDENTITY = PRODUCT_IDENTITIES.mss;
export const PHASE_IDS = ["a", "b", "c", "d"] as const;
export const CHAPTER_STOPS = [0, .375, .625, 1] as const;
const STILL_FRAMES = [.10, .39, .62, .96] as const;

export function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0;
}

export function phaseAt(progress: number): number {
  return Math.min(PHASE_IDS.length - 1, Math.floor(clampProgress(progress) * PHASE_IDS.length));
}

export function frameAt(progress: number, reducedMotion: boolean): number {
  return reducedMotion ? STILL_FRAMES[phaseAt(progress)] : clampProgress(progress);
}
