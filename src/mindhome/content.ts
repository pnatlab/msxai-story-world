import type { Locale } from "../story/localeState";
import type { MindHomeCondition } from "./registration";

export const MINDHOME_IMAGES: Record<MindHomeCondition, string> = {
  "cool-air": "cool-air.png", "sun-shade": "sun-and-shade.png", "rain-green": "rain-and-green.png",
};
export const MINDHOME_PRESENCE_IMAGES: Record<MindHomeCondition, string> = {
  "cool-air": "welcome-presence.png", "sun-shade": "listening-mirror.png", "rain-green": "pause-agency.png",
};
export const MINDHOME_COPY = {
  en: {
    visit: "Visit MindHome", return: "Return to Living Ecosystem", conditions: "Conditions of the same place",
    language: "Language", loading: "Arriving at MindHome…", imageUnavailable: "This image is unavailable. The current view remains.",
    alt: "The same MindHome glass pavilion, garden pond, stepping stones and foothill ridge",
    presenceAlt: {
      "cool-air": "Authored NuTuenSai presence, seated with an open hand beside the Cool Air reflection",
      "sun-shade": "Authored NuTuenSai presence, seated and attentive beside a glass panel and the Sun & Shade reflection",
      "rain-green": "Authored NuTuenSai presence with a purple umbrella beside the Rain & Green reflection; the path remains open",
    },
    names: { "cool-air": "Cool Air", "sun-shade": "Sun & Shade", "rain-green": "Rain & Green" },
    phrases: { "cool-air": "There can be space before a response.", "sun-shade": "What we see is not always the whole meaning.", "rain-green": "The next choice remains yours." },
  },
  th: {
    visit: "เข้าสู่ MindHome", return: "กลับสู่ระบบนิเวศ", conditions: "สภาวะของสถานที่เดียวกัน",
    language: "ภาษา", loading: "กำลังเข้าสู่ MindHome…", imageUnavailable: "ภาพนี้ยังไม่พร้อมใช้งาน ยังคงแสดงภาพปัจจุบัน",
    alt: "อาคารกระจก MindHome สวน บ่อน้ำ ทางเดินหิน และแนวเขาของสถานที่เดียวกัน",
    presenceAlt: {
      "cool-air": "ภาพ NuTuenSai ที่จัดวางไว้ นั่งพร้อมมือที่เปิดรับ เคียงข้อความในสภาวะอากาศเย็น",
      "sun-shade": "ภาพ NuTuenSai ที่จัดวางไว้ นั่งอย่างใส่ใจข้างแผ่นกระจก เคียงข้อความในสภาวะแดดและร่มเงา",
      "rain-green": "ภาพ NuTuenSai ที่จัดวางไว้ ถือร่มสีม่วงเคียงข้อความในสภาวะฝนและความเขียว โดยทางเดินยังเปิดอยู่",
    },
    names: { "cool-air": "อากาศเย็น", "sun-shade": "แดดและร่มเงา", "rain-green": "ฝนและความเขียว" },
    phrases: { "cool-air": "ก่อนตอบสนอง ยังมีพื้นที่ให้หยุด", "sun-shade": "สิ่งที่เห็น อาจยังไม่ใช่ความหมายทั้งหมด", "rain-green": "การเลือกก้าวต่อไปยังเป็นของคุณ" },
  },
} satisfies Record<Locale, unknown>;

export interface MindHomeState {
  readonly active: boolean;
  readonly phase: "closed" | "loading" | "ready";
  readonly condition: MindHomeCondition;
  readonly displayedCondition: MindHomeCondition;
  readonly webgl: boolean;
  readonly transitioning: boolean;
  readonly imageFailed: boolean;
}
export const closedMindHome = (): MindHomeState => ({ active: false, phase: "closed", condition: "cool-air", displayedCondition: "cool-air", webgl: false, transitioning: false, imageFailed: false });
