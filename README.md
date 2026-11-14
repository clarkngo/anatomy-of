# anatomy-of

Labeled breakdowns of things, from real objects to abstract ideas.
Live site: https://clarkngo.github.io/anatomy-of/

## Structure

```
index.html          home page (grid built from anatomies.json)
anatomies.json      list of entries shown on the home page
assets/             shared CSS and JS
<slug>/build.mjs    builds that anatomy's page with the Anatomy kit
<slug>/index.html   the built page, e.g. pencil/
tools/anatomy/      vendored Anatomy kit (MIT)
tools/embed.mjs     the figure embed shared with the AI 410 course figures
```

## Adding an anatomy

Figures are live isometric machines drawn with the
[Anatomy skill for Claude Code](https://skills.wheresryan.sh/anatomy).
Its drawing kit is vendored in `tools/anatomy/` (MIT).

1. In Claude Code, run `/anatomy explain <idea>, interactive` and ask for a
   standalone light-theme page in a new `<slug>/` folder. `pencil/build.mjs`
   is the reference: it writes `pencil/index.html`.
2. Rebuild a figure any time with `node <slug>/build.mjs` (add `--dark` for a
   dark preview at `<slug>/dark.html`, which is not committed).
3. Add an entry to `anatomies.json`:
   ```json
   { "slug": "trust", "title": "trust", "kind": "idea", "summary": "…", "parts": 4 }
   ```
   `kind` drives the filter buttons on the home page (e.g. `object`, `idea`, `system`).

## Figures from AI 410

`rag-pipeline/`, `guardrail/` and `push-chain/` are copies of the lecture figures in
[cityuseattle/ai410](https://github.com/cityuseattle/ai410) (Modules 2–4, CC BY 4.0).
Their build scripts call the same embed as the course (`tools/embed.mjs`), so a change
there can be copied back almost unchanged; `page()` writes the standalone page and
`thumb.svg`. `rag-pipeline/docs.json` is a copy of the Module 2 simulator's documents,
stop words and synonyms, so the figure ranks chunks exactly as the simulator does.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy

GitHub Pages → Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
