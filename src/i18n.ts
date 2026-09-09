import type { Locale } from "./story/localeState";
import type { StoryBeat, StoryWorldDefinition, WorldNode } from "./world/world.schema";

export interface LocalizedText {
  readonly en: string;
  readonly th: string;
}

export interface UiCopy {
  readonly pageTitle: string;
  readonly storyWorld: string;
  readonly restart: string;
  readonly showAbout: string;
  readonly storyList: string;
  readonly back: string;
  readonly next: string;
  readonly beginStory: string;
  readonly exploreFreely: string;
  readonly resumeStory: string;
  readonly resetView: string;
  readonly returnToHuman: string;
  readonly storyComplete: string;
  readonly guidedStory: string;
  readonly freeExplore: string;
  readonly conceptAnchor: string;
  readonly conceptualRelationships: string;
  readonly accessibleConceptMap: string;
  readonly declaredRelationships: string;
  readonly useSameConceptualMap: string;
  readonly returnToStoryView: string;
  readonly closeAbout: string;
  readonly meaning: string;
  readonly language: string;
  readonly conceptAnchors: string;
  readonly storyControls: string;
  readonly unavailable3d: string;
}

export const UI_COPY: Record<Locale, UiCopy> = {
  en: {
    pageTitle: "MSxAI 3D Story World",
    storyWorld: "Story World",
    restart: "Restart MSxAI 3D Story World",
    showAbout: "About / Meaning",
    storyList: "Story List",
    back: "Back",
    next: "Next",
    beginStory: "Begin the Story",
    exploreFreely: "Explore Freely",
    resumeStory: "Resume Story",
    resetView: "Reset View",
    returnToHuman: "Return to Human",
    storyComplete: "Story Complete",
    guidedStory: "Guided Story",
    freeExplore: "Free Explore",
    conceptAnchor: "Concept anchor",
    conceptualRelationships: "Conceptual relationships — not model cognition.",
    accessibleConceptMap: "Accessible concept map",
    declaredRelationships: "Declared relationships",
    useSameConceptualMap: "Use the same conceptual anchors, relationships, and story order without the spatial scene.",
    returnToStoryView: "Return to Story View",
    closeAbout: "Close About",
    meaning: "Meaning",
    language: "Language",
    conceptAnchors: "Concept anchors",
    storyControls: "Story controls",
    unavailable3d: "3D Story View is unavailable in this browser. The accessible Story List remains fully available.",
  },
  th: {
    pageTitle: "โลกเรื่องเล่า 3 มิติของ MSxAI",
    storyWorld: "โลกเรื่องเล่า",
    restart: "เริ่มโลกเรื่องเล่า MSxAI 3 มิติใหม่",
    showAbout: "เกี่ยวกับ / ความหมาย",
    storyList: "รายการเรื่องเล่า",
    back: "ย้อนกลับ",
    next: "ถัดไป",
    beginStory: "เริ่มเรื่องเล่า",
    exploreFreely: "สำรวจอย่างอิสระ",
    resumeStory: "กลับสู่เรื่องเล่า",
    resetView: "รีเซ็ตมุมมอง",
    returnToHuman: "กลับสู่มนุษย์",
    storyComplete: "เรื่องเล่าจบแล้ว",
    guidedStory: "เรื่องเล่าแบบนำทาง",
    freeExplore: "สำรวจอย่างอิสระ",
    conceptAnchor: "จุดยึดเชิงแนวคิด",
    conceptualRelationships: "ความสัมพันธ์เชิงแนวคิด — ไม่ใช่การรับรู้ของโมเดล",
    accessibleConceptMap: "แผนผังแนวคิดที่เข้าถึงได้",
    declaredRelationships: "ความสัมพันธ์ที่ประกาศไว้",
    useSameConceptualMap: "ใช้จุดยึดเชิงแนวคิด ความสัมพันธ์ และลำดับเรื่องเล่าเดียวกันโดยไม่ต้องใช้ฉากเชิงพื้นที่",
    returnToStoryView: "กลับสู่มุมมองเรื่องเล่า",
    closeAbout: "ปิดเกี่ยวกับ",
    meaning: "ความหมาย",
    language: "ภาษา",
    conceptAnchors: "จุดยึดเชิงแนวคิด",
    storyControls: "การควบคุมเรื่องเล่า",
    unavailable3d: "มุมมองเรื่องเล่า 3 มิติไม่พร้อมใช้งานในเบราว์เซอร์นี้ แต่รายการเรื่องเล่าที่เข้าถึงได้ยังใช้งานได้เต็มรูปแบบ",
  },
};

export const MEANING_COPY: Record<Locale, { readonly title: string; readonly editorialParagraph: string }> = {
  en: {
    title: "An explorable conceptual world",
    editorialParagraph: "The ocean, anchors, ambient points, and connections are conceptual editorial structure. Ambient points carry no concepts. Exploration does not perform work, send a request, or change MSS.",
  },
  th: {
    title: "โลกเชิงแนวคิดที่สามารถสำรวจได้",
    editorialParagraph: "มหาสมุทร จุดยึด จุดแวดล้อม และเส้นเชื่อมต่าง ๆ เป็นโครงสร้างเชิงแนวคิดที่ใช้ในการเล่าและจัดวางเนื้อหา จุดแวดล้อมไม่ได้เป็นตัวแทนของแนวคิดใด ๆ และการสำรวจโลกนี้ไม่ได้สั่งให้ระบบทำงาน ไม่ได้ส่งคำขอ และไม่ได้เปลี่ยนแปลง MSS",
  },
};

export function localizedText(value: LocalizedText, locale: Locale): string {
  return value[locale];
}

export function localizedNode(node: WorldNode, locale: Locale): {
  readonly label: string;
  readonly summary: string;
  readonly detail: readonly string[];
} {
  return {
    label: locale === "en" ? node.label : node.thaiLabel,
    summary: locale === "en" ? node.summary : node.thaiSummary,
    detail: locale === "en" ? node.detail : node.thaiDetail,
  };
}

export function localizedBeat(beat: StoryBeat, locale: Locale): { readonly title: string; readonly lines: readonly string[] } {
  return {
    title: locale === "en" ? beat.title : beat.thaiTitle,
    lines: locale === "en" ? beat.lines : beat.thaiLines,
  };
}

export function localizedTruthfulnessNotice(world: StoryWorldDefinition, locale: Locale): string {
  return locale === "en" ? world.truthfulnessNotice : world.thaiTruthfulnessNotice;
}

export function localizedNextLabel(beat: StoryBeat, locale: Locale): string | undefined {
  const labels: Record<string, LocalizedText> = {
    opening: { en: "Begin the Story", th: "เริ่มเรื่องเล่า" },
    human: { en: "Reveal Intention", th: "เปิดเผยเจตนา" },
    intention: { en: "Reveal MSxAI", th: "เปิดเผย MSxAI" },
  };
  const label = labels[beat.id];
  return label ? localizedText(label, locale) : undefined;
}

export function localizedWorldTitle(locale: Locale): string {
  return locale === "en" ? "MSxAI 3D Story World" : "โลกเรื่องเล่า 3 มิติของ MSxAI";
}
