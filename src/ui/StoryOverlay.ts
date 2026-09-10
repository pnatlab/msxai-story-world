import type { StoryState } from "../story/storyState";
import type { Locale } from "../story/localeState";
import { localizedBeat, localizedNode, localizedNextLabel, localizedTruthfulnessNotice, localizedWorldTitle, MEANING_COPY, UI_COPY } from "../i18n";
import type { StoryWorldDefinition } from "../world/world.schema";
import { createAccessibleStoryView } from "./AccessibleStoryView";

export interface OverlayActions {
  readonly beginStory: () => void;
  readonly exploreFreely: () => void;
  readonly resumeStory: () => void;
  readonly next: () => void;
  readonly back: () => void;
  readonly resetView: () => void;
  readonly returnToHuman: () => void;
  readonly selectNode: (nodeId: string) => void;
  readonly setStoryListOpen: (open: boolean) => void;
  readonly setAboutOpen: (open: boolean) => void;
  readonly setLocale: (locale: Locale) => void;
}

type NodeProjection = { x: number; y: number; depth: number; visible: boolean };

export class StoryOverlay {
  public readonly element = document.createElement("div");
  private readonly labels = new Map<string, HTMLButtonElement>();
  private readonly detail = document.createElement("aside");
  private readonly entry = document.createElement("section");
  private readonly about = document.createElement("section");
  private readonly storyList: ReturnType<typeof createAccessibleStoryView>;
  private currentState?: StoryState;
  private projectNode?: (nodeId: string) => NodeProjection;
  private locale: Locale = "en";
  private readonly fallbackMessage?: { readonly en: string; readonly th: string };

  public constructor(private readonly world: StoryWorldDefinition, private readonly actions: OverlayActions, fallbackMessage?: { readonly en: string; readonly th: string }) {
    this.fallbackMessage = fallbackMessage;
    this.element.className = "story-overlay";
    this.element.innerHTML = `
      <header class="story-header">
        <a class="wordmark" href="./" data-copy="wordmark">MSxAI <span>Story World</span></a>
        <p class="free-mode-cue" data-copy="free-mode" hidden></p>
        <div class="story-header__actions">
          <button class="quiet-button" type="button" data-action="show-about" data-copy="show-about"></button>
          <button class="quiet-button" type="button" data-action="story-list" data-copy="story-list"></button>
          <div class="language-switch" role="group" data-copy-label="language">
            <button type="button" data-locale="en" aria-label="English">EN</button>
            <span aria-hidden="true">|</span>
            <button type="button" data-locale="th" aria-label="ภาษาไทย">TH</button>
          </div>
        </div>
      </header>
      <section class="story-copy" aria-live="polite">
        <p class="eyebrow" data-copy="mode"></p>
        <h1 data-copy="title"></h1>
        <div data-copy="lines"></div>
      </section>
      <nav class="story-controls" data-copy-label="storyControls">
        <button class="quiet-button" type="button" data-action="back" data-copy="back"></button>
        <button class="primary-button" type="button" data-action="next" data-copy="next"></button>
        <button class="quiet-button" type="button" data-action="explore" data-copy="explore"></button>
        <button class="quiet-button" type="button" data-action="reset" data-copy="reset"></button>
        <button class="quiet-button" type="button" data-action="human" data-copy="human"></button>
      </nav>
      <p class="truth-cue" data-copy="truth-cue"></p>
      <div class="node-labels" data-copy-label="conceptAnchors"></div>
    `;

    this.entry.className = "entry-card";
    this.entry.dataset.testid = "entry-card";
    this.entry.innerHTML = `
      <p class="eyebrow" data-copy="entry-eyebrow"></p>
      <h1 data-copy="entry-title"></h1>
      <p class="entry-card__boundary" data-copy="entry-boundary"></p>
      <div class="entry-card__actions">
        <button class="primary-button" type="button" data-action="begin" data-copy="begin"></button>
        <button class="quiet-button" type="button" data-action="free" data-copy="free"></button>
      </div>
      <p class="fallback-message" data-copy="fallback" role="status" hidden></p>
    `;
    this.element.append(this.entry);

    this.detail.className = "concept-detail";
    this.detail.setAttribute("aria-live", "polite");
    this.element.append(this.detail);

    this.about.className = "about-dialog";
    this.about.setAttribute("role", "dialog");
    this.about.setAttribute("aria-modal", "true");
    this.about.setAttribute("aria-label", UI_COPY.en.showAbout);
    this.about.hidden = true;
    this.about.innerHTML = `
      <div class="about-dialog__panel">
        <button class="icon-button" type="button" data-action="close-about">×</button>
        <p class="eyebrow" data-copy="meaning"></p>
        <h2 data-copy="meaning-title"></h2>
        <p data-copy="meaning-boundary"></p>
        <p data-copy="meaning-editorial"></p>
        <p data-copy="meaning-relationships"></p>
      </div>
    `;
    this.element.append(this.about);

    this.storyList = createAccessibleStoryView(world, {
      selectNode: actions.selectNode,
      back: actions.back,
      next: actions.next,
      returnToHuman: actions.returnToHuman,
      close: () => actions.setStoryListOpen(false),
    });
    this.storyList.element.hidden = true;
    this.element.append(this.storyList.element);

    const labels = this.element.querySelector<HTMLElement>(".node-labels");
    if (!labels) throw new Error("Node label region is missing.");
    world.nodes.forEach((node) => {
      const button = document.createElement("button");
      button.className = "node-label";
      button.type = "button";
      button.dataset.nodeId = node.id;
      button.innerHTML = "<strong></strong>";
      button.addEventListener("click", () => actions.selectNode(node.id));
      labels.append(button);
      this.labels.set(node.id, button);
    });

    this.bindActions();
    this.renderStaticCopy();
  }

  public setProjector(projectNode: (nodeId: string) => NodeProjection): void {
    this.projectNode = projectNode;
  }

  public setLocale(locale: Locale): void {
    this.locale = locale;
    this.renderStaticCopy();
    if (this.currentState) this.render(this.currentState);
  }

  public render(state: StoryState): void {
    this.currentState = state;
    this.renderStaticCopy();
    const beat = this.world.beats[state.beatIndex];
    const localized = localizedBeat(beat, this.locale);
    this.element.querySelector<HTMLElement>('[data-copy="mode"]')!.textContent = state.mode === "guided"
      ? `${UI_COPY[this.locale].guidedStory} · ${beat.order + 1} / ${this.world.beats.length}`
      : UI_COPY[this.locale].freeExplore;
    this.element.querySelector<HTMLElement>('[data-copy="title"]')!.textContent = localized.title;
    const lines = this.element.querySelector<HTMLElement>('[data-copy="lines"]')!;
    lines.replaceChildren(...localized.lines.map((line) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      return paragraph;
    }));
    this.entry.hidden = !state.entryOpen;
    this.element.querySelector<HTMLElement>(".story-copy")!.hidden = state.entryOpen || state.mode === "free";
    this.element.querySelector<HTMLElement>('[data-copy="free-mode"]')!.hidden = state.mode !== "free" || state.entryOpen;
    this.element.querySelector<HTMLElement>(".story-controls")!.hidden = state.entryOpen;
    this.about.hidden = !state.aboutOpen;
    this.storyList.element.hidden = !state.storyListOpen;
    this.storyList.render(state, this.locale);

    const next = this.element.querySelector<HTMLButtonElement>('[data-action="next"]')!;
    const back = this.element.querySelector<HTMLButtonElement>('[data-action="back"]')!;
    next.textContent = state.mode === "free" ? UI_COPY[this.locale].resumeStory : localizedNextLabel(beat, this.locale) ?? UI_COPY[this.locale].storyComplete;
    next.disabled = state.mode === "guided" && state.beatIndex === this.world.beats.length - 1;
    back.disabled = state.mode === "free" || state.beatIndex === 0;
    const explore = this.element.querySelector<HTMLButtonElement>('[data-action="explore"]')!;
    explore.textContent = UI_COPY[this.locale].exploreFreely;
    explore.hidden = state.mode === "free";
    this.renderDetail(state.selectedNodeId);
    this.refreshLabels();
  }

  public refreshLabels(): void {
    if (!this.currentState || !this.projectNode) {
      this.labels.forEach((label) => { label.hidden = true; });
      return;
    }
    const beat = this.world.beats[this.currentState.beatIndex];
    const visibleNodes = this.currentState.mode === "free" ? this.world.nodes.map((node) => node.id) : beat.revealNodeIds;
    this.labels.forEach((label, id) => {
      const projection = this.projectNode?.(id);
      const node = this.world.nodes.find((entry) => entry.id === id);
      const isPrimaryNode = node?.kind === "human" || node?.kind === "intention" || node?.kind === "framework";
      const shouldName = this.currentState?.mode === "free"
        ? isPrimaryNode || id === this.currentState.selectedNodeId
        : id === beat.focusNodeId || (beat.id === "opening" && id === "human") || id === this.currentState?.selectedNodeId;
      const visible = visibleNodes.includes(id) && shouldName && Boolean(projection?.visible) && !this.currentState?.storyListOpen;
      label.hidden = !visible;
      label.classList.toggle("is-selected", id === this.currentState?.selectedNodeId);
      if (projection) {
        label.style.transform = `translate(${projection.x}px, ${projection.y}px)`;
        label.style.opacity = String(Math.max(0.48, Math.min(1, 1.18 - projection.depth * 0.35)));
      }
    });
  }

  private renderStaticCopy(): void {
    const copy = UI_COPY[this.locale];
    const opening = localizedBeat(this.world.beats[0], this.locale);
    document.title = copy.pageTitle;
    document.documentElement.lang = this.locale;
    this.element.querySelector<HTMLElement>('[data-copy="wordmark"]')!.innerHTML = `MSxAI <span>${copy.storyWorld}</span>`;
    this.element.querySelector<HTMLElement>('[data-copy="wordmark"]')!.setAttribute("aria-label", copy.restart);
    this.element.querySelector<HTMLElement>('[data-copy="free-mode"]')!.textContent = copy.freeExplore;
    this.element.querySelector<HTMLElement>('[data-copy="show-about"]')!.textContent = copy.showAbout;
    this.element.querySelector<HTMLElement>('[data-copy="story-list"]')!.textContent = copy.storyList;
    this.element.querySelector<HTMLElement>('[data-copy="back"]')!.textContent = copy.back;
    this.element.querySelector<HTMLElement>('[data-copy="next"]')!.textContent = copy.next;
    this.element.querySelector<HTMLElement>('[data-copy="explore"]')!.textContent = copy.exploreFreely;
    this.element.querySelector<HTMLElement>('[data-copy="reset"]')!.textContent = copy.resetView;
    this.element.querySelector<HTMLElement>('[data-copy="human"]')!.textContent = copy.returnToHuman;
    this.element.querySelector<HTMLElement>('[data-copy="truth-cue"]')!.textContent = copy.conceptualRelationships;
    this.element.querySelector<HTMLElement>('[data-copy="entry-eyebrow"]')!.textContent = localizedWorldTitle(this.locale);
    this.element.querySelector<HTMLElement>('[data-copy="entry-title"]')!.textContent = opening.lines.join(" ");
    this.element.querySelector<HTMLElement>('[data-copy="entry-boundary"]')!.textContent = localizedTruthfulnessNotice(this.world, this.locale);
    this.element.querySelector<HTMLElement>('[data-copy="begin"]')!.textContent = copy.beginStory;
    this.element.querySelector<HTMLElement>('[data-copy="free"]')!.textContent = copy.exploreFreely;
    const fallback = this.element.querySelector<HTMLElement>('[data-copy="fallback"]')!;
    fallback.textContent = this.fallbackMessage?.[this.locale] ?? "";
    fallback.hidden = !this.fallbackMessage;
    this.about.setAttribute("aria-label", copy.showAbout);
    this.element.querySelector<HTMLElement>('[data-copy="meaning"]')!.textContent = copy.meaning;
    this.element.querySelector<HTMLElement>('[data-copy="meaning-title"]')!.textContent = MEANING_COPY[this.locale].title;
    this.element.querySelector<HTMLElement>('[data-copy="meaning-boundary"]')!.textContent = localizedTruthfulnessNotice(this.world, this.locale);
    this.element.querySelector<HTMLElement>('[data-copy="meaning-editorial"]')!.textContent = MEANING_COPY[this.locale].editorialParagraph;
    this.element.querySelector<HTMLElement>('[data-copy="meaning-relationships"]')!.textContent = MEANING_COPY[this.locale].relationshipClarification;
    this.element.querySelector<HTMLElement>('[data-copy-label="storyControls"]')!.setAttribute("aria-label", copy.storyControls);
    this.element.querySelector<HTMLElement>('[data-copy-label="conceptAnchors"]')!.setAttribute("aria-label", copy.conceptAnchors);
    this.element.querySelector<HTMLElement>('[data-copy-label="language"]')!.setAttribute("aria-label", copy.language);
    this.element.querySelector<HTMLButtonElement>('[data-action="close-about"]')!.setAttribute("aria-label", copy.closeAbout);
    this.element.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
      const active = button.dataset.locale === this.locale;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
    this.labels.forEach((button, id) => {
      const node = this.world.nodes.find((entry) => entry.id === id);
      if (node) button.querySelector("strong")!.textContent = localizedNode(node, this.locale).label;
    });
  }

  private renderDetail(selectedNodeId?: string): void {
    const node = this.world.nodes.find((entry) => entry.id === selectedNodeId);
    const beat = this.currentState ? this.world.beats[this.currentState.beatIndex] : undefined;
    const isAutomaticGuidedFocus = this.currentState?.mode === "guided" && beat?.focusNodeId === selectedNodeId;
    if (!node || this.currentState?.entryOpen || this.currentState?.storyListOpen || isAutomaticGuidedFocus) {
      this.detail.hidden = true;
      return;
    }
    this.detail.hidden = false;
    const localized = localizedNode(node, this.locale);
    this.detail.innerHTML = `
      <p class="eyebrow" data-copy="detail-eyebrow"></p>
      <h2 data-copy="detail-title"></h2>
      <p data-copy="detail-summary"></p>
      <ul data-copy="detail-lines"></ul>
    `;
    this.detail.querySelector<HTMLElement>('[data-copy="detail-eyebrow"]')!.textContent = UI_COPY[this.locale].conceptAnchor;
    this.detail.querySelector<HTMLElement>('[data-copy="detail-title"]')!.textContent = localized.label;
    this.detail.querySelector<HTMLElement>('[data-copy="detail-summary"]')!.textContent = localized.summary;
    const lines = this.detail.querySelector<HTMLUListElement>('[data-copy="detail-lines"]')!;
    localized.detail.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      lines.append(item);
    });
  }

  private bindActions(): void {
    const listen = (action: string, callback: () => void) => {
      this.element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener("click", callback);
    };
    listen("begin", this.actions.beginStory);
    listen("free", this.actions.exploreFreely);
    listen("next", () => this.currentState?.mode === "free" ? this.actions.resumeStory() : this.actions.next());
    listen("back", this.actions.back);
    listen("explore", () => this.currentState?.mode === "free" ? this.actions.resumeStory() : this.actions.exploreFreely());
    listen("reset", this.actions.resetView);
    listen("human", this.actions.returnToHuman);
    listen("story-list", () => this.actions.setStoryListOpen(true));
    listen("show-about", () => this.actions.setAboutOpen(true));
    listen("close-about", () => this.actions.setAboutOpen(false));
    this.element.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
      button.addEventListener("click", () => {
        const locale = button.dataset.locale;
        if (locale === "en" || locale === "th") this.actions.setLocale(locale);
      });
    });
  }
}
