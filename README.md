# MSxAI 3D Story World — Slice 1

An isolated TypeScript, Vite, and plain Three.js frontend for the conceptual story:

```text
HUMAN → INTENTION → MSxAI
```

It does not import or modify MSS, Context Room, Ollama, user sources, or operational request state.

## Run locally

```bash
cd story-world
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
