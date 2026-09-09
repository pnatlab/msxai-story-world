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

## Deployment

Create a production build with:

```bash
npm run build
```

GitHub Pages deploys the generated `dist/` artifact through GitHub Actions whenever
changes are pushed to `main` (or when the workflow is run manually). The repository's
GitHub Pages source is GitHub Actions. The public site is expected at
[https://pnatlab.github.io/msxai-story-world/](https://pnatlab.github.io/msxai-story-world/).
