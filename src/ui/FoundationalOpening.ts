import type { Locale } from "../story/localeState";
import { UI_COPY } from "../i18n";
import { FOUNDATIONAL_ATTRIBUTION, FOUNDATIONAL_PHRASES, FOUNDATIONAL_QUOTE, foundationalFrame, FoundationalOpeningSession } from "./foundationalOpeningModel";

interface OpeningOptions {
  readonly replay?: boolean;
  readonly onFinish?: () => void;
  readonly returnFocus?: HTMLElement;
}

/** A disposable prelude. It never receives a scene, StoryState, or ecosystem controller. */
export class FoundationalOpening {
  private readonly element = document.createElement("section");
  private readonly paper = document.createElement("div");
  private readonly quote = document.createElement("figure");
  private readonly identity = document.createElement("p");
  private readonly attribution = document.createElement("figcaption");
  private readonly pause = document.createElement("button");
  private readonly skip = document.createElement("button");
  private readonly phrases: HTMLSpanElement[] = [];
  private readonly events = new AbortController();
  private readonly session = new FoundationalOpeningSession();
  private frame?: number;
  private lastTime?: number;
  private elapsed = 0;
  private paused = false;
  private visible = !document.hidden;
  private active = false;
  private locale: Locale = "en";

  constructor(container: HTMLElement, private readonly worldUi: HTMLElement, private reduced: boolean, private readonly options: OpeningOptions = {}) {
    if (!options.replay && this.session.hasSeen()) return;
    this.active = true;
    this.element.className = "foundational-opening";
    this.element.dataset.testid = "foundational-opening";
    this.element.tabIndex = -1;
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-describedby", "foundational-spoken-quote");
    const spoken = document.createElement("div");
    spoken.className = "foundational-opening__accessible";
    spoken.id = "foundational-spoken-quote";
    spoken.lang = "en";
    const blockquote = document.createElement("blockquote");
    blockquote.textContent = FOUNDATIONAL_QUOTE;
    const cite = document.createElement("p"); cite.textContent = FOUNDATIONAL_ATTRIBUTION;
    spoken.append(blockquote, cite);
    this.paper.className = "foundational-opening__paper";
    this.paper.setAttribute("aria-hidden", "true");
    this.quote.className = "foundational-opening__quote";
    this.quote.lang = "en";
    this.quote.setAttribute("aria-hidden", "true");
    const visualText = document.createElement("blockquote");
    FOUNDATIONAL_PHRASES.forEach((phrase, index) => {
      const span = document.createElement("span");
      span.textContent = (index ? " " : "") + phrase;
      visualText.append(span); this.phrases.push(span);
    });
    this.attribution.textContent = FOUNDATIONAL_ATTRIBUTION;
    this.quote.append(visualText, this.attribution);
    this.identity.className = "foundational-opening__identity";
    this.identity.textContent = "MSxAI";
    this.identity.setAttribute("aria-hidden", "true");
    const controls = document.createElement("div");
    controls.className = "foundational-opening__controls";
    this.pause.type = this.skip.type = "button";
    this.pause.dataset.openingAction = "pause"; this.skip.dataset.openingAction = "skip";
    controls.append(this.pause, this.skip);
    this.element.append(this.paper, spoken, this.quote, this.identity, controls);
    this.worldUi.inert = true;
    this.worldUi.classList.add("is-opening-covered");
    container.append(this.element);
    this.pause.addEventListener("click", () => {
      this.paused = !this.paused;
      // Pause presents the whole source immediately, without reflow or streaming.
      if (this.paused) this.elapsed = this.reduced ? 1000 : 2400;
      this.stopFrame(); this.setLocale(this.locale); this.render(); this.schedule();
    }, { signal: this.events.signal });
    this.skip.addEventListener("click", () => this.finish(), { signal: this.events.signal });
    this.element.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); this.finish(); }
    }, { signal: this.events.signal });
    this.setLocale(this.locale); this.render(); this.schedule();
    this.element.focus({ preventScroll: true });
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    if (!this.active) return;
    const copy = UI_COPY[locale];
    this.element.setAttribute("aria-label", copy.foundationalStatement);
    this.pause.textContent = this.paused ? copy.continueOpening : copy.pauseOpening;
    this.pause.setAttribute("aria-pressed", String(this.paused));
    this.skip.textContent = copy.skipOpening;
  }
  setReducedMotion(reduced: boolean): void {
    if (!this.active || reduced === this.reduced) return;
    if (reduced && this.elapsed >= 3650) { this.finish(); return; }
    this.reduced = reduced;
    this.elapsed = reduced ? 0 : 2400;
    this.stopFrame(); this.render(); this.schedule();
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.stopFrame(); this.schedule();
  }
  dispose(): void { this.finish(false, false); }

  private readonly tick = (now: number): void => {
    this.frame = undefined;
    if (!this.active || this.paused || !this.visible) return;
    if (this.lastTime !== undefined) this.elapsed += now - this.lastTime;
    this.lastTime = now;
    if (foundationalFrame(this.elapsed, this.reduced).complete) { this.finish(); return; }
    this.render(); this.schedule();
  };
  private schedule(): void {
    if (this.active && this.visible && !this.paused && this.frame === undefined) this.frame = requestAnimationFrame(this.tick);
  }
  private stopFrame(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined; this.lastTime = undefined;
  }
  private render(): void {
    const state = foundationalFrame(this.elapsed, this.reduced);
    this.element.dataset.phase = state.phase;
    this.element.dataset.paused = String(this.paused);
    this.element.dataset.reduced = String(this.reduced);
    this.phrases.forEach((span, index) => { span.style.opacity = String(state.phrases[index]); });
    this.quote.style.opacity = String(state.quoteOpacity);
    this.attribution.style.opacity = String(state.attributionOpacity);
    this.identity.style.opacity = String(state.identityOpacity);
    const white = [247, 248, 245]; const blue = [3, 11, 28];
    this.paper.style.backgroundColor = `rgb(${white.map((value, index) => Math.round(value + (blue[index] - value) * state.paperDarkness)).join(",")})`;
    this.paper.style.opacity = String(state.paperOpacity);
    this.element.classList.toggle("is-dark", state.paperDarkness > 0.7);
    this.pause.hidden = !this.paused && !state.canPause;
    this.worldUi.style.setProperty("--opening-ui-opacity", String(state.worldUiOpacity));
  }
  private finish(markSeen = true, focus = true): void {
    if (!this.active) return;
    this.active = false;
    this.stopFrame(); this.events.abort();
    if (markSeen && !this.options.replay) this.session.markSeen();
    this.element.remove();
    this.worldUi.inert = false;
    this.worldUi.classList.remove("is-opening-covered");
    this.worldUi.style.removeProperty("--opening-ui-opacity");
    this.options.onFinish?.();
    if (focus && document.hasFocus()) {
      const target = this.options.returnFocus ?? this.worldUi.querySelector<HTMLElement>('.story-list:not([hidden]) button, .entry-card [data-action="begin"]');
      target?.focus({ preventScroll: true });
    }
  }
}
