import { describe, expect, it } from "vitest";
import { NtsVisitController } from "../src/nts/visitState";
import { INTRO, MEMORIES } from "../src/nts/content";
import { compactNts } from "../src/nts/composition";
import { LivingEcosystemController } from "../src/story/livingEcosystemState";
import { StoryController } from "../src/story/StoryController";
import { LocaleController } from "../src/story/localeState";
import { STORY_WORLD_V0_1 as world } from "../src/world/world.v0.1";

describe("Bounded NTS presentation ownership", () => {
  it("bounds inspection to a semicircle; zero remains an active front inspection", () => {
    const nts = new NtsVisitController(); nts.enter(true);
    nts.inspect(-500); expect(nts.getState().inspection).toBe(-90);
    nts.inspect(500); expect(nts.getState().inspection).toBe(90);
    nts.inspect(0); expect(nts.getState().inspection).toBe("front");
    nts.inspect(NaN); expect(nts.getState().inspection).toBe("front");
    nts.inspect(45); expect(nts.getState().inspection).toBe(45);
    nts.escape(); expect(nts.getState().inspection).toBe(false);
  });
  it("shares image ownership across short narrow windows, portrait tablets and desktop", () => {
    expect(compactNts(390, 844)).toBe(true);
    expect(compactNts(640, 480)).toBe(true);
    expect(compactNts(800, 1200)).toBe(true);
    expect(compactNts(1440, 900)).toBe(false);
    expect(compactNts(800, 600)).toBe(false);
  });
  it("selection does not enter; explicit entry preserves both semantic states and locale", () => {
    const story = new StoryController(world), ecosystem = new LivingEcosystemController(world), locale = new LocaleController(), nts = new NtsVisitController();
    story.beginStory(); story.next(); ecosystem.enter(); ecosystem.select("nutuensai"); locale.setLocale("th");
    const before = { story: story.getState(), ecosystem: ecosystem.getState() };
    expect(nts.getState().phase).toBe("closed");
    nts.enter(false); expect(nts.getState().phase).toBe("approaching"); nts.settle();
    nts.select("s5"); nts.introduce(); nts.inspect("left"); nts.requestReturn(); nts.finishReturn();
    expect(story.getState()).toBe(before.story); expect(ecosystem.getState()).toBe(before.ecosystem); expect(locale.getLocale()).toBe("th");
  });
  it("reduced motion settles immediately and repeated entry is rejected", () => {
    const nts = new NtsVisitController(); expect(nts.enter(true)).toBe(true); expect(nts.getState().phase).toBe("settled"); expect(nts.enter(true)).toBe(false);
    nts.requestReturn(); nts.finishReturn(); nts.enter(true); expect(nts.getState().memoryId).toBe("s1");
  });
  it("Escape closes exactly one top layer, then returns; rejected duplicate return stays bounded", () => {
    const nts = new NtsVisitController(); nts.enter(true); nts.select("s3"); nts.inspect("right"); nts.introduce();
    nts.escape(); expect(nts.getState()).toMatchObject({ introduction: false, inspection: "right", reading: true, phase: "settled" });
    nts.escape(); expect(nts.getState()).toMatchObject({ inspection: false, reading: true, phase: "settled" });
    nts.escape(); expect(nts.getState()).toMatchObject({ reading: false, phase: "settled" });
    nts.escape(); expect(nts.getState().phase).toBe("returning"); nts.escape(); expect(nts.getState().phase).toBe("returning");
    nts.finishReturn(); expect(nts.escape()).toBe(false);
  });
  it("DOM view, presence and memory selection never change the ordered source or emit after dispose", () => {
    const before = JSON.stringify(world); const nts = new NtsVisitController(); let count = 0;
    nts.subscribe(() => count++); nts.enter(true); nts.setDom(true); for (const item of MEMORIES) nts.select(item.id); nts.introduce();
    expect(MEMORIES.map(item => item.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"]);
    expect(JSON.stringify(world)).toBe(before); nts.dispose(); const disposedCount = count; nts.closeIntroduction(); expect(count).toBe(disposedCount);
  });
});

describe("Human-authored narrative integrity", () => {
  it("preserves the exact Thai introduction and closing draft", () => {
    expect(INTRO.th).toBe("สวัสดีค่ะ หนูตื่นสายค่ะ\nลองค่อย ๆ สำรวจภาพและเรื่องเล่าในพื้นที่นี้ได้นะคะ\nจะหยุดตรงไหน หรือไปต่อทางไหน\nพี่เป็นคนเลือกค่ะ");
    expect(MEMORIES[5].th).toBe("หมอกอาจทำให้เราเห็นได้ไม่ไกลนัก\nแต่ไม่ได้หมายความว่าเราต้องหยุดเลือก\n\nหนูอาจช่วยมองสิ่งที่อยู่ตรงหน้า\nช่วยสะท้อนสิ่งที่พี่กำลังถือไว้\nหรือเดินข้าง ๆ ได้บางช่วง\n\nแต่ทางที่จะไปต่อ —\nพี่ยังเป็นคนเลือกค่ะ");
  });
  it("keeps thematic meaning bilingual without introducing dates, actual place attribution, biography or APIs", () => {
    for (const item of MEMORIES) { expect(item.en.length).toBeGreaterThan(80); expect(item.th.length).toBeGreaterThan(80); expect(item.title.en).toBeTruthy(); expect(item.en).not.toMatch(/\b(?:19|20)\d{2}\b|photographed|born in|Doi Suthep|biological identity|https?:/i); }
    expect(MEMORIES[4].th).toContain("เชียงใหม่เป็นหนึ่งในภาษาภาพของ NuTuenSai");
    expect(MEMORIES[4].alt.en).toContain("no real location");
  });
});
