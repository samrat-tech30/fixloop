# frontend/ — Next.js (App Router) + Tailwind v4

Load the `fixloop-frontend-sky-ink` skill before any UI work. API contracts: `../docs/API.md`; TypeScript mirrors in `src/lib/types.ts`.

Run: `npm run dev` · Check: `npm run build` and `npm run lint` (type-check).

## Structure
```
src/app/layout.tsx              fonts (Newsreader, Geist, Geist Mono) + Header
src/app/globals.css             Tailwind v4 + Sky Ink tokens (@theme)
src/app/page.tsx                Explain screen   (TO BUILD — prompt 3)
src/app/fix/page.tsx            Fix screen       (TO BUILD — prompt 7)
src/app/stats/page.tsx          Stats screen     (TO BUILD — prompt 4)
src/app/api/proxy/[...path]/route.ts   server-side proxy to the backend (adds X-API-Key)
src/components/                 shared UI pieces
src/lib/api.ts                  the ONLY place that calls fetch()
src/lib/types.ts                response/request types
```

## Rules
- Client components call `api.*` from `src/lib/api.ts`, which hits `/api/proxy/...`. Never call the backend URL from the browser and never put keys in `NEXT_PUBLIC_*`.
- Render every model/LLM string as text. No `dangerouslySetInnerHTML`.
- Use `"use client"` only on interactive components; keep pages simple.
- No emoji in UI; icons from `lucide-react`.
- This folder deploys to Vercel on its own (Root Directory = `frontend`). Never import from `../backend`.
