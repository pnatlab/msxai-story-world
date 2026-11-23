import workspaceMark from "../assets/product-marks/mss.svg";
import type { Locale } from "../story/localeState";

// Public UI phrases from the MSS Local LLM Lab empty-conversation layout
// (app.py, 32681bb). Context values illustrate an empty session.
const COPY = {
  en: {
    preview: "Preview",
    close: "Close preview",
    ecosystem: "Ecosystem",
    return: "Return to Living Ecosystem",
    note: "Read-only demonstration. No messages are sent.",
    welcome: "What would you like to work on?",
    hint: "Start a conversation. Add context when helpful.",
    message: "Message",
    placeholder: "Type a message…",
    send: "Send message",
    add: "Add",
    manage: "Manage Context",
    model: "No model available",
    context: "Next-request context",
    source: "Sources",
    sourceValue: "Excel not loaded",
    replayValue: "No saved thread loaded",
    persona: "Prompt / Persona",
    guardrails: "Guardrails",
    guardrailsValue: "Guardrails off",
    review: "Local AI draft. Review before relying on it.",
    editorialTitle: "Workspace Preview",
    editorialDescription: "Explore the interface concept of MSS Local LLM Lab. This is a read-only demonstration; no model is connected and no messages are sent.",
  },
  th: {
    preview: "ตัวอย่าง",
    close: "ปิดตัวอย่าง",
    ecosystem: "ระบบนิเวศ",
    return: "กลับสู่ระบบนิเวศ",
    note: "ตัวอย่างแบบอ่านอย่างเดียว ไม่มีการส่งข้อความ",
    welcome: "วันนี้อยากให้ช่วยเรื่องอะไร",
    hint: "เริ่มคุยได้เลย เพิ่มบริบทเมื่อจำเป็น",
    message: "ข้อความ",
    placeholder: "พิมพ์ข้อความที่นี่…",
    send: "ส่งข้อความ",
    add: "เพิ่ม",
    manage: "จัดการบริบท",
    model: "ไม่มีโมเดลพร้อมใช้งาน",
    context: "บริบทสำหรับคำขอถัดไป",
    source: "แหล่งข้อมูล",
    sourceValue: "ยังไม่ได้โหลด Excel",
    replayValue: "ยังไม่ได้โหลด thread ที่บันทึกไว้",
    persona: "พรอมต์ / Persona",
    guardrails: "กรอบกำกับ",
    guardrailsValue: "ยังไม่ได้ใช้กรอบกำกับ",
    review: "คำตอบจาก AI ในเครื่องเป็นฉบับร่าง ควรตรวจสอบก่อนนำไปใช้",
    editorialTitle: "ตัวอย่างพื้นที่ทำงาน",
    editorialDescription: "สำรวจแนวคิดหน้าตาของ MSS Local LLM Lab ผ่านการสาธิตแบบอ่านอย่างเดียว โดยไม่มีการเชื่อมต่อโมเดล AI และไม่มีการส่งข้อความจริง",
  },
} as const;

/** A static projection of the public welcome UI, mounted in the Story World dialog. */
export class WorkspacePreview {
  readonly element = document.createElement("dialog");

  constructor(close: () => void, returnToEcosystem: () => void) {
    this.element.className = "mss-workspace";
    this.element.setAttribute("aria-labelledby", "mss-workspace-title");
    this.element.setAttribute("aria-describedby", "mss-workspace-note");
    this.element.innerHTML = `
      <header class="mss-workspace-chrome">
        <div class="mss-workspace-disclosure">
          <span class="mss-workspace-badge" data-mss-copy="preview" data-mss-preview-label></span>
          <p id="mss-workspace-note" data-mss-copy="note" data-mss-workspace-note></p>
        </div>
        <div class="mss-workspace-actions">
          <button class="mss-workspace-return" type="button" data-mss-return-workspace>
            <span aria-hidden="true">←</span><span data-mss-copy="ecosystem"></span>
          </button>
          <button class="mss-workspace-close" type="button" data-mss-close-workspace autofocus>
            <span data-mss-copy="close"></span><span aria-hidden="true">×</span>
          </button>
        </div>
      </header>
      <div class="mss-workspace-body" tabindex="0" role="region" aria-labelledby="mss-workspace-title">
        <div class="mss-workspace-main">
          <header class="mss-workspace-brand">
            <img alt="" width="36" height="36">
            <div>
              <h2 id="mss-workspace-title" lang="en">Mindful System Studio</h2>
              <p lang="en">Human–AI Workspace by MSxAI</p>
            </div>
          </header>
          <div class="mss-workspace-persona">
            <span lang="en">Selected AI Persona</span>
            <strong>NuTuenSai</strong>
          </div>
          <div class="mss-workspace-welcome">
            <div class="mss-workspace-greeting">
              <h3 data-mss-copy="welcome"></h3>
              <p data-mss-copy="hint"></p>
            </div>
            <div class="mss-workspace-composer">
              <div class="mss-workspace-inputline">
                <input type="text" disabled aria-describedby="mss-workspace-note">
                <button class="mss-workspace-send" type="button" disabled><span aria-hidden="true">↑</span></button>
              </div>
              <div class="mss-workspace-tools">
                <button type="button" disabled><span aria-hidden="true">+</span><span data-mss-copy="add"></span></button>
                <button class="mss-workspace-manage" type="button" disabled>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
                    <path d="M12 7v3m4 3 3-1m-5 5 1.5 3m-6.5-3-1.5 3M8 13l-3-1"/>
                    <circle cx="12" cy="14" r="3.5"/><circle cx="12" cy="4.5" r="2"/>
                    <circle cx="21" cy="11" r="2"/><circle cx="17" cy="21" r="2"/>
                    <circle cx="7" cy="21" r="2"/><circle cx="3" cy="11" r="2"/>
                  </svg>
                  <span data-mss-copy="manage"></span>
                </button>
                <span class="mss-workspace-model" data-mss-copy="model"></span>
              </div>
            </div>
            <section class="mss-workspace-context" aria-labelledby="mss-workspace-context-title">
              <h3 id="mss-workspace-context-title" data-mss-copy="context"></h3>
              <dl>
                <div><dt data-mss-copy="source"></dt><dd data-mss-copy="sourceValue"></dd></div>
                <div><dt lang="en">Conversation replay</dt><dd data-mss-copy="replayValue"></dd></div>
                <div><dt data-mss-copy="persona"></dt><dd>NuTuenSai</dd></div>
                <div><dt data-mss-copy="guardrails"></dt><dd data-mss-copy="guardrailsValue"></dd></div>
              </dl>
            </section>
            <p class="mss-workspace-review" data-mss-copy="review"></p>
            <footer class="mss-workspace-editorial">
              <h3 data-mss-copy="editorialTitle"></h3>
              <p data-mss-copy="editorialDescription"></p>
            </footer>
          </div>
        </div>
      </div>
    `;
    this.element.querySelector<HTMLImageElement>("img")!.src = workspaceMark;
    this.element.querySelector("[data-mss-close-workspace]")!.addEventListener("click", close);
    this.element.querySelector("[data-mss-return-workspace]")!.addEventListener("click", returnToEcosystem);
    this.setLocale("en");
  }

  setLocale(locale: Locale): void {
    const copy = COPY[locale];
    this.element.lang = locale;
    this.element.querySelectorAll<HTMLElement>("[data-mss-copy]").forEach((element) => {
      // Workspace copy is scoped to this dialog.
      element.textContent = copy[element.dataset.mssCopy as keyof typeof copy];
    });
    const input = this.element.querySelector("input")!;
    input.setAttribute("aria-label", copy.message);
    input.placeholder = copy.placeholder;
    this.element.querySelector(".mss-workspace-send")!.setAttribute("aria-label", copy.send);
    this.element.querySelector("[data-mss-return-workspace]")!.setAttribute("aria-label", copy.return);
  }
}
