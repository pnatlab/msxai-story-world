import type { Locale } from "../story/localeState";
import mssMark from "../assets/product-marks/mss.svg";
import mindhomeMark from "../assets/product-marks/mindhome.svg";
import mhbMark from "../assets/product-marks/mhb.png";
import tradingMark from "../assets/product-marks/trading-home.png";

export type ProductId = "mss" | "mindhome" | "mhb" | "wave-glass-project-h";
type ProductCopy = { name: string; description: string; need: string; role: string; principle: string };
export interface ProductIdentity {
  mark: string;
  accent: string;
  colors: readonly [string, string, string];
  copy: Record<Locale, ProductCopy>;
}

/** Editorial product presentation only. No runtime connection to these applications. */
export const PRODUCT_IDENTITIES: Record<ProductId, ProductIdentity> = {
  mss: {
    mark: mssMark, accent: "#acdfff", colors: ["#9dccff", "#b7e9ff", "#e3f4ff"],
    copy: {
      en: { name: "Mindful System Studio", description: "A conversational workspace for drafting and reviewing with AI. You choose the context brought into the conversation and review what comes back.", need: "Keep the material and intention behind a complex conversation visible.", role: "The ecosystem’s working space: turn an intention into a draft you can inspect, question and revise.", principle: "AI drafts. The person directs and reviews." },
      th: { name: "Mindful System Studio", description: "พื้นที่สนทนาเพื่อร่างและทบทวนงานร่วมกับ AI คุณเลือกบริบทที่จะนำเข้าบทสนทนา และตรวจสิ่งที่ AI ตอบกลับมา", need: "มองเห็นทั้งข้อมูลและเจตนาเบื้องหลังบทสนทนาที่ซับซ้อน", role: "พื้นที่ลงมือทำของระบบนิเวศ เปลี่ยนเจตนาเป็นร่างงานที่คุณตรวจ ตั้งคำถาม และปรับแก้ได้", principle: "AI ช่วยร่าง มนุษย์กำหนดทิศทางและทบทวน" },
    },
  },
  mindhome: {
    mark: mindhomeMark, accent: "#e2ddca", colors: ["#ded9c5", "#bdd4cc", "#d2e5e9"],
    copy: {
      en: { name: "MindHome", description: "A reflective space to pause, notice what is pulling your attention, and choose a small grounded next step.", need: "A little space between what touches the mind and the next response.", role: "Brings pause and reflection to human agency—before action or a faster answer. A non-clinical reflection space.", principle: "Pause → Reflect → Regain Agency" },
      th: { name: "MindHome", description: "พื้นที่สะท้อนเพื่อหยุด สังเกตสิ่งที่กำลังดึงความสนใจ และเลือกก้าวเล็ก ๆ ที่อยู่กับความเป็นจริง", need: "มีช่องว่างเล็ก ๆ ระหว่างสิ่งที่มากระทบใจ กับการตอบสนองถัดไป", role: "นำการหยุดและทบทวนกลับสู่อำนาจการเลือกของมนุษย์ ก่อนลงมือหรือเร่งหาคำตอบ เป็นพื้นที่สะท้อนที่ไม่ใช่การรักษา", principle: "หยุด → ทบทวน → กลับมาเลือกเอง" },
    },
  },
  mhb: {
    mark: mhbMark, accent: "#d1c0ff", colors: ["#b9a7f4", "#f6c596", "#92c6ef"],
    copy: {
      en: { name: "Mindful Health Balance", description: "A personal record of meals, water, sleep, activity and mind notes, with reflection on the patterns you choose to record.", need: "See everyday context without pressure to fill every field or turn your life into a score.", role: "The everyday observation space: connect self-care signals with lived experience, while keeping their meaning yours. Observation, not diagnosis.", principle: "Honest data matters more than complete data." },
      th: { name: "Mindful Health Balance", description: "พื้นที่บันทึกอาหาร น้ำ การนอน กิจกรรม และเรื่องในใจ พร้อมทบทวนรูปแบบจากสิ่งที่คุณเลือกบันทึก", need: "เห็นบริบทชีวิตประจำวัน โดยไม่ต้องกรอกให้ครบหรือเปลี่ยนชีวิตเป็นคะแนน", role: "พื้นที่สังเกตชีวิตประจำวัน เชื่อมสิ่งที่บันทึกเรื่องการดูแลตัวเองกับประสบการณ์จริง โดยความหมายยังเป็นของคุณ เป็นการสังเกต ไม่ใช่การวินิจฉัย", principle: "ข้อมูลที่จริงสำคัญกว่าข้อมูลที่ครบ" },
    },
  },
  "wave-glass-project-h": {
    mark: tradingMark, accent: "#a3e6d8", colors: ["#8ed8cd", "#b6e9f2", "#8ebfdd"],
    copy: {
      en: { name: "MSxAI Trading Home", description: "An observation workspace for market structure, planning and the human state around a decision.", need: "See context before urgency turns into action.", role: "The ecosystem’s decision-clarity space: review information, uncertainty and plans before choosing what to do. Market interpretation does not promise a future outcome.", principle: "Structure first. The decision stays with you." },
      th: { name: "MSxAI Trading Home", description: "พื้นที่สังเกตโครงสร้างตลาด วางแผน และมองภาวะของมนุษย์ที่อยู่รอบการตัดสินใจ", need: "เห็นบริบทก่อนที่ความเร่งจะพาไปลงมือ", role: "พื้นที่สร้างความชัดเจนก่อนตัดสินใจ ทบทวนข้อมูล ความไม่แน่นอน และแผนก่อนเลือกว่าจะทำอะไร การตีความตลาดไม่ได้รับประกันผลในอนาคต", principle: "มองโครงสร้างก่อน การตัดสินใจยังเป็นของคุณ" },
    },
  },
};

export function productIdentity(id?: string): ProductIdentity | undefined {
  return id && Object.hasOwn(PRODUCT_IDENTITIES, id) ? PRODUCT_IDENTITIES[id as ProductId] : undefined;
}

export const PRODUCT_COPY: Record<Locale, { closer: string; need: string; role: string }> = {
  en: { closer: "Its place in MSxAI", need: "A human need", role: "Within the ecosystem" },
  th: { closer: "บทบาทใน MSxAI", need: "พื้นที่ที่มนุษย์ต้องการ", role: "ในระบบนิเวศ" },
};
