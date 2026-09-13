import type { Locale } from "./story/localeState";
import type { StoryBeat, StoryWorldDefinition, WorldNode } from "./world/world.schema";

export interface LocalizedText {
  readonly en: string;
  readonly th: string;
}

export interface UiCopy {
  readonly foundationalStatement: string;
  readonly skipOpening: string;
  readonly pauseOpening: string;
  readonly continueOpening: string;
  readonly livingEcosystem: string;
  readonly exitEcosystem: string;
  readonly viewEcosystem: string;
  readonly relatedConcepts: string;
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
  readonly currentStoryBeat: string;
  readonly accessibleConceptMap: string;
  readonly declaredRelationships: string;
  readonly useSameConceptualMap: string;
  readonly returnToStoryView: string;
  readonly closeAbout: string;
  readonly meaning: string;
  readonly language: string;
  readonly soundOnState: string;
  readonly soundOffState: string;
  readonly turnSoundOn: string;
  readonly turnSoundOff: string;
  readonly soundControl: string;
  readonly conceptAnchors: string;
  readonly storyControls: string;
  readonly unavailable3d: string;
}

export const UI_COPY: Record<Locale, UiCopy> = {
  en: {
    foundationalStatement: "Foundational statement · 2025",
    skipOpening: "Skip opening",
    pauseOpening: "Pause to read",
    continueOpening: "Continue",
    livingEcosystem: "Living Ecosystem",
    exitEcosystem: "Return to Story World",
    viewEcosystem: "View whole ecosystem",
    relatedConcepts: "Conceptual connections",
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
    conceptualRelationships: "Relationships in this world describe conceptual connections, not runtime architecture or data flow.",
    currentStoryBeat: "Current story beat",
    accessibleConceptMap: "Accessible concept map",
    declaredRelationships: "Declared relationships",
    useSameConceptualMap: "Use the same conceptual anchors, relationships, and story order without the spatial scene.",
    returnToStoryView: "Return to Story View",
    closeAbout: "Close About",
    meaning: "Meaning",
    language: "Language",
    soundOnState: "Sound On",
    soundOffState: "Sound Off",
    turnSoundOn: "Turn interaction sound on",
    turnSoundOff: "Turn interaction sound off",
    soundControl: "Interaction sound",
    conceptAnchors: "Concept anchors",
    storyControls: "Story controls",
    unavailable3d: "3D Story View is unavailable in this browser. The accessible Story List remains fully available.",
  },
  th: {
    foundationalStatement: "ถ้อยคำตั้งต้น · 2025",
    skipOpening: "ข้ามบทเปิด",
    pauseOpening: "หยุดเพื่ออ่าน",
    continueOpening: "ดำเนินต่อ",
    livingEcosystem: "ภาพรวมระบบนิเวศ",
    exitEcosystem: "กลับสู่โลกเรื่องเล่า",
    viewEcosystem: "ดูระบบนิเวศทั้งหมด",
    relatedConcepts: "ความเชื่อมโยงเชิงแนวคิด",
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
    conceptualRelationships: "ความสัมพันธ์ในโลกนี้แสดงความเชื่อมโยงเชิงแนวคิด ไม่ใช่สถาปัตยกรรมการทำงานหรือการไหลของข้อมูลจริง",
    currentStoryBeat: "จังหวะเรื่องเล่าปัจจุบัน",
    accessibleConceptMap: "แผนผังแนวคิดที่เข้าถึงได้",
    declaredRelationships: "ความสัมพันธ์ที่ประกาศไว้",
    useSameConceptualMap: "ใช้จุดยึดเชิงแนวคิด ความสัมพันธ์ และลำดับเรื่องเล่าเดียวกันโดยไม่ต้องใช้ฉากเชิงพื้นที่",
    returnToStoryView: "กลับสู่มุมมองเรื่องเล่า",
    closeAbout: "ปิดเกี่ยวกับ",
    meaning: "ความหมาย",
    language: "ภาษา",
    soundOnState: "เปิดเสียงอยู่",
    soundOffState: "ปิดเสียงอยู่",
    turnSoundOn: "เปิดเสียงตอบสนอง",
    turnSoundOff: "ปิดเสียงตอบสนอง",
    soundControl: "เสียงตอบสนอง",
    conceptAnchors: "จุดยึดเชิงแนวคิด",
    storyControls: "การควบคุมเรื่องเล่า",
    unavailable3d: "มุมมองเรื่องเล่า 3 มิติไม่พร้อมใช้งานในเบราว์เซอร์นี้ แต่รายการเรื่องเล่าที่เข้าถึงได้ยังใช้งานได้เต็มรูปแบบ",
  },
};

export const MEANING_COPY: Record<Locale, { readonly title: string; readonly editorialParagraph: string; readonly relationshipClarification: string }> = {
  en: {
    title: "An explorable conceptual world",
    editorialParagraph: "The ocean, anchors, ambient points, and connections are conceptual editorial structure. Ambient points carry no concepts. Exploration does not perform work, send a request, or change MSS.",
    relationshipClarification: "Relationships in this world describe conceptual connections, not runtime architecture or data flow.",
  },
  th: {
    title: "โลกเชิงแนวคิดที่สามารถสำรวจได้",
    editorialParagraph: "มหาสมุทร จุดยึด จุดแวดล้อม และเส้นเชื่อมต่าง ๆ เป็นโครงสร้างเชิงแนวคิดที่ใช้ในการเล่าและจัดวางเนื้อหา จุดแวดล้อมไม่ได้เป็นตัวแทนของแนวคิดใด ๆ และการสำรวจโลกนี้ไม่ได้สั่งให้ระบบทำงาน ไม่ได้ส่งคำขอ และไม่ได้เปลี่ยนแปลง MSS",
    relationshipClarification: "ความสัมพันธ์ในโลกนี้แสดงความเชื่อมโยงเชิงแนวคิด ไม่ใช่สถาปัตยกรรมการทำงานหรือการไหลของข้อมูลจริง",
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
    msxai: { en: "Meet the Ecosystem", th: "พบกับระบบนิเวศ" },
    "living-ecosystem": { en: "Meet MindHome", th: "ทำความรู้จัก MindHome" },
    mindhome: { en: "Meet MSS", th: "ทำความรู้จัก MSS" },
    mss: { en: "Meet Mindful Health Balance", th: "ทำความรู้จัก Mindful Health Balance" },
    mhb: { en: "Meet Wave Glass / Project H", th: "ทำความรู้จัก Wave Glass / Project H" },
    "wave-glass-project-h": { en: "Meet NuTuenSai", th: "ทำความรู้จัก NuTuenSai" },
    nutuensai: { en: "Meet LLi", th: "ทำความรู้จัก LLi" },
    lli: { en: "Return the Agency", th: "คืนอำนาจการกำหนดและตัดสินใจให้มนุษย์" },
  };
  const label = labels[beat.id];
  return label ? localizedText(label, locale) : undefined;
}

export function localizedWorldTitle(locale: Locale): string {
  return locale === "en" ? "MSxAI 3D Story World" : "โลกเรื่องเล่า 3 มิติของ MSxAI";
}
