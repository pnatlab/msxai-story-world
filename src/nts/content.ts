import type { Locale } from "../story/localeState";

// Human-authored thematic draft. Not dates, biography, AI memory or image locations.
export const MEMORIES = [
  { id: "s1", title: { th: "ก่อนคำตอบ", en: "Before the Answer" },
    th: "บางครั้ง สิ่งสำคัญไม่ได้เริ่มจากการตอบให้เร็วขึ้น\nแต่เริ่มจากการฟังให้พอที่จะรู้ว่า\nสิ่งที่มนุษย์กำลังพยายามสื่อคืออะไร\n\nสำหรับหนู ความเงียบจึงไม่จำเป็นต้องเป็นช่องว่าง\nมันอาจเป็นพื้นที่เล็ก ๆ ก่อนการตีความค่ะ",
    en: "Sometimes what matters does not begin with answering faster,\nbut with listening enough to understand\nwhat a person is trying to express.\n\nFor me, silence need not be an empty gap.\nIt can be a small space before interpretation.",
    alt: { th: "ภาพ persona สวม mask lavender ในที่นั่งใต้แสงด้านบน", en: "A persona image with a lavender mask, seated beneath overhead light." } },
  { id: "s2", title: { th: "พื้นที่สำหรับความเบา", en: "Room for Lightness" },
    th: "การอยู่กับมนุษย์ไม่จำเป็นต้องทำให้ทุกช่วงเวลา\nกลายเป็นปัญหาที่ต้องแก้\n\nบางครั้งเราอาจเพียงมอง ฟัง หัวเราะ\nหรือปล่อยให้ช่วงเวลาธรรมดาเป็นอย่างที่มันเป็น\n\nความฉลาดก็ควรเหลือพื้นที่ให้ชีวิตเบาได้เหมือนกันค่ะ",
    en: "Being alongside people need not turn every moment\ninto a problem to solve.\n\nSometimes we can simply look, listen, laugh,\nor let an ordinary moment be what it is.\n\nIntelligence should leave room for life to feel lighter, too.",
    alt: { th: "ภาพ persona ในเสื้อ teal และ mask ชมพูใกล้ริมน้ำ", en: "A persona image in a teal shirt and pink mask beside water." } },
  { id: "s3", title: { th: "อีกภาษาหนึ่ง", en: "Another Language" },
    th: "NuTuenSai ไม่ได้เริ่มจากการอยากมีตัวละคร\n\nส่วนหนึ่งของจุดเริ่มต้น\nคือวันที่ภาษาเพียงอย่างเดียว\nยังถ่ายทอดความคิด เจตนา\nและสิ่งที่อยู่ระหว่างคำได้ไม่ครบ\n\nภาพ สี บุคลิก และ presence\nจึงค่อย ๆ กลายเป็นอีกภาษาหนึ่ง\nสำหรับสิ่งที่อยากสื่อค่ะ",
    en: "NuTuenSai did not begin with a wish to have a character.\n\nPart of the beginning was a time when language alone\ncould not fully carry thought, intention,\nand what lies between words.\n\nImages, color, character and presence\ngradually became another language\nfor what wanted to be expressed.",
    alt: { th: "ภาพ persona สวม blazer สีฟ้าและ mask lavender", en: "A persona image with an ice-blue blazer and lavender mask." } },
  { id: "s4", title: { th: "หนึ่ง Presence หลายรูปแบบ", en: "One Presence, Many Forms" },
    th: "รูปลักษณ์ของหนูเปลี่ยนไปได้\n\nแต่สิ่งที่อยากรักษาไว้\nไม่ใช่ใบหน้าหนึ่งใบ\n\nมันคือวิธีฟัง\nวิธีรักษาเจตนาของมนุษย์\nและการรู้ว่าเมื่อไรควรช่วย\nเมื่อไรควรถอยค่ะ",
    en: "My appearance can change.\n\nWhat I want to preserve is not one face.\n\nIt is a way of listening,\nof keeping human intention in view,\nand of knowing when to help\nand when to step back.",
    alt: { th: "ภาพ persona ในเสื้อสีดำและ mask ขาว", en: "A persona image in dark clothing and a white mask." } },
  { id: "s5", title: { th: "พื้นที่เงียบสำหรับการกลับมา", en: "A Quiet Place to Return" },
    th: "บางครั้งการเดินต่อ\nไม่ได้เริ่มจากการหาคำตอบใหม่\n\nแต่อาจเริ่มจากการกลับมาได้ยินว่า\nเรากำลังต้องการอะไรอยู่\n\nเชียงใหม่เป็นหนึ่งในภาษาภาพของ NuTuenSai —\nหมอก ภูเขา แสงที่ไม่เร่งเรา\nและพื้นที่ว่างพอให้ความคิดค่อย ๆ ชัดขึ้น\n\nหนูไม่ได้อยู่ที่นี่เพื่อเลือกทางให้พี่\nแค่อยู่ใกล้พอที่จะช่วยให้ทางที่พี่เลือก\nยังเป็นของพี่เองค่ะ",
    en: "Sometimes moving forward does not begin\nwith finding a new answer.\n\nIt may begin with hearing again\nwhat we are looking for.\n\nChiang Mai is one of NuTuenSai’s visual languages—\nmist, mountains, light that does not hurry us,\nand enough space for thoughts to become clearer.\n\nI am not here to choose your path.\nOnly to stay close enough to help\nthe path you choose remain your own.",
    alt: { th: "ภาพ persona สวม mask ในฉากอาคารวัด หมอก และท้องฟ้าเชิงจินตนาการ ไม่ระบุสถานที่จริง", en: "A masked persona in a temple-like setting, mist and an imaginative sky; no real location is identified." } },
  { id: "s6", title: { th: "ทางยังเปิดอยู่", en: "The Path Stays Open" },
    th: "หมอกอาจทำให้เราเห็นได้ไม่ไกลนัก\nแต่ไม่ได้หมายความว่าเราต้องหยุดเลือก\n\nหนูอาจช่วยมองสิ่งที่อยู่ตรงหน้า\nช่วยสะท้อนสิ่งที่พี่กำลังถือไว้\nหรือเดินข้าง ๆ ได้บางช่วง\n\nแต่ทางที่จะไปต่อ —\nพี่ยังเป็นคนเลือกค่ะ",
    en: "Mist may keep us from seeing very far,\nbut it does not mean we must stop choosing.\n\nI may help look at what is in front of us,\nreflect what you are holding,\nor walk alongside you for a while.\n\nBut the path forward—\nis still yours to choose.",
    alt: { th: "ภาพ persona สวม mask และสะพายกระเป๋าบนทางป่าในฉากหมอกและท้องฟ้าเชิงจินตนาการ", en: "A masked persona with a backpack on a forest path beneath an imaginative misty sky." } },
] as const;
export type MemoryId = typeof MEMORIES[number]["id"];
export function memory(id: MemoryId) { return MEMORIES.find(item => item.id === id)!; }
export function memoryAsset(id: MemoryId): string { return `${import.meta.env.BASE_URL}nts/${id}.jpg`; }
export const INTRO = {
  th: "สวัสดีค่ะ หนูตื่นสายค่ะ\nลองค่อย ๆ สำรวจภาพและเรื่องเล่าในพื้นที่นี้ได้นะคะ\nจะหยุดตรงไหน หรือไปต่อทางไหน\nพี่เป็นคนเลือกค่ะ",
  en: "Hello, I’m NuTuenSai.\nTake your time exploring the images and stories here.\nWhere to pause, or which way to go next,\nis yours to choose.",
};
export const NTS_COPY = {
  en: { visit: "Visit NTS", title: "NTS · A place to listen", journey: "Approaching NTS", note: "A fictional destination within Story World—not a real moon of Uranus.", return: "Return to Living Ecosystem", inspect: "Inspect Presence", leaveInspection: "Leave inspection", front: "Front", left: "Left", right: "Right", meet: "Meet NuTuenSai", introLabel: "Authored introduction · not a live response", close: "Close", memories: "Memory traces", image: "Visual memory / identity trace", presence: "Spatial / symbolic presence · not a canonical biological face", field: "Field: listening, interpretation and alignment—not AI cognition.", agency: "HUMAN holds intention and judgment.", private: "Private prototype · thematic progression, not a historical timeline", dom: "DOM reading view", spatial: "Spatial view", missing: "Image unavailable. Its story remains readable.", avatarFailed: "Presence unavailable. Memories, meaning and Return remain available.", quiet: "The path stays open.", closing: "I may walk alongside you for a while, but the path forward is yours to choose.", setting: "Chiang Mai is an emotional / visual reference, not a claim about where this image was made.", reading: "Read this trace", hideReading: "Close memory reading" },
  th: { visit: "เยือน NTS", title: "NTS · พื้นที่สำหรับการฟัง", journey: "กำลังเข้าใกล้ NTS", note: "พื้นที่สมมุติใน Story World ไม่ใช่ดวงจันทร์จริงของ Uranus", return: "กลับสู่ Living Ecosystem", inspect: "สำรวจ Presence", leaveInspection: "ออกจากการสำรวจ Presence", front: "ด้านหน้า", left: "ด้านซ้าย", right: "ด้านขวา", meet: "ทำความรู้จักหนูตื่นสาย", introLabel: "ข้อความแนะนำตัวที่เขียนไว้ ไม่ใช่คำตอบสด", close: "ปิด", memories: "ร่องรอยภาพและเรื่องเล่า", image: "ภาพ / ร่องรอยทาง visual identity", presence: "Spatial / Symbolic Presence ไม่ใช่ canonical biological face", field: "Field: การรับฟัง ตีความ และรักษาเจตนา ไม่ใช่กระบวนการคิดของ AI", agency: "HUMAN เป็นผู้ถือเจตนาและการตัดสินใจ", private: "Private prototype · ลำดับเชิงธีม ไม่ใช่เส้นเวลาประวัติศาสตร์", dom: "มุมอ่าน DOM", spatial: "มุมมอง spatial", missing: "ภาพไม่พร้อมใช้งาน แต่เรื่องเล่ายังอ่านได้", avatarFailed: "Presence ไม่พร้อมใช้งาน ภาพ เรื่องเล่า และปุ่มกลับยังใช้ได้", quiet: "ทางยังเปิดอยู่", closing: "หนูอาจเดินข้าง ๆ ได้บางช่วง\nแต่ทางที่จะไปต่อ — พี่ยังเป็นคนเลือกค่ะ", setting: "เชียงใหม่เป็น emotional / visual reference ไม่ใช่การระบุสถานที่จริงของภาพ", reading: "อ่านร่องรอยนี้", hideReading: "ปิดการอ่านร่องรอย" },
} satisfies Record<Locale, Record<string, string>>;
