import type { Locale } from "../story/localeState";

/** Curated presentation colors only; not persona, memory or StoryState. */
export const OUTFIT_COLORS = { blue: "#8ea7ad", white: "#dce5e6", black: "#252b30" } as const;
export const MASK_COLORS = { lavender: "#c9c3d8", white: "#eaf2f4" } as const;
export type OutfitColor = keyof typeof OUTFIT_COLORS;
export type MaskColor = keyof typeof MASK_COLORS;
export const DEFAULT_APPEARANCE = { outfit: "blue", mask: "lavender" } as const;
export const APPEARANCE_COPY = {
  en: { colors: "Colors", title: "Appearance", outfit: "Outfit", mask: "Mask", blue: "Blue", white: "White", black: "Black", lavender: "Lavender" },
  th: { colors: "สี", title: "การแสดงผล", outfit: "ชุด", mask: "หน้ากาก", blue: "ฟ้า", white: "ขาว", black: "ดำ", lavender: "ม่วงอ่อน" },
} satisfies Record<Locale, Record<string, string>>;
