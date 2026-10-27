import type { Locale } from "../story/localeState";
import mindhomeSymbol from "../assets/product-marks/mindhome.svg";
import { MINDHOME_COPY, MINDHOME_IMAGES, MINDHOME_PRESENCE_IMAGES, closedMindHome, type MindHomeState } from "./content";
import { CONDITIONS, type MindHomeCondition } from "./registration";

/** DOM meaning and controls remain available even when the photographic WebGL pass cannot load. */
export class MindHomeView {
  readonly element = document.createElement("section");
  readonly photoStage: HTMLElement;
  private readonly image: HTMLImageElement;
  private readonly presence: HTMLElement;
  private readonly presenceImages = new Map<MindHomeCondition, HTMLImageElement>();
  private disposed = false;
  private state = closedMindHome();
  private locale: Locale = "en";
  private imageRequest?: MindHomeCondition;
  private loadGeneration = 0;
  private readonly resizeObserver: ResizeObserver;
  constructor(private readonly actions: {
    select: (condition: MindHomeCondition) => void; return: () => void; locale: (locale: Locale) => void;
    imageReady: (condition: MindHomeCondition) => void; imageFailed: (condition: MindHomeCondition) => void;
    resize: () => void; toggleInvitation: () => void;
  }) {
    this.element.className = "mindhome-destination";
    this.element.hidden = true;
    this.element.setAttribute("aria-labelledby", "mindhome-title");
    this.element.innerHTML = `<header class="mindhome-header"><div class="mindhome-brand"><h1 id="mindhome-title" tabindex="-1">MindHome</h1></div><div class="mindhome-header-actions"><div class="mindhome-languages" role="group"><button type="button" data-mindhome-locale="en" lang="en">EN</button><button type="button" data-mindhome-locale="th" lang="th">TH</button></div><button type="button" data-mindhome="return"></button></div></header><div class="mindhome-photo-stage"><img width="1672" height="941" decoding="async" alt=""><p class="mindhome-phrase" aria-live="polite" aria-atomic="true"></p></div><footer class="mindhome-footer"><div class="mindhome-conditions" role="group"></div><p class="mindhome-status" role="status"></p></footer>`;
    const brandSymbol = document.createElement("img");
    brandSymbol.className = "mindhome-brand-symbol";
    brandSymbol.src = mindhomeSymbol;
    brandSymbol.alt = "";
    brandSymbol.setAttribute("aria-hidden", "true");
    brandSymbol.setAttribute("focusable", "false");
    this.element.querySelector(".mindhome-brand")!.prepend(brandSymbol);
    this.photoStage = this.element.querySelector(".mindhome-photo-stage")!;
    this.photoStage.setAttribute("role", "group");
    this.image = this.photoStage.querySelector("img")!;
    this.image.className = "mindhome-environment-image";
    this.presence = document.createElement("div");
    this.presence.className = "mindhome-presence";
    this.presence.setAttribute("role", "img");
    this.photoStage.insertBefore(this.presence, this.photoStage.querySelector(".mindhome-phrase"));
    const invitation = document.createElement("button");
    invitation.type = "button"; invitation.className = "mindhome-invitation";
    invitation.dataset.mindhomeInvite = "";
    invitation.innerHTML = '<span class="mindhome-invitation-light" aria-hidden="true"></span><span class="mindhome-invitation-cue" aria-hidden="true"></span>';
    invitation.addEventListener("click", actions.toggleInvitation);
    this.photoStage.insertBefore(invitation, this.photoStage.querySelector(".mindhome-phrase"));
    // Three reusable DOM images; no portrait textures enter the shared WebGL scene.
    for (const condition of CONDITIONS) {
      const image = document.createElement("img");
      image.width = 941; image.height = 1672; image.decoding = "async"; image.alt = "";
      image.hidden = true; image.dataset.presenceCondition = condition;
      image.onload = image.onerror = () => { if (!this.disposed) this.updatePresence(); };
      this.presenceImages.set(condition, image); this.presence.append(image);
    }
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
    if (!state.active) { this.loadGeneration++; this.imageRequest = undefined; this.element.classList.remove("is-arriving"); this.updatePresence(); return; }
    this.element.lang = this.locale;
    this.element.dataset.condition = state.condition;
    this.element.dataset.displayedCondition = state.displayedCondition;
    this.element.dataset.transitioning = String(state.transitioning);
    this.element.dataset.invitationState = state.invitation;
    this.photoStage.dataset.transitioning = String(state.transitioning);
    this.element.classList.toggle("is-webgl", state.webgl);
    if (!wasActive) this.element.classList.add("is-arriving");
    const copy = MINDHOME_COPY[this.locale];
    const invitation = this.element.querySelector<HTMLButtonElement>("[data-mindhome-invite]")!;
    invitation.hidden = !state.webgl;
    const invitationCopy = state.invitation === "quiet" || state.invitation === "inviting" ? copy.invite : copy.dismiss;
    invitation.setAttribute("aria-label", invitationCopy);
    invitation.querySelector<HTMLElement>(".mindhome-invitation-cue")!.textContent = invitationCopy;
    invitation.disabled = !state.webgl || state.phase !== "ready" || state.transitioning || state.invitation === "inviting" || state.invitation === "dismissing";
    for (const [condition, image] of this.presenceImages) {
      if (!image.hasAttribute("src")) image.src = `${import.meta.env.BASE_URL}mindhome/presence/${MINDHOME_PRESENCE_IMAGES[condition]}`;
    }
    this.presence.setAttribute("aria-label", copy.presenceAlt[state.displayedCondition]);
    this.updatePresence();
    this.element.querySelector('[data-mindhome="return"]')!.textContent = copy.return;
    this.element.querySelector(".mindhome-languages")!.setAttribute("aria-label", copy.language);
    this.element.querySelector(".mindhome-conditions")!.setAttribute("aria-label", copy.conditions);
    for (const locale of ["en", "th"] as const) this.element.querySelector(`[data-mindhome-locale="${locale}"]`)!.setAttribute("aria-pressed", String(this.locale === locale));
    for (const condition of CONDITIONS) {
      const button = this.element.querySelector<HTMLButtonElement>(`[data-mindhome-condition="${condition}"]`)!;
      button.textContent = copy.names[condition]; button.setAttribute("aria-pressed", String(state.condition === condition));
      button.disabled = state.transitioning || state.phase === "loading" || state.invitation === "inviting" || state.invitation === "dismissing";
    }
    const phrase = this.element.querySelector<HTMLElement>(".mindhome-phrase")!;
    phrase.lang = this.locale; phrase.textContent = copy.phrases[state.displayedCondition];
    this.element.querySelector(".mindhome-status")!.textContent = state.imageFailed ? copy.imageUnavailable : state.phase === "loading" ? copy.loading : state.invitationFailed ? copy.invitationUnavailable : "";
    this.photoStage.setAttribute("aria-busy", String(state.phase === "loading" || state.transitioning));
    this.image.alt = `${copy.alt} — ${copy.names[state.displayedCondition]}`;
    this.photoStage.setAttribute("aria-label", this.image.alt);
    const desiredImage = state.webgl ? state.displayedCondition : state.condition;
    if (this.imageRequest !== desiredImage) this.loadImage(desiredImage);
  }
  dispose(): void {
    this.disposed = true; this.loadGeneration++; this.resizeObserver.disconnect();
    this.presenceImages.forEach(image => { image.onload = image.onerror = null; });
    this.presenceImages.clear(); this.element.remove();
  }
  private updatePresence(): void {
    const available = this.state.active && this.state.phase === "ready" && !this.state.transitioning;
    let ready = false;
    for (const [condition, image] of this.presenceImages) {
      image.hidden = condition !== this.state.displayedCondition;
      if (!image.hidden) ready = image.complete && image.naturalWidth > 0;
    }
    this.element.dataset.narrativeReady = String(available);
    this.presence.dataset.visible = String(available && ready);
    this.presence.setAttribute("aria-hidden", String(!available || !ready));
  }
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
