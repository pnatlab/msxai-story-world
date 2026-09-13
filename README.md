# MSxAI 3D Story World — Slice 1

An isolated TypeScript, Vite, and plain Three.js frontend for the conceptual story:

```text
HUMAN → INTENTION → MSxAI
```

It does not import or modify MSS, Context Room, Ollama, user sources, or operational request state.

## Run locally

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The browser test stores deterministic review images in `artifacts/screenshots/`.

The Story World supports a compact EN / TH language switcher. English is the default;
all localized content is deterministic and defined in the repository, with no translation
API, AI translation, or runtime network dependency.

## Foundational quote opening

A silent, skippable six-second prelude presents Pnat's original English statement (2025)
before the existing entry screen. “Pause to read” holds the complete quote; Escape or
“Skip opening” proceeds immediately. Reduced motion uses a brief static presentation.
A single sessionStorage flag avoids repeats in the same tab session; blocked storage
falls back to memory for the current page. There is no tracking or durable storage.
The English source remains available in About / Meaning in both locales; no Thai quote
is presented as historically authored wording. No replay button or additional media,
audio, renderer, or dependency is introduced.

## Living Ecosystem overview

Living Ecosystem is an optional, non-linear perspective on the same canonical concepts
and conceptual relationships—not another story act or a runtime diagram. Enter from the
opening card, story controls, or accessible Story List. Select a concept to inspect its
connections; select it again, use “View whole ecosystem,” or press Escape to clear focus.
“Return to Story World” restores the previous story state and camera (reframed if the
viewport orientation changed). EN / TH and sound preferences remain unchanged. Reduced
motion enters the settled view immediately; the concept list also works without WebGL.

## Procedural UI Interaction Sound

Subtle UI feedback is generated locally with the browser Web Audio API. It uses no audio
files, music API, LLM, network service, or third-party sound library. Sound is disabled by
default, starts only after an explicit Sound On action, and responds only to meaningful UI
interactions.

## Deployment

Create a production build with:

```bash
npm run build
```

GitHub Pages deploys the generated `dist/` artifact through GitHub Actions whenever
changes are pushed to `main` (or when the workflow is run manually). The repository's
GitHub Pages source is GitHub Actions. The public site is expected at
[https://pnatlab.github.io/msxai-story-world/](https://pnatlab.github.io/msxai-story-world/).
