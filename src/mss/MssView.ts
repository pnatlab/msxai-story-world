import type { Locale } from "../story/localeState";
import { CHAPTER_STOPS, MSS_COPY, MSS_IDENTITY, PHASE_IDS, phaseAt } from "./story";

/** The browser owns scrolling. The sticky frame only presents the current chapter. */
export class MssView {
  readonly element = document.createElement("section");
  private readonly scroll: HTMLElement;
  private readonly chapters: HTMLButtonElement[];
  private readonly phases: HTMLElement[];
  private readonly observer: ResizeObserver;
  private progress = 0;
  private travel = 0;
  private phase = -1;

  constructor(private readonly actions: {
    return: () => void;
    locale: (locale: Locale) => void;
    scroll: (progress: number) => void;
  }) {
    this.element.className = "mss-destination";
    this.element.hidden = true;
    this.element.setAttribute("aria-labelledby", "mss-title");
    this.element.innerHTML = `
      <div class="mss-scroll" tabindex="0" role="region" aria-labelledby="mss-title" aria-describedby="mss-scroll-hint">
        <div class="mss-runway">
          <div class="mss-frame">
            <div data-mss-fallback aria-hidden="true"></div>
            <header class="mss-header">
              <div class="mss-identity"><p><span>Mindful System Studio</span><span data-mss-copy="workspace"></span></p><h1 id="mss-title" tabindex="-1"></h1></div>
              <div class="mss-actions">
                <div class="mss-languages" role="group">
                  <button type="button" class="quiet-button" data-mss-locale="en" lang="en">EN</button>
                  <button type="button" class="quiet-button" data-mss-locale="th" lang="th">TH</button>
                </div>
                <button type="button" class="quiet-button" data-mss="return"><span aria-hidden="true">←</span> <span data-mss-copy="return"></span></button>
              </div>
            </header>
            <div class="mss-editorial" aria-live="polite" aria-atomic="true">
              ${PHASE_IDS.map(id => `<article class="mss-phase" id="mss-phase-${id}" hidden><h2></h2><p></p></article>`).join("")}
            </div>
            <div class="mss-wayfinding">
              <p id="mss-scroll-hint" data-mss-copy="scroll"></p>
              <nav class="mss-chapters">
                ${PHASE_IDS.map((id, index) => `<button type="button" data-mss-phase="${index}" aria-controls="mss-phase-${id}"><span aria-hidden="true"></span></button>`).join("")}
              </nav>
            </div>
          </div>
        </div>
      </div>`;
    this.scroll = this.element.querySelector(".mss-scroll")!;
    this.chapters = Array.from(this.element.querySelectorAll("[data-mss-phase]"));
    this.phases = Array.from(this.element.querySelectorAll(".mss-phase"));
    this.element.querySelector('[data-mss="return"]')!.addEventListener("click", actions.return);
    for (const locale of ["en", "th"] as const) {
      this.element.querySelector(`[data-mss-locale="${locale}"]`)!.addEventListener("click", () => actions.locale(locale));
    }
    this.chapters.forEach((button, index) => button.addEventListener("click", () => {
      this.scroll.scrollTop = CHAPTER_STOPS[index] * this.travel;
      this.onScroll();
    }));
    this.scroll.addEventListener("scroll", this.onScroll, { passive: true });
    this.observer = new ResizeObserver(this.onScroll);
  }

  setLocale(locale: Locale): void {
    const copy = MSS_COPY[locale];
    this.element.lang = locale;
    this.element.querySelector<HTMLElement>("#mss-title")!.textContent = copy.title;
    this.element.querySelector('.mss-identity span')!.textContent = MSS_IDENTITY.copy[locale].name;
    for (const key of ["workspace", "return", "scroll"] as const) {
      this.element.querySelector(`[data-mss-copy="${key}"]`)!.textContent = copy[key];
    }
    this.element.querySelector(".mss-languages")!.setAttribute("aria-label", copy.language);
    this.element.querySelector(".mss-chapters")!.setAttribute("aria-label", copy.chapters);
    this.element.querySelectorAll<HTMLButtonElement>("[data-mss-locale]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.mssLocale === locale));
    });
    this.phases.forEach((phase, index) => {
      const [title, line] = copy.phases[index];
      phase.querySelector("h2")!.textContent = title;
      phase.querySelector("p")!.textContent = line;
      this.chapters[index].setAttribute("aria-label", title);
    });
  }

  open(): void {
    this.setWebgl(false);
    this.element.hidden = false;
    this.scroll.scrollTop = 0;
    this.progress = 0;
    this.travel = this.scroll.scrollHeight - this.scroll.clientHeight;
    this.showPhase(0);
    this.observer.observe(this.scroll);
    this.element.querySelector<HTMLElement>("h1")!.focus({ preventScroll: true });
  }

  close(): void {
    this.observer.disconnect();
    this.element.hidden = true;
    this.setWebgl(false);
  }

  setWebgl(ready: boolean): void {
    this.element.dataset.renderer = ready ? "webgl" : "fallback";
    this.element.querySelector<HTMLElement>("[data-mss-fallback]")!.hidden = ready;
  }

  dispose(): void {
    this.close();
    this.scroll.removeEventListener("scroll", this.onScroll);
    this.element.remove();
  }

  private readonly onScroll = (): void => {
    if (this.element.hidden) return;
    const travel = this.scroll.scrollHeight - this.scroll.clientHeight;
    // Orientation can clamp scrollTop before ResizeObserver fires. Rebase
    // against the last progress before interpreting that clamped position.
    if (travel !== this.travel) {
      this.travel = travel;
      this.scroll.scrollTop = travel * this.progress;
    }
    if (travel <= 0) return;
    const progress = Math.max(0, Math.min(this.scroll.scrollTop / this.travel, 1));
    if (progress === this.progress) return;
    this.progress = progress;
    this.showPhase(phaseAt(progress));
    this.actions.scroll(progress);
  };

  private showPhase(phase: number): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.element.dataset.phase = String(phase);
    this.phases.forEach((article, index) => { article.hidden = phase !== index; });
    this.chapters.forEach((button, index) => {
      if (phase === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }
}
