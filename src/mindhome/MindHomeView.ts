import type { Locale } from "../story/localeState";
import { MINDHOME_COPY, MINDHOME_IMAGES, closedMindHome, type MindHomeState } from "./content";
import { CONDITIONS, type MindHomeCondition } from "./registration";

/** DOM meaning and controls remain available even when the photographic WebGL pass cannot load. */
export class MindHomeView {
  readonly element = document.createElement("section");
  readonly photoStage: HTMLElement;
  private readonly image: HTMLImageElement;
  private state = closedMindHome();
  private locale: Locale = "en";
  private imageRequest?: MindHomeCondition;
  private loadGeneration = 0;
  private readonly resizeObserver: ResizeObserver;
  constructor(private readonly actions: {
    select: (condition: MindHomeCondition) => void; return: () => void; locale: (locale: Locale) => void;
    imageReady: (condition: MindHomeCondition) => void; imageFailed: (condition: MindHomeCondition) => void;
    resize: () => void;
  }) {
    this.element.className = "mindhome-destination";
    this.element.hidden = true;
    this.element.setAttribute("aria-labelledby", "mindhome-title");
    this.element.innerHTML = `<header class="mindhome-header"><h1 id="mindhome-title" tabindex="-1">MindHome</h1><div class="mindhome-header-actions"><div class="mindhome-languages" role="group"><button type="button" data-mindhome-locale="en" lang="en">EN</button><button type="button" data-mindhome-locale="th" lang="th">TH</button></div><button type="button" data-mindhome="return"></button></div></header><div class="mindhome-photo-stage"><img width="1672" height="941" decoding="async" alt=""><p class="mindhome-phrase" aria-live="polite" aria-atomic="true"></p></div><footer class="mindhome-footer"><div class="mindhome-conditions" role="group"></div><p class="mindhome-status" role="status"></p></footer>`;
    this.photoStage = this.element.querySelector(".mindhome-photo-stage")!;
    this.image = this.photoStage.querySelector("img")!;
    const choices = this.element.querySelector(".mindhome-conditions")!;
    for (const condition of CONDITIONS) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.mindhomeCondition = condition;
      button.addEventListener("click", () => actions.select(condition)); choices.append(button);
    }
    this.element.querySelector('[data-mindhome="return"]')!.addEventListener("click", actions.return);
    for (const locale of ["en", "th"] as const) this.element.querySelector(`[data-mindhome-locale="${locale}"]`)!.addEventListener("click", () => actions.locale(locale));
    this.resizeObserver = new ResizeObserver(actions.resize); this.resizeObserver.observe(this.photoStage);
  }
  setLocale(locale: Locale): void { this.locale = locale; this.render(this.state); }
  focusHeading(): void { this.element.querySelector<HTMLElement>("h1")!.focus({ preventScroll: true }); }
  render(state: MindHomeState): void {
    const wasActive = this.state.active; this.state = state;
    this.element.hidden = !state.active;
    if (!state.active) { this.loadGeneration++; this.imageRequest = undefined; this.element.classList.remove("is-arriving"); return; }
    this.element.lang = this.locale;
    this.element.dataset.condition = state.condition;
    this.element.dataset.transitioning = String(state.transitioning);
    this.photoStage.dataset.transitioning = String(state.transitioning);
    this.element.classList.toggle("is-webgl", state.webgl);
    if (!wasActive) this.element.classList.add("is-arriving");
    const copy = MINDHOME_COPY[this.locale];
    this.element.querySelector('[data-mindhome="return"]')!.textContent = copy.return;
    this.element.querySelector(".mindhome-languages")!.setAttribute("aria-label", copy.language);
    this.element.querySelector(".mindhome-conditions")!.setAttribute("aria-label", copy.conditions);
    for (const locale of ["en", "th"] as const) this.element.querySelector(`[data-mindhome-locale="${locale}"]`)!.setAttribute("aria-pressed", String(this.locale === locale));
    for (const condition of CONDITIONS) {
      const button = this.element.querySelector<HTMLButtonElement>(`[data-mindhome-condition="${condition}"]`)!;
      button.textContent = copy.names[condition]; button.setAttribute("aria-pressed", String(state.condition === condition));
      button.disabled = state.transitioning || state.phase === "loading";
    }
    const phrase = this.element.querySelector<HTMLElement>(".mindhome-phrase")!;
    phrase.lang = this.locale; phrase.textContent = copy.phrases[state.displayedCondition];
    this.element.querySelector(".mindhome-status")!.textContent = state.imageFailed ? copy.imageUnavailable : state.phase === "loading" ? copy.loading : "";
    this.photoStage.setAttribute("aria-busy", String(state.phase === "loading" || state.transitioning));
    this.image.alt = `${copy.alt} — ${copy.names[state.displayedCondition]}`;
    const desiredImage = state.webgl ? state.displayedCondition : state.condition;
    if (this.imageRequest !== desiredImage) this.loadImage(desiredImage);
  }
  dispose(): void { this.loadGeneration++; this.resizeObserver.disconnect(); this.element.remove(); }
  private loadImage(condition: MindHomeCondition): void {
    this.imageRequest = condition;
    const generation = ++this.loadGeneration, image = new Image();
    const url = `${import.meta.env.BASE_URL}mindhome/${MINDHOME_IMAGES[condition]}`;
    image.onload = () => {
      image.onload = image.onerror = null;
      if (generation !== this.loadGeneration || !this.state.active) return;
      this.image.src = url; this.actions.imageReady(condition); this.actions.resize();
    };
    image.onerror = () => {
      image.onload = image.onerror = null;
      if (generation !== this.loadGeneration || !this.state.active) return;
      this.actions.imageFailed(condition);
    };
    image.src = url;
  }
}
